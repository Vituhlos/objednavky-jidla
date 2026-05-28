package cz.pbas.kantyna.mobile.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
enum class DayCode {
    @SerialName("Po") PO,
    @SerialName("Út") UT,
    @SerialName("St") ST,
    @SerialName("Čt") CT,
    @SerialName("Pá") PA,
}

@Serializable
enum class OrderStatus {
    @SerialName("draft") DRAFT,
    @SerialName("sent") SENT,
}

@Serializable
data class Order(
    val id: Int,
    val date: String,
    val status: OrderStatus,
    val extraEmail: String? = null,
    val sentAt: String? = null,
)

@Serializable
data class MenuItem(
    val id: Int,
    val weekLabel: String? = null,
    val day: String,
    val type: String,
    val code: String,
    val name: String,
    val price: Int,
    val allergens: String,
)

@Serializable
data class DayMenuItems(
    val soups: List<MenuItem>,
    val meals: List<MenuItem>,
)

@Serializable
data class MealEntry(
    val itemId: Int,
    val count: Int,
)

@Serializable
data class OrderRow(
    val id: Int,
    val orderId: Int,
    val department: String,
    val sortOrder: Int,
    val personName: String,
    val userId: Int? = null,
    val soupItemId: Int? = null,
    val soupItemId2: Int? = null,
    val mainItemId: Int? = null,
    val mealCount: Int,
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
data class ExtraMealItem(
    val item: MenuItem,
    val count: Int,
)

@Serializable
data class OrderRowEnriched(
    val id: Int,
    val orderId: Int,
    val department: String,
    val sortOrder: Int,
    val personName: String,
    val userId: Int? = null,
    val soupItemId: Int? = null,
    val soupItemId2: Int? = null,
    val mainItemId: Int? = null,
    val mealCount: Int,
    val extraMeals: List<MealEntry>? = null,
    val rollCount: Int? = null,
    val breadDumplingCount: Int? = null,
    val potatoDumplingCount: Int? = null,
    val ketchupCount: Int? = null,
    val tatarkaCount: Int? = null,
    val bbqCount: Int? = null,
    val note: String? = null,
    val soupItem: MenuItem? = null,
    val soupItem2: MenuItem? = null,
    val mainItem: MenuItem? = null,
    val extraMealItems: List<ExtraMealItem>? = null,
    val rowPrice: Int? = null,
)

@Serializable
data class DepartmentData(
    val name: String,
    val label: String,
    val emailLabel: String,
    val accent: String,
    val rows: List<OrderRowEnriched>,
    val subtotal: Int,
)

@Serializable
data class OrderData(
    val order: Order,
    val departments: List<DepartmentData>,
    val todayMenu: DayMenuItems,
    val totalPrice: Int,
    val dayCode: DayCode? = null,
)
