package cz.pbas.kantyna.mobile.history

import cz.pbas.kantyna.mobile.dto.HistoryOrdersPage
import cz.pbas.kantyna.mobile.dto.HistoryStats
import cz.pbas.kantyna.mobile.network.apiGet
import io.ktor.client.HttpClient
import io.ktor.client.request.parameter

interface HistoryRepository {
    suspend fun getOrders(limit: Int = 50, cursor: String? = null): Result<HistoryOrdersPage>
    suspend fun getStats(): Result<HistoryStats>
}

class HistoryRepositoryImpl(
    private val httpClient: HttpClient,
) : HistoryRepository {

    override suspend fun getOrders(limit: Int, cursor: String?): Result<HistoryOrdersPage> =
        runCatching {
            httpClient.apiGet<HistoryOrdersPage>("history/orders") {
                parameter("limit", limit)
                cursor?.let { parameter("cursor", it) }
            }
        }

    override suspend fun getStats(): Result<HistoryStats> =
        runCatching {
            httpClient.apiGet<HistoryStats>("history/stats")
        }
}
