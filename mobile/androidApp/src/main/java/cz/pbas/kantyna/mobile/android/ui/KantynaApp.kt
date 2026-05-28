package cz.pbas.kantyna.mobile.android.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
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
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import cz.pbas.kantyna.mobile.android.R

private sealed class TabRoute(val route: String) {
    data object Obed : TabRoute("obed")
    data object Jidelnicek : TabRoute("jidelnicek")
    data object Historie : TabRoute("historie")
    data object Profil : TabRoute("profil")
}

private data class TabItem(
    val route: TabRoute,
    val labelRes: Int,
    val icon: @Composable () -> Unit,
)

@Composable
fun KantynaApp() {
    val navController = rememberNavController()
    val tabs = listOf(
        TabItem(TabRoute.Obed, R.string.tab_obed) { Icon(Icons.Default.Restaurant, contentDescription = null) },
        TabItem(TabRoute.Jidelnicek, R.string.tab_jidelnicek) { Icon(Icons.AutoMirrored.Filled.List, contentDescription = null) },
        TabItem(TabRoute.Historie, R.string.tab_historie) { Icon(Icons.Default.History, contentDescription = null) },
        TabItem(TabRoute.Profil, R.string.tab_profil) { Icon(Icons.Default.Person, contentDescription = null) },
    )
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route

    Scaffold(
        bottomBar = {
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
        },
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = TabRoute.Obed.route,
            modifier = Modifier.padding(innerPadding),
        ) {
            composable(TabRoute.Obed.route) { PlaceholderScreen(stringResource(R.string.tab_obed)) }
            composable(TabRoute.Jidelnicek.route) { PlaceholderScreen(stringResource(R.string.tab_jidelnicek)) }
            composable(TabRoute.Historie.route) { PlaceholderScreen(stringResource(R.string.tab_historie)) }
            composable(TabRoute.Profil.route) { PlaceholderScreen(stringResource(R.string.tab_profil)) }
        }
    }
}

@Composable
private fun PlaceholderScreen(title: String) {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center,
    ) {
        Text(text = title)
    }
}
