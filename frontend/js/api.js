const API_BASE = 'http://localhost:5002/api';

const api = {
    async enhance(text) {
        try {
            const response = await fetch(`${API_BASE}/enhance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Enhancement API error:', response.status, errorText);
                throw new Error(`Enhancement failed: ${response.status}`);
            }
            
            return response.json();
        } catch (error) {
            console.error('API enhance error:', error);
            
            // Check if it's a network error (server not running)
            if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                throw new Error('Backend server is not running. Please start the server with "python run.py"');
            }
            
            throw error;
        }
    },
    
    async getEntries(filters = {}) {
        const params = new URLSearchParams();
        if (filters.status) params.append('status', filters.status);
        if (filters.client_code) params.append('client_code', filters.client_code);
        if (filters.start_date) params.append('start_date', filters.start_date);
        if (filters.end_date) params.append('end_date', filters.end_date);
        
        const response = await fetch(`${API_BASE}/entries?${params}`);
        
        if (!response.ok) {
            throw new Error('Failed to fetch entries');
        }
        
        return response.json();
    },
    
    async getEntry(id) {
        const response = await fetch(`${API_BASE}/entries/${id}`);
        
        if (!response.ok) {
            throw new Error('Failed to fetch entry');
        }
        
        return response.json();
    },
    
    async updateEntry(id, data) {
        const response = await fetch(`${API_BASE}/entries/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            throw new Error('Failed to update entry');
        }
        
        return response.json();
    },
    
    async deleteEntry(id) {
        const response = await fetch(`${API_BASE}/entries/${id}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error('Failed to delete entry');
        }
        
        return response.json();
    },
    
    async exportEntries(entryIds = [], filename = null) {
        const response = await fetch(`${API_BASE}/export`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entry_ids: entryIds })
        });
        
        if (!response.ok) {
            throw new Error('Export failed');
        }
        
        // Create download link
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        // Use provided filename or generate one
        if (filename) {
            a.download = `${filename}.csv`;
        } else {
            a.download = `time_entries_${new Date().toISOString().split('T')[0]}.csv`;
        }
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },
    
    async enhanceNarrativeContext(entryId, narrativeIndex, data) {
        try {
            const response = await fetch(`${API_BASE}/entries/${entryId}/enhance-context`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    narrative_index: narrativeIndex,
                    ...data
                })
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Context enhancement API error:', response.status, errorText);
                throw new Error(`Context enhancement failed: ${response.status}`);
            }
            
            return response.json();
        } catch (error) {
            console.error('API enhance context error:', error);
            
            if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                throw new Error('Backend server is not running. Please start the server with "python run.py"');
            }
            
            throw error;
        }
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