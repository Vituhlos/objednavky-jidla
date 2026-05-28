package cz.pbas.kantyna.mobile.android.ui.login

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import cz.pbas.kantyna.mobile.auth.AuthRepository
import cz.pbas.kantyna.mobile.dto.UserProfile
import cz.pbas.kantyna.mobile.network.ApiException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class LoginUiState(
    val email: String = "",
    val password: String = "",
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
)

class LoginViewModel(
    private val authRepository: AuthRepository,
    private val onSuccess: (UserProfile) -> Unit,
) : ViewModel() {

    private val _uiState = MutableStateFlow(LoginUiState())
    val uiState: StateFlow<LoginUiState> = _uiState.asStateFlow()

    fun onEmailChange(value: String) {
        _uiState.update { it.copy(email = value, errorMessage = null) }
    }

    fun onPasswordChange(value: String) {
        _uiState.update { it.copy(password = value, errorMessage = null) }
    }

    fun login() {
        val state = _uiState.value
        if (state.email.isBlank() || state.password.isBlank()) {
            _uiState.update { it.copy(errorMessage = "Vyplňte e-mail a heslo") }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            val result = authRepository.login(state.email, state.password)
            _uiState.update { it.copy(isLoading = false) }
            result.fold(
                onSuccess = { onSuccess(it.user) },
                onFailure = { error ->
                    val message = when (error) {
                        is ApiException -> error.message
                        else -> error.message ?: "Přihlášení se nezdařilo"
                    }
                    _uiState.update { it.copy(errorMessage = message) }
                },
            )
        }
    }
}
