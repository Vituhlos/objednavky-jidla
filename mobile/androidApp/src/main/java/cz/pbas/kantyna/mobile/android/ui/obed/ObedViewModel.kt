package cz.pbas.kantyna.mobile.android.ui.obed

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import cz.pbas.kantyna.mobile.dto.DepartmentData
import cz.pbas.kantyna.mobile.dto.OrderRowEnriched
import cz.pbas.kantyna.mobile.dto.OrderStatus
import cz.pbas.kantyna.mobile.network.ApiException
import cz.pbas.kantyna.mobile.orders.OrderRepository
import cz.pbas.kantyna.mobile.util.formatOrderDateHeader
import cz.pbas.kantyna.mobile.util.isToday
import cz.pbas.kantyna.mobile.util.shiftIsoDate
import cz.pbas.kantyna.mobile.util.todayIsoDate
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

enum class DeptCardState {
    EMPTY,
    DRAFT,
    SENT,
}

data class DeptCardUi(
    val name: String,
    val label: String,
    val accent: String,
    val subtotal: Int,
    val state: DeptCardState,
    val rows: List<String>,
    val peopleCount: Int,
)

data class ObedUiState(
    val date: String = todayIsoDate(),
    val dateLabel: String = formatOrderDateHeader(todayIsoDate()),
    val isToday: Boolean = true,
    val isLoading: Boolean = true,
    val errorMessage: String? = null,
    val orderStatus: OrderStatus? = null,
    val sentAt: String? = null,
    val totalPrice: Int = 0,
    val departments: List<DeptCardUi> = emptyList(),
)

class ObedViewModel(
    private val orderRepository: OrderRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(ObedUiState())
    val uiState: StateFlow<ObedUiState> = _uiState.asStateFlow()

    init {
        loadOrder(_uiState.value.date)
    }

    fun previousDay() {
        loadOrder(shiftIsoDate(_uiState.value.date, -1))
    }

    fun nextDay() {
        loadOrder(shiftIsoDate(_uiState.value.date, 1))
    }

    fun retry() {
        loadOrder(_uiState.value.date)
    }

    private fun loadOrder(date: String) {
        viewModelScope.launch {
            _uiState.update {
                it.copy(
                    date = date,
                    dateLabel = formatOrderDateHeader(date),
                    isToday = isToday(date),
                    isLoading = true,
                    errorMessage = null,
                )
            }
            orderRepository.getOrderForDate(date).fold(
                onSuccess = { data ->
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            dateLabel = formatOrderDateHeader(date, data.dayCode),
                            orderStatus = data.order.status,
                            sentAt = data.order.sentAt,
                            totalPrice = data.totalPrice,
                            departments = data.departments.map { dept ->
                                toDeptCardUi(dept, data.order.status)
                            },
                        )
                    }
                },
                onFailure = { error ->
                    val message = when (error) {
                        is ApiException -> error.message
                        else -> error.message ?: "Nepodařilo se načíst objednávku"
                    }
                    _uiState.update {
                        it.copy(isLoading = false, errorMessage = message)
                    }
                },
            )
        }
    }

    private fun toDeptCardUi(dept: DepartmentData, orderStatus: OrderStatus): DeptCardUi {
        val state = when {
            dept.rows.isEmpty() -> DeptCardState.EMPTY
            orderStatus == OrderStatus.SENT -> DeptCardState.SENT
            else -> DeptCardState.DRAFT
        }
        return DeptCardUi(
            name = dept.name,
            label = dept.label,
            accent = dept.accent,
            subtotal = dept.subtotal,
            state = state,
            rows = dept.rows.map(::formatRowPreview),
            peopleCount = dept.rows.size,
        )
    }

    private fun formatRowPreview(row: OrderRowEnriched): String {
        val items = buildList {
            row.soupItem?.let { add("Polévka ${it.code}") }
            row.soupItem2?.let { add("Polévka ${it.code}") }
            row.mainItem?.let { add("Jídlo ${it.code}") }
        }
        val itemSummary = if (items.isEmpty()) "—" else items.joinToString(", ")
        return "${row.personName} — $itemSummary"
    }
}
