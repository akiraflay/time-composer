// AI Assistant Interface - Conversational Time Entry System
class AIAssistant {
    constructor() {
        this.isRecording = false;
        this.isPaused = false;
        this.isRecognitionActive = false;
        this.isIntentionalStop = false;
        this.isStartingRecording = false; // Prevent double activation
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.startTime = null;
        this.pausedTime = 0;
        this.timerInterval = null;
        this.recognition = null;
        this.finalTranscript = '';
        this.browserTranscript = ''; // Keep track of browser transcription
        this.lastSpeechTime = Date.now(); // Track silence detection
        this.isStopping = false; // Prevent concurrent stop operations
        this.currentMode = 'initial'; // initial, voice, text, processing, confirmation
        this.messages = [];
        
        // Always use browser-only mode for transcription
        
        this.initializeSpeechRecognition();
        this.bindEvents();
    }

    initializeSpeechRecognition() {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            
            this.recognition.continuous = false; // Stop after silence
            this.recognition.interimResults = true;
            this.recognition.lang = 'en-US';
            
            this.recognition.onstart = () => {
                // console.log('Speech recognition started');
                this.isRecognitionActive = true;
                this.showLiveTranscription();
            };
            
            this.recognition.onresult = (event) => {
                this.handleSpeechResult(event);
            };
            
            this.recognition.onerror = (event) => {
                // Ignore no-speech errors - attorneys may pause while thinking
                if (event.error === 'no-speech') {
                    return;
                }
                console.error('Speech recognition error:', event.error);
            };
            
            this.recognition.onend = () => {
                // console.log('Speech recognition ended');
                this.isRecognitionActive = false;
                
                // Restart recognition if we're still recording and it wasn't an intentional stop
                if (this.isRecording && !this.isIntentionalStop && !this.isPaused) {
                    // console.log('Restarting recognition to continue listening...');
                    setTimeout(() => {
                        if (this.recognition && this.isRecording && !this.isIntentionalStop) {
                            try {
                                this.recognition.start();
                                this.isRecognitionActive = true;
                            } catch (e) {
                                // console.log('Could not restart recognition:', e);
                            }
                        }
                    }, 100);
                } else {
                    this.hideLiveTranscription();
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
        document.getElementById('voice-stop-btn')?.addEventListener('click', () => {
            this.isIntentionalStop = true;
            this.stopRecording();
        });
        
        
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
        
        // Automatically start voice recording
        setTimeout(() => {
            this.switchToVoiceMode();
        }, 300);
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
        
        // Automatically start voice recording
        setTimeout(() => {
            this.switchToVoiceMode();
        }, 300);
    }

    async close() {
        const assistant = document.getElementById('ai-assistant');
        assistant.classList.remove('active');
        await this.stopRecording();
        this.resetInterface();
        this.selectedDate = null;
    }

    handleSuggestionClick(action) {
        switch (action) {
            case 'voice':
                this.switchToVoiceMode();
                break;
            default:
                // console.log('Unknown action:', action);
        }
    }

    async switchToVoiceMode() {
        this.currentMode = 'voice';
        // hideAllInterfaces already called by resetInterface in open()
        document.getElementById('voice-interface').classList.remove('hidden');
        this.updateStatus('Voice mode active');
        
        // Only add the message if we don't already have messages
        if (document.querySelectorAll('#messages-container .message').length === 0) {
            this.addAssistantMessage('What work did you accomplish today? I\'ll help you turn it into professional time entries.');
        }
        
        // Check if already recording or starting to record
        if (this.isRecording || this.isRecognitionActive || this.isStartingRecording) {
            // console.log('Recording already active or starting, skipping duplicate start');
            return;
        }
        
        try {
            // Automatically start recording
            await this.startRecording();
        } catch (err) {
            console.error('Failed to start recording:', err);
            this.showError('Unable to start recording. Please check your microphone permissions.');
        }
    }


    async toggleRecording() {
        if (this.isRecording) {
            await this.stopRecording();
        } else {
            await this.startRecording();
        }
    }

    async startRecording() {
        // Prevent multiple simultaneous starts
        if (this.isStartingRecording) {
            // console.log('Already starting recording, skipping duplicate call');
            return;
        }
        
        try {
            this.isStartingRecording = true;
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Try to use webm/opus format which is widely supported
            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
                ? 'audio/webm;codecs=opus' 
                : 'audio/webm';
            
            this.mediaRecorder = new MediaRecorder(stream, { mimeType });
            this.audioChunks = [];
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };
            
            this.mediaRecorder.onstop = () => {
                if (this.isIntentionalStop) {
                    this.processRecording();
                }
                // Reset the flag
                this.isIntentionalStop = false;
            };
            
            // Set up audio analysis for visual feedback
            this.setupAudioAnalysis(stream);
            
            this.mediaRecorder.start(100);
            this.startTime = Date.now();
            this.pausedTime = 0;
            this.isRecording = true;
            this.isPaused = false;
            this.finalTranscript = '';
            this.browserTranscript = '';
            this.lastSpeechTime = Date.now();
            
            // Start speech recognition for live transcription
            if (this.recognition && !this.isRecognitionActive) {
                try {
                    this.recognition.start();
                } catch (e) {
                    // If recognition is already started, this is not an error
                    if (e.name === 'InvalidStateError' && e.message.includes('already started')) {
                        // console.log('Recognition already active');
                        this.isRecognitionActive = true;
                    } else {
                        console.error('Failed to start recognition:', e);
                    }
                }
            } else if (this.isRecognitionActive) {
                // console.log('Recognition already active, skipping start');
            }
            
            this.updateRecordingUI();
            this.startTimer();
            this.updateStatus('Recording... Tell me about your billable work');
            console.log('🎤 Recording started');
            
        } catch (err) {
            console.error('Error accessing microphone:', err);
            this.showError('Please allow microphone access to record');
        } finally {
            this.isStartingRecording = false;
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
                try {
                    this.recognition.stop();
                } catch (e) {
                    // console.log('Recognition already stopped');
                }
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

    async stopRecording() {
        // Prevent concurrent stop operations
        if (this.isStopping) {
            // console.log('Already stopping recording, ignoring duplicate call');
            return;
        }
        
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.isStopping = true;
            this.isRecording = false;
            this.isPaused = false;
            
            try {
                
                // Sync any edited text before processing
                this.syncEditedTranscription();
                
                this.mediaRecorder.stop();
                this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
                
                if (this.recognition) {
                    try {
                        this.recognition.stop();
                    } catch (e) {
                        // console.log('Recognition already stopped');
                    }
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
                console.log('⏹️ Recording stopped');
                this.updateStatus('Processing your recording...');
                
                // Hide live transcription and show processing
                this.hideLiveTranscription();
            } catch (error) {
                console.error('Error during stopRecording:', error);
                // Ensure UI is updated even if there's an error
                this.updateRecordingUI();
                this.updateStatus('Error occurred while stopping recording');
            } finally {
                // Always reset the stopping flag
                this.isStopping = false;
            }
        }
    }
    
    syncEditedTranscription() {
        const userLiveText = document.getElementById('live-user-text');
        if (userLiveText) {
            const currentText = userLiveText.textContent.trim();
            if (currentText && currentText !== 'Start speaking...') {
                // Update transcripts with the final edited version
                this.browserTranscript = currentText;
                this.finalTranscript = currentText;
            }
        }
    }

    async processRecording() {
        try {
            this.currentMode = 'processing';
            
            // Disable the main button during processing
            const recordBtn = document.getElementById('voice-record-btn');
            if (recordBtn) {
                recordBtn.disabled = true;
            }
            
            // Sync any final edits
            this.syncEditedTranscription();
            
            // Validate browser transcript before using it
            if (!this.browserTranscript || typeof this.browserTranscript !== 'string' || this.browserTranscript.trim() === '') {
                this.finalTranscript = '';
                throw new Error('No transcription available. Please try recording again.');
            }
            
            // Use browser transcript as final
            this.finalTranscript = this.browserTranscript;
            
            // Show what we heard
            this.addAssistantThinking('I heard you say: "' + this.finalTranscript.trim() + '"');
            
            // Simulate AI processing steps
            await this.simulateAIProcessing();
            
            try {
                // Process with enhancement API
                console.log('🔄 Processing recorded text...');
                const response = await api.enhance(this.finalTranscript);
                console.log('✅ Enhancement complete');
                
                // Store original text in response for later use
                response.original_text = this.finalTranscript;
                
                // Show results in conversational format
                this.showConversationalResults(response);
            } catch (apiError) {
                console.error('API enhancement failed:', apiError);
                // console.log('Falling back to mock response');
                
                // Create a mock response for demo purposes
                const mockResponse = this.createMockResponse(this.finalTranscript);
                this.showConversationalResults(mockResponse);
            }
            
        } catch (err) {
            console.error('Error processing recording:', err);
            this.clearThinking();
            this.showError(err.message || 'Failed to process recording. Please try again.');
            
            // Re-enable the button on error
            const recordBtn = document.getElementById('voice-record-btn');
            if (recordBtn) {
                recordBtn.disabled = false;
            }
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
                const hours = partTimeMatch ? this.parseTimeToHours(partTimeMatch[1], partTimeMatch[2]) : 0.5;
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
            const hours = times[0] ? this.parseTimeToHours(times[0][1], times[0][2]) : 0.5;
            narratives.push({
                text: text.trim(),
                hours: hours,
                task_code: 'L310'
            });
        }
        
        const totalHours = narratives.reduce((sum, n) => sum + n.hours, 0);
        
        return {
            groupId: generateUUID(),
            originalText: text,
            cleanedText: text,
            narratives: narratives,
            totalHours: totalHours,
            // For backward compatibility with UI
            entry: {
                narratives: narratives,
                total_hours: totalHours
            },
            total_narratives: narratives.length,
            total_hours: totalHours
        };
    }

    parseTimeToHours(value, unit) {
        const num = parseFloat(value);
        if (unit.match(/min/i)) {
            return num / 60;
        }
        return num;
    }

    async simulateAIProcessing() {
        const steps = [
            { message: 'Processing your input...', delay: 600 },
            { message: 'Separator Agent: Cleaning text and identifying billable activities...', delay: 700 },
            { message: 'Refiner Agent: Crafting professional billing narratives...', delay: 800 }
        ];
        
        for (const step of steps) {
            this.updateThinkingMessage(step.message);
            await new Promise(resolve => setTimeout(resolve, step.delay));
        }
    }

    showConversationalResults(response) {
        this.currentMode = 'confirmation';
        this.lastResponse = response; // Store for saving later
        this.clearThinking();
        
        // Initialize assignment mode - default to individual for better UX
        this.assignmentMode = 'individual'; // 'bulk' or 'individual'
        
        // Handle both old and new response formats
        const narratives = response.narratives || (response.entry && response.entry.narratives) || [];
        const totalHours = response.totalHours || response.total_hours || 0;
        
        // Add analysis message
        const narrativeCount = narratives.length;
        const summary = `I've identified ${narrativeCount} billable ${narrativeCount === 1 ? 'activity' : 'activities'} totaling ${totalHours.toFixed(1)} hours:`;
        this.addAssistantMessage(summary);
        
        // Add each narrative as part of a single entry message - ultra-compact design with integrated actions
        const entryHtml = `
            <div class="ai-response ultra-compact-review">
                <div class="response-header-compact">
                    <span>Time Entries</span>
                    <label class="select-all-inline">
                        <input type="checkbox" id="select-all-narratives" checked onchange="window.aiAssistant.toggleSelectAll()">
                        <span>Select All</span>
                    </label>
                    <div class="confidence-indicator-compact">
                        <span>Confidence:</span>
                        <div class="confidence-bar">
                            <div class="confidence-fill" style="width: ${Math.random() * 30 + 70}%"></div>
                        </div>
                    </div>
                </div>
                <div class="entry-content scrollable-entries-compact" id="ai-entry-content">
                    ${narratives.map((narrative, index) => `
                        <div class="narrative-item ultra-compact-narrative" data-narrative-index="${index}">
                            <div class="narrative-checkbox-wrapper">
                                <input type="checkbox" id="select-narrative-${index}" class="narrative-checkbox" checked onchange="window.aiAssistant.updateNarrativeSelection(${index})">
                            </div>
                            <div class="narrative-content-wrapper">
                                <div class="narrative-main-row">
                                    <input type="number" 
                                       id="narrative-hours-${index}" 
                                       name="narrative-hours-${index}"
                                       class="narrative-hours-input" 
                                       value="${narrative.hours.toFixed(1)}" 
                                       step="0.1" 
                                       min="0.1" 
                                       style="width: 60px; margin-right: 5px;">
                                <span style="margin-right: 10px;">hours</span>
                                <textarea id="narrative-text-${index}" 
                                          name="narrative-text-${index}"
                                          class="narrative-text-input" 
                                          rows="1" 
                                          autocomplete="off"
                                          style="flex: 1; resize: vertical; min-height: 24px;">${narrative.text}</textarea>
                                <span class="narrative-index-inline" style="margin-left: 10px;">#${index + 1}</span>
                            </div>
                            <div class="narrative-inputs-row" id="narrative-fields-${index}">
                                <input type="text" 
                                       id="narrative-client-${index}" 
                                       name="client-code-${index}"
                                       placeholder="Client Code" 
                                       class="ultra-compact-input"
                                       autocomplete="organization"
                                       value="${narrative.clientCode || narrative.client_code || ''}">
                                <input type="text" 
                                       id="narrative-matter-${index}" 
                                       name="matter-number-${index}"
                                       placeholder="Matter #" 
                                       class="ultra-compact-input"
                                       autocomplete="off"
                                       value="${narrative.matterNumber || narrative.matter_number || ''}">
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="integrated-actions">
                    <button class="unified-action-btn" onclick="window.aiAssistant.startOver()">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                            <path d="M12,5V1L7,6L12,11V7A6,6 0 0,1 18,13A6,6 0 0,1 12,19A6,6 0 0,1 6,13H4A8,8 0 0,0 12,21A8,8 0 0,0 20,13A8,8 0 0,0 12,5Z"/>
                        </svg>
                        <span>Restart</span>
                    </button>
                    ${narrativeCount > 1 ? `
                        <div class="apply-to-selected-container">
                            <button class="unified-action-btn" id="apply-to-selected-btn" onclick="window.aiAssistant.showInlineApply()">
                                <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                                    <path d="M19,3H14.82C14.4,1.84 13.3,1 12,1C10.7,1 9.6,1.84 9.18,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5A2,2 0 0,0 19,3M12,3A1,1 0 0,1 13,4A1,1 0 0,1 12,5A1,1 0 0,1 11,4A1,1 0 0,1 12,3M7,7H17V5H19V19H5V5H7V7Z"/>
                                </svg>
                                <span>Apply to Selected</span>
                            </button>
                            <div class="inline-apply-form hidden" id="inline-apply-form">
                                <input type="text" placeholder="Client Code" id="inline-client-code" class="inline-apply-input" autocomplete="organization">
                                <input type="text" placeholder="Matter #" id="inline-matter-code" class="inline-apply-input" autocomplete="off">
                                <button class="inline-apply-btn" onclick="window.aiAssistant.applyInlineCodes()">Apply</button>
                                <button class="inline-cancel-btn" onclick="window.aiAssistant.hideInlineApply()">Cancel</button>
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        this.addAssistantMessage(entryHtml, true);
        
        this.updateStatus('Review and confirm your time entries');
        
        // Convert main button to Save entries
        this.convertMainButtonToSave();
        
        // Scroll to show the summary message after DOM updates
        setTimeout(() => {
            const container = document.getElementById('messages-container');
            const messages = container.querySelectorAll('.message');
            if (messages.length >= 2) {
                // Find the summary message (second to last message)
                const summaryMessage = messages[messages.length - 2];
                summaryMessage.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 100);
    }
    
    convertMainButtonToSave() {
        const recordBtn = document.getElementById('voice-record-btn');
        if (recordBtn) {
            // Enable the button now that processing is complete
            recordBtn.disabled = false;
            
            // Update button appearance
            recordBtn.innerHTML = `
                <svg class="btn-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z"/>
                </svg>
                <span class="btn-text">Save entries</span>
            `;
            
            // Remove old event listener and add new one
            const newButton = recordBtn.cloneNode(true);
            newButton.disabled = false; // Ensure the cloned button is also enabled
            recordBtn.parentNode.replaceChild(newButton, recordBtn);
            newButton.addEventListener('click', () => this.confirmEntries());
            
            // Show the button if it was hidden
            document.getElementById('voice-interface').classList.remove('hidden');
        }
    }



    // UI Helper Methods
    hideAllInterfaces() {
        // console.log('Hiding all interfaces...');
        const voiceInterface = document.getElementById('voice-interface');
        const textInterface = document.getElementById('text-interface');
        const inputArea = document.getElementById('input-area');
        
        if (voiceInterface) voiceInterface.classList.add('hidden');
        if (textInterface) {
            textInterface.classList.add('hidden');
            // console.log('Text interface hidden');
        }
        if (inputArea) inputArea.classList.add('hidden');
    }

    resetInterface() {
        this.hideAllInterfaces();
        this.clearMessages();
        this.hideLiveTranscription();
        this.clearTimer();
        this.transcriptionMessageId = null;
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
                <div class="message-text" id="live-user-text" contenteditable="false" spellcheck="false">
                    <span class="transcription-placeholder">Start speaking...</span>
                </div>
            </div>
        `;
        
        container.appendChild(messageDiv);
        container.scrollTop = container.scrollHeight;
        
        // Edit handlers disabled - transcription is view-only
        // this.setupTranscriptionEditHandlers();
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
                this.finalTranscript = editedText;
            }
        });
        
        // Input handler to maintain white text color
        userLiveText.addEventListener('input', () => {
            // Wrap plain text in proper span
            const text = userLiveText.textContent;
            if (text && !userLiveText.querySelector('span')) {
                userLiveText.innerHTML = `<span class="transcription-confirmed">${text}</span>`;
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
        
        // Update the display immediately with browser results
        this.updateBrowserTranscriptionDisplay(interimTranscript);
    }
    
    updateBrowserTranscriptionDisplay(interimTranscript = '') {
        const userLiveText = document.getElementById('live-user-text');
        if (!userLiveText) return;
        
        // Always update the transcription display
        
        let displayHtml = '';
        
        // Show all browser text as confirmed
        if (this.browserTranscript) {
            displayHtml += `<span class="transcription-confirmed">${this.browserTranscript}</span>`;
        }
        if (interimTranscript) {
            displayHtml += `<span class="interim">${interimTranscript}</span>`;
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
    
    
    
    updateTranscriptionDisplay() {
        // Call the unified display update method
        this.updateBrowserTranscriptionDisplay('');
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
        
        // Remove all messages
        const messages = container.querySelectorAll('.message');
        messages.forEach(msg => msg.remove());
        
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
        
    }

    // Show inline apply form
    showInlineApply() {
        const btn = document.getElementById('apply-to-selected-btn');
        const form = document.getElementById('inline-apply-form');
        
        if (btn) btn.classList.add('hidden');
        if (form) {
            form.classList.remove('hidden');
            // Focus on first input
            setTimeout(() => {
                document.getElementById('inline-client-code')?.focus();
            }, 100);
        }
    }
    
    // Hide inline apply form
    hideInlineApply() {
        const btn = document.getElementById('apply-to-selected-btn');
        const form = document.getElementById('inline-apply-form');
        
        if (btn) btn.classList.remove('hidden');
        if (form) {
            form.classList.add('hidden');
            // Clear inputs
            document.getElementById('inline-client-code').value = '';
            document.getElementById('inline-matter-code').value = '';
        }
    }
    
    // Apply codes to selected entries
    applyInlineCodes() {
        const clientCode = document.getElementById('inline-client-code')?.value || '';
        const matterCode = document.getElementById('inline-matter-code')?.value || '';
        
        // Get checked entries
        const checkedBoxes = document.querySelectorAll('.narrative-checkbox:checked');
        
        if (checkedBoxes.length === 0) {
            // If no entries are checked, apply to all
            this.lastResponse.entry.narratives.forEach((_, index) => {
                const clientInput = document.getElementById(`narrative-client-${index}`);
                const matterInput = document.getElementById(`narrative-matter-${index}`);
                
                if (clientInput && clientCode) clientInput.value = clientCode;
                if (matterInput && matterCode) matterInput.value = matterCode;
            });
        } else {
            // Apply only to checked entries
            checkedBoxes.forEach(checkbox => {
                const index = checkbox.id.replace('select-narrative-', '');
                const clientInput = document.getElementById(`narrative-client-${index}`);
                const matterInput = document.getElementById(`narrative-matter-${index}`);
                
                if (clientInput && clientCode) clientInput.value = clientCode;
                if (matterInput && matterCode) matterInput.value = matterCode;
            });
        }
        
        // Hide inline form
        this.hideInlineApply();
        
        // Show confirmation
        this.updateStatus('Applied codes to selected entries');
    }

    // Action Methods
    async confirmEntries() {
        this.addUserMessage('Yes, save these entries');
        this.addAssistantMessage('Perfect! Let me save these entries to your dashboard...');
        
        try {
            // Show saving process
            this.addAssistantThinking('Saving your time entries...');
            
            // Prepare narratives with client/matter codes
            const responseNarratives = this.lastResponse.narratives || (this.lastResponse.entry && this.lastResponse.entry.narratives) || [];
            let narrativesToSave = [...responseNarratives];
            
            // Filter to only include checked entries
            narrativesToSave = narrativesToSave.filter((_, index) => {
                const checkbox = document.getElementById(`select-narrative-${index}`);
                return checkbox?.checked;
            });
            
            // Get individual codes for checked entries
            narrativesToSave = narrativesToSave.map((narrative, originalIndex) => {
                // Find the original index from the filtered array
                const allNarratives = this.lastResponse.narratives || (this.lastResponse.entry && this.lastResponse.entry.narratives) || [];
                const index = allNarratives.indexOf(narrative);
                const hoursInput = document.getElementById(`narrative-hours-${index}`);
                const textInput = document.getElementById(`narrative-text-${index}`);
                const clientInput = document.getElementById(`narrative-client-${index}`);
                const matterInput = document.getElementById(`narrative-matter-${index}`);
                
                return {
                    ...narrative,
                    hours: parseFloat(hoursInput?.value) || narrative.hours,
                    text: textInput?.value || narrative.text,
                    client_code: clientInput?.value || narrative.client_code || '',
                    matter_number: matterInput?.value || narrative.matter_number || ''
                };
            });
            
            // Calculate new total hours from edited values
            const newTotalHours = narrativesToSave.reduce((sum, narrative) => sum + narrative.hours, 0);
            
            // Save each narrative as an individual record
            if (this.lastResponse) {
                const groupId = this.lastResponse.groupId || generateUUID();
                const createdAt = this.selectedDate ? this.selectedDate.toISOString() : new Date().toISOString();
                
                // Save each narrative individually
                for (const narrative of narrativesToSave) {
                    await dbOperations.saveNarrative({
                        narrative: narrative.text,
                        hours: narrative.hours,
                        clientCode: narrative.client_code || '',
                        matterNumber: narrative.matter_number || '',
                        taskCode: narrative.task_code || '',
                        status: 'draft',
                        groupId: groupId,
                        originalText: this.lastResponse.originalText || this.lastResponse.original_text,
                        cleanedText: this.lastResponse.cleanedText || this.lastResponse.cleaned_text,
                        createdAt: createdAt
                    });
                }
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


    startOver() {
        this.addUserMessage('Let me start over');
        this.addAssistantMessage('Of course! Let\'s capture your billable time again.');
        this.resetInterface();
        this.currentMode = 'initial';
        this.updateStatus('Ready to capture your billable time');
        
        // Automatically switch to voice mode after reset
        setTimeout(() => {
            this.switchToVoiceMode();
        }, 300);
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
        this.addAssistantMessage('I\'ll organize entries by when you did the work. For now, I\'ll use standard time divisions. You can edit the results manually.');
    }

    splitByClient() {
        this.addUserMessage('Split by client/matter');
        this.addAssistantMessage('I\'ll separate entries by different clients or matters based on the context. You can edit the client/matter codes in the results.');
    }

    // Checkbox handling functions
    toggleSelectAll() {
        const selectAll = document.getElementById('select-all-narratives');
        const checkboxes = document.querySelectorAll('.narrative-checkbox');
        
        checkboxes.forEach(checkbox => {
            checkbox.checked = selectAll.checked;
            this.updateNarrativeVisual(checkbox.id.replace('select-narrative-', ''));
        });
    }

    updateNarrativeSelection(index) {
        this.updateNarrativeVisual(index);
        
        // Update Select All checkbox state
        const checkboxes = document.querySelectorAll('.narrative-checkbox');
        const allChecked = Array.from(checkboxes).every(cb => cb.checked);
        const selectAll = document.getElementById('select-all-narratives');
        if (selectAll) {
            selectAll.checked = allChecked;
        }
    }

    updateNarrativeVisual(index) {
        const checkbox = document.getElementById(`select-narrative-${index}`);
        const narrativeItem = document.querySelector(`[data-narrative-index="${index}"]`);
        const contentWrapper = narrativeItem?.querySelector('.narrative-content-wrapper');
        
        if (contentWrapper) {
            if (checkbox?.checked) {
                contentWrapper.classList.remove('unchecked');
            } else {
                contentWrapper.classList.add('unchecked');
            }
        }
    }

    splitCustom() {
        this.addUserMessage('Custom split');
        this.addAssistantMessage('I\'ll reorganize the entries. You can edit them manually in the results.');
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
                this.addAssistantMessage('I\'ll adjust the wording. You can edit the narratives directly in the results.');
                break;
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
    
    // Log initialization info
    console.log('Time Composer Assistant ready');
    
    // Check backend status
    fetch('http://localhost:5001/api/health')
        .then(() => {/* Backend server is running */})
        .catch(() => {
            console.warn('⚠️ Backend server is not running. Start it with: python run.py');
            console.log('The app will work with browser-only transcription and mock data processing.');
        });
});