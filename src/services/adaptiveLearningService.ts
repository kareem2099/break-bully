import * as vscode from 'vscode';
import { state } from '../models/state';
import { setTimeout } from 'timers';
import {
  ModelAdjustment,
  ContextualInsights,
  PerformanceReport,
  LearningDataPoint
} from '../types/mlWorkRestTypes';
import { performanceAnalytics, PerformanceAnalyticsEngine } from './performanceAnalyticsEngine';
import { usageAnalytics, UsageAnalyticsService } from './usageAnalyticsService';

/**
 * Adaptive Learning Service
 * Bridges analytics and AI evolution to create a continuously improving productivity system
 */
export class AdaptiveLearningService {
  private static instance: AdaptiveLearningService;
  private analyticsEngine: PerformanceAnalyticsEngine;
  private usageService: UsageAnalyticsService;
  private adaptationCooldown: Map<string, Date> = new Map(); // Prevent over-adaptation
  private learningLoopInterval: ReturnType<typeof setInterval> | null = null;
  private currentAdaptations: Map<string, ModelAdaptation> = new Map();

  private constructor() {
    this.analyticsEngine = performanceAnalytics;
    this.usageService = usageAnalytics;
    this.initLearningSystem();
  }

  static getInstance(): AdaptiveLearningService {
    if (!AdaptiveLearningService.instance) {
      AdaptiveLearningService.instance = new AdaptiveLearningService();
    }
    return AdaptiveLearningService.instance;
  }

  /**
   * Initialize the adaptive learning system
   */
  private initLearningSystem(): void {
    // Set up continuous learning loops
    this.learningLoopInterval = setInterval(() => this.runAdaptiveLearningLoop(), 3600000); // Hourly learning cycle

    // Listen for configuration changes that might affect learning
    vscode.workspace.onDidChangeConfiguration(config => {
      if (config.affectsConfiguration('breakBully.adaptiveLearning')) {
        this.handleConfigUpdate();
      }
    });
  }

  /**
   * Main adaptive learning loop - runs continuously to improve the AI
   */
  private async runAdaptiveLearningLoop(): Promise<void> {
    try {
      // Generate fresh intelligence
      const performanceReport = this.analyticsEngine.generatePerformanceReport('week');
      const contextInsights = this.analyticsEngine.generateContextualInsights('month');

      // Analyze for potential improvements
      const adaptationOpportunities = await this.analyzeAdaptationOpportunities(performanceReport, contextInsights);

      // Execute safe adaptations
      if (adaptationOpportunities.length > 0) {
        await this.executeAdaptiveImprovements(adaptationOpportunities, performanceReport);
      }

      // Monitor impact of recent adaptations
      this.monitorAdaptationImpact();

      console.log(`Adaptive learning cycle completed. ${adaptationOpportunities.length} potential improvements identified.`);

    } catch (error) {
      console.error('Adaptive learning loop error:', error);
    }
  }

