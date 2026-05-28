package cz.pbas.kantyna.mobile.orders

import cz.pbas.kantyna.mobile.dto.MealEntry
import kotlinx.serialization.Serializable

@Serializable
enum class OutboxOpType {
    create_row,
    update_row,
    delete_row,
    send_order,
}

@Serializable
data class OrderRowCreate(
    val department: String,
    val personName: String? = null,
    val soupItemId: Int? = null,
    val soupItemId2: Int? = null,
    val mainItemId: Int? = null,
    val mealCount: Int = 1,
    val extraMeals: List<MealEntry>? = null,
    val rollCount: Int? = null,
    val breadDumplingCount: Int? = null,
    val potatoDumplingCount: Int? = null,
    val ketchupCount: Int? = null,
    val tatarkaCount: Int? = null,
    val bbqCount: Int? = null,
    val note: String? = null,
)

@Serializable
data class OrderRowPatch(
    val personName: String? = null,
    val soupItemId: Int? = null,
    val soupItemId2: Int? = null,
    val mainItemId: Int? = null,
    val mealCount: Int? = null,
    val extraMeals: List<MealEntry>? = null,
    val rollCount: Int? = null,
    val breadDumplingCount: Int? = null,
    val potatoDumplingCount: Int? = null,
    val ketchupCount: Int? = null,
    val tatarkaCount: Int? = null,
    val bbqCount: Int? = null,
    val note: String? = null,
)

@Serializable
data class OutboxCreateRowPayload(
    val orderId: Int,
    val tempRowId: Int,
    val body: OrderRowCreate,
)

@Serializable
data class OutboxUpdateRowPayload(
    val rowId: Int,
    val body: OrderRowPatch,
)

@Serializable
data class OutboxDeleteRowPayload(
    val rowId: Int,
)

@Serializable
data class OutboxSendOrderPayload(
    val orderId: Int,
)
