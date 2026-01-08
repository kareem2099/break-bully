// ===== CHANGE WORKOUT WEBVIEW =====

(function() {
    'use strict';

    const vscode = acquireVsCodeApi();

    // ===== INITIALIZATION =====
    function initialize() {
        Logger.log('Change Workout webview initialized');

        // Set up message listener
        window.addEventListener('message', handleMessage);

        // Set up event delegation for buttons (to avoid CSP issues)
        setupEventDelegation();

        // Request current session first to show at top
        vscode.postMessage({
            command: 'getCurrentSession'
        });

        // Request models
        vscode.postMessage({
            command: 'getWorkRestModels'
        });
    }

    function setupEventDelegation() {
        // Handle all button clicks through event delegation
        document.addEventListener('click', function(event) {
            const target = event.target;

            // Handle back button
            if (target.id === 'backButton') {
                event.preventDefault();
                goBack();
                return;
            }

            // Handle close buttons in success/error messages
            if (target.closest('.success-message') && target.tagName === 'BUTTON') {
                event.preventDefault();
                closePanel();
                return;
            }
        });
    }

    // ===== MESSAGE HANDLING =====
    function handleMessage(event) {
        const message = event.data;
        Logger.log('Received message from extension:', message.command, message.data);

        switch (message.command) {
            case 'workRestModels':
                populateModels(message.data);
                break;
            case 'workRestModelChanged':
                handleModelChanged(message.data);
                break;
            case 'personalModelsData':
                addPersonalModels(message.data);
                break;
            case 'personalModelChanged':
                handlePersonalModelChanged(message.data);
                break;
            case 'currentPersonalModel':
                updateCurrentModelDetails(message.data);
                break;
            case 'currentSession':
                displayCurrentModelAtTop(message.data);
                break;
        }
    }

    // ===== MODEL POPULATION =====
    function populateModels(models) {
        const modelsGrid = document.getElementById('modelsGrid');
        if (!modelsGrid) return;

        modelsGrid.innerHTML = '';

        // Check for personal models first - if they exist, show only personal models
        vscode.postMessage({
            command: 'getPersonalModels'
        });

        // For now, we'll populate standard models and check for personal models async
        // The addPersonalModels function will handle the conditional display logic
        models.forEach(model => {
            const modelCard = createModelCard(model);
            modelsGrid.appendChild(modelCard);
        });

        // Show current model info when personal models are active
        showCurrentModelInfo();
    }

    function createMLAssessmentCard() {
        const card = document.createElement('div');
        card.className = 'model-card ml-assessment-card';
        card.onclick = () => startMLAssessment();

        card.innerHTML = `
            <div class="model-header">
                <h3>🤖 AI Personalization</h3>
                <div class="model-timing">Personal ML Models</div>
            </div>
            <div class="model-description">Answer 7 quick questions for AI-generated models tailored to your work style and patterns.</div>
            <div class="model-meta">⚡ Takes 2 minutes • Adapts over time</div>
        `;

        return card;
    }

    function createModelCard(model) {
        const card = document.createElement('div');
        card.className = 'model-card';
        card.onclick = () => selectModel(model);

        card.innerHTML = `
            <div class="model-header">
                <h3>${model.name}</h3>
                <div class="model-timing">${model.workDuration}min work • ${model.restDuration}min rest</div>
            </div>
            <div class="model-description">${model.description}</div>
            <div class="model-meta">Based on ${model.basedOn.toUpperCase()} guidelines</div>
        `;

        return card;
    }

    function selectModel(model) {
        // Show loading state
        const modelsGrid = document.getElementById('modelsGrid');
        if (modelsGrid) {
            modelsGrid.style.opacity = '0.6';
            modelsGrid.style.pointerEvents = 'none';
        }

        // Send change request
        vscode.postMessage({
            command: 'changeWorkRestModel',
            data: { modelId: model.id }
        });
    }

    function handleModelChanged(data) {
        const modelsGrid = document.getElementById('modelsGrid');

        // Reset loading state
        if (modelsGrid) {
            modelsGrid.style.opacity = '1';
            modelsGrid.style.pointerEvents = 'auto';
        }

        if (data.success) {
            // Refresh the current model display with the new model
            vscode.postMessage({
                command: 'getCurrentSession'
            });

            // Show success message at the top without replacing the entire grid
            if (modelsGrid) {
                const successDiv = document.createElement('div');
                successDiv.className = 'success-message';
                successDiv.innerHTML = `
                    <div class="success-icon">✅</div>
                    <h3>Standard Model Changed Successfully!</h3>
                    <p>Your work-rest timing has been updated.</p>
                    <button class="btn primary">Close</button>
                `;

                // Insert success message at the top, but after the updated current model section
                const currentModelSection = modelsGrid.querySelector('.current-model-section');
                const insertPosition = currentModelSection ? currentModelSection.nextSibling : modelsGrid.firstChild;

                modelsGrid.insertBefore(successDiv, insertPosition);
            }
        } else {
            // Show error state
            if (modelsGrid) {
                const errorDiv = document.createElement('div');
                errorDiv.className = 'error-message';
                errorDiv.innerHTML = `
                    <div class="error-icon">❌</div>
                    <p>Failed to change model. Please try again.</p>
                `;

                modelsGrid.insertBefore(errorDiv, modelsGrid.firstChild);

                // Remove error after 3 seconds
                setTimeout(() => {
                    if (errorDiv.parentNode) {
                        errorDiv.remove();
                    }
                }, 3000);
            }
        }
    }

    function handlePersonalModelChanged(data) {
        const modelsGrid = document.getElementById('modelsGrid');

        // Reset loading state
        if (modelsGrid) {
            modelsGrid.style.opacity = '1';
            modelsGrid.style.pointerEvents = 'auto';
        }

        if (data.success) {
            // Refresh the current model displays
            vscode.postMessage({
                command: 'getCurrentSession'
            });

            vscode.postMessage({
                command: 'getCurrentPersonalModel'
            });

            // Show success message at the top without replacing the entire grid
            if (modelsGrid) {
                const successDiv = document.createElement('div');
                successDiv.className = 'success-message';
                successDiv.innerHTML = `
                    <div class="success-icon">🎯</div>
                    <h3>AI Personal Model Activated!</h3>
                    <p>Your personalized work-rest schedule is now active.</p>
                    <button class="btn primary">Close</button>
                `;

                // Insert success message at the top, but after the updated current model sections
                const currentModelSection = modelsGrid.querySelector('.current-model-section') || modelsGrid.querySelector('.personal-models-section');
                const insertPosition = currentModelSection ? currentModelSection.nextSibling : modelsGrid.firstChild;

                modelsGrid.insertBefore(successDiv, insertPosition);
            }
        } else {
            // Show error state
            if (modelsGrid) {
                const errorDiv = document.createElement('div');
                errorDiv.className = 'error-message';
                errorDiv.innerHTML = `
                    <div class="error-icon">❌</div>
                    <p>Failed to activate personal model. Please try again.</p>
                `;

                modelsGrid.insertBefore(errorDiv, modelsGrid.firstChild);

                // Remove error after 3 seconds
                setTimeout(() => {
                    if (errorDiv.parentNode) {
                        errorDiv.remove();
                    }
                }, 3000);
            }
        }
    }

    function displayCurrentModelAtTop(sessionData) {
        const modelsGrid = document.getElementById('modelsGrid');
        if (!modelsGrid) return;

        // Remove any existing current model section to prevent duplicates
        const existingSection = modelsGrid.querySelector('.current-model-section');
        if (existingSection) {
            existingSection.remove();
        }

        if (sessionData && sessionData.model) {
            const model = sessionData.model;
            const modelTypeLabel = getModelTypeLabel(model);

            // Create current model display at the very top
            const currentModelSection = document.createElement('div');
            currentModelSection.className = 'current-model-section';
            currentModelSection.innerHTML = `
                <div class="current-model-header">
                    <h3>🎯 Your Current Model</h3>
                    <div class="current-model-badge">${modelTypeLabel}</div>
                </div>
                <div class="current-model-card">
                    <div class="model-header">
                        <h4>${model.name}</h4>
                        <div class="model-timing">${model.workDuration}min work • ${model.restDuration}min rest</div>
                    </div>
                    <div class="model-description">${model.description}</div>
                    <div class="model-meta">
                        ${getModelBasedOnLabel(model.basedOn)}
                        ${sessionData.currentCycle ? `• Cycle ${sessionData.currentCycle}${sessionData.totalCycles ? `/${sessionData.totalCycles}` : ''}` : ''}
                    </div>
                </div>
            `;

            // Insert at the very top of models grid
            modelsGrid.insertBefore(currentModelSection, modelsGrid.firstChild);
        }
    }

    function getModelTypeLabel(model) {
        // Check if it's an AI model by looking for AI-specific properties or ID patterns
        if (model.id && (model.id.includes('personal') || model.id.includes('ai'))) {
            return '🤖 AI Personal Model';
        }

        if (model.basedOn === 'pomodoro') {
            return '🍅 Pomodoro Technique';
        }

        if (model.basedOn === 'who') {
            return '🏥 WHO Guidelines';
        }

        if (model.basedOn === 'custom') {
            return '📋 Custom Model';
        }

        return '📊 Standard Model';
    }

    function getModelBasedOnLabel(basedOn) {
        const labelMap = {
            'pomodoro': 'Based on POMODORO guidelines',
            'who': 'Based on WHO guidelines',
            'custom': 'Custom configuration'
        };

        return labelMap[basedOn] || `Based on ${basedOn.toUpperCase()} guidelines`;
    }

    function showCurrentModelInfo() {
        // For now, just hide the current model section since we can't access VSCode config from webview
        const currentModelDiv = document.getElementById('currentModel');
        if (currentModelDiv) {
            currentModelDiv.style.display = 'none';
        }
    }

    function addPersonalModels(modelsData) {
        const modelsGrid = document.getElementById('modelsGrid');
        if (!modelsGrid) return;

        if (modelsData && modelsData.models && modelsData.models.length > 0) {
            // Personal models exist - add them at the top, keep static models below
            // Add section header for personal models
            const personalSection = document.createElement('div');
            personalSection.className = 'personal-models-section';
            personalSection.innerHTML = `
                <div class="personal-models-header">
                    <h3>🎯 AI Personal Models</h3>
                    <div class="personal-models-meta">Generated from your assessment • <strong>The best for you!</strong></div>
                </div>
            `;

            modelsGrid.insertBefore(personalSection, modelsGrid.firstChild);

            // Show current model status
            showCurrentPersonalModelStatus();

            // Add each personal model (insert after the current model status)
            const statusElement = modelsGrid.querySelector('.current-model-status');
            let insertAfter = statusElement || personalSection;

            modelsData.models.forEach(model => {
                const modelCard = createPersonalModelCard(model);
                insertAfter.insertAdjacentElement('afterend', modelCard);
                insertAfter = modelCard;
            });

            // Add section for analysis insights
            if (modelsData.insights && modelsData.insights.length > 0) {
                const insightsSection = document.createElement('div');
                insightsSection.className = 'insights-section';
                insightsSection.innerHTML = `
                    <div class="insights-header">
                        <h4>🧠 AI Insights</h4>
                    </div>
                    ${modelsData.insights.slice(0, 3).map(insight => `<div class="insight-item">• ${insight}</div>`).join('')}
                `;
                insertAfter.insertAdjacentElement('afterend', insightsSection);
            }
        } else {
            // No personal models - add ML assessment card
            const mlCard = createMLAssessmentCard();
            modelsGrid.insertBefore(mlCard, modelsGrid.firstChild);
        }
    }

    function createPersonalModelCard(model) {
        const card = document.createElement('div');
        card.className = 'model-card personal-model-card';
        card.onclick = () => selectPersonalModel(model);

        // Get model confidence display
        const confidencePercent = Math.round(model.confidence * 100);
        const confidenceIcon = confidencePercent >= 80 ? '🎯' : confidencePercent >= 60 ? '⭐' : '⚡';

        // Get scenario details
        const scenarioMap = {
            'standard': { icon: '📅', label: 'Standard Workday' },
            'deep-focus': { icon: '🎯', label: 'Deep Focus Session' },
            'creative': { icon: '🎨', label: 'Creative Tasks' },
            'morning': { icon: '🌅', label: 'Morning Boost' },
            'afternoon': { icon: '🌇', label: 'Afternoon Recovery' },
            'evening': { icon: '🌙', label: 'Evening Wind-down' }
        };

        const scenario = scenarioMap[model.scenario] || { icon: '📋', label: 'Custom Scenario' };

        card.innerHTML = `
            <div class="model-header">
                <h3>${model.name || scenario.label}</h3>
                <div class="model-timing">${model.workDuration}min work • ${model.restDuration}min rest</div>
            </div>
            <div class="model-description">${model.description || `Optimized for ${scenario.label.toLowerCase()}`}</div>
            <div class="model-meta">
                <span class="scenario-badge">${scenario.icon} ${scenario.label}</span>
                <span class="confidence-badge">${confidenceIcon} ${confidencePercent}% match</span>
            </div>
        `;

        return card;
    }

    function showCurrentPersonalModelStatus() {
        // Since we now show current model at the top, don't duplicate it in the personal models section
        // Just request the current personal model info to update any details if needed
        vscode.postMessage({
            command: 'getCurrentPersonalModel'
        });
    }

    function updateCurrentModelDetails(modelData) {
        const detailsElement = document.getElementById('currentModelDetails');
        if (!detailsElement) return;

        if (modelData) {
            const scenarioMap = {
                'standard': '📅 Standard Workday',
                'deep-focus': '🎯 Deep Focus Session',
                'creative': '🎨 Creative Tasks',
                'morning': '🌅 Morning Boost',
                'afternoon': '🌇 Afternoon Recovery',
                'evening': '🌙 Evening Wind-down'
            };
            const scenarioLabel = scenarioMap[modelData.scenario] || '📋 Custom Scenario';

            detailsElement.innerHTML = `${modelData.workDuration}min work • ${modelData.restDuration}min rest • ${scenarioLabel}`;
        } else {
            detailsElement.innerHTML = 'None selected';
        }
    }

    function selectPersonalModel(model) {
        // Show loading state
        const modelsGrid = document.getElementById('modelsGrid');
        if (modelsGrid) {
            modelsGrid.style.opacity = '0.6';
            modelsGrid.style.pointerEvents = 'none';
        }

        // Send change request with personal model flag
        vscode.postMessage({
            command: 'usePersonalModel',
            data: { model: model }
        });
    }

    function startMLAssessment() {
        // Send message to extension to open ML assessment
        vscode.postMessage({
            command: 'startMLAssessment'
        });
        // Close this panel after a brief delay to let the user see the assessment
        setTimeout(() => {
            closePanel();
        }, 2000); // Give user 2 seconds to see the toast notification
    }

    // ===== UTILITY FUNCTIONS =====
    function closePanel() {
        vscode.postMessage({
            command: 'closePanel'
        });
    }

    function goBack() {
        // Simply close the panel and return to previous page
        closePanel();
    }

    // Expose functions globally for inline onclick handlers
    window.closePanel = closePanel;
    window.goBack = goBack;

    // ===== INITIALIZATION =====
    document.addEventListener('DOMContentLoaded', function() {
        initialize();
    });

})();
