package cz.pbas.kantyna.mobile.network

import cz.pbas.kantyna.mobile.ApiConfig
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

/**
 * Builds a Ktor [HttpClient] with JSON negotiation and optional Bearer token injection.
 *
 * Token provider is a placeholder — wire to secure storage once auth flow is implemented.
 */
fun createHttpClient(
    accessTokenProvider: () -> String? = { null },
    platformClient: () -> HttpClient,
): HttpClient {
    val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        encodeDefaults = true
    }

    return platformClient().config {
        install(ContentNegotiation) {
            json(json)
        }
        install(Logging) {
            level = LogLevel.INFO
        }
        defaultRequest {
            url(ApiConfig.baseUrl)
            contentType(ContentType.Application.Json)
            accessTokenProvider()?.let { token ->
                header("Authorization", "Bearer $token")
            }
        }
    }
}

expect fun createPlatformHttpClient(): HttpClient
