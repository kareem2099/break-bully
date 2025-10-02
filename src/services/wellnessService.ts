import * as vscode from 'vscode';
import { getConfiguration } from '../core/configuration';
import { state } from '../models/state';
import { WellnessGoal, WellnessChallenge, ExerciseCategory, DifficultyLevel, CustomExercise, DailyWellnessData } from '../types';

export function initializeWellnessGoals(): void {
  // Import and call the goal service initialization
  import('./goalService').then(goalService => {
    goalService.initializeGoals();
  });
}

export function initializeWellnessChallenges(): void {
  if (state.wellnessChallenges.length === 0) {
    const today = new Date();
    const challengeEnd = new Date(today);
    challengeEnd.setDate(today.getDate() + 7); // 7-day challenge

    state.wellnessChallenges = [
      {
        id: 'wellness-week',
        name: 'Wellness Warrior Week',
        description: 'Complete daily wellness goals for 7 consecutive days',
        duration: 7,
        goals: state.wellnessGoals,
        startDate: today,
        endDate: challengeEnd,
        completed: false,
        progress: 0,
        reward: '🌟 Wellness Champion Trophy'
      }
    ];
  }
}

export function updateWellnessGoals(): void {
  // Update goal progress using the goal service
  import('./goalService').then(goalService => {
    goalService.updateGoalsProgress();
    goalService.updateChallengeProgress();
  });
}

