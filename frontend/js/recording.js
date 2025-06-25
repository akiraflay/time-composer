// Audio recording and speech recognition
let mediaRecorder;
let audioChunks = [];
let startTime;
let pausedTime = 0;
let timerInterval;
let recognition;
let finalTranscript = '';
let isRecording = false;
let isPaused = false;
let audioContext;
let analyser;
let microphone;
let audioLevelInterval;

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
        // Restart if still recording and not paused
        if (isRecording && !isPaused) {
            try {
                recognition.start();
            } catch (e) {
                console.error('Failed to restart recognition:', e);
            }
        } else if (!isRecording) {
            // Show edit button when recording ends
            const editButton = document.getElementById('edit-transcription');
            if (editButton && finalTranscript) {
                editButton.classList.remove('hidden');
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
        
        // Set up audio analysis for level indicator
        setupAudioAnalysis(stream);
        
        // Start recording
        mediaRecorder.start(100); // Collect data every 100ms
        startTime = Date.now();
        pausedTime = 0;
        isRecording = true;
        isPaused = false;
        
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
        updateRecordingUI();
        
        // Start timer
        timerInterval = setInterval(updateTimer, 100);
        
    } catch (err) {
        console.error('Error accessing microphone:', err);
        alert('Please allow microphone access to record. Make sure your microphone is connected and permissions are granted.');
    }
};

const pauseRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.pause();
        isPaused = true;
        pausedTime += Date.now() - startTime;
        
        // Pause speech recognition
        if (recognition) {
            recognition.stop();
        }
        
        // Stop audio level monitoring
        if (audioLevelInterval) {
            clearInterval(audioLevelInterval);
        }
        
        updateRecordingUI();
    }
};

const resumeRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'paused') {
        mediaRecorder.resume();
        isPaused = false;
        startTime = Date.now();
        
        // Resume speech recognition
        if (speechRecognitionSupported && recognition) {
            try {
                recognition.start();
            } catch (e) {
                console.error('Failed to resume speech recognition:', e);
            }
        }
        
        // Resume audio level monitoring
        startAudioLevelMonitoring();
        
        updateRecordingUI();
    }
};

const setupAudioAnalysis = (stream) => {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        microphone = audioContext.createMediaStreamSource(stream);
        
        analyser.fftSize = 256;
        microphone.connect(analyser);
        
        startAudioLevelMonitoring();
    } catch (e) {
        console.error('Failed to setup audio analysis:', e);
    }
};

const startAudioLevelMonitoring = () => {
    if (!analyser) return;
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    audioLevelInterval = setInterval(() => {
        analyser.getByteFrequencyData(dataArray);
        
        // Calculate average audio level
        const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
        const normalizedLevel = average / 255;
        
        updateAudioLevelDisplay(normalizedLevel);
    }, 100);
};

const updateAudioLevelDisplay = (level) => {
    const levelBars = document.querySelectorAll('.level-bar');
    const threshold = 0.1;
    
    levelBars.forEach((bar, index) => {
        const barThreshold = (index + 1) * 0.2;
        if (level > threshold && level > barThreshold) {
            bar.style.background = level > 0.7 ? '#ef4444' : level > 0.4 ? '#f59e0b' : '#22c55e';
            bar.style.opacity = '1';
        } else {
            bar.style.background = '#e2e8f0';
            bar.style.opacity = '0.3';
        }
    });
};

const updateRecordingUI = () => {
    const recordButton = document.getElementById('record-btn');
    const recordText = document.querySelector('.record-text');
    const recordingTime = document.getElementById('recording-time');
    const secondaryControls = document.getElementById('recording-controls-secondary');
    const audioLevel = document.getElementById('audio-level');
    const waveform = document.getElementById('waveform-animation');
    
    if (isRecording && !isPaused) {
        recordButton.classList.add('recording');
        recordButton.classList.remove('paused');
        recordText.textContent = 'Recording...';
        recordingTime.classList.remove('hidden');
        secondaryControls.classList.remove('hidden');
        audioLevel.classList.remove('hidden');
        waveform.classList.remove('hidden');
        
        // Update pause button
        const pauseBtn = document.getElementById('pause-btn');
        pauseBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                <path d="M14,19H18V5H14M6,19H10V5H6V19Z"/>
            </svg>
            Pause
        `;
    } else if (isRecording && isPaused) {
        recordButton.classList.remove('recording');
        recordButton.classList.add('paused');
        recordText.textContent = 'Paused';
        audioLevel.classList.add('hidden');
        waveform.classList.add('hidden');
        
        // Update pause button to resume
        const pauseBtn = document.getElementById('pause-btn');
        pauseBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                <path d="M8,5.14V19.14L19,12.14L8,5.14Z"/>
            </svg>
            Resume
        `;
    } else {
        recordButton.classList.remove('recording', 'paused');
        recordText.textContent = 'Click to Record';
        recordingTime.classList.add('hidden');
        secondaryControls.classList.add('hidden');
        audioLevel.classList.add('hidden');
        waveform.classList.add('hidden');
    }
};

