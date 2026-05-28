package cz.pbas.kantyna.mobile.orders

import cz.pbas.kantyna.mobile.dto.OrderData
import cz.pbas.kantyna.mobile.network.apiGet
import io.ktor.client.HttpClient
import io.ktor.client.request.parameter

interface OrderRepository {
    suspend fun getOrderForDate(date: String): Result<OrderData>
}

class OrderRepositoryImpl(
    private val httpClient: HttpClient,
) : OrderRepository {

    override suspend fun getOrderForDate(date: String): Result<OrderData> =
        runCatching {
            httpClient.apiGet<OrderData>("orders") {
                parameter("date", date)
            }
        }
}
