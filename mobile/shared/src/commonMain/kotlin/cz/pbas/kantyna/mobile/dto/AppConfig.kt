package cz.pbas.kantyna.mobile.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class AppConfig(
    val cutoffTime: String,
    val autoSendEnabled: Boolean? = null,
    val autoSendTime: String? = null,
    val autoSendDays: String? = null,
    val defaultSoupPrice: Int,
    val defaultMealPrice: Int,
    val extrasPrices: ExtrasPrices,
    val pushReminderMinutes: Int,
    val pizzaEnabled: Boolean? = null,
)

@Serializable
data class ExtrasPrices(
    val roll: Int? = null,
    val breadDumpling: Int? = null,
    val potatoDumpling: Int? = null,
    val ketchup: Int? = null,
    val tatarka: Int? = null,
    val bbq: Int? = null,
)

@Serializable
enum class DepartmentAccent {
    @SerialName("blue") BLUE,
    @SerialName("rust") RUST,
    @SerialName("green") GREEN,
    @SerialName("amber") AMBER,
    @SerialName("navy") NAVY,
    @SerialName("orange") ORANGE,
    @SerialName("red") RED,
}

@Serializable
data class DepartmentInfo(
    val id: Int,
    val name: String,
    val label: String,
    val emailLabel: String,
    val accent: DepartmentAccent,
    val sortOrder: Int,
    val active: Boolean,
)
