import * as vscode from 'vscode';
import * as path from 'path';
import { BreakBullyActivityBarProvider, BreakStats, WebviewMessage } from '../types';
import { state } from '../models/state';
import { takeBreak } from '../services/breakService';
import { showStretchExercise, showBreathingExercise, showEyeExercise, showWaterReminder } from '../services/exerciseService';
import { showAnalyticsReport } from '../services/analyticsService';

export class BreakBullyActivityBarProviderImpl implements BreakBullyActivityBarProvider {
  private _view?: vscode.WebviewView;
  private _extensionUri: vscode.Uri;

  constructor(extensionUri: vscode.Uri) {
    this._extensionUri = extensionUri;
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void | Thenable<void> {
    console.log('resolveWebviewView called - webview provider is working!');
    console.log('Webview view type:', webviewView.viewType);
    console.log('Webview view ID:', webviewView.viewType);

    try {
      this._view = webviewView;

      // Set webview options
      webviewView.webview.options = {
        enableScripts: true,
        enableForms: true,
        enableCommandUris: true,
        localResourceRoots: [this._extensionUri]
      };

      console.log('Webview options set successfully');

      // Load HTML content from file
      this.loadWebviewContent(webviewView);

      // Handle messages from webview
      webviewView.webview.onDidReceiveMessage(
        (message: WebviewMessage) => {
          this.handleWebviewMessage(message);
        },
        undefined,
        []
      );

      // Send initial data to webview
      this.updateStats(state.breakStats);
      this.updateStatus();

      console.log('resolveWebviewView completed successfully');
    } catch (error) {
      console.error('Error in resolveWebviewView:', error);
      vscode.window.showErrorMessage(`Break Bully: Error initializing webview: ${(error as Error).message}`);
    }
  }

  private async loadWebviewContent(webviewView: vscode.WebviewView): Promise<void> {
    try {
      // Read the HTML file from the compiled views directory
      const htmlPath = vscode.Uri.joinPath(this._extensionUri, 'out', 'src', 'views', 'mainView.html');
      const htmlContent = await vscode.workspace.fs.readFile(htmlPath);
      let html = htmlContent.toString();

      // Convert CSS file paths to webview URIs
      const baseCssPath = vscode.Uri.joinPath(this._extensionUri, 'out', 'src', 'views', 'base.css');
      const componentsCssPath = vscode.Uri.joinPath(this._extensionUri, 'out', 'src', 'views', 'components.css');
      const featuresCssPath = vscode.Uri.joinPath(this._extensionUri, 'out', 'src', 'views', 'features.css');
      const onboardingCssPath = vscode.Uri.joinPath(this._extensionUri, 'out', 'src', 'views', 'onboarding.css');

      const baseCssUri = webviewView.webview.asWebviewUri(baseCssPath);
      const componentsCssUri = webviewView.webview.asWebviewUri(componentsCssPath);
      const featuresCssUri = webviewView.webview.asWebviewUri(featuresCssPath);
      const onboardingCssUri = webviewView.webview.asWebviewUri(onboardingCssPath);

      // Convert JS file paths to webview URIs
      const uiJsPath = vscode.Uri.joinPath(this._extensionUri, 'out', 'src', 'views', 'ui.js');
      const onboardingJsPath = vscode.Uri.joinPath(this._extensionUri, 'out', 'src', 'views', 'onboarding.js');
      const animationsJsPath = vscode.Uri.joinPath(this._extensionUri, 'out', 'src', 'views', 'animations.js');
      const mainJsPath = vscode.Uri.joinPath(this._extensionUri, 'out', 'src', 'views', 'main.js');

      const uiJsUri = webviewView.webview.asWebviewUri(uiJsPath);
      const onboardingJsUri = webviewView.webview.asWebviewUri(onboardingJsPath);
      const animationsJsUri = webviewView.webview.asWebviewUri(animationsJsPath);
      const mainJsUri = webviewView.webview.asWebviewUri(mainJsPath);

      // Replace paths in HTML
      html = html.replace('base.css', baseCssUri.toString());
      html = html.replace('components.css', componentsCssUri.toString());
      html = html.replace('features.css', featuresCssUri.toString());
      html = html.replace('onboarding.css', onboardingCssUri.toString());

      html = html.replace('ui.js', uiJsUri.toString());
      html = html.replace('onboarding.js', onboardingJsUri.toString());
      html = html.replace('animations.js', animationsJsUri.toString());
      html = html.replace('main.js', mainJsUri.toString());

      // Set the HTML content
      webviewView.webview.html = html;
      console.log('Webview HTML content loaded successfully from:', htmlPath.fsPath);
    } catch (error) {
      console.error('Failed to load webview content:', error);

      // Fallback to simple HTML if file loading fails
      webviewView.webview.html = this.getFallbackHtml();
    }
  }

  private getFallbackHtml(): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Break Bully</title>
          <style>
              body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
                  background: var(--vscode-editor-background, #1e1e1e);
                  color: var(--vscode-editor-foreground, #d4d4d4);
                  padding: 20px;
                  margin: 0;
                  display: flex;
                  flex-direction: column;
                  gap: 16px;
              }
              .header {
                  text-align: center;
                  padding-bottom: 12px;
                  border-bottom: 1px solid var(--vscode-panel-border, #3e3e42);
              }
              .title {
                  font-size: 18px;
                  font-weight: 700;
                  margin: 0;
                  background: linear-gradient(135deg, #ff6b6b 0%, #4ecdc4 100%);
                  -webkit-background-clip: text;
                  -webkit-text-fill-color: transparent;
                  background-clip: text;
              }
              .status {
                  width: 12px;
                  height: 12px;
                  border-radius: 50%;
                  background: var(--vscode-charts-green, #89d185);
                  margin: 8px auto;
                  animation: pulse 2s infinite;
              }
              .stats {
                  display: grid;
                  grid-template-columns: 1fr 1fr 1fr;
                  gap: 8px;
                  margin: 16px 0;
              }
              .stat {
                  text-align: center;
                  padding: 8px;
                  background: var(--vscode-editorWidget-background, #252526);
                  border-radius: 6px;
              }
              .stat-value {
                  font-size: 18px;
                  font-weight: 700;
                  color: var(--vscode-charts-blue, #4f8bd6);
              }
              .actions {
                  display: grid;
                  grid-template-columns: 1fr 1fr;
                  gap: 8px;
              }
              .btn {
                  padding: 8px 12px;
                  border: none;
                  border-radius: 6px;
                  font-weight: 600;
                  cursor: pointer;
                  background: linear-gradient(135deg, #ff6b6b 0%, #4ecdc4 100%);
                  color: white;
              }
              @keyframes pulse {
                  0% { opacity: 1; }
                  50% { opacity: 0.5; }
                  100% { opacity: 1; }
              }
          </style>
      </head>
      <body>
          <div class="header">
              <h1 class="title">Break Bully</h1>
              <div class="status"></div>
          </div>

          <div class="stats">
              <div class="stat">
                  <div class="stat-value" id="breaks">0</div>
                  <div>Breaks</div>
              </div>
              <div class="stat">
                  <div class="stat-value" id="saved">0</div>
                  <div>Minutes</div>
              </div>
              <div class="stat">
                  <div class="stat-value" id="streak">0</div>
                  <div>Streak</div>
              </div>
          </div>

          <div class="actions">
              <button class="btn" onclick="takeBreak()">Take Break</button>
              <button class="btn" onclick="openSettings()">Settings</button>
          </div>

          <script>
              const vscode = acquireVsCodeApi();

              function takeBreak() {
                  vscode.postMessage({ command: 'takeBreak' });
              }

              function openSettings() {
                  vscode.postMessage({ command: 'openSettings' });
              }

              // Update stats periodically
              setInterval(() => {
                  vscode.postMessage({ command: 'requestStats' });
              }, 1000);
          </script>
      </body>
      </html>
    `;
  }

  private handleWebviewMessage(message: WebviewMessage): void {
    console.log('Received message from webview:', message.command, message.data);

    switch (message.command) {
      case 'takeBreak':
        takeBreak();
        break;
      case 'openSettings':
        vscode.commands.executeCommand('breakBully.openSettings');
        break;
      case 'showTimer':
        vscode.window.showInformationMessage(`Timer started for ${message.data?.duration} seconds`);
        break;
      case 'updateStats':
        if (message.data) {
          this.updateStats(message.data);
        }
        break;
      case 'requestInitialData':
        console.log('Sending initial data to webview...');
        this.sendInitialData();
        break;
      case 'requestTimerStatus':
        console.log('Sending timer status to webview...');
        this.sendTimerStatus();
        break;
      case 'requestOnboardingStatus':
        console.log('Sending onboarding status to webview...');
        this.sendOnboardingStatus();
        break;
      case 'showStretch':
        showStretchExercise();
        break;
      case 'breathingExercise':
        showBreathingExercise();
        break;
      case 'showEyeExercise':
        showEyeExercise();
        break;
      case 'showWaterReminder':
        showWaterReminder();
        break;
      case 'getWorkRestModels':
        const models = require('../constants/workRestModels').workRestModels;
        this._view?.webview.postMessage({
          command: 'workRestModels',
          data: models
        });
        break;
      case 'getWorkRestModelsForQuickPick':
        const quickPickModels = require('../constants/workRestModels').workRestModels;
        this._view?.webview.postMessage({
          command: 'workRestModelsForQuickPick',
          data: quickPickModels
        });
        break;
      case 'getWorkRestModelDetails':
        const modelDetails = require('../constants/workRestModels').getWorkRestModelById(message.data.modelId);
        if (modelDetails) {
          this._view?.webview.postMessage({
            command: 'workRestModelDetails',
            data: modelDetails
          });
        }
        break;
      case 'showQuickPick':
        this.showWorkRestModelQuickPick(message.data);
        break;
      case 'showInfoMessage':
        vscode.window.showInformationMessage(message.data.message);
        break;
      case 'showErrorMessage':
        vscode.window.showErrorMessage(message.data.message);
        break;
      case 'startWorkRestSession':
        const workRestService = require('../services/workRestService');
        workRestService.switchWorkRestModel(message.data.modelId);
        // Send current session info
        const currentSession = workRestService.getCurrentSession();
        this._view?.webview.postMessage({
          command: 'workRestSessionUpdate',
          data: currentSession
        });
        break;
      case 'stopWorkRestSession':
        const workRestServiceStop = require('../services/workRestService');
        workRestServiceStop.stopWorkRestSession();
        this._view?.webview.postMessage({
          command: 'workRestSessionUpdate',
          data: null
        });
        break;
      case 'setOnboardingWorkRestModel':
        // Save the selected model for onboarding
        const config = vscode.workspace.getConfiguration('breakBully');
        config.update('workRestModel', message.data.modelId, vscode.ConfigurationTarget.Global).then(() => {
          // Start the work-rest session with the selected model
          const workRestService = require('../services/workRestService');
          const model = require('../constants/workRestModels').getWorkRestModelById(message.data.modelId);
          if (model) {
            workRestService.startWorkRestSession(model);
          }
        });
        break;
      case 'changeWorkRestModel':
        // Change the work-rest model from settings
        const workRestServiceChange = require('../services/workRestService');
        try {
          workRestServiceChange.switchWorkRestModel(message.data.modelId);
          // Send success response
          this._view?.webview.postMessage({
            command: 'workRestModelChanged',
            data: { success: true }
          });
          // Update timer status immediately
          this.sendTimerStatus();
        } catch (error) {
          console.error('Failed to change work-rest model:', error);
          this._view?.webview.postMessage({
            command: 'workRestModelChanged',
            data: { success: false, error: (error as Error).message }
          });
        }
        break;
      case 'showAnalytics':
        showAnalyticsReport();
        break;
      case 'exportAchievements':
        this.exportAchievements();
        break;
      case 'showAchievementStats':
        vscode.commands.executeCommand('breakBully.showAchievements');
        break;
      case 'showAchievementsGallery':
        vscode.commands.executeCommand('breakBully.showAchievements');
        break;
      case 'createCustomGoal':
        this.createCustomGoal();
        break;
      case 'createChallenge':
        this.createChallenge();
        break;
      case 'createCustomExercise':
        const { showCustomExerciseCreator } = require('../services/exerciseService');
        showCustomExerciseCreator();
        break;
      case 'showCustomExerciseLibrary':
        const { showCustomExerciseLibrary } = require('../services/exerciseService');
        showCustomExerciseLibrary();
        break;
      case 'triggerGitBreakSuggestion':
        const { triggerGitBasedBreakSuggestion } = require('../services/exerciseService');
        triggerGitBasedBreakSuggestion();
        break;
      case 'showGitProductivityDashboard':
        const { showGitProductivityDashboard } = require('../services/exerciseService');
        showGitProductivityDashboard();
        break;
      case 'getWellnessInsights':
        this.getWellnessInsights(message.data);
        break;
      case 'onboardingCompleted':
        // Mark onboarding as completed in global state
        const onboardingConfig = vscode.workspace.getConfiguration('breakBully');
        onboardingConfig.update('onboardingCompleted', true, vscode.ConfigurationTarget.Global).then(() => {
          console.log('Onboarding marked as completed');
        });
        break;
      case 'openChangeWorkoutPanel':
        vscode.commands.executeCommand('breakBully.changeWorkout');
        break;
      case 'openTimeBlocking':
        vscode.commands.executeCommand('breakBully.openTimeBlocking');
        break;
      case 'getActivityIntegrationSettings':
        this.sendActivityIntegrationSettings();
        break;
      case 'applySettingsChanges':
        this.applySettingsChanges(message.data);
        break;
      case 'startWorkRestSession':
        this.startWorkRestSession(message.data.modelId);
        break;
      case 'stopWorkRestSession':
        this.stopWorkRestSession();
        break;
      case 'showCodeTuneSuggestion':
        this.showCodeTuneSuggestion(message.data);
        break;
      case 'hideCodeTuneSuggestion':
        this.hideCodeTuneSuggestion();
        break;
      case 'openCodeTune':
        this.openCodeTune();
        break;
      case 'neverShowCodeTune':
        this.neverShowCodeTune();
        break;
      case 'installCodeTune':
        this.installCodeTune();
        break;
    }
  }

  updateStats(stats: BreakStats): void {
    if (this._view) {
      this._view.webview.postMessage({
        command: 'updateStats',
        data: stats
      });
    }
  }

  updateStatus(): void {
    if (this._view) {
      const config = vscode.workspace.getConfiguration('breakBully');

      this._view.webview.postMessage({
        command: 'updateStatus',
        data: {
          isEnabled: config.get('enabled', true),
          nextReminder: state.nextReminderTime,
          enableEyeExercises: config.get('enableEyeExercises', true),
          enableGoals: config.get('enableGoals', true),
          enableAchievements: config.get('enableAchievements', true)
        }
      });
    }
  }

  private sendInitialData(): void {
    if (this._view) {
      const config = vscode.workspace.getConfiguration('breakBully');

      // Send initial stats
      this._view.webview.postMessage({
        command: 'updateStats',
        data: state.breakStats
      });

      // Send initial status
      this.updateStatus();

      // Send initial wellness goals
      this.updateWellnessGoals();

      // Send initial wellness challenges
      this.updateWellnessChallenges();
    }
  }

  private sendTimerStatus(): void {
    if (this._view) {
      const config = vscode.workspace.getConfiguration('breakBully');

      // Check if there's an active work-rest session
      const workRestService = require('../services/workRestService');
      const timeRemaining = workRestService.getTimeRemaining();

      if (timeRemaining) {
        // Show work-rest session timing with ML enhancements
        let baseTime = Date.now() + (timeRemaining.minutes * 60 * 1000) + (timeRemaining.seconds * 1000);
        let nextReminder = baseTime;
        let mlEnhanced = false;

        // Integrate ML smart scheduling if enabled and available
        try {
          const { activitySettings } = require('../services/activityIntegration/activitySettings');
          if (activitySettings && activitySettings.isSmartEnabled && activitySettings.isSmartEnabled() && state.activityMonitor) {
            try {
              const { SmartScheduler } = require('../services/activityIntegration/smartScheduler');
              const baseMonitor = state.activityMonitor;
              const smartScheduler = new SmartScheduler(baseMonitor);
              mlEnhanced = true;

              if (timeRemaining.phase === 'work') {
                // Check if we should delay break due to flow state
                if (smartScheduler.shouldDelayBreak && smartScheduler.shouldDelayBreak()) {
                  const delayMinutes = smartScheduler.getBreakDelayMinutes ? smartScheduler.getBreakDelayMinutes() : 0;
                  if (delayMinutes > 0) {
                    nextReminder = baseTime + (delayMinutes * 60 * 1000);
                    console.log(`ML: Delaying break by ${delayMinutes} minutes due to flow state`);
                  }
                }
              } else if (timeRemaining.phase === 'rest') {
                // Suggest appropriate break duration
                const mlBreakDuration = smartScheduler.suggestBreakDuration ? smartScheduler.suggestBreakDuration() : 10;
                console.log(`ML suggests break duration: ${mlBreakDuration} minutes`);
              }
            } catch (schedulerError) {
              console.debug('SmartScheduler integration failed, using basic timing:', schedulerError);
              mlEnhanced = false;
            }
          }
        } catch (error) {
          console.debug('ML timing integration not available, using basic timing:', (error as Error).message);
          mlEnhanced = false;
        }

        this._view.webview.postMessage({
          command: 'updateTimer',
          data: {
            isEnabled: config.get('enabled', true),
            nextReminder: nextReminder,
            interval: config.get('interval', 30),
            phase: timeRemaining.phase,
            mlEnhanced: mlEnhanced
          }
        });
      } else {
        // Fall back to regular reminder timing with optional ML enhancements
        let nextReminder = state.nextReminderTime;
        let mlEnhanced = false;

        // Check for ML-enhanced break suggestions
        try {
          const { activitySettings } = require('../services/activityIntegration/activitySettings');
          if (activitySettings && activitySettings.isSmartEnabled && activitySettings.isSmartEnabled() && state.activityMonitor) {
            try {
              const { SmartScheduler } = require('../services/activityIntegration/smartScheduler');
              const baseMonitor = state.activityMonitor;
              const smartScheduler = new SmartScheduler(baseMonitor);
              mlEnhanced = true;

              // Check if ML wants to suggest a break at this time
              if (smartScheduler.shouldSuggestBreak && smartScheduler.shouldSuggestBreak()) {
                const suggestion = smartScheduler.getBreakSuggestion ? smartScheduler.getBreakSuggestion() : null;
                console.log(`ML suggests break: ${suggestion}`);
              }

              // Get ML break duration suggestion for when break actually starts
              const mlBreakDuration = smartScheduler.suggestBreakDuration ? smartScheduler.suggestBreakDuration() : 10;
              console.log(`ML plans to suggest break duration: ${mlBreakDuration} minutes`);
            } catch (schedulerError) {
              console.debug('SmartScheduler suggestion failed, using basic timing:', schedulerError);
              mlEnhanced = false;
            }
          }
        } catch (error) {
          console.debug('ML suggestion integration not available, using basic timing:', (error as Error).message);
          mlEnhanced = false;
        }

        this._view.webview.postMessage({
          command: 'updateTimer',
          data: {
            isEnabled: config.get('enabled', true),
            nextReminder: nextReminder,
            interval: config.get('interval', 30),
            mlEnhanced: mlEnhanced
          }
        });
      }
    }
  }

  private sendOnboardingStatus(): void {
    if (this._view) {
      const config = vscode.workspace.getConfiguration('breakBully');
      const onboardingCompleted = config.get('onboardingCompleted', false);

      this._view.webview.postMessage({
        command: 'onboardingStatus',
        data: {
          completed: onboardingCompleted
        }
      });
    }
  }

  updateScreenTime(): void {
    if (this._view) {
      this._view.webview.postMessage({
        command: 'updateScreenTime',
        data: {
          totalScreenTime: state.screenTimeStats.totalScreenTimeToday,
          continuousScreenTime: state.screenTimeStats.continuousScreenTime,
          isIdle: state.screenTimeStats.isIdle
        }
      });
    }
  }

  updateActivityStatus(): void {
    if (this._view) {
      // Try to get enhanced activity monitor if available
      let activityText = 'Actively coding';
      let sessionTime = '0s';
      let isIdle = false;
      let activityLevel = 'low';
      let activityScore = 0;
      let currentState = 'idle';
      let enhancedTracking = false;

      try {
        // Import activity monitor dynamically
        const activityMonitorModule = require('../services/activityIntegration/baseActivityMonitor');
        if (activityMonitorModule && state.activityMonitor &&
            typeof state.activityMonitor.getCurrentActivityState === 'function') {
          const activityMonitor = state.activityMonitor;
          const stateEnum = activityMonitorModule.ActivityState;

          currentState = activityMonitor.getCurrentActivityState();
          activityScore = activityMonitor.getActivityScore ? activityMonitor.getActivityScore() : 0;
          activityLevel = activityMonitor.getCurrentActivityLevel ? activityMonitor.getCurrentActivityLevel() : 'low';
          enhancedTracking = true;

          // Map activity state to user-friendly display
          switch (currentState) {
            case stateEnum.CODING:
              activityText = '🚀 Actively coding';
              isIdle = false;
              break;
            case stateEnum.DEBUGGING:
              activityText = '🐛 Debugging code';
              isIdle = false;
              break;
            case stateEnum.SEARCHING:
              activityText = '🔍 Searching code';
              isIdle = false;
              break;
            case stateEnum.REFACTORING:
              activityText = '🔧 Refactoring code';
              isIdle = false;
              break;
            case stateEnum.READING:
              activityText = '📖 Reviewing code';
              isIdle = false;
              break;
            case stateEnum.IDLE:
            default:
              activityText = '⏱️ Idle';
              isIdle = true;
              break;
          }
        } else {
          // Fall back to basic screen time tracking
          isIdle = state.screenTimeStats.isIdle;
          activityText = isIdle ? '⏱️ Idle' : '🚀 Actively coding';
        }
      } catch (error) {
        // If activity monitor is not available, use basic tracking
        console.debug('Enhanced activity tracking not available, using basic tracking:', error);
        isIdle = state.screenTimeStats.isIdle;
        activityText = isIdle ? '⏱️ Idle' : '🚀 Actively coding';
        enhancedTracking = false;
      }

      // Calculate session time from basic tracking as fallback
      const sessionStart = state.screenTimeStats.codingSessionStart;
      if (sessionStart) {
        const totalSeconds = Math.floor((Date.now() - sessionStart.getTime()) / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        if (hours > 0) {
          sessionTime = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        } else if (minutes > 0) {
          sessionTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        } else {
          sessionTime = `${seconds}s`;
        }
      }

      this._view.webview.postMessage({
        command: 'updateActivityStatus',
        data: {
          activityText,
          sessionTime,
          isIdle,
          activityLevel,
          activityScore: Math.round(activityScore * 10) / 10, // Round to 1 decimal
          currentState,
          enhancedTracking
        }
      });
    }
  }

  updateWellnessGoals(): void {
    if (this._view) {
      this._view.webview.postMessage({
        command: 'updateWellnessGoals',
        data: state.wellnessGoals
      });
    }
  }

  updateWellnessChallenges(): void {
    if (this._view) {
      this._view.webview.postMessage({
        command: 'updateWellnessChallenges',
        data: state.wellnessChallenges
      });
    }
  }

  updateAchievements(): void {
    if (this._view) {
      this._view.webview.postMessage({
        command: 'updateAchievements',
        data: state.achievements
      });
    }
  }

  postMessage(message: WebviewMessage): void {
    if (this._view) {
      this._view.webview.postMessage(message);
    }
  }

  private exportAchievements(): void {
    const { exportAchievements, generateAchievementShareText } = require('../services/achievementService');
    const exportData = exportAchievements();

    // Create a temporary file with the export data
    const exportContent = JSON.stringify(exportData, null, 2);
    const fileName = `break-bully-achievements-${new Date().toISOString().split('T')[0]}.json`;

    // Use VSCode's file save dialog
    vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(fileName),
      filters: {
        'JSON files': ['json'],
        'All files': ['*']
      }
    }).then(uri => {
      if (uri) {
        vscode.workspace.fs.writeFile(uri, Buffer.from(exportContent)).then(() => {
          vscode.window.showInformationMessage(`Achievements exported successfully to ${uri.fsPath}`);

          // Also copy shareable text to clipboard
          const unlockedAchievements = exportData.achievements;
          if (unlockedAchievements.length > 0) {
            const latestAchievement = unlockedAchievements[unlockedAchievements.length - 1];
            const shareText = generateAchievementShareText(latestAchievement);
            vscode.env.clipboard.writeText(shareText);
            vscode.window.showInformationMessage('Achievement share text copied to clipboard!');
          }
        }, error => {
          vscode.window.showErrorMessage(`Failed to export achievements: ${error.message}`);
        });
      }
    });
  }

  private showAchievementStats(): void {
    const { getAchievementStats } = require('../services/achievementService');
    const stats = getAchievementStats();

    // Send stats to webview for display
    if (this._view) {
      this._view.webview.postMessage({
        command: 'updateAchievementStats',
        data: stats
      });
    }

    // Also show a detailed stats window
    const statsMessage = `
🏆 Achievement Statistics

📊 Overall Progress: ${stats.unlockedAchievements}/${stats.totalAchievements} (${stats.completionPercentage}%)

🏅 Rarity Breakdown:
• Common: ${stats.rarityBreakdown.common.unlocked}/${stats.rarityBreakdown.common.total}
• Rare: ${stats.rarityBreakdown.rare.unlocked}/${stats.rarityBreakdown.rare.total}
• Epic: ${stats.rarityBreakdown.epic.unlocked}/${stats.rarityBreakdown.epic.total}
• Legendary: ${stats.rarityBreakdown.legendary.unlocked}/${stats.rarityBreakdown.legendary.total}

🎯 Category Leaders:
• ${stats.mostUnlockedCategory.category}: ${stats.mostUnlockedCategory.unlocked} unlocked

⭐ Average Rarity: ${stats.averageRarity}

${stats.fastestAchievement ? `⚡ Fastest Achievement: ${stats.fastestAchievement.name} (${stats.fastestAchievement.daysToUnlock} days)` : ''}
    `.trim();

    vscode.window.showInformationMessage('Achievement Statistics', {
      modal: false,
      detail: statsMessage
    }, 'Export Achievements').then(selection => {
      if (selection === 'Export Achievements') {
        this.exportAchievements();
      }
    });
  }

  private createCustomGoal(): void {
    vscode.window.showInputBox({
      prompt: 'Enter your custom goal description',
      placeHolder: 'e.g., Drink 8 glasses of water daily'
    }).then(description => {
      if (!description) return;

      vscode.window.showInputBox({
        prompt: 'Enter target number',
        placeHolder: 'e.g., 8',
        validateInput: (value) => {
          const num = parseInt(value);
          return isNaN(num) || num <= 0 ? 'Please enter a positive number' : null;
        }
      }).then(targetStr => {
        if (!targetStr) return;

        const target = parseInt(targetStr);

        vscode.window.showQuickPick(['daily', 'weekly', 'custom'], {
          placeHolder: 'Select goal type'
        }).then(type => {
          if (!type) return;

          vscode.window.showInputBox({
            prompt: 'Custom type (optional)',
            placeHolder: 'e.g., glasses, minutes, pages'
          }).then(customType => {
            vscode.window.showInputBox({
              prompt: 'Custom unit (optional)',
              placeHolder: 'e.g., glasses, minutes, pages'
            }).then(customUnit => {
              vscode.window.showInputBox({
                prompt: 'Reward (optional)',
                placeHolder: 'e.g., 🎉 Great job!'
              }).then(reward => {
                const { createCustomGoal } = require('../services/wellnessService');
                const goal = createCustomGoal({
                  description,
                  target,
                  type: type as 'daily' | 'weekly' | 'custom',
                  customType: customType || undefined,
                  customUnit: customUnit || undefined,
                  reward: reward || undefined
                });

                vscode.window.showInformationMessage(`Custom goal created: ${goal.description}`);
              });
            });
          });
        });
      });
    });
  }

  private createChallenge(): void {
    vscode.window.showInputBox({
      prompt: 'Enter challenge name',
      placeHolder: 'e.g., Wellness Warrior Week'
    }).then(name => {
      if (!name) return;

      vscode.window.showInputBox({
        prompt: 'Enter challenge description',
        placeHolder: 'e.g., Complete daily wellness goals for 7 days'
      }).then(description => {
        if (!description) return;

        vscode.window.showInputBox({
          prompt: 'Enter duration in days',
          placeHolder: 'e.g., 7',
          validateInput: (value) => {
            const num = parseInt(value);
            return isNaN(num) || num <= 0 ? 'Please enter a positive number' : null;
          }
        }).then(durationStr => {
          if (!durationStr) return;

          const duration = parseInt(durationStr);

          vscode.window.showInputBox({
            prompt: 'Enter reward',
            placeHolder: 'e.g., 🌟 Wellness Champion Trophy'
          }).then(reward => {
            if (!reward) return;

            const { createChallenge } = require('../services/wellnessService');
            const challenge = createChallenge({
              name,
              description,
              duration,
              goals: state.wellnessGoals, // Use existing goals for the challenge
              reward
            });

            vscode.window.showInformationMessage(`Challenge created: ${challenge.name}`);
          });
        });
      });
    });
  }

  private createCustomExercise(): void {
    vscode.window.showInputBox({
      prompt: 'Enter exercise name',
      placeHolder: 'e.g., Neck Rolls'
    }).then(name => {
      if (!name) return;

      vscode.window.showInputBox({
        prompt: 'Enter duration',
        placeHolder: 'e.g., 30 seconds'
      }).then(duration => {
        if (!duration) return;

        vscode.window.showInputBox({
          prompt: 'Enter instructions',
          placeHolder: 'e.g., Gently roll your neck in circles...'
        }).then(instructions => {
          if (!instructions) return;

          vscode.window.showQuickPick(['stretch', 'breathing', 'eye', 'full-body', 'neck', 'shoulders', 'back'], {
            placeHolder: 'Select exercise category'
          }).then(category => {
            if (!category) return;

            vscode.window.showQuickPick(['beginner', 'intermediate', 'advanced'], {
              placeHolder: 'Select difficulty level'
            }).then(difficulty => {
              if (!difficulty) return;

              const { createCustomExercise } = require('../services/wellnessService');
              const exercise = createCustomExercise({
                name,
                duration,
                instructions,
                category: category as any,
                difficulty: difficulty as any
              });

              vscode.window.showInformationMessage(`Custom exercise created: ${exercise.name}`);
            });
          });
        });
      });
    });
  }

  private showWorkRestModelQuickPick(data: { items: any[], placeHolder: string }): void {
    const quickPickItems = data.items.map(item => ({
      label: item.label,
      detail: item.detail,
      description: item.description,
      modelId: item.modelId
    }));

    vscode.window.showQuickPick(quickPickItems, {
      placeHolder: data.placeHolder,
      matchOnDetail: true,
      matchOnDescription: true
    }).then(selection => {
      if (selection && selection.modelId) {
        // Change the work-rest model
        const workRestService = require('../services/workRestService');
        try {
          workRestService.switchWorkRestModel(selection.modelId);
          // Send success response
          this._view?.webview.postMessage({
            command: 'workRestModelChanged',
            data: { success: true }
          });
          // Update timer status immediately
          this.sendTimerStatus();
        } catch (error) {
          console.error('Failed to change work-rest model:', error);
          this._view?.webview.postMessage({
            command: 'workRestModelChanged',
            data: { success: false, error: (error as Error).message }
          });
        }
      }
    });
  }

  private getWellnessInsights(data: { timeRange: string }): void {
    const { getWellnessInsights } = require('../services/wellnessService');
    const insights = getWellnessInsights(data.timeRange as 'today' | 'week' | 'month' | 'all');

    // Send insights to webview for display
    if (this._view) {
      this._view.webview.postMessage({
        command: 'updateWellnessInsightsDisplay',
        data: insights
      });
    }

    // Also show a summary in VSCode notification
    const summary = `
📊 ${data.timeRange.charAt(0).toUpperCase() + data.timeRange.slice(1)} Wellness Summary

🎯 Goals Completed: ${insights.totalGoalsCompleted}
🏃‍♂️ Avg Breaks/Day: ${insights.averageBreaksPerDay}
⏰ Avg Screen Time: ${insights.averageScreenTime}m
📈 Success Rate: ${insights.goalCompletionRate}%

💡 Top Recommendation: ${insights.recommendations[0] || 'Keep up the great work!'}
    `.trim();

    vscode.window.showInformationMessage('Wellness Insights Updated', {
      modal: false,
      detail: summary
    });
  }

  private sendActivityIntegrationSettings(): void {
    if (this._view) {
      const { activitySettings } = require('../services/activityIntegration/activitySettings');
      const settings = activitySettings.getSettings();

      this._view.webview.postMessage({
        command: 'activityIntegrationSettings',
        data: {
          activityIntegrationLevel: settings.integrationLevel
        }
      });
    }
  }

  private applySettingsChanges(data: { activityLevel: string; workRestModel?: string }): void {
    try {
      const { activitySettings } = require('../services/activityIntegration/activitySettings');

      // Update activity integration level
      if (data.activityLevel) {
        activitySettings.setIntegrationLevel(data.activityLevel as any);
      }

      // Update work-rest model if provided
      if (data.workRestModel) {
        const workRestService = require('../services/workRestService');
        workRestService.switchWorkRestModel(data.workRestModel);
      }

      // Send success response
      if (this._view) {
        this._view.webview.postMessage({
          command: 'settingsApplied',
          data: { success: true }
        });
      }

      vscode.window.showInformationMessage('Settings saved successfully!');

      // Update timer status if work-rest model changed
      if (data.workRestModel) {
        this.sendTimerStatus();
      }

    } catch (error) {
      console.error('Failed to apply settings:', error);

      if (this._view) {
        this._view.webview.postMessage({
          command: 'settingsApplied',
          data: { success: false, error: (error as Error).message }
        });
      }

      vscode.window.showErrorMessage(`Failed to save settings: ${(error as Error).message}`);
    }
  }

  private startWorkRestSession(modelId: string): void {
    try {
      const workRestService = require('../services/workRestService');
      const model = require('../constants/workRestModels').getWorkRestModelById(modelId);

      if (!model) {
        vscode.window.showErrorMessage('Invalid work-rest model selected.');
        return;
      }

      workRestService.startWorkRestSession(model);

      vscode.window.showInformationMessage(`Work-rest session started with ${model.name}!`);

      // Update timer status immediately
      this.sendTimerStatus();

    } catch (error) {
      console.error('Failed to start work-rest session:', error);
      vscode.window.showErrorMessage(`Failed to start session: ${(error as Error).message}`);
    }
  }

  private stopWorkRestSession(): void {
    try {
      const workRestService = require('../services/workRestService');
      workRestService.stopWorkRestSession();

      vscode.window.showInformationMessage('Work-rest session stopped.');

      // Update timer status immediately
      this.sendTimerStatus();

    } catch (error) {
      console.error('Failed to stop work-rest session:', error);
      vscode.window.showErrorMessage(`Failed to stop session: ${(error as Error).message}`);
    }
  }

  private showCodeTuneSuggestion(data: { message: string; codeTuneInstalled: boolean }): void {
    if (this._view) {
      this._view.webview.postMessage({
        command: 'showCodeTuneSuggestion',
        data: {
          message: data.message,
          codeTuneInstalled: data.codeTuneInstalled
        }
      });
    }
  }

  private hideCodeTuneSuggestion(): void {
    if (this._view) {
      this._view.webview.postMessage({
        command: 'hideCodeTuneSuggestion'
      });
    }
  }

  private openCodeTune(): void {
    import('../services/codeTuneIntegration').then(codeTune => {
      codeTune.CodeTuneIntegration.openCodeTune();
    }).catch(error => {
      console.debug('CodeTune integration not available:', error);
    });
  }

  private neverShowCodeTune(): void {
    import('../services/codeTuneIntegration').then(codeTune => {
      codeTune.CodeTuneIntegration.setCodeTunePermanentlyIgnored(true);
      vscode.window.showInformationMessage('CodeTune suggestions have been disabled.', 'OK');
      this.hideCodeTuneSuggestion();
    }).catch(error => {
      console.debug('CodeTune integration not available:', error);
    });
  }

  private installCodeTune(): void {
    vscode.env.openExternal(vscode.Uri.parse('vscode:extension/FreeRave.codetune'));
    this.hideCodeTuneSuggestion();
  }
}
