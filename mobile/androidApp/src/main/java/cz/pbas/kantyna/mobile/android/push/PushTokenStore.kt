package cz.pbas.kantyna.mobile.android.push

import android.content.Context
import androidx.core.content.edit

class PushTokenStore(context: Context) {
    private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun getLastRegisteredToken(): String? = prefs.getString(KEY_TOKEN, null)?.takeIf { it.isNotBlank() }

    fun saveRegisteredToken(token: String) {
        prefs.edit { putString(KEY_TOKEN, token) }
    }

    fun clearRegisteredToken() {
        prefs.edit { remove(KEY_TOKEN) }
    }

    private companion object {
        const val PREFS_NAME = "kantyna_push"
        const val KEY_TOKEN = "registered_fcm_token"
    }
}
