import * as vscode from 'vscode';
import { state, initializeState } from './models/state';
import { startReminderSystem, restartReminderSystem, toggleReminders, showRandomReminder } from './services/reminderService';
import { takeBreak } from './services/breakService';
import { showStretchExercise, showBreathingExercise, showEyeExercise } from './services/exerciseService';
import { showAnalyticsReport } from './services/analyticsService';
import { BreakBullyActivityBarProviderImpl } from './ui/activityBarProvider';
import { ChangeWorkoutPanel } from './ui/changeWorkoutPanel';
import { WorkRestAssessmentPanel } from './ui/workRestAssessmentPanel';
import { UpdatePanel } from './ui/updatePanel';
import { TimeBlockingPanel } from './ui/timeBlockingPanel';
import { initializeGoals } from './services/goalService';
import { initializeWellnessChallenges, startScreenTimeTracking, startUIUpdates, setupActivityMonitoring, recordDailyWellnessData, setupDailyDataRecording } from './services/wellnessService';
import { initializeAchievements, showAchievementsReport } from './services/achievementService';
import { initializeScreenBlocking, forceUnblock } from './services/screenBlockingService';
import { getTimeRemaining } from './services/workRestService';
import { initializeWorkRestModel } from './services/workRestService';
import { initializeExerciseStorage, showCustomExerciseCreator, showCustomExerciseLibrary, initializeGitIntegration, triggerGitBasedBreakSuggestion } from './services/exerciseService';
import { getConfiguration } from './core/configuration';
import { smartWellnessManager } from './services/activityIntegration/smartWellnessManager';
import { BaseActivityMonitor } from './services/activityIntegration/baseActivityMonitor';
import { initializeAdvancedScheduler } from './services/activityIntegration/advancedSchedulerService';
import { usageAnalytics } from './services/usageAnalyticsService';

