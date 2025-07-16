// Main application logic
let currentView = 'dashboard';
let currentEntries = [];
let currentEntry = null;
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

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize database
    try {
        await initDB();
        console.log('Database initialized');
        
        // Clean up any entries with invalid IDs on startup
        const cleanedCount = await dbOperations.cleanupInvalidEntries();
        if (cleanedCount > 0) {
            console.log(`Cleaned up ${cleanedCount} entries with invalid IDs`);
        }
    } catch (err) {
        console.error('Failed to initialize database:', err);
    }
    
    // Initialize network status
    networkStatus.init();
    
    // Start auto-sync
    syncManager.startAutoSync();
    
    // Set up event listeners
    setupEventListeners();
    
    
    // View toggle removed - always use list view
    
    // Load initial view
    loadDashboard();
    
    // Handle window resize for responsive table
    let resizeTimeout;
    let previousWidth = window.innerWidth;
    
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            const currentWidth = window.innerWidth;
            const wasMobile = previousWidth <= 768;
            const isMobile = currentWidth <= 768;
            
            // Only reload if crossing the mobile breakpoint
            if (currentView === 'dashboard' && wasMobile !== isMobile) {
                previousWidth = currentWidth;
                loadDashboard();
            } else {
                previousWidth = currentWidth;
            }
        }, 250);
    });
});

