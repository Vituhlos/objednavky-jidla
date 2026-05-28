package cz.pbas.kantyna.mobile.util

import cz.pbas.kantyna.mobile.dto.DayCode
import kotlinx.datetime.DateTimeUnit
import kotlinx.datetime.Clock
import kotlinx.datetime.LocalDate
import kotlinx.datetime.TimeZone
import kotlinx.datetime.minus
import kotlinx.datetime.plus
import kotlinx.datetime.todayIn

fun todayIsoDate(): String = Clock.System.todayIn(TimeZone.of("Europe/Prague")).toString()

fun shiftIsoDate(isoDate: String, days: Int): String {
    val date = LocalDate.parse(isoDate)
    val shifted = if (days >= 0) {
        date.plus(days, DateTimeUnit.DAY)
    } else {
        date.minus(-days, DateTimeUnit.DAY)
    }
    return shifted.toString()
}

fun formatCzechDate(isoDate: String): String {
    val parts = isoDate.split("-")
    if (parts.size != 3) return isoDate
    return "${parts[2]}.${parts[1]}.${parts[0]}"
}

fun formatCzechDateShort(isoDate: String): String {
    val parts = isoDate.split("-")
    if (parts.size != 3) return isoDate
    val day = parts[2].trimStart('0').ifEmpty { "0" }
    val month = parts[1].trimStart('0').ifEmpty { "0" }
    return "$day. $month."
}

fun formatOrderDateHeader(isoDate: String, dayCode: DayCode? = null): String {
    val prefix = dayCode?.let(::dayCodeLabel).orEmpty()
    val date = formatCzechDateShort(isoDate)
    return if (prefix.isEmpty()) date else "$prefix $date"
}

fun dayCodeLabel(dayCode: DayCode): String = when (dayCode) {
    DayCode.PO -> "Po"
    DayCode.UT -> "Út"
    DayCode.ST -> "St"
    DayCode.CT -> "Čt"
    DayCode.PA -> "Pá"
}

fun isToday(isoDate: String): Boolean = isoDate == todayIsoDate()
