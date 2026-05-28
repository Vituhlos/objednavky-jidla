package cz.pbas.kantyna.mobile.android.ui.profile

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

data class ProfileUiState(
    val user: UserProfile? = null,
    val isLoading: Boolean = true,
    val isLoggingOut: Boolean = false,
    val errorMessage: String? = null,
)

class ProfileViewModel(
    initialUser: UserProfile,
    private val authRepository: AuthRepository,
    private val onBeforeLogout: suspend () -> Unit = {},
    private val onLoggedOut: () -> Unit,
) : ViewModel() {

    private val _uiState = MutableStateFlow(ProfileUiState(user = initialUser, isLoading = false))
    val uiState: StateFlow<ProfileUiState> = _uiState.asStateFlow()

    init {
        refreshProfile()
    }

    fun refreshProfile() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            authRepository.getMe().fold(
                onSuccess = { user ->
                    _uiState.update { it.copy(user = user, isLoading = false) }
                },
                onFailure = { error ->
                    val message = when (error) {
                        is ApiException -> error.message
                        else -> error.message
                    }
                    _uiState.update { it.copy(isLoading = false, errorMessage = message) }
                },
            )
        }
    }

    fun logout() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoggingOut = true, errorMessage = null) }
            onBeforeLogout()
            authRepository.logout()
            _uiState.update { it.copy(isLoggingOut = false) }
            onLoggedOut()
        }
    }

    fun onUserUpdated(user: UserProfile) {
        _uiState.update { it.copy(user = user) }
    }
}