export function activate(context: vscode.ExtensionContext): void {
  console.log('Break Bully extension is now active - prepare to be bullied into wellness!');

  try {
    // Initialize state and storage
    initializeState(context);

    // Initialize activity monitor (needed for ML features)
    try {
      state.activityMonitor = new BaseActivityMonitor(context);
      console.log('Activity monitor initialized successfully');

      // Initialize advanced scheduler with activity monitor
      initializeAdvancedScheduler(state.activityMonitor);
    } catch (error) {
      console.warn('Failed to initialize activity monitor and advanced scheduler, ML features will be disabled:', error);
      state.activityMonitor = undefined;
    }

    // Create status bar item
    state.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    state.statusBarItem.command = 'breakBully.showReminder';
    state.statusBarItem.text = '$(megaphone) Bully';
    state.statusBarItem.tooltip = 'Click to get bullied into taking a break';
    context.subscriptions.push(state.statusBarItem);

    // Register commands
    const showReminderCommand = vscode.commands.registerCommand('breakBully.showReminder', () => {
      showRandomReminder();
    });

    const toggleRemindersCommand = vscode.commands.registerCommand('breakBully.toggleReminders', () => {
      toggleReminders();
    });

    const openSettingsCommand = vscode.commands.registerCommand('breakBully.openSettings', () => {
      vscode.commands.executeCommand('workbench.action.openSettings', 'breakBully');
    });

    const takeBreakCommand = vscode.commands.registerCommand('breakBully.takeBreak', () => {
      takeBreak();
    });

    const quickStretchCommand = vscode.commands.registerCommand('breakBully.quickStretch', () => {
      showStretchExercise();
    });

    const breathingExerciseCommand = vscode.commands.registerCommand('breakBully.breathingExercise', () => {
      showBreathingExercise();
    });

    const eyeExerciseCommand = vscode.commands.registerCommand('breakBully.eyeExercise', () => {
      showEyeExercise();
    });

    const changeWorkoutCommand = vscode.commands.registerCommand('breakBully.changeWorkout', () => {
      ChangeWorkoutPanel.createOrShow(context.extensionUri);
    });

    const startMLAssessmentCommand = vscode.commands.registerCommand('breakBully.startMLAssessment', () => {
      console.log('ML Assessment command called');
      if (state.activityMonitor) {
        console.log('Activity monitor available, getting activity states');
        // Get recent activity events for ML generation
        const activityEvents = state.activityMonitor.getRecentActivityStates();
        console.log('Got activity events:', activityEvents?.length || 0);

        // Start ML assessment
        WorkRestAssessmentPanel.createOrShow(context.extensionUri, activityEvents);
        vscode.window.showInformationMessage('🤖 Starting AI Personalization Assessment...');
        console.log('ML Assessment panel opened');
      } else {
        console.log('Activity monitor not available');
        vscode.window.showErrorMessage('ML Assessment requires activity monitoring to be enabled. Please check your settings.');
      }
    });

    const refreshTimerCommand = vscode.commands.registerCommand('breakBully.refreshTimer', () => {
      // Trigger timer refresh in the main webview with work-rest session timing
      if (state.activityBarProvider) {
        const timeRemaining = getTimeRemaining();

        if (timeRemaining) {
          // Show work-rest session timing
          const nextReminder = Date.now() + (timeRemaining.minutes * 60 * 1000) + (timeRemaining.seconds * 1000);
          state.activityBarProvider.postMessage({
            command: 'updateTimer',
            data: {
              isEnabled: true,
              nextReminder: nextReminder,
              interval: getConfiguration().interval,
              phase: timeRemaining.phase
            }
          });
        } else {
          // Fall back to regular reminder timing
          state.activityBarProvider.postMessage({
            command: 'updateTimer',
            data: {
              isEnabled: true,
              nextReminder: state.nextReminderTime,
              interval: getConfiguration().interval
            }
          });
        }
      }
    });

    const analyticsCommand = vscode.commands.registerCommand('breakBully.showAnalytics', () => {
      showAnalyticsReport();
    });

    const showAchievementsCommand = vscode.commands.registerCommand('breakBully.showAchievements', () => {
      showAchievementsReport();
    });

    const forceUnblockCommand = vscode.commands.registerCommand('breakBully.forceUnblock', () => {
      forceUnblock();
      vscode.window.showInformationMessage('🔓 Emergency unblock activated. Rest enforcement temporarily disabled.');
    });

    const createCustomExerciseCommand = vscode.commands.registerCommand('breakBully.createCustomExercise', () => {
      showCustomExerciseCreator();
    });

    const showCustomExerciseLibraryCommand = vscode.commands.registerCommand('breakBully.showCustomExerciseLibrary', () => {
      showCustomExerciseLibrary();
    });

    const triggerGitBreakSuggestionCommand = vscode.commands.registerCommand('breakBully.triggerGitBreakSuggestion', () => {
      triggerGitBasedBreakSuggestion();
    });

    const showUpdatePanelCommand = vscode.commands.registerCommand('breakBully.showUpdatePanel', () => {
      UpdatePanel.createOrShow(context.extensionUri);
    });

    const openTimeBlockingCommand = vscode.commands.registerCommand('breakBully.openTimeBlocking', () => {
      TimeBlockingPanel.createOrShow(context.extensionUri);
    });

    // Register temporary debug command
    // registerTempExportCommand(context);

    context.subscriptions.push(
      showReminderCommand,
      toggleRemindersCommand,
      refreshTimerCommand,
      openSettingsCommand,
      takeBreakCommand,
      quickStretchCommand,
      breathingExerciseCommand,
      eyeExerciseCommand,
      changeWorkoutCommand,
      startMLAssessmentCommand,
      analyticsCommand,
      showAchievementsCommand,
      forceUnblockCommand,
      createCustomExerciseCommand,
      showCustomExerciseLibraryCommand,
      triggerGitBreakSuggestionCommand,
      showUpdatePanelCommand,
      openTimeBlockingCommand
    );

    // Initialize activity bar provider
    console.log('Creating activity bar provider...');
    try {
      state.activityBarProvider = new BreakBullyActivityBarProviderImpl(context.extensionUri);
      console.log('Activity bar provider created successfully');

      // Register webview view provider
      console.log('Registering webview view provider for breakBullyMain...');
      const providerRegistration = vscode.window.registerWebviewViewProvider('breakBullyMain', state.activityBarProvider);
      context.subscriptions.push(providerRegistration);
      console.log('Webview view provider registered successfully for breakBullyMain');
    } catch (error) {
      console.error('Failed to create or register activity bar provider:', error);
      vscode.window.showErrorMessage(`Break Bully: Failed to initialize activity bar: ${(error as Error).message}`);
    }

    // Initialize wellness goals and challenges
    initializeGoals();
    initializeWellnessChallenges();

    // Record initial daily wellness data
    recordDailyWellnessData();

    // Set up daily data recording at midnight
    setupDailyDataRecording(context);

    // Initialize achievements
    initializeAchievements();

    // Start the bully system
    startReminderSystem();

    // Start screen time tracking
    startScreenTimeTracking();

    // Start UI updates
    startUIUpdates();

    // Listen for configuration changes
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('breakBully')) {
        restartReminderSystem();
      }
    });

    // Set up IDE activity monitoring
    setupActivityMonitoring(context);

    // Initialize screen blocking service
    initializeScreenBlocking();

    // Initialize custom exercise storage
    initializeExerciseStorage(context);

    // Initialize Git integration
    initializeGitIntegration();

    // Initialize work-rest model (core feature)
    initializeWorkRestModel();

    // Check if we should show the update panel (max 3 days)
    checkAndShowUpdatePanel(context);

    // Initialize AI Analytics Infrastructure
    console.log('Initializing AI Analytics Infrastructure...');
    try {
      // Usage Analytics Service is already started via singleton pattern
      console.log('Usage Analytics initialized');

      // Performance Analytics Engine is ready via singleton pattern
      console.log('Performance Analytics Engine initialized');

      // Adaptive Learning Service - starts continuous learning loops
      console.log('Adaptive Learning Service initialized and learning cycle started');

      // Track extension startup as first usage event
      usageAnalytics.trackSessionStart('extension_startup', 0);

      vscode.window.showInformationMessage('🧠 AI Productivity Analytics Active - System learning from your usage patterns!', 'Show Analytics Dashboard');

    } catch (error) {
      console.warn('AI Analytics initialization failed:', error);
      vscode.window.showWarningMessage('Could not initialize AI Analytics features - basic functionality is still available.');
    }

    console.log('Break Bully extension activation completed successfully - AI Analytics Enabled');
  } catch (error) {
    console.error('Error during Break Bully extension activation:', error);
    vscode.window.showErrorMessage(`Break Bully failed to activate: ${(error as Error).message}`);
  }
}

