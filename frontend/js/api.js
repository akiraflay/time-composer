const API_BASE = 'http://localhost:5001/api';

const api = {
    // Legacy methods - throw errors to alert developers of usage
    async getEntries() {
        throw new Error('getEntries() is deprecated. Use dbOperations.getAllEntries() for IndexedDB access.');
    },
    
    async getEntry(id) {
        throw new Error('getEntry() is deprecated. Use dbOperations.getEntry() for IndexedDB access.');
    },
    
    async updateEntry(id, data) {
        throw new Error('updateEntry() is deprecated. Use dbOperations.saveEntry() for IndexedDB access.');
    },
    
    async deleteEntry(id) {
        throw new Error('deleteEntry() is deprecated. Use dbOperations.deleteEntry() for IndexedDB access.');
    },
    
    async exportEntries(entryIds = [], filename = null) {
        throw new Error(
            'exportEntries() is deprecated. Use the new export functionality:\n' +
            '1. For CSV export: Click the export button on individual narratives or use bulk export from the dashboard\n' +
            '2. The export is now handled client-side using the Export class in frontend/js/export.js\n' +
            '3. To export programmatically: Use new Export().exportNarratives(narratives, filename)'
        );
    },
    
    async enhance(text) {
        const response = await fetch(`${API_BASE}/enhance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Enhancement failed');
        }
        
        return response.json();
    }
};

// Error handling wrapper
const apiCall = async (fn, ...args) => {
    try {
        return await fn(...args);
    } catch (error) {
        console.error('API Error:', error);
        showNotification('Error: ' + error.message, 'error');
        throw error;
    }
};

// Notification helper
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}