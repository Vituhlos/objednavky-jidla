package cz.pbas.kantyna.mobile.android.push

import android.content.Context
import android.util.Log
import com.google.firebase.messaging.FirebaseMessaging
import cz.pbas.kantyna.mobile.auth.TokenProvider
import cz.pbas.kantyna.mobile.push.PushRepository
import kotlinx.coroutines.tasks.await

class PushRegistrationManager(
    private val appContext: Context,
    private val tokenProvider: TokenProvider,
    private val pushRepository: PushRepository,
    private val pushTokenStore: PushTokenStore,
    private val appVersion: String,
) {
    suspend fun registerIfAuthenticated() {
        if (!tokenProvider.hasRefreshToken()) return

        runCatching {
            val fcmToken = FirebaseMessaging.getInstance().token.await()
            if (fcmToken.isBlank()) return

            val cached = pushTokenStore.getLastRegisteredToken()
            if (cached == fcmToken) return

            pushRepository.registerAndroidToken(fcmToken, appVersion).getOrThrow()
            pushTokenStore.saveRegisteredToken(fcmToken)
            Log.d(TAG, "FCM token registered with backend")
        }.onFailure { error ->
            Log.w(TAG, "FCM registration failed", error)
        }
    }

    suspend fun unregisterOnLogout() {
        val token = pushTokenStore.getLastRegisteredToken()
            ?: runCatching { FirebaseMessaging.getInstance().token.await() }.getOrNull()

        if (token.isNullOrBlank()) return

        runCatching {
            pushRepository.unregisterToken(token).getOrThrow()
            Log.d(TAG, "FCM token unregistered from backend")
        }.onFailure { error ->
            Log.w(TAG, "FCM unregister failed", error)
        }

        pushTokenStore.clearRegisteredToken()
    }

    private companion object {
        const val TAG = "PushRegistration"
    }
}
