package cz.pbas.kantyna.mobile.network

import cz.pbas.kantyna.mobile.dto.ApiErrorResponse
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.plugins.ClientRequestException
import io.ktor.client.plugins.ServerResponseException
import io.ktor.client.request.HttpRequestBuilder
import io.ktor.client.request.get
import io.ktor.client.request.post
import io.ktor.client.statement.HttpResponse
import io.ktor.http.isSuccess
import io.ktor.utils.io.errors.IOException

suspend inline fun <reified T> HttpClient.apiGet(
    path: String,
    crossinline block: HttpRequestBuilder.() -> Unit = {},
): T = apiCall { get(path, block) }

suspend inline fun <reified T> HttpClient.apiPost(
    path: String,
    crossinline block: HttpRequestBuilder.() -> Unit = {},
): T = apiCall { post(path, block) }

suspend inline fun HttpClient.apiPostUnit(
    path: String,
    crossinline block: HttpRequestBuilder.() -> Unit = {},
) {
    apiCallUnit { post(path, block) }
}

suspend inline fun <reified T> apiCall(
    crossinline request: suspend () -> HttpResponse,
): T {
    try {
        val response = request()
        if (response.status.isSuccess()) {
            return response.body()
        }
        throw parseApiError(response)
    } catch (e: ApiException) {
        throw e
    } catch (e: ClientRequestException) {
        throw parseApiError(e.response)
    } catch (e: ServerResponseException) {
        throw parseApiError(e.response)
    } catch (e: IOException) {
        throw NetworkException(cause = e)
    }
}

suspend inline fun apiCallUnit(
    crossinline request: suspend () -> HttpResponse,
) {
    try {
        val response = request()
        if (response.status.isSuccess()) {
            return
        }
        throw parseApiError(response)
    } catch (e: ApiException) {
        throw e
    } catch (e: ClientRequestException) {
        throw parseApiError(e.response)
    } catch (e: ServerResponseException) {
        throw parseApiError(e.response)
    } catch (e: IOException) {
        throw NetworkException(cause = e)
    }
}

suspend fun parseApiError(response: HttpResponse): ApiException {
    val status = response.status.value
    val parsed = runCatching { response.body<ApiErrorResponse>() }.getOrNull()
    return ApiException(
        statusCode = status,
        code = parsed?.error?.code ?: "HTTP_$status",
        message = parsed?.error?.message ?: "HTTP $status",
    )
}
