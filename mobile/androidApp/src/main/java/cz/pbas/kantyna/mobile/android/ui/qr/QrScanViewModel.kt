package cz.pbas.kantyna.mobile.android.ui.qr

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import cz.pbas.kantyna.mobile.auth.AuthRepository
import cz.pbas.kantyna.mobile.dto.UserProfile
import cz.pbas.kantyna.mobile.network.ApiException
import cz.pbas.kantyna.mobile.network.NetworkException
import cz.pbas.kantyna.mobile.util.parsePairingQrPayload
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class QrScanUiState(
    val isProcessing: Boolean = false,
    val errorMessage: String? = null,
    val successUser: UserProfile? = null,
    val scanSession: Int = 0,
)

class QrScanViewModel(
    private val authRepository: AuthRepository,
    private val onSuccess: (UserProfile) -> Unit,
) : ViewModel() {

    private val _uiState = MutableStateFlow(QrScanUiState())
    val uiState: StateFlow<QrScanUiState> = _uiState.asStateFlow()

    private var lastScannedPayload: String? = null

    fun onBarcodeScanned(rawValue: String) {
        if (_uiState.value.isProcessing || _uiState.value.successUser != null) return
        if (rawValue == lastScannedPayload) return

        val token = parsePairingQrPayload(rawValue)
        if (token == null) {
            _uiState.update { it.copy(errorMessage = "Neplatný QR kód.") }
            return
        }

        lastScannedPayload = rawValue
        pairWithToken(token)
    }

    fun retryScan() {
        lastScannedPayload = null
        _uiState.update { it.copy(errorMessage = null, scanSession = it.scanSession + 1) }
    }

    private fun pairWithToken(token: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isProcessing = true, errorMessage = null) }
            authRepository.devicePair(token).fold(
                onSuccess = { response ->
                    _uiState.update {
                        it.copy(isProcessing = false, successUser = response.user)
                    }
                    onSuccess(response.user)
                },
                onFailure = { error ->
                    val message = when (error) {
                        is ApiException -> error.message
                        is NetworkException -> error.message
                        else -> error.message ?: "Neplatný QR kód."
                    }
                    _uiState.update {
                        it.copy(isProcessing = false, errorMessage = message)
                    }
                },
            )
        }
    }
}
