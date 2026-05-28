package cz.pbas.kantyna.mobile.auth

import cz.pbas.kantyna.mobile.dto.DevicePairRequest
import cz.pbas.kantyna.mobile.dto.LoginRequest
import cz.pbas.kantyna.mobile.dto.RefreshTokenRequest
import cz.pbas.kantyna.mobile.dto.TokenResponse
import cz.pbas.kantyna.mobile.network.createHttpClient
import cz.pbas.kantyna.mobile.network.createPlatformHttpClient
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.post
import io.ktor.client.request.setBody

interface AuthRepository {
    suspend fun login(email: String, password: String): Result<TokenResponse>
    suspend fun refresh(refreshToken: String): Result<TokenResponse>
    suspend fun devicePair(pairingToken: String): Result<TokenResponse>
    suspend fun logout(): Result<Unit>
}

/**
 * Skeleton implementation — persists tokens in memory until secure storage is added.
 */
class AuthRepositoryImpl(
    private val httpClient: HttpClient = createHttpClient(
        accessTokenProvider = { AuthRepositoryImpl.cachedAccessToken },
        platformClient = ::createPlatformHttpClient,
    ),
) : AuthRepository {

    override suspend fun login(email: String, password: String): Result<TokenResponse> =
        runCatching {
            httpClient.post("auth/login") {
                setBody(LoginRequest(email = email, password = password))
            }.body<TokenResponse>().also(::cacheTokens)
        }

    override suspend fun refresh(refreshToken: String): Result<TokenResponse> =
        runCatching {
            httpClient.post("auth/refresh") {
                setBody(RefreshTokenRequest(refreshToken = refreshToken))
            }.body<TokenResponse>().also(::cacheTokens)
        }

    override suspend fun devicePair(pairingToken: String): Result<TokenResponse> =
        runCatching {
            httpClient.post("auth/device-pair") {
                setBody(DevicePairRequest(token = pairingToken))
            }.body<TokenResponse>().also(::cacheTokens)
        }

    override suspend fun logout(): Result<Unit> =
        runCatching {
            httpClient.post("auth/logout")
            clearTokens()
        }

    private fun cacheTokens(response: TokenResponse) {
        cachedAccessToken = response.accessToken
        cachedRefreshToken = response.refreshToken
    }

    private fun clearTokens() {
        cachedAccessToken = null
        cachedRefreshToken = null
    }

    companion object {
        var cachedAccessToken: String? = null
        var cachedRefreshToken: String? = null
    }
}
