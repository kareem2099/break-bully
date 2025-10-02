import * as vscode from 'vscode';
import {
  WorkRestModel,
  MLGeneratedWorkRestModel,
  ModelGenerationResult,
  ModelScenario,
  WorkStyle,
  UserAssessment,
  ModelGenerationInput,
  ActivityAnalysis,
  WellnessPatternData,
  HistoricalPreferenceData,
  ContextFactors,
  DataSufficiency,
  GenerationConfidence,
  ConfidenceFactor,
  BurnoutIndicator,
  EnergyPattern,
  StressIndicator,
  ModelUsageRecord,
  AdaptationEntry,
  AdaptationTrigger,
  ModelPerformanceMetrics
} from '../types/mlWorkRestTypes';
import { ActivityEvent } from './activityIntegration/activityTypes';
import { MachineLearningAnalyzer } from './activityIntegration/machineLearningAnalyzer';

/**
 * ML Work-Rest Generator Service
 * Generates personalized work-rest models by combining user assessments with activity data analysis
 */
export class MLWorkRestGenerator {

  /**
   * Generates personalized work-rest models based on user assessment and activity data
   */
  static generatePersonalModels(
    assessment: UserAssessment,
    activityEvents: ActivityEvent[],
    existingUsageHistory: ModelUsageRecord[] = []
  ): ModelGenerationResult {

    // Analyze activity patterns
    const activityAnalysis = this.analyzeActivityData(activityEvents);

    // Analyze wellness patterns
    const wellnessAnalysis = this.analyzeWellnessData(activityEvents);

    // Build historical preferences from usage data
    const historicalData = this.buildHistoricalPreferences(existingUsageHistory);

    // Determine context factors - using synchronous version for now
    const contextData = this.determineContextFactorsSync();

    // Combine all data
    const generationInput: ModelGenerationInput = {
      userAssessment: assessment,
      activityHistory: activityAnalysis,
      wellnessPatterns: wellnessAnalysis,
      historicalPreferences: historicalData,
      contextFactors: contextData
    };

    // Generate models for different scenarios
    const models = this.generateScenarioModels(generationInput);

    // Calculate confidence levels
    const confidence = this.calculateGenerationConfidence(generationInput, models);

    // Generate insights
    const personalizationInsights = this.generatePersonalizationInsights(generationInput, models);
    const generationNotes = this.generateGenerationNotes(generationInput, confidence);

    return {
      recommended: models.filter(m => m.confidenceScore >= 0.7).slice(0, 3),
      alternatives: models.filter(m => m.confidenceScore >= 0.5 && m.confidenceScore < 0.7),
      confidence,
      generationNotes,
      personalizationInsights
    };
  }

  /**
   * Analyzes activity data using existing ML analyzers
   */
  private static analyzeActivityData(events: ActivityEvent[]): ActivityAnalysis {
    if (events.length < 20) {
      return {
        averageSessionLength: 45, // Default assumption
        peakProductivityHours: [9, 10, 11, 14, 15], // Typical productive hours
        burnoutPatterns: [],
        flowStateFrequency: 0.3,
        breakAcceptanceRate: 0.6,
        workPatternStability: 0.5
      };
    }

    // Use existing ML analyzers
    const peakPerformance = MachineLearningAnalyzer.analyzePeakPerformanceTimes(events, 30);
    const burnoutAnalysis = MachineLearningAnalyzer.detectBurnoutPatterns(events);

    // Calculate session metrics
    const sessions = MachineLearningAnalyzer['getRecentSessions'](events, 14);
    const avgSessionLength = sessions.length > 0
      ? sessions.reduce((sum, s) => sum + s.duration, 0) / sessions.length
      : 45;

    // Convert burnout patterns to BurnoutIndicator format
    const burnoutPatterns: BurnoutIndicator[] = [];
    if (burnoutAnalysis.riskLevel === 'high' || burnoutAnalysis.riskLevel === 'medium') {
      burnoutPatterns.push({
        timestamp: new Date(),
        severity: burnoutAnalysis.riskLevel as 'high' | 'medium',
        triggers: burnoutAnalysis.warningSigns || [],
        recoveryTime: burnoutAnalysis.nextBreakSugestion.timeToNextBreak
      });
    }

    // Estimate flow state frequency (rough approximation)
    const highIntensitySessions = sessions.filter(s => s.avgIntensity > 7).length;
    const flowStateFrequency = sessions.length > 0 ? highIntensitySessions / sessions.length : 0.3;

    // Estimate break acceptance rate (placeholder - would need break event data)
    const breakAcceptanceRate = 0.6; // Default, could be improved with break event analysis

    // Calculate pattern stability (variation in session lengths)
    const sessionLengths = sessions.map(s => s.duration);
    const meanLength = sessionLengths.reduce((a, b) => a + b, 0) / sessionLengths.length;
    const variance = sessionLengths.reduce((sum, len) => sum + Math.pow(len - meanLength, 2), 0) / sessionLengths.length;
    const stdDev = Math.sqrt(variance);
    const stability = Math.max(0, 1 - (stdDev / meanLength)); // 0-1 scale

    return {
      averageSessionLength: Math.round(avgSessionLength),
      peakProductivityHours: peakPerformance.peakHours.map(h => h.hour),
      burnoutPatterns,
      flowStateFrequency: Math.round(flowStateFrequency * 100) / 100,
      breakAcceptanceRate,
      workPatternStability: Math.round(stability * 100) / 100
    };
  }

