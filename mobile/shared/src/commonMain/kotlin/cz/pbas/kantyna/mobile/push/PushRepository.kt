package cz.pbas.kantyna.mobile.push

import cz.pbas.kantyna.mobile.dto.PushRegisterRequest
import cz.pbas.kantyna.mobile.dto.PushUnregisterRequest
import cz.pbas.kantyna.mobile.network.apiDeleteUnit
import cz.pbas.kantyna.mobile.network.apiPostUnit
import io.ktor.client.HttpClient
import io.ktor.client.request.setBody

interface PushRepository {
    suspend fun registerAndroidToken(token: String, appVersion: String?): Result<Unit>
    suspend fun unregisterToken(token: String): Result<Unit>
}

class PushRepositoryImpl(
    private val httpClient: HttpClient,
) : PushRepository {

    override suspend fun registerAndroidToken(token: String, appVersion: String?): Result<Unit> =
        runCatching {
            httpClient.apiPostUnit("push/register") {
                setBody(
                    PushRegisterRequest(
                        platform = "android",
                        token = token,
                        appVersion = appVersion,
                    ),
                )
            }
        }

    override suspend fun unregisterToken(token: String): Result<Unit> =
        runCatching {
            httpClient.apiDeleteUnit("push/register") {
                setBody(PushUnregisterRequest(token = token))
            }
        }
}
