// Audio recording and speech recognition
let mediaRecorder;
let audioChunks = [];
let startTime;
let timerInterval;
let recognition;
let finalTranscript = '';
let isRecording = false;

// Check for Web Speech API support
const speechRecognitionSupported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;

// Initialize speech recognition
if (speechRecognitionSupported) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    
    recognition.onstart = () => {
        console.log('Speech recognition started');
        document.getElementById('live-transcription').classList.remove('hidden');
    };
    
    recognition.onresult = (event) => {
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            
            if (event.results[i].isFinal) {
                finalTranscript += transcript + ' ';
            } else {
                interimTranscript += transcript;
            }
        }
        
        // Update live transcription display
        const liveText = document.getElementById('live-text');
        liveText.innerHTML = finalTranscript + 
            (interimTranscript ? '<span class="interim">' + interimTranscript + '</span>' : '');
        
        // Auto-scroll to bottom
        liveText.scrollTop = liveText.scrollHeight;
    };
    
    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'no-speech') {
            // Restart recognition if no speech detected
            if (isRecording) {
                recognition.start();
            }
        }
    };
    
    recognition.onend = () => {
        console.log('Speech recognition ended');
        // Restart if still recording
        if (isRecording) {
            try {
                recognition.start();
            } catch (e) {
                console.error('Failed to restart recognition:', e);
            }
        }
    };
}

// Recording functions
const startRecording = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // Set up MediaRecorder for audio file
        const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
        mediaRecorder = new MediaRecorder(stream, { mimeType });
        
        audioChunks = [];
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };
        
        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: mimeType });
            await processRecording(audioBlob);
        };
        
        // Start recording
        mediaRecorder.start(100); // Collect data every 100ms
        startTime = Date.now();
        isRecording = true;
        
        // Start speech recognition for live transcription
        if (speechRecognitionSupported) {
            finalTranscript = '';
            try {
                recognition.start();
            } catch (e) {
                console.error('Failed to start speech recognition:', e);
            }
        }
        
        // Update UI
        const recordButton = document.getElementById('record-btn');
        const recordText = document.querySelector('.record-text');
        const recordingTime = document.getElementById('recording-time');
        
        recordButton.classList.add('recording');
        recordText.textContent = 'Recording...';
        recordingTime.classList.remove('hidden');
        
        // Start timer
        timerInterval = setInterval(updateTimer, 100);
        
    } catch (err) {
        console.error('Error accessing microphone:', err);
        alert('Please allow microphone access to record. Make sure your microphone is connected and permissions are granted.');
    }
};

const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        isRecording = false;
        
        // Stop media recorder
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
        
        // Stop speech recognition
        if (recognition) {
            recognition.stop();
        }
        
        // Stop timer
        clearInterval(timerInterval);
        
        // Update UI
        const recordButton = document.getElementById('record-btn');
        const recordText = document.querySelector('.record-text');
        
        recordButton.classList.remove('recording');
        recordText.textContent = 'Processing...';
    }
};

const updateTimer = () => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
    const seconds = (elapsed % 60).toString().padStart(2, '0');
    document.getElementById('recording-time').textContent = `${minutes}:${seconds}`;
};

const processRecording = async (audioBlob) => {
    try {
        // Show loading state
        showLoading('Transcribing audio...');
        
        // Get final transcription from Whisper API
        const { text } = await api.transcribe(audioBlob);
        
        // Display the Whisper transcription (more accurate than live)
        document.getElementById('transcription').classList.remove('hidden');
        document.getElementById('transcription-text').textContent = text;
        
        // Hide live transcription
        document.getElementById('live-transcription').classList.add('hidden');
        
        // Enhance with AI agents
        showLoading('Enhancing narrative...');
        const response = await api.enhance(text);
        
        // Save each entry to IndexedDB separately
        for (const entry of response.entries) {
            await dbOperations.saveEntry({
                id: entry.id,
                original_text: response.original_text,
                cleaned_text: response.cleaned_text,
                narratives: [entry.narrative],
                total_hours: entry.hours,
                status: 'draft',
                created_at: new Date().toISOString()
            });
        }
        
        // Display results
        displayEnhancedResults({
            narratives: response.entries.map(e => e.narrative),
            total_hours: response.total_hours,
            total_entries: response.total_entries
        });
        
        // Reset button
        const recordText = document.querySelector('.record-text');
        const recordingTime = document.getElementById('recording-time');
        
        recordText.textContent = 'Click to Record';
        recordingTime.classList.add('hidden');
        
        hideLoading();
        
    } catch (err) {
        console.error('Error processing recording:', err);
        hideLoading();
        alert('Error processing recording. Please try again.');
        resetRecordingUI();
    }
};

