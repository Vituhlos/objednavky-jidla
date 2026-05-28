package cz.pbas.kantyna.mobile.android.ui.obed

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import cz.pbas.kantyna.mobile.dto.DayMenuItems
import cz.pbas.kantyna.mobile.dto.DepartmentData
import cz.pbas.kantyna.mobile.dto.MenuItem
import cz.pbas.kantyna.mobile.dto.OrderData
import cz.pbas.kantyna.mobile.dto.OrderRowEnriched
import cz.pbas.kantyna.mobile.dto.OrderStatus
import cz.pbas.kantyna.mobile.dto.UserProfile
import cz.pbas.kantyna.mobile.dto.UserRole
import cz.pbas.kantyna.mobile.network.ApiException
import cz.pbas.kantyna.mobile.network.NetworkException
import cz.pbas.kantyna.mobile.orders.OrderRepository
import cz.pbas.kantyna.mobile.orders.OrderRowCreate
import cz.pbas.kantyna.mobile.orders.OrderRowPatch
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

data class DeptRowUi(
    val id: Int,
    val preview: String,
)

data class DeptCardUi(
    val name: String,
    val label: String,
    val accent: String,
    val subtotal: Int,
    val state: DeptCardState,
    val rows: List<DeptRowUi>,
    val peopleCount: Int,
)

data class RowEditForm(
    val rowId: Int? = null,
    val department: String = "",
    val personName: String = "",
    val soupItemId: Int? = null,
    val soupItemId2: Int? = null,
    val mainItemId: Int? = null,
    val mealCount: Int = 1,
    val rollCount: Int = 0,
    val breadDumplingCount: Int = 0,
    val potatoDumplingCount: Int = 0,
    val ketchupCount: Int = 0,
    val tatarkaCount: Int = 0,
    val bbqCount: Int = 0,
    val note: String = "",
)

data class ObedUiState(
    val date: String = todayIsoDate(),
    val dateLabel: String = formatOrderDateHeader(todayIsoDate()),
    val isToday: Boolean = true,
    val isLoading: Boolean = true,
    val isSyncing: Boolean = false,
    val isSaving: Boolean = false,
    val errorMessage: String? = null,
    val toastMessage: String? = null,
    val orderId: Int? = null,
    val orderStatus: OrderStatus? = null,
    val sentAt: String? = null,
    val totalPrice: Int = 0,
    val departments: List<DeptCardUi> = emptyList(),
    val departmentOptions: List<Pair<String, String>> = emptyList(),
    val menu: DayMenuItems? = null,
    val isAdmin: Boolean = false,
    val pendingOutboxCount: Long = 0,
    val showOfflineBanner: Boolean = false,
    val editSheet: RowEditForm? = null,
    val showDeleteConfirm: Boolean = false,
    val showSendConfirm: Boolean = false,
)

