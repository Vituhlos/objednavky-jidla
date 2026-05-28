package cz.pbas.kantyna.mobile

/**
 * Mobile API configuration. Override [baseUrl] in debug builds or via platform config.
 *
 * @see docs/mobile/api-v1.openapi.yaml
 */
object ApiConfig {
    const val PRODUCTION_BASE_URL = "https://kantyna2.pbas.cz/api/mobile/v1"

    /** Active base URL; replace for local dev (e.g. http://10.0.2.2:3000/api/mobile/v1). */
    var baseUrl: String = PRODUCTION_BASE_URL
        private set

    fun setDevBaseUrl(url: String) {
        baseUrl = url
    }

    fun resetToProduction() {
        baseUrl = PRODUCTION_BASE_URL
    }
}
