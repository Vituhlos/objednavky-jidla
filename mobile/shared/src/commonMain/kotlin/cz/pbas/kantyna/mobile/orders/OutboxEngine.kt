package cz.pbas.kantyna.mobile.orders

import cz.pbas.kantyna.mobile.db.KantynaDatabase
import cz.pbas.kantyna.mobile.dto.Order
import cz.pbas.kantyna.mobile.dto.OrderRowEnriched
import cz.pbas.kantyna.mobile.network.ApiException
import cz.pbas.kantyna.mobile.network.KantynaJson
import cz.pbas.kantyna.mobile.network.NetworkException
import cz.pbas.kantyna.mobile.network.apiDelete
import cz.pbas.kantyna.mobile.network.apiPatch
import cz.pbas.kantyna.mobile.network.apiPost
import io.ktor.client.HttpClient
import io.ktor.client.request.header
import io.ktor.client.request.setBody
import kotlinx.datetime.Clock
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlin.uuid.ExperimentalUuidApi
import kotlin.uuid.Uuid

class OutboxEngine(
    private val httpClient: HttpClient,
    private val database: KantynaDatabase,
) {
    fun pendingCount(): Long = database.outbox_opsQueries.countPending().executeAsOne()

    fun enqueue(
        opType: OutboxOpType,
        method: String,
        path: String,
        bodyJson: String?,
        idempotencyKey: String,
    ) {
        database.outbox_opsQueries.insertOp(
            id = idempotencyKey,
            op_type = opType.name,
            method = method,
            path = path,
            body_json = bodyJson,
            idempotency_key = idempotencyKey,
            created_at = currentEpochMillis(),
            retry_count = 0L,
        )
    }

    suspend fun syncOutbox(): Result<Int> = runCatching {
        val pending = database.outbox_opsQueries.selectAllPending().executeAsList()
        var synced = 0
        for (op in pending) {
            try {
                executeOp(op)
                database.outbox_opsQueries.deleteById(op.id)
                synced++
            } catch (error: ApiException) {
                if (error.code == "ORDER_SENT" || error.statusCode in listOf(403, 404, 409)) {
                    database.outbox_opsQueries.deleteById(op.id)
                    throw mapOrderApiError(error)
                }
                database.outbox_opsQueries.incrementRetry(op.id)
                throw mapOrderApiError(error)
            } catch (error: NetworkException) {
                throw error
            } catch (error: Exception) {
                database.outbox_opsQueries.incrementRetry(op.id)
                throw error
            }
        }
        synced
    }

    private suspend fun executeOp(op: cz.pbas.kantyna.mobile.db.Outbox_ops) {
        val idempotencyKey = op.idempotency_key
        when (op.op_type) {
            OutboxOpType.create_row.name -> {
                val payload = KantynaJson.decodeFromString<OutboxCreateRowPayload>(op.body_json.orEmpty())
                httpClient.apiPost<OrderRowEnriched>("orders/${payload.orderId}/rows") {
                    header("Idempotency-Key", idempotencyKey)
                    setBody(payload.body)
                }
            }
            OutboxOpType.update_row.name -> {
                val payload = KantynaJson.decodeFromString<OutboxUpdateRowPayload>(op.body_json.orEmpty())
                httpClient.apiPatch<OrderRowEnriched>("orders/rows/${payload.rowId}") {
                    header("Idempotency-Key", idempotencyKey)
                    setBody(payload.body)
                }
            }
            OutboxOpType.delete_row.name -> {
                val payload = KantynaJson.decodeFromString<OutboxDeleteRowPayload>(op.body_json.orEmpty())
                httpClient.apiDelete("orders/rows/${payload.rowId}") {
                    header("Idempotency-Key", idempotencyKey)
                }
            }
            OutboxOpType.send_order.name -> {
                val payload = KantynaJson.decodeFromString<OutboxSendOrderPayload>(op.body_json.orEmpty())
                httpClient.apiPost<Order>("orders/${payload.orderId}/send") {
                    header("Idempotency-Key", idempotencyKey)
                }
            }
            else -> error("Neznámá outbox operace: ${op.op_type}")
        }
    }

    @OptIn(ExperimentalUuidApi::class)
    fun newIdempotencyKey(): String = Uuid.random().toString()

    private fun currentEpochMillis(): Long = Clock.System.now().toEpochMilliseconds()
}
