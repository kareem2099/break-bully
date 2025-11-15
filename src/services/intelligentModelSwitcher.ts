import * as vscode from 'vscode';
import { state } from '../models/state';
import { getCurrentSession, switchToWorkRestModel, getAvailableModels } from './workRestService';
import { WorkRestModel } from '../types';
import { realTimeSessionAnalyzer, SessionAnalysis } from './realTimeSessionAnalyzer';
import { usageAnalytics } from './usageAnalyticsService';

export interface ModelPerformanceData {
  modelId: string;
  context: ModelContext;
  performance: {
    completionRate: number;
    satisfactionScore: number;
    effectiveWorkTime: number;
    breakEffectiveness: number;
  };
  timestamp: number;
}

export interface ModelContext {
  timeOfDay: 'morning' | 'afternoon' | 'evening';
  energyLevel: 'high' | 'medium' | 'low';
  workType: 'deep_coding' | 'debugging' | 'creative' | 'administrative' | 'review';
  sessionDuration: number;
  dayOfWeek: number;
}

export interface ModelRecommendation {
  recommendedModel: WorkRestModel;
  confidence: number;
  reason: string;
  expectedImprovement: string;
  alternativeModels: Array<{
    model: WorkRestModel;
    confidence: number;
    suitability: string;
  }>;
}

export interface SwitchingDecision {
  shouldSwitch: boolean;
  targetModel?: WorkRestModel;
  reason?: string;
  confidence?: number;
  expectedBenefit?: string;
  cooldownUntil?: number;
}

/**
 * Intelligent Model Switching Service
 * Learns optimal model patterns and automatically switches work-rest models
 * based on context, time, and performance data
 */
export class IntelligentModelSwitcher {

  private static instance: IntelligentModelSwitcher;
  private performanceHistory: ModelPerformanceData[] = [];
  private lastSwitchTime = 0;
  private switchingCooldown = 30 * 60 * 1000; // 30 minutes between automatic switches
  private isActive = false;

  private constructor() {
    this.loadPerformanceData();
    this.startIntelligentSwitching();
  }

  static getInstance(): IntelligentModelSwitcher {
    if (!IntelligentModelSwitcher.instance) {
      IntelligentModelSwitcher.instance = new IntelligentModelSwitcher();
    }
    return IntelligentModelSwitcher.instance;
  }

  /**
   * Start the intelligent switching system
   */
  private startIntelligentSwitching(): void {
    this.isActive = true;

    // Check for model switches every 10 minutes during active sessions
    setInterval(() => {
      if (this.isActive) {
        this.evaluateModelSwitching();
      }
    }, 10 * 60 * 1000);

    // Also check when session analysis updates (more frequent)
    setInterval(() => {
      if (this.isActive) {
        this.checkRealTimeSwitching();
      }
    }, 5 * 60 * 1000);

    console.log('Intelligent model switching system activated');
  }

  /**
   * Stop the intelligent switching system
   */
  stopIntelligentSwitching(): void {
    this.isActive = false;
    this.savePerformanceData();
    console.log('Intelligent model switching stopped');
  }

  /**
   * Record performance data for a completed model session
   */
  recordModelPerformance(
    modelId: string,
    sessionDuration: number,
    completionRate: number,
    userSatisfaction?: number
  ): void {

    const context = this.analyzeCurrentContext();
    const effectiveWorkTime = sessionDuration * completionRate;

    const performanceData: ModelPerformanceData = {
      modelId,
      context,
      performance: {
        completionRate,
        satisfactionScore: userSatisfaction || 3.5, // Default neutral rating
        effectiveWorkTime,
        breakEffectiveness: this.calculateBreakEffectiveness(sessionDuration, userSatisfaction)
      },
      timestamp: Date.now()
    };

    this.performanceHistory.push(performanceData);

    // Keep only recent data (last 90 days)
    const ninetyDaysAgo = Date.now() - (90 * 24 * 60 * 60 * 1000);
    this.performanceHistory = this.performanceHistory.filter(p => p.timestamp > ninetyDaysAgo);

    console.log(`Recorded model performance: ${modelId} (${completionRate.toFixed(1)}% completion, context: ${context.timeOfDay}/${context.energyLevel})`);
  }

