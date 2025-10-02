// ===== CHANGE WORKOUT WEBVIEW =====

(function() {
    'use strict';

    const vscode = acquireVsCodeApi();

    // ===== INITIALIZATION =====
    function initialize() {
        console.log('Change Workout webview initialized');

        // Set up message listener
        window.addEventListener('message', handleMessage);

        // Request models
        vscode.postMessage({
            command: 'getWorkRestModels'
        });
    }

    // ===== MESSAGE HANDLING =====
    function handleMessage(event) {
        const message = event.data;
        console.log('Received message from extension:', message.command, message.data);

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
        }
    }

    // ===== MODEL POPULATION =====
    function populateModels(models) {
        const modelsGrid = document.getElementById('modelsGrid');
        if (!modelsGrid) return;

        modelsGrid.innerHTML = '';

        // Add ML Assessment card first
        const mlCard = createMLAssessmentCard();
        modelsGrid.appendChild(mlCard);

        // Check for personal models
        checkAndAddPersonalModels();

        models.forEach(model => {
            const modelCard = createModelCard(model);
            modelsGrid.appendChild(modelCard);
        });

        // Show current model info
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

        if (data.success) {
            // Show success state
            if (modelsGrid) {
                modelsGrid.innerHTML = `
                    <div class="success-message">
                        <div class="success-icon">✅</div>
                        <h3>Standard Model Changed Successfully!</h3>
                        <p>Your work-rest timing has been updated.</p>
                        <button class="btn primary" onclick="closePanel()">Close</button>
                    </div>
                `;
            }
        } else {
            // Show error state
            if (modelsGrid) {
                modelsGrid.style.opacity = '1';
                modelsGrid.style.pointerEvents = 'auto';

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

        if (data.success) {
            // Show success state for personal model
            if (modelsGrid) {
                modelsGrid.innerHTML = `
                    <div class="success-message">
                        <div class="success-icon">🎯</div>
                        <h3>AI Personal Model Activated!</h3>
                        <p>Your personalized work-rest schedule is now active.</p>
                        <button class="btn primary" onclick="closePanel()">Close</button>
                    </div>
                `;
            }
        } else {
            // Show error state
            if (modelsGrid) {
                modelsGrid.style.opacity = '1';
                modelsGrid.style.pointerEvents = 'auto';

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

    function showCurrentModelInfo() {
        // For now, just hide the current model section since we can't access VSCode config from webview
        const currentModelDiv = document.getElementById('currentModel');
        if (currentModelDiv) {
            currentModelDiv.style.display = 'none';
        }
    }

    function checkAndAddPersonalModels() {
        // Request personal models from extension
        vscode.postMessage({
            command: 'getPersonalModels'
        });
    }

    function addPersonalModels(modelsData) {
        const modelsGrid = document.getElementById('modelsGrid');
        if (!modelsGrid || !modelsData) return;

        // Add a section header for personal models
        const personalSection = document.createElement('div');
        personalSection.className = 'personal-models-section';
        personalSection.innerHTML = `
            <div class="personal-models-header">
                <h3>🎯 AI Personal Models</h3>
                <div class="personal-models-meta">Generated from your assessment</div>
            </div>
        `;

        modelsGrid.appendChild(personalSection);

        // Add each personal model
        modelsData.models.forEach(model => {
            const modelCard = createPersonalModelCard(model);
            modelsGrid.appendChild(modelCard);
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
            modelsGrid.appendChild(insightsSection);
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

    // Expose closePanel globally for inline onclick handlers
    window.closePanel = closePanel;

    // ===== INITIALIZATION =====
    document.addEventListener('DOMContentLoaded', function() {
        initialize();
    });

})();
