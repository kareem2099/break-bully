import * as vscode from 'vscode';
import { state, initializeState } from './models/state';
import { startReminderSystem, restartReminderSystem, toggleReminders, showRandomReminder } from './services/reminderService';
import { takeBreak } from './services/breakService';
import { showStretchExercise, showBreathingExercise, showEyeExercise } from './services/exerciseService';
import { showAnalyticsReport } from './services/analyticsService';
import { dotsenseActivityBarProviderImpl } from './ui/activityBarProvider';
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
import { initializeSmartWellnessManager, smartWellnessManager } from './services/activityIntegration/smartWellnessManager';
import { BaseActivityMonitor } from './services/activityIntegration/baseActivityMonitor';
import { initializeAdvancedScheduler } from './services/activityIntegration/advancedSchedulerService';
import { usageAnalytics } from './services/usageAnalyticsService';
import { MLWorkRestGenerator } from './services/mlWorkRestGenerator';
import { Logger } from './utils/logger';

export function activate(context: vscode.ExtensionContext): void {
  Logger.log('DotSense extension is now active - AI-powered wellness companion!');

  try {
    // Initialize state and storage
    initializeState(context);

    // Initialize activity monitor (needed for ML features)
    try {
      state.activityMonitor = new BaseActivityMonitor(context);
    Logger.log('Activity monitor initialized successfully');

      // Initialize advanced scheduler with activity monitor
      initializeAdvancedScheduler(state.activityMonitor);
    } catch (error) {
    Logger.warn('Failed to initialize activity monitor and advanced scheduler, ML features will be disabled:', error);
      state.activityMonitor = undefined;
    }

    // Create status bar item
    state.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    state.statusBarItem.command = 'dotsense.showReminder';
    state.statusBarItem.text = '$(megaphone) DotSense';
    state.statusBarItem.tooltip = 'Click to sense your mood and get break recommendations';
    context.subscriptions.push(state.statusBarItem);

    // Register commands
    const showReminderCommand = vscode.commands.registerCommand('dotsense.showReminder', () => {
      showRandomReminder();
    });

    const toggleRemindersCommand = vscode.commands.registerCommand('dotsense.toggleReminders', () => {
      toggleReminders();
    });

    const openSettingsCommand = vscode.commands.registerCommand('dotsense.openSettings', () => {
      // Show the custom settings modal instead of VS Code settings
      if (state.activityBarProvider) {
        state.activityBarProvider.postMessage({
          command: 'showSettingsModal'
        });
      }
    });

    const takeBreakCommand = vscode.commands.registerCommand('dotsense.takeBreak', () => {
      takeBreak();
    });

    const quickStretchCommand = vscode.commands.registerCommand('dotsense.quickStretch', () => {
      showStretchExercise(context.extensionUri);
    });

    const breathingExerciseCommand = vscode.commands.registerCommand('dotsense.breathingExercise', () => {
      showBreathingExercise();
    });

    const eyeExerciseCommand = vscode.commands.registerCommand('dotsense.eyeExercise', () => {
      showEyeExercise();
    });

    const changeWorkoutCommand = vscode.commands.registerCommand('dotsense.changeWorkout', () => {
      ChangeWorkoutPanel.createOrShow(context.extensionUri);
    });

    const startMLAssessmentCommand = vscode.commands.registerCommand('dotsense.startMLAssessment', () => {
    Logger.log('ML Assessment command called');
      if (state.activityMonitor) {
      Logger.log('Activity monitor available, getting activity states');
        // Get recent activity events for ML analysis
        const activityEvents = state.activityMonitor.getRecentEvents();
      Logger.log('Got activity events:', activityEvents?.length || 0);

        // Transform ActivityEvent[] to ActivityAnalysis[] for the panel
        const activityAnalysis = activityEvents.length > 0 ?
          MLWorkRestGenerator['analyzeActivityData'](activityEvents) : {
            averageSessionLength: 45,
            peakProductivityHours: [9, 10, 11],
            burnoutPatterns: [],
            flowStateFrequency: 0.3,
            breakAcceptanceRate: 0.6,
            workPatternStability: 0.5
          };

        // Start ML assessment
        WorkRestAssessmentPanel.createOrShow(context.extensionUri, [activityAnalysis]);
        vscode.window.showInformationMessage('🤖 Starting AI Personalization Assessment...');
      Logger.log('ML Assessment panel opened');
      } else {
      Logger.log('Activity monitor not available');
        vscode.window.showErrorMessage('ML Assessment requires activity monitoring to be enabled. Please check your settings.');
      }
    });

    const refreshTimerCommand = vscode.commands.registerCommand('dotsense.refreshTimer', () => {
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

    const analyticsCommand = vscode.commands.registerCommand('dotsense.showAnalytics', () => {
      showAnalyticsReport();
    });

    const showAchievementsCommand = vscode.commands.registerCommand('dotsense.showAchievements', () => {
      showAchievementsReport();
    });

    const forceUnblockCommand = vscode.commands.registerCommand('dotsense.forceUnblock', () => {
      forceUnblock();
      vscode.window.showInformationMessage('🔓 Emergency unblock activated. Rest enforcement temporarily disabled.');
    });

    const createCustomExerciseCommand = vscode.commands.registerCommand('dotsense.createCustomExercise', () => {
      showCustomExerciseCreator();
    });

    const showCustomExerciseLibraryCommand = vscode.commands.registerCommand('dotsense.showCustomExerciseLibrary', () => {
      showCustomExerciseLibrary();
    });

    const triggerGitBreakSuggestionCommand = vscode.commands.registerCommand('dotsense.triggerGitBreakSuggestion', () => {
      triggerGitBasedBreakSuggestion();
    });

    const showUpdatePanelCommand = vscode.commands.registerCommand('dotsense.showUpdatePanel', () => {
      UpdatePanel.createOrShow(context.extensionUri);
    });

    const openTimeBlockingCommand = vscode.commands.registerCommand('dotsense.openTimeBlocking', () => {
      TimeBlockingPanel.createOrShow(context.extensionUri);
    });

    const activitySettingsChangedCommand = vscode.commands.registerCommand('dotsense.activitySettingsChanged', () => {
      Logger.log('Activity settings changed command triggered');
      // This command is used internally when activity settings change
      // The actual logic is handled in the applySettingsChanges function
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
      openTimeBlockingCommand,
      activitySettingsChangedCommand
    );

    // Initialize activity bar provider
  Logger.log('Creating activity bar provider...');
    try {
      state.activityBarProvider = new dotsenseActivityBarProviderImpl(context.extensionUri);
    Logger.log('Activity bar provider created successfully');

      // Register webview view provider
    Logger.log('Registering webview view provider for dotsenseMain...');
      const providerRegistration = vscode.window.registerWebviewViewProvider('dotsenseMain', state.activityBarProvider);
      context.subscriptions.push(providerRegistration);
    Logger.log('Webview view provider registered successfully for dotsenseMain');
    } catch (error) {
    Logger.error('Failed to create or register activity bar provider:', error);
      vscode.window.showErrorMessage(`DotSense: Failed to initialize activity bar: ${(error as Error).message}`);
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
      if (e.affectsConfiguration('dotsense')) {
        restartReminderSystem();
      }
    });

    // Set up IDE activity monitoring
    setupActivityMonitoring(context);

    // Initialize screen blocking service
    initializeScreenBlocking();

    // Initialize custom exercise storage
    initializeExerciseStorage(context);

    // Initialize smart wellness manager with extensionUri
    Logger.log('Initializing SmartWellnessManager with extensionUri:', !!context.extensionUri);
    try {
      initializeSmartWellnessManager(context.extensionUri);
      Logger.log('SmartWellnessManager initialized successfully');
    } catch (error) {
      Logger.error('Failed to initialize SmartWellnessManager:', error);
    }

    // Initialize Git integration
    initializeGitIntegration();

    // Initialize work-rest model (core feature)
    initializeWorkRestModel();

    // Check if we should show the update panel (max 3 days)
    checkAndShowUpdatePanel(context);

    // Initialize AI Analytics Infrastructure
  Logger.log('Initializing AI Analytics Infrastructure...');
    try {
      // Usage Analytics Service is already started via singleton pattern
    Logger.log('Usage Analytics initialized');

      // Performance Analytics Engine is ready via singleton pattern
    Logger.log('Performance Analytics Engine initialized');

      // Adaptive Learning Service - starts continuous learning loops
    Logger.log('Adaptive Learning Service initialized and learning cycle started');

      // Track extension startup as first usage event
      usageAnalytics.trackSessionStart('extension_startup', 0);

      vscode.window.showInformationMessage('🧠 AI Productivity Analytics Active - System learning from your usage patterns!', 'Show Analytics Dashboard');

    } catch (error) {
    Logger.warn('AI Analytics initialization failed:', error);
      vscode.window.showWarningMessage('Could not initialize AI Analytics features - basic functionality is still available.');
    }

  Logger.log('DotSense extension activation completed successfully - AI Analytics Enabled');
  } catch (error) {
  Logger.error('Error during DotSense extension activation:', error);
    vscode.window.showErrorMessage(`DotSense failed to activate: ${(error as Error).message}`);
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
    Logger.log('Showing update panel for the first time');
    } else {
      // Check if it's been more than 3 days
      const updateShownDate = new Date(updateShownDateStr);
      const daysSinceShown = Math.floor((now.getTime() - updateShownDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysSinceShown < MAX_DAYS) {
        UpdatePanel.createOrShow(context.extensionUri);
      Logger.log(`Showing update panel (${daysSinceShown}/${MAX_DAYS} days)`);
      } else {
      Logger.log(`Update panel not shown (exceeded ${MAX_DAYS} days)`);
      }
    }
  } catch (error) {
  Logger.error('Error checking update panel:', error);
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
