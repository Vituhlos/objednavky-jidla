package cz.pbas.kantyna.mobile.dto

import kotlinx.serialization.Serializable

@Serializable
data class DayMenu(
    val date: String,
    val dayCode: DayCode? = null,
    val weekStart: String,
    val soups: List<MenuItem>,
    val meals: List<MenuItem>,
    val closed: Boolean = false,
)

@Serializable
data class MenuWeek(
    val weekStart: String,
    val weekLabel: String? = null,
)

@Serializable
data class WeekMenuResponse(
    val weekStart: String,
    val days: Map<String, DayMenuItems>,
)
