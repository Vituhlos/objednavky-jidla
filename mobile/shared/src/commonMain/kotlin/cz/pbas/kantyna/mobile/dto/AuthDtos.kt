package cz.pbas.kantyna.mobile.dto

import kotlinx.serialization.Serializable

@Serializable
data class LoginRequest(
    val email: String,
    val password: String,
)

@Serializable
data class TokenResponse(
    val accessToken: String,
    val refreshToken: String,
    val expiresIn: Int,
    val user: UserProfile,
)

@Serializable
data class RefreshTokenRequest(
    val refreshToken: String,
)

@Serializable
data class LogoutRequest(
    val refreshToken: String? = null,
)

@Serializable
data class DevicePairRequest(
    val token: String,
)

@Serializable
data class ApiErrorResponse(
    val error: ApiErrorDetail,
)

@Serializable
data class ApiErrorDetail(
    val code: String,
    val message: String,
)
