package cz.pbas.kantyna.mobile.network

class ApiException(
    val statusCode: Int,
    val code: String,
    override val message: String,
) : Exception(message)

class NetworkException(
    override val message: String = "Chyba připojení",
    override val cause: Throwable? = null,
) : Exception(message, cause)
