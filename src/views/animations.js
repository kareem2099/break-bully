// ===== CELEBRATION & ANIMATION FUNCTIONS =====

(function() {
    'use strict';

    // ===== CELEBRATION FUNCTIONS =====
    function createConfetti() {
        const confettiContainer = document.getElementById('confettiContainer');
        if (!confettiContainer) return;

        // Clear any existing confetti
        confettiContainer.innerHTML = '';

        // Create 50 confetti pieces
        for (let i = 0; i < 50; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti-piece';

            // Random position and animation delay
            confetti.style.left = Math.random() * 100 + '%';
            confetti.style.animationDelay = Math.random() * 3 + 's';
            confetti.style.animationDuration = (Math.random() * 2 + 3) + 's';

            confettiContainer.appendChild(confetti);
        }

        // Remove confetti after animation
        setTimeout(() => {
            confettiContainer.innerHTML = '';
        }, 6000);
    }

    function showSuccessCheckmark(targetElement) {
        if (!targetElement) return;

        const checkmark = document.createElement('div');
        checkmark.className = 'success-checkmark';
        targetElement.appendChild(checkmark);

        // Remove after animation
        setTimeout(() => {
            if (checkmark.parentNode) {
                checkmark.parentNode.removeChild(checkmark);
            }
        }, 2000);
    }

    function showGoalCelebration(message) {
        // Create enhanced welcome screen instead of simple popup
        showWelcomeScreen();
    }

    function showWelcomeScreen() {
        const welcomeScreen = document.createElement('div');
        welcomeScreen.className = 'welcome-screen-overlay';
        welcomeScreen.innerHTML = `
            <div class="welcome-screen">
                <div class="welcome-header">
                    <div class="welcome-icon">🎉</div>
                    <h1>Welcome to Break Bully!</h1>
                    <p class="welcome-subtitle">Your journey to healthier coding habits starts now</p>
                </div>

                <div class="welcome-features">
                    <div class="feature-card">
                        <div class="feature-icon">⏰</div>
                        <h3>Smart Timers</h3>
                        <p>Automated work-rest cycles based on proven health research</p>
                    </div>
                    <div class="feature-card">
                        <div class="feature-icon">🛡️</div>
                        <h3>Screen Protection</h3>
                        <p>Strict enforcement prevents coding during mandatory rest periods</p>
                    </div>
                    <div class="feature-card">
                        <div class="feature-icon">📊</div>
                        <h3>Progress Tracking</h3>
                        <p>Monitor your wellness journey with detailed analytics</p>
                    </div>
                    <div class="feature-card">
                        <div class="feature-icon">🏆</div>
                        <h3>Achievements</h3>
                        <p>Earn rewards for maintaining healthy coding habits</p>
                    </div>
                </div>

                <div class="welcome-actions">
                    <button class="welcome-btn primary" onclick="startFirstSession()">
                        <span class="btn-icon">🚀</span>
                        Start My First Session
                    </button>
                    <button class="welcome-btn secondary" onclick="exploreFeatures()">
                        <span class="btn-icon">🔍</span>
                        Explore Features
                    </button>
                </div>

                <div class="welcome-tip">
                    <div class="tip-icon">💡</div>
                    <p><strong>Pro tip:</strong> Your first break reminder will appear soon. Take it as a chance to stretch and hydrate!</p>
                </div>
            </div>
        `;

        document.body.appendChild(welcomeScreen);

        // Animate in
        setTimeout(() => {
            welcomeScreen.classList.add('active');
        }, 100);

        // Auto-remove after 15 seconds if not interacted with
        setTimeout(() => {
            if (welcomeScreen.parentNode) {
                welcomeScreen.classList.remove('active');
                setTimeout(() => {
                    if (welcomeScreen.parentNode) {
                        welcomeScreen.parentNode.removeChild(welcomeScreen);
                    }
                }, 500);
            }
        }, 15000);
    }

    function startFirstSession() {
        // Hide welcome screen
        const welcomeScreen = document.querySelector('.welcome-screen-overlay');
        if (welcomeScreen) {
            welcomeScreen.classList.remove('active');
            setTimeout(() => {
                if (welcomeScreen.parentNode) {
                    welcomeScreen.parentNode.removeChild(welcomeScreen);
                }
            }, 500);
        }

        // Send message to start the first session
        vscode.postMessage({
            command: 'startFirstSession'
        });
    }

    function exploreFeatures() {
        // Hide welcome screen
        const welcomeScreen = document.querySelector('.welcome-screen-overlay');
        if (welcomeScreen) {
            welcomeScreen.classList.remove('active');
            setTimeout(() => {
                if (welcomeScreen.parentNode) {
                    welcomeScreen.parentNode.removeChild(welcomeScreen);
                }
            }, 500);
        }

        // Send message to show feature tour
        vscode.postMessage({
            command: 'showFeatureTour'
        });
    }

    function showAchievementUnlock(achievementText) {
        const achievement = document.createElement('div');
        achievement.className = 'achievement-unlock-celebration';
        achievement.innerHTML = `
            <div class="rarity-indicator">🏆</div>
            <h2>Achievement Unlocked!</h2>
            <p>${achievementText}</p>
        `;

        document.body.appendChild(achievement);

        // Remove after animation
        setTimeout(() => {
            if (achievement.parentNode) {
                achievement.parentNode.removeChild(achievement);
            }
        }, 5000);
    }

    // ===== ANIMATION UTILITIES =====
    function animateProgressFill(progressBar, targetWidth) {
        if (!progressBar) return;

        const fill = progressBar.querySelector('.progress-fill') || progressBar.querySelector('.challenge-progress-fill');
        if (fill) {
            fill.style.width = targetWidth;
        }
    }

    function addStreakFire(element) {
        if (!element) return;

        element.classList.add('streak-fire');

        // Remove after some time (optional, can be permanent for active streaks)
        setTimeout(() => {
            element.classList.remove('streak-fire');
        }, 10000);
    }

    function fadeInElement(element) {
        if (!element) return;

        element.classList.add('fade-in');
    }

    function bounceInElement(element) {
        if (!element) return;

        element.classList.add('success-message');
    }

    function shakeElement(element) {
        if (!element) return;

        element.classList.add('shake');

        setTimeout(() => {
            element.classList.remove('shake');
        }, 500);
    }

    // ===== ACTION HANDLERS =====
    function takeBreak() {
        vscode.postMessage({
            command: 'takeBreak'
        });
    }

    function openSettings() {
        vscode.postMessage({
            command: 'openSettings'
        });
    }

    function showStretch() {
        vscode.postMessage({
            command: 'showStretch'
        });
    }

    function breathingExercise() {
        vscode.postMessage({
            command: 'breathingExercise'
        });
    }

    function showEyeExercise() {
        vscode.postMessage({
            command: 'showEyeExercise'
        });
    }

    function showWaterReminder() {
        vscode.postMessage({
            command: 'showWaterReminder'
        });
    }

    function showAnalytics() {
        vscode.postMessage({
            command: 'showAnalytics'
        });
    }

    // ===== ACHIEVEMENT FEATURES =====
    function exportAchievements() {
        vscode.postMessage({
            command: 'exportAchievements'
        });
    }

    function showAchievementStats() {
        vscode.postMessage({
            command: 'showAchievementStats'
        });
    }

    function showAchievementsGallery() {
        vscode.postMessage({
            command: 'showAchievementsGallery'
        });
    }

    // ===== ADVANCED WELLNESS FEATURES =====
    function createCustomGoal() {
        vscode.postMessage({
            command: 'createCustomGoal'
        });
    }

    function createChallenge() {
        vscode.postMessage({
            command: 'createChallenge'
        });
    }

    function createCustomExercise() {
        vscode.postMessage({
            command: 'createCustomExercise'
        });
    }

    function updateWellnessInsights() {
        const timeRange = document.getElementById('insightsTimeRange').value;
        vscode.postMessage({
            command: 'getWellnessInsights',
            data: { timeRange }
        });
    }

    // ===== EXPOSE FUNCTIONS =====
    window.createConfetti = createConfetti;
    window.showSuccessCheckmark = showSuccessCheckmark;
    window.showGoalCelebration = showGoalCelebration;
    window.showWelcomeScreen = showWelcomeScreen;
    window.startFirstSession = startFirstSession;
    window.exploreFeatures = exploreFeatures;
    window.showAchievementUnlock = showAchievementUnlock;
    window.animateProgressFill = animateProgressFill;
    window.addStreakFire = addStreakFire;
    window.fadeInElement = fadeInElement;
    window.bounceInElement = bounceInElement;
    window.shakeElement = shakeElement;
    window.takeBreak = takeBreak;
    window.openSettings = openSettings;
    window.showStretch = showStretch;
    window.breathingExercise = breathingExercise;
    window.showEyeExercise = showEyeExercise;
    window.showWaterReminder = showWaterReminder;
    window.showAnalytics = showAnalytics;
    window.exportAchievements = exportAchievements;
    window.showAchievementStats = showAchievementStats;
    window.showAchievementsGallery = showAchievementsGallery;
    window.createCustomGoal = createCustomGoal;
    window.createChallenge = createChallenge;
    window.createCustomExercise = createCustomExercise;
    window.updateWellnessInsights = updateWellnessInsights;

})();