  /**
   * Analyzes wellness data patterns
   */
  private static analyzeWellnessData(events: ActivityEvent[]): WellnessPatternData {

    // Extract energy patterns from recent activity
    const energyPatterns: EnergyPattern[] = [];
    for (let hour = 0; hour < 24; hour++) {
      const hourEvents = events.filter(e => new Date(e.timestamp).getHours() === hour);
      if (hourEvents.length >= 3) {
        const avgIntensity = hourEvents.reduce((sum, e) => sum + e.intensity, 0) / hourEvents.length;

        // Convert intensity (1-10) to energy level (1-10)
        const energyLevel = Math.min(10, Math.max(1, avgIntensity));

        // Estimate consistency based on variance
        const variance = hourEvents.reduce((sum, e) =>
          sum + Math.pow(e.intensity - avgIntensity, 2), 0) / hourEvents.length;
        const consistency = Math.max(0, 1 - Math.sqrt(variance) / 5);

        energyPatterns.push({
          timeOfDay: hour,
          averageEnergy: Math.round(energyLevel * 10) / 10,
          consistency: Math.round(consistency * 100) / 100
        });
      }
    }

    // Basic stress indicators (could be enhanced with typing patterns)
    const stressIndicators: StressIndicator[] = [];
    const recentSessions = MachineLearningAnalyzer['getRecentSessions'](events, 7);

    if (recentSessions.length > 5) {
      // Look for erratic patterns as stress indicator
      const intensities = recentSessions.map(s => s.avgIntensity);
      const mean = intensities.reduce((a, b) => a + b, 0) / intensities.length;
      const variance = intensities.reduce((sum, i) => sum + Math.pow(i - mean, 2), 0) / intensities.length;

      if (variance > 2) {
        stressIndicators.push({
          metric: 'session_breaks',
          value: Math.sqrt(variance),
          threshold: 2,
          detectedAt: new Date()
        });
      }
    }

    return {
      exerciseFrequency: 0.3, // Placeholder - would need exercise event data
      preferredBreakActivities: ['stretching', 'walking'], // Default preferences
      energyFluctuations: energyPatterns,
      stressIndicators
    };
  }

