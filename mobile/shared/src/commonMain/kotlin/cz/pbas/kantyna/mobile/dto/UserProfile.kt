package cz.pbas.kantyna.mobile.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
enum class UserRole {
    @SerialName("admin") ADMIN,
    @SerialName("user") USER,
}

@Serializable
data class UserProfile(
    val id: Int,
    val email: String? = null,
    val firstName: String,
    val lastName: String,
    val avatarUrl: String? = null,
    val role: UserRole,
    val emailVerified: Boolean,
    val active: Boolean,
    val defaultDepartment: String? = null,
    val emailOrderConfirmation: Boolean? = null,
)

@Serializable
data class UserProfilePatch(
    val firstName: String? = null,
    val lastName: String? = null,
    val defaultDepartment: String? = null,
    val emailOrderConfirmation: Boolean? = null,
)
