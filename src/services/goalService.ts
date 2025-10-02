import * as vscode from 'vscode';
import { state } from '../models/state';
import { WellnessGoal } from '../types';

/**
 * Goal Service - Handles tracking and management of wellness goals
 * Separated for easier maintenance and testing
 */

// Today's daily goals counters (separate from all-time stats)
let todayBreaksCount = 0;
let todayExerciseCount = 0;
let todayEyeBreakCount = 0;

export function initializeGoals(): void {
  if (state.wellnessGoals.length === 0) {
    // Create default daily goals - always start with 0 for today's progress
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    state.wellnessGoals = [
      {
        id: 'daily-breaks',
        type: 'daily',
        category: 'breaks',
        target: 6,
        current: 0, // Start at 0 for today's progress
        description: 'Take 6 breaks throughout the day',
        deadline: tomorrow,
        completed: false,
        createdAt: today,
        reward: '🏆 Healthy Day Badge'
      },
      {
        id: 'daily-exercises',
        type: 'daily',
        category: 'exercises',
        target: 3,
        current: 0, // Start at 0 for today's progress
        description: 'Complete 3 wellness exercises',
        deadline: tomorrow,
        completed: false,
        createdAt: today,
        reward: '💪 Fitness Warrior'
      },
      {
        id: 'screen-breaks',
        type: 'daily',
        category: 'screen-breaks',
        target: 4,
        current: 0,
        description: 'Take 4 eye breaks during screen time',
        deadline: tomorrow,
        completed: false,
        createdAt: today,
        reward: '👁️ Vision Protector'
      }
    ];
  }
  syncCountersFromGoals();
}

// Sync local counters from saved goals to maintain progress continuity
function syncCountersFromGoals(): void {
  const today = new Date();
  const todayStr = today.toDateString();

  state.wellnessGoals.forEach(goal => {
    if (goal.type === 'daily' && goal.deadline) {
      const deadline = new Date(goal.deadline);

      // Only sync if the goal is for today (deadline is tomorrow, so today and tomorrow match)
      if (today.toDateString() === deadline.toDateString() ||
          Math.abs(today.getTime() - deadline.getTime()) < 24 * 60 * 60 * 1000) {
        // Don't overwrite if it's been reset for a new day
        if (goal.current > 0 && !goal.completed) {
          switch (goal.category) {
            case 'breaks':
              if (todayBreaksCount === 0) {
                todayBreaksCount = goal.current;
              }
              break;
            case 'exercises':
              // Exercise progress is tracked per completion, not incrementing a counter
              // The current value is already saved/loaded properly
              break;
            case 'screen-breaks':
              // Eye breaks are incremented directly, current value is saved/loaded
              if (goal.current > todayEyeBreakCount) {
                todayEyeBreakCount = goal.current;
              }
              break;
          }
        }
      }
    }
  });
}

export function updateGoalsProgress(): void {
  const today = new Date();

  // Update daily goals progress
  state.wellnessGoals.forEach(goal => {
    if (goal.type === 'daily') {
      switch (goal.category) {
        case 'breaks':
          goal.current = todayBreaksCount;
          break;
        case 'exercises':
          // Track actual exercise completions (initialize and maintain current progress)
          // Progress will be updated when exercises are actually completed
          break;
        case 'screen-breaks':
          // Track actual eye break completions
          // Progress will be updated when eye breaks are actually taken
          break;
      }

      goal.completed = goal.current >= goal.target;

      // Check if we need to reset goals for a new day
      // Reset at midnight (not just when deadline passes)
      const goalDeadline = new Date(goal.deadline);
      const now = new Date();
      if (now.toDateString() !== goalDeadline.toDateString() && now >= goalDeadline) {
        // Reset goal for new day
        goal.deadline = new Date(today);
        goal.deadline.setDate(today.getDate() + 1);
        goal.current = 0;
        goal.completed = false;

        // Reset today's counters
        todayBreaksCount = 0;
        todayExerciseCount = 0;
        todayEyeBreakCount = 0;
      }
    }
  });
}

export function incrementExerciseProgress(): void {
  const exerciseGoal = state.wellnessGoals.find(g => g.category === 'exercises' && g.type === 'daily');
  if (exerciseGoal && !exerciseGoal.completed) {
    exerciseGoal.current = Math.min(exerciseGoal.current + 1, exerciseGoal.target);
    updateGoalsProgress();

    // Check if goal is now completed
    if (exerciseGoal.completed) {
      vscode.window.showInformationMessage(
        `🎉 Exercise Goal Completed: ${exerciseGoal.description}`,
        `Great job staying active!`
      );
    }

    // Save to storage
    if (state.storage) {
      state.storage.saveWellnessGoals(state.wellnessGoals);
    }
  }
}

export function incrementBreakProgress(): void {
  const breakGoal = state.wellnessGoals.find(g => g.category === 'breaks' && g.type === 'daily');
  if (breakGoal && !breakGoal.completed) {
    todayBreaksCount++;
    breakGoal.current = todayBreaksCount;
    updateGoalsProgress();

    // Check if goal is now completed
    if (breakGoal.completed) {
      vscode.window.showInformationMessage(
        `🏆 Break Goal Completed: ${breakGoal.description}`,
        `You maintained great balance today!`
      );
    }

    // Save to storage
    if (state.storage) {
      state.storage.saveWellnessGoals(state.wellnessGoals);
    }
  }
}

export function incrementEyeBreakProgress(): void {
  const eyeBreakGoal = state.wellnessGoals.find(g => g.category === 'screen-breaks' && g.type === 'daily');
  if (eyeBreakGoal && !eyeBreakGoal.completed) {
    eyeBreakGoal.current = Math.min(eyeBreakGoal.current + 1, eyeBreakGoal.target);
    updateGoalsProgress();

    // Check if goal is now completed
    if (eyeBreakGoal.completed) {
      vscode.window.showInformationMessage(
        `👁️ Eye Care Goal Completed: ${eyeBreakGoal.description}`,
        `Your eyes will thank you!`
      );
    }

    // Save to storage
    if (state.storage) {
      state.storage.saveWellnessGoals(state.wellnessGoals);
    }
  }
}

export function checkGoalAchievements(): void {
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
}

export function updateChallengeProgress(): void {
  // Update challenge progress
  state.wellnessChallenges.forEach(challenge => {
    const completedGoals = challenge.goals.filter(g => g.completed).length;
    challenge.progress = Math.round((completedGoals / challenge.goals.length) * 100);
    challenge.completed = challenge.progress >= 100;
  });
}

export function getGoals(): WellnessGoal[] {
  return state.wellnessGoals;
}

export function getCompletedGoalsToday(): number {
  return state.wellnessGoals.filter(g => g.completed && g.type === 'daily').length;
}