  /**
   * Builds historical preferences from usage data
   */
  private static buildHistoricalPreferences(usageHistory: ModelUsageRecord[]): HistoricalPreferenceData {
    if (usageHistory.length === 0) {
      return {
        successfulWorkLengths: [],
        successfulBreakLengths: [],
        preferredTimesOfDay: [],
        modelUsageHistory: [],
        satisfactionRatings: []
      };
    }

    // Analyze successful patterns
    const successfulSessions = usageHistory.filter(u => u.completionRate >= 0.8);

    const successfulWorkLengths = successfulSessions
      .filter(u => u.endTime > u.startTime)
      .map(u => (u.endTime.getTime() - u.startTime.getTime()) / (1000 * 60)); // minutes

    const successfulBreakLengths = successfulSessions
      .filter(u => u.endTime > u.startTime)
      .map(u => 10); // Placeholder - need break duration tracking

    const preferredTimesOfDay = successfulSessions
      .map(session => session.startTime.getHours())
      .filter(hour => hour >= 6 && hour <= 22); // Reasonable work hours

    const satisfactionRatings = usageHistory
      .map(u => u.userRating)
      .filter(rating => rating !== undefined) as number[];

    return {
      successfulWorkLengths,
      successfulBreakLengths,
      preferredTimesOfDay,
      modelUsageHistory: usageHistory,
      satisfactionRatings
    };
  }

  /**
   * Determines contextual factors about the user's environment (synchronous version)
   */
  private static determineContextFactorsSync(): ContextFactors {
    // Basic work type detection - simplified for synchronous operation
    let workType: ContextFactors['workType'] = 'development'; // default

    // Default context for now - could be enhanced later
    return {
      workEnvironment: 'home', // Default - could be enhanced with location detection
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      workType,
      screenConfiguration: 'single', // Default
      notificationLoad: 'medium', // Default
      meetingFrequency: 'low' // Default
    };
  }

  /**
   * Determines contextual factors about the user's environment (async version for future use)
   */
  private static async determineContextFactors(): Promise<ContextFactors> {
    // Get VSCode configuration to infer work context
    const config = vscode.workspace.getConfiguration();

    // Infer work type from workspace/project files (simplified)
    const workspaceFiles = vscode.workspace.findFiles ? await vscode.workspace.findFiles('**/*') : [];
    let workType: ContextFactors['workType'] = 'development'; // default

    // Basic work type detection
    const hasDesignFiles = workspaceFiles.some(f => f.fsPath.match(/\.(psd|ai|figma|xd|sketch)$/i));
    const hasWritingFiles = workspaceFiles.some(f => f.fsPath.match(/\.(md|txt|doc|pdf)$/i));
    const hasCodeFiles = workspaceFiles.some(f => f.fsPath.match(/\.(js|ts|py|java|c|cpp|cs|php|rb|go|rs)$/i));

    if (hasCodeFiles && !hasDesignFiles && !hasWritingFiles) {
      workType = 'development';
    } else if (hasWritingFiles && !hasCodeFiles && !hasDesignFiles) {
      workType = 'writing';
    } else if (hasDesignFiles && !hasCodeFiles && !hasWritingFiles) {
      workType = 'design';
    } else if (hasCodeFiles && hasWritingFiles) {
      workType = 'analysis'; // Mixed technical/writing
    }

    return {
      workEnvironment: 'home', // Default - could be enhanced with location detection
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      workType,
      screenConfiguration: 'single', // Default
      notificationLoad: 'medium', // Default
      meetingFrequency: 'low' // Default
    };
  }

  /**
   * Generates work-rest models for different scenarios
   */
  private static generateScenarioModels(input: ModelGenerationInput): MLGeneratedWorkRestModel[] {
    const models: MLGeneratedWorkRestModel[] = [];

    // Generate model for each scenario
    Object.values(ModelScenario).forEach(scenario => {
      const model = this.generateModelForScenario(scenario, input);
      if (model) {
        models.push(model);
      }
    });

    return models.sort((a, b) => b.confidenceScore - a.confidenceScore);
  }