  /**
   * Record a model selection for context-specific learning
   */
  recordModelSelection(modelId: string, reason: string): void {
    const context = this.analyzeCurrentContext();

    // Store context for learning purposes (can be used to improve recommendations)
    console.log(`Model selected: ${modelId} for ${reason}, context: ${context.timeOfDay}/${context.energyLevel}/${context.workType}`);

    // Could track selections in a separate history if needed for future enhancement
  }

  /**
   * Evaluate if a model switch should be made
   */
  private async evaluateModelSwitching(): Promise<void> {
    if (!this.canSwitchModels()) return;

    const currentSession = getCurrentSession();
    if (!currentSession || !currentSession.isWorking) return;

    const decision = await this.makeSwitchingDecision();
    if (decision.shouldSwitch && decision.targetModel) {
      await this.executeModelSwitch(decision);
    }
  }

  /**
   * Check for real-time switching opportunities during session analysis
   */
  private checkRealTimeSwitching(): void {
    const analysis = realTimeSessionAnalyzer.getCurrentAnalysis();
    if (!analysis) return;

    // Check for urgent context changes
    const currentContext = this.analyzeCurrentContext();
    const session = getCurrentSession();
    if (!session) return;

    // Use currentContext for future enhancement tracking
    console.debug(`Real-time switching context: ${currentContext.timeOfDay} ${currentContext.energyLevel} energy, work type: ${currentContext.workType}`);

    // Time-based switching (morning → afternoon → evening)
    const hour = new Date().getHours();
    const currentModelTimeCategory = session.model.id.includes('morning') ? 'morning' :
                                   session.model.id.includes('afternoon') ? 'afternoon' :
                                   session.model.id.includes('evening') ? 'evening' : 'general';

    if (this.shouldSwitchTimeBased(hour, currentModelTimeCategory)) {
      const timeBasedRecommendation = this.getTimeBasedRecommendation(hour);
      if (timeBasedRecommendation) {
        this.suggestTimeBasedSwitch(timeBasedRecommendation);
      }
    }

    // Work type changes (deep coding → debugging, etc.)
    const currentWorkType = this.detectCurrentWorkTypeFromAnalysis(analysis);
    if (currentWorkType && this.shouldSwitchWorkType(session.model, currentWorkType)) {
      const workTypeRecommendation = this.getWorkTypeRecommendation(currentWorkType);
      if (workTypeRecommendation) {
        this.suggestWorkTypeSwitch(workTypeRecommendation);
      }
    }
  }

  /**
   * Make a decision about whether to switch models
   */
  private async makeSwitchingDecision(): Promise<SwitchingDecision> {
    const currentSession = getCurrentSession();
    if (!currentSession) return { shouldSwitch: false };

    const currentContext = this.analyzeCurrentContext();
    const currentModel = currentSession.model;

    // Get recommendation for current context
    const recommendation = this.getModelRecommendation(currentContext);

    if (!recommendation || recommendation.recommendedModel.id === currentModel.id) {
      return { shouldSwitch: false };
    }

    // Check if recommendation confidence is high enough
    if (recommendation.confidence < 0.7) {
      return { shouldSwitch: false };
    }

    // Check if we're in the switching cooldown period
    const timeSinceLastSwitch = Date.now() - this.lastSwitchTime;
    if (timeSinceLastSwitch < this.switchingCooldown) {
      return { shouldSwitch: false };
    }

    // Don't switch if session is very short (less than 30 minutes)
    const sessionElapsed = (Date.now() - currentSession.startTime.getTime()) / (1000 * 60);
    if (sessionElapsed < 30) {
      return { shouldSwitch: false };
    }

    // Calculate expected benefit
    const expectedBenefit = this.calculateExpectedBenefit(currentModel, recommendation.recommendedModel, currentContext);

    // Only switch if expected benefit is significant
    if (expectedBenefit < 15) { // Less than 15% improvement
      return { shouldSwitch: false };
    }

    return {
      shouldSwitch: true,
      targetModel: recommendation.recommendedModel,
      reason: recommendation.reason,
      confidence: recommendation.confidence,
      expectedBenefit: `${Math.round(expectedBenefit)}% performance improvement`
    };
  }

