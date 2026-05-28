package cz.pbas.kantyna.mobile.orders

import cz.pbas.kantyna.mobile.network.ApiException

fun mapOrderApiError(error: Throwable): Throwable = when (error) {
    is ApiException -> when (error.code) {
        "ORDER_SENT" -> ApiException(
            statusCode = error.statusCode,
            code = error.code,
            message = "Objednávka je již odeslaná a nelze ji upravovat.",
        )
        "FORBIDDEN" -> ApiException(
            statusCode = error.statusCode,
            code = error.code,
            message = when {
                error.message.contains("cizí", ignoreCase = true) ->
                    "Nemáte oprávnění upravovat cizí řádek."
                error.message.contains("administr", ignoreCase = true) ->
                    "Nemáte oprávnění administrátora."
                else -> error.message
            },
        )
        else -> error
    }
    else -> error
}
