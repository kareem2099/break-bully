import * as vscode from 'vscode';
import { BaseActivityMonitor, ActivityState } from './activityIntegration/baseActivityMonitor';
import { ActivityType, AdvancedTypingMetrics } from './activityIntegration/activityTypes';
import { state } from '../models/state';
import { getCurrentSession } from './workRestService';
import { WorkRestSession } from './workRestService';
import { usageAnalytics } from './usageAnalyticsService';

export interface BreakSuggestion {
  suggested: boolean;
  reason: string;
  recommendedDuration: number; // minutes
  confidence: number; // 0-1
  autoExecute: boolean;
  urgency: 'low' | 'medium' | 'high';
  insights: string[];
}

export interface SessionAnalysis {
  intensityTrend: 'increasing' | 'stable' | 'decreasing';
  fatigueSignals: number; // 0-10 scale
  flowStateDetect: boolean;
  peakWindowMatch: boolean;
  optimalBreakType: 'quick_refresh' | 'recovery' | 'standard';
  adaptationSuggestions: string[];
}

/**
 * Real-Time Session Analyzer
 * Monitors activity patterns during work sessions and provides intelligent break timing suggestions
 */
export class RealTimeSessionAnalyzer {

  private static instance: RealTimeSessionAnalyzer;
  private activityMonitor: BaseActivityMonitor | null = null;
  private analysisInterval: ReturnType<typeof setInterval> | null = null;
  private sessionStartTime = 0;
  private intensityHistory: number[] = [];
  private lastBreakSuggestion = 0;
  private isActive = false;
  private currentAnalysis: SessionAnalysis | null = null;

  private constructor() {
    this.initializeActivityMonitor();
  }

  static getInstance(): RealTimeSessionAnalyzer {
    if (!RealTimeSessionAnalyzer.instance) {
      RealTimeSessionAnalyzer.instance = new RealTimeSessionAnalyzer();
    }
    return RealTimeSessionAnalyzer.instance;
  }

  /**
   * Initialize the activity monitor integration
   */
  private initializeActivityMonitor(): void {
    try {
      // Get the existing activity monitor instance
      const extension = vscode.extensions.getExtension('kareem2099.break-bully');

      if (extension?.exports?.activityMonitor) {
        this.activityMonitor = extension.exports.activityMonitor as BaseActivityMonitor;
      } else {
        // Fallback - try to get from state if available
        const activityMonitor = (state as any).activityMonitor;
        if (activityMonitor) {
          this.activityMonitor = activityMonitor;
        } else {
          console.warn('Activity monitor not available for real-time analysis');
        }
      }
    } catch (error) {
      console.warn('Failed to initialize activity monitor for real-time analysis:', error);
    }
  }

  /**
   * Start analyzing a work session
   */
  startSessionAnalysis(): void {
    console.log('Starting real-time session analysis');

    this.sessionStartTime = Date.now();
    this.intensityHistory = [];
    this.lastBreakSuggestion = 0;
    this.isActive = true;

    // Start periodic analysis (every 5 minutes during work periods)
    this.analysisInterval = setInterval(() => {
      this.performSessionAnalysis();
    }, 5 * 60 * 1000); // 5 minutes

    // Initial analysis after 2 minutes to establish baseline
    setTimeout(() => {
      this.performSessionAnalysis();
    }, 2 * 60 * 1000);

    console.log('Real-time session analyzer activated');
  }

  /**
   * Stop analyzing the current session
   */
  stopSessionAnalysis(): void {
    this.isActive = false;
    this.currentAnalysis = null;

    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = null;
    }

