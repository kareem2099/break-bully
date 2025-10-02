import * as vscode from 'vscode';
import { state } from '../models/state';
import {
  UsageEvent,
  UsageEventType,
  UserBehaviorProfile,
  ContextSnapshot,
  LearningDataPoint,
  AdaptationTrigger,
  EnhancedModelUsageRecord
} from '../types/mlWorkRestTypes';

/**
 * Advanced Usage Analytics Service
 * Captures and processes real-time user interactions to enable continuous ML learning
 */
export class UsageAnalyticsService {
  private static instance: UsageAnalyticsService;
  private currentSession: EnhancedModelUsageRecord | null = null;
  private sessionMetrics: SessionMetrics = {
    startTime: new Date(),
    breaksTaken: 0,
    breaksSkipped: 0,
    manualOverrides: 0,
    distractionsCaptured: 0,
    focusPeriods: 0,
    context: this.captureContextSnapshot()
  };

  private eventBuffer: UsageEvent[] = [];
  private learningDataPoints: LearningDataPoint[] = [];
  private flushInterval: ReturnType<typeof setInterval> | null = null;

  private constructor() {
    this.init();
  }

  static getInstance(): UsageAnalyticsService {
    if (!UsageAnalyticsService.instance) {
      UsageAnalyticsService.instance = new UsageAnalyticsService();
    }
    return UsageAnalyticsService.instance;
  }

  private init(): void {
    // Set up event buffer flushing
    this.flushInterval = setInterval(() => this.flushEvents(), 30000); // 30 seconds

    // Listen for extension deactivation
    vscode.workspace.onDidChangeConfiguration(config => {
      if (config.affectsConfiguration('breakBully')) {
        this.onConfigurationChanged();
      }
    });
  }

  private onConfigurationChanged(): void {
    // Handle configuration changes - could trigger new learning insights
    console.log('Break Bully configuration changed - usage analytics updated');
  }

  /**
   * Event Tracking Methods - Core Analytics Data Collection
   */

  trackModelSelection(modelId: string, source: 'user_selection' | 'ai_recommendation' | 'default'): void {
    const event: UsageEvent = {
      id: this.generateEventId(),
      type: UsageEventType.MODEL_SELECTED,
      timestamp: new Date(),
      modelId,
      source,
      context: this.captureContextSnapshot(),
      metadata: {
        timeOfDay: new Date().getHours(),
        dayOfWeek: new Date().getDay(),
        energyLevel: this.estimateCurrentEnergy(),
        interruptionContext: this.detectInterruptionContext()
      }
    };

    this.addEvent(event);

    // Initialize new usage session
    const session: EnhancedModelUsageRecord = {
      modelId,
      startTime: new Date(),
      endTime: new Date(),
      completionRate: 0,
      interruptions: 0,
      overrideCount: 0,
      sessionDuration: 0,
      breaksCompleted: 0,
      workEfficiency: 0.8,
      breakSatisfaction: 0.7
    };
    this.currentSession = session;
  }

  trackSessionStart(modelId: string, plannedDuration: number): void {
    const event: UsageEvent = {
      id: this.generateEventId(),
      type: UsageEventType.SESSION_STARTED,
      timestamp: new Date(),
      modelId,
      context: this.captureContextSnapshot(),
      metadata: {
        plannedDuration,
        energyAtStart: this.estimateCurrentEnergy(),
        currentTaskType: this.detectCurrentTaskType(),
        environmentalFactors: this.captureEnvironmentalFactors()
      }
    };

    this.addEvent(event);
    this.resetSessionMetrics();
  }

  trackSessionEnd(modelId: string, actualDuration: number, completionRate: number): void {
    if (!this.currentSession) return;

    const event: UsageEvent = {
      id: this.generateEventId(),
      type: UsageEventType.SESSION_ENDED,
      timestamp: new Date(),
      modelId,
      context: this.captureContextSnapshot(),
      metadata: {
        actualDuration,
        completionRate,
        interruptionsCount: this.currentSession.interruptions,
        breaksTaken: this.sessionMetrics.breaksTaken,
        userSatisfaction: this.currentSession.userRating,
        perceivedProductivity: this.currentSession.workEfficiency,
        breakQualityScore: this.currentSession.breakSatisfaction
      }
    };

    this.addEvent(event);

    // Update session record
    this.currentSession.endTime = new Date();
    this.currentSession.completionRate = completionRate;
    this.currentSession.sessionDuration = actualDuration;

    // Create learning data point
    this.createLearningDataPoint();

    // Check for adaptation triggers
    this.checkAdaptiveTriggers();
  }