  /**
   * Generates a single model for a specific scenario
   */
  private static generateModelForScenario(
    scenario: ModelScenario,
    input: ModelGenerationInput
  ): MLGeneratedWorkRestModel | null {

    const baseModel = this.generateBaseModel(scenario, input);
    const confidenceScore = this.calculateModelConfidence(scenario, input);

    if (confidenceScore < 0.3) {
      return null; // Skip models with very low confidence
    }

    const modelId = `personal-ml-${scenario}-${Date.now().toString(36)}` as `personal-ml-${string}`;

    // Ensure required fields are defined
    const workDuration = baseModel.workDuration || 45;
    const restDuration = baseModel.restDuration || 10;

    return {
      id: modelId,
      name: this.getScenarioDisplayName(scenario),
      description: this.generateModelDescription(scenario, input, confidenceScore),
      workDuration,
      restDuration,
      cycles: baseModel.cycles,
      longRestDuration: baseModel.longRestDuration,
      basedOn: 'custom',
      generatedBy: 'ml-generator',
      sourceAssessment: input.userAssessment.id,
      sourceData: input,
      confidenceScore,
      adaptationHistory: [],
      performanceMetrics: this.initializePerformanceMetrics(),
      scenario: scenario,
      createdAt: new Date(),
      lastUpdated: new Date()
    };
  }

  /**
   * Generates base work/rest durations for a scenario
   */
  private static generateBaseModel(scenario: ModelScenario, input: ModelGenerationInput): Partial<WorkRestModel> {
    const { userAssessment, activityHistory } = input; // wellnessPatterns available for future energy-based adjustments

    // Start with defaults based on work style
    let workDuration: number;
    let restDuration: number;
    let cycles: number | undefined;
    let longRestDuration: number | undefined;

    switch (userAssessment.preferredWorkStyle) {
      case WorkStyle.FOCUSED_BURSTS:
        workDuration = 35;
        restDuration = 8;
        break;
      case WorkStyle.SUSTAINED_FLOW:
        workDuration = 75;
        restDuration = 18;
        cycles = 3;
        longRestDuration = 25;
        break;
      case WorkStyle.FLEXIBLE_ADAPTIVE:
        workDuration = 50;
        restDuration = 12;
        break;
      case WorkStyle.SHORT_ITERATIONS:
        workDuration = 20;
        restDuration = 6;
        break;
      default:
        workDuration = 45;
        restDuration = 10;
    }

    // Adjust based on activity patterns
    if (activityHistory.averageSessionLength > 60) {
      // User tends to work longer sessions, increase work duration
      workDuration = Math.min(90, workDuration + 15);
      restDuration = Math.min(20, restDuration + 3);
    } else if (activityHistory.averageSessionLength < 30) {
      // User works shorter sessions, decrease work duration
      workDuration = Math.max(20, workDuration - 10);
      restDuration = Math.max(5, restDuration - 2);
    }

    // Adjust based on scenario
    switch (scenario) {
      case ModelScenario.MORNING_FOCUS:
      case ModelScenario.AFTERNOON_SUSTAINED:
        // Slightly longer work periods for focus scenarios
        workDuration += 5;
        break;
      case ModelScenario.EVENING_MAINTENANCE:
        // Shorter work periods for evening
        workDuration = Math.max(20, workDuration * 0.8);
        restDuration = Math.max(5, restDuration * 0.8);
        break;
      case ModelScenario.CREATIVE_SESSION:
      case ModelScenario.DEBUGGING_SESSION:
        // Longer breaks for creative/problem-solving work
        restDuration += 3;
        break;
      case ModelScenario.LEARNING_SESSION:
        // Shorter work periods for learning
        workDuration = Math.max(25, workDuration * 0.9);
        restDuration += 2;
        break;
    }

    // Factor in burnout patterns - increase rest if burnout detected
    const recentBurnout = activityHistory.burnoutPatterns
      .find(b => new Date().getTime() - b.timestamp.getTime() < 7 * 24 * 60 * 60 * 1000);

    if (recentBurnout && recentBurnout.severity === 'high') {
      restDuration += 5;
      if (longRestDuration) longRestDuration += 10;
    }

    return {
      workDuration: Math.round(workDuration / 5) * 5, // Round to 5-minute increments
      restDuration: Math.round(restDuration),
      cycles,
      longRestDuration
    };
  }

