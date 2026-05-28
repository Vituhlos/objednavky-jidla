package cz.pbas.kantyna.mobile.android.ui

import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.launch
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import cz.pbas.kantyna.mobile.android.KantynaApplication
import cz.pbas.kantyna.mobile.android.R
import cz.pbas.kantyna.mobile.android.di.LocalKantynaServices
import cz.pbas.kantyna.mobile.android.push.PushDeepLinkHolder
import cz.pbas.kantyna.mobile.android.ui.history.HistoryScreen
import cz.pbas.kantyna.mobile.android.ui.history.HistoryViewModel
import cz.pbas.kantyna.mobile.android.ui.menu.MenuScreen
import cz.pbas.kantyna.mobile.android.ui.menu.MenuViewModel
import cz.pbas.kantyna.mobile.android.ui.obed.ObedScreen
import cz.pbas.kantyna.mobile.android.ui.obed.ObedViewModel
import cz.pbas.kantyna.mobile.android.ui.profile.ProfileScreen
import cz.pbas.kantyna.mobile.android.ui.profile.ProfileViewModel
import cz.pbas.kantyna.mobile.android.ui.qr.QrScanScreen
import cz.pbas.kantyna.mobile.android.ui.qr.QrScanViewModel
import cz.pbas.kantyna.mobile.dto.UserProfile

private sealed class TabRoute(val route: String) {
    data object Obed : TabRoute("obed")
    data object Jidelnicek : TabRoute("jidelnicek")
    data object Historie : TabRoute("historie")
    data object Profil : TabRoute("profil")
    data object QrScan : TabRoute("qr_scan")
}

private data class TabItem(
    val route: TabRoute,
    val labelRes: Int,
    val icon: @Composable () -> Unit,
)

@Composable
fun MainTabsScreen(
    user: UserProfile,
    onLoggedOut: () -> Unit,
    onUserUpdated: (UserProfile) -> Unit,
    modifier: Modifier = Modifier,
) {
    val services = LocalKantynaServices.current
    val context = LocalContext.current
    val app = context.applicationContext as KantynaApplication
    val navController = rememberNavController()
    val tabs = listOf(
        TabItem(TabRoute.Obed, R.string.tab_obed) { Icon(Icons.Default.Restaurant, contentDescription = null) },
        TabItem(TabRoute.Jidelnicek, R.string.tab_jidelnicek) { Icon(Icons.AutoMirrored.Filled.List, contentDescription = null) },
        TabItem(TabRoute.Historie, R.string.tab_historie) { Icon(Icons.Default.History, contentDescription = null) },
        TabItem(TabRoute.Profil, R.string.tab_profil) { Icon(Icons.Default.Person, contentDescription = null) },
    )
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route
    val showBottomBar = currentRoute != TabRoute.QrScan.route

    val menuViewModel = viewModel { MenuViewModel(services.menuRepository) }
    val historyViewModel = viewModel { HistoryViewModel(services.historyRepository) }
    val obedViewModel = viewModel { ObedViewModel(services.orderRepository, user) }
    val profileViewModel = viewModel {
        ProfileViewModel(
            initialUser = user,
            authRepository = services.authRepository,
            onBeforeLogout = { app.pushRegistrationManager.unregisterOnLogout() },
            onLoggedOut = onLoggedOut,
        )
    }

    val scope = rememberCoroutineScope()
    val notificationPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        if (granted) {
            scope.launch {
                app.pushRegistrationManager.registerIfAuthenticated()
            }
        }
    }

    LaunchedEffect(Unit) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val granted = ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS,
            ) == android.content.pm.PackageManager.PERMISSION_GRANTED
            if (!granted) {
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
    }

    val pendingObedNavigation by PushDeepLinkHolder.pendingObedNavigation.collectAsStateWithLifecycle()
    LaunchedEffect(pendingObedNavigation) {
        if (pendingObedNavigation && PushDeepLinkHolder.consumeObedTabRequest()) {
            navController.navigate(TabRoute.Obed.route) {
                popUpTo(navController.graph.findStartDestination().id) {
                    saveState = true
                }
                launchSingleTop = true
                restoreState = true
            }
        }
    }

    Scaffold(
        modifier = modifier,
        bottomBar = {
            if (showBottomBar) {
                NavigationBar {
                    tabs.forEach { tab ->
                        NavigationBarItem(
                            selected = currentRoute == tab.route.route,
                            onClick = {
                                navController.navigate(tab.route.route) {
                                    popUpTo(navController.graph.findStartDestination().id) {
                                        saveState = true
                                    }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            icon = tab.icon,
                            label = { Text(stringResource(tab.labelRes)) },
                        )
                    }
                }
            }
        },
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = TabRoute.Obed.route,
            modifier = Modifier.padding(innerPadding),
        ) {
            composable(TabRoute.Obed.route) {
                ObedScreen(viewModel = obedViewModel)
            }
            composable(TabRoute.Jidelnicek.route) {
                MenuScreen(viewModel = menuViewModel)
            }
            composable(TabRoute.Historie.route) {
                HistoryScreen(viewModel = historyViewModel)
            }
            composable(TabRoute.Profil.route) {
                ProfileScreen(
                    viewModel = profileViewModel,
                    onScanQr = { navController.navigate(TabRoute.QrScan.route) },
                )
            }
            composable(TabRoute.QrScan.route) {
                val qrViewModel = viewModel {
                    QrScanViewModel(
                        authRepository = services.authRepository,
                        onSuccess = { updatedUser ->
                            onUserUpdated(updatedUser)
                            profileViewModel.onUserUpdated(updatedUser)
                            navController.popBackStack()
                        },
                    )
                }
                QrScanScreen(
                    viewModel = qrViewModel,
                    onBack = { navController.popBackStack() },
                )
            }
        }
    }
}