  trackBreakTaken(modelId: string, breakType: 'scheduled' | 'manual' | 'forced', duration: number): void {
    const event: UsageEvent = {
      id: this.generateEventId(),
      type: UsageEventType.BREAK_TAKEN,
      timestamp: new Date(),
      modelId,
      context: this.captureContextSnapshot(),
      metadata: {
        breakType,
        duration,
        triggeredBy: breakType,
        userInitiated: breakType === 'manual',
        breakActivity: this.detectBreakActivity(),
        interruptionLevel: this.sessionMetrics.distractionsCaptured
      }
    };

    this.addEvent(event);
    this.sessionMetrics.breaksTaken++;

    // Update current session
    if (this.currentSession) {
      this.currentSession.breaksCompleted++;
    }
  }

  trackBreakSkipped(modelId: string, reason: 'user_override' | 'snoozed' | 'ignored'): void {
    const event: UsageEvent = {
      id: this.generateEventId(),
      type: UsageEventType.BREAK_SKIPPED,
      timestamp: new Date(),
      modelId,
      context: this.captureContextSnapshot(),
      metadata: {
        skipReason: reason,
        timeOfDay: new Date().getHours(),
        proposedBreakDuration: 5 // Default assumption - could be tracked better
      }
    };

    this.addEvent(event);
    this.sessionMetrics.breaksSkipped++;

    // Track user override behavior
    if (reason === 'user_override') {
      this.sessionMetrics.manualOverrides++;
    }
  }

  trackDistractionDetected(modelId: string, severity: 'minor' | 'moderate' | 'severe'): void {
    const event: UsageEvent = {
      id: this.generateEventId(),
      type: UsageEventType.DISTRACTION_DETECTED,
      timestamp: new Date(),
      modelId,
      context: this.captureContextSnapshot(),
      metadata: {
        severity,
        detectionMethod: 'activity_monitor', // Could be extended
        accumulatedDistractions: ++this.sessionMetrics.distractionsCaptured,
        timeSinceLastBreak: this.calculateTimeSinceLastBreak()
      }
    };

    this.addEvent(event);

    // Track interruptions in current session
    if (this.currentSession) {
      this.currentSession.interruptions++;
    }
  }

  trackUserFeedback(modelId: string, rating: 1 | 2 | 3 | 4 | 5, comments?: string): void {
    const event: UsageEvent = {
      id: this.generateEventId(),
      type: UsageEventType.USER_FEEDBACK,
      timestamp: new Date(),
      modelId,
      context: this.captureContextSnapshot(),
      metadata: {
        rating,
        comments,
        feedbackType: 'explicit_rating',
        contextOfFeedback: this.currentSession?.completionRate || 0 > 0.5 ? 'post_session' : 'mid_session'
      }
    };

    this.addEvent(event);

    // Update current session with rating
    if (this.currentSession) {
      this.currentSession.userRating = rating;

      // Adjust perceived metrics based on rating
      const adjustmentFactor = rating > 3 ? 1.1 : rating < 3 ? 0.9 : 1.0;
      this.currentSession.workEfficiency *= adjustmentFactor;
      this.currentSession.breakSatisfaction *= adjustmentFactor;
    }
  }

  /**
   * Context and Environmental Awareness
   */

  private captureContextSnapshot(): ContextSnapshot {
    const now = new Date();

    return {
      timeOfDay: now.getHours(),
      dayOfWeek: now.getDay(),
      workType: this.detectCurrentTaskType(),
      screenActivity: this.getCurrentScreenActivity(),
      notificationLoad: this.estimateNotificationLoad(),
      energyLevel: this.estimateCurrentEnergy(),
      lastBreakTime: this.getLastBreakTime(),
      openEditors: vscode.window.visibleTextEditors.length,
      statusMessages: [] // Would need extension to populate
    };
  }

  private detectCurrentTaskType(): 'coding' | 'debugging' | 'writing' | 'planning' | 'reviewing' | 'researching' | 'meeting' {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) return 'meeting'; // Default assumption

    const language = activeEditor.document.languageId;
    const content = activeEditor.document.getText().toLowerCase().slice(0, 500);

