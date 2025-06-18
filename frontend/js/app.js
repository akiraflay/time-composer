// Main application logic
let currentView = 'dashboard';
let currentEntries = [];
let currentEntry = null;
let viewMode = 'expanded'; // expanded, condensed
let dateFilter = '';
let statusFilter = '';
let clientFilter = '';
let matterFilter = '';
let hoursFilter = '';
let taskFilter = '';
let customDateRange = null;
let quickTimeFilter = 'all';
let advancedFiltersVisible = false;
let datePickerVisible = false;
let bulkSelectionMode = false;
let selectedEntries = new Set();

// Helper function to determine entry status based on narratives
function determineEntryStatus(entry) {
    if (entry.narratives && entry.narratives.length > 0) {
        const narrativeStatuses = entry.narratives.map(n => n.status || 'draft');
        // If any narrative is exported, the entry is exported
        const hasExported = narrativeStatuses.some(status => status === 'exported');
        return hasExported ? 'exported' : 'draft';
    }
    return entry.status || 'draft';
}

// Helper function to create status toggle button
function createStatusDropdown(entryId, currentStatus, entry = null) {
    // Determine effective status using the helper function
    let effectiveStatus = currentStatus;
    
    if (entry) {
        effectiveStatus = determineEntryStatus(entry);
    }
    
    // Convert 'ready' to 'draft' for display (simplifying to only draft/exported)
    if (effectiveStatus === 'ready') {
        effectiveStatus = 'draft';
    }
    
    const displayText = effectiveStatus === 'exported' ? 'EXPORTED' : 'DRAFT';
    
    return `
        <div class="status-display" data-entry-id="${entryId}">
            <span class="status-badge ${effectiveStatus}">
                ${displayText}
            </span>
        </div>
    `;
}

// Removed narrative status dropdown - status is now automatic

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize database
    try {
        await initDB();
        console.log('Database initialized');
    } catch (err) {
        console.error('Failed to initialize database:', err);
    }
    
    // Initialize network status
    networkStatus.init();
    
    // Start auto-sync
    syncManager.startAutoSync();
    
    // Set up event listeners
    setupEventListeners();
    
    // Make closeContextRecorder available globally for onclick handlers
    window.closeContextRecorder = closeContextRecorder;
    
    // Load initial view
    loadDashboard();
    
    // Handle window resize for responsive table
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            // Only reload if in condensed (list) view
            if (viewMode === 'condensed' && currentView === 'dashboard') {
                loadDashboard();
            }
        }, 250);
    });
});

// Event listeners - Streamlined
function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const view = e.target.dataset.view;
            switchView(view);
        });
    });
    
    // App title navigation - always go to dashboard in card view
    const appTitle = document.getElementById('app-title');
    if (appTitle) {
        appTitle.addEventListener('click', (e) => {
            e.preventDefault();
            // Set to card view (expanded mode)
            viewMode = 'expanded';
            // Update the view toggle button to show correct state
            const listIcon = document.getElementById('list-view-icon');
            const cardIcon = document.getElementById('card-view-icon');
            if (listIcon && cardIcon) {
                listIcon.style.display = 'block';
                cardIcon.style.display = 'none';
            }
            // Switch to dashboard
            switchView('dashboard');
        });
    }
    
    // Streamlined controls
    const searchInput = document.getElementById('search');
    const viewToggleBtn = document.getElementById('view-toggle');
    const filtersBtn = document.getElementById('filters-btn');
    const addButton = document.getElementById('add-time-entry');
    
    // Search functionality
    if (searchInput) {
        searchInput.addEventListener('input', debounce(() => loadDashboard(), 300));
    }
    
    // View toggle - single button that switches between modes
    if (viewToggleBtn) {
        viewToggleBtn.addEventListener('click', () => {
            toggleViewMode();
        });
    }
    
    // Status filter dropdown
    const statusFilterBtn = document.getElementById('status-filter-btn');
    const statusDropdown = document.getElementById('status-dropdown');
    
    if (statusFilterBtn && statusDropdown) {
        statusFilterBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            statusDropdown.classList.toggle('hidden');
        });
        
        // Handle dropdown item clicks
        statusDropdown.addEventListener('click', (e) => {
            if (e.target.classList.contains('dropdown-item')) {
                e.stopPropagation();
                
                // Update active state
                statusDropdown.querySelectorAll('.dropdown-item').forEach(item => {
                    item.classList.remove('active');
                });
                e.target.classList.add('active');
                
                // Update button text
                const statusText = document.getElementById('status-filter-text');
                if (statusText) {
                    statusText.textContent = e.target.textContent;
                }
                
                // Update filter and reload
                statusFilter = e.target.dataset.status;
                // Update the hidden status filter element if it exists
                const statusFilterElement = document.getElementById('status-filter');
                if (statusFilterElement) {
                    statusFilterElement.value = statusFilter;
                }
                loadDashboard();
                
                // Hide dropdown
                statusDropdown.classList.add('hidden');
            }
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            statusDropdown.classList.add('hidden');
        });
    }
    
    // Add Entry button
    if (addButton) {
        addButton.addEventListener('click', () => {
            if (window.aiAssistant) {
                window.aiAssistant.open();
            } else {
                // Fallback to old modal if AI assistant isn't loaded
                openModal();
            }
        });
    }
    
    
    
    // Bulk actions
    const bulkDuplicateBtn = document.getElementById('bulk-duplicate');
    const bulkDeleteBtn = document.getElementById('bulk-delete');
    const bulkCancelBtn = document.getElementById('bulk-cancel');
    
    if (bulkDuplicateBtn) {
        bulkDuplicateBtn.addEventListener('click', bulkDuplicateEntries);
    }
    
    if (bulkDeleteBtn) {
        bulkDeleteBtn.addEventListener('click', bulkDeleteEntries);
    }
    
    if (bulkCancelBtn) {
        bulkCancelBtn.addEventListener('click', cancelBulkSelection);
    }
    
    // Advanced filters panel controls
    const statusFilter = document.getElementById('status-filter');
    const clientFilterEl = document.getElementById('client-filter');
    const matterFilterEl = document.getElementById('matter-filter');
    const hoursFilterEl = document.getElementById('hours-filter');
    const taskFilterEl = document.getElementById('task-filter');
    const clearAllFiltersBtn = document.getElementById('clear-all-filters');
    const applyFiltersBtn = document.getElementById('apply-filters');
    
    if (statusFilter) {
        statusFilter.addEventListener('change', () => {
            loadDashboard();
            updateActiveFiltersCount();
        });
    }
    
    if (clientFilterEl) {
        clientFilterEl.addEventListener('change', (e) => {
            clientFilter = e.target.value;
            loadDashboard();
            updateActiveFiltersCount();
        });
    }
    
    if (matterFilterEl) {
        matterFilterEl.addEventListener('change', (e) => {
            matterFilter = e.target.value;
            loadDashboard();
            updateActiveFiltersCount();
        });
    }
    
    if (hoursFilterEl) {
        hoursFilterEl.addEventListener('change', (e) => {
            hoursFilter = e.target.value;
            loadDashboard();
            updateActiveFiltersCount();
        });
    }
    
    if (taskFilterEl) {
        taskFilterEl.addEventListener('input', debounce((e) => {
            taskFilter = e.target.value;
            loadDashboard();
            updateActiveFiltersCount();
        }, 300));
    }
    
    if (clearAllFiltersBtn) {
        clearAllFiltersBtn.addEventListener('click', () => clearAllFilters());
    }
    
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', () => {
            loadDashboard();
            updateActiveFiltersCount();
        });
    }
    
    // Export controls
    const exportButton = document.getElementById('export-btn');
    if (exportButton) {
        exportButton.addEventListener('click', () => exportEntries());
    }
    
    // Calendar navigation
    const prevMonth = document.getElementById('prev-month');
    const nextMonth = document.getElementById('next-month');
    
    if (prevMonth) {
        prevMonth.addEventListener('click', () => navigateCalendar(-1));
    }
    
    if (nextMonth) {
        nextMonth.addEventListener('click', () => navigateCalendar(1));
    }
    
    // Modal functionality for fallback
    const modal = document.getElementById('add-modal');
    const closeButton = document.getElementById('close-modal');
    const cancelButton = document.getElementById('cancel-modal');
    const saveButton = document.getElementById('save-entries');
    
    if (closeButton) {
        closeButton.addEventListener('click', () => closeModal());
    }
    
    if (cancelButton) {
        cancelButton.addEventListener('click', () => closeModal());
    }
    
    if (saveButton) {
        saveButton.addEventListener('click', () => saveEntries());
    }
    
    modal?.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
    
    // Edit modal event listeners
    const editModal = document.getElementById('edit-modal');
    const closeEditBtn = document.getElementById('close-edit-modal');
    const cancelEditBtn = document.getElementById('cancel-edit');
    const saveEditBtn = document.getElementById('save-edit');
    const addPresetBtn = document.getElementById('add-preset-btn');
    
    if (closeEditBtn) {
        closeEditBtn.addEventListener('click', closeEditModal);
    }
    
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', closeEditModal);
    }
    
    if (saveEditBtn) {
        saveEditBtn.addEventListener('click', saveEditChanges);
    }
    
    if (addPresetBtn) {
        addPresetBtn.addEventListener('click', addNewPreset);
    }
    
    editModal?.addEventListener('click', (e) => {
        if (e.target === editModal) {
            closeEditModal();
        }
    });
    
    // Apply to All modal event listeners
    const applyToAllModal = document.getElementById('apply-to-all-modal');
    const closeApplyToAllBtn = document.getElementById('close-apply-to-all-modal');
    const cancelApplyToAllBtn = document.getElementById('cancel-apply-to-all');
    const applyToAllBtn = document.getElementById('apply-to-all-btn');
    const clientCodeInput = document.getElementById('apply-client-code');
    const matterNumberInput = document.getElementById('apply-matter-number');
    
    if (closeApplyToAllBtn) {
        closeApplyToAllBtn.addEventListener('click', closeApplyToAllModal);
    }
    
    if (cancelApplyToAllBtn) {
        cancelApplyToAllBtn.addEventListener('click', closeApplyToAllModal);
    }
    
    if (applyToAllBtn) {
        applyToAllBtn.addEventListener('click', applyToAllNarratives);
    }
    
    // Add input listeners to show preview
    if (clientCodeInput) {
        clientCodeInput.addEventListener('input', updateApplyPreview);
    }
    
    if (matterNumberInput) {
        matterNumberInput.addEventListener('input', updateApplyPreview);
    }
    
    applyToAllModal?.addEventListener('click', (e) => {
        if (e.target === applyToAllModal) {
            closeApplyToAllModal();
        }
    });
    
    // Bulk assignment event listeners
    const bulkApplyClientBtn = document.getElementById('bulk-apply-client');
    const bulkApplyMatterBtn = document.getElementById('bulk-apply-matter');
    
    if (bulkApplyClientBtn) {
        bulkApplyClientBtn.addEventListener('click', bulkAssignClient);
    }
    
    if (bulkApplyMatterBtn) {
        bulkApplyMatterBtn.addEventListener('click', bulkAssignMatter);
    }
}

// View switching
function switchView(view) {
    currentView = view;
    
    // Update navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });
    
    // Update views
    document.querySelectorAll('.view').forEach(v => {
        v.classList.toggle('active', v.id === `${view}-view`);
    });
    
    // Load view data
    switch (view) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'calendar':
            loadCalendar();
            break;
        case 'export':
            loadExport();
            break;
    }
}

// View mode management - Streamlined
function toggleViewMode() {
    // Toggle between expanded and condensed
    viewMode = viewMode === 'expanded' ? 'condensed' : 'expanded';
    
    // Update the view toggle button icons
    const listIcon = document.getElementById('list-view-icon');
    const cardIcon = document.getElementById('card-view-icon');
    const viewToggleBtn = document.getElementById('view-toggle');
    
    if (listIcon && cardIcon) {
        if (viewMode === 'condensed') {
            // Show card icon when in condensed/list mode (button shows what we'll switch TO)
            listIcon.style.display = 'none';
            cardIcon.style.display = 'block';
        } else {
            // Show list icon when in expanded/card mode (button shows what we'll switch TO)
            listIcon.style.display = 'block';
            cardIcon.style.display = 'none';
        }
    }
    
    // Update tooltip
    if (viewToggleBtn) {
        viewToggleBtn.title = viewMode === 'condensed' ? 'Switch to card view' : 'Switch to list view';
    }
    
    // Update container classes
    const container = document.getElementById('entries-list');
    if (container) {
        if (viewMode === 'condensed') {
            container.className = 'entries-condensed';
        } else {
            container.className = 'entries-container';
        }
    }
    
    // Show/hide bulk assignment controls based on view mode
    if (viewMode === 'expanded') {
        showBulkAssignmentControls();
    } else {
        hideBulkAssignmentControls();
    }
    
    loadDashboard();
}

