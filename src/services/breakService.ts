import * as vscode from 'vscode';
import { state } from '../models/state';
import { checkAchievements } from './achievementService';
import { getCurrentSession, takeManualBreak, endRestEarly, getTimeRemaining } from './workRestService';

export function takeBreak(): void {
  // Check if there's an active work-rest session
  const currentSession = getCurrentSession();
  if (currentSession) {
    if (currentSession.isWorking) {
      // User is in a work period - ask for confirmation before starting rest
      vscode.window.showInformationMessage(
        `Ready to take a break?\n\nThis will start your ${currentSession.model.restDuration} minute rest period with screen monitoring.`,
        'Start Rest Now',
        'Cancel'
      ).then(selection => {
        if (selection === 'Start Rest Now') {
          const success = takeManualBreak();
          if (success) {
            // Update break statistics when manually starting rest
            updateBreakStatistics();
            vscode.window.showInformationMessage('🛋️ Rest period started! Screen will be monitored for coding activity.');

            // Show CodeTune suggestion in webview
            showCodeTuneSuggestionInWebview();
            return;
          }
        }
      });
      return;
    } else {
      // User is in a rest period - ask for confirmation before ending rest early
      const timeRemaining = getTimeRemaining();
      const remainingTime = timeRemaining ? `${timeRemaining.minutes}:${timeRemaining.seconds.toString().padStart(2, '0')}` : 'unknown';

      vscode.window.showInformationMessage(
        `End rest early?\n\nYou have ${remainingTime} remaining in your rest period. This will start your next work period immediately.`,
        'End Rest Early',
        'Continue Resting'
      ).then(selection => {
        if (selection === 'End Rest Early') {
          const success = endRestEarly();
          if (success) {
            // Update break statistics when ending rest early
            updateBreakStatistics();
            vscode.window.showInformationMessage('🔄 Rest ended early! Starting next work period.');
            return;
          }
        }
      });
      return;
    }
  }

  // Normal break logic (not in work-rest session)
  updateBreakStatistics();
  vscode.window.showInformationMessage('🎉 Great job! Break taken! Keep up the healthy habits!');

  // Show CodeTune suggestion in webview
  showCodeTuneSuggestionInWebview();
}

function updateBreakStatistics(): void {
  if (!state.storage) {
    console.error('Storage not initialized');
    return;
  }

  // Load current stats from storage
  const currentStats = state.storage.loadBreakStats();

  const now = new Date();
  const today = now.toDateString();

  // Update stats
  currentStats.breaksTaken++;
  currentStats.timeSaved += 5; // Assume 5 minutes saved per break
  currentStats.lastBreakDate = now;

  // Update streak - only reset if more than 1 day has passed
  if (currentStats.lastBreakDate) {
    const lastBreakDay = new Date(currentStats.lastBreakDate).toDateString();
    if (lastBreakDay !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      if (lastBreakDay === yesterday.toDateString()) {
        // Consecutive day - increment streak
        currentStats.streakDays++;
      } else if (new Date(lastBreakDay) >= twoDaysAgo) {
        // Within 2 days - maintain streak (allow for missed one day)
        // Don't change streak
      } else {
        // More than 2 days - reset streak
        currentStats.streakDays = 1;
      }
    }
    // If same day, keep current streak
  } else {
    currentStats.streakDays = 1;
  }

  // Save updated stats
  state.storage.saveBreakStats(currentStats);

  // Update local state for immediate UI updates
  state.breakStats = currentStats;

  // Reset screen time on break
  resetScreenTimeOnBreak();

  // Update break progress
  import('./goalService').then(goalService => {
    goalService.incrementBreakProgress();
    goalService.updateGoalsProgress();
    goalService.checkGoalAchievements();
  });

  // Check for new achievements
  checkAchievements();

  // Update activity bar
  if (state.activityBarProvider) {
    state.activityBarProvider.updateStats(state.breakStats);
  }

  // Pause reminders for 5 minutes
  import('./annoyanceService').then(annoyanceService => {
    annoyanceService.pauseReminders(5);
  });
}

function resetScreenTimeOnBreak(): void {
  state.screenTimeStats.continuousScreenTime = 0;
  state.screenTimeStats.lastBreakTime = new Date();
}



/**
 * Shows CodeTune suggestion in the webview instead of popup
 */
function showCodeTuneSuggestionInWebview(): void {
  import('./codeTuneIntegration').then(codeTune => {
    const config = require('../core/configuration').getConfiguration();

    // Check if CodeTune suggestions are enabled and not permanently ignored
    if (!config.suggestCodeTuneDuringBreaks || config.codeTunePermanentlyIgnored) {
      return;
    }

    // Send CodeTune suggestion to webview
    if (state.activityBarProvider) {
      const messages = [
        "🎵 How about some peaceful Quran recitation during your break?",
        "📖 Consider listening to the Quran to enrich your wellness break 😌",
        "🕌 Your break could be enhanced with beautiful Quranic verses",
        "🎯 Would you like to listen to Quran while you rest?",
        "🌸 Some Quranic recitation might bring peace to your break time",
        "📿 Open CodeTune for spiritually refreshing break music",
        "🙏 Quran listening can add meaning to your well-deserved break"
      ];

      const message = messages[Math.floor(Math.random() * messages.length)];

      state.activityBarProvider.postMessage({
        command: 'showCodeTuneSuggestion',
        data: {
          message: message,
          codeTuneInstalled: codeTune.CodeTuneIntegration.isCodeTuneInstalled()
        }
      });
    }
  }).catch(error => {
    console.debug('CodeTune integration not available:', error);
  });
}
