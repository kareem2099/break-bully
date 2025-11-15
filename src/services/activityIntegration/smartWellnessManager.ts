import * as vscode from 'vscode';
import { ActivityEvent } from './activityTypes';
import { AdvancedNotificationManager, advancedNotificationManager } from './advancedNotificationManager';
import { showStretchExercise, showBreathingExercise, showEyeExercise, showWaterReminder } from '../exerciseService';
import { state } from '../../models/state';
import { getConfiguration } from '../../core/configuration';

/**
 * Smart Wellness Manager - Integrates ML-driven notifications with exercise triggering
 */
export class SmartWellnessManager {

  private isInitialized = false;
  private activityMonitoringInterval?: ReturnType<typeof setInterval>;

  constructor() {
    this.initializeSmartWellness();
  }

  /**
   * Initialize smart wellness monitoring
   */
  private initializeSmartWellness(): void {
    if (this.isInitialized) return;

    // Start monitoring for optimal wellness activity times
    this.startSmartWellnessMonitoring();

    this.isInitialized = true;
    console.log('Smart Wellness Manager initialized');
  }

  /**
   * Start monitoring for optimal wellness activity times using ML insights
   */
  private startSmartWellnessMonitoring(): void {
    // Check every 5 minutes for optimal wellness activities
    this.activityMonitoringInterval = setInterval(() => {
      this.checkAndTriggerOptimalWellnessActivities();
    }, 5 * 60 * 1000); // 5 minutes

    // Also check immediately on startup
    setTimeout(() => {
      this.checkAndTriggerOptimalWellnessActivities();
    }, 30000); // 30 seconds after startup
  }

  /**
   * Check current conditions and trigger optimal wellness activities based on ML insights
   */
  private checkAndTriggerOptimalWellnessActivities(): void {
    const config = getConfiguration();

    // Don't trigger during sleep hours (11 PM - 7 AM)
    const currentHour = new Date().getHours();
    if (currentHour < 7 || currentHour > 22) {
      return;
    }

    // Don't show notifications if disabled or user is idle/sleeping
    if (!config.showNotification || !config.enableWellnessExercises) {
      return;
    }

    // Get recent activity data (last 24 hours)
    const recentEvents = this.getRecentActivityEvents();

    // Check each wellness activity type for optimal timing
    const activityTypes: Array<'stretch' | 'breathing' | 'eye' | 'water'> = ['stretch', 'breathing', 'eye', 'water'];

    for (const activityType of activityTypes) {
      if (this.shouldTriggerWellnessActivity(activityType, recentEvents)) {
        this.triggerOptimalWellnessActivity(activityType, recentEvents);
        break; // Only trigger one activity at a time to avoid overwhelming the user
      }
    }
  }

  /**
   * Determine if we should trigger a specific wellness activity based on ML insights and timing
   */
  private shouldTriggerWellnessActivity(
    activityType: 'stretch' | 'breathing' | 'eye' | 'water',
    events: ActivityEvent[]
  ): boolean {
    const currentHour = new Date().getHours();

    // Get ML recommendation for this activity
    const recommendation = advancedNotificationManager.getOptimalWellnessNotification(activityType, events, currentHour);

    // Check if ML recommends showing notification
    if (!recommendation.shouldNotify) {
      return false;
    }

    // Check if optimal timing
    if (!recommendation.optimalTiming) {
      return false;
    }

    // Check if user has been active recently (not idle)
    if (state.screenTimeStats.isIdle) {
      return false;
    }

    // Prevent spam - check if we've shown this activity recently
    const lastActivityTime = this.getLastActivityTriggerTime(activityType);
    const cooldownPeriod = this.getActivityCooldownMinutes(activityType);
    if (lastActivityTime && (Date.now() - lastActivityTime) < (cooldownPeriod * 60 * 1000)) {
      return false;
    }

    // Additional activity-specific conditions
    switch (activityType) {
      case 'eye': {
        // Only trigger eye exercises if screen time monitoring is enabled
        return getConfiguration().enableEyeExercises &&
               state.screenTimeStats.continuousScreenTime >= 30; // At least 30 minutes screen time
      }

      case 'water':
        // Water reminders during work hours, not too frequently
        return currentHour >= 9 && currentHour <= 17;

      case 'breathing': {
        // Breathing exercises good during high stress or long sessions
        const sessionLength = state.screenTimeStats.codingSessionStart ?
          (Date.now() - state.screenTimeStats.codingSessionStart.getTime()) / (1000 * 60) : 0;
        return sessionLength >= 60; // After 1 hour of continuous work
      }

      case 'stretch': {
        // Stretching after prolonged sitting
        const timeSinceLastBreak = state.screenTimeStats.lastBreakTime ?
          (Date.now() - state.screenTimeStats.lastBreakTime.getTime()) / (1000 * 60) : 0;
        return timeSinceLastBreak >= 45; // After 45 minutes without a break
      }

      default:
        return false;
    }
  }