const displayEnhancedResults = (result) => {
    const container = document.getElementById('enhanced-results');
    const list = document.getElementById('narratives-list');
    
    list.innerHTML = '';
    
    // Update results header with summary
    const resultsHeader = container.querySelector('.results-header h3');
    if (result.total_entries > 1) {
        resultsHeader.textContent = `${result.total_entries} Time Entries (${result.total_hours} total hours)`;
    } else {
        resultsHeader.textContent = `Time Entry (${result.total_hours} hours)`;
    }
    
    result.narratives.forEach((narrative, index) => {
        const item = document.createElement('div');
        item.className = 'entry-card';
        item.innerHTML = `
            <div class="entry-card-header">
                <div class="entry-number">Entry ${index + 1}</div>
                <div class="entry-hours">${narrative.hours}h</div>
            </div>
            <div class="entry-narrative">${narrative.text}</div>
            <div class="entry-metadata-inputs">
                <input type="text" class="entry-client-code" placeholder="Client Code" data-entry="${index}">
                <input type="text" class="entry-matter-number" placeholder="Matter Number" data-entry="${index}">
            </div>
        `;
        list.appendChild(item);
    });
    
    container.classList.remove('hidden');
    document.getElementById('save-entries').classList.remove('hidden');
    
    // Store result for saving
    container.dataset.result = JSON.stringify(result);
    
    // Set up batch apply functionality
    setupBatchApply();
    setupTranscriptionToggle();
};

const resetRecordingUI = () => {
    const recordButton = document.getElementById('record-btn');
    const recordText = document.querySelector('.record-text');
    const recordingTime = document.getElementById('recording-time');
    
    recordButton.classList.remove('recording');
    recordText.textContent = 'Click to Record';
    recordingTime.classList.add('hidden');
    recordingTime.textContent = '00:00';
    
    // Clear live transcription
    document.getElementById('live-text').innerHTML = '';
    document.getElementById('live-transcription').classList.add('hidden');
    
    finalTranscript = '';
};

// Loading helpers
const showLoading = (text = 'Processing...') => {
    const overlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');
    
    loadingText.textContent = text;
    overlay.classList.remove('hidden');
};

const hideLoading = () => {
    document.getElementById('loading-overlay').classList.add('hidden');
};

// Batch apply functionality
const setupBatchApply = () => {
    const applyBtn = document.getElementById('apply-to-all');
    if (applyBtn) {
        applyBtn.addEventListener('click', () => {
            const batchClientCode = document.getElementById('batch-client-code').value;
            const batchMatterNumber = document.getElementById('batch-matter-number').value;
            
            // Apply to all entry inputs
            document.querySelectorAll('.entry-client-code').forEach(input => {
                if (batchClientCode) input.value = batchClientCode;
            });
            
            document.querySelectorAll('.entry-matter-number').forEach(input => {
                if (batchMatterNumber) input.value = batchMatterNumber;
            });
            
            // Clear batch inputs
            document.getElementById('batch-client-code').value = '';
            document.getElementById('batch-matter-number').value = '';
        });
    }
};

// Transcription toggle functionality
const setupTranscriptionToggle = () => {
    const toggleBtn = document.getElementById('toggle-transcription');
    const content = document.getElementById('transcription-content');
    
    if (toggleBtn && content) {
        toggleBtn.addEventListener('click', () => {
            content.classList.toggle('hidden');
            const isHidden = content.classList.contains('hidden');
            toggleBtn.querySelector('svg').style.transform = isHidden ? 'rotate(0deg)' : 'rotate(180deg)';
            toggleBtn.lastChild.textContent = isHidden ? 'Show Details' : 'Hide Details';
        });
    }
};

// Initialize recording button
document.addEventListener('DOMContentLoaded', () => {
    const recordButton = document.getElementById('record-btn');
    if (recordButton) {
        recordButton.addEventListener('click', () => {
            if (isRecording) {
                stopRecording();
            } else {
                startRecording();
            }
        });
    }
});