const API_BASE = 'http://localhost:5001/api';

const api = {
    async transcribe(audioBlob) {
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        
        const response = await fetch(`${API_BASE}/transcribe`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error('Transcription failed');
        }
        
        return response.json();
    },
    
    async enhance(text) {
        const response = await fetch(`${API_BASE}/enhance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });
        
        if (!response.ok) {
            throw new Error('Enhancement failed');
        }
        
        return response.json();
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
    
    async exportEntries(entryIds = []) {
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
        a.download = `time_entries_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
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