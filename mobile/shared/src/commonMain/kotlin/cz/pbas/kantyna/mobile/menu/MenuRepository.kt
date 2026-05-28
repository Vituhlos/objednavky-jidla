package cz.pbas.kantyna.mobile.menu

import cz.pbas.kantyna.mobile.db.KantynaDatabase
import cz.pbas.kantyna.mobile.dto.DayMenu
import cz.pbas.kantyna.mobile.dto.MenuWeek
import cz.pbas.kantyna.mobile.dto.WeekMenuResponse
import cz.pbas.kantyna.mobile.network.KantynaJson
import cz.pbas.kantyna.mobile.network.NetworkException
import cz.pbas.kantyna.mobile.network.apiGet
import io.ktor.client.HttpClient
import io.ktor.client.request.parameter
import kotlinx.datetime.Clock
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString

data class MenuLoadResult(
    val menu: DayMenu,
    val fromCache: Boolean,
)

interface MenuRepository {
    suspend fun getDayMenu(date: String): Result<MenuLoadResult>
    suspend fun getWeeks(): Result<List<MenuWeek>>
    suspend fun getWeekMenu(weekStart: String): Result<WeekMenuResponse>
}

class MenuRepositoryImpl(
    private val httpClient: HttpClient,
    private val database: KantynaDatabase,
) : MenuRepository {

    override suspend fun getDayMenu(date: String): Result<MenuLoadResult> {
        return runCatching {
            val menu = httpClient.apiGet<DayMenu>("menu/day") {
                parameter("date", date)
            }
            cacheMenuDay(menu)
            MenuLoadResult(menu = menu, fromCache = false)
        }.recoverCatching { error ->
            if (error !is NetworkException) throw error
            val cached = loadCachedMenuDay(date)
                ?: throw error
            MenuLoadResult(menu = cached, fromCache = true)
        }
    }

    override suspend fun getWeeks(): Result<List<MenuWeek>> =
        runCatching {
            httpClient.apiGet<List<MenuWeek>>("menu/weeks")
        }

    override suspend fun getWeekMenu(weekStart: String): Result<WeekMenuResponse> =
        runCatching {
            httpClient.apiGet<WeekMenuResponse>("menu") {
                parameter("weekStart", weekStart)
            }
        }

    private fun cacheMenuDay(menu: DayMenu) {
        val payload = KantynaJson.encodeToString(menu)
        database.cached_menuQueries.upsert(
            week_start = menu.date,
            payload_json = payload,
            fetched_at = currentEpochMillis(),
        )
    }

    private fun loadCachedMenuDay(date: String): DayMenu? {
        val row = database.cached_menuQueries.selectByWeek(date).executeAsOneOrNull() ?: return null
        return runCatching { KantynaJson.decodeFromString<DayMenu>(row.payload_json) }.getOrNull()
    }
}

private fun currentEpochMillis(): Long = Clock.System.now().toEpochMilliseconds()
