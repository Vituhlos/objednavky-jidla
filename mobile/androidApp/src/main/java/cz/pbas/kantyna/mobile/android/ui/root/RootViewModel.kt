package cz.pbas.kantyna.mobile.android.ui.root

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import cz.pbas.kantyna.mobile.auth.AuthRepository
import cz.pbas.kantyna.mobile.dto.UserProfile
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

sealed interface RootUiState {
    data object Loading : RootUiState
    data object Login : RootUiState
    data class Main(val user: UserProfile) : RootUiState
}

class RootViewModel(
    private val authRepository: AuthRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow<RootUiState>(RootUiState.Loading)
    val uiState: StateFlow<RootUiState> = _uiState.asStateFlow()

    init {
        restoreSession()
    }

    fun restoreSession() {
        viewModelScope.launch {
            _uiState.value = RootUiState.Loading
            val result = authRepository.restoreSession()
            _uiState.value = result.fold(
                onSuccess = { RootUiState.Main(it) },
                onFailure = { RootUiState.Login },
            )
        }
    }

    fun onLoggedIn(user: UserProfile) {
        _uiState.value = RootUiState.Main(user)
    }

    fun onLoggedOut() {
        _uiState.value = RootUiState.Login
    }
}
