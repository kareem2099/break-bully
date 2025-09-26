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
        }
    }

    // ===== MODEL POPULATION =====
    function populateModels(models) {
        const modelsGrid = document.getElementById('modelsGrid');
        if (!modelsGrid) return;

        modelsGrid.innerHTML = '';

        models.forEach(model => {
            const modelCard = createModelCard(model);
            modelsGrid.appendChild(modelCard);
        });

        // Show current model info
        showCurrentModelInfo();
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
                        <h3>Model Changed Successfully!</h3>
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

    function showCurrentModelInfo() {
        // For now, just hide the current model section since we can't access VSCode config from webview
        const currentModelDiv = document.getElementById('currentModel');
        if (currentModelDiv) {
            currentModelDiv.style.display = 'none';
        }
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
