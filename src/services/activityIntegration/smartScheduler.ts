import * as vscode from 'vscode';
import {
  FlowStateInfo,
  ActivityEvent,
  ActivityLevel,
  ActivityType
} from './activityTypes';
import { activitySettings } from './activitySettings';
import { BaseActivityMonitor } from './baseActivityMonitor';

export class FlowStateDetector {
  private flowStates: FlowStateInfo[] = [];
  private currentFlowState: FlowStateInfo | null = null;

  detectFlowState(events: ActivityEvent[]): boolean {
    if (!activitySettings.isSmartEnabled()) return false;

    const settings = activitySettings.getSettings();
    const now = Date.now();
    const flowDetectionWindow = vscode.workspace.getConfiguration('breakBully').get('flowDetectionWindow', 20);
    const twentyMinutesAgo = now - (flowDetectionWindow * 60 * 1000);

    // Get events from last N minutes
    const recentEvents = events.filter(e => e.timestamp > twentyMinutesAgo);

    if (recentEvents.length < 5) return false; // Need minimum activity

    // Calculate average intensity
    const avgIntensity = recentEvents.reduce((sum, e) => sum + e.intensity, 0) / recentEvents.length;

    // Check if above flow threshold
    const isInFlow = avgIntensity >= settings.flowThreshold;

    // Check for consistent activity pattern
    const hasConsistentActivity = this.hasConsistentActivity(recentEvents);

    const confidence = Math.min(1, (avgIntensity / 10) * (hasConsistentActivity ? 1.2 : 0.8));

    if (isInFlow && confidence > 0.7) {
      if (!this.currentFlowState) {
        // Start new flow state
        this.currentFlowState = {
          isInFlow: true,
          confidence,
          duration: 0,
          startTime: now,
          triggers: this.identifyFlowTriggers(recentEvents)
        };
      } else {
        // Update existing flow state
        this.currentFlowState.confidence = confidence;
        this.currentFlowState.duration = (now - this.currentFlowState.startTime) / (1000 * 60); // minutes
      }
      return true;
    } else if (this.currentFlowState) {
      // End flow state
      this.currentFlowState.endTime = now;
      this.flowStates.push({ ...this.currentFlowState });
      this.currentFlowState = null;
    }

    return false;
  }

  private hasConsistentActivity(events: ActivityEvent[]): boolean {
    if (events.length < 3) return false;

    // Check if activity is spread across the time window
    const timeSpan = events[events.length - 1].timestamp - events[0].timestamp;
    const expectedEvents = timeSpan / (5 * 60 * 1000); // Expected events every 5 minutes

    return events.length >= expectedEvents * 0.6; // At least 60% of expected activity
  }

  private identifyFlowTriggers(events: ActivityEvent[]): string[] {
    const triggers: string[] = [];
    const highIntensityEvents = events.filter(e => e.intensity >= 7);

    if (highIntensityEvents.length > 0) {
      triggers.push('High intensity coding');
    }

    const fileEdits = events.filter(e => e.type === ActivityType.FILE_EDIT);
    if (fileEdits.length >= 3) {
      triggers.push('Frequent file edits');
    }

    const debugSessions = events.filter(e => e.type === ActivityType.DEBUG_SESSION);
    if (debugSessions.length > 0) {
      triggers.push('Active debugging');
    }

    return triggers.length > 0 ? triggers : ['Consistent high activity'];
  }

  getCurrentFlowState(): FlowStateInfo | null {
    return this.currentFlowState;
  }

  getFlowStates(hours: number = 24): FlowStateInfo[] {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    return this.flowStates.filter(state => state.startTime > cutoff);
  }

  getTotalFlowTime(hours: number = 24): number {
    return this.getFlowStates(hours).reduce((total, state) =>
      total + (state.duration || 0), 0);
  }
}

export class SmartScheduler {
  private baseMonitor: BaseActivityMonitor;
  private flowDetector: FlowStateDetector;
  private lastBreakSuggestion = 0;

  constructor(baseMonitor: BaseActivityMonitor) {
    this.baseMonitor = baseMonitor;
    this.flowDetector = new FlowStateDetector();
  }

  shouldDelayBreak(): boolean {
    if (!activitySettings.isSmartEnabled()) return false;

    const settings = activitySettings.getSettings();

    // Check if flow protection is enabled
    if (!settings.smartTiming.flowProtection) return false;

    // Check for active flow state
    const recentEvents = this.baseMonitor.getRecentEvents(20);
    const inFlow = this.flowDetector.detectFlowState(recentEvents);

    if (inFlow) {
      const flowState = this.flowDetector.getCurrentFlowState();
      if (flowState && flowState.confidence > 0.8) {
        return true; // Delay break during high-confidence flow state
      }
    }

    return false;
  }

  getBreakDelayMinutes(): number {
    if (!this.shouldDelayBreak()) return 0;

    const settings = activitySettings.getSettings();
    return Math.min(settings.smartTiming.maxExtension, 15); // Max 15 minutes delay
  }