    console.log('Real-time session analyzer deactivated');
  }

  /**
   * Main analysis routine - runs every 5 minutes during work sessions
   */
  private async performSessionAnalysis(): Promise<void> {
    if (!this.isActive || !this.activityMonitor) return;

    const session = getCurrentSession();
    if (!session || !session.isWorking) return; // Only analyze during work periods

    try {
      // Collect current activity data
      const currentIntensity = this.activityMonitor.getCurrentActivityLevel();
      const activityScore = Math.max(0, Math.min(10, this.activityMonitor.getActivityScore())); // Normalize to 0-10 range
      const activityState = this.activityMonitor.getCurrentActivityState();

      // Store in history for trend analysis
      this.intensityHistory.push(activityScore);
      if (this.intensityHistory.length > 12) { // Keep last hour of data (12 x 5min intervals)
        this.intensityHistory = this.intensityHistory.slice(-12);
      }

      // Analyze patterns
      this.currentAnalysis = this.analyzeActivityPatterns(activityScore, activityState);

      // Generate break suggestions if appropriate
      const breakSuggestion = await this.generateBreakSuggestion(this.currentAnalysis);
      if (breakSuggestion.suggested) {
        this.executeBreakSuggestion(breakSuggestion);
      }

      // Track analytics (simplified logging)
      console.debug(`Real-time analysis: intensity=${activityScore.toFixed(1)}, trends=${this.currentAnalysis?.intensityTrend}, fatigue=${this.currentAnalysis?.fatigueSignals}`);

    } catch (error) {
      console.error('Error during real-time session analysis:', error);
    }
  }

  /**
   * Analyze activity patterns to determine session state
   */
  private analyzeActivityPatterns(
    currentIntensity: number,
    activityState: ActivityState
  ): SessionAnalysis {

    const sessionElapsed = (Date.now() - this.sessionStartTime) / (1000 * 60); // minutes

    // Get recent typing patterns for advanced analysis
    const recentTypingPatterns = this.getRecentTypingPatterns(10); // Last 10 typing bursts
    const typingFatigueScore = this.analyzeTypingFatigue(recentTypingPatterns);
    const focusQualityState = this.analyzeFocusQualityState(recentTypingPatterns);
    const workTypeClassification = this.classifyCurrentWorkType(recentTypingPatterns);

    // Analyze intensity trend (recent 3 readings vs earlier readings)
    let intensityTrend: 'increasing' | 'stable' | 'decreasing' = 'stable';
    if (this.intensityHistory.length >= 6) {
      const recentAvg = this.intensityHistory.slice(-3).reduce((a, b) => a + b, 0) / 3;
      const earlierAvg = this.intensityHistory.slice(-6, -3).reduce((a, b) => a + b, 0) / 3;

      if (recentAvg > earlierAvg + 0.5) intensityTrend = 'increasing';
      else if (recentAvg < earlierAvg - 0.5) intensityTrend = 'decreasing';
    }

    // Enhanced fatigue detection using typing patterns + activity state
    let fatigueSignals = typingFatigueScore; // Start with typing-based fatigue

    // Additional fatigue indicators from activity patterns
    if (intensityTrend === 'decreasing' && sessionElapsed > 45) fatigueSignals += 2;
    if (this.intensityHistory.slice(-6).some(score => score < 2)) fatigueSignals += 1.5;
    if (activityState === ActivityState.IDLE && sessionElapsed > 30) fatigueSignals += 2;

    // Focus quality adjustments
    if (focusQualityState.focusStability < 0.6) fatigueSignals += 1.5;
    if (focusQualityState.taskSwitchingRate > 8) fatigueSignals += 1; // High task switching = cognitive load

    // Detect flow state (enhanced with typing metrics)
    const flowStateDetect = this.detectFlowState(recentTypingPatterns, intensityTrend, sessionElapsed);

    // Check if current time matches learned peak hours
    const peakWindowMatch = this.isInPeakProductivityWindow();

    // Enhanced optimal break determination
    const optimalBreakType = this.determineOptimalBreakType(
      fatigueSignals, flowStateDetect, focusQualityState, workTypeClassification
    );

    // Advanced adaptation suggestions
    const adaptationSuggestions = this.generateAdvancedAdaptationSuggestions(
      typingFatigueScore, focusQualityState, workTypeClassification, flowStateDetect, intensityTrend, sessionElapsed
    );

    return {
      intensityTrend,
      fatigueSignals: Math.min(10, fatigueSignals),
      flowStateDetect,
      peakWindowMatch,
      optimalBreakType,
      adaptationSuggestions
    };
  }

  /**
   * Get recent typing patterns from activity monitor
   */
  private getRecentTypingPatterns(count: number): AdvancedTypingMetrics[] {
    if (!this.activityMonitor) return [];

    try {
      // Get recent events and extract typing metrics
      const recentEvents = this.activityMonitor.getRecentEvents(60); // Last hour
      const typingEvents = recentEvents.filter(event =>
        event.type === ActivityType.TYPING_BURST &&
        event.context.typingMetrics
      );

      return typingEvents
        .slice(-count)
        .map(event => event.context.typingMetrics as AdvancedTypingMetrics)
        .filter(metrics => metrics !== undefined);

    } catch (error) {
      console.warn('Failed to get recent typing patterns:', error);
      return [];
    }
  }

  /**
   * Analyze typing patterns for cognitive fatigue
   */
  private analyzeTypingFatigue(typingPatterns: AdvancedTypingMetrics[]): number {
    if (typingPatterns.length === 0) return 0;

    let fatigueScore = 0;
    const recentPatterns = typingPatterns.slice(-5); // Last 5 bursts

    // Rhythm degradation (erratic timing indicates fatigue)
    const avgRhythmVariance = recentPatterns.reduce((sum, p) => sum + p.rhythmVariance, 0) / recentPatterns.length;
    if (avgRhythmVariance < 0.7) fatigueScore += 2; // Poor rhythm consistency

    // Error rate increase
    const avgErrorRate = recentPatterns.reduce((sum, p) => sum + p.errorRate, 0) / recentPatterns.length;
    if (avgErrorRate > 6) fatigueScore += 2;
    else if (avgErrorRate > 3) fatigueScore += 1;

    // Velocity decline (slowing down)
    const velocities = recentPatterns.map(p => p.keystrokeVelocity);
    if (velocities.length >= 3) {
      const recentAvg = velocities.slice(-2).reduce((a, b) => a + b, 0) / 2;
      const earlierAvg = velocities.slice(0, -2).reduce((a, b) => a + b, 0) / (velocities.length - 2);
      if (recentAvg < earlierAvg * 0.85) fatigueScore += 1.5; // 15% slowdown
    }

    // Correction patterns
    const frequentCorrections = recentPatterns.some(p =>
      p.correctionPatterns.includes('bunching') || p.correctionPatterns.length > 2
    );
    if (frequentCorrections) fatigueScore += 1;

    // Explicit fatigue indicators
    const explicitFatigue = recentPatterns.some(p => p.fatigueIndicators.length > 0);
    if (explicitFatigue) fatigueScore += 2;

    return Math.min(10, fatigueScore);
  }

  /**
   * Analyze focus quality state from typing patterns
   */
  private analyzeFocusQualityState(typingPatterns: AdvancedTypingMetrics[]): {
    contextDepth: number;
    taskSwitchingRate: number;
    focusStability: number;
    workImmersion: number;
  } {
    if (typingPatterns.length === 0) {
      return { contextDepth: 5, taskSwitchingRate: 2, focusStability: 0.8, workImmersion: 0.6 };
    }

    // Context depth based on typing consistency (higher = deeper focus)
    const avgRhythmVariance = typingPatterns.reduce((sum, p) => sum + p.rhythmVariance, 0) / typingPatterns.length;
    const contextDepth = Math.min(10, Math.max(0, avgRhythmVariance * 8 + 2));

    // Task switching inferred from typing interruptions and error patterns
    const switchingIndicators = typingPatterns.filter(p =>
      p.rhythmVariance < 0.6 || p.errorRate > 5 || p.correctionPatterns.length > 0
    ).length;
    const taskSwitchingRate = (switchingIndicators / typingPatterns.length) * 12; // Scale to per hour

    // Focus stability (consistency of quality scores)
    const qualityScores = typingPatterns.map(p => p.burstQuality);
    const avgQuality = qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length;
    const qualityVariance = qualityScores.reduce((sum, q) => sum + Math.pow(q - avgQuality, 2), 0) / qualityScores.length;
    const focusStability = Math.max(0.1, 1 - (qualityVariance * 2)); // Lower variance = higher stability

    // Work immersion (sustained quality over time)
    const highQualityBursts = typingPatterns.filter(p => p.burstQuality >= 0.8).length;
    const workImmersion = highQualityBursts / typingPatterns.length;

    return {
      contextDepth: Math.round(contextDepth * 10) / 10,
      taskSwitchingRate: Math.round(taskSwitchingRate * 10) / 10,
      focusStability: Math.round(focusStability * 100) / 100,
      workImmersion: Math.round(workImmersion * 100) / 100
    };
  }

  /**
   * Classify current work type based on typing patterns
   */
  private classifyCurrentWorkType(typingPatterns: AdvancedTypingMetrics[]): 'deep_coding' | 'debugging' | 'creative' | 'administrative' | 'review' {
    if (typingPatterns.length === 0) return 'deep_coding';

    const recentBursts = typingPatterns.slice(-3);
    const avgErrorRate = recentBursts.reduce((sum, p) => sum + p.errorRate, 0) / recentBursts.length;
    const avgRhythmVariance = recentBursts.reduce((sum, p) => sum + p.rhythmVariance, 0) / recentBursts.length;
    const frequentCorrections = recentBursts.some(p => p.correctionPatterns.length > 2);

    // Debugging: high error rates, frequent corrections
    if (avgErrorRate > 8 && frequentCorrections) return 'debugging';

    // Creative: variable rhythm, moderate corrections
    if (avgRhythmVariance < 0.7 && avgErrorRate > 4) return 'creative';

    // Review/Administrative: low immersion, inconsistent patterns
    if (avgRhythmVariance < 0.6 || avgErrorRate < 2) return 'administrative';

    // Deep coding: consistent, low error rate, high quality
    return 'deep_coding';
  }

  /**
   * Enhanced flow state detection using typing metrics
   */
  private detectFlowState(
    typingPatterns: AdvancedTypingMetrics[],
    intensityTrend: string,
    sessionElapsed: number
  ): boolean {

    if (typingPatterns.length < 3) return false;

    const recentBursts = typingPatterns.slice(-3);

    // Flow state criteria: (enhanced version)
    // 1. High and consistent typing quality
    const avgQuality = recentBursts.reduce((sum, p) => sum + p.burstQuality, 0) / recentBursts.length;
    const qualityConsistent = recentBursts.every(p => p.burstQuality >= 0.75);

    // 2. Low fatigue indicators
    const lowFatigue = recentBursts.every(p => p.fatigueIndicators.length === 0);

    // 3. Steady to improving rhythm
    const recentRhythm = recentBursts[recentBursts.length - 1].rhythmVariance;
    const earlierRhythm = recentBursts[0].rhythmVariance;
    const rhythmSteady = recentRhythm >= 0.7 && (recentRhythm >= earlierRhythm * 0.9);

    // 4. Appropriate session duration
    const goodDuration = sessionElapsed >= 20 && sessionElapsed <= 120;

    // 5. Intensity trend positive or stable
    const intensityPositive = intensityTrend === 'increasing' || intensityTrend === 'stable';

    return avgQuality >= 0.8 && qualityConsistent && lowFatigue && rhythmSteady && goodDuration && intensityPositive;
  }

  /**
   * Determine optimal break type based on comprehensive analysis
   */
  private determineOptimalBreakType(
    fatigueSignals: number,
    flowStateDetect: boolean,
    focusQuality: any,
    workType: string
  ): 'quick_refresh' | 'recovery' | 'standard' {

    // High fatigue requires recovery
    if (fatigueSignals >= 6) return 'recovery';

    // Flow state gets quick refresh to maintain momentum
    if (flowStateDetect) return 'quick_refresh';

    // Administrative work benefits from standard breaks
    if (workType === 'administrative' || focusQuality.focusStability < 0.7) return 'standard';

    // Creative work often needs slightly longer breaks
    if (workType === 'creative') return 'standard';

    // Deep coding and debugging can benefit from quick refreshes
    return 'quick_refresh';
  }

  /**
   * Generate advanced adaptation suggestions
   */
  private generateAdvancedAdaptationSuggestions(
    typingFatigueScore: number,
    focusQuality: any,
    workType: string,
    flowStateDetect: boolean,
    intensityTrend: string,
    sessionElapsed: number
  ): string[] {

    const suggestions: string[] = [];

    // Typing fatigue insights
    if (typingFatigueScore >= 3) {
      suggestions.push(`Typing fatigue detected (${Math.round(typingFatigueScore * 10)/10}/10) - recovery break recommended`);
    }

    // Flow state insights
    if (flowStateDetect) {
      suggestions.push('Flow state active - short break to maintain momentum');
    }

    // Work type insights
    if (workType === 'debugging') {
      suggestions.push('Debugging session detected - consider strategic break timing');
    } else if (workType === 'creative') {
      suggestions.push('Creative work may benefit from extended contemplation breaks');
    }

    // Focus stability insights
    if (focusQuality.focusStability < 0.6) {
      suggestions.push('Focus instability detected - break may help recenter attention');
    } else if (focusQuality.focusStability >= 0.8) {
      suggestions.push('Strong focus stability - task immersion well maintained');
    }

    // Task switching insights
    if (focusQuality.taskSwitchingRate > 6) {
      suggestions.push(`High task switching (${focusQuality.taskSwitchingRate}/hr) - cognitive load may be building`);
    }

    // Context depth insights
    if (focusQuality.contextDepth >= 7) {
      suggestions.push('Deep work immersion - consider if break timing preserves flow');
    }

    return suggestions.slice(0, 4); // Limit to most relevant
  }

  /**
   * Generate intelligent break suggestions based on analysis
   */
  private async generateBreakSuggestion(analysis: SessionAnalysis): Promise<BreakSuggestion> {

    const session = getCurrentSession();
    if (!session || !session.isWorking) {
      return { suggested: false, reason: '', recommendedDuration: 0, confidence: 0, autoExecute: false, urgency: 'low', insights: [] };
    }

    const sessionElapsed = (Date.now() - this.sessionStartTime) / (1000 * 60); // minutes
    const timeSinceLastSuggestion = (Date.now() - this.lastBreakSuggestion) / (1000 * 60);

    // Only suggest breaks after minimum session time and not too frequently
    if (sessionElapsed < 25 || timeSinceLastSuggestion < 15) {
      return { suggested: false, reason: '', recommendedDuration: 0, confidence: 0, autoExecute: false, urgency: 'low', insights: [] };
    }

    let suggested = false;
    let reason = '';
    let recommendedDuration = session.model.restDuration || 5;
    let confidence = 0.7;
    let autoExecute = false;
    let urgency: 'low' | 'medium' | 'high' = 'low';

    // Core suggestion logic

    // 1. Intense activity + flow state → quick refresh break
    if (analysis.flowStateDetect && sessionElapsed >= 45) {
      suggested = true;
      reason = 'Flow state maintained for 45+ minutes - quick refresh suggested';
      recommendedDuration = Math.max(3, session.model.restDuration - 2);
      confidence = 0.85;
      urgency = 'low';
      autoExecute = false; // Let user decide during flow state
    }

    // 2. High fatigue signals → recovery break
    else if (analysis.fatigueSignals >= 5) {
      suggested = true;
      reason = 'Fatigue patterns detected - recovery break needed';
      recommendedDuration = Math.min(25, session.model.restDuration + 10);
      confidence = 0.9;
      urgency = 'high';
      autoExecute = analysis.fatigueSignals >= 7; // Auto-execute if very fatigued
    }

    // 3. Productivity declining + moderate session → standard break adjustment
    else if (analysis.intensityTrend === 'decreasing' && sessionElapsed >= 40) {
      suggested = true;
      reason = 'Productivity declining - break may help reset focus';
      recommendedDuration = Math.min(15, session.model.restDuration + 5);
      confidence = 0.75;
      urgency = 'medium';
      autoExecute = false;
    }

    // 4. During peak hours → potentially extend work period
    else if (analysis.peakWindowMatch && analysis.intensityTrend === 'increasing' && sessionElapsed < 50) {
      // Instead of suggesting break, suggest extension (handled separately)
      return { suggested: false, reason: 'Peak productivity window - continuing work', recommendedDuration: 0, confidence: 0.8, autoExecute: false, urgency: 'low', insights: ['Extending work period during peak productivity time'] };
    }

    // 5. Long session without fatigue → consider break based on pattern
    else if (sessionElapsed >= 60 && analysis.fatigueSignals < 3) {
      suggested = true;
      reason = 'Extended work session - regular break recommended';
      recommendedDuration = session.model.restDuration;
      confidence = 0.6;
      urgency = 'medium';
      autoExecute = false;
    }

    if (suggested) {
      this.lastBreakSuggestion = Date.now();
    }

    return {
      suggested,
      reason,
      recommendedDuration,
      confidence,
      autoExecute,
      urgency,
      insights: analysis.adaptationSuggestions
    };
  }

  /**
   * Execute a break suggestion
   */
  private executeBreakSuggestion(suggestion: BreakSuggestion): void {

    if (suggestion.autoExecute && suggestion.urgency === 'high') {
      // High urgency + auto-execute: force break
      this.enforceBreak(suggestion);
    } else {
      // Normal suggestions: show intelligent notification
      this.showSmartBreakSuggestion(suggestion);
    }
  }

  /**
   * Show intelligent break suggestion with adaptive messaging
   */
  private showSmartBreakSuggestion(suggestion: BreakSuggestion): void {

    const urgencyEmoji = suggestion.urgency === 'high' ? '🚨' : suggestion.urgency === 'medium' ? '⏰' : '💡';
    const breakTypeText = suggestion.recommendedDuration <= 5 ? 'quick refresh' :
                         suggestion.recommendedDuration >= 20 ? 'recovery break' : 'break';

    let message = `${urgencyEmoji} **ML Suggestion**: ${suggestion.reason}\n\n`;
    message += `Take a ${suggestion.recommendedDuration}-minute ${breakTypeText} to maintain peak performance.\n\n`;

    if (suggestion.insights.length > 0) {
      message += `💭 **Insights**: ${suggestion.insights.slice(0, 2).join(' • ')}\n\n`;
    }

    const confidencePercent = Math.round(suggestion.confidence * 100);
    message += `🎯 **Confidence**: ${confidencePercent}% (based on your activity patterns)`;

    vscode.window.showInformationMessage(
      message,
      'Take Suggested Break',
      'Continue Working',
      'Customize Break'
    ).then(selection => {
      if (selection === 'Take Suggested Break') {
        this.initiateSuggestedBreak(suggestion);
      } else if (selection === 'Customize Break') {
        this.showBreakDurationPicker(suggestion);
      }
      // Continue Working = do nothing
    });
  }

  /**
   * Enforce a break (for high urgency situations)
   */
  private enforceBreak(suggestion: BreakSuggestion): void {
    const message = `🚨 **AI Fatigue Protection**: ${suggestion.reason}\n\n`;
    const message2 = `Enforcing ${suggestion.recommendedDuration}-minute recovery break. Your well-being is important!\n\n`;
    const message3 = `⏸️ This break will start in 30 seconds - save your work.`;

    vscode.window.showWarningMessage(message + message2 + message3, 'Accept Break', 'Override (Not Recommended)');

    // Auto-start break after 30 seconds unless overridden
    const breakTimer = setTimeout(() => {
      if (this.isActive) { // Check if still relevant
        this.initiateSuggestedBreak(suggestion);
        vscode.window.showInformationMessage('🛋️ AI-enforced recovery break started. Take care of yourself!');
      }
    }, 30000);

    // Handle override option
    const overrideTimeout = setTimeout(() => {
      clearTimeout(breakTimer);
    }, 25000); // Clear break timer if user takes action
  }

  /**
   * Initiate a suggested break
   */
  private initiateSuggestedBreak(suggestion: BreakSuggestion): void {
    import('./workRestService').then(workRest => {
      // Force start rest period
      workRest.takeManualBreak();

      // Track ML-driven break
      usageAnalytics.trackBreakTaken('current_model', 'manual', suggestion.recommendedDuration);

      console.log(`ML-driven break initiated: ${suggestion.reason} (${suggestion.recommendedDuration}min, ${Math.round(suggestion.confidence * 100)}% confidence)`);
    });
  }

  /**
   * Force an early break based on ML analysis
   */
  private forceEarlyBreak(suggestion: BreakSuggestion): void {
    import('./workRestService').then(workRest => {
      workRest.endRestEarly();
      console.log(`ML-forced early break: ${suggestion.reason}`);
    });
  }

  /**
   * Extend current work period based on ML analysis
   */
  private extendWorkPeriod(extensionMinutes: number = 10): void {
    // This requires workRestService enhancement to support work period extensions
    import('./workRestService').then(workRest => {
      // For now, just log - would need workRestService modification
      console.log(`ML-suggested work extension: ${extensionMinutes} minutes`);
    });
  }

  /**
   * Show break duration picker for customization
   */
  private showBreakDurationPicker(suggestion: BreakSuggestion): void {
    const durations = [3, 5, 8, 10, 15, 20, 25];

    const items = durations.map(d => ({
      label: `${d}`,
      description: d === suggestion.recommendedDuration ? '(ML Recommended)' : '',
      detail: d === suggestion.recommendedDuration ? suggestion.reason : ''
    }));

    vscode.window.showQuickPick(
      items,
      {
        placeHolder: `Select break duration (ML suggests ${suggestion.recommendedDuration}min)`
      }
    ).then(selection => {
      if (selection) {
        const customDuration = parseInt(selection.label);
        if (customDuration !== suggestion.recommendedDuration) {
          // Track customization
          usageAnalytics.trackUserFeedback('ml_break_suggestion', customDuration > suggestion.recommendedDuration ? 4 : 3, 'custom_duration_selected');
        }

        this.initiateCustomBreak(customDuration);
      }
    });
  }

  /**
   * Initiate break with custom duration (placeholder - requires workRestService modification)
   */
  private initiateCustomBreak(duration: number): void {
    // For now, just start standard break - in future could modify rest duration
    import('./workRestService').then(() => {
      vscode.window.showInformationMessage(`Starting ${duration}-minute break as requested.`);
      // This would need workRestService enhancement to support custom durations
    });
  }

  /**
   * Check if current time is within learned peak productivity windows
   */
  private isInPeakProductivityWindow(): boolean {
    if (!this.activityMonitor) return false;

    try {
      const peakInsights = this.activityMonitor.getPeakPerformanceInsights();
      const now = new Date();
      const currentHour = now.getHours();

      return peakInsights.peakHours.some(peak => Math.abs(peak.hour - currentHour) <= 1);
    } catch (error) {
      console.warn('Failed to check peak productivity window:', error);
      return false;
    }
  }

  /**
   * Get current analysis state for UI display
   */
  getCurrentAnalysis(): SessionAnalysis | null {
    return this.currentAnalysis;
  }

  /**
   * Manually trigger analysis (for testing/debugging)
   */
  triggerManualAnalysis(): void {
    this.performSessionAnalysis();
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.stopSessionAnalysis();
  }
}

// Export singleton instance
export const realTimeSessionAnalyzer = RealTimeSessionAnalyzer.getInstance();