  /**
   * Calculates confidence score for a generated model
   */
  private static calculateModelConfidence(scenario: ModelScenario, input: ModelGenerationInput): number {
    let confidence = 0.5; // Base confidence

    // Assessment completion increases confidence
    if (input.userAssessment.completionScore >= 0.8) {
      confidence += 0.2;
    }

    // Activity data sufficiency
    const activityDataPoints = input.activityHistory.peakProductivityHours.length +
                              input.activityHistory.burnoutPatterns.length +
                              (input.activityHistory.averageSessionLength > 0 ? 1 : 0);

    if (activityDataPoints >= 5) {
      confidence += 0.15;
    } else if (activityDataPoints >= 3) {
      confidence += 0.1;
    }

    // Historical usage data
    if (input.historicalPreferences.modelUsageHistory.length >= 5) {
      confidence += 0.1;
    }

    // Wellness pattern data
    if (input.wellnessPatterns.energyFluctuations.length >= 12) { // Multiple hours of data
      confidence += 0.05;
    }

    return Math.min(1.0, Math.max(0.1, confidence));
  }

  /**
   * Generates human-readable model descriptions
   */
  private static generateModelDescription(
    scenario: ModelScenario,
    input: ModelGenerationInput,
    confidence: number
  ): string {
    const workDuration = this.generateBaseModel(scenario, input).workDuration || 45;
    const restDuration = this.generateBaseModel(scenario, input).restDuration || 10;

    const confidenceText = confidence >= 0.8 ? 'Highly optimized' :
                          confidence >= 0.6 ? 'Well-tailored' :
                          'Adapted';

    const styleText = input.userAssessment.preferredWorkStyle === WorkStyle.SUSTAINED_FLOW ?
                     'for deep, focused work' :
                     input.userAssessment.preferredWorkStyle === WorkStyle.FOCUSED_BURSTS ?
                     'for intense work bursts' :
                     'for your natural work rhythm';

    return `${confidenceText} ${workDuration}-minute work sessions with ${restDuration}-minute breaks, designed for ${scenario.replace('_', ' ')} ${styleText}.`;
  }

  /**
   * Gets display name for scenarios
   */
  private static getScenarioDisplayName(scenario: ModelScenario): string {
    const names = {
      [ModelScenario.MORNING_FOCUS]: '🌅 Morning Focus',
      [ModelScenario.AFTERNOON_SUSTAINED]: '☀️ Afternoon Sustained',
      [ModelScenario.EVENING_MAINTENANCE]: '🌆 Evening Maintenance',
      [ModelScenario.CREATIVE_SESSION]: '🎨 Creative Flow',
      [ModelScenario.DEBUGGING_SESSION]: '🐛 Debug Session',
      [ModelScenario.ADMINISTRATIVE]: '📋 Admin Tasks',
      [ModelScenario.LEARNING_SESSION]: '📚 Learning Mode'
    };

    return names[scenario] || scenario.replace('_', ' ');
  }

  /**
   * Calculates overall generation confidence
   */
  private static calculateGenerationConfidence(
    input: ModelGenerationInput,
    models: MLGeneratedWorkRestModel[]
  ): GenerationConfidence {

    const overall = Math.min(1.0, models.reduce((sum, m) => sum + m.confidenceScore, 0) / models.length);

    const byScenario: Record<ModelScenario, number> = {} as Record<ModelScenario, number>;
    models.forEach(model => {
      byScenario[model.scenario] = model.confidenceScore;
    });

    // Determine data sufficiency
    let dataSufficiency = DataSufficiency.COMPREHENSIVE;

    const totalDataPoints = input.activityHistory.peakProductivityHours.length +
                           input.wellnessPatterns.energyFluctuations.length +
                           input.historicalPreferences.modelUsageHistory.length;

    if (totalDataPoints < 10) {
      dataSufficiency = DataSufficiency.INSUFFICIENT;
    } else if (totalDataPoints < 50) {
      dataSufficiency = DataSufficiency.ADEQUATE;
    }

    // Generate confidence factors
    const factors: ConfidenceFactor[] = [
      {
        factor: 'Assessment Completion',
        confidence: input.userAssessment.completionScore,
        explanation: `Assessment completed with ${Math.round(input.userAssessment.completionScore * 100)}% score`
      },
      {
        factor: 'Activity Data',
        confidence: input.activityHistory.peakProductivityHours.length > 3 ? 0.8 : 0.4,
        explanation: `${input.activityHistory.peakProductivityHours.length} peak hours identified from activity data`
      },
      {
        factor: 'Usage History',
        confidence: input.historicalPreferences.modelUsageHistory.length > 5 ? 0.9 : 0.5,
        explanation: `${input.historicalPreferences.modelUsageHistory.length} previous sessions analyzed`
      }
    ];

    return {
      overall,
      byScenario,
      dataSufficiency,
      factors
    };
  }

