package cz.pbas.kantyna.mobile.orders

import cz.pbas.kantyna.mobile.db.KantynaDatabase
import cz.pbas.kantyna.mobile.dto.DayMenuItems
import cz.pbas.kantyna.mobile.dto.DepartmentData
import cz.pbas.kantyna.mobile.dto.ExtraMealItem
import cz.pbas.kantyna.mobile.dto.MenuItem
import cz.pbas.kantyna.mobile.dto.Order
import cz.pbas.kantyna.mobile.dto.OrderData
import cz.pbas.kantyna.mobile.dto.OrderRowEnriched
import cz.pbas.kantyna.mobile.dto.OrderStatus
import cz.pbas.kantyna.mobile.network.KantynaJson
import cz.pbas.kantyna.mobile.network.NetworkException
import cz.pbas.kantyna.mobile.network.apiDelete
import cz.pbas.kantyna.mobile.network.apiGet
import cz.pbas.kantyna.mobile.network.apiPatch
import cz.pbas.kantyna.mobile.network.apiPost
import io.ktor.client.HttpClient
import io.ktor.client.request.header
import io.ktor.client.request.parameter
import io.ktor.client.request.setBody
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString

interface OrderRepository {
    suspend fun getOrderForDate(date: String): Result<OrderData>
    suspend fun createRow(orderId: Int, body: OrderRowCreate): Result<OrderRowEnriched>
    suspend fun updateRow(rowId: Int, body: OrderRowPatch): Result<OrderRowEnriched>
    suspend fun deleteRow(rowId: Int): Result<Unit>
    suspend fun sendOrder(orderId: Int): Result<Order>
    suspend fun syncOutbox(): Result<Int>
    fun pendingOutboxCount(): Long
}