  /**
   * Get optimal model recommendation for a given context
   */
  private getModelRecommendation(context: ModelContext): ModelRecommendation | null {
    const availableModels = getAvailableModels();
    const relevantHistory = this.getRelevantPerformanceHistory(context);

    if (relevantHistory.length < 3) {
      // Not enough data, fall back to basic time-based recommendations
      return this.getfallbackRecommendation(context);
    }

    // Rate each model for this context
    const modelRatings = availableModels.map(model => {
      const modelHistory = relevantHistory.filter(h => h.modelId === model.id);

      if (modelHistory.length === 0) {
        // No data for this model in this context
        return {
          model,
          score: 0.3, // Low base score
          confidence: 0.2
        };
      }

      const avgCompletion = modelHistory.reduce((sum, h) => sum + h.performance.completionRate, 0) / modelHistory.length;
      const avgSatisfaction = modelHistory.reduce((sum, h) => sum + h.performance.satisfactionScore, 0) / modelHistory.length;
      const avgEffectiveness = modelHistory.reduce((sum, h) => sum + h.performance.breakEffectiveness, 0) / modelHistory.length;

      // Weighted score: 40% completion, 30% satisfaction, 30% break effectiveness
      const score = (avgCompletion * 0.4) + ((avgSatisfaction - 1) / 4 * 0.3) + (avgEffectiveness * 0.3); // Normalize satisfaction 1-5 to 0-1
      const confidence = Math.min(0.95, modelHistory.length / 10); // Confidence increases with more data

      return { model, score, confidence };
    });

    // Sort by score
    modelRatings.sort((a, b) => b.score - a.score);

    const bestModel = modelRatings[0];
    const alternatives = modelRatings.slice(1, 4); // Top 3 alternatives

    return {
      recommendedModel: bestModel.model,
      confidence: bestModel.confidence,
      reason: this.generateRecommendationReason(context, bestModel.model),
      expectedImprovement: `${Math.round((bestModel.score - (modelRatings[3]?.score || 0.5)) * 100)}% better performance`,
      alternativeModels: alternatives.map(alt => ({
        model: alt.model,
        confidence: alt.confidence,
        suitability: this.generateAlternativeReason(context, alt.model)
      }))
    };
  }

  /**
   * Execute an automatic model switch
   */
  private async executeModelSwitch(decision: SwitchingDecision): Promise<void> {
    if (!decision.targetModel) return;

    const currentModel = getCurrentSession()?.model;
    if (!currentModel || decision.targetModel.id === currentModel.id) return;

    // Execute the switch
    switchToWorkRestModel(decision.targetModel);
    this.lastSwitchTime = Date.now();

    // Track the automatic switch
    usageAnalytics.trackModelSelection(decision.targetModel.id, 'ai_recommendation');

    // Notify user about the switch
    const confidencePercent = Math.round((decision.confidence || 0) * 100);
    vscode.window.showInformationMessage(
      `🤖 **Intelligent Model Switch**: ${currentModel.name} → ${decision.targetModel.name}
      
📈 **Expected**: ${decision.expectedBenefit}
🎯 **Confidence**: ${confidencePercent}%
💬 **Reason**: ${decision.reason}

This switch was made based on your activity patterns and performance data. Override if needed!`,
      'Keep New Model',
      'Switch Back',
      'Disable Auto-Switching'
    ).then(selection => {
      if (selection === 'Switch Back') {
        // Revert the switch
        switchToWorkRestModel(currentModel);
        usageAnalytics.trackUserFeedback(decision.targetModel!.id, 2, 'user_reverted_switch');
        vscode.window.showInformationMessage('Switched back to previous model');
      } else if (selection === 'Disable Auto-Switching') {
        this.stopIntelligentSwitching();
        vscode.window.showInformationMessage('Automatic model switching disabled');
      }
    });

    console.log(`Intelligent model switch: ${currentModel.name} → ${decision.targetModel.name} (${decision.reason})`);
  }

