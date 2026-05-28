package cz.pbas.kantyna.mobile.android.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import cz.pbas.kantyna.mobile.KantynaServices
import cz.pbas.kantyna.mobile.android.KantynaApplication
import cz.pbas.kantyna.mobile.android.di.LocalKantynaServices
import cz.pbas.kantyna.mobile.android.ui.login.LoginScreen
import cz.pbas.kantyna.mobile.android.ui.login.LoginViewModel
import cz.pbas.kantyna.mobile.android.ui.qr.QrScanScreen
import cz.pbas.kantyna.mobile.android.ui.qr.QrScanViewModel
import cz.pbas.kantyna.mobile.android.ui.root.RootUiState
import cz.pbas.kantyna.mobile.android.ui.root.RootViewModel

private object LoginRoute {
    const val Login = "login"
    const val QrScan = "qr_scan"
}

@Composable
fun KantynaApp(
    services: KantynaServices,
    modifier: Modifier = Modifier,
) {
    CompositionLocalProvider(LocalKantynaServices provides services) {
        val rootViewModel = viewModel { RootViewModel(services.authRepository) }
        val rootState by rootViewModel.uiState.collectAsStateWithLifecycle()

        when (val state = rootState) {
            RootUiState.Loading -> {
                Box(modifier = modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            }
            RootUiState.Login -> {
                val navController = rememberNavController()
                NavHost(
                    navController = navController,
                    startDestination = LoginRoute.Login,
                    modifier = modifier,
                ) {
                    composable(LoginRoute.Login) {
                        val loginViewModel = viewModel {
                            LoginViewModel(
                                authRepository = services.authRepository,
                                onSuccess = rootViewModel::onLoggedIn,
                            )
                        }
                        LoginScreen(
                            viewModel = loginViewModel,
                            onScanQr = { navController.navigate(LoginRoute.QrScan) },
                        )
                    }
                    composable(LoginRoute.QrScan) {
                        val qrViewModel = viewModel {
                            QrScanViewModel(
                                authRepository = services.authRepository,
                                onSuccess = rootViewModel::onLoggedIn,
                            )
                        }
                        QrScanScreen(
                            viewModel = qrViewModel,
                            onBack = { navController.popBackStack() },
                        )
                    }
                }
            }
            is RootUiState.Main -> {
                val app = LocalContext.current.applicationContext as KantynaApplication
                LaunchedEffect(state.user.id) {
                    app.pushRegistrationManager.registerIfAuthenticated()
                }
                MainTabsScreen(
                    user = state.user,
                    onLoggedOut = rootViewModel::onLoggedOut,
                    onUserUpdated = rootViewModel::onLoggedIn,
                    modifier = modifier,
                )
            }
        }
    }
}
