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

  // Update wellness goals
  updateWellnessGoals();
  checkGoalAchievements();

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

function updateWellnessGoals(): void {
  const today = new Date();

  // Update daily goals progress
  state.wellnessGoals.forEach(goal => {
    if (goal.type === 'daily') {
      switch (goal.category) {
        case 'breaks':
          goal.current = state.breakStats.breaksTaken;
          break;
        case 'exercises':
          // This would need to track exercise completions
          goal.current = Math.min(goal.current + 1, goal.target);
          break;
        case 'screen-breaks':
          // This would need to track eye break completions
          goal.current = Math.min(goal.current + 1, goal.target);
          break;
      }

      goal.completed = goal.current >= goal.target;

      // Check if goal deadline has passed (reset for new day)
      if (today > goal.deadline) {
        goal.deadline = new Date(today);
        goal.deadline.setDate(today.getDate() + 1);
        goal.current = 0;
        goal.completed = false;
      }
    }
  });

  // Update challenge progress
  state.wellnessChallenges.forEach(challenge => {
    const completedGoals = challenge.goals.filter(g => g.completed).length;
    challenge.progress = Math.round((completedGoals / challenge.goals.length) * 100);
    challenge.completed = challenge.progress >= 100;
  });
}

function checkGoalAchievements(): void {
  // Check for newly completed goals
  state.wellnessGoals.forEach(goal => {
    if (goal.completed) {
      vscode.window.showInformationMessage(
        `🎉 Goal Completed: ${goal.description}`,
        `Reward: ${goal.reward || 'Great job!'}`
      ).then(() => {
        // Send celebration to webview
        if (state.activityBarProvider) {
          state.activityBarProvider.postMessage({
            command: 'celebrateGoal',
            data: { message: `Goal Completed!\n${goal.description}` }
          });
        }
      });
    }
  });

  // Check for newly completed challenges
  state.wellnessChallenges.forEach(challenge => {
    if (challenge.completed) {
      vscode.window.showInformationMessage(
        `🏆 Challenge Completed: ${challenge.name}`,
        `Reward: ${challenge.reward}`
      );

      // Send celebration to webview
      if (state.activityBarProvider) {
        state.activityBarProvider.postMessage({
          command: 'celebrateAchievement',
          data: { achievement: challenge.name }
        });
      }
    }
  });
}
