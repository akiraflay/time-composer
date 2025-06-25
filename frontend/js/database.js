const DB_NAME = 'TimeComposerDB';
const DB_VERSION = 1;
const STORE_NAME = 'entries';

let db;

// Initialize IndexedDB
const initDB = async () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => {
            console.error('IndexedDB error:', request.error);
            reject(request.error);
        };
        
        request.onsuccess = () => {
            db = request.result;
            console.log('IndexedDB initialized');
            resolve(db);
        };
        
        request.onupgradeneeded = (event) => {
            db = event.target.result;
            
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { 
                    keyPath: 'id',
                    autoIncrement: true
                });
                
                // Create indexes
                store.createIndex('created_at', 'created_at', { unique: false });
                store.createIndex('status', 'status', { unique: false });
                store.createIndex('sync_status', 'sync_status', { unique: false });
                store.createIndex('client_code', 'client_code', { unique: false });
            }
        };
    });
};

// Database operations
const dbOperations = {
    async saveEntry(entry) {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        // Add metadata
        entry.sync_status = entry.sync_status || 'pending';
        entry.created_at = entry.created_at || new Date().toISOString();
        entry.updated_at = new Date().toISOString();
        
        return new Promise((resolve, reject) => {
            const request = store.put(entry);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },
    
    async getEntries(filters = {}) {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => {
                let entries = request.result;
                
                // Apply filters
                if (filters.status) {
                    entries = entries.filter(e => e.status === filters.status);
                }
                if (filters.client_code) {
                    entries = entries.filter(e => e.client_code === filters.client_code);
                }
                if (filters.search) {
                    const searchLower = filters.search.toLowerCase();
                    entries = entries.filter(e => 
                        e.original_text?.toLowerCase().includes(searchLower) ||
                        e.cleaned_text?.toLowerCase().includes(searchLower) ||
                        e.narratives?.some(n => n.text?.toLowerCase().includes(searchLower))
                    );
                }
                
                // Sort by created_at descending
                entries.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                
                resolve(entries);
            };
            request.onerror = () => reject(request.error);
        });
    },
    
    async getEntry(id) {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        
        return new Promise((resolve, reject) => {
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },
    
    async updateEntry(id, updates) {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        return new Promise(async (resolve, reject) => {
            const getRequest = store.get(id);
            
            getRequest.onsuccess = () => {
                const entry = getRequest.result;
                if (!entry) {
                    reject(new Error('Entry not found'));
                    return;
                }
                
                // Merge updates
                Object.assign(entry, updates);
                entry.sync_status = 'pending';
                entry.updated_at = new Date().toISOString();
                
                const putRequest = store.put(entry);
                putRequest.onsuccess = () => resolve(entry);
                putRequest.onerror = () => reject(putRequest.error);
            };
            
            getRequest.onerror = () => reject(getRequest.error);
        });
    },
    
    async deleteEntry(id) {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        return new Promise((resolve, reject) => {
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },
    
    async markSynced(id) {
        return this.updateEntry(id, { sync_status: 'synced' });
    },
    
    async getPendingSync() {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('sync_status');
        
        return new Promise((resolve, reject) => {
            const request = index.getAll('pending');
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },
    
    async clearAll() {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        return new Promise((resolve, reject) => {
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },
    
    async cleanupInvalidEntries() {
        // Remove entries with non-integer IDs (timestamp-based IDs)
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        return new Promise((resolve, reject) => {
            const request = store.openCursor();
            let deletedCount = 0;
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    const entry = cursor.value;
                    // Check if ID is not a valid integer
                    if (typeof entry.id !== 'number' || !Number.isInteger(entry.id) || entry.id > 1000000) {
                        cursor.delete();
                        deletedCount++;
                        console.log(`Deleting invalid entry with ID: ${entry.id}`);
                    }
                    cursor.continue();
                } else {
                    console.log(`Cleaned up ${deletedCount} entries with invalid IDs`);
                    resolve(deletedCount);
                }
            };
            
            request.onerror = () => reject(request.error);
        });
    }
};

// Export for use in other modules
window.dbOperations = dbOperations;
window.initDB = initDB;