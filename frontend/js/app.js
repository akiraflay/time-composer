// Main application logic
let currentView = 'dashboard';
let currentEntries = [];
let currentEntry = null;
let viewMode = 'expanded'; // expanded, condensed
let dateFilter = '';
let clientFilter = '';
let matterFilter = '';
let hoursFilter = '';
let taskFilter = '';
let customDateRange = null;
let quickTimeFilter = 'all';
let advancedFiltersVisible = false;

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
    
    // Load initial view
    loadDashboard();
});

// Event listeners
function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const view = e.target.dataset.view;
            switchView(view);
        });
    });
    
    // Dashboard controls
    const searchInput = document.getElementById('search');
    const statusFilter = document.getElementById('status-filter');
    const clientFilterEl = document.getElementById('client-filter');
    const matterFilterEl = document.getElementById('matter-filter');
    const hoursFilterEl = document.getElementById('hours-filter');
    const taskFilterEl = document.getElementById('task-filter');
    const clearFiltersBtn = document.getElementById('clear-filters');
    const filterToggleBtn = document.getElementById('filter-toggle');
    const advancedFiltersPanel = document.getElementById('advanced-filters-panel');
    const applyFiltersBtn = document.getElementById('apply-filters');
    const dateRangeStart = document.getElementById('date-range-start');
    const dateRangeEnd = document.getElementById('date-range-end');
    
    if (searchInput) {
        searchInput.addEventListener('input', debounce(() => loadDashboard(), 300));
    }
    
    if (statusFilter) {
        statusFilter.addEventListener('change', () => loadDashboard());
    }
    
    // Quick time filter buttons
    document.querySelectorAll('.time-filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Update active state
            document.querySelectorAll('.time-filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            quickTimeFilter = e.target.dataset.period;
            updateDateFiltering();
            loadDashboard();
        });
    });
    
    // Date range inputs
    if (dateRangeStart) {
        dateRangeStart.addEventListener('change', () => {
            updateDateFiltering();
            loadDashboard();
        });
    }
    
    if (dateRangeEnd) {
        dateRangeEnd.addEventListener('change', () => {
            updateDateFiltering();
            loadDashboard();
        });
    }
    
    // Filter toggle button
    if (filterToggleBtn) {
        filterToggleBtn.addEventListener('click', () => {
            advancedFiltersVisible = !advancedFiltersVisible;
            advancedFiltersPanel.classList.toggle('hidden', !advancedFiltersVisible);
            filterToggleBtn.classList.toggle('active', advancedFiltersVisible);
        });
    }
    
    // Apply filters button
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', () => {
            loadDashboard();
        });
    }
    
    if (clientFilterEl) {
        clientFilterEl.addEventListener('change', (e) => {
            clientFilter = e.target.value;
            loadDashboard();
        });
    }
    
    if (matterFilterEl) {
        matterFilterEl.addEventListener('change', (e) => {
            matterFilter = e.target.value;
            loadDashboard();
        });
    }
    
    if (hoursFilterEl) {
        hoursFilterEl.addEventListener('change', (e) => {
            hoursFilter = e.target.value;
            loadDashboard();
        });
    }
    
    if (taskFilterEl) {
        taskFilterEl.addEventListener('input', debounce((e) => {
            taskFilter = e.target.value;
            loadDashboard();
        }, 300));
    }
    
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => clearAllFilters());
    }
    
    
    // View mode toggles
    document.querySelectorAll('.view-toggle-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const mode = e.currentTarget.dataset.viewMode;
            setViewMode(mode);
        });
    });
    
    // AI Assistant controls
    const addButton = document.getElementById('add-time-entry');
    
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
    
    // Keep old modal functionality for fallback
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
    
    // Modal backdrop click
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
    
    // Edit modal backdrop click
    editModal?.addEventListener('click', (e) => {
        if (e.target === editModal) {
            closeEditModal();
        }
    });
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

// View mode management
function setViewMode(mode) {
    viewMode = mode;
    
    // Update toggle buttons
    document.querySelectorAll('.view-toggle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.viewMode === mode);
    });
    
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

