package cz.pbas.kantyna.mobile

import cz.pbas.kantyna.mobile.auth.AuthRepository
import cz.pbas.kantyna.mobile.auth.AuthRepositoryImpl
import cz.pbas.kantyna.mobile.auth.TokenProvider
import cz.pbas.kantyna.mobile.db.KantynaDatabase
import cz.pbas.kantyna.mobile.db.createDatabase
import cz.pbas.kantyna.mobile.db.DatabaseDriverFactory
import cz.pbas.kantyna.mobile.history.HistoryRepository
import cz.pbas.kantyna.mobile.history.HistoryRepositoryImpl
import cz.pbas.kantyna.mobile.menu.MenuRepository
import cz.pbas.kantyna.mobile.menu.MenuRepositoryImpl
import cz.pbas.kantyna.mobile.orders.OrderRepository
import cz.pbas.kantyna.mobile.orders.OrderRepositoryImpl
import cz.pbas.kantyna.mobile.push.PushRepository
import cz.pbas.kantyna.mobile.push.PushRepositoryImpl
import cz.pbas.kantyna.mobile.network.createHttpClient
import cz.pbas.kantyna.mobile.network.createPlatformHttpClient
import io.ktor.client.HttpClient

class KantynaServices(
    val tokenProvider: TokenProvider,
    val httpClient: HttpClient,
    val database: KantynaDatabase,
    val authRepository: AuthRepository,
    val menuRepository: MenuRepository,
    val historyRepository: HistoryRepository,
    val orderRepository: OrderRepository,
    val pushRepository: PushRepository,
) {
    fun close() {
        httpClient.close()
    }

    companion object {
        fun create(
            tokenProvider: TokenProvider,
            driverFactory: DatabaseDriverFactory,
        ): KantynaServices {
            val httpClient = createHttpClient(tokenProvider, ::createPlatformHttpClient)
            val database = createDatabase(driverFactory)
            return KantynaServices(
                tokenProvider = tokenProvider,
                httpClient = httpClient,
                database = database,
                authRepository = AuthRepositoryImpl(httpClient, tokenProvider),
                menuRepository = MenuRepositoryImpl(httpClient, database),
                historyRepository = HistoryRepositoryImpl(httpClient),
                orderRepository = OrderRepositoryImpl(httpClient, database),
                pushRepository = PushRepositoryImpl(httpClient),
            )
        }
    }
}