  /**
   * Generates personalized insights about the user's patterns
   */
  private static generatePersonalizationInsights(
    input: ModelGenerationInput,
    models: MLGeneratedWorkRestModel[]
  ): string[] {
    const insights: string[] = [];

    // Work style insights
    const style = input.userAssessment.preferredWorkStyle;
    if (style === WorkStyle.SUSTAINED_FLOW) {
      insights.push('🏃‍♂️ Your sustained flow preference suggests you work best with longer, uninterrupted sessions');
    } else if (style === WorkStyle.FOCUSED_BURSTS) {
      insights.push('⚡ Your preference for focused bursts indicates optimal performance in shorter, intense work periods');
    }

    // Activity pattern insights
    if (input.activityHistory.peakProductivityHours.length >= 3) {
      const peakHours = input.activityHistory.peakProductivityHours.sort();
      const hoursText = peakHours.map(h =>
        h === 0 ? '12 AM' :
        h < 12 ? `${h} AM` :
        h === 12 ? '12 PM' :
        `${h - 12} PM`
      ).join(', ');
      insights.push(`🏆 Peak productivity identified at: ${hoursText}`);
    }

    // Burnout prevention insights
    if (input.activityHistory.burnoutPatterns.length > 0) {
      const recentBurnout = input.activityHistory.burnoutPatterns[0];
      if (recentBurnout.severity === 'high') {
        insights.push('🛡️ Recent burnout patterns detected - models include extra recovery time');
      }
    }

    // Energy pattern insights
    const highEnergyHours = input.wellnessPatterns.energyFluctuations
      .filter(e => e.averageEnergy >= 7)
      .map(e => e.timeOfDay);
    if (highEnergyHours.length > 0) {
      insights.push(`⚡ High energy times: ${highEnergyHours.slice(0, 3).join('h, ')}h`);
    }

    // Flexibility insights
    const adaptabilityRating = input.userAssessment.adaptabilityRating || 0.5;
    if (adaptabilityRating > 0.7) {
      insights.push('🔄 High adaptability rating - you can handle schedule variations well');
    } else if (adaptabilityRating < 0.4) {
      insights.push('📏 Low adaptability rating - consistent scheduling important for your success');
    }

    return insights.slice(0, 4); // Limit to 4 most relevant insights
  }

  /**
   * Generates technical notes about the generation process
   */
  private static generateGenerationNotes(
    input: ModelGenerationInput,
    confidence: GenerationConfidence
  ): string[] {
    const notes: string[] = [];

    // Data usage notes
    const dataSources = [];
    if (input.activityHistory.peakProductivityHours.length > 0) {
      dataSources.push('activity patterns');
    }
    if (input.historicalPreferences.modelUsageHistory.length > 0) {
      dataSources.push('usage history');
    }
    if (input.wellnessPatterns.energyFluctuations.length > 0) {
      dataSources.push('energy patterns');
    }

    notes.push(`Data sources: ${dataSources.join(', ') || 'assessment only'}`);

    // Confidence notes
    if (confidence.dataSufficiency === DataSufficiency.INSUFFICIENT) {
      notes.push('⚠️ Limited data available - models will improve with continued usage');
    }

    // Model adaptation capability
    notes.push('📈 Models will automatically adapt based on your usage patterns and feedback');

    return notes;
  }

  /**
   * Initializes empty performance metrics for new models
   */
  private static initializePerformanceMetrics(): ModelPerformanceMetrics {
    return {
      activationCount: 0,
      averageCompletionRate: 0,
      averageSatisfaction: 0,
      averageFocusTime: 0,
      burnoutPrevention: 0,
      userRetention: 0,
      lastPerformanceReview: new Date()
    } as ModelPerformanceMetrics;
  }

