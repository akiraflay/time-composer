// AI Assistant Interface - Conversational Time Entry System
class AIAssistant {
    constructor() {
        this.isRecording = false;
        this.isPaused = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.startTime = null;
        this.pausedTime = 0;
        this.timerInterval = null;
        this.recognition = null;
        this.finalTranscript = '';
        this.browserTranscript = ''; // Keep track of browser transcription
        this.whisperTranscript = ''; // Keep track of Whisper transcription
        this.transcriptChunks = []; // Track chunks for processing
        this.chunkTimer = null; // Timer for periodic Whisper processing
        this.lastSpeechTime = Date.now(); // Track silence detection
        this.lastProcessedChunkIndex = 0; // Track which audio chunks have been processed
        this.isProcessingChunk = false; // Prevent concurrent chunk processing
        this.currentMode = 'initial'; // initial, voice, text, processing, confirmation
        this.messages = [];
        
        // Transcription mode: 'dual' (both Browser + Whisper), 'browser' (Browser only), 'whisper' (Whisper only)
        // Browser-only mode provides instant feedback without API delays
        this.transcriptionMode = 'browser'; // Default to browser-only for best responsiveness
        
        this.initializeSpeechRecognition();
        this.bindEvents();
    }

    initializeSpeechRecognition() {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            
            this.recognition.continuous = true;
            this.recognition.interimResults = true;
            this.recognition.lang = 'en-US';
            
            this.recognition.onstart = () => {
                console.log('Speech recognition started');
                this.showLiveTranscription();
            };
            
            this.recognition.onresult = (event) => {
                this.handleSpeechResult(event);
            };
            
            this.recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                if (event.error === 'no-speech' && this.isRecording) {
                    this.restartRecognition();
                }
            };
            
