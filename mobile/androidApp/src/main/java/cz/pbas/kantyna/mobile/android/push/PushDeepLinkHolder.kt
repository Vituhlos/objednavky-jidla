package cz.pbas.kantyna.mobile.android.push

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

object PushDeepLinkHolder {
    private val _pendingObedNavigation = MutableStateFlow(false)
    val pendingObedNavigation: StateFlow<Boolean> = _pendingObedNavigation.asStateFlow()

    fun requestObedTab() {
        _pendingObedNavigation.value = true
    }

    fun consumeObedTabRequest(): Boolean {
        val pending = _pendingObedNavigation.value
        if (pending) {
            _pendingObedNavigation.value = false
        }
        return pending
    }
}
