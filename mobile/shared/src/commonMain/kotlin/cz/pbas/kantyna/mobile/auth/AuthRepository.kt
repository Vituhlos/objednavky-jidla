package cz.pbas.kantyna.mobile.auth

import cz.pbas.kantyna.mobile.dto.DevicePairRequest
import cz.pbas.kantyna.mobile.dto.LoginRequest
import cz.pbas.kantyna.mobile.dto.LogoutRequest
import cz.pbas.kantyna.mobile.dto.RefreshTokenRequest
import cz.pbas.kantyna.mobile.dto.TokenResponse
import cz.pbas.kantyna.mobile.dto.UserProfile
import cz.pbas.kantyna.mobile.network.ApiException
import cz.pbas.kantyna.mobile.network.NetworkException
import cz.pbas.kantyna.mobile.network.NetworkException
import cz.pbas.kantyna.mobile.network.apiGet
import cz.pbas.kantyna.mobile.network.apiPost
import cz.pbas.kantyna.mobile.network.apiPostUnit
import io.ktor.client.HttpClient
import io.ktor.client.request.setBody

interface AuthRepository {
    suspend fun login(email: String, password: String): Result<TokenResponse>
    suspend fun devicePair(token: String): Result<TokenResponse>
    suspend fun refresh(): Result<TokenResponse>
    suspend fun logout(): Result<Unit>
    suspend fun getMe(): Result<UserProfile>
    suspend fun restoreSession(): Result<UserProfile>
}

class AuthRepositoryImpl(
    private val httpClient: HttpClient,
    private val tokenProvider: TokenProvider,
) : AuthRepository {

    override suspend fun login(email: String, password: String): Result<TokenResponse> =
        runCatching {
            val response = httpClient.apiPost<TokenResponse>("auth/login") {
                setBody(LoginRequest(email = email.trim(), password = password))
            }
            tokenProvider.saveTokens(response.accessToken, response.refreshToken)
            response
        }.mapAuthError()

    override suspend fun devicePair(token: String): Result<TokenResponse> =
        runCatching {
            val response = httpClient.apiPost<TokenResponse>("auth/device-pair") {
                setBody(DevicePairRequest(token = token.trim()))
            }
            tokenProvider.saveTokens(response.accessToken, response.refreshToken)
            response
        }.mapPairingError()

    override suspend fun refresh(): Result<TokenResponse> =
        runCatching {
            val refreshToken = tokenProvider.getRefreshToken()
                ?: throw ApiException(401, "UNAUTHORIZED", "Chybí refresh token")
            val response = httpClient.apiPost<TokenResponse>("auth/refresh") {
                setBody(RefreshTokenRequest(refreshToken = refreshToken))
            }
            tokenProvider.saveTokens(response.accessToken, response.refreshToken)
            response
        }.mapAuthError()

    override suspend fun logout(): Result<Unit> =
        runCatching {
            val refreshToken = tokenProvider.getRefreshToken()
            runCatching {
                httpClient.apiPostUnit("auth/logout") {
                    setBody(LogoutRequest(refreshToken = refreshToken))
                }
            }
            tokenProvider.clearTokens()
        }

    override suspend fun getMe(): Result<UserProfile> =
        runCatching {
            httpClient.apiGet<UserProfile>("me")
        }.mapAuthError()

    override suspend fun restoreSession(): Result<UserProfile> {
        if (!tokenProvider.hasRefreshToken()) {
            return Result.failure(ApiException(401, "UNAUTHORIZED", "Nejste přihlášeni"))
        }
        refresh().onFailure { return Result.failure(it) }
        return getMe()
    }

    private fun <T> Result<T>.mapAuthError(): Result<T> = this

    private fun <T> Result<T>.mapPairingError(): Result<T> = this.mapError { error ->
        when (error) {
            is ApiException -> when (error.code) {
                "PAIRING_EXPIRED" -> ApiException(
                    statusCode = error.statusCode,
                    code = error.code,
                    message = "QR kód vypršel. Vygenerujte nový na webu.",
                )
                "PAIRING_USED" -> ApiException(
                    statusCode = error.statusCode,
                    code = error.code,
                    message = "QR kód už byl použit.",
                )
                "PAIRING_INVALID", "BAD_REQUEST" -> ApiException(
                    statusCode = error.statusCode,
                    code = error.code,
                    message = "Neplatný QR kód.",
                )
                else -> error
            }
            is NetworkException -> NetworkException(
                message = "Přihlášení vyžaduje připojení k internetu.",
                cause = error.cause,
            )
            else -> error
        }
    }

    private inline fun <T> Result<T>.mapError(transform: (Throwable) -> Throwable): Result<T> =
        fold(
            onSuccess = { Result.success(it) },
            onFailure = { Result.failure(transform(it)) },
        )
}
