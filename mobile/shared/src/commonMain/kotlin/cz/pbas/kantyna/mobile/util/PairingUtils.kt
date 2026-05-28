package cz.pbas.kantyna.mobile.util

/**
 * Parses `kantyna://pair?v=1&token=…` QR payloads from the web profile.
 */
fun parsePairingQrPayload(payload: String): String? {
    val trimmed = payload.trim()
    if (!trimmed.startsWith("kantyna://pair")) return null

    val query = trimmed.substringAfter('?', "")
    if (query.isEmpty()) return null

    val params = query.split('&').associate { part ->
        val keyValue = part.split('=', limit = 2)
        keyValue[0] to keyValue.getOrElse(1) { "" }
    }

    if (params["v"] != "1") return null
    val token = params["token"]?.takeIf { it.isNotBlank() } ?: return null
    return token
}