// Legacy function for compatibility
function setViewMode(mode) {
    viewMode = mode;
    
    // Update container classes
    const container = document.getElementById('entries-list');
    if (container) {
        if (mode === 'condensed') {
            container.className = 'entries-condensed';
        } else {
            container.className = 'entries-container';
        }
    }
    
    loadDashboard();
}

// Date picker functionality
function toggleDatePicker() {
    datePickerVisible = !datePickerVisible;
    const popover = document.getElementById('date-picker-popover');
    const btn = document.getElementById('date-picker-btn');
    
    if (popover) {
        popover.classList.toggle('hidden', !datePickerVisible);
    }
    if (btn) {
        btn.classList.toggle('active', datePickerVisible);
    }
}

function updateDateDisplay() {
    const display = document.getElementById('date-display');
    if (!display) return;
    
    if (customDateRange && (customDateRange.start || customDateRange.end)) {
        const start = customDateRange.start || 'Start';
        const end = customDateRange.end || 'End';
        display.textContent = `${start} to ${end}`;
    } else {
        const displayText = {
            'all': 'All Time',
            'today': 'Today',
            'week': 'This Week',
            'month': 'This Month'
        };
        display.textContent = displayText[quickTimeFilter] || 'All Time';
    }
}

function updateCustomDateRange() {
    const startInput = document.getElementById('custom-start');
    const endInput = document.getElementById('custom-end');
    
    if (startInput?.value || endInput?.value) {
        customDateRange = {
            start: startInput?.value || null,
            end: endInput?.value || null
        };
        
        // Clear quick filter selection when using custom dates
        quickTimeFilter = 'all';
        document.querySelectorAll('.quick-date-btn').forEach(b => b.classList.remove('active'));
        
        updateDateDisplay();
        loadDashboard();
    }
}

function toggleAdvancedFilters() {
    advancedFiltersVisible = !advancedFiltersVisible;
    const panel = document.getElementById('advanced-filters');
    const btn = document.getElementById('more-filters-btn');
    const btnMobile = document.getElementById('more-filters-btn-mobile');
    
    if (panel) {
        panel.classList.toggle('hidden', !advancedFiltersVisible);
    }
    
    updateActiveFiltersCount();
}

function updateActiveFiltersCount() {
    let activeCount = 0;
    
    // Count active filters
    const searchInput = document.getElementById('search');
    const statusFilterEl = document.getElementById('status-filter');
    
    if (searchInput && searchInput.value.trim()) activeCount++;
    if (statusFilter || (statusFilterEl && statusFilterEl.value)) activeCount++;
    if (clientFilter) activeCount++;
    if (matterFilter) activeCount++;
    if (hoursFilter) activeCount++;
    if (taskFilter) activeCount++;
    
    const countElement = document.getElementById('active-filters-count');
    if (countElement) {
        if (activeCount > 0) {
            countElement.textContent = activeCount;
            countElement.classList.remove('hidden');
        } else {
            countElement.classList.add('hidden');
        }
    }
}

function getQuickTimeRange(period) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (period) {
        case 'today':
            return {
                start: today,
                end: new Date(today.getTime() + 24 * 60 * 60 * 1000)
            };
        case 'week':
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - today.getDay());
            return {
                start: weekStart,
                end: new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)
            };
        case 'month':
            return {
                start: new Date(now.getFullYear(), now.getMonth(), 1),
                end: new Date(now.getFullYear(), now.getMonth() + 1, 0)
            };
        case 'all':
        default:
            return null;
    }
}

// Clear all filters
function clearAllFilters() {
    // Reset filter variables
    statusFilter = '';
    clientFilter = '';
    matterFilter = '';
    hoursFilter = '';
    taskFilter = '';
    quickTimeFilter = 'all';
    
    // Reset UI elements
    const searchInput = document.getElementById('search');
    const statusFilterEl = document.getElementById('status-filter');
    const clientFilterEl = document.getElementById('client-filter');
    const matterFilterEl = document.getElementById('matter-filter');
    const hoursFilterEl = document.getElementById('hours-filter');
    const taskFilterEl = document.getElementById('task-filter');
    
    if (searchInput) searchInput.value = '';
    if (statusFilterEl) statusFilterEl.value = '';
    if (clientFilterEl) clientFilterEl.value = '';
    if (matterFilterEl) matterFilterEl.value = '';
    if (hoursFilterEl) hoursFilterEl.value = '';
    if (taskFilterEl) taskFilterEl.value = '';
    
    // Reset dropdown button text
    const statusText = document.getElementById('status-filter-text');
    if (statusText) statusText.textContent = 'All';
    
    // Reset dropdown active state
    const statusDropdown = document.getElementById('status-dropdown');
    if (statusDropdown) {
        statusDropdown.querySelectorAll('.dropdown-item').forEach(item => {
            item.classList.remove('active');
        });
        const allStatusItem = statusDropdown.querySelector('[data-status=""]');
        if (allStatusItem) allStatusItem.classList.add('active');
    }
    
    // Reset time filter buttons (only in condensed view)
    if (viewMode === 'condensed') {
        document.querySelectorAll('.time-filter-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.filter === 'all') {
                btn.classList.add('active');
            }
        });
    }
    
    // Update display and reload
    updateActiveFiltersCount();
    loadDashboard();
}

// Date filter helpers
function getDateRange(filter) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (filter) {
        case 'today':
            return {
                start: today,
                end: new Date(today.getTime() + 24 * 60 * 60 * 1000)
            };
        case 'week':
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - today.getDay());
            return {
                start: weekStart,
                end: new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)
            };
        case 'month':
            return {
                start: new Date(now.getFullYear(), now.getMonth(), 1),
                end: new Date(now.getFullYear(), now.getMonth() + 1, 0)
            };
        case 'last7':
            return {
                start: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000),
                end: new Date(today.getTime() + 24 * 60 * 60 * 1000)
            };
        case 'last30':
            return {
                start: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000),
                end: new Date(today.getTime() + 24 * 60 * 60 * 1000)
            };
        case 'custom':
            if (customDateRange) {
                return {
                    start: new Date(customDateRange.start),
                    end: new Date(customDateRange.end + 'T23:59:59.999Z')
                };
            }
            return null;
        default:
            return null;
    }
}

function updateDateRangeDisplay() {
    const display = document.getElementById('date-range-display');
    if (!display) return;
    
    const filterText = {
        '': 'All Time',
        'today': 'Today',
        'week': 'This Week',
        'month': 'This Month',
        'last7': 'Last 7 Days',
        'last30': 'Last 30 Days',
        'custom': customDateRange 
            ? `${customDateRange.start} to ${customDateRange.end}`
            : 'Custom Range'
    };
    
    display.textContent = filterText[dateFilter] || 'All Time';
}


