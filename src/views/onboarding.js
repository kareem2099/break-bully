// ===== ONBOARDING EXPERIENCE =====

(function() {
    'use strict';

    // ===== ONBOARDING STATE =====
    let currentOnboardingStep = 1;
    let onboardingCompleted = false;

    // ===== ONBOARDING WORK-REST MODEL SELECTION =====
    function initializeOnboardingWorkRest() {
        const select = document.getElementById('onboardingWorkRestSelect');
        if (!select) return;

        // Populate with available models
        select.innerHTML = '<option value="">Select your preferred model...</option>';

        // Request models from extension
        vscode.postMessage({
            command: 'getWorkRestModels'
        });
    }

    function populateOnboardingModels(models) {
        const select = document.getElementById('onboardingWorkRestSelect');
        if (!select) return;

        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = model.name;
            select.appendChild(option);
        });

        // Add change listener
        select.addEventListener('change', function() {
            const selectedModelId = select.value;
            const btn = document.getElementById('modelSelectBtn');

            if (selectedModelId) {
                btn.disabled = false;
                btn.textContent = 'Continue with Selected Model';

                // Show model details
                vscode.postMessage({
                    command: 'getWorkRestModelDetails',
                    data: { modelId: selectedModelId }
                });
            } else {
                btn.disabled = true;
                btn.textContent = 'Continue with Selected Model';
            }
        });
    }

    function selectWorkRestModel() {
        const select = document.getElementById('onboardingWorkRestSelect');
        const modelId = select.value;

        if (!modelId) {
            vscode.window.showErrorMessage('Please select a work-rest model first.');
            return;
        }

        // Save the selected model and continue onboarding
        vscode.postMessage({
            command: 'setOnboardingWorkRestModel',
            data: { modelId }
        });

        // Continue to next step
        nextOnboardingStep();
    }

    // ===== ONBOARDING NAVIGATION =====
    function checkOnboardingStatus() {
        const onboardingState = vscode.getState()?.onboardingCompleted;
        if (!onboardingState) {
            showOnboarding();
        }
    }

    function showOnboarding() {
        // Use onboardingCompleted to check if onboarding was already finished
        if (onboardingCompleted) {
            console.log('Onboarding already completed, skipping show');
            return;
        }

        const onboardingOverlay = document.getElementById('onboardingOverlay');
        if (onboardingOverlay) {
            onboardingOverlay.classList.remove('hidden');
            currentOnboardingStep = 1;
            updateOnboardingStep();

            // Initialize work-rest model selection for onboarding
            initializeOnboardingWorkRest();
        }
    }

    function nextOnboardingStep() {
        const totalSteps = 5;
        if (currentOnboardingStep < totalSteps) {
            // Add leaving animation to current step
            const currentStepElement = document.querySelector(`.onboarding-step[data-step="${currentOnboardingStep}"]`);
            if (currentStepElement) {
                currentStepElement.classList.add('leaving');
            }

            setTimeout(() => {
                currentOnboardingStep++;
                updateOnboardingStep();
            }, 300);
        }
    }

    function updateOnboardingStep() {
        // Hide all steps
        const allSteps = document.querySelectorAll('.onboarding-step');
        allSteps.forEach(step => {
            step.classList.remove('active', 'leaving', 'entering');
        });

        // Show current step
        const currentStepElement = document.querySelector(`.onboarding-step[data-step="${currentOnboardingStep}"]`);
        if (currentStepElement) {
            currentStepElement.classList.add('active', 'entering');
        }

        // Update progress dots
        const dots = document.querySelectorAll('.dot');
        dots.forEach((dot, index) => {
            if (index + 1 === currentOnboardingStep) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });
    }

    function completeOnboarding() {
        onboardingCompleted = true;

        // Save onboarding state
        const state = vscode.getState() || {};
        state.onboardingCompleted = true;
        vscode.setState(state);

        // Hide onboarding
        const onboardingOverlay = document.getElementById('onboardingOverlay');
        if (onboardingOverlay) {
            onboardingOverlay.style.display = 'none';
        }

        // Show welcome celebration
        setTimeout(() => {
            showGoalCelebration('Welcome to Break Bully! 🎉\nLet\'s start building healthy coding habits together.');
            createConfetti();
        }, 500);

        // Send completion message to extension
        vscode.postMessage({
            command: 'onboardingCompleted'
        });
    }

    function skipOnboarding() {
        completeOnboarding();
    }

    // ===== EXPOSE FUNCTIONS =====
    window.initializeOnboardingWorkRest = initializeOnboardingWorkRest;
    window.populateOnboardingModels = populateOnboardingModels;
    window.selectWorkRestModel = selectWorkRestModel;
    window.checkOnboardingStatus = checkOnboardingStatus;
    window.showOnboarding = showOnboarding;
    window.nextOnboardingStep = nextOnboardingStep;
    window.updateOnboardingStep = updateOnboardingStep;
    window.completeOnboarding = completeOnboarding;
    window.skipOnboarding = skipOnboarding;

})();