  /**
   * Adapts an existing model based on usage data
   */
  static adaptModel(
    model: MLGeneratedWorkRestModel,
    usageRecords: ModelUsageRecord[],
    newAssessment?: UserAssessment
  ): MLGeneratedWorkRestModel {

    const adaptation: AdaptationEntry = {
      timestamp: new Date(),
      trigger: AdaptationTrigger.USER_OVERRIDE, // Default, could be smarter
      adjustment: {},
      confidence: 0.7,
      performance: this.calculateCurrentPerformance(usageRecords)
    };

    // Analyze performance and make adjustments
    const recentPerformance = this.analyzeRecentPerformance(usageRecords.slice(-10));

    if (recentPerformance.completionRate < 0.6) {
      // Low completion - reduce work duration
      adaptation.adjustment.workDurationChange = -5;
      adaptation.adjustment.breakDurationChange = -1;
      adaptation.trigger = AdaptationTrigger.LOW_COMPLETION_RATE;
    } else if (recentPerformance.completionRate > 0.9) {
      // High completion - can increase work duration slightly
      adaptation.adjustment.workDurationChange = 3;
      adaptation.trigger = AdaptationTrigger.LOW_COMPLETION_RATE; // Could be more nuanced
    }

    // Apply adaptation
    const adaptedModel = { ...model };

    if (adaptation.adjustment.workDurationChange) {
      adaptedModel.workDuration = Math.max(15,
        Math.min(120, adaptedModel.workDuration + adaptation.adjustment.workDurationChange));
    }

    if (adaptation.adjustment.breakDurationChange) {
      adaptedModel.restDuration = Math.max(3,
        Math.min(30, adaptedModel.restDuration + adaptation.adjustment.breakDurationChange));
    }

    adaptedModel.adaptationHistory.push(adaptation);
    adaptedModel.lastUpdated = new Date();

    // Update performance metrics
    adaptedModel.performanceMetrics = this.updatePerformanceMetrics(
      adaptedModel.performanceMetrics, usageRecords);

    return adaptedModel;
  }

  /**
   * Analyzes recent performance from usage records
   */
  private static analyzeRecentPerformance(records: ModelUsageRecord[]): {
    completionRate: number;
    averageFocusTime: number;
    satisfaction: number;
  } {
    if (records.length === 0) {
      return { completionRate: 0.7, averageFocusTime: 45, satisfaction: 4 };
    }

    const completionRate = records.reduce((sum, r) => sum + r.completionRate, 0) / records.length;
    const averageFocusTime = records.reduce((sum, r) => sum + ((r.endTime.getTime() - r.startTime.getTime()) / (1000 * 60)), 0) / records.length;
    const satisfaction = records.reduce((sum, r) => sum + (r.userRating || 4), 0) / records.length;

    return { completionRate, averageFocusTime, satisfaction };
  }

  /**
   * Calculates current performance score
   */
  private static calculateCurrentPerformance(records: ModelUsageRecord[]): number {
    const recentPerf = this.analyzeRecentPerformance(records.slice(-5));
    return (recentPerf.completionRate + (recentPerf.satisfaction / 5) + Math.min(recentPerf.averageFocusTime / 60, 1)) / 3;
  }

  /**
   * Updates performance metrics based on usage records
   */
  private static updatePerformanceMetrics(
    current: ModelPerformanceMetrics,
    records: ModelUsageRecord[]
  ): ModelPerformanceMetrics {

    const recentPerf = this.analyzeRecentPerformance(records.slice(-10));

    return {
      activationCount: current.activationCount + 1,
      averageCompletionRate: (current.averageCompletionRate + recentPerf.completionRate) / 2,
      averageSatisfaction: (current.averageSatisfaction + recentPerf.satisfaction) / 2,
      averageFocusTime: recentPerf.averageFocusTime,
      burnoutPrevention: Math.max(0, Math.min(1, current.burnoutPrevention)), // Placeholder
      userRetention: current.userRetention + 1, // Simple increment
      lastPerformanceReview: new Date()
    };
  }
}
