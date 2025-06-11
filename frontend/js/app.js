// Main application logic
let currentView = 'dashboard';
let currentEntries = [];
let currentEntry = null;

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
    
    if (searchInput) {
        searchInput.addEventListener('input', debounce(() => loadDashboard(), 300));
    }
    
    if (statusFilter) {
        statusFilter.addEventListener('change', () => loadDashboard());
    }
    
    // Modal controls
    const addButton = document.getElementById('add-time-entry');
    const modal = document.getElementById('add-modal');
    const closeButton = document.getElementById('close-modal');
    const cancelButton = document.getElementById('cancel-modal');
    const saveButton = document.getElementById('save-entries');
    
    if (addButton) {
        addButton.addEventListener('click', () => openModal());
    }
    
    if (closeButton) {
        closeButton.addEventListener('click', () => closeModal());
    }
    
    if (cancelButton) {
        cancelButton.addEventListener('click', () => closeModal());
    }
    
    if (saveButton) {
        saveButton.addEventListener('click', () => saveEntries());
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
    
    // Modal backdrop click
    modal?.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
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

// Dashboard functionality
async function loadDashboard() {
    try {
        const search = document.getElementById('search')?.value || '';
        const status = document.getElementById('status-filter')?.value || '';
        
        // Get entries from IndexedDB
        const entries = await dbOperations.getEntries({ search, status });
        currentEntries = entries;
        
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
        
        entries.forEach(entry => {
            const card = createEntryCard(entry);
            container.appendChild(card);
        });
        
    } catch (err) {
        console.error('Error loading dashboard:', err);
        showNotification('Failed to load entries', 'error');
    }
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
        </div>
    `).join('');
    
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
            <button class="edit-btn" onclick="editEntry(${entry.id})">Edit</button>
            <button class="delete-btn" onclick="deleteEntry(${entry.id})">Delete</button>
        </div>
    `;
    
    return card;
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

// Make functions available globally
window.editEntry = editEntry;
window.deleteEntry = deleteEntry;