package cz.pbas.kantyna.mobile.dto

import kotlinx.serialization.SerialName
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
data class DevicePairRequest(
    val token: String,
)

@Serializable
data class ErrorBody(
    val error: String? = null,
    val message: String? = null,
)
