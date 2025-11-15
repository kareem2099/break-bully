import * as vscode from 'vscode';
import { ExtensionStorage } from '../utils/storage';
import { BreakBullyActivityBarProvider, BreakStats, ScreenTimeStats, WellnessGoal, WellnessChallenge, CustomExercise, SmartNotificationsData, Achievement, DailyWellnessData } from '../types';
import { BaseActivityMonitor } from '../services/activityIntegration/baseActivityMonitor';

export const state = {
  reminderTimer: undefined as ReturnType<typeof setTimeout> | undefined,
  annoyanceTimer: undefined as ReturnType<typeof setTimeout> | undefined,
  screenTimeTimer: undefined as ReturnType<typeof setTimeout> | undefined,
  annoyanceLevel: 0,
  statusBarItem: undefined as vscode.StatusBarItem | undefined,
  nextReminderTime: null as number | null,
  storage: undefined as ExtensionStorage | undefined,
  activityBarProvider: null as BreakBullyActivityBarProvider | null,
  activityMonitor: undefined as BaseActivityMonitor | undefined,

  // Data loaded from storage
  breakStats: {
    breaksTaken: 0,
    timeSaved: 0,
    streakDays: 0,
    lastBreakDate: null
  } as BreakStats,
  screenTimeStats: {
    sessionStartTime: null,
    totalScreenTimeToday: 0,
    continuousScreenTime: 0,
    lastBreakTime: null,
    lastActivityTime: null,
    isIdle: false,
    codingSessionStart: null,
    longCodingSessionDetected: false
  } as ScreenTimeStats,
  smartNotifications: {
    lastBreakResponseTime: 0,
    breakAcceptanceRate: 0.5,
    preferredBreakTimes: [],
    notificationHistory: [],
    userPatterns: {
      productiveHours: [],
      breakFrequency: 30,
      responseTimeAverage: 30000
    }
  } as SmartNotificationsData,
  customExercises: [] as CustomExercise[],
  wellnessGoals: [] as WellnessGoal[],
  wellnessChallenges: [] as WellnessChallenge[],
  achievements: [] as Achievement[],
  dailyWellnessData: [] as DailyWellnessData[]
};

// Initialize storage when extension activates
export function initializeState(context: vscode.ExtensionContext): void {
  state.storage = new ExtensionStorage(context);

  // Load persistent data from storage
  state.breakStats = state.storage.loadBreakStats();
  state.screenTimeStats = state.storage.loadScreenTimeStats();
  state.smartNotifications = state.storage.loadSmartNotifications();
  state.customExercises = state.storage.loadCustomExercises();
  state.wellnessGoals = state.storage.loadWellnessGoals();
  state.wellnessChallenges = state.storage.loadWellnessChallenges();

  // Load achievements and convert unlockedAt strings back to Date objects
  state.achievements = state.storage.loadAchievements().map(achievement => ({
    ...achievement,
    unlockedAt: achievement.unlockedAt ? new Date(achievement.unlockedAt) : achievement.unlockedAt
  })) as Achievement[];

  state.dailyWellnessData = state.storage.loadDailyWellnessData();
}
