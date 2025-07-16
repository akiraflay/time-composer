const API_BASE = 'http://localhost:5001/api';

const api = {
    // Legacy methods - no longer used but kept for compatibility
    async getEntries() {
        // Returns empty array - data is now in IndexedDB
        return [];
    },
    
    async getEntry(id) {
        // Returns null - data is now in IndexedDB
        return null;
    },
    
    async updateEntry(id, data) {
        // No-op - data is now in IndexedDB
        return data;
    },
    
    async deleteEntry(id) {
        // No-op - data is now in IndexedDB
        return { success: true };
    },
    
    async exportEntries(entryIds = [], filename = null) {
        // Legacy method - no longer used
        console.warn('exportEntries is deprecated. Use the new export functionality.');
        return true;
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