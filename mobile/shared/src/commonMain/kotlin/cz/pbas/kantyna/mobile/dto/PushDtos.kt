package cz.pbas.kantyna.mobile.dto

import kotlinx.serialization.Serializable

@Serializable
data class PushRegisterRequest(
    val platform: String,
    val token: String,
    val appVersion: String? = null,
)

@Serializable
data class PushUnregisterRequest(
    val token: String,
)