  /**
   * Get performance history relevant to a context
   */
  private getRelevantPerformanceHistory(context: ModelContext): ModelPerformanceData[] {
    return this.performanceHistory.filter(history => {
      // Same time of day
      if (history.context.timeOfDay !== context.timeOfDay) return false;

      // Similar work type
      if (history.context.workType !== context.workType) return false;

      // Within 30 days
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      return history.timestamp > thirtyDaysAgo;
    });
  }

  /**
   * Generate recommendation reason text
   */
  private generateRecommendationReason(context: ModelContext, model: WorkRestModel): string {
    const timeName = context.timeOfDay.charAt(0).toUpperCase() + context.timeOfDay.slice(1);
    const workType = context.workType.replace('_', ' ');
    const workTypeName = workType.charAt(0).toUpperCase() + workType.slice(1);

    return `Optimized for ${timeName} ${workTypeName} (${model.workDuration}min work, ${model.restDuration}min rest)`;
  }

  /**
   * Generate alternative model suitability text
   */
  private generateAlternativeReason(context: ModelContext, model: WorkRestModel): string {
    return `Good ${context.energyLevel} energy option (${model.workDuration}min work)`;
  }

  /**
   * Calculate expected benefit of switching models
   */
  private calculateExpectedBenefit(
    currentModel: WorkRestModel,
    newModel: WorkRestModel,
    context: ModelContext
  ): number {

    const currentRating = this.getModelRating(currentModel.id, context);
    const newRating = this.getModelRating(newModel.id, context);

    return Math.max(0, (newRating - currentRating) * 100); // Percentage improvement
  }

  /**
   * Get model rating for a specific context
   */
  private getModelRating(modelId: string, context: ModelContext): number {
    const relevantHistory = this.getRelevantPerformanceHistory(context);
    const modelHistory = relevantHistory.filter(h => h.modelId === modelId);

    if (modelHistory.length === 0) return 0.5; // Default rating

    const avgCompletion = modelHistory.reduce((sum, h) => sum + h.performance.completionRate, 0) / modelHistory.length;
    const avgSatisfaction = modelHistory.reduce((sum, h) => sum + h.performance.satisfactionScore, 0) / modelHistory.length;

    return (avgCompletion * 0.6) + ((avgSatisfaction - 1) / 4 * 0.4); // Weighted average
  }

  /**
   * Check if models can be switched (cooldown, session state, etc.)
   */
  private canSwitchModels(): boolean {
    const timeSinceLastSwitch = Date.now() - this.lastSwitchTime;
    return timeSinceLastSwitch >= this.switchingCooldown;
  }

  /**
   * Analyze current context factors
   */
  private analyzeCurrentContext(): ModelContext {
    const now = new Date();
    const hour = now.getHours();

    // Time of day classification
    const timeOfDay = hour >= 6 && hour < 12 ? 'morning' :
                     hour >= 12 && hour < 17 ? 'afternoon' : 'evening';

    // Energy level estimation (could be enhanced with activity data)
    const energyLevel: ModelContext['energyLevel'] = hour >= 9 && hour <= 14 ? 'high' : // Typical peak energy hours
                                                  hour >= 7 && hour <= 17 ? 'medium' : 'low';

    // Work type detection from real-time analysis
    const sessionAnalysis = realTimeSessionAnalyzer.getCurrentAnalysis();
    const workType = this.detectCurrentWorkTypeFromAnalysis(sessionAnalysis);

    // Session duration
    const currentSession = getCurrentSession();
    const sessionDuration = currentSession ?
      (Date.now() - currentSession.startTime.getTime()) / (1000 * 60) : 0;

    return {
      timeOfDay,
      energyLevel,
      workType,
      sessionDuration,
      dayOfWeek: now.getDay()
    };
  }

