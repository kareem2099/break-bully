// ===== UI UPDATE FUNCTIONS =====

(function() {
    'use strict';

    // ===== VARIABLE DECLARATIONS =====
    let lastUpdateTime = Date.now();

    // ===== UTILITY FUNCTIONS =====
    function getTimeAgo(date) {
        const now = new Date();
        const diffInMs = now - date;
        const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
        const diffInHours = Math.floor(diffInMinutes / 60);
        const diffInDays = Math.floor(diffInHours / 24);

        if (diffInMinutes < 60) {
            return `${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'} ago`;
        } else if (diffInHours < 24) {
            return `${diffInHours} hour${diffInHours === 1 ? '' : 's'} ago`;
        } else {
            return `${diffInDays} day${diffInDays === 1 ? '' : 's'} ago`;
        }
    }

    function showSuccessCheckmark(element) {
        const checkmark = document.createElement('span');
        checkmark.className = 'checkmark';
        checkmark.textContent = '✓';
        element.appendChild(checkmark);

        // Remove checkmark after animation
        setTimeout(() => {
            if (checkmark.parentNode) {
                checkmark.parentNode.removeChild(checkmark);
            }
        }, 2000);
    }

    function fadeInElement(element) {
        element.style.opacity = '0';
        element.style.transform = 'translateY(-10px)';

        requestAnimationFrame(() => {
            element.style.transition = 'all 0.3s ease-in-out';
            element.style.opacity = '1';
            element.style.transform = 'translateY(0)';
        });
    }

    // ===== STATS & STATUS UPDATES =====
    function updateStats(stats) {
        console.log('Updating stats:', stats);

        // Update stat values with animation
        updateStatValue('breaksTaken', stats.breaksTaken);
        updateStatValue('timeSaved', stats.timeSaved);
        updateStatValue('streakDays', stats.streakDays);

        // Update last break date if available
        if (stats.lastBreakDate) {
            const lastBreak = new Date(stats.lastBreakDate);
            const timeAgo = getTimeAgo(lastBreak);
            console.log('Last break:', timeAgo);
        }

        lastUpdateTime = Date.now();
    }

    function updateStatValue(elementId, newValue) {
        const element = document.getElementById(elementId);
        if (!element) return;

        const currentValue = parseInt(element.textContent) || 0;
        if (currentValue !== newValue) {
            element.classList.add('updated');
            element.textContent = newValue;

            setTimeout(() => {
                element.classList.remove('updated');
            }, 500);
        }
    }

    function updateStatus(data) {
        console.log('Updating status:', data);

        const statusIndicator = document.getElementById('statusIndicator');
        const timerSection = document.getElementById('timerSection');
        const timerDisplay = document.getElementById('timerDisplay');
        const screenTimeSection = document.getElementById('screenTimeSection');
        const goalsSection = document.getElementById('goalsSection');
        const achievementsSection = document.getElementById('achievementsSection');

        if (data.isEnabled) {
            statusIndicator.classList.remove('disabled');
            timerSection.style.display = 'block';
        } else {
            statusIndicator.classList.add('disabled');
            timerSection.style.display = 'none';
            timerDisplay.textContent = 'DISABLED';
        }

        // Show/hide sections based on configuration
        if (data.enableEyeExercises) {
            screenTimeSection.style.display = 'block';
        } else {
            screenTimeSection.style.display = 'none';
        }

        if (data.enableGoals) {
            goalsSection.style.display = 'block';
        } else {
            goalsSection.style.display = 'none';
        }

        if (data.enableAchievements) {
            achievementsSection.style.display = 'block';
        } else {
            achievementsSection.style.display = 'none';
        }

        // Always show work-rest section for now (can be made configurable later)
        const workRestSection = document.getElementById('workRestSection');
        if (workRestSection) {
            workRestSection.style.display = 'block';
        }
    }

    // ===== SCREEN TIME & ACTIVITY =====
    function updateScreenTime(data) {
        const totalScreenTimeElement = document.getElementById('totalScreenTime');
        const continuousScreenTimeElement = document.getElementById('continuousScreenTime');
        const activityStatusElement = document.getElementById('activityStatus');

        if (totalScreenTimeElement && data.totalScreenTime !== undefined) {
            totalScreenTimeElement.textContent = data.totalScreenTime.toString();
        }

        if (continuousScreenTimeElement && data.continuousScreenTime !== undefined) {
            continuousScreenTimeElement.textContent = data.continuousScreenTime.toString();
        }

        if (activityStatusElement && data.isIdle !== undefined) {
            activityStatusElement.textContent = data.isIdle ? 'Idle' : 'Active';
            activityStatusElement.style.color = data.isIdle ?
                'var(--vscode-charts-red, #f44747)' :
                'var(--vscode-charts-green, #89d185)';
        }
    }

    function updateActivityStatus(data) {
        const activityTextElement = document.getElementById('activityText');
        const sessionTimeElement = document.getElementById('sessionTime');
        const activityDotElement = document.querySelector('.activity-dot');

        if (activityTextElement && data.activityText) {
            activityTextElement.textContent = data.activityText;
        }

        if (sessionTimeElement && data.sessionTime) {
            sessionTimeElement.textContent = data.sessionTime;
        }

        if (activityDotElement && data.isIdle !== undefined) {
            activityDotElement.style.background = data.isIdle ?
                'var(--vscode-charts-red, #f44747)' :
                'var(--vscode-charts-green, #89d185)';
        }
    }

    // ===== WELLNESS FEATURES =====
    function updateWellnessGoals(goals) {
        const goalsSection = document.getElementById('goalsSection');
        const goalsList = document.getElementById('goalsList');

        if (!goalsSection || !goalsList) return;

        // Show goals section if there are goals and goals are enabled
        if (goals && goals.length > 0) {
            goalsSection.style.display = 'block';
            goalsList.innerHTML = '';

            goals.forEach(goal => {
                const goalItem = document.createElement('div');
                goalItem.className = 'goal-item';
                goalItem.dataset.goalId = goal.id; // Add data attribute for identification

                const goalText = document.createElement('span');
                goalText.className = 'goal-text';
                goalText.textContent = goal.description;

                const goalProgress = document.createElement('span');
                goalProgress.className = 'goal-progress';

                // Show target/target for completed goals, current/target for others
                if (goal.completed) {
                    goalProgress.textContent = `${goal.target}/${goal.target}`;
                    goalProgress.style.color = 'var(--vscode-charts-green, #89d185)';
                    // Add success checkmark for newly completed goals
                    setTimeout(() => showSuccessCheckmark(goalItem), 500);

                    // Schedule fade-out animation after 3 seconds
                    setTimeout(() => {
                        goalItem.classList.add('fade-out');
                        // Remove from DOM after animation completes
                        setTimeout(() => {
                            if (goalItem.parentNode) {
                                goalItem.parentNode.removeChild(goalItem);
                                // Hide goals section if no goals remain
                                const remainingGoals = goalsList.querySelectorAll('.goal-item:not(.fade-out)');
                                if (remainingGoals.length === 0) {
                                    goalsSection.style.display = 'none';
                                }
                            }
                        }, 500); // Match animation duration
                    }, 3000);
                } else {
                    goalProgress.textContent = `${goal.current}/${goal.target}`;
                    if (goal.current > 0) {
                        goalProgress.style.color = 'var(--vscode-charts-orange, #d18616)';
                    } else {
                        goalProgress.style.color = 'var(--vscode-descriptionForeground, #cccccc99)';
                    }
                }

                goalItem.appendChild(goalText);
                goalItem.appendChild(goalProgress);
                goalsList.appendChild(goalItem);

                // Add fade-in animation for new goals
                fadeInElement(goalItem);
            });
        } else {
            goalsSection.style.display = 'none';
        }
    }

    function updateWellnessChallenges(challenges) {
        const challengesSection = document.getElementById('challengesSection');
        const challengesList = document.getElementById('challengesList');

        if (!challengesSection || !challengesList) return;

        // Show challenges section if there are challenges
        if (challenges && challenges.length > 0) {
            challengesSection.style.display = 'block';
            challengesList.innerHTML = '';

            challenges.forEach(challenge => {
                const challengeItem = document.createElement('div');
                challengeItem.className = 'challenge-item';

                const challengeName = document.createElement('div');
                challengeName.className = 'challenge-name';
                challengeName.textContent = challenge.name;

                const challengeDescription = document.createElement('div');
                challengeDescription.className = 'challenge-description';
                challengeDescription.textContent = challenge.description;

                const challengeProgress = document.createElement('div');
                challengeProgress.className = 'challenge-progress';

                const progressBar = document.createElement('div');
                progressBar.className = 'challenge-progress-bar';

                const progressFill = document.createElement('div');
                progressFill.className = 'challenge-progress-fill';
                progressFill.style.width = `${challenge.progress}%`;

                const progressText = document.createElement('span');
                progressText.className = 'challenge-progress-text';
                progressText.textContent = `${challenge.progress}%`;

                progressBar.appendChild(progressFill);
                challengeProgress.appendChild(progressBar);
                challengeProgress.appendChild(progressText);

                challengeItem.appendChild(challengeName);
                challengeItem.appendChild(challengeDescription);
                challengeItem.appendChild(challengeProgress);
                challengesList.appendChild(challengeItem);
            });
        } else {
            challengesSection.style.display = 'none';
        }
    }

    // ===== ACHIEVEMENTS =====
    // Stub functions for achievements (now opened in a full webview)
    function updateAchievements(data) {
        // Achievements are now handled in a separate webview
        console.log('Achievements update received:', data);
    }

    function switchAchievementTab(tabId) {
        // Achievement tabs are now handled in a separate webview
        console.log('Switch achievement tab:', tabId);
    }

    function updateAchievementStats(stats) {
        const achievementStatsSection = document.getElementById('achievementStatsSection');
        const totalAchievements = document.getElementById('totalAchievements');
        const completionRate = document.getElementById('completionRate');
        const mostUnlockedCategory = document.getElementById('mostUnlockedCategory');
        const averageRarity = document.getElementById('averageRarity');

        if (achievementStatsSection && stats) {
            achievementStatsSection.style.display = 'block';

            if (totalAchievements) {
                totalAchievements.textContent = `${stats.unlockedAchievements}/${stats.totalAchievements}`;
            }

            if (completionRate) {
                completionRate.textContent = `${stats.completionPercentage}%`;
            }

            if (mostUnlockedCategory && stats.mostUnlockedCategory) {
                mostUnlockedCategory.textContent = stats.mostUnlockedCategory.category.charAt(0).toUpperCase() +
                    stats.mostUnlockedCategory.category.slice(1);
            }

            if (averageRarity) {
                averageRarity.textContent = stats.averageRarity.charAt(0).toUpperCase() +
                    stats.averageRarity.slice(1);
            }
        }
    }

    // ===== WELLNESS INSIGHTS =====
    function updateWellnessInsightsDisplay(insights) {
        if (!insights) return;

        // Update insight cards
        const totalGoalsCompleted = document.getElementById('totalGoalsCompleted');
        const averageBreaksPerDay = document.getElementById('averageBreaksPerDay');
        const averageScreenTime = document.getElementById('averageScreenTime');
        const goalCompletionRate = document.getElementById('goalCompletionRate');

        if (totalGoalsCompleted) {
            totalGoalsCompleted.textContent = insights.totalGoalsCompleted || 0;
        }
        if (averageBreaksPerDay) {
            averageBreaksPerDay.textContent = insights.averageBreaksPerDay || 0;
        }
        if (averageScreenTime) {
            averageScreenTime.textContent = `${insights.averageScreenTime || 0}m`;
        }
        if (goalCompletionRate) {
            goalCompletionRate.textContent = `${insights.goalCompletionRate || 0}%`;
        }

        // Update recommendations
        const recommendationsList = document.getElementById('recommendationsList');
        if (recommendationsList && insights.recommendations) {
            recommendationsList.innerHTML = '';
            insights.recommendations.forEach(rec => {
                const recItem = document.createElement('div');
                recItem.className = 'recommendation-item';
                recItem.textContent = rec;
                recommendationsList.appendChild(recItem);
            });
        }
    }

    // ===== MOTIVATION =====
    function updateMotivationQuote() {
        const quotes = [
            "Your health is more important than your code",
            "Breaks make you more productive",
            "Take care of your body, it's the only one you have",
            "A rested mind is a creative mind",
            "Your future self will thank you for this break",
            "Breathing is free, but its value is priceless",
            "Small breaks, big impact on your well-being"
        ];

        const quoteElement = document.getElementById('motivationQuote');
        if (quoteElement) {
            const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
            quoteElement.textContent = randomQuote;
        }
    }

    // ===== CUSTOM FEATURES =====
    function updateCustomGoalsDisplay(goals) {
        const customGoalsList = document.getElementById('customGoalsList');
        if (!customGoalsList) return;

        customGoalsList.innerHTML = '';

        if (goals && goals.length > 0) {
            goals.forEach(goal => {
                const goalItem = document.createElement('div');
                goalItem.className = `custom-goal-item ${goal.completed ? 'completed' : ''}`;

                goalItem.innerHTML = `
                    <div class="custom-goal-header">
                        <div class="custom-goal-title">${goal.description}</div>
                        <div class="custom-goal-type">${goal.type}</div>
                    </div>
                    <div class="custom-goal-progress">
                        <div class="custom-goal-progress-bar">
                            <div class="custom-goal-progress-fill" style="width: ${(goal.current / goal.target) * 100}%"></div>
                        </div>
                        <div class="custom-goal-progress-text">${goal.current}/${goal.target}</div>
                    </div>
                    <div class="custom-goal-actions">
                        <button class="action-btn secondary" onclick="updateCustomGoal('${goal.id}')">Update</button>
                        <button class="action-btn secondary" onclick="deleteCustomGoal('${goal.id}')">Delete</button>
                    </div>
                `;

                customGoalsList.appendChild(goalItem);
            });
        } else {
            customGoalsList.innerHTML = '<div style="text-align: center; color: var(--vscode-descriptionForeground, #cccccc99); padding: 20px;">No custom goals yet. Create your first goal!</div>';
        }
    }

    function updateChallengesDisplay(challenges) {
        const challengesList = document.getElementById('challengesList');
        if (!challengesList) return;

        challengesList.innerHTML = '';

        if (challenges && challenges.length > 0) {
            challenges.forEach(challenge => {
                const challengeItem = document.createElement('div');
                challengeItem.className = `challenge-item ${challenge.completed ? 'completed' : ''}`;

                const goalsHtml = challenge.goals.map(goal =>
                    `<div class="challenge-goal-item">
                        <span>${goal.description}</span>
                        <span class="goal-status">${goal.completed ? '✓' : '○'}</span>
                    </div>`
                ).join('');

                challengeItem.innerHTML = `
                    <div class="challenge-header">
                        <div class="challenge-name">${challenge.name}</div>
                        <div class="challenge-duration">${challenge.duration} days</div>
                    </div>
                    <div class="challenge-description">${challenge.description}</div>
                    <div class="challenge-goals">${goalsHtml}</div>
                    <div class="challenge-progress">
                        <div class="challenge-progress-bar">
                            <div class="challenge-progress-fill" style="width: ${challenge.progress}%"></div>
                        </div>
                        <div class="challenge-progress-text">${challenge.progress}% Complete</div>
                    </div>
                `;

                challengesList.appendChild(challengeItem);
            });
        } else {
            challengesList.innerHTML = '<div style="text-align: center; color: var(--vscode-descriptionForeground, #cccccc99); padding: 20px;">No active challenges. Start a new challenge!</div>';
        }
    }

    function updateCustomExercisesDisplay(exercises) {
        const customExercisesList = document.getElementById('customExercisesList');
        if (!customExercisesList) return;

        customExercisesList.innerHTML = '';

        if (exercises && exercises.length > 0) {
            exercises.forEach(exercise => {
                const exerciseItem = document.createElement('div');
                exerciseItem.className = `custom-exercise-item ${exercise.favorite ? 'favorite' : ''}`;

                exerciseItem.innerHTML = `
                    <div class="custom-exercise-header">
                        <div class="custom-exercise-name">${exercise.name}</div>
                        <div class="custom-exercise-category">${exercise.category}</div>
                        <div class="custom-exercise-difficulty">${exercise.difficulty}</div>
                    </div>
                    <div class="custom-exercise-description">${exercise.instructions}</div>
                    <div class="custom-exercise-duration">Duration: ${exercise.duration}</div>
                    <div class="custom-exercise-actions">
                        <button class="action-btn secondary" onclick="toggleExerciseFavorite('${exercise.id}')">
                            ${exercise.favorite ? '★' : '☆'}
                        </button>
                        <button class="action-btn secondary" onclick="performCustomExercise('${exercise.id}')">Do Exercise</button>
                    </div>
                `;

                customExercisesList.appendChild(exerciseItem);
            });
        } else {
            customExercisesList.innerHTML = '<div style="text-align: center; color: var(--vscode-descriptionForeground, #cccccc99); padding: 20px;">No custom exercises yet. Create your first exercise!</div>';
        }
    }

    // ===== ACTION FUNCTIONS =====
    function openSettings() {
        vscode.postMessage({ command: 'openSettings' });
    }

    function showStretch() {
        vscode.postMessage({ command: 'showStretch' });
    }

    function breathingExercise() {
        vscode.postMessage({ command: 'breathingExercise' });
    }

    function showEyeExercise() {
        vscode.postMessage({ command: 'showEyeExercise' });
    }

    function showWaterReminder() {
        vscode.postMessage({ command: 'showWaterReminder' });
    }

    function showAnalytics() {
        vscode.postMessage({ command: 'showAnalytics' });
    }

    function takeBreak() {
        vscode.postMessage({ command: 'takeBreak' });
    }

    function changeWorkRestModel() {
        vscode.postMessage({ command: 'changeWorkRestModel' });
    }

    function openChangeWorkoutPanel() {
        vscode.postMessage({ command: 'openChangeWorkoutPanel' });
    }

    function openTimeBlocking() {
        vscode.postMessage({ command: 'openTimeBlocking' });
    }

    // ===== INITIALIZE EVENT LISTENERS =====
    // Ensure buttons work even if defined later
    document.addEventListener('DOMContentLoaded', function() {
        // Add click listeners to ensure functions are available using data-action attributes
        const buttons = document.querySelectorAll('button[data-action]');
        buttons.forEach(button => {
            const action = button.getAttribute('data-action');
            if (action && window[action]) {
                button.addEventListener('click', window[action]);
            }
        });

        // Also handle any remaining onclick attributes as fallback
        const timeBlockingBtn = document.querySelector('button[onclick*="openTimeBlocking"]');
        if (timeBlockingBtn) {
            timeBlockingBtn.addEventListener('click', openTimeBlocking);
        }
    });

    // ===== EXPOSE FUNCTIONS =====
    window.updateStats = updateStats;
    window.updateStatValue = updateStatValue;
    window.updateStatus = updateStatus;
    window.updateScreenTime = updateScreenTime;
    window.updateActivityStatus = updateActivityStatus;
    window.updateWellnessGoals = updateWellnessGoals;
    window.updateWellnessChallenges = updateWellnessChallenges;
    window.updateAchievements = updateAchievements;
    window.switchAchievementTab = switchAchievementTab;
    window.updateAchievementStats = updateAchievementStats;
    window.updateWellnessInsightsDisplay = updateWellnessInsightsDisplay;
    window.updateMotivationQuote = updateMotivationQuote;
    window.updateCustomGoalsDisplay = updateCustomGoalsDisplay;
    window.updateChallengesDisplay = updateChallengesDisplay;
    window.updateCustomExercisesDisplay = updateCustomExercisesDisplay;

    // Expose action functions
    window.openSettings = openSettings;
    window.showStretch = showStretch;
    window.breathingExercise = breathingExercise;
    window.showEyeExercise = showEyeExercise;
    window.showWaterReminder = showWaterReminder;
    window.showAnalytics = showAnalytics;
    window.takeBreak = takeBreak;
    window.changeWorkRestModel = changeWorkRestModel;
    window.openChangeWorkoutPanel = openChangeWorkoutPanel;
    window.openTimeBlocking = openTimeBlocking;

})();