class ObedViewModel(
    private val orderRepository: OrderRepository,
    user: UserProfile,
) : ViewModel() {

    private val userProfile = user
    private var currentOrderData: OrderData? = null

    private val _uiState = MutableStateFlow(
        ObedUiState(isAdmin = user.role == UserRole.ADMIN),
    )
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

    fun syncAndRefresh() {
        viewModelScope.launch {
            _uiState.update { it.copy(isSyncing = true, errorMessage = null) }
            orderRepository.syncOutbox()
                .onFailure { error ->
                    val message = errorMessage(error)
                    _uiState.update { it.copy(isSyncing = false, errorMessage = message) }
                    refreshOutboxState()
                    return@launch
                }
            loadOrder(_uiState.value.date, syncing = true)
        }
    }

    fun dismissToast() {
        _uiState.update { it.copy(toastMessage = null) }
    }

    fun openCreateRow(department: String) {
        if (_uiState.value.orderStatus == OrderStatus.SENT) return
        _uiState.update {
            it.copy(
                editSheet = RowEditForm(
                    department = department,
                    personName = defaultPersonName(),
                ),
                showDeleteConfirm = false,
            )
        }
    }

    fun openEditRow(rowId: Int) {
        if (_uiState.value.orderStatus == OrderStatus.SENT) return
        val row = findRow(rowId) ?: return
        _uiState.update {
            it.copy(
                editSheet = row.toForm(),
                showDeleteConfirm = false,
            )
        }
    }

    fun dismissEditSheet() {
        _uiState.update { it.copy(editSheet = null, showDeleteConfirm = false) }
    }

    fun updateEditForm(transform: (RowEditForm) -> RowEditForm) {
        _uiState.update { state ->
            val current = state.editSheet ?: return@update state
            state.copy(editSheet = transform(current))
        }
    }

    fun saveEditRow() {
        val form = _uiState.value.editSheet ?: return
        val orderId = _uiState.value.orderId ?: return
        if (form.department.isBlank()) {
            _uiState.update { it.copy(toastMessage = "Vyberte oddělení") }
            return
        }
        viewModelScope.launch {
            _uiState.update { it.copy(isSaving = true, errorMessage = null) }
            val result = if (form.rowId == null) {
                orderRepository.createRow(orderId, form.toCreateBody())
            } else {
                orderRepository.updateRow(form.rowId, form.toPatchBody())
            }
            result.fold(
                onSuccess = {
                    _uiState.update { it.copy(isSaving = false, editSheet = null) }
                    loadOrder(_uiState.value.date)
                    refreshOutboxState()
                },
                onFailure = { error ->
                    _uiState.update {
                        it.copy(isSaving = false, toastMessage = errorMessage(error))
                    }
                    refreshOutboxState()
                },
            )
        }
    }

    fun requestDeleteRow() {
        if (_uiState.value.editSheet?.rowId != null) {
            _uiState.update { it.copy(showDeleteConfirm = true) }
        }
    }

    fun dismissDeleteConfirm() {
        _uiState.update { it.copy(showDeleteConfirm = false) }
    }

    fun confirmDeleteRow() {
        val rowId = _uiState.value.editSheet?.rowId ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(isSaving = true, showDeleteConfirm = false) }
            orderRepository.deleteRow(rowId).fold(
                onSuccess = {
                    _uiState.update { it.copy(isSaving = false, editSheet = null) }
                    loadOrder(_uiState.value.date)
                    refreshOutboxState()
                },
                onFailure = { error ->
                    _uiState.update {
                        it.copy(isSaving = false, toastMessage = errorMessage(error))
                    }
                    refreshOutboxState()
                },
            )
        }
    }

    fun requestSendOrder() {
        if (!_uiState.value.isAdmin || _uiState.value.orderStatus != OrderStatus.DRAFT) return
        _uiState.update { it.copy(showSendConfirm = true) }
    }

    fun dismissSendConfirm() {
        _uiState.update { it.copy(showSendConfirm = false) }
    }

    fun confirmSendOrder() {
        val orderId = _uiState.value.orderId ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(isSaving = true, showSendConfirm = false) }
            orderRepository.sendOrder(orderId).fold(
                onSuccess = {
                    _uiState.update {
                        it.copy(
                            isSaving = false,
                            toastMessage = "Objednávka odeslána",
                        )
                    }
                    loadOrder(_uiState.value.date)
                    refreshOutboxState()
                },
                onFailure = { error ->
                    _uiState.update {
                        it.copy(isSaving = false, toastMessage = errorMessage(error))
                    }
                    refreshOutboxState()
                },
            )
        }
    }

    private fun loadOrder(date: String, syncing: Boolean = false) {
        viewModelScope.launch {
            _uiState.update {
                it.copy(
                    date = date,
                    dateLabel = formatOrderDateHeader(date),
                    isToday = isToday(date),
                    isLoading = !syncing,
                    isSyncing = syncing,
                    errorMessage = null,
                )
            }
            orderRepository.getOrderForDate(date).fold(
                onSuccess = { data ->
                    currentOrderData = data
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            isSyncing = false,
                            dateLabel = formatOrderDateHeader(date, data.dayCode),
                            orderId = data.order.id,
                            orderStatus = data.order.status,
                            sentAt = data.order.sentAt,
                            totalPrice = data.totalPrice,
                            menu = data.todayMenu,
                            departments = data.departments.map { dept ->
                                toDeptCardUi(dept, data.order.status)
                            },
                            departmentOptions = data.departments.map { it.name to it.label },
                        )
                    }
                    refreshOutboxState()
                },
                onFailure = { error ->
                    val message = errorMessage(error)
                    _uiState.update {
                        it.copy(isLoading = false, isSyncing = false, errorMessage = message)
                    }
                    refreshOutboxState()
                },
            )
        }
    }

    private fun refreshOutboxState() {
        val pending = orderRepository.pendingOutboxCount()
        _uiState.update {
            it.copy(
                pendingOutboxCount = pending,
                showOfflineBanner = pending > 0,
            )
        }
    }

    private fun findRow(rowId: Int): OrderRowEnriched? =
        currentOrderData?.departments?.flatMap { it.rows }?.firstOrNull { it.id == rowId }

    private fun defaultPersonName(): String =
        "${userProfile.firstName} ${userProfile.lastName}".trim()

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
            rows = dept.rows.map { row ->
                DeptRowUi(id = row.id, preview = formatRowPreview(row))
            },
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

    private fun errorMessage(error: Throwable): String = when (error) {
        is ApiException -> error.message
        is NetworkException -> error.message
        else -> error.message ?: "Operace se nezdařila"
    }
}