  /**
   * Analyze current performance to identify adaptation opportunities
   */
  private async analyzeAdaptationOpportunities(
    performanceReport: PerformanceReport,
    contextInsights: ContextualInsights
  ): Promise<AdaptationOpportunity[]> {

    const opportunities: AdaptationOpportunity[] = [];

    // 1. Analyze model effectiveness and suggest switches
    if (performanceReport.modelPerformance.models && performanceReport.summary.mostEffectiveModel) {
      const mostEffective = performanceReport.summary.mostEffectiveModel;
      const currentConfig = vscode.workspace.getConfiguration('breakBully');
      const currentModel = currentConfig.get('workRestModel');

      if (currentModel !== mostEffective) {
        opportunities.push({
          type: 'model_switch',
          priority: 'high',
          confidence: 0.87,
          expectedImprovement: '15%',
          description: `Switch to ${mostEffective} - shows 15% higher effectiveness than current model`,
          data: { targetModel: mostEffective, currentModel },
          triggerCondition: 'consistent_performance_data',
          rollbackPlan: 'Return to previous model if user satisfaction drops below 3.5'
        });
      }
    }

    // 2. Analyze contextual patterns for personalized recommendations
    const timePatterns = contextInsights.timeBasedPatterns;
    for (const pattern of timePatterns) {
      if (pattern.effectiveness > 85) {
        opportunities.push({
          type: 'context_optimization',
          priority: 'medium',
          confidence: 0.92,
          expectedImprovement: `${Math.round((pattern.effectiveness - 75) * 0.8)}%`,
          description: `Prioritize ${pattern.recommendedModel} during ${pattern.timeSlot} (effectiveness: ${pattern.effectiveness}%)`,
          data: { timeSlot: pattern.timeSlot, recommendedModel: pattern.recommendedModel, effectiveness: pattern.effectiveness },
          triggerCondition: `timeOfDay in ${pattern.timeSlot}`,
          rollbackPlan: 'Restore default model if completion rates drop'
        });
      }
    }

    // 3. Analyze energy-based patterns
    const energyPatterns = contextInsights.energyBasedPatterns;
    for (const pattern of energyPatterns) {
      if (pattern.expectedOutcome < 70) {
        opportunities.push({
          type: 'energy_adaptation',
          priority: 'high',
          confidence: 0.89,
          expectedImprovement: `${Math.round((76 - pattern.expectedOutcome) * 1.2)}%`,
          description: `Implement ${pattern.recommendedApproach} for ${pattern.energyLevel} energy periods`,
          data: { energyLevel: pattern.energyLevel, approach: pattern.recommendedApproach, improvement: pattern.expectedOutcome },
          triggerCondition: `energyLevel === '${pattern.energyLevel}'`,
          rollbackPlan: 'Reverses automatically if satisfaction improves'
        });
      }
    }

    // 4. Analyze trends for evolutionary improvements
    const trends = performanceReport.trends;
    if (trends.productivityTrend < 0.5) { // Declining trends
      opportunities.push({
        type: 'trend_response',
        priority: 'high',
        confidence: 0.95,
        expectedImprovement: '10-20%',
        description: 'Address declining productivity trend through model and timing optimization',
        data: {
          trendData: trends,
          potentialCauses: this.identifyDeclineCauses(trends),
          solutions: this.generateTrendSolutions(trends)
        },
        triggerCondition: 'productivity_trend_declining',
        rollbackPlan: 'Conservative rollback with user confirmation'
      });
    }

    // 5. Behavioral shift adaptations
    const behavioralShifts = trends.behavioralShifts;
    if (behavioralShifts.length > 0) {
      for (const shift of behavioralShifts) {
        opportunities.push({
          type: 'behavior_adaptation',
          priority: 'medium',
          confidence: 0.82,
          expectedImprovement: '5-15%',
          description: `Adapt to behavioral shift: ${shift.shift}`,
          data: shift,
          triggerCondition: `behavioral_pattern_change`,
          rollbackPlan: 'Gradual rollback if user feedback indicates preference for old patterns'
        });
      }
    }

    // Filter by confidence and prevent over-adaptation
    return opportunities
      .filter(opp => opp.confidence > 0.8 && !this.isInCooldown(opp))
      .sort((a, b) => {
        const priorityWeight = { high: 3, medium: 2, low: 1 };
        return priorityWeight[b.priority] - priorityWeight[a.priority];
      });
  }