export function checkGoalAchievements(): void {
  // Use the goal service for checking achievements
  import('./goalService').then(goalService => {
    goalService.checkGoalAchievements();
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

export function startScreenTimeTracking(): void {
  const config = getConfiguration();

  // Initialize session if not started
  if (!state.screenTimeStats.sessionStartTime) {
    state.screenTimeStats.sessionStartTime = new Date();
    state.screenTimeStats.lastBreakTime = new Date();
  }

  // Clear existing timer
  if (state.screenTimeTimer) {
    clearInterval(state.screenTimeTimer);
  }

  // Track screen time every minute (always enabled for analytics)
  state.screenTimeTimer = setInterval(() => {
    const now = new Date();
    state.screenTimeStats.totalScreenTimeToday += 1; // Add 1 minute
    state.screenTimeStats.continuousScreenTime += 1; // Add 1 minute

    // Save screen time stats periodically (every minute to ensure persistence)
    if (state.storage) {
      state.storage.saveScreenTimeStats(state.screenTimeStats);
    }

    // Check if we should suggest an eye break (only if eye exercises are enabled)
    if (config.enableEyeExercises && state.screenTimeStats.continuousScreenTime >= config.screenBreakInterval) {
      suggestEyeBreak();
    }

    // Reset continuous time at midnight
    const today = now.toDateString();
    const sessionDay = state.screenTimeStats.sessionStartTime?.toDateString();
    if (sessionDay && today !== sessionDay) {
      state.screenTimeStats.totalScreenTimeToday = 0;
      state.screenTimeStats.sessionStartTime = now;
      // Save the reset stats immediately
      if (state.storage) {
        state.storage.saveScreenTimeStats(state.screenTimeStats);
      }
    }
  }, 60000); // Every minute
}

export function stopScreenTimeTracking(): void {
  if (state.screenTimeTimer) {
    clearInterval(state.screenTimeTimer);
    state.screenTimeTimer = undefined;
  }
}

function suggestEyeBreak(): void {
  const config = getConfiguration();
  if (!config.enableEyeExercises || !config.showNotification) return;

  // Only suggest once per break interval
  const timeSinceLastBreak = state.screenTimeStats.lastBreakTime instanceof Date ?
    (Date.now() - state.screenTimeStats.lastBreakTime.getTime()) / (1000 * 60) : 0;

  if (timeSinceLastBreak < config.screenBreakInterval) return;

  vscode.window.showInformationMessage(
    `👁️ Time for an eye break! You've been staring at screens for ${state.screenTimeStats.continuousScreenTime} minutes.`,
    'Take Eye Break',
    'Remind Me Later'
  ).then(selection => {
    if (selection === 'Take Eye Break') {
      import('./exerciseService').then(exerciseService => {
        exerciseService.showEyeExercise();
      });
    }
  });
}

export function resetScreenTimeOnBreak(): void {
  state.screenTimeStats.continuousScreenTime = 0;
  state.screenTimeStats.lastBreakTime = new Date();
}

export function setupActivityMonitoring(context: vscode.ExtensionContext): void {
  // Monitor text document changes (only actual content changes, not just cursor movement)
  vscode.workspace.onDidChangeTextDocument((event) => {
    // Only count as activity if there are actual content changes (not just cursor/selection changes)
    const hasContentChanges = event.contentChanges.some(change =>
      change.text.length > 0 || change.rangeLength > 0
    );

    if (hasContentChanges) {
      updateActivityTime();
    }
  }, null, context.subscriptions);

  // Monitor when windows become focused (but not other window state changes)
  vscode.window.onDidChangeWindowState((windowState) => {
    if (windowState.focused) {
      // Only update activity time if window just became focused and we were previously idle
      // This prevents constant activity updates just from having VSCode open
      try {
        const lastActivityTime = state.screenTimeStats.lastActivityTime;
        const timeSinceLastActivity = lastActivityTime instanceof Date ?
          (Date.now() - lastActivityTime.getTime()) / (1000 * 60) : 0;

        // Only count as activity if it's been more than 10 minutes since last activity
        // This prevents window focus from constantly resetting idle state
        if (timeSinceLastActivity > 10) {
          updateActivityTime();
        }
      } catch (error) {
        console.debug('Error handling window focus change:', error);
        // Continue without updating activity time if there's an error
      }
    }
  }, null, context.subscriptions);

  // Check for idle state every 30 seconds
  setInterval(checkIdleState, 30000);
}

function updateActivityTime(): void {
  const now = new Date();
  state.screenTimeStats.lastActivityTime = now;
  state.screenTimeStats.isIdle = false;

  // Start coding session if not already started
  if (!state.screenTimeStats.codingSessionStart) {
    state.screenTimeStats.codingSessionStart = now;
  }

  // Check if this is a long coding session
  if (state.screenTimeStats.codingSessionStart) {
    const sessionDuration = (now.getTime() - state.screenTimeStats.codingSessionStart.getTime()) / (1000 * 60); // minutes
    if (sessionDuration >= 90 && !state.screenTimeStats.longCodingSessionDetected) { // 90 minutes
      state.screenTimeStats.longCodingSessionDetected = true;
      suggestLongSessionBreak();
    }
  }
}

function checkIdleState(): void {
  const now = new Date();
  const lastActivityTime = state.screenTimeStats.lastActivityTime;
  const timeSinceLastActivity = lastActivityTime instanceof Date ?
    (now.getTime() - lastActivityTime.getTime()) / (1000 * 60) : 0; // minutes

  // Consider idle if no activity for 5 seconds for coding session (pause timer)
  const timeSinceLastActivitySeconds = lastActivityTime instanceof Date ?
    (now.getTime() - lastActivityTime.getTime()) / 1000 : 0; // seconds

  if (timeSinceLastActivitySeconds >= 5) {
    // Reset coding session after 5 seconds of no activity
    state.screenTimeStats.codingSessionStart = null;
    state.screenTimeStats.longCodingSessionDetected = false;
  }

  // Consider idle if no activity for 5 minutes (status change)
  if (timeSinceLastActivity >= 5) {
    state.screenTimeStats.isIdle = true;
  } else {
    state.screenTimeStats.isIdle = false;
  }
}

function suggestLongSessionBreak(): void {
  const config = getConfiguration();
  if (!config.showNotification) return;

  vscode.window.showInformationMessage(
    `🏃‍♂️ You've been coding for over 90 minutes! Time for a longer break to recharge.`,
    'Take 15-Minute Break',
    'Take 5-Minute Break',
    'Remind Me Later'
  ).then(selection => {
    if (selection === 'Take 15-Minute Break') {
      import('./annoyanceService').then(annoyanceService => {
        annoyanceService.pauseReminders(15);
      });
      vscode.window.showInformationMessage('Great! Taking a 15-minute break. Your brain will thank you! 🧠');
    } else if (selection === 'Take 5-Minute Break') {
      import('./annoyanceService').then(annoyanceService => {
        annoyanceService.pauseReminders(5);
      });
      vscode.window.showInformationMessage('Taking a quick 5-minute break. Better than nothing! 👍');
    }
  });
}

export function incrementExerciseProgress(): void {
  // Use the goal service for incrementing exercise progress
  import('./goalService').then(goalService => {
    goalService.incrementExerciseProgress();
  });
}

export function incrementEyeBreakProgress(): void {
  // Use the goal service for incrementing eye break progress
  import('./goalService').then(goalService => {
    goalService.incrementEyeBreakProgress();
  });
}

export function startUIUpdates(): void {
  const config = getConfiguration();

  // Update UI every 5 seconds with screen time and activity status for better responsiveness
  setInterval(() => {
    if (state.activityBarProvider) {
      if (config.enableEyeExercises) {
        state.activityBarProvider.updateScreenTime();
        state.activityBarProvider.updateActivityStatus();
      }
      if (config.enableGoals) {
        updateWellnessGoals(); // Update goals and challenges progress
        state.activityBarProvider.updateWellnessGoals();
        state.activityBarProvider.updateWellnessChallenges();
      }
    }
  }, 5000); // Every 5 seconds
}

// Daily Data Recording
export function recordDailyWellnessData(): void {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

  // Check if we already have data for today
  const existingDataIndex = state.dailyWellnessData.findIndex(data => data.date === today);

  const dailyData: DailyWellnessData = {
    date: today,
    breaksTaken: state.breakStats.breaksTaken,
    screenTimeMinutes: state.screenTimeStats.totalScreenTimeToday,
    goalsCompleted: state.wellnessGoals.filter(g => g.completed && g.type === 'daily').length,
    exercisesCompleted: Math.floor(state.wellnessGoals
      .filter(g => g.category === 'exercises')
      .reduce((sum, g) => sum + g.current, 0)),
    achievementsUnlocked: state.achievements.filter(a => {
      if (!a.unlockedAt) return false;
      const unlockDate = a.unlockedAt.toISOString().split('T')[0];
      return unlockDate === today;
    }).length,
    streakDays: state.breakStats.streakDays
  };

  if (existingDataIndex >= 0) {
    // Update existing data
    state.dailyWellnessData[existingDataIndex] = dailyData;
  } else {
    // Add new data
    state.dailyWellnessData.push(dailyData);
  }

  // Keep only last 90 days to prevent storage bloat
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const cutoffDate = ninetyDaysAgo.toISOString().split('T')[0];

  state.dailyWellnessData = state.dailyWellnessData.filter(data => data.date >= cutoffDate);

  // Save to storage
  if (state.storage) {
    state.storage.saveDailyWellnessData(state.dailyWellnessData);
  }
}

export function getDailyWellnessData(startDate?: Date, endDate?: Date): DailyWellnessData[] {
  let filteredData = state.dailyWellnessData;

  if (startDate) {
    const startDateStr = startDate.toISOString().split('T')[0];
    filteredData = filteredData.filter(data => data.date >= startDateStr);
  }

  if (endDate) {
    const endDateStr = endDate.toISOString().split('T')[0];
    filteredData = filteredData.filter(data => data.date <= endDateStr);
  }

  // Sort by date ascending
  return filteredData.sort((a, b) => a.date.localeCompare(b.date));
}

export function setupDailyDataRecording(context: vscode.ExtensionContext): void {
  // Calculate milliseconds until midnight
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0); // Next midnight
  const timeUntilMidnight = midnight.getTime() - now.getTime();

  // Set up timer for first midnight recording
  const midnightTimer = setTimeout(() => {
    recordDailyWellnessData();

    // Set up recurring daily timer (every 24 hours)
    const dailyTimer = setInterval(() => {
      recordDailyWellnessData();
    }, 24 * 60 * 60 * 1000); // 24 hours in milliseconds

    // Store the timer for cleanup
    context.subscriptions.push({
      dispose: () => clearInterval(dailyTimer)
    });
  }, timeUntilMidnight);

  // Store the initial timer for cleanup
  context.subscriptions.push({
    dispose: () => clearTimeout(midnightTimer)
  });
}

// Custom Goals Management
export function createCustomGoal(goalData: {
  description: string;
  target: number;
  type: 'daily' | 'weekly' | 'custom';
  customType?: string;
  customUnit?: string;
  reward?: string;
}): WellnessGoal {
  const now = new Date();
  let deadline = new Date(now);

  // Set deadline based on type
  switch (goalData.type) {
    case 'daily':
      deadline.setDate(deadline.getDate() + 1);
      break;
    case 'weekly':
      deadline.setDate(deadline.getDate() + 7);
      break;
    case 'custom':
      // Custom goals can have flexible deadlines
      deadline.setDate(deadline.getDate() + 30); // Default 30 days
      break;
  }

  const customGoal: WellnessGoal = {
    id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: goalData.type,
    category: 'custom',
    target: goalData.target,
    current: 0,
    description: goalData.description,
    deadline: deadline,
    completed: false,
    createdAt: now,
    ...(goalData.reward && { reward: goalData.reward }),
    isCustom: true,
    ...(goalData.customType && { customType: goalData.customType }),
    ...(goalData.customUnit && { customUnit: goalData.customUnit })
  };

  // Add to state
  state.wellnessGoals.push(customGoal);

  // Save to storage
  if (state.storage) {
    state.storage.saveWellnessGoals(state.wellnessGoals);
  }

  // Update UI
  if (state.activityBarProvider) {
    state.activityBarProvider.updateWellnessGoals();
  }

  return customGoal;
}

export function updateCustomGoalProgress(goalId: string, newProgress: number): void {
  const goal = state.wellnessGoals.find(g => g.id === goalId);
  if (!goal || !goal.isCustom) return;

  goal.current = Math.min(newProgress, goal.target);
  goal.completed = goal.current >= goal.target;

  // Save to storage
  if (state.storage) {
    state.storage.saveWellnessGoals(state.wellnessGoals);
  }

  // Update UI
  if (state.activityBarProvider) {
    state.activityBarProvider.updateWellnessGoals();
  }

  // Check for achievements
  checkGoalAchievements();
}

export function deleteCustomGoal(goalId: string): boolean {
  const goalIndex = state.wellnessGoals.findIndex(g => g.id === goalId);
  if (goalIndex === -1 || !state.wellnessGoals[goalIndex].isCustom) return false;

  state.wellnessGoals.splice(goalIndex, 1);

  // Save to storage
  if (state.storage) {
    state.storage.saveWellnessGoals(state.wellnessGoals);
  }

  // Update UI
  if (state.activityBarProvider) {
    state.activityBarProvider.updateWellnessGoals();
  }

  return true;
}

export function getCustomGoals(): WellnessGoal[] {
  return state.wellnessGoals.filter(g => g.isCustom);
}

// Challenge Mode
export function createChallenge(challengeData: {
  name: string;
  description: string;
  duration: number; // days
  goals: WellnessGoal[];
  reward: string;
}): WellnessChallenge {
  const now = new Date();
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + challengeData.duration);

  const challenge: WellnessChallenge = {
    id: `challenge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: challengeData.name,
    description: challengeData.description,
    duration: challengeData.duration,
    goals: challengeData.goals,
    startDate: now,
    endDate: endDate,
    completed: false,
    progress: 0,
    reward: challengeData.reward
  };

  // Add to state
  state.wellnessChallenges.push(challenge);

  // Save to storage
  if (state.storage) {
    state.storage.saveWellnessChallenges(state.wellnessChallenges);
  }

  // Update UI
  if (state.activityBarProvider) {
    state.activityBarProvider.updateWellnessChallenges();
  }

  return challenge;
}

export function getActiveChallenges(): WellnessChallenge[] {
  const now = new Date();
  return state.wellnessChallenges.filter(c =>
    c.startDate <= now && c.endDate >= now && !c.completed
  );
}

export function getCompletedChallenges(): WellnessChallenge[] {
  return state.wellnessChallenges.filter(c => c.completed);
}

// Wellness Insights & Analytics
export function getWellnessInsights(timeRange: 'today' | 'week' | 'month' | 'all' = 'week'): any {
  const now = new Date();
  let startDate = new Date();

  switch (timeRange) {
    case 'today':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Start of today
      break;
    case 'week':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case 'month':
      startDate.setDate(startDate.getDate() - 30);
      break;
    case 'all':
      startDate = new Date('2024-01-01'); // Arbitrary start date
      break;
  }

  // Get historical daily data for the time range
  const dailyData = getDailyWellnessData(startDate, now);

  // Calculate insights from historical data
  const insights = {
    timeRange,
    startDate,
    endDate: now,

    // Daily breakdowns
    dailyBreakdown: dailyData,

    // Break patterns
    totalBreaks: dailyData.reduce((sum, day) => sum + day.breaksTaken, 0),
    averageBreaksPerDay: dailyData.length > 0 ? Math.round((dailyData.reduce((sum, day) => sum + day.breaksTaken, 0) / dailyData.length) * 10) / 10 : 0,
    longestStreak: Math.max(...dailyData.map(day => day.streakDays), 0),

    // Goal completion
    totalGoalsCompleted: dailyData.reduce((sum, day) => sum + day.goalsCompleted, 0),
    goalCompletionRate: dailyData.length > 0 ? Math.round((dailyData.reduce((sum, day) => sum + day.goalsCompleted, 0) / dailyData.length) * 100) / 100 : 0,

    // Exercise patterns
    totalExercises: dailyData.reduce((sum, day) => sum + day.exercisesCompleted, 0),
    averageExercisesPerDay: dailyData.length > 0 ? Math.round((dailyData.reduce((sum, day) => sum + day.exercisesCompleted, 0) / dailyData.length) * 10) / 10 : 0,

    // Screen time trends
    totalScreenTimeMinutes: dailyData.reduce((sum, day) => sum + day.screenTimeMinutes, 0),
    averageScreenTimePerDay: dailyData.length > 0 ? Math.round(dailyData.reduce((sum, day) => sum + day.screenTimeMinutes, 0) / dailyData.length) : 0,

    // Achievement progress
    totalAchievementsUnlocked: dailyData.reduce((sum, day) => sum + day.achievementsUnlocked, 0),
    achievementsPerDay: dailyData.length > 0 ? Math.round((dailyData.reduce((sum, day) => sum + day.achievementsUnlocked, 0) / dailyData.length) * 100) / 100 : 0,

    // Trends analysis
    trends: calculateTrendsFromDailyData(dailyData),

    // Current day comparison
    currentDay: {
      breaksTaken: state.breakStats.breaksTaken,
      screenTimeMinutes: state.screenTimeStats.totalScreenTimeToday,
      goalsCompleted: state.wellnessGoals.filter(g => g.completed && g.type === 'daily').length,
      exercisesCompleted: Math.floor(state.wellnessGoals
        .filter(g => g.category === 'exercises')
        .reduce((sum, g) => sum + g.current, 0)),
      streakDays: state.breakStats.streakDays
    },

    // Recommendations
    recommendations: generateRecommendationsFromDailyData(dailyData)
  };

  return insights;
}

function calculateAverageBreaksPerDay(startDate: Date): number {
  const daysSinceStart = Math.max(1, Math.floor((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
  return Math.round((state.breakStats.breaksTaken / daysSinceStart) * 10) / 10;
}

function calculateGoalCompletionRate(startDate: Date): number {
  const relevantGoals = state.wellnessGoals.filter(g => g.createdAt >= startDate);
  if (relevantGoals.length === 0) return 0;

  const completedGoals = relevantGoals.filter(g => g.completed).length;
  return Math.round((completedGoals / relevantGoals.length) * 100);
}

function calculateAverageScreenTime(startDate: Date): number {
  // This would need historical screen time data
  // For now, return current daily average
  return Math.round(state.screenTimeStats.totalScreenTimeToday / 24 * 60); // Convert to minutes
}

function calculateTrends(startDate: Date): any {
  // Calculate trends over time
  const recentGoals = state.wellnessGoals.filter(g => g.createdAt >= startDate);
  const recentAchievements = state.achievements.filter(a => a.unlockedAt && a.unlockedAt >= startDate);

  return {
    goalCompletionTrend: recentGoals.length > 0 ? 'increasing' : 'stable',
    achievementUnlockTrend: recentAchievements.length > 0 ? 'increasing' : 'stable',
    breakConsistency: state.breakStats.streakDays > 3 ? 'excellent' : state.breakStats.streakDays > 1 ? 'good' : 'needs_improvement'
  };
}

function calculateTrendsFromDailyData(dailyData: DailyWellnessData[]): any {
  if (dailyData.length < 2) {
    return {
      goalCompletionTrend: 'stable',
      achievementUnlockTrend: 'stable',
      breakConsistency: 'stable',
      screenTimeTrend: 'stable'
    };
  }

  // Calculate trends by comparing first half vs second half of data
  const midpoint = Math.floor(dailyData.length / 2);
  const firstHalf = dailyData.slice(0, midpoint);
  const secondHalf = dailyData.slice(midpoint);

  const firstHalfAvgBreaks = firstHalf.reduce((sum, day) => sum + day.breaksTaken, 0) / firstHalf.length;
  const secondHalfAvgBreaks = secondHalf.reduce((sum, day) => sum + day.breaksTaken, 0) / secondHalf.length;

  const firstHalfAvgGoals = firstHalf.reduce((sum, day) => sum + day.goalsCompleted, 0) / firstHalf.length;
  const secondHalfAvgGoals = secondHalf.reduce((sum, day) => sum + day.goalsCompleted, 0) / secondHalf.length;

  const firstHalfAvgScreenTime = firstHalf.reduce((sum, day) => sum + day.screenTimeMinutes, 0) / firstHalf.length;
  const secondHalfAvgScreenTime = secondHalf.reduce((sum, day) => sum + day.screenTimeMinutes, 0) / secondHalf.length;

  const getTrend = (first: number, second: number): string => {
    const diff = ((second - first) / first) * 100;
    if (diff > 10) return 'increasing';
    if (diff < -10) return 'decreasing';
    return 'stable';
  };

  return {
    goalCompletionTrend: getTrend(firstHalfAvgGoals, secondHalfAvgGoals),
    breakConsistency: getTrend(firstHalfAvgBreaks, secondHalfAvgBreaks),
    screenTimeTrend: getTrend(firstHalfAvgScreenTime, secondHalfAvgScreenTime),
    overallProgress: dailyData.length >= 7 ? 'good' : 'building'
  };
}

function generateRecommendations(): string[] {
  const recommendations = [];

  if (state.breakStats.streakDays < 3) {
    recommendations.push("Try to maintain a 3-day break streak for better consistency!");
  }

  if (state.wellnessGoals.filter(g => g.completed).length < 5) {
    recommendations.push("Complete more wellness goals to build healthy habits.");
  }

  if (state.screenTimeStats.totalScreenTimeToday > 480) { // 8 hours
    recommendations.push("Consider taking more frequent breaks to reduce screen time.");
  }

  const unlockedAchievements = state.achievements.filter(a => a.unlockedAt).length;
  if (unlockedAchievements < state.achievements.length * 0.5) {
    recommendations.push("You're making great progress! Keep working toward more achievements.");
  }

  return recommendations.length > 0 ? recommendations : ["You're doing great! Keep up the excellent wellness habits."];
}

function generateRecommendationsFromDailyData(dailyData: DailyWellnessData[]): string[] {
  const recommendations = [];

  if (dailyData.length === 0) {
    return ["Start tracking your daily wellness activities to see insights!"];
  }

  const avgBreaks = dailyData.reduce((sum, day) => sum + day.breaksTaken, 0) / dailyData.length;
  const avgGoals = dailyData.reduce((sum, day) => sum + day.goalsCompleted, 0) / dailyData.length;
  const avgScreenTime = dailyData.reduce((sum, day) => sum + day.screenTimeMinutes, 0) / dailyData.length;

  if (avgBreaks < 4) {
    recommendations.push("Consider increasing your daily break frequency for better health.");
  }

  if (avgGoals < 2) {
    recommendations.push("Try completing more wellness goals daily to build better habits.");
  }

  if (avgScreenTime > 480) { // 8 hours
    recommendations.push("Your average screen time is high. Consider more frequent breaks.");
  }

  const recentDays = dailyData.slice(-7); // Last 7 days
  if (recentDays.length >= 7) {
    const recentAvgBreaks = recentDays.reduce((sum, day) => sum + day.breaksTaken, 0) / recentDays.length;
    const earlierAvgBreaks = dailyData.slice(0, -7).reduce((sum, day) => sum + day.breaksTaken, 0) / Math.max(1, dailyData.length - 7);

    if (recentAvgBreaks < earlierAvgBreaks * 0.8) {
      recommendations.push("Your break frequency has decreased recently. Try to get back on track!");
    }
  }

  const maxStreak = Math.max(...dailyData.map(day => day.streakDays));
  if (maxStreak < 5 && dailyData.length > 14) {
    recommendations.push("Building longer break streaks will improve your consistency!");
  }

  return recommendations.length > 0 ? recommendations : ["You're doing great! Keep up the excellent wellness habits."];
}

// Custom Exercises Management
export function createCustomExercise(exerciseData: {
  name: string;
  duration: string;
  instructions: string;
  steps?: string[];
  category: ExerciseCategory;
  difficulty: DifficultyLevel;
}): CustomExercise {
  const customExercise: CustomExercise = {
    id: `custom-exercise-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: exerciseData.name,
    duration: exerciseData.duration,
    instructions: exerciseData.instructions,
    steps: exerciseData.steps || [],
    category: exerciseData.category,
    difficulty: exerciseData.difficulty,
    createdBy: 'user',
    favorite: false,
    createdAt: new Date(),
    usageCount: 0
  };

  // Add to state
  state.customExercises.push(customExercise);

  // Save to storage
  if (state.storage) {
    state.storage.saveCustomExercises(state.customExercises);
  }

  return customExercise;
}

export function getCustomExercises(): CustomExercise[] {
  return state.customExercises.filter(e => e.createdBy === 'user');
}

export function toggleExerciseFavorite(exerciseId: string): boolean {
  const exercise = state.customExercises.find(e => e.id === exerciseId);
  if (!exercise) return false;

  exercise.favorite = !exercise.favorite;

  // Save to storage
  if (state.storage) {
    state.storage.saveCustomExercises(state.customExercises);
  }

  return exercise.favorite;
}

export function deleteCustomExercise(exerciseId: string): boolean {
  const exerciseIndex = state.customExercises.findIndex(e => e.id === exerciseId);
  if (exerciseIndex === -1 || state.customExercises[exerciseIndex].createdBy !== 'user') return false;

  state.customExercises.splice(exerciseIndex, 1);

  // Save to storage
  if (state.storage) {
    state.storage.saveCustomExercises(state.customExercises);
  }

  return true;
}