  suggestBreakDuration(): number {
    if (!activitySettings.isSmartEnabled()) return 10; // Default

    const activityScore = this.baseMonitor.getActivityScore();
    const recentEvents = this.baseMonitor.getRecentEvents(60);

    // Use recent activity patterns for more accurate break duration
    const highIntensityEvents = recentEvents.filter(e => e.intensity >= 7);
    const prolongedHighActivity = highIntensityEvents.length > 10; // More than 10 high-intensity events

    // High activity → longer break, extended if prolonged high activity
    if (activityScore >= 8) {
      return prolongedHighActivity ? 20 : 15;
    }

    // Medium activity → standard break
    if (activityScore >= 4) {
      return 10;
    }

    // Low activity → shorter break
    if (activityScore >= 1) {
      return 5;
    }

    // Very low activity → minimal break
    return 3;
  }

  shouldSuggestBreak(): boolean {
    if (!activitySettings.isSmartEnabled()) return false;

    const settings = activitySettings.getSettings();
    if (!settings.notifications.breakSuggestions) return false;

    const now = Date.now();
    const timeSinceLastSuggestion = now - this.lastBreakSuggestion;

    // Don't suggest more than once every 30 minutes
    if (timeSinceLastSuggestion < 30 * 60 * 1000) return false;

    const activityScore = this.baseMonitor.getActivityScore();

    // Suggest break if activity is very high (potential burnout)
    if (activityScore >= 9) {
      this.lastBreakSuggestion = now;
      return true;
    }

    // Suggest break if in prolonged high activity without recent break
    const recentEvents = this.baseMonitor.getRecentEvents(120); // 2 hours
    const highActivityEvents = recentEvents.filter(e => e.intensity >= 7);

    if (highActivityEvents.length >= 10) {
      this.lastBreakSuggestion = now;
      return true;
    }

    return false;
  }

  getBreakSuggestion(): string | null {
    if (!this.shouldSuggestBreak()) return null;

    const activityScore = this.baseMonitor.getActivityScore();
    const flowState = this.flowDetector.getCurrentFlowState();

    if (flowState && flowState.isInFlow) {
      return `You've been in flow for ${Math.round(flowState.duration)} minutes. Consider a short break to sustain productivity.`;
    }

    if (activityScore >= 9) {
      return "High activity detected! Take a break to prevent burnout.";
    }

    if (activityScore >= 7) {
      return "You've been highly active. A break would help maintain focus.";
    }

    return "Consider taking a short break to recharge.";
  }

  getProductivityTips(): string[] {
    const tips: string[] = [];
    const metrics = this.baseMonitor.getMetrics();
    const flowTime = this.flowDetector.getTotalFlowTime(24);

    if (metrics.activityLevel === ActivityLevel.HIGH && flowTime < 60) {
      tips.push("Try to maintain longer flow states by minimizing interruptions.");
    }

    if (metrics.averageScore < 3) {
      tips.push("Consider increasing your work intensity or taking shorter, more frequent breaks.");
    }

    if (metrics.eventsByType[ActivityType.DEBUG_SESSION] > 5) {
      tips.push("Frequent debugging detected. Consider code reviews or pair programming.");
    }

    return tips;
  }

  // Advanced scheduling recommendations
  getOptimalSchedule(): {
    workDuration: number;
    breakDuration: number;
    frequency: number;
  } {
    const metrics = this.baseMonitor.getMetrics();
    const flowTime = this.flowDetector.getTotalFlowTime(24);

    // Base recommendations on activity patterns
    if (flowTime > 120) { // 2+ hours in flow daily
      return { workDuration: 90, breakDuration: 10, frequency: 6 }; // Long focused sessions
    }

    if (metrics.averageScore > 6) {
      return { workDuration: 50, breakDuration: 10, frequency: 8 }; // High intensity, frequent breaks
    }

    return { workDuration: 25, breakDuration: 5, frequency: 12 }; // Standard pomodoro-style
  }

  // Get flow states for analytics
  getFlowStates(hours: number = 24): FlowStateInfo[] {
    return this.flowDetector.getFlowStates(hours);
  }

  // Get total flow time
  getTotalFlowTime(hours: number = 24): number {
    return this.flowDetector.getTotalFlowTime(hours);
  }

  // Get current status for UI display
  getStatusInfo(): {
    activityLevel: ActivityLevel;
    inFlow: boolean;
    flowDuration: number;
    nextBreakDelay: number;
    suggestion?: string | undefined;
  } {
    const recentEvents = this.baseMonitor.getRecentEvents(20);
    const inFlow = this.flowDetector.detectFlowState(recentEvents);
    const flowState = this.flowDetector.getCurrentFlowState();
    const suggestion = this.getBreakSuggestion();

    return {
      activityLevel: this.baseMonitor.getCurrentActivityLevel(),
      inFlow,
      flowDuration: flowState?.duration || 0,
      nextBreakDelay: this.getBreakDelayMinutes(),
      suggestion: suggestion || undefined
    };
  }
}