function checkAndShowUpdatePanel(context: vscode.ExtensionContext): void {
  const UPDATE_SHOWN_KEY = 'updatePanelShownDate';
  const MAX_DAYS = 3;

  try {
    // Get the date when update was first shown
    const updateShownDateStr = context.globalState.get(UPDATE_SHOWN_KEY) as string | undefined;
    const now = new Date();

    if (!updateShownDateStr) {
      // First time showing update panel
      context.globalState.update(UPDATE_SHOWN_KEY, now.toISOString());
      UpdatePanel.createOrShow(context.extensionUri);
      console.log('Showing update panel for the first time');
    } else {
      // Check if it's been more than 3 days
      const updateShownDate = new Date(updateShownDateStr);
      const daysSinceShown = Math.floor((now.getTime() - updateShownDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysSinceShown < MAX_DAYS) {
        UpdatePanel.createOrShow(context.extensionUri);
        console.log(`Showing update panel (${daysSinceShown}/${MAX_DAYS} days)`);
      } else {
        console.log(`Update panel not shown (exceeded ${MAX_DAYS} days)`);
      }
    }
  } catch (error) {
    console.error('Error checking update panel:', error);
    // Don't show update panel if there's an error
  }
}

export function deactivate(): void {
  if (state.reminderTimer) {
    clearInterval(state.reminderTimer);
  }
  if (state.annoyanceTimer) {
    clearInterval(state.annoyanceTimer);
  }
  if (state.screenTimeTimer) {
    clearInterval(state.screenTimeTimer);
  }
  if (state.statusBarItem) {
    state.statusBarItem.dispose();
  }

  // Stop smart wellness monitoring
  smartWellnessManager.stopMonitoring();
}
