package cz.pbas.kantyna.mobile.android

import android.app.Application
import cz.pbas.kantyna.mobile.ApiConfig
import cz.pbas.kantyna.mobile.KantynaServices
import cz.pbas.kantyna.mobile.android.auth.AndroidTokenStorage
import cz.pbas.kantyna.mobile.db.DatabaseDriverFactory

class KantynaApplication : Application() {

    lateinit var services: KantynaServices
        private set

    override fun onCreate() {
        super.onCreate()
        ApiConfig.setDevBaseUrl(BuildConfig.API_BASE_URL)
        val tokenStorage = AndroidTokenStorage(this)
        services = KantynaServices.create(
            tokenProvider = tokenStorage,
            driverFactory = DatabaseDriverFactory(this),
        )
    }
}