private fun OrderRowEnriched.toForm(): RowEditForm = RowEditForm(
    rowId = id,
    department = department,
    personName = personName,
    soupItemId = soupItemId,
    soupItemId2 = soupItemId2,
    mainItemId = mainItemId,
    mealCount = mealCount,
    rollCount = rollCount ?: 0,
    breadDumplingCount = breadDumplingCount ?: 0,
    potatoDumplingCount = potatoDumplingCount ?: 0,
    ketchupCount = ketchupCount ?: 0,
    tatarkaCount = tatarkaCount ?: 0,
    bbqCount = bbqCount ?: 0,
    note = note.orEmpty(),
)

private fun RowEditForm.toCreateBody(): OrderRowCreate = OrderRowCreate(
    department = department,
    personName = personName.trim().ifBlank { null },
    soupItemId = soupItemId,
    soupItemId2 = soupItemId2,
    mainItemId = mainItemId,
    mealCount = mealCount.coerceAtLeast(1),
    rollCount = rollCount.takeIf { it > 0 },
    breadDumplingCount = breadDumplingCount.takeIf { it > 0 },
    potatoDumplingCount = potatoDumplingCount.takeIf { it > 0 },
    ketchupCount = ketchupCount.takeIf { it > 0 },
    tatarkaCount = tatarkaCount.takeIf { it > 0 },
    bbqCount = bbqCount.takeIf { it > 0 },
    note = note.trim().ifBlank { null },
)

private fun RowEditForm.toPatchBody(): OrderRowPatch = OrderRowPatch(
    personName = personName.trim().ifBlank { null },
    soupItemId = soupItemId,
    soupItemId2 = soupItemId2,
    mainItemId = mainItemId,
    mealCount = mealCount.coerceAtLeast(1),
    rollCount = rollCount.takeIf { it > 0 },
    breadDumplingCount = breadDumplingCount.takeIf { it > 0 },
    potatoDumplingCount = potatoDumplingCount.takeIf { it > 0 },
    ketchupCount = ketchupCount.takeIf { it > 0 },
    tatarkaCount = tatarkaCount.takeIf { it > 0 },
    bbqCount = bbqCount.takeIf { it > 0 },
    note = note.trim().ifBlank { null },
)
