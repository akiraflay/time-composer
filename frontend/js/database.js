const DB_NAME = 'TimeComposerDB';
const DB_VERSION = 2; // Increment version for schema change
const STORE_NAME = 'narratives'; // Changed from 'entries' to 'narratives'

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
            // console.log('IndexedDB initialized');
            resolve(db);
        };
        
        request.onupgradeneeded = (event) => {
            db = event.target.result;
            
            // Delete old store if it exists
            if (db.objectStoreNames.contains('entries')) {
                db.deleteObjectStore('entries');
            }
            
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { 
                    keyPath: 'id',
                    autoIncrement: false // We'll use UUIDs
                });
                
                // Create indexes for the new narrative structure
                store.createIndex('createdAt', 'createdAt', { unique: false });
                store.createIndex('status', 'status', { unique: false });
                store.createIndex('clientCode', 'clientCode', { unique: false });
                store.createIndex('matterNumber', 'matterNumber', { unique: false });
                store.createIndex('groupId', 'groupId', { unique: false });
                store.createIndex('exportBatchId', 'exportBatchId', { unique: false });
            }
        };
    });
};

// Helper function to generate UUID
const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

// Database operations
const dbOperations = {
    async saveNarrative(narrative) {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        // Ensure narrative has required fields
        narrative.id = narrative.id || generateUUID();
        narrative.createdAt = narrative.createdAt || new Date().toISOString();
        narrative.updatedAt = new Date().toISOString();
        narrative.status = narrative.status || 'draft';
        
        return new Promise((resolve, reject) => {
            const request = store.put(narrative);
            request.onsuccess = () => resolve(narrative.id);
            request.onerror = () => reject(request.error);
        });
    },
    
    async getNarratives(filters = {}) {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => {
                let narratives = request.result;
                
                // Apply filters
                if (filters.status) {
                    narratives = narratives.filter(n => n.status === filters.status);
                }
                if (filters.clientCode) {
                    narratives = narratives.filter(n => n.clientCode === filters.clientCode);
                }
                if (filters.matterNumber) {
                    narratives = narratives.filter(n => n.matterNumber === filters.matterNumber);
                }
                if (filters.groupId) {
                    narratives = narratives.filter(n => n.groupId === filters.groupId);
                }
                if (filters.search) {
                    const searchLower = filters.search.toLowerCase();
                    narratives = narratives.filter(n => 
                        n.narrative?.toLowerCase().includes(searchLower) ||
                        n.originalText?.toLowerCase().includes(searchLower) ||
                        n.cleanedText?.toLowerCase().includes(searchLower)
                    );
                }
                
                // Sort by createdAt descending
                narratives.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                
                resolve(narratives);
            };
            request.onerror = () => reject(request.error);
        });
    },
    
    async getNarrative(id) {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        
        return new Promise((resolve, reject) => {
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },
    
    async updateNarrative(id, updates) {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        return new Promise(async (resolve, reject) => {
            const getRequest = store.get(id);
            
            getRequest.onsuccess = () => {
                const narrative = getRequest.result;
                if (!narrative) {
                    reject(new Error('Narrative not found'));
                    return;
                }
                
                // Merge updates
                Object.assign(narrative, updates);
                narrative.updatedAt = new Date().toISOString();
                
                const putRequest = store.put(narrative);
                putRequest.onsuccess = () => resolve(narrative);
                putRequest.onerror = () => reject(putRequest.error);
            };
            
            getRequest.onerror = () => reject(getRequest.error);
        });
    },
    
    async deleteNarrative(id) {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        return new Promise((resolve, reject) => {
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },
    
    async getNarrativesByGroup(groupId) {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('groupId');
        
        return new Promise((resolve, reject) => {
            const request = index.getAll(groupId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },
    
    async markAsExported(ids, batchId) {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const exportedAt = new Date().toISOString();
        
        const promises = ids.map(id => {
            return new Promise((resolve, reject) => {
                const getRequest = store.get(id);
                
                getRequest.onsuccess = () => {
                    const narrative = getRequest.result;
                    if (narrative) {
                        narrative.status = 'exported';
                        narrative.exportedAt = exportedAt;
                        narrative.exportBatchId = batchId;
                        narrative.updatedAt = exportedAt;
                        
                        const putRequest = store.put(narrative);
                        putRequest.onsuccess = () => resolve();
                        putRequest.onerror = () => reject(putRequest.error);
                    } else {
                        resolve();
                    }
                };
                
                getRequest.onerror = () => reject(getRequest.error);
            });
        });
        
        return Promise.all(promises);
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
    
    // Backward compatibility aliases
    async getEntries(filters = {}) {
        return this.getNarratives(filters);
    },
    
    async getEntry(id) {
        return this.getNarrative(id);
    },
    
    async saveEntry(entry) {
        // Convert old entry format to narrative format
        if (entry.narratives && Array.isArray(entry.narratives)) {
            // Save each narrative as individual record
            const groupId = generateUUID();
            const promises = entry.narratives.map(n => {
                return this.saveNarrative({
                    narrative: n.text,
                    hours: n.hours,
                    clientCode: n.client_code || entry.client_code,
                    matterNumber: n.matter_number || entry.matter_number,
                    status: entry.status || 'draft',
                    groupId: groupId,
                    originalText: entry.original_text,
                    cleanedText: entry.cleaned_text
                });
            });
            return Promise.all(promises);
        } else {
            // Single narrative
            return this.saveNarrative(entry);
        }
    },
    
    async updateEntry(id, updates) {
        return this.updateNarrative(id, updates);
    },
    
    async deleteEntry(id) {
        return this.deleteNarrative(id);
    },
    
    async cleanupInvalidEntries() {
        // No longer needed with UUID-based IDs
        return 0;
    }
};

// Export for use in other modules
window.dbOperations = dbOperations;
window.initDB = initDB;