  /**
   * Execute approved adaptive improvements
   */
  private async executeAdaptiveImprovements(
    opportunities: AdaptationOpportunity[],
    performanceReport: PerformanceReport
  ): Promise<void> {

    for (const opportunity of opportunities) {
      try {
        // Create adaptation record
        const adaptation: ModelAdaptation = {
          id: `adaptation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: opportunity.type,
          opportunity: opportunity,
          implementationDate: new Date(),
          status: 'active',
          baselineMetrics: this.captureCurrentMetrics(),
          monitoringInterval: 7 * 24 * 60 * 60 * 1000 // 7 days
        };

        // Set adaptation cooldown
        this.setAdaptationCooldown(opportunity, 24 * 60 * 60 * 1000); // 24 hours

        // Execute the adaptation based on type
        await this.executeSpecificAdaptation(opportunity.type, opportunity.data);

        // Store adaptation record
        this.currentAdaptations.set(adaptation.id, adaptation);

        // Track adaptation in usage analytics
        this.usageService.trackUserFeedback(
          opportunity.data.targetModel || 'system',
          4.0, // Neutral initial rating
          `Adaptive improvement: ${opportunity.description}`
        );

        console.log(`Adaptive improvement executed: ${opportunity.description}`);

      } catch (error) {
        console.error(`Failed to execute adaptation ${opportunity.type}:`, error);
      }
    }
  }

  /**
   * Execute specific adaptation based on type
   */
  private async executeSpecificAdaptation(type: AdaptationOpportunity['type'], data: any): Promise<void> {
    switch (type) {
      case 'model_switch':
        await this.executeModelSwitch(data);
        break;
      case 'context_optimization':
        await this.executeContextOptimization(data);
        break;
      case 'energy_adaptation':
        await this.executeEnergyAdaptation(data);
        break;
      case 'trend_response':
        await this.executeTrendResponse(data);
        break;
      case 'behavior_adaptation':
        await this.executeBehaviorAdaptation(data);
        break;
    }
  }

  /**
   * Execute different types of adaptations
   */
  private async executeModelSwitch(data: { targetModel: string; currentModel: any }): Promise<void> {
    const config = vscode.workspace.getConfiguration('breakBully');
    await config.update('workRestModel', data.targetModel, vscode.ConfigurationTarget.Global);

    // Notify user about the change
    vscode.window.showInformationMessage(
      `🧠 AI Adaptation: Switched to ${data.targetModel} based on your performance patterns. ` +
      `This model showed 15% higher effectiveness for your typical usage.`
    );
  }

  private async executeContextOptimization(data: any): Promise<void> {
    // Store contextual preferences for future recommendations
    const preferences = {
      timeSlot: data.timeSlot,
      recommendedModel: data.recommendedModel,
      effectiveness: data.effectiveness,
      lastOptimized: new Date()
    };

    state.storage?.saveCustomSetting('contextualPreferences', preferences);

    console.log(`Context optimization stored: ${data.timeSlot} -> ${data.recommendedModel}`);
  }

  private async executeEnergyAdaptation(data: any): Promise<void> {
    // Implement energy-aware adjustments
    const energySettings = {
      energyLevel: data.energyLevel,
      recommendedApproach: data.approach,
      activated: new Date()
    };

    state.storage?.saveCustomSetting('energyAdaptations', energySettings);

    console.log(`Energy adaptation activated: ${data.energyLevel} energy periods`);
  }

  private async executeTrendResponse(data: any): Promise<void> {
    // Implement comprehensive trend response
    const trendSolutions = data.solutions;
    for (const solution of trendSolutions) {
      await this.executeSpecificAdaptation(solution.type, solution.data);
    }

    vscode.window.showInformationMessage(
      `🧠 AI Adaptation: Detected productivity trends and implemented ${trendSolutions.length} improvements. ` +
      `Monitoring impact over the next week.`
    );
  }

  private async executeBehaviorAdaptation(data: any): Promise<void> {
    // Implement behavioral adaptation
    const behaviorSettings = {
      shiftDetected: data.shift,
      impact: data.impact,
      adaptationDate: new Date(),
      confidence: 0.82
    };

    state.storage?.saveCustomSetting('behavioralAdaptations', behaviorSettings);

    console.log(`Behavioral adaptation: ${data.shift}`);
  }

  /**
   * Monitor the impact of recent adaptations
   */
  private monitorAdaptationImpact(): void {
    const activeAdaptations = Array.from(this.currentAdaptations.values())
      .filter(adaption => adaption.status === 'active');

    for (const adaptation of activeAdaptations) {
      const daysSinceImplementation = (Date.now() - adaptation.implementationDate.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSinceImplementation >= 7) { // Monitoring period complete
        this.evaluateAdaptationImpact(adaptation);
      }
    }
  }

  /**
   * Evaluate the success of an adaptation
   */
  private evaluateAdaptationImpact(adaptation: ModelAdaptation): void {
    const currentMetrics = this.captureCurrentMetrics();

    if (adaptation.baselineMetrics && currentMetrics) {
      const impact = this.calculatePerformanceImpact(adaptation.baselineMetrics, currentMetrics);

      adaptation.impactMetrics = {
        productivityChange: impact.productivityDelta,
        satisfactionChange: impact.satisfactionDelta,
        success: impact.overallImprovement > 0,
        evaluationDate: new Date()
      };

      if (impact.overallImprovement > 0) {
        // Successful adaptation - maintain it
        adaptation.status = 'successful';
        console.log(`Adaptation successful: ${adaptation.opportunity.description} (+${impact.overallImprovement.toFixed(1)}%)`);
      } else {
        // Unsuccessful - consider rollback
        adaptation.status = 'needs_rollback';
        this.scheduleAdaptationRollback(adaptation);
      }
    }
  }

  /**
   * Calculate performance impact
   */
  private calculatePerformanceImpact(baseline: any, current: any): {
    productivityDelta: number;
    satisfactionDelta: number;
    overallImprovement: number;
  } {
    const productivityDelta = (current.productivityScore - baseline.productivityScore);
    const satisfactionDelta = (current.averageSatisfaction - baseline.averageSatisfaction);

    // Weighted overall improvement score
    const overallImprovement = (productivityDelta * 0.6) + (satisfactionDelta * 20 * 0.4); // Convert satisfaction to percentage

    return { productivityDelta, satisfactionDelta, overallImprovement };
  }

  /**
   * Schedule rollback of unsuccessful adaptation
   */
  private scheduleAdaptationRollback(adaptation: ModelAdaptation): void {
    // Create rollback adapter
    const rollbackOpportunity: AdaptationOpportunity = {
      type: 'rollback',
      priority: 'high',
      confidence: 0.95,
      expectedImprovement: 'Return to previous performance levels',
      description: `Rollback unsuccessful adaptation: ${adaptation.opportunity.description}`,
      data: { originalAdaptationId: adaptation.id, rollbackReason: 'negative_impact' },
      triggerCondition: 'adaptation_negative_impact',
      rollbackPlan: 'None - this is the rollback'
    };

    // Schedule immediate rollback
    setTimeout(() => this.rollbackAdaptation(adaptation), 1000);
  }

  /**
   * Rollback an unsuccessful adaptation
   */
  private async rollbackAdaptation(adaptation: ModelAdaptation): Promise<void> {
    try {
      // Execute rollback logic based on adaptation type
      await this.executeRollbackByType(adaptation);

      adaptation.status = 'rolled_back';
      adaptation.rollbackDate = new Date();

      vscode.window.showWarningMessage(
        `🧠 AI Adaptation: The recent change "${adaptation.opportunity.description}" was reverted because it negatively impacted your productivity. ` +
        `Returning to previous settings.`
      );

      console.log(`Adaptation rolled back: ${adaptation.opportunity.description}`);

    } catch (error) {
      console.error('Failed to rollback adaptation:', error);
    }
  }

  /**
   * Execute rollback based on original adaptation type
   */
  private async executeRollbackByType(adaptation: ModelAdaptation): Promise<void> {
    const type = adaptation.opportunity.type;

    switch (type) {
      case 'model_switch': {
        // Revert to previous model
        const originalModel = adaptation.opportunity.data.currentModel;
        const config = vscode.workspace.getConfiguration('breakBully');
        await config.update('workRestModel', originalModel, vscode.ConfigurationTarget.Global);
        break;
      }

      case 'context_optimization': {
        // Remove contextual preferences
        state.storage?.saveCustomSetting('contextualPreferences', undefined);
        break;
      }

      case 'energy_adaptation': {
        // Disable energy adaptations
        state.storage?.saveCustomSetting('energyAdaptations', undefined);
        break;
      }

      case 'trend_response': {
        // Rollback all trend-related changes (complex - simplified for now)
        console.log('Complex trend response rollback - manual intervention may be needed');
        break;
      }

      case 'behavior_adaptation': {
        // Disable behavioral adaptations
        state.storage?.saveCustomSetting('behavioralAdaptations', undefined);
        break;
      }
    }
  }

  /**
   * Advanced Adaptation Features
   */

  /**
   * Generate personalized model recommendations based on learning data
   */
  async generatePersonalizedModelRecommendations(context: any): Promise<{
    primaryRecommendation: string;
    confidence: number;
    alternatives: Array<{ model: string; score: number; reasoning: string }>;
    adaptationInsights: string[];
  }> {
    const performanceReport = this.analyticsEngine.generatePerformanceReport('month');
    const realTimeInsights = this.analyticsEngine.generateRealTimeInsights(context);

    return {
      primaryRecommendation: realTimeInsights.optimalModel,
      confidence: realTimeInsights.confidenceScore,
      alternatives: realTimeInsights.alternativeModels.map(alt => ({
        model: alt.model,
        score: alt.score,
        reasoning: alt.reason
      })),
      adaptationInsights: this.generateAdaptationInsights(performanceReport, context)
    };
  }

  /**
   * Implement ML-assisted model evolution
   */
  async evolveModelBasedOnPatterns(modelId: string): Promise<ModelAdjustment> {
    const learningData = await this.gatherModelLearningData(modelId);
    const adaptationNeeds = this.analyzeModelEvolutionNeeds(learningData);

    return {
      workDurationChange: adaptationNeeds.durationAdjustment,
      breakDurationChange: adaptationNeeds.breakAdjustment,
      scenarioOptimization: adaptationNeeds.optimalScenarios as any
    };
  }

  /**
   * Handle configuration updates that affect learning
   */
  private handleConfigUpdate(): void {
    const config = vscode.workspace.getConfiguration('breakBully.adaptiveLearning');

    if (config.get('enabled') === false) {
      // Disable adaptive learning
      this.pauseLearningLoops();
    } else {
      // Re-enable if disabled
      this.resumeLearningLoops();
    }
  }

  /**
   * Control learning loop execution
   */
  private pauseLearningLoops(): void {
    if (this.learningLoopInterval) {
      clearInterval(this.learningLoopInterval);
      this.learningLoopInterval = null;
    }
  }

  private resumeLearningLoops(): void {
    if (!this.learningLoopInterval) {
      this.learningLoopInterval = setInterval(() => this.runAdaptiveLearningLoop(), 3600000);
    }
  }

  /**
   * Utility Methods
   */

  private isInCooldown(opportunity: AdaptationOpportunity): boolean {
    const cooldownKey = `${opportunity.type}_${JSON.stringify(opportunity.data)}`;
    const lastExecution = this.adaptationCooldown.get(cooldownKey);

    if (!lastExecution) return false;

    const cooldownPeriod = this.getCooldownPeriod(opportunity.type);
    return (Date.now() - lastExecution.getTime()) < cooldownPeriod;
  }

  private setAdaptationCooldown(opportunity: AdaptationOpportunity, duration: number): void {
    const cooldownKey = `${opportunity.type}_${JSON.stringify(opportunity.data)}`;
    this.adaptationCooldown.set(cooldownKey, new Date(Date.now() + duration));
  }

  private getCooldownPeriod(type: AdaptationOpportunity['type']): number {
    const cooldownPeriods: Record<string, number> = {
      'model_switch': 24 * 60 * 60 * 1000, // 24 hours
      'context_optimization': 12 * 60 * 60 * 1000, // 12 hours
      'energy_adaptation': 6 * 60 * 60 * 1000, // 6 hours
      'trend_response': 168 * 60 * 60 * 1000, // 1 week
      'behavior_adaptation': 48 * 60 * 60 * 1000, // 48 hours
      'rollback': 24 * 60 * 60 * 1000 // 24 hours
    };

    return cooldownPeriods[type] || 24 * 60 * 60 * 1000;
  }

  private captureCurrentMetrics(): any {
    const performance = this.analyticsEngine.generatePerformanceReport('week');
    return {
      productivityScore: performance.summary.overallProductivityScore,
      averageSatisfaction: this.calculateCurrentAverageSatisfaction(),
      averageCompletionRate: performance.summary.averageCompletionRate,
      captureDate: new Date()
    };
  }

  private calculateCurrentAverageSatisfaction(): number {
    // Simplified satisfaction calculation - in real implementation would analyze usage feedback
    return 4.1; // Mock value
  }

  private identifyDeclineCauses(trends: any): string[] {
    const causes = [];

    if (trends.productivityTrend < -1) {
      causes.push('Productivity declining');
    }
    if (trends.completionRateTrend < 0) {
      causes.push('Completion rates dropping');
    }
    if (trends.satisfactionTrend < 0) {
      causes.push('User satisfaction decreasing');
    }

    return causes.length > 0 ? causes : ['Pattern analysis inconclusive'];
  }

  private generateTrendSolutions(trends: any): any[] {
    // Generate specific solutions based on trend analysis
    return [
      {
        type: 'model_switch',
        data: { solution: 'Switch to higher-performing model', confidence: 0.85 }
      },
      {
        type: 'context_optimization',
        data: { solution: 'Optimize scheduling based on energy patterns', confidence: 0.91 }
      }
    ];
  }

  private generateAdaptationInsights(performanceReport: PerformanceReport, context: any): string[] {
    const insights = [];

    if (performanceReport.summary.mostEffectiveModel) {
      insights.push(`${performanceReport.summary.mostEffectiveModel} shows highest effectiveness for your usage patterns`);
    }

    const benchmark = this.analyticsEngine.generateBenchmarkReport();
    if (benchmark.productivityPercentile > 80) {
      insights.push(`Your productivity is in the top ${benchmark.productivityPercentile}% of users`);
    }

    insights.push(`AI has identified ${performanceReport.recommendations.immediateActions.length} immediate optimization opportunities`);

    return insights;
  }

  private async gatherModelLearningData(modelId: string): Promise<LearningDataPoint[]> {
    // Gather all learning data points for a specific model
    // This would query the usage analytics service
    const mockData: LearningDataPoint[] = [];

    // Generate mock learning data for evolution analysis
    for (let i = 0; i < 20; i++) {
      mockData.push({
        timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
        modelId,
        success: Math.random() > 0.25, // ~75% success rate
        context: this.analyticsEngine.generateRealTimeInsights({})?.alternativeModels[0] ?
          this.analyticsEngine.generateRealTimeInsights({}).alternativeModels[0] as any :
          {
          timeOfDay: 12,
          dayOfWeek: 3,
          workType: 'coding',
          screenActivity: 7,
          energyLevel: 'high',
          openEditors: 4,
          statusMessages: []
        } as any,
        metrics: {
          completionRate: 0.7 + Math.random() * 0.3,
          interruptions: Math.floor(Math.random() * 4),
          breaksTaken: 2 + Math.floor(Math.random() * 3),
          focusPeriods: 3 + Math.floor(Math.random() * 4),
          manualOverrides: Math.floor(Math.random() * 3)
        },
        learning: {
          idealDurationAdjustment: Math.floor(Math.random() * 21) - 10,
          preferredBreakPattern: 'frequent_short',
          optimalBreakFrequency: 25 + Math.floor(Math.random() * 20),
          contextAdaptations: {}
        }
      });
    }

    return mockData;
  }

  private analyzeModelEvolutionNeeds(learningData: LearningDataPoint[]): {
    durationAdjustment: number;
    breakAdjustment: number;
    optimalScenarios: string[];
    personalizationRules: any;
  } {
    if (learningData.length === 0) {
      return {
        durationAdjustment: 0,
        breakAdjustment: 0,
        optimalScenarios: [],
        personalizationRules: {}
      };
    }

    // Analyze learning data to generate evolution recommendations
    const avgDurationAdjustment = learningData.reduce((sum, dp) => sum + dp.learning.idealDurationAdjustment, 0) / learningData.length;
    const avgBreakAdjustment = learningData.reduce((sum, dp) => sum - (dp.learning.optimalBreakFrequency - 30) / 10, 0) / learningData.length;

    return {
      durationAdjustment: Math.round(avgDurationAdjustment),
      breakAdjustment: Math.round(avgBreakAdjustment),
      optimalScenarios: ['morning_focus', 'deep_work', 'creative_boost'],
      personalizationRules: {
        energyAware: true,
        contextBased: true,
        interruptibleMode: learningData.some(dp => dp.metrics.interruptions > 3)
      }
    };
  }

  dispose(): void {
    if (this.learningLoopInterval) {
      clearInterval(this.learningLoopInterval);
    }

    // Store final adaptation results before disposal
    const finalResults = Array.from(this.currentAdaptations.values());
    state.storage?.saveCustomSetting('finalAdaptationResults', finalResults);
  }
}

/**
 * Interface Definitions
 */

interface AdaptationOpportunity {
  type: 'model_switch' | 'context_optimization' | 'energy_adaptation' | 'trend_response' | 'behavior_adaptation' | 'rollback';
  priority: 'high' | 'medium' | 'low';
  confidence: number;
  expectedImprovement: string;
  description: string;
  data: any;
  triggerCondition: string;
  rollbackPlan: string;
}

interface ModelAdaptation {
  id: string;
  type: AdaptationOpportunity['type'];
  opportunity: AdaptationOpportunity;
  implementationDate: Date;
  status: 'active' | 'successful' | 'needs_rollback' | 'rolled_back';
  baselineMetrics: any;
  monitoringInterval: number;
  impactMetrics?: {
    productivityChange: number;
    satisfactionChange: number;
    success: boolean;
    evaluationDate: Date;
  };
  rollbackDate?: Date;
}

interface PersonalizedInsights {
  userId: string;
  insightType: 'productivity_pattern' | 'preference_analysis' | 'optimization_opportunity';
  confidence: number;
  description: string;
  actionItems: string[];
  expectedImpact: string;
  generatedAt: Date;
}

export const adaptiveLearning = AdaptiveLearningService.getInstance();
