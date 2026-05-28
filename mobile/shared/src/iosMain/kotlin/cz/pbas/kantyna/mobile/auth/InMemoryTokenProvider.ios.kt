package cz.pbas.kantyna.mobile.auth

/**
 * In-memory token holder for iOS scaffold builds.
 */
class InMemoryTokenProvider : TokenProvider {
    private var accessToken: String? = null
    private var refreshToken: String? = null

    override suspend fun getAccessToken(): String? = accessToken
    override suspend fun getRefreshToken(): String? = refreshToken
    override fun peekAccessToken(): String? = accessToken

    override suspend fun saveTokens(accessToken: String, refreshToken: String) {
        this.accessToken = accessToken
        this.refreshToken = refreshToken
    }

    override suspend fun clearTokens() {
        accessToken = null
        refreshToken = null
    }
}
