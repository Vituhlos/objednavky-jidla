package cz.pbas.kantyna.mobile.android.ui.obed

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import cz.pbas.kantyna.mobile.dto.DayMenuItems
import cz.pbas.kantyna.mobile.dto.MenuItem

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OrderRowEditSheet(
    form: RowEditForm,
    menu: DayMenuItems,
    departmentOptions: List<Pair<String, String>>,
    isSaving: Boolean,
    onFormChange: (RowEditForm) -> Unit,
    onDismiss: () -> Unit,
    onSave: () -> Unit,
    onDelete: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp, vertical = 8.dp),
    ) {
        Text(
            text = if (form.rowId == null) "Přidat objednávku" else "Upravit objednávku",
            style = MaterialTheme.typography.titleMedium,
        )
        Spacer(modifier = Modifier.height(16.dp))

        DepartmentDropdown(
            label = "Oddělení",
            selected = form.department,
            options = departmentOptions,
            enabled = form.rowId == null,
            onSelected = { onFormChange(form.copy(department = it)) },
        )
        Spacer(modifier = Modifier.height(12.dp))

        OutlinedTextField(
            value = form.personName,
            onValueChange = { onFormChange(form.copy(personName = it)) },
            label = { Text("Jméno") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
        )
        Spacer(modifier = Modifier.height(12.dp))

        MenuItemDropdown(
            label = "Polévka 1",
            items = menu.soups,
            selectedId = form.soupItemId,
            allowEmpty = true,
            emptyLabel = "— žádná —",
            onSelected = { onFormChange(form.copy(soupItemId = it)) },
        )
        Spacer(modifier = Modifier.height(12.dp))

        MenuItemDropdown(
            label = "Polévka 2",
            items = menu.soups,
            selectedId = form.soupItemId2,
            allowEmpty = true,
            emptyLabel = "— žádná —",
            onSelected = { onFormChange(form.copy(soupItemId2 = it)) },
        )
        Spacer(modifier = Modifier.height(12.dp))

        MenuItemDropdown(
            label = "Hlavní jídlo",
            items = menu.meals,
            selectedId = form.mainItemId,
            allowEmpty = true,
            emptyLabel = "— nevybráno —",
            onSelected = { onFormChange(form.copy(mainItemId = it)) },
        )
        Spacer(modifier = Modifier.height(12.dp))

        OutlinedTextField(
            value = form.mealCount.toString(),
            onValueChange = { value ->
                val count = value.filter { it.isDigit() }.toIntOrNull() ?: 1
                onFormChange(form.copy(mealCount = count.coerceAtLeast(1)))
            },
            label = { Text("Počet jídel") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
        )
        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = "Přílohy a omáčky",
            style = MaterialTheme.typography.titleSmall,
        )
        Spacer(modifier = Modifier.height(8.dp))
        ExtraCountRow("Rohlík", form.rollCount) {
            onFormChange(form.copy(rollCount = it))
        }
        ExtraCountRow("Knedlík", form.breadDumplingCount) {
            onFormChange(form.copy(breadDumplingCount = it))
        }
        ExtraCountRow("Bramborový knedlík", form.potatoDumplingCount) {
            onFormChange(form.copy(potatoDumplingCount = it))
        }
        ExtraCountRow("Kečup", form.ketchupCount) {
            onFormChange(form.copy(ketchupCount = it))
        }
        ExtraCountRow("Tatarka", form.tatarkaCount) {
            onFormChange(form.copy(tatarkaCount = it))
        }
        ExtraCountRow("BBQ", form.bbqCount) {
            onFormChange(form.copy(bbqCount = it))
        }
        Spacer(modifier = Modifier.height(12.dp))

        OutlinedTextField(
            value = form.note,
            onValueChange = { onFormChange(form.copy(note = it)) },
            label = { Text("Poznámka") },
            modifier = Modifier.fillMaxWidth(),
            minLines = 2,
        )
        Spacer(modifier = Modifier.height(16.dp))
        HorizontalDivider()
        Spacer(modifier = Modifier.height(12.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (form.rowId != null) {
                TextButton(onClick = onDelete, enabled = !isSaving) {
                    Text("Smazat", color = MaterialTheme.colorScheme.error)
                }
            } else {
                Spacer(modifier = Modifier.weight(1f))
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = onDismiss, enabled = !isSaving) {
                    Text("Zrušit")
                }
                Button(onClick = onSave, enabled = !isSaving) {
                    Text("Uložit")
                }
            }
        }
        Spacer(modifier = Modifier.height(16.dp))
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DepartmentDropdown(
    label: String,
    selected: String,
    options: List<Pair<String, String>>,
    enabled: Boolean,
    onSelected: (String) -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    val selectedLabel = options.firstOrNull { it.first == selected }?.second ?: selected

    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { if (enabled) expanded = it },
    ) {
        OutlinedTextField(
            value = selectedLabel,
            onValueChange = {},
            readOnly = true,
            enabled = enabled,
            label = { Text(label) },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded) },
            modifier = Modifier
                .fillMaxWidth()
                .menuAnchor(MenuAnchorType.PrimaryNotEditable),
        )
        ExposedDropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false },
        ) {
            options.forEach { (value, display) ->
                DropdownMenuItem(
                    text = { Text(display) },
                    onClick = {
                        onSelected(value)
                        expanded = false
                    },
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MenuItemDropdown(
    label: String,
    items: List<MenuItem>,
    selectedId: Int?,
    allowEmpty: Boolean,
    emptyLabel: String,
    onSelected: (Int?) -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    val selectedLabel = items.firstOrNull { it.id == selectedId }?.let { "${it.code} — ${it.name}" }
        ?: emptyLabel

    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = it },
    ) {
        OutlinedTextField(
            value = selectedLabel,
            onValueChange = {},
            readOnly = true,
            label = { Text(label) },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded) },
            modifier = Modifier
                .fillMaxWidth()
                .menuAnchor(MenuAnchorType.PrimaryNotEditable),
        )
        ExposedDropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false },
        ) {
            if (allowEmpty) {
                DropdownMenuItem(
                    text = { Text(emptyLabel) },
                    onClick = {
                        onSelected(null)
                        expanded = false
                    },
                )
            }
            items.forEach { item ->
                DropdownMenuItem(
                    text = { Text("${item.code} — ${item.name}") },
                    onClick = {
                        onSelected(item.id)
                        expanded = false
                    },
                )
            }
        }
    }
}

@Composable
private fun ExtraCountRow(
    label: String,
    count: Int,
    onCountChange: (Int) -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(text = label, modifier = Modifier.weight(1f))
        Row(verticalAlignment = Alignment.CenterVertically) {
            TextButton(onClick = { onCountChange((count - 1).coerceAtLeast(0)) }) {
                Text("−")
            }
            Text(text = count.toString(), modifier = Modifier.padding(horizontal = 8.dp))
            TextButton(onClick = { onCountChange(count + 1) }) {
                Text("+")
            }
        }
    }
}
