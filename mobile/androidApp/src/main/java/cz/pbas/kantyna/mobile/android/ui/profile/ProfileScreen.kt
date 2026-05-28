package cz.pbas.kantyna.mobile.android.ui.profile

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle

@Composable
fun ProfileScreen(
    viewModel: ProfileViewModel,
    onScanQr: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val user = state.user

    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.Top,
    ) {
        if (state.isLoading && user == null) {
            Column(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                CircularProgressIndicator()
            }
            return
        }

        user?.let {
            Text(
                text = "${it.firstName} ${it.lastName}",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.SemiBold,
            )
            it.email?.let { email ->
                Text(
                    text = email,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
            it.defaultDepartment?.let { dept ->
                Text(
                    text = "Výchozí oddělení: $dept",
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.padding(top = 12.dp),
                )
            }
        }

        state.errorMessage?.let { message ->
            Spacer(modifier = Modifier.height(12.dp))
            Text(message, color = MaterialTheme.colorScheme.error)
        }

        Spacer(modifier = Modifier.weight(1f))

        OutlinedButton(
            onClick = onScanQr,
            modifier = Modifier.fillMaxWidth(),
            enabled = !state.isLoggingOut,
        ) {
            Text("Skenovat QR kód")
        }
        Spacer(modifier = Modifier.height(12.dp))

        OutlinedButton(
            onClick = viewModel::logout,
            modifier = Modifier.fillMaxWidth(),
            enabled = !state.isLoggingOut,
        ) {
            if (state.isLoggingOut) {
                CircularProgressIndicator(strokeWidth = 2.dp)
            } else {
                Text("Odhlásit se")
            }
        }
    }
}