// Event listeners - Streamlined
function setupEventListeners() {
    // Navigation
    // Handle export button click
    const exportBtn = document.querySelector('.nav-btn[data-view="export"]');
    if (exportBtn) {
        exportBtn.addEventListener('click', (e) => {
            e.preventDefault();
            handleExportClick();
        });
    }
    
    // App title navigation - always go to dashboard
    const appTitle = document.getElementById('app-title');
    if (appTitle) {
        appTitle.addEventListener('click', (e) => {
            e.preventDefault();
            // Switch to dashboard
            switchView('dashboard');
        });
    }
    
    // Streamlined controls
    const searchInput = document.getElementById('search');
    const addButton = document.getElementById('add-time-entry');
    
    // Search functionality
    if (searchInput) {
        searchInput.addEventListener('input', debounce(() => loadDashboard(), 300));
    }
    
    // View toggle removed - always use list view
    
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
    const statusFilterElement = document.getElementById('status-filter');
    const clientFilterEl = document.getElementById('client-filter');
    const matterFilterEl = document.getElementById('matter-filter');
    const hoursFilterEl = document.getElementById('hours-filter');
    const taskFilterEl = document.getElementById('task-filter');
    const clearAllFiltersBtn = document.getElementById('clear-all-filters');
    const applyFiltersBtn = document.getElementById('apply-filters');
    
    if (statusFilterElement) {
        statusFilterElement.addEventListener('change', () => {
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
async function switchView(view) {
    currentView = view;
    
    // Update views
    document.querySelectorAll('.view').forEach(v => {
        v.classList.toggle('active', v.id === `${view}-view`);
    });
    
    // Load view data
    switch (view) {
        case 'dashboard':
            loadDashboard();
            break;
    }
}

// View mode removed - always use list view

// View mode removed - always use list view

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
    
    // Reset time filter buttons
    document.querySelectorAll('.time-filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.filter === 'all') {
            btn.classList.add('active');
        }
    });
    
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
        
        // Apply status filter (must be done after retrieval as per database.js comment)
        if (status) {
            entries = entries.filter(entry => {
                const effectiveStatus = determineEntryStatus(entry);
                return effectiveStatus === status;
            });
        }
        
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
        container.className = 'entries-condensed'; // Always use list view class
        
        // Always render list view
        renderCondensedView(entries, container);
        
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


// Card view removed - always use list view

// Inline editing functionality
function setupInlineEditing(card) {
    const editableFields = card.querySelectorAll('.editable-field');
    
    editableFields.forEach(field => {
        // Remove any existing listeners to prevent duplicates
        if (field.handleEditClick) {
            field.removeEventListener('click', field.handleEditClick);
        }
        
        // Store the handler reference on the field
        field.handleEditClick = function(e) {
            e.stopPropagation();
            
            // Don't start editing if already editing
            if (!field.classList.contains('editing')) {
                startInlineEdit(field);
            }
        };
        
        field.addEventListener('click', field.handleEditClick);
    });
}

async function startInlineEdit(field) {
    if (field.classList.contains('editing')) return;
    
    const entryId = field.dataset.entryId;
    const fieldType = field.dataset.field;
    const narrativeIndex = field.dataset.narrativeIndex;
    
    // Prevent editing of total_hours (calculated) and date fields
    if (fieldType === 'total_hours' || fieldType === 'created_at') {
        return;
    }
    
    // Get current value
    let currentValue = '';
    if (fieldType === 'hours') {
        currentValue = field.textContent.replace(' hours', '').trim();
    } else if (fieldType === 'text') {
        // For narrative text, get the full text from the entry data
        if (narrativeIndex !== undefined) {
            try {
                const entry = await dbOperations.getEntry(parseInt(entryId));
                if (entry && entry.narratives && entry.narratives[narrativeIndex]) {
                    currentValue = entry.narratives[narrativeIndex].text || '';
                } else {
                    currentValue = field.textContent.trim();
                }
            } catch (error) {
                console.error('Failed to get narrative text:', error);
                currentValue = field.textContent.trim();
            }
        } else {
            currentValue = field.textContent.trim();
        }
    } else if (fieldType === 'client_code' || fieldType === 'matter_number') {
        // Extract text content excluding the SVG
        // First try to find text nodes
        const textNodes = Array.from(field.childNodes).filter(node => node.nodeType === Node.TEXT_NODE);
        if (textNodes.length > 0) {
            currentValue = textNodes.map(node => node.textContent).join('').trim();
        } else {
            // If no text nodes, get all text content and remove any SVG content
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = field.innerHTML;
            // Remove SVG elements
            tempDiv.querySelectorAll('svg').forEach(svg => svg.remove());
            currentValue = tempDiv.textContent.trim();
        }
    }
    
    // Store original value for comparison
    field.dataset.originalValue = currentValue;
    
    // Mark as editing
    field.classList.add('editing');
    
    // Create input element
    let inputElement;
    if (fieldType === 'text') {
        inputElement = document.createElement('textarea');
        inputElement.className = 'inline-textarea seamless';
        inputElement.value = currentValue;
        inputElement.rows = 1;
        // Copy computed styles from the original element
        const computedStyle = window.getComputedStyle(field);
        inputElement.style.lineHeight = computedStyle.lineHeight;
        inputElement.style.fontSize = computedStyle.fontSize;
        inputElement.style.fontFamily = computedStyle.fontFamily;
        inputElement.style.fontWeight = computedStyle.fontWeight;
        inputElement.style.letterSpacing = computedStyle.letterSpacing;
        // Auto-resize will happen after appending to DOM
    } else {
        inputElement = document.createElement('input');
        inputElement.className = 'inline-input seamless';
        
        if (fieldType === 'hours') {
            inputElement.type = 'number';
            inputElement.step = '0.1';
            inputElement.min = '0';
        } else {
            inputElement.type = 'text';
        }
        
        inputElement.value = currentValue;
    }
    
    // Replace content (no action buttons)
    field.innerHTML = '';
    field.appendChild(inputElement);
    
    // Ensure value is set after DOM update
    inputElement.value = currentValue;
    
    // Focus and select input
    inputElement.focus();
    if (inputElement.select) inputElement.select();
    
    // Auto-resize textarea on input
    if (fieldType === 'text') {
        const autoResize = () => {
            inputElement.style.height = 'auto';
            // Add extra pixels to prevent text cutoff
            const scrollHeight = inputElement.scrollHeight;
            const computedStyle = window.getComputedStyle(inputElement);
            const lineHeight = parseFloat(computedStyle.lineHeight);
            // Add a small buffer (about 1/4 line height) to prevent cutoff
            inputElement.style.height = (scrollHeight + lineHeight * 0.25) + 'px';
        };
        
        inputElement.addEventListener('input', autoResize);
        
        // Initial resize after DOM update
        setTimeout(autoResize, 0);
    }
    
    // Handle blur (auto-save)
    inputElement.addEventListener('blur', async (e) => {
        // Small delay to handle any click events first
        setTimeout(() => {
            // Only process if still in editing mode
            if (field.classList.contains('editing')) {
                const newValue = inputElement.value.trim();
                const originalValue = field.dataset.originalValue;
                
                // Save if value changed, otherwise just exit edit mode
                if (newValue !== originalValue) {
                    saveInlineEdit(field, inputElement, entryId, fieldType, narrativeIndex);
                } else {
                    cancelInlineEditWithoutReload(field, originalValue, fieldType);
                }
            }
        }, 100);
    });
    
    // Handle keyboard shortcuts
    inputElement.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            // Cancel editing without saving
            cancelInlineEditWithoutReload(field, currentValue, fieldType);
        } else if (e.key === 'Enter' && !e.shiftKey && fieldType !== 'text') {
            e.preventDefault();
            e.stopPropagation();
            // Save changes on Enter
            const newValue = inputElement.value.trim();
            if (newValue !== currentValue) {
                saveInlineEdit(field, inputElement, entryId, fieldType, narrativeIndex);
            } else {
                cancelInlineEditWithoutReload(field, currentValue, fieldType);
            }
        } else if (e.key === 'Tab') {
            // Let blur handle the save, then move to next field
            setTimeout(() => {
                const allEditableFields = document.querySelectorAll('.editable-field:not(.editing)');
                if (allEditableFields.length > 0) {
                    allEditableFields[0].click();
                }
            }, 150);
        }
    });
}

