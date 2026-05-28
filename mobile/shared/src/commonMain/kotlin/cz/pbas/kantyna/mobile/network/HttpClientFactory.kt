package cz.pbas.kantyna.mobile.network

import cz.pbas.kantyna.mobile.ApiConfig
import cz.pbas.kantyna.mobile.auth.TokenProvider
import io.ktor.client.HttpClient
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.plugins.defaultRequest
import io.ktor.client.plugins.logging.LogLevel
import io.ktor.client.plugins.logging.Logging
import io.ktor.client.request.header
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.json.Json

val KantynaJson = Json {
    ignoreUnknownKeys = true
    isLenient = true
    encodeDefaults = true
    explicitNulls = false
}

fun createHttpClient(
    tokenProvider: TokenProvider,
    platformClient: () -> HttpClient,
): HttpClient = platformClient().config {
    install(ContentNegotiation) {
        json(KantynaJson)
    }
    install(Logging) {
        level = LogLevel.INFO
    }
    defaultRequest {
        url(ApiConfig.baseUrl)
        contentType(ContentType.Application.Json)
        tokenProvider.peekAccessToken()?.let { token ->
            header("Authorization", "Bearer $token")
        }
    }
}

expect fun createPlatformHttpClient(): HttpClient