class OrderRepositoryImpl(
    private val httpClient: HttpClient,
    private val database: KantynaDatabase,
) : OrderRepository {
    private val outbox = OutboxEngine(httpClient, database)
    private val cache = mutableMapOf<String, OrderData>()
    private var tempRowCounter = -1

    override fun pendingOutboxCount(): Long = outbox.pendingCount()

    override suspend fun getOrderForDate(date: String): Result<OrderData> =
        runCatching {
            val data = httpClient.apiGet<OrderData>("orders") {
                parameter("date", date)
            }
            cache[date] = data
            data
        }.recoverCatching { error ->
            if (error !is NetworkException) throw mapOrderApiError(error)
            cache[date] ?: throw error
        }

    override suspend fun createRow(orderId: Int, body: OrderRowCreate): Result<OrderRowEnriched> =
        runMutation(
            opType = OutboxOpType.create_row,
            path = "orders/$orderId/rows",
            method = "POST",
            payloadJson = {
                val tempRowId = nextTempRowId()
                KantynaJson.encodeToString(OutboxCreateRowPayload(orderId, tempRowId, body))
            },
            online = {
                val idempotencyKey = outbox.newIdempotencyKey()
                httpClient.apiPost<OrderRowEnriched>("orders/$orderId/rows") {
                    header("Idempotency-Key", idempotencyKey)
                    setBody(body)
                }
            },
            optimistic = { orderData, payloadJson ->
                val payload = KantynaJson.decodeFromString<OutboxCreateRowPayload>(payloadJson)
                applyCreateOptimistic(orderData, payload)
            },
        )

    override suspend fun updateRow(rowId: Int, body: OrderRowPatch): Result<OrderRowEnriched> {
        if (rowId < 0) {
            return mergeTempRowUpdate(rowId, body)
        }
        return runMutation(
            opType = OutboxOpType.update_row,
            path = "orders/rows/$rowId",
            method = "PATCH",
            payloadJson = {
                KantynaJson.encodeToString(OutboxUpdateRowPayload(rowId, body))
            },
            online = {
                val idempotencyKey = outbox.newIdempotencyKey()
                httpClient.apiPatch<OrderRowEnriched>("orders/rows/$rowId") {
                    header("Idempotency-Key", idempotencyKey)
                    setBody(body)
                }
            },
            optimistic = { orderData, payloadJson ->
                val payload = KantynaJson.decodeFromString<OutboxUpdateRowPayload>(payloadJson)
                applyUpdateOptimistic(orderData, payload.rowId, payload.body)
            },
        )
    }

    override suspend fun deleteRow(rowId: Int): Result<Unit> {
        if (rowId < 0) {
            return removeTempRow(rowId)
        }
        return runMutationUnit(
            opType = OutboxOpType.delete_row,
            path = "orders/rows/$rowId",
            method = "DELETE",
            payloadJson = {
                KantynaJson.encodeToString(OutboxDeleteRowPayload(rowId))
            },
            online = {
                val idempotencyKey = outbox.newIdempotencyKey()
                httpClient.apiDelete("orders/rows/$rowId") {
                    header("Idempotency-Key", idempotencyKey)
                }
            },
            optimistic = { orderData, payloadJson ->
                val payload = KantynaJson.decodeFromString<OutboxDeleteRowPayload>(payloadJson)
                applyDeleteOptimistic(orderData, payload.rowId)
            },
        )
    }

    override suspend fun sendOrder(orderId: Int): Result<Order> =
        runMutationOrder(
            opType = OutboxOpType.send_order,
            path = "orders/$orderId/send",
            method = "POST",
            payloadJson = {
                KantynaJson.encodeToString(OutboxSendOrderPayload(orderId))
            },
            online = {
                val idempotencyKey = outbox.newIdempotencyKey()
                httpClient.apiPost<Order>("orders/$orderId/send") {
                    header("Idempotency-Key", idempotencyKey)
                }
            },
            optimistic = { orderData, _ ->
                orderData.copy(
                    order = orderData.order.copy(
                        status = OrderStatus.SENT,
                        sentAt = orderData.order.sentAt ?: "pending",
                    ),
                )
            },
        )

    override suspend fun syncOutbox(): Result<Int> = outbox.syncOutbox()

    private suspend fun <T> runMutation(
        opType: OutboxOpType,
        path: String,
        method: String,
        payloadJson: () -> String,
        online: suspend () -> T,
        optimistic: (OrderData, String) -> OrderData,
    ): Result<T> = runCatching {
        try {
            online()
        } catch (error: Exception) {
            if (error !is NetworkException) throw mapOrderApiError(error)
            val payload = payloadJson()
            val idempotencyKey = outbox.newIdempotencyKey()
            outbox.enqueue(opType, method, path, payload, idempotencyKey)
            updateCacheForOrder(extractOrderId(opType, payload)) { cached ->
                optimistic(cached, payload)
            }
            @Suppress("UNCHECKED_CAST")
            buildOptimisticRowResult(payload, opType) as T
        }
    }.mapError()

    private suspend fun runMutationUnit(
        opType: OutboxOpType,
        path: String,
        method: String,
        payloadJson: () -> String,
        online: suspend () -> Unit,
        optimistic: (OrderData, String) -> OrderData,
    ): Result<Unit> = runCatching {
        try {
            online()
        } catch (error: Exception) {
            if (error !is NetworkException) throw mapOrderApiError(error)
            val payload = payloadJson()
            val idempotencyKey = outbox.newIdempotencyKey()
            outbox.enqueue(opType, method, path, payload, idempotencyKey)
            updateCacheForOrder(extractOrderId(opType, payload)) { cached ->
                optimistic(cached, payload)
            }
        }
    }.mapError()

    private suspend fun runMutationOrder(
        opType: OutboxOpType,
        path: String,
        method: String,
        payloadJson: () -> String,
        online: suspend () -> Order,
        optimistic: (OrderData, String) -> OrderData,
    ): Result<Order> = runCatching {
        try {
            online()
        } catch (error: Exception) {
            if (error !is NetworkException) throw mapOrderApiError(error)
            val payload = payloadJson()
            val idempotencyKey = outbox.newIdempotencyKey()
            outbox.enqueue(opType, method, path, payload, idempotencyKey)
            val orderId = extractOrderId(opType, payload)
            updateCacheForOrder(orderId) { cached ->
                optimistic(cached, payload)
            }
            cache.values.find { it.order.id == orderId }?.order
                ?: throw NetworkException(message = "Chybí lokální objednávka pro offline odeslání")
        }
    }.mapError()

    private fun mergeTempRowUpdate(rowId: Int, body: OrderRowPatch): Result<OrderRowEnriched> =
        runCatching {
            val pending = database.outbox_opsQueries.selectAllPending().executeAsList()
            val createOp = pending.firstOrNull { op ->
                op.op_type == OutboxOpType.create_row.name &&
                    runCatching {
                        KantynaJson.decodeFromString<OutboxCreateRowPayload>(op.body_json.orEmpty()).tempRowId == rowId
                    }.getOrDefault(false)
            } ?: error("Dočasný řádek nenalezen")

            val payload = KantynaJson.decodeFromString<OutboxCreateRowPayload>(createOp.body_json.orEmpty())
            val mergedBody = mergeCreateWithPatch(payload.body, body)
            val updatedPayload = payload.copy(body = mergedBody)
            database.outbox_opsQueries.deleteById(createOp.id)
            outbox.enqueue(
                opType = OutboxOpType.create_row,
                method = "POST",
                path = "orders/${payload.orderId}/rows",
                bodyJson = KantynaJson.encodeToString(updatedPayload),
                idempotencyKey = outbox.newIdempotencyKey(),
            )
            updateCacheForOrder(payload.orderId) { cached ->
                applyUpdateOptimistic(cached, rowId, body)
            }
            findRowInCache(rowId) ?: buildRowFromCreate(
                payload.orderId,
                rowId,
                mergedBody,
                cache.values.first { it.order.id == payload.orderId }.todayMenu,
            )
        }.mapError()

    private fun removeTempRow(rowId: Int): Result<Unit> = runCatching {
        val pending = database.outbox_opsQueries.selectAllPending().executeAsList()
        val createOp = pending.firstOrNull { op ->
            op.op_type == OutboxOpType.create_row.name &&
                runCatching {
                    KantynaJson.decodeFromString<OutboxCreateRowPayload>(op.body_json.orEmpty()).tempRowId == rowId
                }.getOrDefault(false)
        } ?: error("Dočasný řádek nenalezen")
        database.outbox_opsQueries.deleteById(createOp.id)
        val payload = KantynaJson.decodeFromString<OutboxCreateRowPayload>(createOp.body_json.orEmpty())
        updateCacheForOrder(payload.orderId) { cached ->
            applyDeleteOptimistic(cached, rowId)
        }
    }.mapError()

    private fun mergeCreateWithPatch(create: OrderRowCreate, patch: OrderRowPatch): OrderRowCreate =
        create.copy(
            personName = patch.personName ?: create.personName,
            soupItemId = patch.soupItemId ?: create.soupItemId,
            soupItemId2 = patch.soupItemId2 ?: create.soupItemId2,
            mainItemId = patch.mainItemId ?: create.mainItemId,
            mealCount = patch.mealCount ?: create.mealCount,
            extraMeals = patch.extraMeals ?: create.extraMeals,
            rollCount = patch.rollCount ?: create.rollCount,
            breadDumplingCount = patch.breadDumplingCount ?: create.breadDumplingCount,
            potatoDumplingCount = patch.potatoDumplingCount ?: create.potatoDumplingCount,
            ketchupCount = patch.ketchupCount ?: create.ketchupCount,
            tatarkaCount = patch.tatarkaCount ?: create.tatarkaCount,
            bbqCount = patch.bbqCount ?: create.bbqCount,
            note = patch.note ?: create.note,
        )

    private fun applyCreateOptimistic(orderData: OrderData, payload: OutboxCreateRowPayload): OrderData {
        val row = buildRowFromCreate(
            orderId = payload.orderId,
            rowId = payload.tempRowId,
            body = payload.body,
            menu = orderData.todayMenu,
        )
        return insertRow(orderData, row)
    }

    private fun applyUpdateOptimistic(orderData: OrderData, rowId: Int, patch: OrderRowPatch): OrderData {
        val existing = findRow(orderData, rowId) ?: return orderData
        val menu = orderData.todayMenu
        val updated = existing.copy(
            personName = patch.personName ?: existing.personName,
            soupItemId = patch.soupItemId ?: existing.soupItemId,
            soupItemId2 = patch.soupItemId2 ?: existing.soupItemId2,
            mainItemId = patch.mainItemId ?: existing.mainItemId,
            mealCount = patch.mealCount ?: existing.mealCount,
            extraMeals = patch.extraMeals ?: existing.extraMeals,
            rollCount = patch.rollCount ?: existing.rollCount,
            breadDumplingCount = patch.breadDumplingCount ?: existing.breadDumplingCount,
            potatoDumplingCount = patch.potatoDumplingCount ?: existing.potatoDumplingCount,
            ketchupCount = patch.ketchupCount ?: existing.ketchupCount,
            tatarkaCount = patch.tatarkaCount ?: existing.tatarkaCount,
            bbqCount = patch.bbqCount ?: existing.bbqCount,
            note = patch.note ?: existing.note,
            soupItem = menu.soups.find { it.id == (patch.soupItemId ?: existing.soupItemId) },
            soupItem2 = menu.soups.find { it.id == (patch.soupItemId2 ?: existing.soupItemId2) },
            mainItem = menu.meals.find { it.id == (patch.mainItemId ?: existing.mainItemId) },
        )
        return replaceRow(orderData, updated)
    }

    private fun applyDeleteOptimistic(orderData: OrderData, rowId: Int): OrderData {
        val departments = orderData.departments.map { dept ->
            val rows = dept.rows.filterNot { it.id == rowId }
            dept.copy(
                rows = rows,
                subtotal = rows.sumOf { it.rowPrice ?: 0 },
            )
        }
        return orderData.copy(
            departments = departments,
            totalPrice = departments.sumOf { it.subtotal },
        )
    }

    private fun insertRow(orderData: OrderData, row: OrderRowEnriched): OrderData {
        val departments = orderData.departments.map { dept ->
            if (dept.name != row.department) {
                dept
            } else {
                val rows = dept.rows + row
                dept.copy(
                    rows = rows,
                    subtotal = rows.sumOf { it.rowPrice ?: estimateRowPrice(row, orderData.todayMenu) },
                )
            }
        }
        return orderData.copy(
            departments = departments,
            totalPrice = departments.sumOf { it.subtotal },
        )
    }

    private fun replaceRow(orderData: OrderData, row: OrderRowEnriched): OrderData {
        val departments = orderData.departments.map { dept ->
            val rows = dept.rows.map { if (it.id == row.id) row else it }
            dept.copy(
                rows = rows,
                subtotal = rows.sumOf { it.rowPrice ?: estimateRowPrice(it, orderData.todayMenu) },
            )
        }
        return orderData.copy(
            departments = departments,
            totalPrice = departments.sumOf { it.subtotal },
        )
    }

    private fun findRow(orderData: OrderData, rowId: Int): OrderRowEnriched? =
        orderData.departments.flatMap { it.rows }.firstOrNull { it.id == rowId }

    private fun findRowInCache(rowId: Int): OrderRowEnriched? =
        cache.values.firstNotNullOfOrNull { findRow(it, rowId) }

    private fun buildOptimisticRowResult(payloadJson: String, opType: OutboxOpType): OrderRowEnriched {
        val cached = cache.values.firstOrNull()
            ?: error("Chybí lokální objednávka pro optimistickou aktualizaci")
        return when (opType) {
            OutboxOpType.create_row -> {
                val payload = KantynaJson.decodeFromString<OutboxCreateRowPayload>(payloadJson)
                findRow(cached, payload.tempRowId)
                    ?: buildRowFromCreate(payload.orderId, payload.tempRowId, payload.body, cached.todayMenu)
            }
            OutboxOpType.update_row -> {
                val payload = KantynaJson.decodeFromString<OutboxUpdateRowPayload>(payloadJson)
                findRow(cached, payload.rowId)
                    ?: error("Řádek nenalezen v lokální cache")
            }
            else -> error("Nepodporovaná operace pro row result")
        }
    }

    private fun buildRowFromCreate(
        orderId: Int,
        rowId: Int,
        body: OrderRowCreate,
        menu: DayMenuItems,
    ): OrderRowEnriched {
        val soupItem = menu.soups.find { it.id == body.soupItemId }
        val soupItem2 = menu.soups.find { it.id == body.soupItemId2 }
        val mainItem = menu.meals.find { it.id == body.mainItemId }
        val row = OrderRowEnriched(
            id = rowId,
            orderId = orderId,
            department = body.department,
            sortOrder = 0,
            personName = body.personName.orEmpty(),
            soupItemId = body.soupItemId,
            soupItemId2 = body.soupItemId2,
            mainItemId = body.mainItemId,
            mealCount = body.mealCount,
            extraMeals = body.extraMeals,
            rollCount = body.rollCount,
            breadDumplingCount = body.breadDumplingCount,
            potatoDumplingCount = body.potatoDumplingCount,
            ketchupCount = body.ketchupCount,
            tatarkaCount = body.tatarkaCount,
            bbqCount = body.bbqCount,
            note = body.note,
            soupItem = soupItem,
            soupItem2 = soupItem2,
            mainItem = mainItem,
            extraMealItems = body.extraMeals?.mapNotNull { entry ->
                menu.meals.find { it.id == entry.itemId }?.let { ExtraMealItem(it, entry.count) }
            },
            rowPrice = estimateRowPriceFromBody(body, menu),
        )
        return row
    }

    private fun estimateRowPrice(row: OrderRowEnriched, menu: DayMenuItems): Int =
        (row.soupItem?.price ?: 0) +
            (row.soupItem2?.price ?: 0) +
            (row.mainItem?.price ?: 0) * row.mealCount +
            (row.extraMealItems?.sumOf { it.item.price * it.count } ?: 0)

    private fun estimateRowPriceFromBody(body: OrderRowCreate, menu: DayMenuItems): Int {
        val soup1 = menu.soups.find { it.id == body.soupItemId }?.price ?: 0
        val soup2 = menu.soups.find { it.id == body.soupItemId2 }?.price ?: 0
        val main = menu.meals.find { it.id == body.mainItemId }?.price ?: 0
        val extras = body.extraMeals?.sumOf { entry ->
            (menu.meals.find { it.id == entry.itemId }?.price ?: 0) * entry.count
        } ?: 0
        return soup1 + soup2 + main * body.mealCount + extras
    }

    private fun nextTempRowId(): Int = tempRowCounter--

    private fun updateCacheForOrder(orderId: Int, transform: (OrderData) -> OrderData) {
        cache.entries.find { it.value.order.id == orderId }?.let { (date, data) ->
            cache[date] = transform(data)
        }
    }

    private fun extractOrderId(opType: OutboxOpType, payloadJson: String): Int = when (opType) {
        OutboxOpType.create_row ->
            KantynaJson.decodeFromString<OutboxCreateRowPayload>(payloadJson).orderId
        OutboxOpType.update_row, OutboxOpType.delete_row -> {
            val rowId = when (opType) {
                OutboxOpType.update_row ->
                    KantynaJson.decodeFromString<OutboxUpdateRowPayload>(payloadJson).rowId
                OutboxOpType.delete_row ->
                    KantynaJson.decodeFromString<OutboxDeleteRowPayload>(payloadJson).rowId
                else -> error("Unexpected op type")
            }
            cache.values.flatMap { it.departments.flatMap { dept -> dept.rows } }
                .firstOrNull { it.id == rowId }?.orderId
                ?: cache.values.first().order.id
        }
        OutboxOpType.send_order ->
            KantynaJson.decodeFromString<OutboxSendOrderPayload>(payloadJson).orderId
    }

    private fun <T> Result<T>.mapError(): Result<T> = fold(
        onSuccess = { Result.success(it) },
        onFailure = { Result.failure(mapOrderApiError(it)) },
    )
}
