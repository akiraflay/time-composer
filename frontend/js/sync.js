// Sync manager for IndexedDB <-> SQLite synchronization
const syncManager = {
    isSyncing: false,
    syncInterval: null,
    
    async syncWithServer() {
        if (this.isSyncing) {
            console.log('Sync already in progress');
            return;
        }
        
        this.isSyncing = true;
        
        try {
            // Get pending entries from IndexedDB
            const pendingEntries = await dbOperations.getPendingSync();
            console.log(`Found ${pendingEntries.length} entries to sync`);
            
            for (const entry of pendingEntries) {
                try {
                    // Skip entries with invalid IDs (non-integers or timestamp-based)
                    if (typeof entry.id !== 'number' || !Number.isInteger(entry.id) || entry.id > 1000000) {
                        console.warn(`Skipping entry with invalid ID: ${entry.id}`);
                        // Delete the invalid entry from local storage
                        await dbOperations.deleteEntry(entry.id);
                        continue;
                    }
                    
                    if (entry.id && typeof entry.id === 'string' && entry.id.startsWith('local_')) {
                        // New entry created offline
                        const response = await api.enhance(entry.original_text);
                        
                        // Update local entry with server ID
                        await dbOperations.deleteEntry(entry.id);
                        await dbOperations.saveEntry({
                            ...entry,
                            id: response.entry.id,
                            sync_status: 'synced'
                        });
                    } else {
                        // Existing entry, update on server
                        await api.updateEntry(entry.id, {
                            client_code: entry.client_code,
                            matter_number: entry.matter_number,
                            narratives: entry.narratives,
                            total_hours: entry.total_hours,
                            status: entry.status,
                            attorney_email: entry.attorney_email,
                            attorney_name: entry.attorney_name,
                            task_codes: entry.task_codes,
                            tags: entry.tags
                        });
                        
                        await dbOperations.markSynced(entry.id);
                    }
                } catch (err) {
                    console.error(`Failed to sync entry ${entry.id}:`, err);
                }
            }
            
            // Pull latest from server
            await this.pullFromServer();
            
        } catch (err) {
            console.error('Sync error:', err);
        } finally {
            this.isSyncing = false;
        }
    },
    
    async pullFromServer() {
        try {
            const serverEntries = await api.getEntries();
            
            // Get local entries
            const localEntries = await dbOperations.getEntries();
            const localIds = new Set(localEntries.map(e => e.id));
            
            // Save new or updated entries
            for (const entry of serverEntries) {
                const localEntry = localEntries.find(e => e.id === entry.id);
                
                if (!localEntry || new Date(entry.updated_at) > new Date(localEntry.updated_at)) {
                    await dbOperations.saveEntry({
                        ...entry,
                        sync_status: 'synced'
                    });
                }
            }
            
            console.log('Pull from server completed');
        } catch (err) {
            console.error('Failed to pull from server:', err);
        }
    },
    
    startAutoSync(intervalMs = 30000) {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
        
        // Initial sync
        this.syncWithServer();
        
        // Set up periodic sync
        this.syncInterval = setInterval(() => {
            this.syncWithServer();
        }, intervalMs);
        
        // Sync on visibility change
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.syncWithServer();
            }
        });
        
        // Sync on online event
        window.addEventListener('online', () => {
            console.log('Back online, syncing...');
            this.syncWithServer();
        });
    },
    
    stopAutoSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    },
    
    async forceSync() {
        await this.syncWithServer();
        showNotification('Sync completed', 'success');
    }
};

// Network status monitoring
const networkStatus = {
    isOnline: navigator.onLine,
    
    init() {
        this.updateStatus();
        
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.updateStatus();
            showNotification('Back online', 'success');
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.updateStatus();
            showNotification('Working offline', 'warning');
        });
    },
    
    updateStatus() {
        const statusIndicator = document.getElementById('network-status');
        if (statusIndicator) {
            statusIndicator.className = this.isOnline ? 'online' : 'offline';
            statusIndicator.title = this.isOnline ? 'Online' : 'Offline';
        }
    }
};

// Conflict resolution
const conflictResolver = {
    async resolveConflict(localEntry, serverEntry) {
        // Simple last-write-wins strategy
        const localTime = new Date(localEntry.updated_at).getTime();
        const serverTime = new Date(serverEntry.updated_at).getTime();
        
        if (serverTime > localTime) {
            // Server wins
            return serverEntry;
        } else {
            // Local wins
            return localEntry;
        }
    }
};

// Export functions
window.syncManager = syncManager;
window.networkStatus = networkStatus;