package cz.pbas.kantyna.mobile.dto

import kotlinx.serialization.Serializable

@Serializable
data class OrderSummaryWithDepts(
    val id: Int,
    val date: String,
    val status: OrderStatus,
    val sentAt: String? = null,
    val extraEmail: String? = null,
    val rowCount: Int,
    val depts: List<String>,
    val peopleCount: Int,
    val totalPrice: Int,
)

@Serializable
data class HistoryOrdersPage(
    val items: List<OrderSummaryWithDepts>,
    val nextCursor: String? = null,
)

@Serializable
data class HistoryStats(
    val monthlyOrderCount: Int,
    val monthlyOrderCountPrev: Int? = null,
    val monthlyPeopleCount: Int,
    val monthlySum: Int,
    val monthlyAvgPeoplePerDay: Double? = null,
)
