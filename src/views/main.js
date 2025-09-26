// ===== BREAK BULLY MAIN JAVASCRIPT =====

(function() {
    'use strict';

    // ===== GLOBAL VARIABLES =====
    const vscode = acquireVsCodeApi();
    let timerInterval;
    let lastUpdateTime = Date.now();
    let currentOnboardingStep = 1;
    let onboardingCompleted = false;

    // Make vscode available globally for other modules
    window.vscode = vscode;

    // ===== INITIALIZATION =====
    function initialize() {
        console.log('Break Bully webview initialized - HTML loaded successfully!');

        // Set up message listener
        window.addEventListener('message', handleMessage);

        // Start timer updates
        startTimerUpdates();

        // Start time display updates
        startTimeUpdates();

        // Request initial data
        vscode.postMessage({
            command: 'requestInitialData'
        });

        // Add a visual indicator that the webview is working
        const container = document.querySelector('.container');
        if (container) {
            container.style.border = '2px solid #ff6b6b';
            setTimeout(() => {
                container.style.border = 'none';
            }, 3000);
        }
    }

    // ===== MESSAGE HANDLING =====
    function handleMessage(event) {
        const message = event.data;
        console.log('Received message from extension:', message.command, message.data);

        switch (message.command) {
            case 'updateStats':
                updateStats(message.data);
                break;
            case 'updateStatus':
                updateStatus(message.data);
                break;
            case 'updateTimer':
                updateTimerDisplay(message.data);
                break;
            case 'updateScreenTime':
                updateScreenTime(message.data);
                break;
            case 'updateActivityStatus':
                updateActivityStatus(message.data);
                break;
            case 'showTimer':
                showTimer(message.data);
                break;
            case 'updateTheme':
                updateTheme();
                break;
            case 'updateWellnessGoals':
                updateWellnessGoals(message.data);
                break;
            case 'updateWellnessChallenges':
                updateWellnessChallenges(message.data);
                break;
            case 'celebrateGoal':
                showGoalCelebration(message.data.message);
                createConfetti();
                break;
            case 'celebrateExercise':
                createConfetti();
                showSuccessCheckmark(document.body);
                break;
            case 'celebrateAchievement':
                showAchievementUnlock(message.data.achievement);
                createConfetti();
                break;
            case 'updateAchievements':
                updateAchievements(message.data);
                break;
            case 'updateAchievementStats':
                updateAchievementStats(message.data);
                break;
            case 'updateWellnessInsightsDisplay':
                updateWellnessInsightsDisplay(message.data);
                break;
            case 'addStreakFire':
                const streakElement = document.getElementById('streakDays');
                if (streakElement) {
                    addStreakFire(streakElement);
                }
                break;
            case 'workRestModels':
                populateOnboardingModels(message.data);
                populateSettingsWorkRestModels(message.data);
                break;
            case 'workRestModelsForQuickPick':
                showWorkRestModelQuickPick(message.data);
                break;
            case 'workRestModelDetails':
                updateOnboardingModelInfo(message.data);
                updateSettingsModelInfo(message.data);
                break;
            case 'onboardingStatus':
                handleOnboardingStatus(message.data);
                break;
            case 'workRestModelChanged':
                handleWorkRestModelChanged(message.data);
                break;
            case 'activityIntegrationSettings':
                populateActivityIntegrationSettings(message.data);
                break;
            case 'settingsApplied':
                handleSettingsApplied(message.data);
                break;
        }
    }

    // ===== TIMER MANAGEMENT =====
    function startTimerUpdates() {
        if (timerInterval) {
            clearInterval(timerInterval);
        }

        timerInterval = setInterval(() => {
            // Request current timer status from extension
            vscode.postMessage({
                command: 'requestTimerStatus'
            });
        }, 1000);
    }

    // ===== TIME DISPLAY MANAGEMENT =====
    let timeUpdateInterval;

    function startTimeUpdates() {
        // Update immediately
        updateCurrentTime();

        // Then update every second
        if (timeUpdateInterval) {
            clearInterval(timeUpdateInterval);
        }

        timeUpdateInterval = setInterval(updateCurrentTime, 1000);
    }

    function updateCurrentTime() {
        const now = new Date();

        // Format time (HH:MM:SS AM/PM)
        const timeString = now.toLocaleTimeString('en-US', {
            hour12: true,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        // Format Gregorian date (Day, Mon DD, YYYY)
        const gregorianDate = now.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: '2-digit',
            year: 'numeric'
        });

        // Calculate Hijri date
        const hijriDate = gregorianToHijri(now.getFullYear(), now.getMonth() + 1, now.getDate());
        const hijriString = `${hijriDate.day} ${getHijriMonthName(hijriDate.month)} ${hijriDate.year} AH`;

        // Display dates on separate lines
        const fullDateString = `${gregorianDate}\n${hijriString}`;

        // Update DOM elements
        const timeElement = document.getElementById('timeDisplay');
        const dateElement = document.getElementById('dateDisplay');

        if (timeElement) {
            timeElement.textContent = timeString;
        }

        if (dateElement) {
            dateElement.textContent = fullDateString;
        }
    }

    // ===== HIJRI DATE CALCULATION =====

    function gregorianToHijri(year, month, day) {
        // Simplified Hijri date calculation
        // This is an approximation - for production use, consider a more accurate library

        // Days since Islamic epoch (July 16, 622 CE)
        const gregorianDays = Math.floor((new Date(year, month - 1, day) - new Date(622, 6, 16)) / (24 * 60 * 60 * 1000));

        // Islamic year calculation (approximate)
        let islamicYear = Math.floor(gregorianDays / 354.367);
        let remainingDays = gregorianDays - Math.floor(islamicYear * 354.367);

        // Adjust for leap years and month lengths
        const monthLengths = [30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 30, 29]; // 12 months

        let islamicMonth = 0;
        let islamicDay = remainingDays;

        while (islamicDay >= monthLengths[islamicMonth]) {
            islamicDay -= monthLengths[islamicMonth];
            islamicMonth++;
            if (islamicMonth >= 12) {
                islamicYear++;
                islamicMonth = 0;
            }
        }

        // Adjust year (Islamic calendar starts from 1 AH)
        islamicYear += 1;

        return {
            year: islamicYear,
            month: islamicMonth + 1, // 1-based
            day: Math.max(1, islamicDay + 1) // 1-based, ensure minimum 1
        };
    }

    function getHijriMonthName(month) {
        const monthNames = [
            'Muharram', 'Safar', 'Rabi\' al-awwal', 'Rabi\' al-thani',
            'Jumada al-awwal', 'Jumada al-thani', 'Rajab', 'Sha\'ban',
            'Ramadan', 'Shawwal', 'Dhu al-Qi\'dah', 'Dhu al-Hijjah'
        ];
        return monthNames[month - 1] || '';
    }

    function updateTimerDisplay(data) {
        const timerDisplay = document.getElementById('timerDisplay');
        const timerLabel = document.getElementById('timerLabel');
        const takeBreakBtn = document.getElementById('takeBreakBtn');
        console.log('updateTimerDisplay called with data:', data, 'takeBreakBtn:', takeBreakBtn);
        if (!timerDisplay) {
            console.log('timerDisplay not found');
            return;
        }
        if (!takeBreakBtn) {
            console.log('takeBreakBtn not found, trying querySelector');
            const btn = document.querySelector('#takeBreakBtn');
            console.log('querySelector result:', btn);
        }

        if (data && data.nextReminder) {
            const now = Date.now();
            const timeLeft = Math.max(0, data.nextReminder - now);
            const minutes = Math.floor(timeLeft / (1000 * 60));
            const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

            timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

            // Update label and button based on phase
            if (timerLabel && data.phase) {
                if (data.phase === 'work') {
                    timerLabel.textContent = 'Next Break In';
                    if (takeBreakBtn) {
                        takeBreakBtn.innerHTML = '<span class="btn-icon">🛋️</span>Take Break';
                    }
                } else if (data.phase === 'rest') {
                    timerLabel.textContent = 'Rest Time Left';
                    if (takeBreakBtn) {
                        console.log('Updating takeBreakBtn to Complete Break');
                        takeBreakBtn.innerHTML = '<span class="btn-icon">🔄</span>Complete Break';
                    } else {
                        console.log('takeBreakBtn not found for rest phase');
                    }
                }
            }
        } else {
            timerDisplay.textContent = '--:--';
            if (timerLabel) {
                timerLabel.textContent = 'Time until next break reminder';
            }
            if (takeBreakBtn) {
                takeBreakBtn.innerHTML = '<span class="btn-icon">🎉</span>Take Break';
            }
        }
    }

    function showTimer(data) {
        const timerDisplay = document.getElementById('timerDisplay');
        if (!timerDisplay) return;

        const duration = data.duration;
        let remaining = duration;

        const updateTimer = () => {
            const minutes = Math.floor(remaining / 60);
            const seconds = remaining % 60;
            timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

            if (remaining <= 0) {
                clearInterval(timerInterval);
                timerDisplay.textContent = '00:00';
                vscode.postMessage({
                    command: 'timerComplete'
                });
            } else {
                remaining--;
            }
        };

        updateTimer();
        if (timerInterval) {
            clearInterval(timerInterval);
        }
        timerInterval = setInterval(updateTimer, 1000);
    }

    // ===== THEME MANAGEMENT =====
    function updateTheme() {
        const body = document.body;
        const theme = vscode.getState()?.theme || 'dark';

        body.setAttribute('data-vscode-theme-kind', theme === 'dark' ? 'vscode-dark' : 'vscode-light');
    }

    // ===== ONBOARDING FUNCTIONS =====
    function updateOnboardingModelInfo(model) {
        const modelInfoElement = document.getElementById('onboardingModelInfo');
        if (!modelInfoElement || !model) return;

        const workDuration = model.workDuration;
        const restDuration = model.restDuration;
        const basedOn = model.basedOn.toUpperCase();

        modelInfoElement.innerHTML = `
            <div style="font-weight: 600; margin-bottom: 8px;">${model.name}</div>
            <div style="font-size: 12px; margin-bottom: 8px;">${model.description}</div>
            <div style="font-size: 11px; color: var(--vscode-descriptionForeground, #cccccc99);">
                <div>Work: ${workDuration} minutes</div>
                <div>Rest: ${restDuration} minutes</div>
                <div>Based on: ${basedOn} guidelines</div>
            </div>
        `;
    }

    // ===== WORK-REST MODEL CHANGE FUNCTION =====
    function changeWorkRestModel() {
        // Request available models from extension
        vscode.postMessage({
            command: 'getWorkRestModelsForQuickPick'
        });
    }

    function showWorkRestModelQuickPick(models) {
        // Create options for VSCode quick pick
        const options = models.map(model => ({
            label: model.name,
            detail: `${model.workDuration}min work, ${model.restDuration}min rest`,
            description: model.description.substring(0, 50) + (model.description.length > 50 ? '...' : ''),
            modelId: model.id
        }));

        // Send to extension to show VSCode quick pick
        vscode.postMessage({
            command: 'showQuickPick',
            data: {
                items: options,
                placeHolder: 'Select a work-rest model'
            }
        });
    }

    function handleWorkRestModelChanged(data) {
        if (data.success) {
            // Show success message
            vscode.postMessage({
                command: 'showInfoMessage',
                data: { message: 'Work-rest model changed successfully! Timer updated.' }
            });

            // Request immediate timer update
            vscode.postMessage({
                command: 'requestTimerStatus'
            });
        } else {
            // Show error message
            vscode.postMessage({
                command: 'showErrorMessage',
                data: { message: 'Failed to change work-rest model. Please try again.' }
            });
        }
    }

    // ===== ACTIVITY INTEGRATION SETTINGS =====
    function loadActivityIntegrationSettings() {
        // Request current activity integration level from extension
        vscode.postMessage({
            command: 'getActivityIntegrationSettings'
        });
    }

    function startWorkRestSession() {
        // Get selected work-rest model
        const workRestSelect = document.getElementById('settingsWorkRestSelect');
        const selectedModel = workRestSelect ? workRestSelect.value : null;

        if (!selectedModel) {
            vscode.postMessage({
                command: 'showErrorMessage',
                data: { message: 'Please select a work-rest model first.' }
            });
            return;
        }

        // Send to extension to start session
        vscode.postMessage({
            command: 'startWorkRestSession',
            data: { modelId: selectedModel }
        });
    }

    function stopWorkRestSession() {
        // Send to extension to stop session
        vscode.postMessage({
            command: 'stopWorkRestSession'
        });
    }

    function applySettingsChanges() {
        // Get selected activity level
        const selectedLevel = document.querySelector('input[name="activityLevel"]:checked').value;

        // Get selected work-rest model
        const workRestSelect = document.getElementById('settingsWorkRestSelect');
        const selectedModel = workRestSelect ? workRestSelect.value : null;

        // Send settings to extension
        vscode.postMessage({
            command: 'applySettingsChanges',
            data: {
                activityLevel: selectedLevel,
                workRestModel: selectedModel
            }
        });
    }

    function populateActivityIntegrationSettings(settings) {
        if (!settings) return;

        // Set the radio button for current activity level
        const radioButton = document.querySelector(`input[name="activityLevel"][value="${settings.activityIntegrationLevel}"]`);
        if (radioButton) {
            radioButton.checked = true;
        }
    }

    function handleSettingsApplied(data) {
        if (data.success) {
            // Close settings modal
            const modal = document.getElementById('settingsModalOverlay');
            if (modal) {
                modal.classList.add('hidden');
            }

            // Show success message
            vscode.postMessage({
                command: 'showInfoMessage',
                data: { message: 'Settings saved successfully!' }
            });

            // Request immediate timer update
            vscode.postMessage({
                command: 'requestTimerStatus'
            });
        } else {
            // Show error message
            vscode.postMessage({
                command: 'showErrorMessage',
                data: { message: `Failed to save settings: ${data.error || 'Unknown error'}` }
            });
        }
    }

    function handleOnboardingStatus(data) {
        if (!data.completed) {
            // Onboarding not completed, show it
            checkOnboardingStatus();
        } else {
            // Onboarding completed, save to webview state for future reference
            const state = vscode.getState() || {};
            state.onboardingCompleted = true;
            vscode.setState(state);
        }
    }

    // ===== CUSTOM EXERCISE FUNCTIONS =====
    function createCustomExercise() {
        vscode.postMessage({
            command: 'createCustomExercise'
        });
    }

    function showCustomExerciseLibrary() {
        vscode.postMessage({
            command: 'showCustomExerciseLibrary'
        });
    }

    function checkGitProductivity() {
        vscode.postMessage({
            command: 'showGitProductivityDashboard'
        });
    }

    // Make functions globally available
    window.createCustomExercise = createCustomExercise;
    window.showCustomExerciseLibrary = showCustomExerciseLibrary;
    window.checkGitProductivity = checkGitProductivity;

    // ===== UTILITY FUNCTIONS =====
    function getTimeAgo(date) {
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
        if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        return 'Just now';
    }

    // ===== EVENT HANDLERS =====
    function handleVisibilityChange() {
        if (document.hidden) {
            // Page is hidden, pause updates
            if (timerInterval) {
                clearInterval(timerInterval);
                timerInterval = null;
            }
            if (timeUpdateInterval) {
                clearInterval(timeUpdateInterval);
                timeUpdateInterval = null;
            }
        } else {
            // Page is visible, resume updates
            startTimerUpdates();
            startTimeUpdates();
        }
    }

    function handleResize() {
        const container = document.querySelector('.container');
        if (window.innerWidth < 280) {
            container.style.maxWidth = '240px';
        } else {
            container.style.maxWidth = '320px';
        }
    }

    // ===== INITIALIZATION =====
    document.addEventListener('DOMContentLoaded', function() {
        initialize();

        // Set up event listeners
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('resize', handleResize);

        // Update motivation quote every 30 seconds
        setInterval(updateMotivationQuote, 30000);

        // Initial resize handling
        handleResize();

        // Check if onboarding should be shown (after a short delay to ensure UI is ready)
        setTimeout(() => {
            // Request onboarding status from extension
            vscode.postMessage({
                command: 'requestOnboardingStatus'
            });
        }, 1000);
    });

})();