// New date filtering logic
function updateDateFiltering() {
    const startDate = document.getElementById('date-range-start')?.value;
    const endDate = document.getElementById('date-range-end')?.value;
    
    if (startDate || endDate) {
        // If manual dates are set, use them regardless of quick filter
        customDateRange = {
            start: startDate || null,
            end: endDate || null
        };
        // Clear quick filter active state when manual dates are used
        if (startDate || endDate) {
            document.querySelectorAll('.time-filter-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelector('.time-filter-btn[data-period="all"]')?.classList.add('active');
            quickTimeFilter = 'all';
        }
    } else {
        customDateRange = null;
    }
    
    updateDateRangeDisplay();
}

function getQuickTimeRange(period) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (period) {
        case 'daily':
            return {
                start: today,
                end: new Date(today.getTime() + 24 * 60 * 60 * 1000)
            };
        case 'weekly':
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - today.getDay());
            return {
                start: weekStart,
                end: new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)
            };
        case 'monthly':
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
    clientFilter = '';
    matterFilter = '';
    hoursFilter = '';
    taskFilter = '';
    customDateRange = null;
    quickTimeFilter = 'all';
    
    // Reset UI elements
    document.getElementById('search').value = '';
    document.getElementById('client-filter').value = '';
    document.getElementById('matter-filter').value = '';
    document.getElementById('hours-filter').value = '';
    document.getElementById('status-filter').value = '';
    document.getElementById('task-filter').value = '';
    document.getElementById('date-range-start').value = '';
    document.getElementById('date-range-end').value = '';
    
    // Reset quick time filter buttons
    document.querySelectorAll('.time-filter-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector('.time-filter-btn[data-period="all"]')?.classList.add('active');
    
    // Update display and reload
    updateDateRangeDisplay();
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


// Dashboard functionality
async function loadDashboard() {
    try {
        const search = document.getElementById('search')?.value || '';
        const status = document.getElementById('status-filter')?.value || '';
        
        // Get entries from IndexedDB
        let entries = await dbOperations.getEntries({ search, status });
        
        // Apply date filter - use quick time filter or custom range
        let dateRange = null;
        if (customDateRange && (customDateRange.start || customDateRange.end)) {
            // Use custom date range
            dateRange = {
                start: customDateRange.start ? new Date(customDateRange.start) : null,
                end: customDateRange.end ? new Date(customDateRange.end + 'T23:59:59.999Z') : null
            };
        } else if (quickTimeFilter !== 'all') {
            // Use quick time filter
            dateRange = getQuickTimeRange(quickTimeFilter);
        }
        
        if (dateRange) {
            entries = entries.filter(entry => {
                const entryDate = new Date(entry.created_at);
                let withinRange = true;
                
                if (dateRange.start && entryDate < dateRange.start) {
                    withinRange = false;
                }
                if (dateRange.end && entryDate >= dateRange.end) {
                    withinRange = false;
                }
                
                return withinRange;
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
    
    const totalHours = entry.total_hours || 0;
    const date = new Date(entry.created_at);
    const dateStr = date.toLocaleDateString();
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const narrativesHtml = (entry.narratives || []).map(n => `
        <div class="narrative-item">
            <div class="narrative-header">
                <span>${n.hours} hours</span>
            </div>
            <div class="narrative-text">${n.text}</div>
            <div class="narrative-meta">
                <div class="narrative-client">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
                        <path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z"/>
                    </svg>
                    ${n.client_code || entry.client_code || 'No Client'}
                </div>
                ${n.matter_number || entry.matter_number ? `
                    <div class="narrative-matter">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
                            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                        </svg>
                        ${n.matter_number || entry.matter_number}
                    </div>
                ` : ''}
            </div>
        </div>
    `).join('');
    
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
        const truncatedText = firstNarrative.length > 80 ? firstNarrative.substring(0, 80) + '...' : firstNarrative;
        
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
                <span class="entry-status status-${entry.status || 'draft'}">${entry.status || 'draft'}</span>
            </div>
            <div class="narrative-item expanded-content hidden">
                ${narrativesHtml}
            </div>
            <div class="entry-actions">
                <button class="edit-btn" onclick="openEditModal(${entry.id})">Edit</button>
                <button class="delete-btn" onclick="deleteEntry(${entry.id})">Delete</button>
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
                        ${dateStr} ${timeStr}
                    </span>
                    <span class="entry-meta-item">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                            <path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z"/>
                        </svg>
                        ${entry.client_code || 'No Client'}
                    </span>
                    <span class="entry-meta-item">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                            <path d="M12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22C6.47,22 2,17.5 2,12A10,10 0 0,1 12,2M12.5,7V12.25L17,14.92L16.25,16.15L11,13V7H12.5Z"/>
                        </svg>
                        ${totalHours} hours
                    </span>
                </div>
                <span class="entry-status status-${entry.status || 'draft'}">${entry.status || 'draft'}</span>
            </div>
            ${narrativesHtml}
            <div class="entry-actions">
                <button class="edit-btn" onclick="openEditModal(${entry.id})">Edit</button>
                <button class="delete-btn" onclick="deleteEntry(${entry.id})">Delete</button>
            </div>
        `;
    }
    
    return card;
}

// Condensed table view rendering
function renderCondensedView(entries, container) {
    const table = document.createElement('table');
    table.innerHTML = `
        <thead>
            <tr>
                <th>Client</th>
                <th>Matter</th>
                <th>Date</th>
                <th>Duration</th>
                <th>Description</th>
                <th>Status</th>
                <th></th>
            </tr>
        </thead>
        <tbody></tbody>
    `;
    
    const tbody = table.querySelector('tbody');
    
    entries.forEach(entry => {
        // Create rows for each narrative within the entry
        if (entry.narratives && entry.narratives.length > 0) {
            entry.narratives.forEach(narrative => {
                const row = createCondensedRow(entry, narrative);
                tbody.appendChild(row);
            });
        } else {
            // Fallback for entries without narratives
            const row = createCondensedRow(entry, null);
            tbody.appendChild(row);
        }
    });
    
    container.appendChild(table);
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

// Create condensed table row for each narrative
function createCondensedRow(entry, narrative) {
    const row = document.createElement('tr');
    
    const date = new Date(entry.created_at);
    const dateStr = date.toLocaleDateString('en-US', { 
        month: '2-digit', 
        day: '2-digit', 
        year: '2-digit' 
    });
    
    // Use narrative data if available, otherwise entry data
    const clientCode = (narrative?.client_code || entry.client_code || 'No Client');
    const matterNumber = (narrative?.matter_number || entry.matter_number || '-');
    const hours = narrative ? narrative.hours : entry.total_hours || 0;
    const description = narrative ? narrative.text : (entry.original_text || 'No description');
    const status = entry.status || 'draft';
    
    row.innerHTML = `
        <td class="condensed-client">${clientCode}</td>
        <td class="condensed-matter">${matterNumber}</td>
        <td class="condensed-date">${dateStr}</td>
        <td class="condensed-duration">${hours}h</td>
        <td class="condensed-description" title="${description}">${description}</td>
        <td class="condensed-status">
            <span class="entry-status status-${status}">${status.charAt(0).toUpperCase() + status.slice(1)}</span>
        </td>
        <td class="condensed-actions">
            <div class="table-actions">
                <button class="table-action-btn edit-btn" onclick="openEditModal(${entry.id})">Edit</button>
                <button class="table-action-btn delete-btn" onclick="deleteEntry(${entry.id})">Delete</button>
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
        
        hideLoading();
        showNotification('Export completed successfully', 'success');
        
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
                status: 'ready'
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
                    status: 'ready'
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
    // Set status
    document.getElementById('edit-entry-status').value = entry.status || 'draft';
    
    // Set date
    const date = new Date(entry.created_at);
    const localDateTime = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
        .toISOString().slice(0, 16);
    document.getElementById('edit-entry-date').value = localDateTime;
    
    // Load presets
    loadPresets();
    
    // Populate narratives
    const container = document.getElementById('edit-narratives-container');
    container.innerHTML = '';
    
    (entry.narratives || []).forEach((narrative, index) => {
        const narrativeItem = document.createElement('div');
        narrativeItem.className = 'edit-narrative-item';
        narrativeItem.innerHTML = `
            <div class="edit-narrative-header">
                <span>Activity ${index + 1}</span>
                <span class="narrative-hours-display">${narrative.hours} hours</span>
            </div>
            <div class="edit-form-grid">
                <div class="edit-form-group">
                    <label>Hours</label>
                    <input type="number" step="0.1" min="0" class="narrative-hours-input" value="${narrative.hours}" data-index="${index}">
                </div>
                <div class="edit-form-group">
                    <label>Task Code</label>
                    <input type="text" class="narrative-task-input" value="${narrative.task_code || ''}" data-index="${index}">
                </div>
                <div class="edit-form-group">
                    <label>Client Code</label>
                    <input type="text" class="narrative-client-input" value="${narrative.client_code || entry.client_code || ''}" data-index="${index}">
                </div>
                <div class="edit-form-group">
                    <label>Matter Number</label>
                    <input type="text" class="narrative-matter-input" value="${narrative.matter_number || entry.matter_number || ''}" data-index="${index}">
                </div>
                <div class="edit-form-group full-width">
                    <label>Narrative Text</label>
                    <textarea rows="3" class="narrative-text-input" data-index="${index}">${narrative.text}</textarea>
                </div>
            </div>
        `;
        container.appendChild(narrativeItem);
    });
}

async function saveEditChanges() {
    if (!currentEditingEntry) return;
    
    try {
        // Collect the updated data
        const updatedEntry = {
            ...currentEditingEntry,
            status: document.getElementById('edit-entry-status').value,
            created_at: new Date(document.getElementById('edit-entry-date').value).toISOString(),
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
                text: item.querySelector('.narrative-text-input').value
            };
            updatedEntry.narratives.push(narrative);
        });
        
        // Recalculate total hours
        updatedEntry.total_hours = updatedEntry.narratives.reduce((sum, n) => sum + n.hours, 0);
        
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

// Make functions available globally
window.editEntry = editEntry;
window.deleteEntry = deleteEntry;
window.openEditModal = openEditModal;
window.closeEditModal = closeEditModal;
window.saveEditChanges = saveEditChanges;
window.addNewPreset = addNewPreset;