  /**
   * Trigger the optimal wellness activity based on ML recommendation
   */
  private async triggerOptimalWellnessActivity(
    activityType: 'stretch' | 'breathing' | 'eye' | 'water',
    events: ActivityEvent[]
  ): Promise<void> {
    const currentHour = new Date().getHours();
    const recommendation = advancedNotificationManager.getOptimalWellnessNotification(activityType, events, currentHour);

    try {
      // Show a smart notification with the ML-optimized message
      const choice = await this.showSmartWellnessNotification(recommendation.message, activityType);

      if (choice === 'accept') {
        // Record the interaction as accepted BEFORE triggering the exercise
        advancedNotificationManager.recordNotificationInteraction(
          activityType,
          recommendation.message,
          true, // accepted
          false, // dismissed
          0, // response time (will be updated by the exercise modal)
          `ML-triggered-${activityType}`
        );

        // Update last trigger time
        this.updateLastActivityTriggerTime(activityType);

        // Trigger the specific exercise
        this.triggerWellnessExercise(activityType);

      } else if (choice === 'dismiss') {
        // Record as dismissed
        advancedNotificationManager.recordNotificationInteraction(
          activityType,
          recommendation.message,
          false, // accepted
          true, // dismissed
          0,
          `ML-triggered-${activityType}`
        );
      }

    } catch (error) {
      console.error(`Failed to trigger ${activityType} activity:`, error);
    }
  }

  /**
   * Show smart wellness notification with ML-optimized message
   */
  private async showSmartWellnessNotification(
    message: string,
    activityType: 'stretch' | 'breathing' | 'eye' | 'water'
  ): Promise<'accept' | 'dismiss' | 'snooze'> {
    const buttons = ['Start Now', 'Maybe Later'];

    // Add activity-specific icons
    const activityIcons = {
      stretch: '🏃‍♂️',
      breathing: '🧘‍♀️',
      eye: '👁️',
      water: '💧'
    };

    const fullMessage = `${activityIcons[activityType]} ${message}`;

    const selection = await vscode.window.showInformationMessage(fullMessage, ...buttons);

    if (selection === 'Start Now') {
      return 'accept';
    } else if (selection === 'Maybe Later') {
      return 'dismiss';
    } else {
      return 'snooze';
    }
  }

  /**
   * Trigger the specific wellness exercise based on activity type
   */
  private triggerWellnessExercise(activityType: 'stretch' | 'breathing' | 'eye' | 'water'): void {
    switch (activityType) {
      case 'stretch':
        showStretchExercise();
        break;
      case 'breathing':
        showBreathingExercise();
        break;
      case 'eye':
        showEyeExercise();
        break;
      case 'water':
        showWaterReminder();
        break;
    }
  }

  /**
   * Get recent activity events for ML analysis
   */
  private getRecentActivityEvents(): ActivityEvent[] {
    // Get events from the last 24 hours
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000);

    // Type assertion to demonstrate we're using the AdvancedNotificationManager interface
    const managerInstance = advancedNotificationManager as AdvancedNotificationManager;

    // Validate that managerInstance has the expected type and interface methods
    if (typeof managerInstance.getOptimalWellnessNotification === 'function') {
      console.log('AdvancedNotificationManager interface validation passed');
    }

    // In a real implementation, you'd filter events by cutoffTime
    // For example: const events = this.activityLog.filter(event => event.timestamp > cutoffTime);
    console.log('Recent activity cutoff time:', cutoffTime);

    // For now, return empty array - the ML system handles fallbacks gracefully
    return [];
  }

  /**
   * Get the last time a specific activity was triggered
   */
  private getLastActivityTriggerTime(activityType: string): number | null {
    const storageKey = `last${activityType}TriggerTime`;
    return state.storage?.loadCustomSetting(storageKey, null) || null;
  }

  /**
   * Update the last trigger time for an activity
   */
  private updateLastActivityTriggerTime(activityType: string): void {
    const storageKey = `last${activityType}TriggerTime`;
    state.storage?.saveCustomSetting(storageKey, Date.now());
  }

  /**
   * Get cooldown period in minutes for each activity type
   */
  private getActivityCooldownMinutes(activityType: string): number {
    const cooldowns = {
      stretch: 60,   // 1 hour
      breathing: 90, // 1.5 hours
      eye: 45,       // 45 minutes
      water: 75      // 1.25 hours
    };
    return cooldowns[activityType as keyof typeof cooldowns] || 60;
  }

  /**
   * Stop smart wellness monitoring
   */
  stopMonitoring(): void {
    if (this.activityMonitoringInterval) {
      clearInterval(this.activityMonitoringInterval);
      this.activityMonitoringInterval = undefined!;
    }
  }
}

// Export singleton instance
export const smartWellnessManager = new SmartWellnessManager();
