package cz.pbas.kantyna.mobile.auth

interface TokenProvider {
    suspend fun getAccessToken(): String?
    suspend fun getRefreshToken(): String?
    suspend fun saveTokens(accessToken: String, refreshToken: String)
    suspend fun clearTokens()
    suspend fun hasRefreshToken(): Boolean = getRefreshToken() != null

    /** Synchronous read for Ktor defaultRequest (backed by in-memory cache on platform). */
    fun peekAccessToken(): String? = null
}
