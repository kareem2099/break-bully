import * as vscode from 'vscode';
import { BreakStats, WellnessGoal, WellnessChallenge, CustomExercise, SmartNotificationsData, ScreenTimeStats, Achievement, DailyWellnessData } from '../types';

export class ExtensionStorage {
  constructor(private context: vscode.ExtensionContext) {}

  // Break Statistics
  saveBreakStats(stats: BreakStats): void {
    this.context.globalState.update('breakStats', stats);
  }

  loadBreakStats(): BreakStats {
    const defaultStats: BreakStats = {
      breaksTaken: 0,
      timeSaved: 0,
      streakDays: 0,
      lastBreakDate: null
    };

    return this.context.globalState.get('breakStats', defaultStats);
  }

  // Wellness Goals
  saveWellnessGoals(goals: WellnessGoal[]): void {
    this.context.globalState.update('wellnessGoals', goals);
  }

  loadWellnessGoals(): WellnessGoal[] {
    return this.context.globalState.get('wellnessGoals', []);
  }

  // Wellness Challenges
  saveWellnessChallenges(challenges: WellnessChallenge[]): void {
    this.context.globalState.update('wellnessChallenges', challenges);
  }

  loadWellnessChallenges(): WellnessChallenge[] {
    return this.context.globalState.get('wellnessChallenges', []);
  }

  // Custom Exercises
  saveCustomExercises(exercises: CustomExercise[]): void {
    this.context.globalState.update('customExercises', exercises);
  }

  loadCustomExercises(): CustomExercise[] {
    return this.context.globalState.get('customExercises', []);
  }

  // Smart Notifications Data
  saveSmartNotifications(data: SmartNotificationsData): void {
    this.context.globalState.update('smartNotifications', data);
  }

  loadSmartNotifications(): SmartNotificationsData {
    const defaultData: SmartNotificationsData = {
      lastBreakResponseTime: 0,
      breakAcceptanceRate: 0.5,
      preferredBreakTimes: [],
      notificationHistory: [],
      userPatterns: {
        productiveHours: [],
        breakFrequency: 30,
        responseTimeAverage: 30000
      }
    };

    return this.context.globalState.get('smartNotifications', defaultData);
  }

  // Screen Time Statistics
  saveScreenTimeStats(stats: ScreenTimeStats): void {
    this.context.globalState.update('screenTimeStats', stats);
  }

  loadScreenTimeStats(): ScreenTimeStats {
    const defaultStats: ScreenTimeStats = {
      sessionStartTime: null,
      totalScreenTimeToday: 0,
      continuousScreenTime: 0,
      lastBreakTime: null,
      lastActivityTime: new Date(),
      isIdle: false,
      codingSessionStart: null,
      longCodingSessionDetected: false
    };

    return this.context.globalState.get('screenTimeStats', defaultStats);
  }

  // Achievements
  saveAchievements(achievements: Achievement[]): void {
    this.context.globalState.update('achievements', achievements);
  }

  loadAchievements(): Achievement[] {
    return this.context.globalState.get('achievements', []);
  }

  // Daily Wellness Data
  saveDailyWellnessData(data: DailyWellnessData[]): void {
    this.context.globalState.update('dailyWellnessData', data);
  }

  loadDailyWellnessData(): DailyWellnessData[] {
    return this.context.globalState.get('dailyWellnessData', []);
  }

  // Data Export/Import for backup
  exportAllData(): any {
    return {
      breakStats: this.loadBreakStats(),
      wellnessGoals: this.loadWellnessGoals(),
      wellnessChallenges: this.loadWellnessChallenges(),
      customExercises: this.loadCustomExercises(),
      smartNotifications: this.loadSmartNotifications(),
      screenTimeStats: this.loadScreenTimeStats(),
      achievements: this.loadAchievements(),
      dailyWellnessData: this.loadDailyWellnessData(),
      exportDate: new Date().toISOString(),
      version: '1.0.0'
    };
  }

  importAllData(data: any): boolean {
    try {
      if (data.breakStats) this.saveBreakStats(data.breakStats);
      if (data.wellnessGoals) this.saveWellnessGoals(data.wellnessGoals);
      if (data.wellnessChallenges) this.saveWellnessChallenges(data.wellnessChallenges);
      if (data.customExercises) this.saveCustomExercises(data.customExercises);
      if (data.smartNotifications) this.saveSmartNotifications(data.smartNotifications);
      if (data.screenTimeStats) this.saveScreenTimeStats(data.screenTimeStats);
      if (data.achievements) this.saveAchievements(data.achievements);
      if (data.dailyWellnessData) this.saveDailyWellnessData(data.dailyWellnessData);

      return true;
    } catch (error) {
      console.error('Failed to import data:', error);
      return false;
    }
  }

  // Clear all data (for reset functionality)
  clearAllData(): void {
    this.context.globalState.update('breakStats', undefined);
    this.context.globalState.update('wellnessGoals', undefined);
    this.context.globalState.update('wellnessChallenges', undefined);
    this.context.globalState.update('customExercises', undefined);
    this.context.globalState.update('smartNotifications', undefined);
    this.context.globalState.update('screenTimeStats', undefined);
    this.context.globalState.update('achievements', undefined);
    this.context.globalState.update('dailyWellnessData', undefined);
  }

  // Get storage info
  getStorageInfo(): any {
    return {
      keys: this.context.globalState.keys(),
      lastUpdate: new Date().toISOString()
    };
  }
}
