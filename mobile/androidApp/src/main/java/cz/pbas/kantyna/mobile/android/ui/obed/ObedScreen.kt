package cz.pbas.kantyna.mobile.android.ui.obed

import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import cz.pbas.kantyna.mobile.dto.OrderStatus

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ObedScreen(
    viewModel: ObedViewModel,
    modifier: Modifier = Modifier,
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(state.toastMessage) {
        state.toastMessage?.let { message ->
            snackbarHostState.showSnackbar(message)
            viewModel.dismissToast()
        }
    }

    Scaffold(
        modifier = modifier,
        snackbarHost = { SnackbarHost(snackbarHostState) },
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding),
        ) {
            if (state.showOfflineBanner) {
                OfflineBanner(pendingCount = state.pendingOutboxCount)
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 8.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                IconButton(onClick = viewModel::previousDay) {
                    Icon(Icons.AutoMirrored.Filled.KeyboardArrowLeft, contentDescription = "Předchozí den")
                }
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = state.dateLabel,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                    )
                    if (state.isToday) {
                        Text(
                            text = "Dnes",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.primary,
                        )
                    }
                }
                Row {
                    IconButton(onClick = viewModel::syncAndRefresh) {
                        Icon(Icons.Default.Sync, contentDescription = "Synchronizovat")
                    }
                    IconButton(onClick = viewModel::nextDay) {
                        Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = "Další den")
                    }
                }
            }

            when {
                state.isLoading -> {
                    Column(
                        modifier = Modifier.fillMaxSize(),
                        verticalArrangement = Arrangement.Center,
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        CircularProgressIndicator()
                    }
                }
                state.errorMessage != null -> {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(24.dp),
                        verticalArrangement = Arrangement.Center,
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Text(state.errorMessage!!, color = MaterialTheme.colorScheme.error)
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(onClick = viewModel::retry) { Text("Zkusit znovu") }
                    }
                }
                else -> {
                    PullToRefreshBox(
                        isRefreshing = state.isSyncing,
                        onRefresh = viewModel::syncAndRefresh,
                        modifier = Modifier.fillMaxSize(),
                    ) {
                        LazyColumn(
                            modifier = Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(16.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            items(state.departments, key = { it.name }) { dept ->
                                DepartmentCard(
                                    dept = dept,
                                    canEdit = state.orderStatus == OrderStatus.DRAFT,
                                    onAdd = { viewModel.openCreateRow(dept.name) },
                                    onRowClick = viewModel::openEditRow,
                                )
                            }
                            item {
                                Spacer(modifier = Modifier.height(8.dp))
                                Text(
                                    text = "Celkem: ${state.totalPrice} Kč",
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.SemiBold,
                                )
                                if (state.isAdmin && state.orderStatus == OrderStatus.DRAFT) {
                                    Spacer(modifier = Modifier.height(12.dp))
                                    Button(
                                        onClick = viewModel::requestSendOrder,
                                        enabled = state.totalPrice > 0 && !state.isSaving,
                                        modifier = Modifier.fillMaxWidth(),
                                    ) {
                                        Text("Odeslat objednávku")
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (state.showDeleteConfirm) {
        AlertDialog(
            onDismissRequest = viewModel::dismissDeleteConfirm,
            title = { Text("Smazat řádek?") },
            text = { Text("Tato akce je nevratná.") },
            confirmButton = {
                TextButton(onClick = viewModel::confirmDeleteRow) {
                    Text("Smazat", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(onClick = viewModel::dismissDeleteConfirm) {
                    Text("Zrušit")
                }
            },
        )
    }

    if (state.showSendConfirm) {
        AlertDialog(
            onDismissRequest = viewModel::dismissSendConfirm,
            title = { Text("Odeslat objednávku?") },
            text = {
                Text(
                    "${state.dateLabel} · ${state.departments.sumOf { it.peopleCount }} osob · ${state.totalPrice} Kč\n\n" +
                        "E-mail bude odeslán na kuchyni.",
                )
            },
            confirmButton = {
                Button(onClick = viewModel::confirmSendOrder) {
                    Text("Odeslat")
                }
            },
            dismissButton = {
                OutlinedButton(onClick = viewModel::dismissSendConfirm) {
                    Text("Zrušit")
                }
            },
        )
    }

    val editSheet = state.editSheet
    val menu = state.menu
    if (editSheet != null && menu != null) {
        val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ModalBottomSheet(
            onDismissRequest = viewModel::dismissEditSheet,
            sheetState = sheetState,
        ) {
            OrderRowEditSheet(
                form = editSheet,
                menu = menu,
                departmentOptions = state.departmentOptions,
                isSaving = state.isSaving,
                onFormChange = { updated -> viewModel.updateEditForm { updated } },
                onDismiss = viewModel::dismissEditSheet,
                onSave = viewModel::saveEditRow,
                onDelete = viewModel::requestDeleteRow,
            )
        }
    }
}

@Composable
private fun OfflineBanner(pendingCount: Long) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp)
            .border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(8.dp))
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Icon(
            Icons.Default.CloudOff,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary,
        )
        Text(
            text = if (pendingCount > 0) {
                "Offline — $pendingCount změn čeká na odeslání"
            } else {
                "Offline — změny se odešlou po připojení"
            },
            style = MaterialTheme.typography.bodySmall,
        )
    }
}

@Composable
private fun DepartmentCard(
    dept: DeptCardUi,
    canEdit: Boolean,
    onAdd: () -> Unit,
    onRowClick: (Int) -> Unit,
) {
    val accentColor = accentColor(dept.accent)
    val borderColor = when (dept.state) {
        DeptCardState.EMPTY -> MaterialTheme.colorScheme.outlineVariant
        DeptCardState.DRAFT -> accentColor
        DeptCardState.SENT -> MaterialTheme.colorScheme.outline
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, borderColor, RoundedCornerShape(12.dp)),
        colors = CardDefaults.cardColors(
            containerColor = when (dept.state) {
                DeptCardState.SENT -> MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                else -> MaterialTheme.colorScheme.surface
            },
        ),
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = dept.label,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = accentColor,
                )
                Text(
                    text = "${dept.subtotal} Kč",
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium,
                )
            }
            Spacer(modifier = Modifier.height(8.dp))
            AssistChip(
                onClick = {},
                enabled = false,
                label = { Text(deptStateLabel(dept.state)) },
            )
            Spacer(modifier = Modifier.height(8.dp))
            when (dept.state) {
                DeptCardState.EMPTY -> {
                    Text(
                        text = "Žádné objednávky",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                DeptCardState.SENT -> {
                    Text(
                        text = "${dept.peopleCount} ${peopleLabel(dept.peopleCount)} · odesláno",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    dept.rows.forEach { row ->
                        Text(
                            text = row.preview,
                            style = MaterialTheme.typography.bodyMedium,
                            modifier = Modifier.padding(top = 4.dp),
                        )
                    }
                }
                DeptCardState.DRAFT -> {
                    Text(
                        text = "${dept.peopleCount} ${peopleLabel(dept.peopleCount)}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    dept.rows.forEach { row ->
                        Text(
                            text = row.preview,
                            style = MaterialTheme.typography.bodyMedium,
                            modifier = Modifier
                                .padding(top = 4.dp)
                                .then(
                                    if (canEdit) {
                                        Modifier.clickable { onRowClick(row.id) }
                                    } else {
                                        Modifier
                                    },
                                ),
                        )
                    }
                }
            }
            if (canEdit && dept.state != DeptCardState.SENT) {
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedButton(onClick = onAdd, modifier = Modifier.fillMaxWidth()) {
                    Text("+ Přidat")
                }
            }
        }
    }
}

private fun deptStateLabel(state: DeptCardState): String = when (state) {
    DeptCardState.EMPTY -> "Prázdné"
    DeptCardState.DRAFT -> "Koncept"
    DeptCardState.SENT -> "Odesláno"
}

private fun peopleLabel(count: Int): String = when {
    count == 1 -> "osoba"
    count in 2..4 -> "osoby"
    else -> "osob"
}

@Composable
private fun accentColor(accent: String): Color = when (accent) {
    "blue" -> Color(0xFF2563EB)
    "rust" -> Color(0xFFB45309)
    "green" -> Color(0xFF16A34A)
    "amber" -> Color(0xFFD97706)
    "navy" -> Color(0xFF1E3A8A)
    "orange" -> Color(0xFFEA580C)
    "red" -> Color(0xFFDC2626)
    else -> MaterialTheme.colorScheme.primary
}
