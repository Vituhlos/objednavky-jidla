package cz.pbas.kantyna.mobile.android

import android.app.Application
import cz.pbas.kantyna.mobile.ApiConfig
import cz.pbas.kantyna.mobile.KantynaServices
import cz.pbas.kantyna.mobile.android.auth.AndroidTokenStorage
import cz.pbas.kantyna.mobile.android.push.NotificationChannels
import cz.pbas.kantyna.mobile.android.push.PushRegistrationManager
import cz.pbas.kantyna.mobile.android.push.PushTokenStore
import cz.pbas.kantyna.mobile.db.DatabaseDriverFactory

class KantynaApplication : Application() {

    lateinit var services: KantynaServices
        private set

    lateinit var pushRegistrationManager: PushRegistrationManager
        private set

    override fun onCreate() {
        super.onCreate()
        ApiConfig.setDevBaseUrl(BuildConfig.API_BASE_URL)
        val tokenStorage = AndroidTokenStorage(this)
        services = KantynaServices.create(
            tokenProvider = tokenStorage,
            driverFactory = DatabaseDriverFactory(this),
        )
        NotificationChannels.ensureCreated(this)
        pushRegistrationManager = PushRegistrationManager(
            appContext = applicationContext,
            tokenProvider = tokenStorage,
            pushRepository = services.pushRepository,
            pushTokenStore = PushTokenStore(this),
            appVersion = BuildConfig.VERSION_NAME,
        )
    }
}
