package cz.pbas.kantyna.mobile.android.ui.history

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import cz.pbas.kantyna.mobile.dto.OrderSummaryWithDepts
import cz.pbas.kantyna.mobile.dto.OrderStatus
import cz.pbas.kantyna.mobile.history.HistoryRepository
import cz.pbas.kantyna.mobile.network.ApiException
import cz.pbas.kantyna.mobile.util.formatCzechDate
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class HistoryOrderUi(
    val id: Int,
    val dateLabel: String,
    val statusLabel: String,
    val peopleCount: Int,
    val totalPrice: Int,
    val depts: String,
)

data class HistoryUiState(
    val isLoading: Boolean = true,
    val errorMessage: String? = null,
    val monthlyOrderCount: Int? = null,
    val monthlyPeopleCount: Int? = null,
    val monthlySum: Int? = null,
    val orders: List<HistoryOrderUi> = emptyList(),
)

class HistoryViewModel(
    private val historyRepository: HistoryRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(HistoryUiState())
    val uiState: StateFlow<HistoryUiState> = _uiState.asStateFlow()

    init {
        load()
    }

    fun retry() {
        load()
    }

    private fun load() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }

            val statsResult = historyRepository.getStats()
            val ordersResult = historyRepository.getOrders()

            if (ordersResult.isFailure) {
                val error = ordersResult.exceptionOrNull()
                val message = when (error) {
                    is ApiException -> error.message
                    else -> error?.message ?: "Nepodařilo se načíst historii"
                }
                _uiState.update { it.copy(isLoading = false, errorMessage = message) }
                return@launch
            }

            val stats = statsResult.getOrNull()
            val orders = ordersResult.getOrThrow()

            _uiState.update {
                it.copy(
                    isLoading = false,
                    monthlyOrderCount = stats?.monthlyOrderCount,
                    monthlyPeopleCount = stats?.monthlyPeopleCount,
                    monthlySum = stats?.monthlySum,
                    orders = orders.items.map(::toUi),
                )
            }
        }
    }

    private fun toUi(order: OrderSummaryWithDepts) = HistoryOrderUi(
        id = order.id,
        dateLabel = formatCzechDate(order.date),
        statusLabel = when (order.status) {
            OrderStatus.SENT -> "Odesláno"
            OrderStatus.DRAFT -> "Koncept"
        },
        peopleCount = order.peopleCount,
        totalPrice = order.totalPrice,
        depts = order.depts.joinToString(", "),
    )
}