    // Basic task type detection
    if (content.includes('fixme') || content.includes('bug') || content.includes('error')) return 'debugging';
    if (content.includes('todo') || content.includes('task') || content.includes('plan')) return 'planning';
    if (content.includes('review') || content.includes('comments')) return 'reviewing';
    if (language === 'markdown' || language === 'plaintext') return 'writing';
    if (content.includes('research') || content.includes('study')) return 'researching';

    return 'coding'; // Default for programming languages
  }

  private estimateCurrentEnergy(): 'low' | 'medium' | 'high' {
    const hour = new Date().getHours();

    // Simple energy estimation based on typical circadian rhythms
    if (hour >= 9 && hour <= 11) return 'high'; // Morning peak
    if (hour >= 14 && hour <= 16) return 'high'; // Afternoon peak
    if (hour >= 22 || hour <= 5) return 'low'; // Late night

    return 'medium'; // Default
  }

  private getCurrentScreenActivity(): number {
    // Estimate activity level - would need integration with activity monitor
    return Math.min(10, Math.max(1, vscode.window.visibleTextEditors.length * 2));
  }

  private estimateNotificationLoad(): 'low' | 'medium' | 'high' {
    // Basic estimation - could be enhanced with actual notification monitoring
    return 'medium'; // Placeholder
  }

  private detectInterruptionContext(): string {
    const recentEvents = this.eventBuffer.filter(e => Date.now() - e.timestamp.getTime() < 60000); // Last minute

    if (recentEvents.some(e => e.type === UsageEventType.DISTRACTION_DETECTED)) return 'high_interruption';
    if (recentEvents.some(e => e.type === UsageEventType.BREAK_SKIPPED)) return 'schedule_resistance';
    if (vscode.window.visibleTextEditors.length > 3) return 'high_context_switching';

    return 'normal';
  }

  private detectBreakActivity(): string {
    // Default assumption - could be enhanced with activity monitoring during breaks
    return 'unspecified'; // Would need integration with break activity tracking
  }

  private captureEnvironmentalFactors(): EnvironmentalData {
    return {
      activeExtensions: vscode.extensions.all.filter(e => e.isActive).length,
      workspaceSize: vscode.workspace.textDocuments.length,
      systemLoad: 'medium' as const, // Would need system monitoring
      ambientConditions: 'unknown' as const // Future: location, weather, etc.
    };
  }

  private getLastBreakTime(): Date | undefined {
    // Search for last break event in recent history
    return undefined; // Would need proper implementation
  }

  private calculateTimeSinceLastBreak(): number {
    const lastBreakTime = this.getLastBreakTime();
    return lastBreakTime ? Date.now() - lastBreakTime.getTime() : 0;
  }

  /**
   * Learning and Adaptation Methods
   */

  private createLearningDataPoint(): void {
    if (!this.currentSession) return;

    const dataPoint: LearningDataPoint = {
      timestamp: new Date(),
      modelId: this.currentSession.modelId,
      success: this.currentSession.completionRate > 0.7,
      context: this.sessionMetrics.context,
      metrics: {
        completionRate: this.currentSession.completionRate,
        interruptions: this.currentSession.interruptions,
        breaksTaken: this.sessionMetrics.breaksTaken,
        ...(this.currentSession.userRating !== undefined && { satisfactionRating: this.currentSession.userRating }),
        focusPeriods: this.sessionMetrics.focusPeriods,
        manualOverrides: this.sessionMetrics.manualOverrides
      },
      learning: {
        idealDurationAdjustment: this.calculateIdealDurationAdjustment(),
        preferredBreakPattern: this.determinePreferredBreakPattern(),
        optimalBreakFrequency: this.calculateOptimalBreakFrequency(),
        contextAdaptations: this.identifyContextAdaptations()
      }
    };

    this.learningDataPoints.push(dataPoint);

    // Limit data points for memory efficiency
    if (this.learningDataPoints.length > 100) {
      this.learningDataPoints = this.learningDataPoints.slice(-50); // Keep last 50
    }
  }

  private calculateIdealDurationAdjustment(): number {
    if (!this.currentSession) return 0;

    const completion = this.currentSession.completionRate;

    // Adjust duration based on completion rate
    if (completion < 0.5) return -15; // Too long
    if (completion > 0.9) return 10;  // Could be longer
    if (completion < 0.7) return -5;  // Slightly too long

    return 0; // Just right
  }

  private determinePreferredBreakPattern(): 'frequent_short' | 'infrequent_long' | 'as_needed' {
    const breaksTaken = this.sessionMetrics.breaksTaken;
    const longBreaks = this.sessionMetrics.breaksTaken; // Placeholder

    if (breaksTaken > 4) return 'frequent_short';
    if (longBreaks > breaksTaken / 2) return 'infrequent_long';

    return 'as_needed';
  }

  private calculateOptimalBreakFrequency(): number {
    // Based on interruption patterns and breaks taken
    const interruptionRate = this.currentSession?.interruptions || 0;
    const baseFrequency = 30; // minutes

    if (interruptionRate > 3) return baseFrequency - 10;
    if (interruptionRate < 1) return baseFrequency + 5;

    return baseFrequency;
  }

  private identifyContextAdaptations(): Record<string, boolean | string | number> {
    return {
      morningPerformance: this.sessionMetrics.context.timeOfDay >= 9 && this.sessionMetrics.context.timeOfDay <= 11,
      codingEfficiency: this.sessionMetrics.context.workType === 'coding',
      loadCapacity: this.sessionMetrics.context.openEditors
    };
  }

  private checkAdaptiveTriggers(): void {
    const triggers: AdaptationTrigger[] = [];

    if (this.learningDataPoints.length >= 3) {
      const recentPoints = this.learningDataPoints.slice(-3);
      const avgCompletion = recentPoints.reduce((sum, p) => sum + p.metrics.completionRate, 0) / recentPoints.length;

      if (avgCompletion < 0.6) {
        triggers.push(AdaptationTrigger.LOW_COMPLETION_RATE);
      }

      // Check for pattern changes
      if (recentPoints.every(p => p.context.workType === 'debugging')) {
        triggers.push(AdaptationTrigger.TIME_PATTERN_CHANGE);
      }
    }

    if (triggers.length > 0) {
      this.triggerModelAdaptation(triggers);
    }
  }

  private triggerModelAdaptation(triggers: AdaptationTrigger[]): void {
    // This would integrate with the ML generator to trigger model adaptation
    console.log('Adaptive triggers detected:', triggers);
    // TODO: Integrate with model adaptation logic
  }

  /**
   * Data Management and Persistence
   */

  private addEvent(event: UsageEvent): void {
    this.eventBuffer.push(event);

    // Immediate storage for critical events
    if (this.isCriticalEvent(event.type)) {
      this.saveEvent(event);
    }
  }

  private isCriticalEvent(type: UsageEventType): boolean {
    return [
      UsageEventType.MODEL_SELECTED,
      UsageEventType.SESSION_ENDED,
      UsageEventType.USER_FEEDBACK
    ].includes(type);
  }

  private flushEvents(): void {
    if (this.eventBuffer.length === 0) return;

    const eventsToSave = [...this.eventBuffer];
    this.eventBuffer = [];

    eventsToSave.forEach(event => this.saveEvent(event));
  }

  private saveEvent(event: UsageEvent): void {
    try {
      // Get existing usage data
      const existingData = state.storage?.loadCustomSetting('usageAnalyticsData', {
        events: [],
        sessions: [],
        learningData: []
      });

      // Add new event
      existingData.events.push(event);

      // Add learning data if available
      if (this.learningDataPoints.length > 0) {
        existingData.learningData = this.learningDataPoints.slice(-20); // Keep last 20
      }

      // Save back to storage
      state.storage?.saveCustomSetting('usageAnalyticsData', existingData);
    } catch (error) {
      console.error('Failed to save usage event:', error);
    }
  }

  private resetSessionMetrics(): void {
    this.sessionMetrics = {
      startTime: new Date(),
      breaksTaken: 0,
      breaksSkipped: 0,
      manualOverrides: 0,
      distractionsCaptured: 0,
      focusPeriods: 0,
      context: this.captureContextSnapshot()
    };
  }

  /**
   * Analytics and Reporting Methods
   */

  getUsageStatistics(timeRange: 'week' | 'month' | 'all' = 'week'): UsageStatistics {
    const data = state.storage?.loadCustomSetting('usageAnalyticsData', {
      events: [],
      sessions: [],
      learningData: []
    });

    if (!data || !data.events) {
      return {
        totalSessions: 0,
        averageCompletionRate: 0,
        mostUsedModel: null,
        peakProductivityHours: [],
        commonBreakPatterns: {},
        userBehaviorTrends: {}
      };
    }

    const timeFilter = this.getTimeFilter(timeRange);
    const relevantEvents = data.events.filter((e: UsageEvent) => e.timestamp >= timeFilter);

    return this.calculateUsageStatistics(relevantEvents);
  }

  private getTimeFilter(range: 'week' | 'month' | 'all'): Date {
    const now = new Date();
    switch (range) {
      case 'week': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'month': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case 'all': return new Date(0);
      default: return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
  }

  private calculateUsageStatistics(events: UsageEvent[]): UsageStatistics {
    const stats = {
      totalSessions: 0,
      averageCompletionRate: 0,
      mostUsedModel: null as string | null,
      peakProductivityHours: [] as number[],
      commonBreakPatterns: {} as Record<string, number>,
      userBehaviorTrends: {} as Record<string, string | number | boolean>
    };

    // Count sessions
    stats.totalSessions = events.filter(e => e.type === UsageEventType.SESSION_STARTED).length;

    // Calculate most used model
    const modelUsage = new Map<string, number>();
    events.filter(e => e.type === UsageEventType.MODEL_SELECTED)
          .forEach(e => modelUsage.set(e.modelId!, (modelUsage.get(e.modelId!) || 0) + 1));
    stats.mostUsedModel = Array.from(modelUsage.entries())
                              .sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    // Calculate peak productivity hours
    const hourCounts = Array(24).fill(0);
    events.forEach(e => hourCounts[e.timestamp.getHours()]++);
    stats.peakProductivityHours = hourCounts.map((count, hour) => ({ hour, count }))
                                            .sort((a, b) => b.count - a.count)
                                            .slice(0, 3).map(item => item.hour);

    return stats;
  }

  /**
   * Utility Methods
   */

  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  exportLearningData(): string {
    const data = {
      events: this.eventBuffer,
      learningDataPoints: this.learningDataPoints,
      userProfile: this.buildUserBehaviorProfile(),
      exportDate: new Date().toISOString()
    };

    return JSON.stringify(data, null, 2);
  }

  private buildUserBehaviorProfile(): UserBehaviorProfile {
    const data = state.storage?.loadCustomSetting('usageAnalyticsData', { events: [] });

    if (!data || !data.events) {
      return { preferencePatterns: {}, successRates: {}, behavioralTendencies: {} };
    }

    // Analyze patterns from events
    const recentEvents = data.events.filter((e: UsageEvent) =>
      Date.now() - e.timestamp.getTime() < 30 * 24 * 60 * 60 * 1000 // Last 30 days
    );

    return {
      preferencePatterns: this.analyzePreferencePatterns(recentEvents),
      successRates: this.calculateSuccessRates(recentEvents),
      behavioralTendencies: this.extractBehavioralTendencies(recentEvents)
    };
  }

  private analyzePreferencePatterns(_events: UsageEvent[]): Record<string, string | number | boolean> {
    // Analyze time-based, task-based, and context-based patterns
    return {};
  }

  private calculateSuccessRates(_events: UsageEvent[]): Record<string, number> {
    // Calculate success rates by model, time, context, etc.
    return {};
  }

  private extractBehavioralTendencies(_events: UsageEvent[]): Record<string, string | number | boolean> {
    // Extract behavioral patterns and tendencies
    return {};
  }

  dispose(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flushEvents(); // Final flush
  }
}

/**
 * Helper Interfaces
 */

interface SessionMetrics {
  startTime: Date;
  breaksTaken: number;
  breaksSkipped: number;
  manualOverrides: number;
  distractionsCaptured: number;
  focusPeriods: number;
  context: ContextSnapshot;
}

interface UsageStatistics {
  totalSessions: number;
  averageCompletionRate: number;
  mostUsedModel: string | null;
  peakProductivityHours: number[];
  commonBreakPatterns: Record<string, number>;
  userBehaviorTrends: Record<string, string | number | boolean>;
}

interface EnvironmentalData {
  activeExtensions: number;
  workspaceSize: number;
  systemLoad: 'low' | 'medium' | 'high';
  ambientConditions: 'unknown' | string;
}

export const usageAnalytics = UsageAnalyticsService.getInstance();
