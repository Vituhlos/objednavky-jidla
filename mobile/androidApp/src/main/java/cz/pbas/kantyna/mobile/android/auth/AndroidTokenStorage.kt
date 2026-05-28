package cz.pbas.kantyna.mobile.android.auth

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import cz.pbas.kantyna.mobile.auth.TokenProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class AndroidTokenStorage(
    context: Context,
) : TokenProvider {

    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val prefs = EncryptedSharedPreferences.create(
        context,
        PREFS_NAME,
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )

    @Volatile
    private var cachedAccessToken: String? = null

    @Volatile
    private var cachedRefreshToken: String? = null

    init {
        cachedAccessToken = prefs.getString(KEY_ACCESS, null)
        cachedRefreshToken = prefs.getString(KEY_REFRESH, null)
    }

    override suspend fun getAccessToken(): String? = withContext(Dispatchers.IO) {
        cachedAccessToken ?: prefs.getString(KEY_ACCESS, null)?.also { cachedAccessToken = it }
    }

    override suspend fun getRefreshToken(): String? = withContext(Dispatchers.IO) {
        cachedRefreshToken ?: prefs.getString(KEY_REFRESH, null)?.also { cachedRefreshToken = it }
    }

    override fun peekAccessToken(): String? = cachedAccessToken

    override suspend fun saveTokens(accessToken: String, refreshToken: String) = withContext(Dispatchers.IO) {
        cachedAccessToken = accessToken
        cachedRefreshToken = refreshToken
        prefs.edit()
            .putString(KEY_ACCESS, accessToken)
            .putString(KEY_REFRESH, refreshToken)
            .apply()
    }

    override suspend fun clearTokens() = withContext(Dispatchers.IO) {
        cachedAccessToken = null
        cachedRefreshToken = null
        prefs.edit()
            .remove(KEY_ACCESS)
            .remove(KEY_REFRESH)
            .apply()
    }

    private companion object {
        const val PREFS_NAME = "kantyna_secure_tokens"
        const val KEY_ACCESS = "access_token"
        const val KEY_REFRESH = "refresh_token"
    }
}