// Dashboard functionality - Streamlined
async function loadDashboard() {
    try {
        // Get search and status from streamlined inputs
        const search = document.getElementById('search')?.value || '';
        const status = statusFilter || document.getElementById('status-filter')?.value || '';
        
        // Get entries from IndexedDB
        let entries = await dbOperations.getEntries({ search, status });
        
        // Apply client filter
        if (clientFilter) {
            entries = entries.filter(entry => entry.client_code === clientFilter);
        }
        
        // Apply matter filter
        if (matterFilter) {
            entries = entries.filter(entry => 
                entry.matter_number === matterFilter ||
                (entry.narratives && entry.narratives.some(n => n.matter_number === matterFilter))
            );
        }
        
        // Apply hours filter
        if (hoursFilter) {
            entries = entries.filter(entry => {
                const hours = entry.total_hours || 0;
                switch (hoursFilter) {
                    case '0.5-1':
                        return hours >= 0.5 && hours <= 1.0;
                    case '1-2':
                        return hours >= 1.0 && hours <= 2.0;
                    case '2-5':
                        return hours >= 2.0 && hours <= 5.0;
                    case '5+':
                        return hours >= 5.0;
                    default:
                        return true;
                }
            });
        }
        
        // Apply task filter
        if (taskFilter) {
            const taskLower = taskFilter.toLowerCase();
            entries = entries.filter(entry => 
                entry.narratives && entry.narratives.some(n => 
                    n.task_code && n.task_code.toLowerCase().includes(taskLower)
                )
            );
        }
        
        // Apply quick time filter
        if (quickTimeFilter && quickTimeFilter !== 'all') {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            
            let filterDate;
            switch (quickTimeFilter) {
                case 'today':
                    filterDate = today;
                    entries = entries.filter(entry => {
                        const entryDate = new Date(entry.created_at);
                        const entryday = new Date(entryDate.getFullYear(), entryDate.getMonth(), entryDate.getDate());
                        return entryday.getTime() === filterDate.getTime();
                    });
                    break;
                case 'week':
                    const weekStart = new Date(today);
                    weekStart.setDate(today.getDate() - today.getDay());
                    const weekEnd = new Date(weekStart);
                    weekEnd.setDate(weekStart.getDate() + 6);
                    entries = entries.filter(entry => {
                        const entryDate = new Date(entry.created_at);
                        return entryDate >= weekStart && entryDate <= weekEnd;
                    });
                    break;
                case 'month':
                    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                    entries = entries.filter(entry => {
                        const entryDate = new Date(entry.created_at);
                        return entryDate >= monthStart && entryDate <= monthEnd;
                    });
                    break;
            }
        }
        
        currentEntries = entries;
        
        // Update stats
        updateDashboardStats(entries);
        
        // Update filter options
        updateClientFilter(entries);
        updateMatterFilter(entries);
        
        const container = document.getElementById('entries-list');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (entries.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No entries found. Click "Add New Time Entry" to get started.</p>
                </div>
            `;
            return;
        }
        
        // Render based on view mode
        if (viewMode === 'condensed') {
            renderCondensedView(entries, container);
        } else {
            // Entries are now naturally grouped by session in the backend
            entries.forEach(entry => {
                const card = createEntryCard(entry);
                container.appendChild(card);
            });
        }
        
    } catch (err) {
        console.error('Error loading dashboard:', err);
        showNotification('Failed to load entries', 'error');
    }
}

function updateDashboardStats(entries) {
    const totalEntries = document.getElementById('total-entries');
    const totalHours = document.getElementById('total-hours');
    
    if (totalEntries) {
        totalEntries.textContent = entries.length;
    }
    
    if (totalHours) {
        const hours = entries.reduce((sum, entry) => sum + (entry.total_hours || 0), 0);
        totalHours.textContent = hours.toFixed(1);
    }
}

function updateClientFilter(entries) {
    const clientFilterEl = document.getElementById('client-filter');
    if (!clientFilterEl) return;
    
    // Get unique clients
    const clients = [...new Set(entries.map(e => e.client_code).filter(Boolean))];
    
    // Preserve current selection
    const currentValue = clientFilterEl.value;
    
    // Update options
    clientFilterEl.innerHTML = '<option value="">All Clients</option>';
    clients.sort().forEach(client => {
        const option = document.createElement('option');
        option.value = client;
        option.textContent = client;
        clientFilterEl.appendChild(option);
    });
    
    // Restore selection
    clientFilterEl.value = currentValue;
}

function updateMatterFilter(entries) {
    const matterFilterEl = document.getElementById('matter-filter');
    if (!matterFilterEl) return;
    
    // Get unique matter numbers from both entry level and narrative level
    const matters = new Set();
    entries.forEach(entry => {
        if (entry.matter_number) {
            matters.add(entry.matter_number);
        }
        if (entry.narratives) {
            entry.narratives.forEach(narrative => {
                if (narrative.matter_number) {
                    matters.add(narrative.matter_number);
                }
            });
        }
    });
    
    // Preserve current selection
    const currentValue = matterFilterEl.value;
    
    // Update options
    matterFilterEl.innerHTML = '<option value="">All Matters</option>';
    [...matters].sort().forEach(matter => {
        const option = document.createElement('option');
        option.value = matter;
        option.textContent = matter;
        matterFilterEl.appendChild(option);
    });
    
    // Restore selection
    matterFilterEl.value = currentValue;
}


function createEntryCard(entry) {
    const card = document.createElement('div');
    card.className = 'entry-card';
    card.dataset.entryId = entry.id;
    
    // Add bulk selection checkbox
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'bulk-checkbox';
    checkbox.dataset.entryId = entry.id;
    checkbox.addEventListener('change', updateBulkSelection);
    card.appendChild(checkbox);
    
    const totalHours = entry.total_hours || 0;
    const date = new Date(entry.created_at);
    const dateStr = date.toLocaleDateString();
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const narrativesHtml = (entry.narratives || []).map((n, index) => {
        const isEnhanced = n.metadata && n.metadata.enhanced;
        return `
        <div class="narrative-item ${n.status === 'exported' ? 'narrative-exported' : 'narrative-draft'} ${isEnhanced ? 'enhanced' : ''}" data-narrative-index="${index}">
            <button class="context-mic-btn" onclick="openContextRecordingModal(${entry.id}, ${index})" title="Add context to this narrative">
                <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                    <path d="M12,2A3,3 0 0,1 15,5V11A3,3 0 0,1 12,14A3,3 0 0,1 9,11V5A3,3 0 0,1 12,2M19,11C19,14.53 16.39,17.44 13,17.93V21H11V17.93C7.61,17.44 5,14.53 5,11H7A5,5 0 0,0 12,16A5,5 0 0,0 17,11H19Z"/>
                </svg>
            </button>
            <div class="narrative-header">
                <span class="editable-field editable-hours" data-field="hours" data-entry-id="${entry.id}" data-narrative-index="${index}">
                    ${n.hours} hours
                    <svg class="edit-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z"/>
                    </svg>
                </span>
            </div>
            <div class="narrative-text editable-field editable-narrative" data-field="text" data-entry-id="${entry.id}" data-narrative-index="${index}">
                ${n.text}
                <svg class="edit-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z"/>
                </svg>
            </div>
            <div class="narrative-meta">
                <div class="narrative-client editable-field editable-client" data-field="client_code" data-entry-id="${entry.id}" data-narrative-index="${index}">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
                        <path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z"/>
                    </svg>
                    ${n.client_code || entry.client_code || 'No Client'}
                    <svg class="edit-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z"/>
                    </svg>
                </div>
                <div class="narrative-matter editable-field editable-matter" data-field="matter_number" data-entry-id="${entry.id}" data-narrative-index="${index}">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
                        <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                    </svg>
                    ${n.matter_number || entry.matter_number || 'No Matter'}
                    <svg class="edit-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z"/>
                    </svg>
                </div>
            </div>
        </div>
    `;}).join('');
    
    // Add click handler for compact and ultra-compact mode expansion
    if (viewMode === 'compact' || viewMode === 'ultra-compact') {
        card.addEventListener('click', (e) => {
            if (!e.target.matches('button')) {
                card.classList.toggle('expanded');
            }
        });
    }
    
    // Create different layouts based on view mode
    if (viewMode === 'ultra-compact') {
        // Ultra-compact layout: single line with essential info
        const firstNarrative = (entry.narratives && entry.narratives.length > 0) ? entry.narratives[0].text : 'No description';
        const truncatedText = firstNarrative.length > 200 ? firstNarrative.substring(0, 200) + '...' : firstNarrative;
        
        card.innerHTML = `
            <div class="entry-header">
                <div class="entry-meta">
                    <span class="entry-meta-item">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
                            <path d="M19,3H18V1H16V3H8V1H6V3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5A2,2 0 0,0 19,3M19,19H5V8H19V19M5,6V5H19V6H5Z"/>
                        </svg>
                        ${dateStr}
                    </span>
                    <span class="entry-meta-item">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
                            <path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z"/>
                        </svg>
                        ${entry.client_code || 'No Client'}
                    </span>
                    <span class="entry-meta-item">
                        <strong>${totalHours}h</strong>
                    </span>
                    <span class="entry-description">${truncatedText}</span>
                </div>
                ${createStatusDropdown(entry.id, entry.status || 'draft', entry)}
            </div>
            <div class="narrative-item expanded-content hidden">
                ${narrativesHtml}
            </div>
            <div class="entry-actions">
                <button class="edit-btn" onclick="openEditModal(${entry.id})">Edit</button>
                <button class="delete-btn" onclick="deleteEntry(${entry.id})">Delete</button>
                <button class="duplicate-btn" onclick="duplicateEntry(${entry.id})">Duplicate</button>
                ${(entry.narratives && entry.narratives.length > 1) ? 
                    `<button class="apply-to-all-btn" onclick="openApplyToAllModal(${entry.id})">Apply to All</button>` : 
                    ''
                }
            </div>
        `;
    } else {
        // Standard and compact layouts
        card.innerHTML = `
            <div class="entry-header">
                <div class="entry-meta">
                    <span class="entry-meta-item">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                            <path d="M19,3H18V1H16V3H8V1H6V3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5A2,2 0 0,0 19,3M19,19H5V8H19V19M5,6V5H19V6H5Z"/>
                        </svg>
                        <span class="editable-field editable-date" data-field="created_at" data-entry-id="${entry.id}">
                            ${dateStr} ${timeStr}
                            <svg class="edit-icon" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z"/>
                            </svg>
                        </span>
                    </span>
                    <span class="entry-meta-item">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                            <path d="M12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22C6.47,22 2,17.5 2,12A10,10 0 0,1 12,2M12.5,7V12.25L17,14.92L16.25,16.15L11,13V7H12.5Z"/>
                        </svg>
                        <span class="total-hours-display">
                            ${totalHours} hours
                        </span>
                    </span>
                </div>
                ${createStatusDropdown(entry.id, entry.status || 'draft', entry)}
            </div>
            ${narrativesHtml}
            <div class="entry-actions">
                <button class="edit-btn" onclick="openEditModal(${entry.id})">Edit</button>
                <button class="delete-btn" onclick="deleteEntry(${entry.id})">Delete</button>
                <button class="duplicate-btn" onclick="duplicateEntry(${entry.id})">Duplicate</button>
                ${(entry.narratives && entry.narratives.length > 1) ? 
                    `<button class="apply-to-all-btn" onclick="openApplyToAllModal(${entry.id})">Apply to All</button>` : 
                    ''
                }
            </div>
        `;
    }
    
    // Add inline editing event listeners
    setupInlineEditing(card);
    
    return card;
}

// Inline editing functionality
function setupInlineEditing(card) {
    const editableFields = card.querySelectorAll('.editable-field');
    
    editableFields.forEach(field => {
        field.addEventListener('click', (e) => {
            e.stopPropagation();
            startInlineEdit(field);
        });
    });
}

async function startInlineEdit(field) {
    if (field.classList.contains('editing')) return;
    
    const entryId = field.dataset.entryId;
    const fieldType = field.dataset.field;
    const narrativeIndex = field.dataset.narrativeIndex;
    
    // Get current value
    let currentValue = '';
    if (fieldType === 'hours') {
        currentValue = field.textContent.replace(' hours', '').trim();
    } else if (fieldType === 'total_hours') {
        // Total hours should not be editable - it's calculated from narratives
        return;
    } else if (fieldType === 'text') {
        currentValue = field.textContent.trim();
    } else if (fieldType === 'created_at') {
        // For date, we need to get the ISO string from the entry data
        try {
            const entry = await dbOperations.getEntry(parseInt(entryId));
            if (entry && entry.created_at) {
                const date = new Date(entry.created_at);
                // Convert to datetime-local format (YYYY-MM-DDTHH:mm)
                currentValue = date.toISOString().slice(0, 16);
            }
        } catch (error) {
            console.error('Failed to get entry data for date editing:', error);
            return;
        }
    } else if (fieldType === 'client_code') {
        // Extract text content excluding the SVG
        const textNode = Array.from(field.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
        currentValue = textNode ? textNode.textContent.trim() : field.textContent.trim();
    } else if (fieldType === 'matter_number') {
        // Extract text content excluding the SVG
        const textNode = Array.from(field.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
        currentValue = textNode ? textNode.textContent.trim() : field.textContent.trim();
    }
    
    // Mark as editing
    field.classList.add('editing');
    
    // Create input element
    let inputElement;
    if (fieldType === 'text') {
        inputElement = document.createElement('textarea');
        inputElement.className = 'inline-textarea';
        inputElement.value = currentValue;
    } else {
        inputElement = document.createElement('input');
        inputElement.className = 'inline-input';
        
        if (fieldType === 'hours' || fieldType === 'total_hours') {
            inputElement.type = 'number';
            inputElement.step = '0.1';
            inputElement.min = '0';
        } else if (fieldType === 'created_at') {
            inputElement.type = 'datetime-local';
        } else {
            inputElement.type = 'text';
        }
        
        inputElement.value = currentValue;
    }
    
    // Create action buttons
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'inline-actions';
    
    const saveBtn = document.createElement('button');
    saveBtn.className = 'inline-save-btn';
    saveBtn.textContent = 'Save';
    saveBtn.onclick = (e) => {
        e.stopPropagation();
        saveInlineEdit(field, inputElement, entryId, fieldType, narrativeIndex);
    };
    
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'inline-cancel-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = (e) => {
        e.stopPropagation();
        cancelInlineEdit(field);
    };
    
    actionsDiv.appendChild(saveBtn);
    actionsDiv.appendChild(cancelBtn);
    
    // Replace content
    field.innerHTML = '';
    field.appendChild(inputElement);
    field.appendChild(actionsDiv);
    
    // Focus input
    inputElement.focus();
    if (inputElement.select) inputElement.select();
    
    // Handle escape key
    inputElement.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            e.stopPropagation();
            cancelInlineEdit(field);
        } else if (e.key === 'Enter' && !e.shiftKey && inputElement.type !== 'textarea') {
            e.preventDefault();
            e.stopPropagation();
            saveInlineEdit(field, inputElement, entryId, fieldType, narrativeIndex);
        }
    });
}

async function saveInlineEdit(field, inputElement, entryId, fieldType, narrativeIndex) {
    const newValue = inputElement.value.trim();
    
    try {
        // Get current entry data
        const entry = await dbOperations.getEntry(parseInt(entryId));
        if (!entry) {
            throw new Error('Entry not found');
        }
        
        // Check if the value actually changed
        let currentValue = '';
        if (fieldType === 'total_hours') {
            currentValue = entry.total_hours?.toString() || '0';
        } else if (fieldType === 'created_at') {
            const date = new Date(entry.created_at);
            currentValue = date.toISOString().slice(0, 16);
        } else if (narrativeIndex !== undefined && entry.narratives && entry.narratives[narrativeIndex]) {
            const narrative = entry.narratives[narrativeIndex];
            if (fieldType === 'hours') {
                currentValue = narrative.hours?.toString() || '0';
            } else if (fieldType === 'text') {
                currentValue = narrative.text || '';
            } else if (fieldType === 'client_code') {
                currentValue = narrative.client_code || entry.client_code || '';
            } else if (fieldType === 'matter_number') {
                currentValue = narrative.matter_number || entry.matter_number || '';
            }
        }
        
        // If no change, just cancel editing without showing error
        if (newValue === currentValue) {
            updateFieldDisplay(field, fieldType, newValue);
            field.classList.remove('editing');
            return;
        }
        
        // Prepare updates object
        let updates = {};
        
        if (fieldType === 'total_hours') {
            updates.total_hours = parseFloat(newValue) || 0;
        } else if (fieldType === 'created_at') {
            updates.created_at = new Date(newValue).toISOString();
        } else if (narrativeIndex !== undefined) {
            // For narrative fields, we need to update the entire narratives array
            if (!entry.narratives) entry.narratives = [];
            if (!entry.narratives[narrativeIndex]) entry.narratives[narrativeIndex] = {};
            
            if (fieldType === 'hours') {
                entry.narratives[narrativeIndex].hours = parseFloat(newValue) || 0;
            } else if (fieldType === 'text') {
                entry.narratives[narrativeIndex].text = newValue;
            } else if (fieldType === 'client_code') {
                entry.narratives[narrativeIndex].client_code = newValue;
            } else if (fieldType === 'matter_number') {
                entry.narratives[narrativeIndex].matter_number = newValue;
            }
            
            updates.narratives = entry.narratives;
        }
        
        // Save to database
        await dbOperations.updateEntry(parseInt(entryId), updates);
        
        // Update display
        updateFieldDisplay(field, fieldType, newValue);
        
        // Remove editing state
        field.classList.remove('editing');
        
        // Sync with server
        try {
            if (window.syncManager && typeof syncManager.syncWithServer === 'function') {
                syncManager.syncWithServer();
            }
        } catch (syncError) {
            console.warn('Sync failed, but changes were saved locally:', syncError);
        }
        
    } catch (error) {
        console.error('Failed to save inline edit:', error);
        cancelInlineEdit(field);
        // Show specific error message
        if (error.message === 'Entry not found') {
            alert('Entry not found. The entry may have been deleted. Please refresh the page.');
        } else {
            alert(`Failed to save changes: ${error.message}. Please try again.`);
        }
    }
}

function cancelInlineEdit(field) {
    field.classList.remove('editing');
    // Trigger a reload of the dashboard to restore original content
    loadDashboard();
}

function updateFieldDisplay(field, fieldType, newValue) {
    // Restore the original structure with the new value
    if (fieldType === 'created_at') {
        // Format the date for display
        const date = new Date(newValue);
        const dateStr = date.toLocaleDateString();
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        field.innerHTML = `
            ${dateStr} ${timeStr}
            <svg class="edit-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z"/>
            </svg>
        `;
    } else if (fieldType === 'hours') {
        field.innerHTML = `
            ${newValue} hours
            <svg class="edit-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z"/>
            </svg>
        `;
    } else if (fieldType === 'total_hours') {
        field.innerHTML = `
            ${newValue} hours
            <svg class="edit-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z"/>
            </svg>
        `;
    } else if (fieldType === 'text') {
        field.innerHTML = `
            ${newValue}
            <svg class="edit-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z"/>
            </svg>
        `;
    } else if (fieldType === 'client_code') {
        field.innerHTML = `
            <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
                <path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z"/>
            </svg>
            ${newValue}
            <svg class="edit-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z"/>
            </svg>
        `;
    } else if (fieldType === 'matter_number') {
        field.innerHTML = `
            <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
                <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
            </svg>
            ${newValue}
            <svg class="edit-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z"/>
            </svg>
        `;
    }
    
    // Re-setup inline editing for this field
    setupInlineEditingForField(field);
}

function setupInlineEditingForField(field) {
    field.addEventListener('click', (e) => {
        e.stopPropagation();
        startInlineEdit(field);
    });
}

// Condensed table view rendering
function renderCondensedView(entries, container) {
    // Add time filter bar above table
    const timeFilterBar = document.createElement('div');
    timeFilterBar.className = 'time-filter-bar';
    timeFilterBar.innerHTML = `
        <div class="time-filter-container">
            <span class="time-filter-label">Time Period:</span>
            <div class="time-filter-buttons">
                <button class="time-filter-btn" data-filter="today">Today</button>
                <button class="time-filter-btn" data-filter="week">This Week</button>
                <button class="time-filter-btn" data-filter="month">This Month</button>
                <button class="time-filter-btn active" data-filter="all">All</button>
            </div>
        </div>
    `;
    
    // Add time filter event listeners
    timeFilterBar.querySelectorAll('.time-filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Remove active class from all buttons
            timeFilterBar.querySelectorAll('.time-filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            // Update filter and reload
            quickTimeFilter = e.target.dataset.filter;
            loadDashboard();
        });
    });
    
    const tableWrapper = document.createElement('div');
    tableWrapper.className = 'condensed-table-wrapper';
    
    const table = document.createElement('table');
    table.className = 'condensed-table';
    table.innerHTML = `
        <thead>
            <tr>
                <th class="condensed-date">Date</th>
                <th class="condensed-client">Client</th>
                <th class="condensed-matter">Matter</th>
                <th class="condensed-time">Time</th>
                <th class="condensed-description">Description</th>
                <th class="condensed-actions actions-column">Actions</th>
                <th class="condensed-status">Status</th>
            </tr>
        </thead>
        <tbody></tbody>
    `;
    
    const tbody = table.querySelector('tbody');
    
    // Create flat list of all narratives with their entries
    const flatRows = [];
    entries.forEach(entry => {
        if (entry.narratives && entry.narratives.length > 0) {
            entry.narratives.forEach((narrative, index) => {
                flatRows.push({
                    entry: entry,
                    narrative: narrative,
                    narrativeIndex: index
                });
            });
        } else {
            // Fallback for entries without narratives
            flatRows.push({
                entry: entry,
                narrative: null,
                narrativeIndex: null
            });
        }
    });
    
    // Sort by date (newest first)
    flatRows.sort((a, b) => new Date(b.entry.created_at) - new Date(a.entry.created_at));
    
    // Group by day for separators
    let lastDate = null;
    const today = new Date();
    const todayStr = today.toLocaleDateString('en-US', { 
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    flatRows.forEach(row => {
        const entryDate = new Date(row.entry.created_at);
        const dateStr = entryDate.toLocaleDateString('en-US', { 
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        // Add day separator if date changed and it's not today
        if (lastDate !== dateStr && dateStr !== todayStr) {
            const separator = createDaySeparator(dateStr);
            tbody.appendChild(separator);
            lastDate = dateStr;
        }
        
        // Create and add the row
        const tableRow = createCondensedRow(row.entry, row.narrative, row.narrativeIndex);
        tbody.appendChild(tableRow);
    });
    
    container.appendChild(timeFilterBar);
    tableWrapper.appendChild(table);
    container.appendChild(tableWrapper);
}

// Legacy table view rendering
function renderTableView(entries, container) {
    const table = document.createElement('table');
    table.innerHTML = `
        <thead>
            <tr>
                <th>Date/Time</th>
                <th>Client</th>
                <th>Narratives</th>
                <th style="text-align: right">Hours</th>
                <th>Status</th>
                <th>Actions</th>
            </tr>
        </thead>
        <tbody></tbody>
    `;
    
    const tbody = table.querySelector('tbody');
    
    entries.forEach(entry => {
        const row = createTableRow(entry);
        tbody.appendChild(row);
    });
    
    container.appendChild(table);
}

// Create a single row for condensed view
function createCondensedRow(entry, narrative, narrativeIndex) {
    const row = document.createElement('tr');
    row.className = 'condensed-row';
    row.dataset.entryId = entry.id;
    if (narrativeIndex !== null) {
        row.dataset.narrativeIndex = narrativeIndex;
    }
    
    const date = new Date(entry.created_at);
    const isMobile = window.innerWidth <= 768;
    const dateStr = isMobile 
        ? date.toLocaleDateString('en-US', { 
            month: 'numeric', 
            day: 'numeric' 
          })
        : date.toLocaleDateString('en-US', { 
            month: '2-digit', 
            day: '2-digit', 
            year: '2-digit' 
          });
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Use narrative data if available, otherwise entry data
    const clientCode = narrative?.client_code || entry.client_code || 'No Client';
    const matterNumber = narrative?.matter_number || entry.matter_number || '';
    const hours = narrative ? narrative.hours : (entry.total_hours || 0);
    const description = narrative ? narrative.text : (entry.original_text || 'No description');
    const status = entry.status || 'draft';
    
    // Truncate description for display
    const maxDescLength = isMobile ? 100 : 150;
    const displayDesc = description.length > maxDescLength ? 
        description.substring(0, maxDescLength) + '...' : description;
    
    // Same structure for mobile and desktop, just smaller on mobile
    row.innerHTML = `
        <td class="condensed-date">
            <div class="date-time">
                <span class="date-main">${dateStr}</span>
                <div class="time-subtext">${timeStr}</div>
            </div>
        </td>
        <td class="condensed-client">
            <span class="editable-field client-field" 
                  data-field="client_code" 
                  data-entry-id="${entry.id}"
                  ${narrativeIndex !== null ? `data-narrative-index="${narrativeIndex}"` : ''}>
                ${clientCode}
            </span>
        </td>
        <td class="condensed-matter">
            <span class="editable-field matter-field" 
                  data-field="matter_number" 
                  data-entry-id="${entry.id}"
                  ${narrativeIndex !== null ? `data-narrative-index="${narrativeIndex}"` : ''}>
                ${matterNumber || '-'}
            </span>
        </td>
        <td class="condensed-time">
            <span class="editable-field hours-field" 
                  data-field="${narrative ? 'hours' : 'total_hours'}" 
                  data-entry-id="${entry.id}"
                  ${narrativeIndex !== null ? `data-narrative-index="${narrativeIndex}"` : ''}>
                ${hours}
            </span>
        </td>
        <td class="condensed-description">
            <div class="description-content ${description.length > maxDescLength ? 'has-more' : ''}">
                <span class="editable-field description-text" 
                      data-field="text" 
                      data-entry-id="${entry.id}"
                      ${narrativeIndex !== null ? `data-narrative-index="${narrativeIndex}"` : ''}
                      title="${description}">
                    ${displayDesc}
                </span>
                ${!isMobile && description.length > maxDescLength ? `
                    <button class="show-more-btn" onclick="toggleDescription(this)">more</button>
                ` : ''}
            </div>
        </td>
        <td class="condensed-actions">
            <div class="table-actions">
                <button class="table-action-btn edit-btn" onclick="openEditModal(${entry.id})" title="Edit">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                        <path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z"/>
                    </svg>
                </button>
                <button class="table-action-btn duplicate-btn" onclick="duplicateEntry(${entry.id})" title="Duplicate">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                        <path d="M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z"/>
                    </svg>
                </button>
                <button class="table-action-btn delete-btn" onclick="deleteEntry(${entry.id})" title="Delete">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                        <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/>
                    </svg>
                </button>
            </div>
            <div class="mobile-action-menu">
                <button onclick="toggleMobileMenu(this, ${entry.id})" title="Actions">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12,16A2,2 0 0,1 14,18A2,2 0 0,1 12,20A2,2 0 0,1 10,18A2,2 0 0,1 12,16M12,10A2,2 0 0,1 14,12A2,2 0 0,1 12,14A2,2 0 0,1 10,12A2,2 0 0,1 12,10M12,4A2,2 0 0,1 14,6A2,2 0 0,1 12,8A2,2 0 0,1 10,6A2,2 0 0,1 12,4Z"/>
                    </svg>
                </button>
            </div>
        </td>
        <td class="condensed-status">
            ${createStatusDropdown(entry.id, status, entry)}
        </td>
    `;
    
    // Setup inline editing (desktop only)
    if (!isMobile) {
        setupInlineEditing(row);
    }
    
    return row;
}

// Create mobile expanded row
function createMobileExpandedRow(entry, narrative, narrativeIndex) {
    const row = document.createElement('tr');
    row.className = 'mobile-expanded-row';
    
    const clientCode = narrative?.client_code || entry.client_code || 'No Client';
    const matterNumber = narrative?.matter_number || entry.matter_number || '';
    const status = entry.status || 'draft';
    
    row.innerHTML = `
        <td colspan="7">
            <div class="mobile-details">
                <div class="mobile-detail">
                    <span class="mobile-detail-label">CLIENT</span>
                    <span class="mobile-detail-value">${clientCode}</span>
                </div>
                <div class="mobile-detail">
                    <span class="mobile-detail-label">MATTER</span>
                    <span class="mobile-detail-value">${matterNumber || '-'}</span>
                </div>
                <div class="mobile-detail">
                    <span class="mobile-detail-label">STATUS</span>
                    <span class="mobile-detail-value">${status.toUpperCase()}</span>
                </div>
                <div class="mobile-detail">
                    <span class="mobile-detail-label">FULL DESCRIPTION</span>
                    <span class="mobile-detail-value">${narrative ? narrative.text : (entry.original_text || 'No description')}</span>
                </div>
            </div>
        </td>
    `;
    
    return row;
}

// Create day separator row
function createDaySeparator(dateStr) {
    const row = document.createElement('tr');
    row.className = 'day-separator';
    row.innerHTML = `
        <td colspan="7">
            <div class="day-separator-content">
                <span class="day-separator-text">${dateStr}</span>
            </div>
        </td>
    `;
    return row;
}

function createTableRow(entry) {
    const row = document.createElement('tr');
    
    const date = new Date(entry.created_at);
    const dateStr = date.toLocaleDateString();
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const narrativesHtml = (entry.narratives || []).map(n => `
        <div class="table-narrative-item">
            <span class="table-narrative-hours">${n.hours}h:</span>
            ${n.text}
        </div>
    `).join('');
    
    row.innerHTML = `
        <td class="table-date">${dateStr}<br><small>${timeStr}</small></td>
        <td>${entry.client_code || '-'}</td>
        <td class="table-narrative">${narrativesHtml}</td>
        <td class="table-hours">${entry.total_hours || 0}</td>
        <td><span class="entry-status status-${entry.status || 'draft'}">${entry.status || 'draft'}</span></td>
        <td class="table-actions">
            <button class="table-action-btn" onclick="openEditModal(${entry.id})">Edit</button>
            <button class="table-action-btn" onclick="deleteEntry(${entry.id})">Delete</button>
        </td>
    `;
    
    return row;
}

// Calendar functionality
let currentCalendarDate = new Date();

function loadCalendar() {
    const calendar = document.getElementById('calendar');
    const monthHeader = document.getElementById('calendar-month');
    
    if (!calendar || !monthHeader) return;
    
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    monthHeader.textContent = new Date(year, month).toLocaleDateString('en-US', { 
        month: 'long', 
        year: 'numeric' 
    });
    
    // Build calendar
    calendar.innerHTML = '';
    
    // Day headers
    const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayHeaders.forEach(day => {
        const header = document.createElement('div');
        header.className = 'calendar-day-header';
        header.textContent = day;
        calendar.appendChild(header);
    });
    
    // Get first day of month and number of days
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    
    // Add empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'calendar-day other-month';
        calendar.appendChild(emptyDay);
    }
    
    // Add days of month
    for (let day = 1; day <= daysInMonth; day++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day';
        
        const currentDate = new Date(year, month, day);
        if (currentDate.toDateString() === today.toDateString()) {
            dayCell.classList.add('today');
        }
        
        dayCell.innerHTML = `<div class="calendar-day-number">${day}</div>`;
        
        // Add entries for this day
        const dayEntries = currentEntries.filter(entry => {
            const entryDate = new Date(entry.created_at);
            return entryDate.getDate() === day && 
                   entryDate.getMonth() === month && 
                   entryDate.getFullYear() === year;
        });
        
        dayEntries.forEach(entry => {
            const entryEl = document.createElement('div');
            entryEl.className = 'calendar-entry';
            entryEl.textContent = `${entry.total_hours}h - ${entry.client_code || 'No Client'}`;
            entryEl.onclick = () => editEntry(entry.id);
            dayCell.appendChild(entryEl);
        });
        
        calendar.appendChild(dayCell);
    }
}

function navigateCalendar(direction) {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + direction);
    loadCalendar();
}

// Export functionality
function loadExport() {
    // Set default dates
    const today = new Date();
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    document.getElementById('export-start').valueAsDate = firstOfMonth;
    document.getElementById('export-end').valueAsDate = today;
    
    updateExportPreview();
}

async function updateExportPreview() {
    const startDate = document.getElementById('export-start').value;
    const endDate = document.getElementById('export-end').value;
    const clientCode = document.getElementById('export-client').value;
    
    const filters = {};
    if (startDate) filters.start_date = startDate;
    if (endDate) filters.end_date = endDate;
    if (clientCode) filters.client_code = clientCode;
    
    const entries = await dbOperations.getEntries(filters);
    
    const preview = document.getElementById('export-preview');
    preview.innerHTML = `
        <h3>Preview: ${entries.length} entries found</h3>
        <p>Total hours: ${entries.reduce((sum, e) => sum + (e.total_hours || 0), 0).toFixed(1)}</p>
    `;
}

async function exportEntries() {
    try {
        showLoading('Exporting entries...');
        
        const startDate = document.getElementById('export-start').value;
        const endDate = document.getElementById('export-end').value;
        const clientCode = document.getElementById('export-client').value;
        
        const filters = {};
        if (startDate) filters.start_date = startDate;
        if (endDate) filters.end_date = endDate;
        if (clientCode) filters.client_code = clientCode;
        
        const entries = await dbOperations.getEntries(filters);
        const entryIds = entries.map(e => e.id);
        
        await api.exportEntries(entryIds);
        
        // Update status of exported entries to 'exported'
        for (const entry of entries) {
            // Update all narratives to exported status
            if (entry.narratives) {
                entry.narratives.forEach(narrative => {
                    narrative.status = 'exported';
                });
            }
            
            // Update the entry with exported status
            await dbOperations.updateEntry(entry.id, {
                status: 'exported',
                narratives: entry.narratives
            });
        }
        
        hideLoading();
        showNotification('Export completed successfully', 'success');
        
        // Refresh the current view to show updated statuses
        if (currentView === 'dashboard') {
            await loadDashboard();
        } else if (currentView === 'export') {
            updateExportPreview();
        }
        
    } catch (err) {
        console.error('Export failed:', err);
        hideLoading();
        showNotification('Export failed', 'error');
    }
}

// Modal functions
function openModal() {
    const modal = document.getElementById('add-modal');
    modal.classList.add('active');
    resetModal();
}

function closeModal() {
    const modal = document.getElementById('add-modal');
    modal.classList.remove('active');
    resetModal();
}

function resetModal() {
    // Reset recording UI
    resetRecordingUI();
    
    // Clear fields
    document.getElementById('transcription').classList.add('hidden');
    document.getElementById('enhanced-results').classList.add('hidden');
    document.getElementById('save-entries').classList.add('hidden');
    document.getElementById('client-code').value = '';
    document.getElementById('matter-number').value = '';
    
    currentEntry = null;
}

async function saveEntries() {
    try {
        const resultsContainer = document.getElementById('enhanced-results');
        const result = JSON.parse(resultsContainer.dataset.result || '{}');
        
        // Collect metadata for each entry
        const entryMetadata = [];
        document.querySelectorAll('.entry-card').forEach((card, index) => {
            const clientCode = card.querySelector('.entry-client-code').value;
            const matterNumber = card.querySelector('.entry-matter-number').value;
            entryMetadata.push({ clientCode, matterNumber });
        });
        
        if (currentEntry) {
            // Update existing entry
            await dbOperations.updateEntry(currentEntry.id, {
                client_code: entryMetadata[0]?.clientCode || '',
                matter_number: entryMetadata[0]?.matterNumber || '',
                narratives: result.narratives,
                total_hours: result.total_hours,
                status: 'draft'
            });
        } else {
            // Get recent entries that were created during recording
            const entries = await dbOperations.getEntries();
            const recentEntries = entries.slice(0, result.narratives.length);
            
            // Update each entry with its metadata
            for (let i = 0; i < recentEntries.length && i < entryMetadata.length; i++) {
                await dbOperations.updateEntry(recentEntries[i].id, {
                    client_code: entryMetadata[i].clientCode || '',
                    matter_number: entryMetadata[i].matterNumber || '',
                    status: 'draft'
                });
            }
        }
        
        closeModal();
        loadDashboard();
        showNotification('Entries saved successfully', 'success');
        
    } catch (err) {
        console.error('Error saving entries:', err);
        showNotification('Failed to save entries', 'error');
    }
}

// Entry actions
async function editEntry(id) {
    try {
        const entry = await dbOperations.getEntry(id);
        if (!entry) return;
        
        currentEntry = entry;
        
        // Open modal with entry data
        openModal();
        
        // Populate fields (handled by displayEnhancedResults for new interface)
        // Legacy support for old interface
        const legacyClientCode = document.getElementById('client-code');
        const legacyMatterNumber = document.getElementById('matter-number');
        if (legacyClientCode) legacyClientCode.value = entry.client_code || '';
        if (legacyMatterNumber) legacyMatterNumber.value = entry.matter_number || '';
        
        // Show transcription and results
        document.getElementById('transcription').classList.remove('hidden');
        document.getElementById('transcription-text').textContent = entry.original_text;
        
        displayEnhancedResults({
            narratives: entry.narratives,
            cleaned: entry.cleaned_text,
            total_hours: entry.total_hours
        });
        
    } catch (err) {
        console.error('Error editing entry:', err);
        showNotification('Failed to load entry', 'error');
    }
}

async function deleteEntry(id) {
    if (!confirm('Are you sure you want to delete this entry?')) return;
    
    try {
        await dbOperations.deleteEntry(id);
        loadDashboard();
        showNotification('Entry deleted', 'success');
    } catch (err) {
        console.error('Error deleting entry:', err);
        showNotification('Failed to delete entry', 'error');
    }
}

async function duplicateEntry(id) {
    try {
        const originalEntry = await dbOperations.getEntry(parseInt(id));
        if (!originalEntry) {
            throw new Error('Entry not found');
        }
        
        // Create a new entry with the same data but new timestamp
        const duplicatedEntry = {
            ...originalEntry,
            id: undefined, // Let the database generate a new ID
            created_at: new Date().toISOString(),
            status: 'draft' // Reset status to draft for duplicated entries
        };
        
        // Remove the id field completely
        delete duplicatedEntry.id;
        
        await dbOperations.saveEntry(duplicatedEntry);
        loadDashboard();
        showNotification('Entry duplicated successfully', 'success');
    } catch (err) {
        console.error('Error duplicating entry:', err);
        showNotification('Failed to duplicate entry', 'error');
    }
}

// Bulk Selection Functions
function toggleBulkSelection() {
    bulkSelectionMode = !bulkSelectionMode;
    const container = document.getElementById('entries-list');
    const bulkSelectBtn = document.getElementById('bulk-select-btn');
    const btnText = bulkSelectBtn.querySelector('.btn-text');
    
    if (bulkSelectionMode) {
        container.classList.add('bulk-selection-mode');
        btnText.textContent = 'Cancel';
    } else {
        container.classList.remove('bulk-selection-mode');
        btnText.textContent = 'Select';
        selectedEntries.clear();
        updateBulkActionsDisplay();
        
        // Clear all checkboxes
        document.querySelectorAll('.bulk-checkbox').forEach(cb => {
            cb.checked = false;
        });
    }
}

function updateBulkSelection() {
    const entryId = parseInt(this.dataset.entryId);
    
    if (this.checked) {
        selectedEntries.add(entryId);
    } else {
        selectedEntries.delete(entryId);
    }
    
    updateBulkActionsDisplay();
}

function updateBulkActionsDisplay() {
    const bulkActions = document.getElementById('bulk-actions');
    const bulkCount = document.getElementById('bulk-count');
    
    if (selectedEntries.size > 0) {
        bulkActions.classList.add('active');
        bulkCount.textContent = `${selectedEntries.size} selected`;
    } else {
        bulkActions.classList.remove('active');
    }
}

function cancelBulkSelection() {
    toggleBulkSelection();
}

async function bulkDeleteEntries() {
    if (selectedEntries.size === 0) return;
    
    const count = selectedEntries.size;
    if (!confirm(`Are you sure you want to delete ${count} entries?`)) return;
    
    try {
        const promises = Array.from(selectedEntries).map(id => dbOperations.deleteEntry(parseInt(id)));
        await Promise.all(promises);
        
        selectedEntries.clear();
        updateBulkActionsDisplay();
        loadDashboard();
        showNotification(`${count} entries deleted successfully`, 'success');
    } catch (err) {
        console.error('Error deleting entries:', err);
        showNotification('Failed to delete some entries', 'error');
    }
}

async function bulkDuplicateEntries() {
    if (selectedEntries.size === 0) return;
    
    try {
        const promises = Array.from(selectedEntries).map(async (id) => {
            const originalEntry = await dbOperations.getEntry(parseInt(id));
            if (originalEntry) {
                const duplicatedEntry = {
                    ...originalEntry,
                    created_at: new Date().toISOString(),
                    status: 'draft'
                };
                delete duplicatedEntry.id;
                return dbOperations.saveEntry(duplicatedEntry);
            }
        });
        
        await Promise.all(promises);
        
        const count = selectedEntries.size;
        selectedEntries.clear();
        updateBulkActionsDisplay();
        loadDashboard();
        showNotification(`${count} entries duplicated successfully`, 'success');
    } catch (err) {
        console.error('Error duplicating entries:', err);
        showNotification('Failed to duplicate some entries', 'error');
    }
}

// Utility functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Client/Matter Presets Management
let clientMatterPresets = JSON.parse(localStorage.getItem('clientMatterPresets') || '[]');

function savePresets() {
    localStorage.setItem('clientMatterPresets', JSON.stringify(clientMatterPresets));
}

function loadPresets() {
    const presetsContainer = document.getElementById('preset-buttons');
    if (!presetsContainer) return;
    
    presetsContainer.innerHTML = '';
    
    clientMatterPresets.forEach((preset, index) => {
        const presetBtn = document.createElement('button');
        presetBtn.className = 'preset-btn';
        presetBtn.innerHTML = `
            <span class="preset-client">${preset.client_code}</span>
            <span class="preset-matter">${preset.matter_number || 'No Matter'}</span>
        `;
        presetBtn.addEventListener('click', () => applyPreset(preset));
        presetsContainer.appendChild(presetBtn);
    });
}

function applyPreset(preset) {
    // Apply to all narratives in the edit modal
    const narrativeItems = document.querySelectorAll('.edit-narrative-item');
    narrativeItems.forEach(item => {
        const clientInput = item.querySelector('.narrative-client-input');
        const matterInput = item.querySelector('.narrative-matter-input');
        if (clientInput) clientInput.value = preset.client_code || '';
        if (matterInput) matterInput.value = preset.matter_number || '';
    });
}

function addNewPreset() {
    const client = prompt('Enter client code:');
    if (!client) return;
    
    const matter = prompt('Enter matter number (optional):') || '';
    
    const preset = {
        client_code: client,
        matter_number: matter
    };
    
    clientMatterPresets.push(preset);
    savePresets();
    loadPresets();
}

// Edit Modal Functions
let currentEditingEntry = null;

function openEditModal(entryId) {
    // Find the entry
    const entry = currentEntries.find(e => e.id == entryId);
    if (!entry) {
        console.error('Entry not found:', entryId);
        return;
    }
    
    currentEditingEntry = entry;
    
    // Populate the modal
    populateEditModal(entry);
    
    // Show the modal
    document.getElementById('edit-modal').classList.add('active');
}

function closeEditModal() {
    document.getElementById('edit-modal').classList.remove('active');
    currentEditingEntry = null;
}

function populateEditModal(entry) {
    
    // Populate narratives
    const container = document.getElementById('edit-narratives-container');
    container.innerHTML = '';
    
    (entry.narratives || []).forEach((narrative, index) => {
        const narrativeItem = document.createElement('div');
        narrativeItem.className = 'edit-narrative-item';
        narrativeItem.innerHTML = `
            <div class="edit-narrative-header">
                <span class="activity-title">Activity ${index + 1}</span>
                <span class="activity-hours">${narrative.hours} hours</span>
            </div>
            <div class="edit-form-grid">
                <div class="edit-form-group compact">
                    <label>Hours</label>
                    <input type="number" step="0.1" min="0" class="narrative-hours-input" value="${narrative.hours}" data-index="${index}">
                </div>
                <div class="edit-form-group compact">
                    <label>Client Code</label>
                    <input type="text" class="narrative-client-input" value="${narrative.client_code || entry.client_code || ''}" data-index="${index}" placeholder="e.g., ABC123">
                </div>
                <div class="edit-form-group compact">
                    <label>Matter Number</label>
                    <input type="text" class="narrative-matter-input" value="${narrative.matter_number || entry.matter_number || ''}" data-index="${index}" placeholder="e.g., 2024-001">
                </div>
                <div class="edit-form-group compact">
                    <label>Status</label>
                    <select class="narrative-status-input" data-index="${index}">
                        <option value="draft" ${(narrative.status || entry.status || 'draft') === 'draft' ? 'selected' : ''}>Draft</option>
                        <option value="exported" ${(narrative.status || entry.status || 'draft') === 'exported' || (narrative.status || entry.status || 'draft') === 'billed' ? 'selected' : ''}>Exported</option>
                    </select>
                </div>
            </div>
            <div class="edit-form-grid narrative-row">
                <div class="edit-form-group">
                    <label>Narrative Text</label>
                    <textarea rows="2" class="narrative-text-input auto-resize" data-index="${index}" placeholder="Describe the billable activity...">${narrative.text}</textarea>
                </div>
                <button type="button" class="details-toggle subtle" data-index="${index}">
                    ⋯
                </button>
            </div>
            <div class="details-section" data-index="${index}">
                <div class="edit-form-grid details-grid">
                    <div class="edit-form-group">
                        <label>Task Code</label>
                        <input type="text" class="narrative-task-input" value="${narrative.task_code || ''}" data-index="${index}" placeholder="e.g., RESEARCH">
                    </div>
                </div>
            </div>
        `;
        container.appendChild(narrativeItem);
    });
    
    // Add event listeners for details toggles
    document.querySelectorAll('.details-toggle').forEach(toggle => {
        toggle.addEventListener('click', function() {
            const index = this.dataset.index;
            const detailsSection = document.querySelector(`.details-section[data-index="${index}"]`);
            const isExpanded = detailsSection.classList.contains('expanded');
            
            if (isExpanded) {
                detailsSection.classList.remove('expanded');
                this.textContent = 'Details';
                this.classList.remove('active');
            } else {
                detailsSection.classList.add('expanded');
                this.textContent = 'Hide';
                this.classList.add('active');
            }
        });
    });
    
    // Add auto-resize functionality for textareas
    document.querySelectorAll('.auto-resize').forEach(textarea => {
        textarea.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 120) + 'px';
        });
        
        // Trigger resize on load
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    });
    
    // Update hours display when hours input changes
    document.querySelectorAll('.narrative-hours-input').forEach(input => {
        input.addEventListener('input', function() {
            const index = this.dataset.index;
            const hoursDisplay = document.querySelector(`.edit-narrative-item:nth-child(${parseInt(index) + 1}) .activity-hours`);
            if (hoursDisplay) {
                const hours = parseFloat(this.value) || 0;
                hoursDisplay.textContent = `${hours} hour${hours !== 1 ? 's' : ''}`;
            }
        });
    });
}

// Apply to All Modal Functions
let currentApplyToAllEntry = null;

function openApplyToAllModal(entryId) {
    const entry = currentEntries.find(e => e.id === entryId);
    if (!entry) {
        console.error('Entry not found:', entryId);
        return;
    }
    
    currentApplyToAllEntry = entry;
    
    // Pre-populate with existing values if they exist
    const clientInput = document.getElementById('apply-client-code');
    const matterInput = document.getElementById('apply-matter-number');
    
    if (clientInput && matterInput) {
        clientInput.value = entry.client_code || '';
        matterInput.value = entry.matter_number || '';
    }
    
    // Update preview
    updateApplyPreview();
    
    // Show modal
    const modal = document.getElementById('apply-to-all-modal');
    if (modal) {
        modal.classList.add('active');
    }
}

function closeApplyToAllModal() {
    const modal = document.getElementById('apply-to-all-modal');
    modal.classList.remove('active');
    currentApplyToAllEntry = null;
    
    // Clear inputs
    document.getElementById('apply-client-code').value = '';
    document.getElementById('apply-matter-number').value = '';
    
    // Hide preview
    const preview = document.getElementById('apply-preview');
    if (preview) {
        preview.classList.add('hidden');
    }
}

function updateApplyPreview() {
    const clientCode = document.getElementById('apply-client-code').value.trim();
    const matterNumber = document.getElementById('apply-matter-number').value.trim();
    const preview = document.getElementById('apply-preview');
    const previewText = preview?.querySelector('.preview-text');
    
    if (!preview || !previewText) return;
    
    if (!clientCode && !matterNumber) {
        preview.classList.add('hidden');
        return;
    }
    
    let message = 'Will apply: ';
    const items = [];
    
    if (clientCode) items.push(`Client "${clientCode}"`);
    if (matterNumber) items.push(`Matter "${matterNumber}"`);
    
    message += items.join(' and ');
    
    if (currentApplyToAllEntry && currentApplyToAllEntry.narratives) {
        message += ` to ${currentApplyToAllEntry.narratives.length} narrative${currentApplyToAllEntry.narratives.length > 1 ? 's' : ''}`;
    }
    
    previewText.textContent = message;
    preview.classList.remove('hidden');
}

async function applyToAllNarratives() {
    if (!currentApplyToAllEntry) return;
    
    const clientCode = document.getElementById('apply-client-code').value.trim();
    const matterNumber = document.getElementById('apply-matter-number').value.trim();
    const applyMode = document.querySelector('input[name="apply-mode"]:checked')?.value || 'overwrite';
    const overwriteExisting = applyMode === 'overwrite';
    
    
    // Validate - at least one field must be filled
    if (!clientCode && !matterNumber) {
        alert('Please enter at least a client code or matter number.');
        return;
    }
    
    try {
        // Create a deep copy of the entry to avoid reference issues
        const updatedEntry = JSON.parse(JSON.stringify(currentApplyToAllEntry));
        
        // Update entry-level fields if they have values
        if (clientCode) {
            updatedEntry.client_code = clientCode;
        }
        if (matterNumber) {
            updatedEntry.matter_number = matterNumber;
        }
        
        // Update all narratives based on what fields have values
        if (updatedEntry.narratives && Array.isArray(updatedEntry.narratives)) {
            updatedEntry.narratives = updatedEntry.narratives.map((narrative, index) => {
                const updatedNarrative = { ...narrative };
                
                if (clientCode && (overwriteExisting || !narrative.client_code)) {
                    updatedNarrative.client_code = clientCode;
                }
                
                if (matterNumber && (overwriteExisting || !narrative.matter_number)) {
                    updatedNarrative.matter_number = matterNumber;
                }
                
                return updatedNarrative;
            });
        }
        
        // Save to database
        const response = await api.updateEntry(updatedEntry.id, updatedEntry);
        
        // Update IndexedDB with the response from backend
        if (response) {
            // Mark as synced since it just came from the backend
            response.sync_status = 'synced';
            await dbOperations.saveEntry(response);
        }
        
        // Update the in-memory entries array with the actual response
        const entryIndex = currentEntries.findIndex(e => e.id === updatedEntry.id);
        if (entryIndex !== -1) {
            currentEntries[entryIndex] = response || updatedEntry;
        }
        
        // Close modal and refresh display
        closeApplyToAllModal();
        await loadDashboard();
        
        // Success - changes are applied
        
    } catch (error) {
        console.error('Error applying to all narratives:', error);
        console.error('Error details:', error.message);
        alert(`Error applying changes: ${error.message}. Please check the console for details.`);
    }
}

async function saveEditChanges() {
    if (!currentEditingEntry) return;
    
    try {
        // Collect the updated data
        const updatedEntry = {
            ...currentEditingEntry,
            narratives: []
        };
        
        // Collect narratives data
        const narrativeItems = document.querySelectorAll('.edit-narrative-item');
        narrativeItems.forEach((item, index) => {
            const narrative = {
                hours: parseFloat(item.querySelector('.narrative-hours-input').value) || 0,
                task_code: item.querySelector('.narrative-task-input').value,
                client_code: item.querySelector('.narrative-client-input').value,
                matter_number: item.querySelector('.narrative-matter-input').value,
                text: item.querySelector('.narrative-text-input').value,
                status: item.querySelector('.narrative-status-input').value
            };
            updatedEntry.narratives.push(narrative);
        });
        
        // Recalculate total hours
        updatedEntry.total_hours = updatedEntry.narratives.reduce((sum, n) => sum + n.hours, 0);
        
        // Determine entry-level status based on individual narrative statuses
        // Use the least advanced status (draft < exported)
        const statuses = updatedEntry.narratives.map(n => n.status);
        if (statuses.includes('draft')) {
            updatedEntry.status = 'draft';
        } else {
            updatedEntry.status = 'exported';
        }
        
        // Save to database
        await dbOperations.updateEntry(updatedEntry.id, updatedEntry);
        
        // Close modal and refresh dashboard
        closeEditModal();
        loadDashboard();
        
        showNotification('Entry updated successfully', 'success');
        
    } catch (error) {
        console.error('Error saving changes:', error);
        showNotification('Failed to save changes', 'error');
    }
}

// Status change function for card view
async function changeEntryStatus(entryId, newStatus) {
    try {
        const entry = await dbOperations.getEntry(entryId);
        if (!entry) {
            showNotification('Entry not found', 'error');
            return;
        }
        
        // Update entry status
        entry.status = newStatus;
        
        // Update all narratives to match the entry status
        if (entry.narratives && entry.narratives.length > 0) {
            entry.narratives.forEach(narrative => {
                narrative.status = newStatus;
            });
        }
        
        // Save to database
        await dbOperations.updateEntry(entryId, entry);
        
        // Refresh dashboard to reflect changes
        loadDashboard();
        
        showNotification(`Entry status changed to ${newStatus}`, 'success');
        
    } catch (error) {
        console.error('Error changing entry status:', error);
        showNotification('Failed to change status', 'error');
    }
}

async function changeNarrativeStatus(entryId, narrativeIndex, newStatus) {
    try {
        const entry = await dbOperations.getEntry(entryId);
        if (!entry) {
            showNotification('Entry not found', 'error');
            return;
        }
        
        // Update specific narrative status
        if (entry.narratives && entry.narratives[narrativeIndex]) {
            entry.narratives[narrativeIndex].status = newStatus;
            
            // Save to database
            await dbOperations.updateEntry(entryId, entry);
            
            // Update in-memory entries array
            const entryIndex = entries.findIndex(e => e.id === entryId);
            if (entryIndex !== -1) {
                entries[entryIndex] = entry;
            }
            
            // Refresh dashboard to reflect changes
            loadDashboard();
            
            showNotification(`Narrative status changed to ${newStatus}`, 'success');
        } else {
            showNotification('Narrative not found', 'error');
        }
        
    } catch (error) {
        console.error('Error changing narrative status:', error);
        showNotification('Failed to change narrative status', 'error');
    }
}

async function toggleNarrativeStatus(entryId, narrativeIndex) {
    try {
        const entry = await dbOperations.getEntry(entryId);
        if (!entry || !entry.narratives || !entry.narratives[narrativeIndex]) {
            showNotification('Narrative not found', 'error');
            return;
        }
        
        const currentStatus = entry.narratives[narrativeIndex].status || 'draft';
        const newStatus = currentStatus === 'ready' ? 'draft' : 'ready';
        
        // Show loading state on the specific status icon
        const statusIcon = document.querySelector(`[data-entry-id="${entryId}"][data-narrative-index="${narrativeIndex}"].narrative-status-icon`);
        if (statusIcon) {
            statusIcon.style.opacity = '0.5';
            statusIcon.style.pointerEvents = 'none';
        }
        
        // Update specific narrative status
        entry.narratives[narrativeIndex].status = newStatus;
        
        // Save to database
        await dbOperations.updateEntry(entryId, {
            narratives: entry.narratives
        });
        
        // Update in-memory entries array
        const entryIndex = currentEntries.findIndex(e => e.id === entryId);
        if (entryIndex !== -1) {
            currentEntries[entryIndex] = entry;
        }
        
        // Update the DOM directly instead of full reload
        updateNarrativeStatusInDOM(entryId, narrativeIndex, newStatus);
        updateEntryStatusInDOM(entryId, entry);
        
        showNotification(`Narrative marked as ${newStatus}`, 'success');
        
    } catch (error) {
        console.error('Error toggling narrative status:', error);
        showNotification('Failed to toggle narrative status', 'error');
        
        // Reset the UI on error
        const statusIcon = document.querySelector(`[data-entry-id="${entryId}"][data-narrative-index="${narrativeIndex}"].narrative-status-icon`);
        if (statusIcon) {
            statusIcon.style.opacity = '1';
            statusIcon.style.pointerEvents = 'auto';
        }
    }
}

async function toggleEntryStatus(entryId) {
    // Status toggling is disabled - status is now automatic
    return;
    
    try {
        const entry = await dbOperations.getEntry(entryId);
        if (!entry) {
            showNotification('Entry not found', 'error');
            return;
        }
        
        // Show loading state on entry status dropdown
        const statusDropdown = document.querySelector(`[data-entry-id="${entryId}"].entry-status-dropdown`);
        if (statusDropdown) {
            statusDropdown.style.opacity = '0.5';
            statusDropdown.style.pointerEvents = 'none';
        }
        
        // Determine current effective status (simplified logic)
        const currentStatus = determineEntryStatus(entry);
        const newStatus = currentStatus === 'ready' ? 'draft' : 'ready';
        
        // Update entry status
        entry.status = newStatus;
        
        // Update all narratives to match the entry status
        if (entry.narratives && entry.narratives.length > 0) {
            entry.narratives.forEach(narrative => {
                narrative.status = newStatus;
            });
        }
        
        // Save to database
        await dbOperations.updateEntry(entryId, {
            status: entry.status,
            narratives: entry.narratives
        });
        
        // Update in-memory entries array
        const entryIndex = currentEntries.findIndex(e => e.id === entryId);
        if (entryIndex !== -1) {
            currentEntries[entryIndex] = entry;
        }
        
        // Update DOM directly instead of full reload
        updateEntryStatusInDOM(entryId, entry);
        updateAllNarrativeStatusesInDOM(entryId, entry.narratives, newStatus);
        
        showNotification(`All narratives set to ${newStatus}`, 'success');
        
    } catch (error) {
        console.error('Error toggling entry status:', error);
        showNotification('Failed to toggle entry status', 'error');
        
        // Reset the UI on error
        const statusDropdown = document.querySelector(`[data-entry-id="${entryId}"].entry-status-dropdown`);
        if (statusDropdown) {
            statusDropdown.style.opacity = '1';
            statusDropdown.style.pointerEvents = 'auto';
        }
    }
}

// Context Recording Functions
let contextRecorder = null;
let currentContextEntry = null;
let currentContextNarrativeIndex = null;

function openContextRecordingModal(entryId, narrativeIndex) {
    // Find the entry
    const entry = currentEntries.find(e => e.id === entryId);
    if (!entry || !entry.narratives || !entry.narratives[narrativeIndex]) {
        console.error('Entry or narrative not found:', { entryId, narrativeIndex, entry });
        showNotification('Narrative not found', 'error');
        return;
    }
    
    currentContextEntry = entry;
    currentContextNarrativeIndex = narrativeIndex;
    
    // Display the narrative preview
    const narrativePreview = document.getElementById('inline-narrative-preview');
    if (narrativePreview) {
        narrativePreview.textContent = entry.narratives[narrativeIndex].text;
    }
    
    // Initialize context recorder if needed
    if (!contextRecorder) {
        contextRecorder = new ContextRecorder();
    }
    
    // Show the inline recorder with animation
    const recorder = document.getElementById('context-recorder-inline');
    if (recorder) {
        recorder.classList.add('active');
        // Force reflow for animation
        recorder.offsetHeight;
    }
}

function closeContextRecorder() {
    const recorder = document.getElementById('context-recorder-inline');
    if (recorder) {
        recorder.classList.remove('active');
    }
    
    // Stop recording if active
    if (contextRecorder && contextRecorder.isRecording) {
        contextRecorder.stopRecording();
    }
    
    // Reset state after animation
    setTimeout(() => {
        currentContextEntry = null;
        currentContextNarrativeIndex = null;
        // Clear transcription
        const transcription = document.getElementById('context-transcription');
        if (transcription) {
            transcription.classList.add('hidden');
            document.getElementById('context-live-text').textContent = '';
        }
    }, 300);
}

// Context Recorder Class
class ContextRecorder {
    constructor() {
        this.isRecording = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.recognition = null;
        this.finalTranscript = '';
        this.startTime = null;
        this.timerInterval = null;
        
        this.initializeSpeechRecognition();
        this.bindEvents();
    }
    
    initializeSpeechRecognition() {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            
            this.recognition.continuous = true;
            this.recognition.interimResults = true;
            this.recognition.lang = 'en-US';
            
            this.recognition.onresult = (event) => {
                let interimTranscript = '';
                let finalTranscript = '';
                
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        finalTranscript += transcript + ' ';
                    } else {
                        interimTranscript += transcript;
                    }
                }
                
                this.finalTranscript += finalTranscript;
                this.updateTranscriptionDisplay(this.finalTranscript + interimTranscript);
            };
            
            this.recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                if (event.error === 'no-speech' && this.isRecording) {
                    // Restart recognition
                    this.recognition.stop();
                    setTimeout(() => {
                        if (this.isRecording) {
                            this.recognition.start();
                        }
                    }, 100);
                }
            };
        }
    }
    
    bindEvents() {
        const recordBtn = document.getElementById('context-record-btn');
        if (recordBtn) {
            recordBtn.addEventListener('click', () => this.toggleRecording());
        }
    }
    
    async toggleRecording() {
        if (this.isRecording) {
            await this.stopRecording();
        } else {
            await this.startRecording();
        }
    }
    
    async startRecording() {
        try {
            // Get microphone permission
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Initialize MediaRecorder
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };
            
            this.mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                await this.processRecording(audioBlob);
            };
            
            // Start recording
            this.mediaRecorder.start();
            this.isRecording = true;
            this.startTime = Date.now();
            this.finalTranscript = '';
            
            // Start speech recognition
            if (this.recognition) {
                this.recognition.start();
            }
            
            // Update UI
            this.updateRecordingUI(true);
            this.startTimer();
            
            // Show transcription area
            const transcriptionArea = document.getElementById('context-transcription');
            if (transcriptionArea) {
                transcriptionArea.classList.remove('hidden');
            }
            
        } catch (error) {
            console.error('Error starting recording:', error);
            showNotification('Failed to start recording', 'error');
        }
    }
    
    async stopRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
            this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }
        
        if (this.recognition) {
            this.recognition.stop();
        }
        
        this.isRecording = false;
        this.updateRecordingUI(false);
        this.stopTimer();
    }
    
    async processRecording(audioBlob) {
        try {
            // Update status
            this.updateStatus('Processing your recording...');
            
            // If we have browser transcript, use it directly
            if (this.finalTranscript.trim()) {
                await this.enhanceNarrative(this.finalTranscript);
            } else {
                // Fall back to Whisper transcription
                const transcription = await this.transcribeWithWhisper(audioBlob);
                if (transcription) {
                    await this.enhanceNarrative(transcription);
                }
            }
            
        } catch (error) {
            console.error('Error processing recording:', error);
            showNotification('Failed to process recording', 'error');
            this.updateStatus('Failed to process recording');
        }
    }
    
    async transcribeWithWhisper(audioBlob) {
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        
        const response = await api.transcribeAudio(formData);
        return response.text;
    }
    
    async enhanceNarrative(contextText) {
        if (!currentContextEntry || currentContextNarrativeIndex === null) {
            showNotification('No narrative selected', 'error');
            return;
        }
        
        try {
            this.updateStatus('Enhancing narrative with your context...');
            
            const originalNarrative = currentContextEntry.narratives[currentContextNarrativeIndex];
            
            // Log the data being sent for debugging
            console.log('Enhancing narrative:', {
                entryId: currentContextEntry.id,
                narrativeIndex: currentContextNarrativeIndex,
                originalText: originalNarrative.text,
                contextText: contextText
            });
            
            // Call backend to enhance the narrative
            const response = await api.enhanceNarrativeContext(
                currentContextEntry.id,
                currentContextNarrativeIndex,
                {
                    original_narrative: originalNarrative.text,
                    additional_context: contextText
                }
            );
            
            // Update local entry with enhanced narrative
            if (response && response.entry) {
                // Log the response for debugging
                console.log('Enhancement response:', response);
                console.log('Enhanced narrative:', response.enhanced_narrative);
                console.log('Updated entry:', response.entry);
                
                await dbOperations.saveEntry(response.entry);
                
                // Update in-memory entries
                const entryIndex = currentEntries.findIndex(e => e.id === currentContextEntry.id);
                if (entryIndex !== -1) {
                    currentEntries[entryIndex] = response.entry;
                }
                
                // Close recorder and refresh
                closeContextRecorder();
                await loadDashboard();
                showNotification('Narrative enhanced successfully', 'success');
            } else {
                console.error('No response or entry in enhancement response:', response);
                showNotification('Failed to enhance narrative - no response', 'error');
            }
            
        } catch (error) {
            console.error('Error enhancing narrative - Full error:', error);
            console.error('Error response:', error.response);
            
            // Show more specific error message
            let errorMessage = 'Failed to enhance narrative';
            if (error.response && error.response.data && error.response.data.error) {
                errorMessage = error.response.data.error;
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            showNotification(errorMessage, 'error');
            this.updateStatus('Failed to enhance narrative');
        }
    }
    
    updateRecordingUI(isRecording) {
        const recordBtn = document.getElementById('context-record-btn');
        const btnText = recordBtn?.querySelector('.btn-text');
        
        if (isRecording) {
            recordBtn?.classList.add('recording');
            if (btnText) btnText.textContent = 'Stop Recording';
            this.updateStatus('Recording... Speak your additional context');
        } else {
            recordBtn?.classList.remove('recording');
            if (btnText) btnText.textContent = 'Start Recording';
            this.updateStatus('Ready to record');
        }
    }
    
    updateStatus(message) {
        const statusText = document.getElementById('context-status-text');
        if (statusText) {
            statusText.textContent = message;
        }
    }
    
    updateTranscriptionDisplay(text) {
        const liveText = document.getElementById('context-live-text');
        if (liveText) {
            liveText.textContent = text;
        }
    }
    
    startTimer() {
        const timerElement = document.getElementById('context-timer');
        if (!timerElement) return;
        
        this.timerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);
    }
    
    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        
        const timerElement = document.getElementById('context-timer');
        if (timerElement) {
            timerElement.textContent = '';
        }
    }
}

// Safe wrapper functions with additional error handling
async function safeToggleEntryStatus(entryId) {
    // Prevent double-clicks
    const statusToggle = document.querySelector(`[data-entry-id="${entryId}"] .status-toggle-single`);
    if (statusToggle && statusToggle.disabled) {
        return;
    }
    
    // Disable button during operation
    if (statusToggle) {
        statusToggle.disabled = true;
        statusToggle.style.opacity = '0.6';
    }
    
    try {
        await toggleEntryStatus(entryId);
    } catch (error) {
        console.error('Error in safeToggleEntryStatus:', error);
        showNotification('Failed to update entry status', 'error');
    } finally {
        // Re-enable button
        if (statusToggle) {
            statusToggle.disabled = false;
            statusToggle.style.opacity = '1';
        }
    }
}

async function safeToggleNarrativeStatus(entryId, narrativeIndex) {
    // Status toggling is disabled - status is now automatic
    return;
    
    // Prevent double-clicks
    const statusIcon = document.querySelector(`[data-entry-id="${entryId}"][data-narrative-index="${narrativeIndex}"].narrative-status-icon`);
    if (statusIcon && statusIcon.dataset.processing === 'true') {
        return;
    }
    
    // Mark as processing
    if (statusIcon) {
        statusIcon.dataset.processing = 'true';
    }
    
    try {
        await toggleNarrativeStatus(entryId, narrativeIndex);
    } catch (error) {
        console.error('Error in safeToggleNarrativeStatus:', error);
        showNotification('Failed to update narrative status', 'error');
    } finally {
        // Remove processing flag
        if (statusIcon) {
            delete statusIcon.dataset.processing;
        }
    }
}

// Helper functions for status determination and DOM updates
function updateAllNarrativeStatusesInDOM(entryId, narratives, newStatus) {
    if (!narratives) return;
    
    narratives.forEach((narrative, index) => {
        updateNarrativeStatusInDOM(entryId, index, newStatus);
    });
}
function updateNarrativeStatusInDOM(entryId, narrativeIndex, newStatus) {
    // Update the narrative status icon
    const statusIcon = document.querySelector(`[data-entry-id="${entryId}"][data-narrative-index="${narrativeIndex}"].narrative-status-icon`);
    if (statusIcon) {
        // Reset loading state
        statusIcon.style.opacity = '1';
        statusIcon.style.pointerEvents = 'auto';
        
        // Update icon attributes
        statusIcon.setAttribute('data-status', newStatus);
        statusIcon.setAttribute('title', newStatus === 'ready' ? 'Mark as Draft' : 'Mark as Ready');
        
        // Update icon content
        const iconContent = newStatus === 'ready' ? 
            '<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z"/></svg>' : 
            '<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9" fill="none"/></svg>';
        statusIcon.innerHTML = iconContent;
    }
    
    // Update the narrative item class
    const narrativeItem = document.querySelector(`[data-entry-id="${entryId}"] .narrative-item[data-narrative-index="${narrativeIndex}"]`);
    if (narrativeItem) {
        narrativeItem.className = narrativeItem.className.replace(/narrative-(ready|draft)/, `narrative-${newStatus}`);
    }
}

function updateEntryStatusInDOM(entryId, entry) {
    // Determine the overall entry status using the helper function
    const entryStatus = determineEntryStatus(entry);
    
    // Update the entry-level status dropdown
    const statusDropdown = document.querySelector(`[data-entry-id="${entryId}"].entry-status-dropdown`);
    if (statusDropdown) {
        // Reset loading state
        statusDropdown.style.opacity = '1';
        statusDropdown.style.pointerEvents = 'auto';
        
        const statusButton = statusDropdown.querySelector('.status-dropdown-btn');
        if (statusButton) {
            // Update button text and class
            statusButton.textContent = entryStatus.charAt(0).toUpperCase() + entryStatus.slice(1);
            statusButton.className = statusButton.className.replace(/status-(ready|draft|exported)/, `status-${entryStatus}`);
        }
        
        // Update dropdown items
        const dropdownItems = statusDropdown.querySelectorAll('.status-dropdown-item');
        dropdownItems.forEach(item => {
            item.classList.toggle('active', item.getAttribute('data-status') === entryStatus);
        });
    }
}

// Make functions available globally
window.editEntry = editEntry;
window.deleteEntry = deleteEntry;
window.openEditModal = openEditModal;
window.closeEditModal = closeEditModal;
window.saveEditChanges = saveEditChanges;
window.toggleNarrativeStatus = toggleNarrativeStatus;
window.toggleEntryStatus = toggleEntryStatus;
window.safeToggleNarrativeStatus = safeToggleNarrativeStatus;
window.safeToggleEntryStatus = safeToggleEntryStatus;
window.openApplyToAllModal = openApplyToAllModal;
window.addNewPreset = addNewPreset;
window.duplicateEntry = duplicateEntry;
window.toggleDescription = toggleDescription;
window.changeEntryStatus = changeEntryStatus;

// Bulk assignment functions
function showBulkAssignmentControls() {
    const controls = document.getElementById('bulk-assignment-controls');
    if (controls) {
        controls.classList.remove('hidden');
    }
}

function hideBulkAssignmentControls() {
    const controls = document.getElementById('bulk-assignment-controls');
    if (controls) {
        controls.classList.add('hidden');
    }
}

async function bulkAssignClient() {
    const clientInput = document.getElementById('bulk-client-input');
    const clientCode = clientInput.value.trim();
    
    if (!clientCode) {
        showNotification('Please enter a client code', 'error');
        return;
    }
    
    // Show confirmation dialog
    const confirmed = await showBulkAssignmentDialog('client', clientCode);
    if (!confirmed) return;
    
    try {
        // Get all visible entries
        const visibleEntries = getVisibleEntries();
        
        if (visibleEntries.length === 0) {
            showNotification('No entries found to update', 'error');
            return;
        }
        
        // Update each entry
        for (const entry of visibleEntries) {
            entry.client_code = clientCode;
            
            // Also update narratives
            if (entry.narratives && entry.narratives.length > 0) {
                entry.narratives.forEach(narrative => {
                    narrative.client_code = clientCode;
                });
            }
            
            await dbOperations.updateEntry(entry.id, entry);
        }
        
        // Clear input and refresh dashboard
        clientInput.value = '';
        loadDashboard();
        
        showNotification(`Client code "${clientCode}" applied to ${visibleEntries.length} entries`, 'success');
        
    } catch (error) {
        console.error('Error applying bulk client assignment:', error);
        showNotification('Failed to apply client code', 'error');
    }
}

async function bulkAssignMatter() {
    const matterInput = document.getElementById('bulk-matter-input');
    const matterNumber = matterInput.value.trim();
    
    if (!matterNumber) {
        showNotification('Please enter a matter number', 'error');
        return;
    }
    
    // Show confirmation dialog
    const confirmed = await showBulkAssignmentDialog('matter', matterNumber);
    if (!confirmed) return;
    
    try {
        // Get all visible entries
        const visibleEntries = getVisibleEntries();
        
        if (visibleEntries.length === 0) {
            showNotification('No entries found to update', 'error');
            return;
        }
        
        // Update each entry
        for (const entry of visibleEntries) {
            entry.matter_number = matterNumber;
            
            // Also update narratives
            if (entry.narratives && entry.narratives.length > 0) {
                entry.narratives.forEach(narrative => {
                    narrative.matter_number = matterNumber;
                });
            }
            
            await dbOperations.updateEntry(entry.id, entry);
        }
        
        // Clear input and refresh dashboard
        matterInput.value = '';
        loadDashboard();
        
        showNotification(`Matter number "${matterNumber}" applied to ${visibleEntries.length} entries`, 'success');
        
    } catch (error) {
        console.error('Error applying bulk matter assignment:', error);
        showNotification('Failed to apply matter number', 'error');
    }
}

function getVisibleEntries() {
    // Get all entry cards currently visible in the DOM
    const entryCards = document.querySelectorAll('.entry-card[data-entry-id]');
    const entries = [];
    
    entryCards.forEach(card => {
        const entryId = parseInt(card.dataset.entryId);
        // Find the entry data from the current loaded entries
        const entry = window.currentEntries?.find(e => e.id === entryId);
        if (entry) {
            entries.push(entry);
        }
    });
    
    return entries;
}

// Confirmation dialog for bulk assignments
function showBulkAssignmentDialog(type, value) {
    return new Promise((resolve) => {
        // Create modal HTML
        const modal = document.createElement('div');
        modal.className = 'bulk-assignment-modal';
        modal.innerHTML = `
            <div class="bulk-assignment-dialog">
                <div class="bulk-assignment-dialog-header">
                    <h3>Confirm Bulk Assignment</h3>
                </div>
                <div class="bulk-assignment-dialog-content">
                    <p>Are you sure you want to apply <strong>${type} code "${value}"</strong> to all visible entries?</p>
                    <p class="warning-text">This action will update all entries currently displayed in the card view and cannot be undone.</p>
                </div>
                <div class="bulk-assignment-dialog-actions">
                    <button class="bulk-cancel-btn" onclick="closeBulkDialog(false)">Cancel</button>
                    <button class="bulk-confirm-btn" onclick="closeBulkDialog(true)">Apply to All</button>
                </div>
            </div>
        `;
        
        // Add to page
        document.body.appendChild(modal);
        
        // Store resolve function globally so buttons can access it
        window.bulkDialogResolve = resolve;
        
        // Add styles if not already added
        if (!document.getElementById('bulk-modal-styles')) {
            const styles = document.createElement('style');
            styles.id = 'bulk-modal-styles';
            styles.textContent = `
                .bulk-assignment-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                }
                
                .bulk-assignment-dialog {
                    background: var(--surface);
                    border-radius: 0.5rem;
                    padding: 1.5rem;
                    max-width: 500px;
                    width: 90%;
                    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
                }
                
                .bulk-assignment-dialog-header h3 {
                    margin: 0 0 1rem 0;
                    color: var(--text-primary);
                    font-size: 1.25rem;
                }
                
                .bulk-assignment-dialog-content p {
                    margin: 0 0 1rem 0;
                    color: var(--text-primary);
                    line-height: 1.5;
                }
                
                .warning-text {
                    color: var(--warning-color);
                    font-size: 0.875rem;
                }
                
                .bulk-assignment-dialog-actions {
                    display: flex;
                    gap: 0.75rem;
                    justify-content: flex-end;
                    margin-top: 1.5rem;
                }
                
                .bulk-cancel-btn, .bulk-confirm-btn {
                    padding: 0.5rem 1rem;
                    border: none;
                    border-radius: 0.375rem;
                    font-size: 0.875rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                
                .bulk-cancel-btn {
                    background: var(--background);
                    color: var(--text-secondary);
                    border: 1px solid var(--border);
                }
                
                .bulk-cancel-btn:hover {
                    background: var(--surface);
                    color: var(--text-primary);
                }
                
                .bulk-confirm-btn {
                    background: var(--primary-color);
                    color: white;
                }
                
                .bulk-confirm-btn:hover {
                    background: #1d4ed8;
                }
            `;
            document.head.appendChild(styles);
        }
    });
}

function closeBulkDialog(confirmed) {
    // Remove modal
    const modal = document.querySelector('.bulk-assignment-modal');
    if (modal) {
        modal.remove();
    }
    
    // Resolve promise
    if (window.bulkDialogResolve) {
        window.bulkDialogResolve(confirmed);
        delete window.bulkDialogResolve;
    }
}

window.bulkAssignClient = bulkAssignClient;
window.bulkAssignMatter = bulkAssignMatter;
window.closeBulkDialog = closeBulkDialog;

// Helper function for description expansion
function toggleDescription(btn) {
    const descriptionContent = btn.closest('.description-content');
    const descriptionText = descriptionContent.querySelector('.description-text');
    const fullText = descriptionText.getAttribute('title');
    
    if (btn.textContent === 'more') {
        descriptionText.textContent = fullText;
        btn.textContent = 'less';
        descriptionContent.classList.add('expanded');
    } else {
        const maxLength = 150;
        descriptionText.textContent = fullText.substring(0, maxLength) + '...';
        btn.textContent = 'more';
        descriptionContent.classList.remove('expanded');
    }
}

// Mobile-specific functions
function toggleMobileDescription(btn, entryId, narrativeIndex) {
    const row = btn.closest('tr');
    const descriptionDiv = row.querySelector('.description-text');
    
    // Get the full entry data
    const entry = currentEntries.find(e => e.id === entryId);
    if (!entry) return;
    
    const narrative = narrativeIndex !== null && entry.narratives ? 
        entry.narratives[narrativeIndex] : null;
    const fullText = narrative ? narrative.text : (entry.original_text || 'No description');
    
    if (btn.textContent === 'show more') {
        descriptionDiv.textContent = fullText;
        btn.textContent = 'show less';
    } else {
        const maxLength = 100;
        descriptionDiv.textContent = fullText.substring(0, maxLength) + '...';
        btn.textContent = 'show more';
    }
}

function toggleMobileMenu(btn, entryId) {
    // Close any other open menus
    document.querySelectorAll('.mobile-dropdown-menu').forEach(menu => {
        if (menu.dataset.entryId !== entryId.toString()) {
            menu.remove();
        }
    });
    
    // Check if menu already exists
    const existingMenu = document.querySelector(`.mobile-dropdown-menu[data-entry-id="${entryId}"]`);
    if (existingMenu) {
        existingMenu.remove();
        return;
    }
    
    // Create dropdown menu
    const menu = document.createElement('div');
    menu.className = 'mobile-dropdown-menu';
    menu.dataset.entryId = entryId;
    menu.innerHTML = `
        <button class="mobile-dropdown-item" onclick="openEditModal(${entryId}); this.parentElement.remove();">
            <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                <path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z"/>
            </svg>
            Edit
        </button>
        <button class="mobile-dropdown-item" onclick="duplicateEntry(${entryId}); this.parentElement.remove();">
            <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                <path d="M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z"/>
            </svg>
            Duplicate
        </button>
        <button class="mobile-dropdown-item delete" onclick="deleteEntry(${entryId}); this.parentElement.remove();">
            <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/>
            </svg>
            Delete
        </button>
    `;
    
    // Position the menu
    const btnRect = btn.getBoundingClientRect();
    menu.style.position = 'absolute';
    menu.style.top = btnRect.bottom + 'px';
    menu.style.right = (window.innerWidth - btnRect.right) + 'px';
    
    document.body.appendChild(menu);
    
    // Close menu when clicking outside
    setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
            if (!menu.contains(e.target) && e.target !== btn) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        });
    }, 0);
}