  /**
   * Detect work type from session analysis
   */
  private detectCurrentWorkTypeFromAnalysis(analysis: SessionAnalysis | null): ModelContext['workType'] {
    if (!analysis) return 'deep_coding';

    // Enhanced work type detection based on typing patterns
    if (analysis.fatigueSignals >= 6 && (analysis.adaptationSuggestions as string[]).some(s => s.includes('debugging'))) {
      return 'debugging';
    }

    if ((analysis.adaptationSuggestions as string[]).some(s => s.includes('creative'))) {
      return 'creative';
    }

    if ((analysis.adaptationSuggestions as string[]).some(s => s.includes('task switching'))) {
      return 'administrative';
    }

    if ((analysis.adaptationSuggestions as string[]).some(s => s.includes('Deep work'))) {
      return 'deep_coding';
    }

    return 'deep_coding'; // Default
  }

  /**
   * Should switch based on time changes
   */
  private shouldSwitchTimeBased(hour: number, currentTimeCategory: string): boolean {
    const newTimeCategory = hour >= 6 && hour < 12 ? 'morning' :
                           hour >= 12 && hour < 17 ? 'afternoon' : 'evening';

    return newTimeCategory !== currentTimeCategory;
  }

  /**
   * Get time-based recommendation
   */
  private getTimeBasedRecommendation(hour: number): ModelRecommendation | null {
    const timeOfDay = hour >= 6 && hour < 12 ? 'morning' :
                     hour >= 12 && hour < 17 ? 'afternoon' : 'evening';

    const context: ModelContext = {
      timeOfDay,
      energyLevel: 'medium',
      workType: 'deep_coding',
      sessionDuration: 0,
      dayOfWeek: new Date().getDay()
    };

    return this.getModelRecommendation(context);
  }

  /**
   * Get work type specific recommendation
   */
  private getWorkTypeRecommendation(workType: ModelContext['workType']): ModelRecommendation | null {
    const context: ModelContext = {
      timeOfDay: 'afternoon', // Assume current context
      energyLevel: 'medium',
      workType,
      sessionDuration: 0,
      dayOfWeek: new Date().getDay()
    };

    return this.getModelRecommendation(context);
  }

  /**
   * Should switch based on work type changes
   */
  private shouldSwitchWorkType(currentModel: WorkRestModel, newWorkType: ModelContext['workType']): boolean {
    // Analyze current model's suitability for the work type
    const currentWorkType = this.inferModelWorkType(currentModel);
    return currentWorkType !== newWorkType;
  }

  /**
   * Infer work type from model characteristics
   */
  private inferModelWorkType(model: WorkRestModel): ModelContext['workType'] {
    if (model.workDuration >= 60) return 'deep_coding';
    if (model.restDuration >= 20) return 'debugging';
    if (model.restDuration <= 5) return 'administrative';
    return 'creative';
  }

  /**
   * Suggest time-based model switch
   */
  private suggestTimeBasedSwitch(recommendation: ModelRecommendation): void {
    if (Math.random() > 0.3) return; // Only suggest occasionally to avoid annoyance

    vscode.window.showInformationMessage(
      `🕐 **Time-Based Suggestion**: ${recommendation.recommendedModel.name}
      
💡 **Reason**: ${recommendation.reason}
🎯 **Confidence**: ${Math.round(recommendation.confidence * 100)}%

Would you like to switch to this time-optimized model?`,
      'Switch Now',
      'Later',
      'Turn Off Suggestions'
    ).then(selection => {
      if (selection === 'Switch Now') {
        switchToWorkRestModel(recommendation.recommendedModel);
      } else if (selection === 'Turn Off Suggestions') {
        this.stopIntelligentSwitching();
      }
    });
  }