const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        isRecording = false;
        isPaused = false;
        
        // Stop media recorder
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
        
        // Stop speech recognition
        if (recognition) {
            recognition.stop();
        }
        
        // Stop timer and audio monitoring
        clearInterval(timerInterval);
        if (audioLevelInterval) {
            clearInterval(audioLevelInterval);
        }
        
        // Clean up audio context
        if (audioContext) {
            audioContext.close();
        }
        
        // Update UI
        const recordButton = document.getElementById('record-btn');
        const recordText = document.querySelector('.record-text');
        
        recordButton.classList.remove('recording', 'paused');
        recordText.textContent = 'Processing...';
        updateRecordingUI();
    }
};

const updateTimer = () => {
    if (isPaused) return;
    
    const currentTime = isRecording ? Date.now() : startTime;
    const elapsed = Math.floor((pausedTime + (currentTime - startTime)) / 1000);
    const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
    const seconds = (elapsed % 60).toString().padStart(2, '0');
    document.getElementById('recording-time').textContent = `${minutes}:${seconds}`;
};

const processRecording = async (audioBlob) => {
    try {
        // Show transcription step
        showAgentProcessing('transcription');
        
        // Delay for dramatic effect
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Get final transcription from Whisper API
        const { text } = await api.transcribe(audioBlob);
        
        // Complete transcription step
        setAgentStepCompleted('transcription');
        
        // Display the Whisper transcription (more accurate than live)
        document.getElementById('transcription').classList.remove('hidden');
        document.getElementById('transcription-text').textContent = text;
        
        // Hide live transcription
        document.getElementById('live-transcription').classList.add('hidden');
        
        // Start grammar agent step
        setAgentStepActive('grammar');
        await new Promise(resolve => setTimeout(resolve, 600));
        
        // Start separator agent step
        setAgentStepCompleted('grammar');
        setAgentStepActive('separator');
        await new Promise(resolve => setTimeout(resolve, 700));
        
        // Start refiner agent step
        setAgentStepCompleted('separator');
        setAgentStepActive('refiner');
        
        // Enhance with AI agents
        const response = await api.enhance(text);
        
        // Complete refiner step
        setAgentStepCompleted('refiner');
        
        // Delay before hiding to show completion
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Save the entry to IndexedDB
        const entryData = response.entry;
        await dbOperations.saveEntry({
            id: entryData.id,
            original_text: entryData.original_text,
            cleaned_text: entryData.cleaned_text,
            narratives: entryData.narratives,
            total_hours: entryData.total_hours,
            status: entryData.status || 'draft',
            created_at: entryData.created_at,
            updated_at: entryData.updated_at,
            client_code: entryData.client_code,
            matter_number: entryData.matter_number,
            attorney_email: entryData.attorney_email,
            attorney_name: entryData.attorney_name,
            task_codes: entryData.task_codes || [],
            tags: entryData.tags || []
        });
        
        // Display results
        displayEnhancedResults({
            narratives: entryData.narratives,
            total_hours: entryData.total_hours,
            total_entries: response.total_narratives || entryData.narratives.length
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

// Processing helpers with agent pipeline
const showAgentProcessing = (step = 'transcription') => {
    const overlay = document.getElementById('loading-overlay');
    overlay.classList.remove('hidden');
    
    // Reset all steps
    resetAgentSteps();
    
    // Activate the current step
    setAgentStepActive(step);
};

const setAgentStepActive = (stepName) => {
    const step = document.getElementById(`step-${stepName}`);
    if (step) {
        step.classList.add('active');
        const spinner = step.querySelector('.status-spinner');
        const pending = step.querySelector('.status-pending');
        
        if (spinner) {
            spinner.style.display = 'block';
        }
        if (pending) {
            pending.style.display = 'none';
        }
    }
};

const setAgentStepCompleted = (stepName) => {
    const step = document.getElementById(`step-${stepName}`);
    if (step) {
        step.classList.remove('active');
        step.classList.add('completed');
        
        const statusContainer = step.querySelector('.step-status');
        statusContainer.innerHTML = `
            <div class="status-completed">
                <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
                    <path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z"/>
                </svg>
            </div>
        `;
    }
};

const resetAgentSteps = () => {
    const steps = document.querySelectorAll('.agent-step');
    steps.forEach(step => {
        step.classList.remove('active', 'completed');
        const statusContainer = step.querySelector('.step-status');
        statusContainer.innerHTML = '<div class="status-pending"></div>';
    });
};

const hideLoading = () => {
    document.getElementById('loading-overlay').classList.add('hidden');
    resetAgentSteps();
};

// Legacy function for compatibility
const showLoading = (text = 'Processing...') => {
    showAgentProcessing('transcription');
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

// Initialize recording controls
document.addEventListener('DOMContentLoaded', () => {
    const recordButton = document.getElementById('record-btn');
    const pauseButton = document.getElementById('pause-btn');
    const stopButton = document.getElementById('stop-btn');
    const reRecordButton = document.getElementById('re-record-btn');
    const editTranscriptionButton = document.getElementById('edit-transcription');
    
    // Main record button
    if (recordButton) {
        recordButton.addEventListener('click', () => {
            if (isRecording) {
                stopRecording();
            } else {
                startRecording();
            }
        });
    }
    
    // Pause/Resume button
    if (pauseButton) {
        pauseButton.addEventListener('click', () => {
            if (isPaused) {
                resumeRecording();
            } else {
                pauseRecording();
            }
        });
    }
    
    // Stop button
    if (stopButton) {
        stopButton.addEventListener('click', () => {
            stopRecording();
        });
    }
    
    // Re-record button
    if (reRecordButton) {
        reRecordButton.addEventListener('click', () => {
            resetForNewRecording();
            startRecording();
        });
    }
    
    // Edit transcription button
    if (editTranscriptionButton) {
        editTranscriptionButton.addEventListener('click', () => {
            toggleTranscriptionEditing();
        });
    }
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Spacebar to start/stop recording (when modal is open)
        if (e.code === 'Space' && document.getElementById('add-modal').classList.contains('active')) {
            e.preventDefault();
            if (isRecording) {
                if (isPaused) {
                    resumeRecording();
                } else {
                    pauseRecording();
                }
            } else {
                startRecording();
            }
        }
        
        // Escape to stop recording
        if (e.code === 'Escape' && isRecording) {
            stopRecording();
        }
    });
});

// Helper functions for new features
const resetForNewRecording = () => {
    // Hide all sections
    document.getElementById('transcription').classList.add('hidden');
    document.getElementById('enhanced-results').classList.add('hidden');
    document.getElementById('live-transcription').classList.add('hidden');
    
    // Reset transcription content
    document.getElementById('transcription-text').textContent = '';
    document.getElementById('live-text').innerHTML = '';
    
    // Reset UI
    resetRecordingUI();
    
    // Clear any saved state
    finalTranscript = '';
    pausedTime = 0;
};

const toggleTranscriptionEditing = () => {
    const liveText = document.getElementById('live-text');
    const editButton = document.getElementById('edit-transcription');
    
    const isEditable = liveText.contentEditable === 'true';
    
    if (isEditable) {
        // Stop editing
        liveText.contentEditable = 'false';
        liveText.classList.remove('editing');
        editButton.innerHTML = `
            <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                <path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z"/>
            </svg>
            Edit
        `;
        // Update finalTranscript with edited content
        finalTranscript = liveText.textContent;
    } else {
        // Start editing
        liveText.contentEditable = 'true';
        liveText.focus();
        liveText.classList.add('editing');
        editButton.innerHTML = `
            <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                <path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z"/>
            </svg>
            Save
        `;
    }
};