package cz.pbas.kantyna.mobile.android.ui.obed

import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
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
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle

@Composable
fun ObedScreen(
    viewModel: ObedViewModel,
    modifier: Modifier = Modifier,
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    Column(modifier = modifier.fillMaxSize()) {
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
            IconButton(onClick = viewModel::nextDay) {
                Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = "Další den")
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
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    items(state.departments, key = { it.name }) { dept ->
                        DepartmentCard(dept = dept)
                    }
                    item {
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "Celkem: ${state.totalPrice} Kč",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun DepartmentCard(dept: DeptCardUi) {
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
                            text = row,
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
                            text = row,
                            style = MaterialTheme.typography.bodyMedium,
                            modifier = Modifier.padding(top = 4.dp),
                        )
                    }
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
