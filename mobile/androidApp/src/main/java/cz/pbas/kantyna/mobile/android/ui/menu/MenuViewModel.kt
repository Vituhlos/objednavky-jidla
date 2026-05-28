package cz.pbas.kantyna.mobile.android.ui.menu

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import cz.pbas.kantyna.mobile.menu.MenuRepository
import cz.pbas.kantyna.mobile.network.ApiException
import cz.pbas.kantyna.mobile.util.formatCzechDate
import cz.pbas.kantyna.mobile.util.shiftIsoDate
import cz.pbas.kantyna.mobile.util.todayIsoDate
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class MenuItemUi(
    val code: String,
    val name: String,
    val price: Int,
    val allergens: String,
)

data class MenuUiState(
    val date: String = todayIsoDate(),
    val dateLabel: String = formatCzechDate(todayIsoDate()),
    val isLoading: Boolean = true,
    val isStale: Boolean = false,
    val errorMessage: String? = null,
    val soups: List<MenuItemUi> = emptyList(),
    val meals: List<MenuItemUi> = emptyList(),
    val closed: Boolean = false,
)

class MenuViewModel(
    private val menuRepository: MenuRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(MenuUiState())
    val uiState: StateFlow<MenuUiState> = _uiState.asStateFlow()

    init {
        loadMenu(_uiState.value.date)
    }

    fun previousDay() {
        val newDate = shiftIsoDate(_uiState.value.date, -1)
        loadMenu(newDate)
    }

    fun nextDay() {
        val newDate = shiftIsoDate(_uiState.value.date, 1)
        loadMenu(newDate)
    }

    fun retry() {
        loadMenu(_uiState.value.date)
    }

    private fun loadMenu(date: String) {
        viewModelScope.launch {
            _uiState.update {
                it.copy(
                    date = date,
                    dateLabel = formatCzechDate(date),
                    isLoading = true,
                    errorMessage = null,
                    isStale = false,
                )
            }
            menuRepository.getDayMenu(date).fold(
                onSuccess = { result ->
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            isStale = result.fromCache,
                            soups = result.menu.soups.map(::toUi),
                            meals = result.menu.meals.map(::toUi),
                            closed = result.menu.closed,
                        )
                    }
                },
                onFailure = { error ->
                    val message = when (error) {
                        is ApiException -> error.message
                        else -> error.message ?: "Nepodařilo se načíst jídelníček"
                    }
                    _uiState.update {
                        it.copy(isLoading = false, errorMessage = message)
                    }
                },
            )
        }
    }

    private fun toUi(item: cz.pbas.kantyna.mobile.dto.MenuItem) = MenuItemUi(
        code = item.code,
        name = item.name,
        price = item.price,
        allergens = item.allergens,
    )
}