  /**
   * Suggest work type based switch
   */
  private suggestWorkTypeSwitch(recommendation: ModelRecommendation): void {
    vscode.window.showInformationMessage(
      `🎯 **Work Context Switch**: ${recommendation.recommendedModel.name}
      
💡 **Reason**: ${recommendation.reason}
🎯 **Confidence**: ${Math.round(recommendation.confidence * 100)}%

This model is better suited for your current work type.`,
      'Switch Now',
      'Keep Current',
      'Disable Suggestions'
    ).then(selection => {
      if (selection === 'Switch Now') {
        switchToWorkRestModel(recommendation.recommendedModel);
      } else if (selection === 'Disable Suggestions') {
        this.stopIntelligentSwitching();
      }
    });
  }

  /**
   * Fallback recommendation when no data is available
   */
  private getfallbackRecommendation(context: ModelContext): ModelRecommendation | null {
    const availableModels = getAvailableModels();

    // Morning - higher energy, longer work periods
    if (context.timeOfDay === 'morning') {
      const morningModel = availableModels.find(m => m.workDuration >= 45) || availableModels[0];
      return {
        recommendedModel: morningModel,
        confidence: 0.6,
        reason: 'Morning energy focus - longer work periods',
        expectedImprovement: 'Based on typical morning energy patterns',
        alternativeModels: []
      };
    }

    // Afternoon - sustained focus
    if (context.timeOfDay === 'afternoon') {
      const afternoonModel = availableModels.find(m => m.workDuration >= 35) || availableModels[0];
      return {
        recommendedModel: afternoonModel,
        confidence: 0.6,
        reason: 'Afternoon sustained productivity',
        expectedImprovement: 'Optimized for post-lunch focus',
        alternativeModels: []
      };
    }

    // Evening - shorter sessions, recovery focus
    const eveningModel = availableModels.find(m => m.workDuration <= 30) || availableModels[0];
    return {
      recommendedModel: eveningModel,
      confidence: 0.6,
      reason: 'Evening recovery - shorter, gentler sessions',
      expectedImprovement: 'Better for winding down',
      alternativeModels: []
    };
  }

  /**
   * Calculate break effectiveness metric
   */
  private calculateBreakEffectiveness(sessionDuration: number, userSatisfaction?: number): number {
    // Base effectiveness on satisfaction and session completion
    if (!userSatisfaction) return 0.5;

    // Shorter sessions with high satisfaction = very effective breaks
    // Longer sessions with low satisfaction = ineffective breaks
    const normalizedDuration = Math.min(sessionDuration / 120, 1); // Normalize to 2-hour max
    const satisfactionEffect = (userSatisfaction - 1) / 4; // Convert 1-5 to 0-1

    return (satisfactionEffect * 0.6) + ((1 - normalizedDuration) * 0.4); // Weighted formula
  }

  /**
   * Save performance data to storage
   */
  private savePerformanceData(): void {
    const dataToSave = {
      performanceHistory: this.performanceHistory.slice(-200), // Keep last 200 entries
      lastSwitchTime: this.lastSwitchTime,
      isActive: this.isActive
    };

    state.storage?.saveCustomSetting('intelligentModelSwitcher', dataToSave);
  }

  /**
   * Load performance data from storage
   */
  private loadPerformanceData(): void {
    try {
      const savedData = state.storage?.loadCustomSetting('intelligentModelSwitcher') as {
        performanceHistory?: ModelPerformanceData[];
        lastSwitchTime?: number;
        isActive?: boolean;
      } | undefined;
      if (savedData) {
        this.performanceHistory = savedData.performanceHistory || [];
        this.lastSwitchTime = savedData.lastSwitchTime || 0;
        this.isActive = savedData.isActive !== undefined ? savedData.isActive : true;
      }
    } catch (error) {
      console.warn('Failed to load performance data:', error);
      // Initialize with defaults
      this.performanceHistory = [];
      this.lastSwitchTime = 0;
      this.isActive = true;
    }
  }
}