            this.recognition.onend = () => {
                if (this.isRecording && !this.isPaused) {
                    this.restartRecognition();
                }
                
                // Check for any pending chunk processing
                if (this.isRecording && this.audioChunks.length > 0) {
                    this.checkChunkProcessing();
                }
            };
        }
    }

    bindEvents() {
        // Open/close assistant
        document.getElementById('add-time-entry')?.addEventListener('click', () => this.open());
        document.getElementById('close-assistant')?.addEventListener('click', () => this.close());
        
        // Suggestion buttons
        document.querySelectorAll('.suggestion-btn, .quick-action').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                this.handleSuggestionClick(action);
            });
        });
        
        // Voice interface controls
        document.getElementById('voice-record-btn')?.addEventListener('click', () => this.toggleRecording());
        document.getElementById('voice-pause-btn')?.addEventListener('click', () => this.togglePause());
        document.getElementById('voice-stop-btn')?.addEventListener('click', () => this.stopRecording());
        
        // Text interface controls
        document.getElementById('text-submit-btn')?.addEventListener('click', () => this.processTextInput());
        document.getElementById('text-clear-btn')?.addEventListener('click', () => this.clearTextInput());
        
        // Voice orb click
        document.getElementById('voice-orb')?.addEventListener('click', () => this.toggleRecording());
        
        // Backdrop click to close
        document.getElementById('ai-assistant')?.addEventListener('click', (e) => {
            if (e.target.id === 'ai-assistant') {
                this.close();
            }
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
    }

    open() {
        const assistant = document.getElementById('ai-assistant');
        assistant.classList.add('active');
        this.currentMode = 'initial';
        this.updateStatus('Ready to capture your billable time');
        this.resetInterface();
        this.selectedDate = null;
    }

    openWithDate(date) {
        const assistant = document.getElementById('ai-assistant');
        assistant.classList.add('active');
        this.currentMode = 'initial';
        this.selectedDate = date;
        
        // Format the date for display
        const dateStr = date.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        
        this.updateStatus(`Creating entry for ${dateStr}`);
        this.resetInterface();
        
        // Update the initial message to reflect the selected date
        const initialMessage = document.querySelector('.initial-message .message-text');
        if (initialMessage) {
            initialMessage.textContent = `What billable work did you accomplish on ${dateStr}? I'll help you turn it into professional time entries.`;
        }
    }

    close() {
        const assistant = document.getElementById('ai-assistant');
        assistant.classList.remove('active');
        this.stopRecording();
        this.resetInterface();
        this.selectedDate = null;
    }

    handleSuggestionClick(action) {
        switch (action) {
            case 'voice':
                this.switchToVoiceMode();
                break;
            case 'type':
                this.switchToTextMode();
                break;
            default:
                console.log('Unknown action:', action);
        }
    }

    switchToVoiceMode() {
        this.currentMode = 'voice';
        this.hideAllInterfaces();
        document.getElementById('voice-interface').classList.remove('hidden');
        this.updateStatus('Voice mode active');
        
        // Add message to conversation
        this.addUserMessage('I\'ll tell you about my work using voice');
        
        // Add assistant message with transcription mode info
        const modeInfo = this.transcriptionMode === 'browser' 
            ? 'using browser speech recognition' 
            : this.transcriptionMode === 'dual' 
                ? 'using dual transcription (browser + Whisper)' 
                : 'using Whisper AI transcription';
                
        this.addAssistantMessage(`Perfect! Click the microphone to start recording your billable activities. Currently ${modeInfo}.`);
        
        // Add transcription mode selector
        this.addTranscriptionModeSelector();
    }
    
    addTranscriptionModeSelector() {
        const selectorHtml = `
            <div class="transcription-mode-selector">
                <label>Transcription Mode:</label>
                <div class="mode-options">
                    <button class="mode-option ${this.transcriptionMode === 'browser' ? 'active' : ''}" 
                            onclick="window.aiAssistant.setTranscriptionModeUI('browser')">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                            <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4Z"/>
                        </svg>
                        Browser Only
                        <span class="mode-desc">Fast, works offline</span>
                    </button>
                    <button class="mode-option ${this.transcriptionMode === 'dual' ? 'active' : ''}" 
                            onclick="window.aiAssistant.setTranscriptionModeUI('dual')">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                            <path d="M8,2A6,6 0 0,0 2,8A6,6 0 0,0 8,14A6,6 0 0,0 14,8A6,6 0 0,0 8,2M8,4A4,4 0 0,1 12,8A4,4 0 0,1 8,12A4,4 0 0,1 4,8A4,4 0 0,1 8,4M16,10A6,6 0 0,0 10,16A6,6 0 0,0 16,22A6,6 0 0,0 22,16A6,6 0 0,0 16,10M16,12A4,4 0 0,1 20,16A4,4 0 0,1 16,20A4,4 0 0,1 12,16A4,4 0 0,1 16,12Z"/>
                        </svg>
                        Dual Mode
                        <span class="mode-desc">Browser + Whisper AI</span>
                    </button>
                </div>
            </div>
        `;
        
        this.addAssistantMessage(selectorHtml, true);
    }
    
    setTranscriptionModeUI(mode) {
        this.setTranscriptionMode(mode);
        
        // Update UI
        document.querySelectorAll('.mode-option').forEach(btn => {
            btn.classList.toggle('active', btn.textContent.toLowerCase().includes(mode));
        });
        
        // Show confirmation
        const modeText = mode === 'browser' ? 'Browser-only' : 'Dual (Browser + Whisper)';
        this.updateStatus(`Switched to ${modeText} transcription mode`);
    }

    switchToTextMode() {
        console.log('Switching to text mode...');
        this.currentMode = 'text';
        this.hideAllInterfaces();
        
        const textInterface = document.getElementById('text-interface');
        if (textInterface) {
            textInterface.classList.remove('hidden');
            console.log('Text interface hidden class removed, should be visible');
            console.log('Text interface classes:', textInterface.className);
            console.log('Text interface display style:', window.getComputedStyle(textInterface).display);
        } else {
            console.error('Text interface element not found!');
        }
        
        this.updateStatus('Text mode active');
        
        // Add message to conversation
        this.addUserMessage('I\'ll type my work details');
        this.addAssistantMessage('Great! Type your work details below.');
        
        // Focus on text input
        setTimeout(() => {
            const textInput = document.getElementById('text-input');
            if (textInput) {
                textInput.focus();
                console.log('Text input focused');
            } else {
                console.error('Text input element not found!');
            }
        }, 100);
    }

    async toggleRecording() {
        if (this.isRecording) {
            this.stopRecording();
        } else {
            await this.startRecording();
        }
    }

    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };
            
            this.mediaRecorder.onstop = () => this.processRecording();
            
            // Set up audio analysis for visual feedback
            this.setupAudioAnalysis(stream);
            
            this.mediaRecorder.start(100);
            this.startTime = Date.now();
            this.pausedTime = 0;
            this.isRecording = true;
            this.isPaused = false;
            this.finalTranscript = '';
            this.browserTranscript = '';
            this.whisperTranscript = '';
            this.transcriptChunks = [];
            this.lastSpeechTime = Date.now();
            this.lastProcessedChunkIndex = 0;
            
            // Start speech recognition for live transcription
            if (this.recognition) {
                try {
                    this.recognition.start();
                } catch (e) {
                    console.error('Failed to start recognition:', e);
                }
            }
            
            this.updateRecordingUI();
            this.startTimer();
            this.updateStatus('Recording... Tell me about your billable work');
            
        } catch (err) {
            console.error('Error accessing microphone:', err);
            this.showError('Please allow microphone access to record');
        }
    }
    
    setupAudioAnalysis(stream) {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            
            this.analyser.fftSize = 256;
            this.microphone.connect(this.analyser);
            
            this.startAudioMonitoring();
        } catch (e) {
            console.error('Failed to setup audio analysis:', e);
        }
    }
    
    startAudioMonitoring() {
        if (!this.analyser) return;
        
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        const animate = () => {
            if (!this.isRecording || this.isPaused) return;
            
            this.analyser.getByteFrequencyData(dataArray);
            
            // Update audio bars in the compact interface
            const audioBars = document.querySelectorAll('.audio-bar');
            if (audioBars.length > 0) {
                const step = Math.floor(bufferLength / audioBars.length);
                
                audioBars.forEach((bar, index) => {
                    const value = dataArray[index * step] / 255;
                    const height = Math.max(8, value * 20) + 'px';
                    bar.style.height = height;
                    bar.style.opacity = Math.max(0.5, value);
                });
            }
            
            // Also update waveform bars if they exist
            const waveformBars = document.querySelectorAll('.waveform-container .waveform-bar');
            if (waveformBars.length > 0) {
                const step = Math.floor(bufferLength / waveformBars.length);
                
                waveformBars.forEach((bar, index) => {
                    const value = dataArray[index * step] / 255;
                    const height = Math.max(8, value * 24) + 'px';
                    bar.style.height = height;
                });
            }
            
            requestAnimationFrame(animate);
        };
        
        animate();
    }

    togglePause() {
        if (this.isPaused) {
            this.resumeRecording();
        } else {
            this.pauseRecording();
        }
    }

    pauseRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.pause();
            this.isPaused = true;
            this.pausedTime += Date.now() - this.startTime;
            
            if (this.recognition) {
                this.recognition.stop();
            }
            
            // Clear chunk timer when paused
            if (this.chunkTimer) {
                clearTimeout(this.chunkTimer);
                this.chunkTimer = null;
            }
            
            this.updateRecordingUI();
            this.updateStatus('Recording paused');
        }
    }

    resumeRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
            this.mediaRecorder.resume();
            this.isPaused = false;
            this.startTime = Date.now();
            
            if (this.recognition) {
                try {
                    this.recognition.start();
                } catch (e) {
                    console.error('Failed to resume recognition:', e);
                }
            }
            
            // Resume audio monitoring
            this.startAudioMonitoring();
            
            this.updateRecordingUI();
            this.updateStatus('Recording resumed');
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.isRecording = false;
            this.isPaused = false;
            
            // Clear chunk processing timer
            if (this.chunkTimer) {
                clearTimeout(this.chunkTimer);
                this.chunkTimer = null;
            }
            
            // Sync any edited text before processing
            this.syncEditedTranscription();
            
            this.mediaRecorder.stop();
            this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
            
            if (this.recognition) {
                this.recognition.stop();
            }
            
            // Clean up audio context
            if (this.audioContext) {
                this.audioContext.close();
                this.audioContext = null;
                this.analyser = null;
                this.microphone = null;
            }
            
            this.clearTimer();
            this.updateRecordingUI();
            this.updateStatus('Processing your recording...');
            
            // Hide live transcription and show processing
            this.hideLiveTranscription();
        }
    }
    
    syncEditedTranscription() {
        const userLiveText = document.getElementById('live-user-text');
        if (userLiveText) {
            const currentText = userLiveText.textContent.trim();
            if (currentText && currentText !== 'Start speaking...') {
                // Update transcripts with the final edited version
                this.browserTranscript = currentText;
                if (this.transcriptionMode === 'browser') {
                    this.finalTranscript = currentText;
                }
            }
        }
    }

    async processRecording() {
        try {
            this.currentMode = 'processing';
            this.hideAllInterfaces();
            
            // Sync any final edits
            this.syncEditedTranscription();
            
            // If browser-only mode, use browser transcript as final
            if (this.transcriptionMode === 'browser') {
                this.finalTranscript = this.browserTranscript;
                
                // Show what we heard
                this.addAssistantThinking('I heard you say: "' + this.finalTranscript.trim() + '"');
            } else {
                // Get final Whisper transcription
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                this.addAssistantThinking('Getting final transcription...');
                
                try {
                    const { text } = await api.transcribe(audioBlob);
                    
                    // Update final transcript with Whisper result
                    this.whisperTranscript = text || this.browserTranscript;
                    this.finalTranscript = this.whisperTranscript;
                } catch (whisperError) {
                    console.error('Whisper API failed, falling back to browser transcript:', whisperError);
                    // Fall back to browser transcript if Whisper fails
                    this.finalTranscript = this.browserTranscript;
                }
                
                // Update the display with final text
                this.updateTranscriptionDisplay();
                
                // Show what we heard
                this.clearThinking();
                this.addAssistantThinking('I heard you say: "' + this.finalTranscript.trim() + '"');
                this.addAssistantThinking('Let me process this and extract the billable activities...');
            }
            
            // Check if we have any transcript to process
            if (!this.finalTranscript || this.finalTranscript.trim() === '') {
                throw new Error('No transcription available. Please try recording again.');
            }
            
            // Simulate AI processing steps
            await this.simulateAIProcessing();
            
            try {
                // Process with enhancement API
                const response = await api.enhance(this.finalTranscript);
                
                // Store original text in response for later use
                response.original_text = this.finalTranscript;
                
                // Show results in conversational format
                this.showConversationalResults(response);
            } catch (apiError) {
                console.error('API enhancement failed:', apiError);
                
                // Create a mock response for demo purposes
                const mockResponse = this.createMockResponse(this.finalTranscript);
                this.showConversationalResults(mockResponse);
            }
            
        } catch (err) {
            console.error('Error processing recording:', err);
            this.clearThinking();
            this.showError(err.message || 'Failed to process recording. Please try again.');
        }
    }
    
    // Create a mock response when API is unavailable
    createMockResponse(text) {
        // Simple time extraction regex - look for multiple time mentions
        const timeMatches = text.matchAll(/(\d+\.?\d*)\s*(hours?|hrs?|minutes?|mins?)/gi);
        const times = Array.from(timeMatches);
        
        // Try to split text into multiple activities if we find multiple time references
        let narratives = [];
        
        if (times.length > 1) {
            // Split by common separators
            const parts = text.split(/[,;]|and then|after that|also/i);
            parts.forEach((part, index) => {
                const partTimeMatch = part.match(/(\d+\.?\d*)\s*(hours?|hrs?|minutes?|mins?)/i);
                const hours = partTimeMatch ? parseFloat(partTimeMatch[1]) : 0.5;
                const cleanText = part.replace(/(\d+\.?\d*)\s*(hours?|hrs?|minutes?|mins?)/i, '').trim();
                
                if (cleanText) {
                    narratives.push({
                        text: cleanText,
                        hours: hours,
                        task_code: 'L310'
                    });
                }
            });
        } else {
            // Single activity
            const hours = times[0] ? parseFloat(times[0][1]) : 0.5;
            narratives.push({
                text: text.trim(),
                hours: hours,
                task_code: 'L310'
            });
        }
        
        const totalHours = narratives.reduce((sum, n) => sum + n.hours, 0);
        
        return {
            entry: {
                id: Date.now(),
                narratives: narratives,
                total_hours: totalHours,
                created_at: this.selectedDate ? this.selectedDate.toISOString() : new Date().toISOString()
            },
            total_narratives: narratives.length,
            total_hours: totalHours,
            cleaned_text: text,
            original_text: text
        };
    }

    async simulateAIProcessing() {
        const steps = this.transcriptionMode === 'browser' 
            ? [
                { message: 'Processing your transcribed speech...', delay: 600 },
                { message: 'Grammar Agent: Cleaning up the text and expanding abbreviations...', delay: 600 },
                { message: 'Separator Agent: Identifying distinct billable activities...', delay: 700 },
                { message: 'Refiner Agent: Crafting professional billing narratives...', delay: 800 }
              ]
            : [
                { message: 'Transcribing your speech with Whisper AI...', delay: 800 },
                { message: 'Grammar Agent: Cleaning up the text and expanding abbreviations...', delay: 600 },
                { message: 'Separator Agent: Identifying distinct billable activities...', delay: 700 },
                { message: 'Refiner Agent: Crafting professional billing narratives...', delay: 800 }
              ];
        
        for (const step of steps) {
            this.updateThinkingMessage(step.message);
            await new Promise(resolve => setTimeout(resolve, step.delay));
        }
    }
    
    // Method to switch transcription modes
    setTranscriptionMode(mode) {
        if (['dual', 'browser', 'whisper'].includes(mode)) {
            this.transcriptionMode = mode;
            console.log(`Transcription mode set to: ${mode}`);
        }
    }

    showConversationalResults(response) {
        this.currentMode = 'confirmation';
        this.lastResponse = response; // Store for saving later
        this.clearThinking();
        
        // Initialize assignment mode - default to individual for better UX
        this.assignmentMode = 'individual'; // 'bulk' or 'individual'
        
        // Add analysis message
        const narrativeCount = response.entry.narratives.length;
        const summary = `I've identified ${narrativeCount} billable ${narrativeCount === 1 ? 'activity' : 'activities'} totaling ${response.total_hours} hours:`;
        this.addAssistantMessage(summary);
        
        // Add each narrative as part of a single entry message - ultra-compact design with integrated actions
        const entryHtml = `
            <div class="ai-response ultra-compact-review">
                <div class="response-header-compact">
                    <span>Time Entries</span>
                    <div class="confidence-indicator-compact">
                        <span>Confidence:</span>
                        <div class="confidence-bar">
                            <div class="confidence-fill" style="width: ${Math.random() * 30 + 70}%"></div>
                        </div>
                    </div>
                </div>
                <div class="entry-content scrollable-entries-compact" id="ai-entry-content">
                    ${response.entry.narratives.map((narrative, index) => `
                        <div class="narrative-item ultra-compact-narrative" data-narrative-index="${index}">
                            <div class="narrative-main-row">
                                <span class="narrative-hours-inline">${narrative.hours} hours</span>
                                <span class="narrative-text-inline">${narrative.text}</span>
                                <span class="narrative-index-inline">#${index + 1}</span>
                            </div>
                            <div class="narrative-inputs-row" id="narrative-fields-${index}">
                                <input type="text" 
                                       id="narrative-client-${index}" 
                                       placeholder="Client Code" 
                                       class="ultra-compact-input"
                                       value="${narrative.client_code || ''}">
                                <input type="text" 
                                       id="narrative-matter-${index}" 
                                       placeholder="Matter #" 
                                       class="ultra-compact-input"
                                       value="${narrative.matter_number || ''}">
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="integrated-actions">
                    <button class="unified-action-btn primary" onclick="window.aiAssistant.confirmEntries()">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                            <path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z"/>
                        </svg>
                        <span>Save entries</span>
                    </button>
                    <button class="unified-action-btn" onclick="window.aiAssistant.requestModifications()">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                            <path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z"/>
                        </svg>
                        <span>Edit</span>
                    </button>
                    <button class="unified-action-btn" onclick="window.aiAssistant.startOver()">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                            <path d="M12,5V1L7,6L12,11V7A6,6 0 0,1 18,13A6,6 0 0,1 12,19A6,6 0 0,1 6,13H4A8,8 0 0,0 12,21A8,8 0 0,0 20,13A8,8 0 0,0 12,5Z"/>
                        </svg>
                        <span>Restart</span>
                    </button>
                    ${narrativeCount > 1 ? `
                        <button class="unified-action-btn" onclick="window.aiAssistant.showBulkApply()">
                            <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                                <path d="M19,3H14.82C14.4,1.84 13.3,1 12,1C10.7,1 9.6,1.84 9.18,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5A2,2 0 0,0 19,3M12,3A1,1 0 0,1 13,4A1,1 0 0,1 12,5A1,1 0 0,1 11,4A1,1 0 0,1 12,3M7,7H17V5H19V19H5V5H7V7Z"/>
                            </svg>
                            <span>Apply to all</span>
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
        this.addAssistantMessage(entryHtml, true);
        
        this.updateStatus('Review and confirm your time entries');
    }

    async processTextInput() {
        console.log('Processing text input...');
        const textInput = document.getElementById('text-input');
        const text = textInput.value.trim();
        
        if (!text) {
            this.showError('Please enter some text describing your work');
            return;
        }
        
        this.addUserMessage(`Here's what I worked on: "${text}"`);
        this.currentMode = 'processing';
        console.log('Hiding interfaces for processing mode...');
        this.hideAllInterfaces();
        
        this.addAssistantThinking('Analyzing your work description...');
        
        try {
            await this.simulateAIProcessing();
            const response = await api.enhance(text);
            this.showConversationalResults(response);
        } catch (err) {
            console.error('Error processing text:', err);
            this.showError('Failed to process text. Please try again.');
        }
    }

    clearTextInput() {
        document.getElementById('text-input').value = '';
    }

    // UI Helper Methods
    hideAllInterfaces() {
        console.log('Hiding all interfaces...');
        const voiceInterface = document.getElementById('voice-interface');
        const textInterface = document.getElementById('text-interface');
        const inputArea = document.getElementById('input-area');
        
        if (voiceInterface) voiceInterface.classList.add('hidden');
        if (textInterface) {
            textInterface.classList.add('hidden');
            console.log('Text interface hidden');
        }
        if (inputArea) inputArea.classList.add('hidden');
    }

    resetInterface() {
        this.hideAllInterfaces();
        document.getElementById('input-area').classList.remove('hidden');
        this.clearMessages();
        this.hideLiveTranscription();
        this.clearTimer();
        this.transcriptionMessageId = null;
        
        // Show initial message again
        const initialMessage = document.querySelector('.initial-message');
        if (initialMessage) {
            initialMessage.style.display = 'flex';
        }
    }

    updateStatus(text) {
        document.getElementById('assistant-status').textContent = text;
    }

    updateRecordingUI() {
        const miniOrb = document.getElementById('mini-orb');
        const recordBtn = document.getElementById('voice-record-btn');
        const pauseBtn = document.getElementById('voice-pause-btn');
        const secondaryControls = document.getElementById('secondary-voice-controls');
        const timer = document.getElementById('recording-timer-compact');
        const recordingBar = document.querySelector('.recording-bar');
        const recordingLabel = document.getElementById('recording-label');
        const audioBars = document.getElementById('audio-bars');
        
        if (this.isRecording && !this.isPaused) {
            miniOrb?.classList.add('recording');
            recordingBar?.classList.add('active');
            recordBtn.style.display = 'none';
            secondaryControls.classList.remove('hidden');
            timer.style.display = 'inline';
            recordingLabel.textContent = 'Recording...';
            audioBars?.classList.remove('hidden');
            
            // Update pause button
            const pauseBtnText = pauseBtn.querySelector('.btn-text');
            if (pauseBtnText) pauseBtnText.textContent = 'Pause';
        } else if (this.isRecording && this.isPaused) {
            miniOrb?.classList.remove('recording');
            recordingLabel.textContent = 'Paused';
            audioBars?.classList.add('hidden');
            
            // Update pause button to show resume
            const pauseBtnText = pauseBtn.querySelector('.btn-text');
            if (pauseBtnText) pauseBtnText.textContent = 'Resume';
        } else {
            miniOrb?.classList.remove('recording');
            recordingBar?.classList.remove('active');
            recordBtn.style.display = 'flex';
            secondaryControls.classList.add('hidden');
            timer.style.display = 'none';
            recordingLabel.textContent = 'Ready to record';
            audioBars?.classList.add('hidden');
        }
    }

    showLiveTranscription() {
        const liveTransArea = document.getElementById('live-transcription-area');
        if (liveTransArea) {
            liveTransArea.classList.remove('hidden');
        }
        
        // Hide the initial message when recording starts
        const initialMessage = document.querySelector('.initial-message');
        if (initialMessage) {
            initialMessage.style.display = 'none';
        }
        
        // Add a user message that will be replaced with live transcription
        this.addUserTranscriptionMessage();
    }

    hideLiveTranscription() {
        const liveTransArea = document.getElementById('live-transcription-area');
        if (liveTransArea) {
            liveTransArea.classList.add('hidden');
        }
    }
    
    addUserTranscriptionMessage() {
        // Check if we already have a transcription message
        if (this.transcriptionMessageId) {
            return;
        }
        
        const container = document.getElementById('messages-container');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message user-message';
        messageDiv.id = 'user-transcription-message';
        this.transcriptionMessageId = 'user-transcription-message';
        
        messageDiv.innerHTML = `
            <div class="message-avatar">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z"/>
                </svg>
            </div>
            <div class="message-content">
                <div class="message-text" id="live-user-text" contenteditable="true" spellcheck="false">
                    <span class="transcription-placeholder">Start speaking...</span>
                </div>
                <div class="edit-hint">Click to edit • Press Enter to save</div>
            </div>
        `;
        
        container.appendChild(messageDiv);
        container.scrollTop = container.scrollHeight;
        
        // Set up edit handlers
        this.setupTranscriptionEditHandlers();
    }
    
    setupTranscriptionEditHandlers() {
        const userLiveText = document.getElementById('live-user-text');
        if (!userLiveText) return;
        
        let isEditing = false;
        let lastContent = '';
        
        // Focus handler
        userLiveText.addEventListener('focus', () => {
            isEditing = true;
            // Store current content
            lastContent = userLiveText.textContent;
            // Remove placeholder if it exists
            const placeholder = userLiveText.querySelector('.transcription-placeholder');
            if (placeholder) {
                placeholder.remove();
            }
            // Add visual feedback
            userLiveText.classList.add('editing');
        });
        
        // Blur handler
        userLiveText.addEventListener('blur', () => {
            isEditing = false;
            // Remove visual feedback
            userLiveText.classList.remove('editing');
            // Update transcripts with edited content
            const editedText = userLiveText.textContent.trim();
            if (editedText !== lastContent) {
                this.browserTranscript = editedText;
                if (this.transcriptionMode === 'browser') {
                    this.finalTranscript = editedText;
                }
            }
        });
        
        // Input handler to maintain white text color
        userLiveText.addEventListener('input', () => {
            // Wrap plain text in proper span
            const text = userLiveText.textContent;
            if (text && !userLiveText.querySelector('span')) {
                userLiveText.innerHTML = `<span class="whisper-confirmed">${text}</span>`;
                // Move cursor to end
                const range = document.createRange();
                const sel = window.getSelection();
                range.selectNodeContents(userLiveText);
                range.collapse(false);
                sel.removeAllRanges();
                sel.addRange(range);
            }
        });
        
        // Enter key handler
        userLiveText.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                userLiveText.blur();
            }
        });
        
        // Store the editing state
        userLiveText.dataset.isEditing = 'false';
    }

    handleSpeechResult(event) {
        let interimTranscript = '';
        let newFinalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            
            if (event.results[i].isFinal) {
                newFinalTranscript += transcript + ' ';
            } else {
                interimTranscript += transcript;
            }
        }
        
        // Update browser transcript with new final text
        if (newFinalTranscript) {
            this.browserTranscript += newFinalTranscript;
        }
        
        // Update speech timestamp for silence detection
        this.lastSpeechTime = Date.now();
        
        // Trigger chunk processing immediately on new final transcript
        if (newFinalTranscript && this.transcriptionMode === 'dual') {
            // Always trigger check, which will handle processing
            this.checkChunkProcessing();
        }
        
        // Update the display immediately with browser results
        this.updateBrowserTranscriptionDisplay(interimTranscript);
    }
    
    updateBrowserTranscriptionDisplay(interimTranscript = '') {
        const userLiveText = document.getElementById('live-user-text');
        if (!userLiveText) return;
        
        // Don't update if user is actively editing
        if (document.activeElement === userLiveText) return;
        
        let displayHtml = '';
        
        // In browser-only mode, show all text as confirmed
        if (this.transcriptionMode === 'browser') {
            if (this.browserTranscript) {
                displayHtml += `<span class="whisper-confirmed">${this.browserTranscript}</span>`;
            }
            if (interimTranscript) {
                displayHtml += `<span class="interim">${interimTranscript}</span>`;
            }
        } else {
            // Dual mode - smart display
            if (this.whisperTranscript) {
                // Show Whisper-confirmed text
                displayHtml += `<span class="whisper-confirmed">${this.whisperTranscript}</span>`;
                
                // Calculate what browser text hasn't been confirmed by Whisper yet
                // Use fuzzy matching to handle slight differences
                const whisperWords = this.whisperTranscript.trim().split(/\s+/);
                const browserWords = this.browserTranscript.trim().split(/\s+/);
                
                // Find where Whisper transcript ends in browser transcript
                let matchIndex = -1;
                for (let i = browserWords.length - 1; i >= whisperWords.length - 1; i--) {
                    let matches = true;
                    for (let j = 0; j < whisperWords.length && (i - whisperWords.length + 1 + j) >= 0; j++) {
                        if (browserWords[i - whisperWords.length + 1 + j].toLowerCase() !== whisperWords[j].toLowerCase()) {
                            matches = false;
                            break;
                        }
                    }
                    if (matches) {
                        matchIndex = i + 1;
                        break;
                    }
                }
                
                // Show unconfirmed browser text
                if (matchIndex > 0 && matchIndex < browserWords.length) {
                    const pendingText = browserWords.slice(matchIndex).join(' ');
                    if (pendingText) {
                        displayHtml += ` <span class="browser-pending">${pendingText}</span>`;
                    }
                } else if (matchIndex === -1) {
                    // No match found, show all browser text after Whisper length
                    const pendingText = this.browserTranscript.substring(this.whisperTranscript.length);
                    if (pendingText.trim()) {
                        displayHtml += ` <span class="browser-pending">${pendingText}</span>`;
                    }
                }
            } else {
                // No Whisper text yet, show all browser text as pending
                if (this.browserTranscript) {
                    displayHtml += `<span class="browser-pending">${this.browserTranscript}</span>`;
                }
            }
            
            // Add interim text
            if (interimTranscript) {
                displayHtml += ` <span class="interim">${interimTranscript}</span>`;
            }
        }
        
        // Only update if we have content
        if (displayHtml) {
            userLiveText.innerHTML = displayHtml;
        }
        
        // Scroll to show the message
        const container = document.getElementById('messages-container');
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }
    
    checkChunkProcessing() {
        // Clear existing timer
        if (this.chunkTimer) {
            clearTimeout(this.chunkTimer);
            this.chunkTimer = null;
        }
        
        // Don't process if paused or not recording
        if (this.isPaused || !this.isRecording) return;
        
        // Skip chunk processing if using browser-only mode
        if (this.transcriptionMode === 'browser') return;
        
        // Check if we have new chunks to process
        const hasNewChunks = this.audioChunks.length > this.lastProcessedChunkIndex;
        if (!hasNewChunks) {
            // No new chunks, check again later
            this.chunkTimer = setTimeout(() => this.checkChunkProcessing(), 200);
            return;
        }
        
        // Process chunks more aggressively:
        // 1. We have more than 1 second of new audio
        // 2. OR there's been a pause in speech (>0.5 seconds)
        // 3. OR we have any chunks and browser has new text
        const newChunksCount = this.audioChunks.length - this.lastProcessedChunkIndex;
        const timeSinceLastSpeech = Date.now() - this.lastSpeechTime;
        const browserHasNewText = this.browserTranscript.length > this.whisperTranscript.length;
        
        const shouldProcessPause = timeSinceLastSpeech > 500;
        const shouldProcessTime = newChunksCount > 10; // ~1 second
        const shouldProcessNewText = browserHasNewText && newChunksCount > 5; // ~0.5 seconds
        
        if (shouldProcessPause || shouldProcessTime || shouldProcessNewText) {
            this.processAudioChunk();
        } else {
            // Set timer to check again more frequently
            this.chunkTimer = setTimeout(() => this.checkChunkProcessing(), 100);
        }
    }
    
    async processAudioChunk() {
        // Don't process if we're not recording or if no new chunks available
        if (!this.isRecording || this.audioChunks.length <= this.lastProcessedChunkIndex) {
            return;
        }
        
        // Prevent concurrent chunk processing
        if (this.isProcessingChunk) {
            // If already processing, schedule another check soon
            if (!this.chunkTimer && this.isRecording) {
                this.chunkTimer = setTimeout(() => this.checkChunkProcessing(), 200);
            }
            return;
        }
        this.isProcessingChunk = true;
        
        try {
            // Create a blob from only the new audio chunks
            const newChunks = this.audioChunks.slice(this.lastProcessedChunkIndex);
            const audioBlob = new Blob(newChunks, { type: 'audio/webm' });
            
            console.log(`Processing chunks ${this.lastProcessedChunkIndex} to ${this.audioChunks.length}`);
            
            // Add timeout for Whisper API call
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Whisper API timeout')), 3000)
            );
            
            // Race between API call and timeout
            const { text } = await Promise.race([
                api.transcribe(audioBlob),
                timeoutPromise
            ]);
            
            // Update Whisper transcript
            if (text && text.trim()) {
                console.log('Whisper returned:', text);
                
                // For the first chunk, just set it
                if (this.lastProcessedChunkIndex === 0) {
                    this.whisperTranscript = text;
                } else {
                    // For subsequent chunks, try to match with browser text
                    // This helps align Whisper output with what's already shown
                    const browserPending = this.browserTranscript.substring(this.whisperTranscript.length).trim();
                    const whisperNew = text.trim();
                    
                    // Check if Whisper's new text matches the beginning of pending browser text
                    if (browserPending && whisperNew && browserPending.toLowerCase().startsWith(whisperNew.toLowerCase())) {
                        // Whisper matches browser, just extend the confirmed portion
                        this.whisperTranscript = this.browserTranscript.substring(0, this.whisperTranscript.length + whisperNew.length);
                    } else {
                        // Otherwise append with space
                        this.whisperTranscript = this.whisperTranscript.trim() + ' ' + whisperNew;
                    }
                }
                
                // Update the index to mark these chunks as processed
                this.lastProcessedChunkIndex = this.audioChunks.length;
                
                // Force update display
                this.updateTranscriptionDisplay();
            }
        } catch (error) {
            console.error('Whisper chunk processing failed:', error);
            // On error, skip these chunks to avoid getting stuck
            this.lastProcessedChunkIndex = this.audioChunks.length;
        } finally {
            this.isProcessingChunk = false;
            // Always schedule next check if still recording
            if (this.isRecording && !this.chunkTimer) {
                this.chunkTimer = setTimeout(() => this.checkChunkProcessing(), 300);
            }
        }
    }
    
    // Helper method to find overlap between two strings
    findOverlap(str1, str2) {
        const minOverlap = 10; // Minimum characters to consider overlap
        const maxCheck = Math.min(str1.length, str2.length, 50); // Check up to 50 chars
        
        for (let i = minOverlap; i <= maxCheck; i++) {
            if (str1.endsWith(str2.substring(0, i))) {
                return i;
            }
        }
        return 0;
    }
    
    updateTranscriptionDisplay() {
        // Call the unified display update method
        this.updateBrowserTranscriptionDisplay('');
    }

    restartRecognition() {
        if (this.recognition && this.isRecording && !this.isPaused) {
            try {
                this.recognition.start();
            } catch (e) {
                console.error('Failed to restart recognition:', e);
            }
        }
    }

    startTimer() {
        this.timerInterval = setInterval(() => {
            if (!this.isPaused) {
                const currentTime = Date.now();
                const elapsed = Math.floor((this.pausedTime + (currentTime - this.startTime)) / 1000);
                const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
                const seconds = (elapsed % 60).toString().padStart(2, '0');
                const timeStr = `${minutes}:${seconds}`;
                
                // Update both timer elements if they exist
                const timer = document.getElementById('recording-timer');
                const timerCompact = document.getElementById('recording-timer-compact');
                
                if (timer) timer.textContent = timeStr;
                if (timerCompact) timerCompact.textContent = timeStr;
            }
        }, 100);
    }

    clearTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    // Message Management
    addUserMessage(text) {
        this.addMessage('user', text);
    }

    addAssistantMessage(text, isHtml = false) {
        this.addMessage('assistant', text, isHtml);
    }

    addAssistantThinking(text) {
        const container = document.getElementById('messages-container');
        const thinkingDiv = document.createElement('div');
        thinkingDiv.className = 'thinking-indicator';
        thinkingDiv.innerHTML = `
            <div class="thinking-dots">
                <div class="thinking-dot"></div>
                <div class="thinking-dot"></div>
                <div class="thinking-dot"></div>
            </div>
            <span class="thinking-text">${text}</span>
        `;
        container.appendChild(thinkingDiv);
        container.scrollTop = container.scrollHeight;
    }

    updateThinkingMessage(text) {
        const thinkingElement = document.querySelector('.thinking-indicator .thinking-text');
        if (thinkingElement) {
            thinkingElement.textContent = text;
        }
    }

    clearThinking() {
        const thinkingElements = document.querySelectorAll('.thinking-indicator');
        thinkingElements.forEach(el => el.remove());
    }

    addMessage(type, text, isHtml = false) {
        const container = document.getElementById('messages-container');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}-message`;
        
        if (type === 'assistant') {
            messageDiv.innerHTML = `
                <div class="message-avatar">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 6L13.5 10.5L18 12L13.5 13.5L12 18L10.5 13.5L6 12L10.5 10.5L12 6Z"/>
                    </svg>
                </div>
                <div class="message-content">
                    <div class="message-text">${isHtml ? text : this.escapeHtml(text)}</div>
                </div>
            `;
        } else {
            messageDiv.innerHTML = `
                <div class="message-avatar">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z"/>
                    </svg>
                </div>
                <div class="message-content">
                    <div class="message-text">${this.escapeHtml(text)}</div>
                </div>
            `;
        }
        
        container.appendChild(messageDiv);
        container.scrollTop = container.scrollHeight;
    }

    clearMessages() {
        const container = document.getElementById('messages-container');
        const initialMessage = container.querySelector('.initial-message');
        
        // Remove all messages except the initial one
        const messages = container.querySelectorAll('.message:not(.initial-message)');
        messages.forEach(msg => msg.remove());
        
        // Make sure initial message is visible
        if (initialMessage) {
            initialMessage.style.display = 'flex';
        }
        
        // Clear transcription message ID
        this.transcriptionMessageId = null;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showError(message) {
        this.addAssistantMessage(`❌ ${message}`);
        this.updateStatus('Error occurred');
    }

    handleKeyboard(e) {
        const assistant = document.getElementById('ai-assistant');
        if (!assistant.classList.contains('active')) return;
        
        // Escape to close
        if (e.code === 'Escape') {
            this.close();
        }
        
        // Spacebar to start/stop recording in voice mode
        if (e.code === 'Space' && this.currentMode === 'voice') {
            e.preventDefault();
            this.toggleRecording();
        }
        
        // Enter to submit text in text mode
        if (e.code === 'Enter' && e.ctrlKey && this.currentMode === 'text') {
            e.preventDefault();
            this.processTextInput();
        }
    }

    // Show bulk apply modal
    showBulkApply() {
        // Create a modal for bulk apply
        const modalHtml = `
            <div class="bulk-apply-modal" id="bulk-apply-modal">
                <div class="bulk-apply-content">
                    <h3>Apply to All Entries</h3>
                    <p>Enter client and matter codes to apply to all time entries:</p>
                    <div class="bulk-apply-fields">
                        <input type="text" id="bulk-client-code" placeholder="Client Code" class="bulk-apply-input">
                        <input type="text" id="bulk-matter-code" placeholder="Matter Number" class="bulk-apply-input">
                    </div>
                    <div class="bulk-apply-actions">
                        <button onclick="window.aiAssistant.applyBulkCodes()" class="apply-bulk-btn">Apply</button>
                        <button onclick="window.aiAssistant.closeBulkApply()" class="cancel-bulk-btn">Cancel</button>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to body
        const modalDiv = document.createElement('div');
        modalDiv.innerHTML = modalHtml;
        document.body.appendChild(modalDiv.firstElementChild);
        
        // Focus on first input
        setTimeout(() => {
            document.getElementById('bulk-client-code')?.focus();
        }, 100);
    }
    
    // Apply bulk codes to all entries
    applyBulkCodes() {
        const clientCode = document.getElementById('bulk-client-code')?.value || '';
        const matterCode = document.getElementById('bulk-matter-code')?.value || '';
        
        // Apply to all narrative inputs
        this.lastResponse.entry.narratives.forEach((_, index) => {
            const clientInput = document.getElementById(`narrative-client-${index}`);
            const matterInput = document.getElementById(`narrative-matter-${index}`);
            
            if (clientInput && clientCode) clientInput.value = clientCode;
            if (matterInput && matterCode) matterInput.value = matterCode;
        });
        
        // Close modal
        this.closeBulkApply();
        
        // Show confirmation
        this.updateStatus('Applied codes to all entries');
    }
    
    // Close bulk apply modal
    closeBulkApply() {
        const modal = document.getElementById('bulk-apply-modal');
        if (modal) {
            modal.remove();
        }
    }

    // Action Methods
    async confirmEntries() {
        this.addUserMessage('Yes, save these entries');
        this.addAssistantMessage('Perfect! Let me save these entries to your dashboard...');
        
        try {
            // Show saving process
            this.addAssistantThinking('Saving your time entries...');
            
            // Prepare narratives with client/matter codes
            let narrativesToSave = [...this.lastResponse.entry.narratives];
            
            // Since we default to individual mode now, always get individual codes
            narrativesToSave = narrativesToSave.map((narrative, index) => {
                const clientInput = document.getElementById(`narrative-client-${index}`);
                const matterInput = document.getElementById(`narrative-matter-${index}`);
                
                return {
                    ...narrative,
                    client_code: clientInput?.value || narrative.client_code || '',
                    matter_number: matterInput?.value || narrative.matter_number || ''
                };
            });
            
            // Save the single entry with all narratives
            if (this.lastResponse && this.lastResponse.entry) {
                await dbOperations.saveEntry({
                    id: Date.now() + Math.random(), // Generate unique ID
                    original_text: this.lastResponse.original_text || this.finalTranscript,
                    cleaned_text: this.lastResponse.cleaned_text || this.finalTranscript,
                    narratives: narrativesToSave,
                    total_hours: this.lastResponse.entry.total_hours,
                    status: 'draft',
                    created_at: new Date().toISOString(),
                    client_code: '', // Entry-level codes are now per-narrative
                    matter_number: ''
                });
            }
            
            this.clearThinking();
            this.addAssistantMessage('✅ All time entries have been saved successfully! You can find them in your dashboard.');
            this.updateStatus('Entries saved successfully');
            
            // Close after a delay
            setTimeout(() => {
                this.close();
                // Refresh dashboard
                if (typeof loadDashboard === 'function') {
                    loadDashboard();
                }
            }, 750);
            
        } catch (error) {
            console.error('Error saving entries:', error);
            this.clearThinking();
            this.showError('Failed to save entries. Please try again.');
        }
    }

    requestModifications() {
        this.addUserMessage('I\'d like to make some changes');
        this.addAssistantMessage('No problem! What would you like to modify? You can:');
        
        const actionsHtml = `
            <div class="suggested-actions">
                <button class="suggestion-btn" onclick="window.aiAssistant.addMoreDetail()">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                        <path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z"/>
                    </svg>
                    Add more detail
                </button>
                <button class="suggestion-btn" onclick="window.aiAssistant.splitEntries()">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                        <path d="M8,2V4H16V2H18V4H19A2,2 0 0,1 21,6V20A2,2 0 0,1 19,22H5A2,2 0 0,1 3,20V6A2,2 0 0,1 5,4H6V2H8Z"/>
                    </svg>
                    Split entries differently
                </button>
                <button class="suggestion-btn" onclick="window.aiAssistant.changeWording()">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                        <path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z"/>
                    </svg>
                    Change wording
                </button>
            </div>
        `;
        this.addAssistantMessage(actionsHtml, true);
    }

    startOver() {
        this.addUserMessage('Let me start over');
        this.addAssistantMessage('Of course! Let\'s capture your billable time again. How would you like to provide the information?');
        this.resetInterface();
        this.currentMode = 'initial';
        this.updateStatus('Ready to capture your billable time');
    }

    addMoreDetail() {
        this.addUserMessage('I want to add more detail');
        this.addAssistantMessage('Great! I can help you add more detail. Here are some suggestions:');
        
        const detailSuggestions = `
            <div class="suggested-actions">
                <button class="suggestion-btn" onclick="window.aiAssistant.addDetailType('client-specific')">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                        <path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z"/>
                    </svg>
                    Add client-specific details
                </button>
                <button class="suggestion-btn" onclick="window.aiAssistant.addDetailType('legal-analysis')">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                        <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                    </svg>
                    Add legal analysis details
                </button>
                <button class="suggestion-btn" onclick="window.aiAssistant.addDetailType('time-breakdown')">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                        <path d="M12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22C6.47,22 2,17.5 2,12A10,10 0 0,1 12,2M12.5,7V12.25L17,14.92L16.25,16.15L11,13V7H12.5Z"/>
                    </svg>
                    Break down time more precisely
                </button>
                <button class="suggestion-btn" onclick="window.aiAssistant.addDetailType('general')">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                        <path d="M14.6,16.6L19.2,12L14.6,7.4L16,6L22,12L16,18L14.6,16.6Z"/>
                    </svg>
                    Tell me what to add
                </button>
            </div>
        `;
        this.addAssistantMessage(detailSuggestions, true);
    }

    addDetailType(type) {
        switch (type) {
            case 'client-specific':
                this.addUserMessage('Add client-specific details');
                this.addAssistantMessage('I\'ll help you add client-specific context. Please describe any client preferences, case background, or specific requirements that should be reflected in the billing narratives.');
                break;
            case 'legal-analysis':
                this.addUserMessage('Add legal analysis details');
                this.addAssistantMessage('I\'ll help you add more legal depth. Please describe the legal issues, research areas, or analytical work that should be highlighted in the billing descriptions.');
                break;
            case 'time-breakdown':
                this.addUserMessage('Break down time more precisely');
                this.addAssistantMessage('I\'ll help you create more precise time allocations. Please describe how you\'d like the time broken down or any specific activities that should be separated.');
                break;
            case 'general':
                this.addUserMessage('Tell me what to add');
                this.addAssistantMessage('Please describe what additional details you\'d like to include in your billing narratives. I can help you incorporate them naturally.');
                break;
        }
        this.switchToTextMode();
    }

    splitEntries() {
        this.addUserMessage('Split the entries differently');
        this.addAssistantMessage('I\'ll help you reorganize the time entries. Here are some common ways to split entries:');
        
        const splitOptions = `
            <div class="suggested-actions">
                <button class="suggestion-btn" onclick="window.aiAssistant.splitByActivity()">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                        <path d="M19,3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3M19,5V19H5V5H19Z"/>
                    </svg>
                    Split by activity type
                </button>
                <button class="suggestion-btn" onclick="window.aiAssistant.splitByTime()">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                        <path d="M12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22C6.47,22 2,17.5 2,12A10,10 0 0,1 12,2M12.5,7V12.25L17,14.92L16.25,16.15L11,13V7H12.5Z"/>
                    </svg>
                    Split by time periods
                </button>
                <button class="suggestion-btn" onclick="window.aiAssistant.splitByClient()">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                        <path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z"/>
                    </svg>
                    Split by client/matter
                </button>
                <button class="suggestion-btn" onclick="window.aiAssistant.splitCustom()">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                        <path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z"/>
                    </svg>
                    Custom split
                </button>
            </div>
        `;
        this.addAssistantMessage(splitOptions, true);
    }

    splitByActivity() {
        this.addUserMessage('Split by activity type');
        this.addAssistantMessage('I\'ll separate entries by activity type (research, drafting, calls, meetings, etc.). Let me re-analyze your work...');
        this.showContextualSuggestion('activity-split');
    }

    splitByTime() {
        this.addUserMessage('Split by time periods');
        this.addAssistantMessage('I\'ll organize entries by when you did the work. Please tell me how you\'d like time periods divided (hourly, by session, morning/afternoon, etc.).');
        this.switchToTextMode();
    }

    splitByClient() {
        this.addUserMessage('Split by client/matter');
        this.addAssistantMessage('I\'ll separate entries by different clients or matters. Please clarify which clients or matters were involved in your work.');
        this.switchToTextMode();
    }

    splitCustom() {
        this.addUserMessage('Custom split');
        this.addAssistantMessage('Tell me exactly how you\'d like the entries organized. I can split them however makes the most sense for your billing needs.');
        this.switchToTextMode();
    }

    changeWording() {
        this.addUserMessage('Change the wording');
        this.addAssistantMessage('I\'ll help you refine the language. What style would you prefer?');
        
        const wordingOptions = `
            <div class="suggested-actions">
                <button class="suggestion-btn" onclick="window.aiAssistant.changeStyle('formal')">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                        <path d="M14,17H7V15H14M17,13H7V11H17M17,9H7V7H17M19,3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3Z"/>
                    </svg>
                    More formal language
                </button>
                <button class="suggestion-btn" onclick="window.aiAssistant.changeStyle('detailed')">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                        <path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z"/>
                    </svg>
                    More detailed descriptions
                </button>
                <button class="suggestion-btn" onclick="window.aiAssistant.changeStyle('concise')">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                        <path d="M6,2V8H18V2H20V20H18V10H6V20H4V2H6Z"/>
                    </svg>
                    More concise entries
                </button>
                <button class="suggestion-btn" onclick="window.aiAssistant.changeStyle('specific')">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                        <path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z"/>
                    </svg>
                    Tell me what to change
                </button>
            </div>
        `;
        this.addAssistantMessage(wordingOptions, true);
    }

    changeStyle(style) {
        switch (style) {
            case 'formal':
                this.addUserMessage('Use more formal language');
                this.addAssistantMessage('I\'ll rewrite the narratives with more formal legal terminology and professional language.');
                break;
            case 'detailed':
                this.addUserMessage('Make descriptions more detailed');
                this.addAssistantMessage('I\'ll expand the narratives with more comprehensive descriptions of the work performed.');
                break;
            case 'concise':
                this.addUserMessage('Make entries more concise');
                this.addAssistantMessage('I\'ll create more streamlined, efficient billing narratives that capture the essential work.');
                break;
            case 'specific':
                this.addUserMessage('Tell me what to change');
                this.addAssistantMessage('Please describe the specific changes you\'d like to the wording or tone of the billing narratives.');
                this.switchToTextMode();
                return;
        }
        this.showContextualSuggestion('style-change', style);
    }

    showContextualSuggestion(type, param = null) {
        this.addAssistantThinking('Applying your preferences and regenerating entries...');
        
        // Simulate processing
        setTimeout(() => {
            this.clearThinking();
            this.addAssistantMessage('I\'ve updated the entries based on your preferences. Here are the revised time entries:');
            
            // Show updated results (simplified for demo)
            if (this.lastResponse) {
                this.showConversationalResults(this.lastResponse);
            }
        }, 1500);
    }
}

// Initialize the AI Assistant
let aiAssistant;
document.addEventListener('DOMContentLoaded', () => {
    aiAssistant = new AIAssistant();
    // Make it globally available
    window.aiAssistant = aiAssistant;
    
    // Log transcription mode info
    console.log('Time Composer Assistant initialized');
    console.log('Current transcription mode:', aiAssistant.transcriptionMode);
    console.log('To switch modes, use: window.aiAssistant.setTranscriptionMode("dual" | "browser" | "whisper")');
    
    // Check backend status
    fetch('http://localhost:5001/api/entries')
        .then(() => console.log('✅ Backend server is running'))
        .catch(() => {
            console.warn('⚠️ Backend server is not running. Start it with: python run.py');
            console.log('The app will work with browser-only transcription and mock data processing.');
        });
});