async function saveInlineEdit(field, inputElement, entryId, fieldType, narrativeIndex) {
    const newValue = inputElement.value.trim();
    
    try {
        // Show saving state
        field.classList.add('saving');
        
        // Get current entry data
        const entry = await dbOperations.getEntry(parseInt(entryId));
        if (!entry) {
            throw new Error('Entry not found');
        }
        
        // Check if the value actually changed
        let currentValue = '';
        if (fieldType === 'total_hours') {
            currentValue = entry.total_hours?.toString() || '0';
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
            field.classList.remove('editing', 'saving');
            delete field.dataset.originalValue;
            return;
        }
        
        // Prepare updates object
        let updates = {};
        
        if (fieldType === 'total_hours') {
            updates.total_hours = parseFloat(newValue) || 0;
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
        field.classList.remove('editing', 'saving');
        delete field.dataset.originalValue;
        
        // If we updated narrative hours, recalculate and update total hours display
        if (fieldType === 'hours' && narrativeIndex !== undefined) {
            const updatedEntry = await dbOperations.getEntry(parseInt(entryId));
            if (updatedEntry && updatedEntry.narratives) {
                const newTotalHours = updatedEntry.narratives.reduce((sum, n) => sum + (n.hours || 0), 0);
                
                // Find the card element
                const card = field.closest('.entry-card');
                if (card) {
                    const totalHoursDisplay = card.querySelector('.total-hours-display');
                    if (totalHoursDisplay) {
                        totalHoursDisplay.textContent = `${newTotalHours} hours`;
                    }
                }
                
                // Also update the entry's total_hours in the database
                await dbOperations.updateEntry(parseInt(entryId), { total_hours: newTotalHours });
            }
        }
        
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
        field.classList.remove('saving');
        
        // Show inline error
        field.classList.add('error');
        
        // Create error message
        const errorMsg = document.createElement('div');
        errorMsg.className = 'inline-error-message';
        errorMsg.textContent = error.message === 'Entry not found' ? 
            'Entry not found. Please refresh.' : 
            'Failed to save. Click to retry.';
        
        // Show error for a few seconds
        field.appendChild(errorMsg);
        setTimeout(() => {
            if (errorMsg.parentNode) {
                errorMsg.remove();
            }
            field.classList.remove('error');
            // Restore original value
            cancelInlineEditWithoutReload(field, field.dataset.originalValue, fieldType);
        }, 3000);
    }
}

function cancelInlineEdit(field) {
    field.classList.remove('editing');
    // Trigger a reload of the dashboard to restore original content
    loadDashboard();
}

function cancelInlineEditWithoutReload(field, originalValue, fieldType) {
    field.classList.remove('editing');
    delete field.dataset.originalValue;
    
    // Restore original display without reloading
    updateFieldDisplay(field, fieldType, originalValue);
}

function updateFieldDisplay(field, fieldType, newValue) {
    // Restore the original structure with the new value
    if (fieldType === 'created_at') {
        // Format the date for display
        const date = new Date(newValue);
        const dateStr = date.toLocaleDateString();
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        field.innerHTML = `${dateStr} ${timeStr}`;
    } else if (fieldType === 'hours') {
        field.innerHTML = `${newValue} hours`;
    } else if (fieldType === 'total_hours') {
        field.innerHTML = `
            ${newValue}
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
        // Check if this is a card view field (has narrative-client class)
        if (field.classList.contains('editable-client')) {
            // Card view - include person icon, no edit icon
            field.innerHTML = `
                <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
                    <path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z"/>
                </svg>
                ${newValue}
            `;
        } else {
            // List view - include edit icon
            field.innerHTML = `
                ${newValue}
                <svg class="edit-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z"/>
                </svg>
            `;
        }
    } else if (fieldType === 'matter_number') {
        // Check if this is a card view field (has narrative-matter class)
        if (field.classList.contains('editable-matter')) {
            // Card view - include document icon, no edit icon
            field.innerHTML = `
                <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
                    <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                </svg>
                ${newValue}
            `;
        } else {
            // List view - include edit icon
            field.innerHTML = `
                ${newValue}
                <svg class="edit-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z"/>
                </svg>
            `;
        }
    } else {
        // For other field types, just set the text content
        field.textContent = newValue;
    }
    
    // Re-setup inline editing for this field
    setupInlineEditingForField(field);
}

function setupInlineEditingForField(field) {
    // Remove existing listener if any
    if (field.handleEditClick) {
        field.removeEventListener('click', field.handleEditClick);
    }
    
    // Create new handler
    field.handleEditClick = function(e) {
        e.stopPropagation();
        
        // Don't start editing if already editing
        if (!field.classList.contains('editing')) {
            startInlineEdit(field);
        }
    };
    
    field.addEventListener('click', field.handleEditClick);
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
                <button class="time-filter-btn ${quickTimeFilter === 'today' ? 'active' : ''}" data-filter="today">Today</button>
                <button class="time-filter-btn ${quickTimeFilter === 'week' ? 'active' : ''}" data-filter="week">This Week</button>
                <button class="time-filter-btn ${quickTimeFilter === 'month' ? 'active' : ''}" data-filter="month">This Month</button>
                <button class="time-filter-btn ${quickTimeFilter === 'all' ? 'active' : ''}" data-filter="all">All</button>
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
    
    // Table structure is now handled by CSS for better performance
    table.innerHTML = `
        <thead>
            <tr>
                <th class="condensed-date">Date</th>
                <th class="condensed-client">Client</th>
                <th class="condensed-matter">Matter</th>
                <th class="condensed-time">Time</th>
                <th class="condensed-narrative">Narrative</th>
                <th class="condensed-actions actions-column">Actions</th>
                <th class="condensed-status">Status</th>
            </tr>
        </thead>
        <tbody></tbody>
    `;
    
    const tbody = table.querySelector('tbody');
    
    // Handle empty state
    if (entries.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state-cell">
                    <div class="empty-state">
                        <p>No entries found. Click "Add Entry" to get started.</p>
                    </div>
                </td>
            </tr>
        `;
        container.appendChild(timeFilterBar);
        tableWrapper.appendChild(table);
        container.appendChild(tableWrapper);
        return;
    }
    
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
    row.className = 'condensed-row' + (selectedEntries.has(entry.id) ? ' selected' : '');
    row.dataset.entryId = entry.id;
    if (narrativeIndex !== null) {
        row.dataset.narrativeIndex = narrativeIndex;
    }
    
    const date = new Date(entry.created_at);
    const dateStr = date.toLocaleDateString('en-US', { 
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
    const maxDescLength = 150;
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
            <div class="client-matter">
                <span class="editable-field client-field client-main" 
                      data-field="client_code" 
                      data-entry-id="${entry.id}"
                      ${narrativeIndex !== null ? `data-narrative-index="${narrativeIndex}"` : ''}>
                    ${clientCode}
                    <svg class="edit-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z"/>
                    </svg>
                </span>
                <div class="matter-subtext">
                    <span class="editable-field matter-field" 
                          data-field="matter_number" 
                          data-entry-id="${entry.id}"
                          ${narrativeIndex !== null ? `data-narrative-index="${narrativeIndex}"` : ''}>
                        ${matterNumber || '-'}
                        <svg class="edit-icon" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z"/>
                        </svg>
                    </span>
                </div>
            </div>
        </td>
        <td class="condensed-matter">
            <span class="editable-field matter-field" 
                  data-field="matter_number" 
                  data-entry-id="${entry.id}"
                  ${narrativeIndex !== null ? `data-narrative-index="${narrativeIndex}"` : ''}>
                ${matterNumber || '-'}
                <svg class="edit-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z"/>
                </svg>
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
        <td class="condensed-narrative">
            <div class="narrative-content ${description.length > maxDescLength ? 'has-more' : ''}">
                <span class="editable-field narrative-text" 
                      data-field="text" 
                      data-entry-id="${entry.id}"
                      ${narrativeIndex !== null ? `data-narrative-index="${narrativeIndex}"` : ''}
                      title="${description}">
                    ${description}
                </span>
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
                <button class="table-action-btn checkbox-btn" 
                        onclick="toggleEntrySelection(${entry.id})" 
                        title="Select entry"
                        data-entry-id="${entry.id}">
                    <input type="checkbox" 
                           class="table-action-checkbox" 
                           data-entry-id="${entry.id}"
                           ${selectedEntries.has(entry.id) ? 'checked' : ''}
                           onclick="event.stopPropagation()"
                           tabindex="-1">
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
    
    // Setup inline editing
    setupInlineEditing(row);
    
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
                    <span class="mobile-detail-label">FULL NARRATIVE</span>
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

async function handleExportClick() {
    if (selectedEntries.size > 0) {
        // Export selected entries
        await exportSelectedEntries();
    } else {
        // Show dialog to confirm exporting all draft entries
        const dialog = confirm("No entries selected. Do you want to export all Draft entries?");
        if (dialog) {
            await exportAllDraftEntries();
        }
    }
}

async function exportSelectedEntries() {
    try {
        showLoading('Exporting selected entries...');
        
        const entryIds = Array.from(selectedEntries);
        
        // Generate filename
        const dateStr = new Date().toISOString().split('T')[0];
        const filename = `time-entries-${dateStr}`;
        
        await api.exportEntries(entryIds, filename);
        
        // Update status of exported entries to 'exported'
        for (const entryId of entryIds) {
            const entry = await dbOperations.getEntry(entryId);
            if (entry && entry.narratives) {
                entry.narratives.forEach(narrative => {
                    narrative.status = 'exported';
                });
            }
            
            await dbOperations.updateEntry(entryId, {
                status: 'exported',
                narratives: entry?.narratives
            });
        }
        
        hideLoading();
        showNotification(`${entryIds.length} entries exported successfully`, 'success');
        
        // Clear selection
        selectedEntries.clear();
        updateExportButtonLabel();
        
        // Refresh dashboard
        await loadDashboard();
        
    } catch (err) {
        console.error('Export failed:', err);
        hideLoading();
        showNotification(`Export failed: ${err.message}`, 'error');
    }
}

async function exportAllDraftEntries() {
    try {
        showLoading('Exporting all draft entries...');
        
        // Get all entries
        let entries = await dbOperations.getEntries();
        
        // Filter for draft entries only
        entries = entries.filter(entry => {
            const effectiveStatus = determineEntryStatus(entry);
            return effectiveStatus === 'draft';
        });
        
        if (entries.length === 0) {
            hideLoading();
            showNotification('No draft entries to export', 'warning');
            return;
        }
        
        const entryIds = entries.map(e => e.id);
        
        // Generate filename
        const dateStr = new Date().toISOString().split('T')[0];
        const filename = `time-entries-${dateStr}`;
        
        await api.exportEntries(entryIds, filename);
        
        // Update status of exported entries to 'exported'
        for (const entry of entries) {
            if (entry.narratives) {
                entry.narratives.forEach(narrative => {
                    narrative.status = 'exported';
                });
            }
            
            await dbOperations.updateEntry(entry.id, {
                status: 'exported',
                narratives: entry.narratives
            });
        }
        
        hideLoading();
        showNotification(`${entries.length} draft entries exported successfully`, 'success');
        
        // Refresh dashboard
        await loadDashboard();
        
    } catch (err) {
        console.error('Export failed:', err);
        hideLoading();
        showNotification(`Export failed: ${err.message}`, 'error');
    }
}

// Modal functions
function openModal() {
    const modal = document.getElementById('add-modal');
    modal.classList.add('active');
    resetModal();
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

function toggleEntrySelection(entryId) {
    if (selectedEntries.has(entryId)) {
        selectedEntries.delete(entryId);
    } else {
        selectedEntries.add(entryId);
    }
    
    // Update the Export button label
    updateExportButtonLabel();
    
    // Update row highlighting
    const rows = document.querySelectorAll(`tr[data-entry-id="${entryId}"]`);
    rows.forEach(row => {
        row.classList.toggle('selected', selectedEntries.has(entryId));
    });
    
    // Update checkbox state
    const checkboxes = document.querySelectorAll(`.table-action-checkbox[data-entry-id="${entryId}"]`);
    checkboxes.forEach(checkbox => {
        checkbox.checked = selectedEntries.has(entryId);
    });
}

function updateExportButtonLabel() {
    const exportBtn = document.querySelector('.nav-btn[data-view="export"]');
    if (exportBtn) {
        const count = selectedEntries.size;
        if (count > 0) {
            exportBtn.textContent = `Export (${count})`;
        } else {
            exportBtn.textContent = 'Export';
        }
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

// Context Recording Functions removed - feature deprecated

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
window.toggleNarrative = toggleNarrative;
window.changeEntryStatus = changeEntryStatus;

// Bulk assignment removed - not needed for list view

// Bulk assignment removed - not needed for list view

// Bulk assignment removed - not needed for list view

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

// Helper function for narrative expansion
function toggleNarrative(btn) {
    const narrativeContent = btn.closest('.narrative-content');
    const narrativeText = narrativeContent.querySelector('.narrative-text');
    const fullText = narrativeText.getAttribute('title');
    
    if (btn.textContent === 'more') {
        narrativeText.textContent = fullText;
        btn.textContent = 'less';
        narrativeContent.classList.add('expanded');
    } else {
        const maxLength = 150;
        narrativeText.textContent = fullText.substring(0, maxLength) + '...';
        btn.textContent = 'more';
        narrativeContent.classList.remove('expanded');
    }
}

// Mobile-specific functions
function toggleMobileNarrative(btn, entryId, narrativeIndex) {
    const row = btn.closest('tr');
    const narrativeDiv = row.querySelector('.narrative-text');
    
    // Get the full entry data
    const entry = currentEntries.find(e => e.id === entryId);
    if (!entry) return;
    
    const narrative = narrativeIndex !== null && entry.narratives ? 
        entry.narratives[narrativeIndex] : null;
    const fullText = narrative ? narrative.text : (entry.original_text || 'No narrative');
    
    if (btn.textContent === 'show more') {
        narrativeDiv.textContent = fullText;
        btn.textContent = 'show less';
    } else {
        const maxLength = 100;
        narrativeDiv.textContent = fullText.substring(0, maxLength) + '...';
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