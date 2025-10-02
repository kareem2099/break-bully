export interface WorkRestModel {
  id: string;
  name: string;
  description: string;
  workDuration: number; // minutes
  restDuration: number; // minutes
  cycles?: number | undefined; // optional number of cycles before longer break
  longRestDuration?: number | undefined; // minutes for longer break after cycles
  basedOn: 'pomodoro' | 'who' | 'custom'; // research basis
}

/**
 * User Assessment Data Types
 */
export interface UserAssessment {
  id: string;
  timestamp: Date;
  responses?: AssessmentResponse[]; // Made optional for new structure
  completionScore: number; // 0-1
  preferredWorkStyle?: WorkStyle; // Made optional
  preferredBreakStyle?: BreakStyle; // Made optional
  adaptabilityRating?: number; // 0-1, made optional
  // New assessment structure
  userPreferences?: {
    preferredWorkStyle: WorkStyle;
    preferredBreakStyle: BreakStyle;
    preferredBreakDuration: number;
    adaptabilityRating: number;
    motivationStyle: string;
  };
  energyPatterns?: {
    morningPeak: number;
    middayPeak: number;
    afternoonPeak: number;
    eveningPeak: number;
    energyMorning: number;
    energyMidday: number;
    energyAfternoon: number;
  };
  preferredBreakActivities?: string[];
  scoredAttributes?: Record<string, any>;
  questionResponses?: {
    questionId: string;
    answerId: string;
    score: Record<string, any>;
    timestamp: Date;
  }[];
}

export interface AssessmentResponse {
  questionId: string;
  question: string;
  answer: string | number;
  weight: number; // Question importance weight
}

export enum WorkStyle {
  FOCUSED_BURSTS = 'focused_bursts',      // 25-45 min intense work
  SUSTAINED_FLOW = 'sustained_flow',       // 60-90 min deep work
  FLEXIBLE_ADAPTIVE = 'flexible_adaptive',   // Variable work blocks
  SHORT_ITERATIONS = 'short_iterations'     // 15-25 min quick iterations
}

export enum BreakStyle {
  NATURE_RESET = 'nature_reset',       // Full disconnection
  LIGHT_DISTRACTION = 'light_distraction', // Social media, quick tasks
  MIND_CLEARING = 'mind_clearing',     // Meditation, stretching
  SOCIAL_CONNECTION = 'social_connection',  // Team chat, calls
  PHYSICAL_ACTIVITY = 'physical_activity',  // Walking, stretching, movement
  SOCIAL_INTERACTION = 'social_interaction' // Direct social engagement
}

/**
 * Assessment UI Types
 */
export interface AssessmentFlow {
  questions: AssessmentQuestion[];
}

export interface AssessmentQuestion {
  id: string;
  title: string;
  description: string;
  type: 'single_choice' | 'multiple_choice' | 'scale' | 'text';
  required: boolean;
  answers: AnswerOption[];
}

export interface AnswerOption {
  id: string;
  label: string;
  description: string;
  icon: string;
  score: Record<string, any>; // Scoring weights for different attributes
}

/**
 * ML Generated Model Types
 */
export interface MLGeneratedWorkRestModel extends Omit<WorkRestModel, 'id' | 'basedOn'> {
  id: `personal-ml-${string}`;
  generatedBy: 'ml-generator';
  sourceAssessment: string; // Assessment ID
  sourceData: ModelGenerationInput;
  confidenceScore: number; // 0-1, how confident we are in recommendations
  adaptationHistory: AdaptationEntry[];
  performanceMetrics: ModelPerformanceMetrics;
  scenario: ModelScenario;
  createdAt: Date;
  lastUpdated: Date;
  // Override to ensure required
  basedOn: WorkRestModel['basedOn'];
}

export enum ModelScenario {
  MORNING_FOCUS = 'morning_focus',           // 8-12 AM, high energy tasks
  AFTERNOON_SUSTAINED = 'afternoon_sustained', // 12-5 PM, deep work
  EVENING_MAINTENANCE = 'evening_maintenance', // 5-9 PM, lighter tasks
  CREATIVE_SESSION = 'creative_session',     // For creative/problem-solving work
  DEBUGGING_SESSION = 'debugging_session',   // For debugging/code review
  ADMINISTRATIVE = 'administrative',         // Emails, planning, admin tasks
  LEARNING_SESSION = 'learning_session'      // Reading, tutorials, courses
}

/**
 * Model Generation Input Data
 */
export interface ModelGenerationInput {
  userAssessment: UserAssessment;
  activityHistory: ActivityAnalysis;
  wellnessPatterns: WellnessPatternData;
  historicalPreferences: HistoricalPreferenceData;
  contextFactors: ContextFactors;
}

export interface ActivityAnalysis {
  averageSessionLength: number;
  peakProductivityHours: number[];
  burnoutPatterns: BurnoutIndicator[];
  flowStateFrequency: number;
  breakAcceptanceRate: number;
  workPatternStability: number; // 0-1, how consistent their work patterns are
}

export interface WellnessPatternData {
  exerciseFrequency: number;
  preferredBreakActivities: string[];
  energyFluctuations: EnergyPattern[];
  stressIndicators: StressIndicator[];
}

export interface EnergyPattern {
  timeOfDay: number; // hour 0-23
  averageEnergy: number; // 1-10
  consistency: number; // 0-1
}

export interface BurnoutIndicator {
  timestamp: Date;
  severity: 'low' | 'medium' | 'high';
  triggers: string[];
  recoveryTime: number; // minutes
}

export interface StressIndicator {
  metric: 'typing_speed' | 'error_rate' | 'session_breaks' | 'mandala_variability';
  value: number;
  threshold: number;
  detectedAt: Date;
}

/**
 * Historical and Contextual Data
 */
export interface HistoricalPreferenceData {
  successfulWorkLengths: number[];
  successfulBreakLengths: number[];
  preferredTimesOfDay: number[];
  modelUsageHistory: ModelUsageRecord[];
  satisfactionRatings: number[]; // 1-5 user ratings of previous models
}

export interface ModelUsageRecord {
  modelId: string;
  startTime: Date;
  endTime: Date;
  completionRate: number; // 0-1
  userRating?: number; // 1-5
  interruptions: number;
  overrideCount: number;
}

export interface ContextFactors {
  workEnvironment: 'office' | 'home' | 'hybrid' | 'travel';
  timeZone: string;
  workType: 'development' | 'design' | 'writing' | 'management' | 'analysis';
  screenConfiguration: 'single' | 'dual' | 'multi';
  notificationLoad: 'low' | 'medium' | 'high';
  meetingFrequency: 'low' | 'medium' | 'high';
}

/**
 * Generated Model Adaptation
 */
export interface AdaptationEntry {
  timestamp: Date;
  trigger: AdaptationTrigger;
  adjustment: ModelAdjustment;
  confidence: number;
  performance: number; // 0-1
  userFeedback?: string;
}

export enum AdaptationTrigger {
  USER_OVERRIDE = 'user_override',
  LOW_COMPLETION_RATE = 'low_completion_rate',
  BURNOUT_DETECTED = 'burnout_detected',
  ENERGY_CHANGE = 'energy_change',
  TIME_PATTERN_CHANGE = 'time_pattern_change',
  EXTERNAL_FACTORS = 'external_factors'
}

export interface ModelAdjustment {
  workDurationChange?: number; // minutes
  breakDurationChange?: number; // minutes
  cycleChange?: number;
  scenarioOptimization?: ModelScenario[];
  timeShift?: number; // hours
}

/**
 * Performance Tracking
 */
export interface ModelPerformanceMetrics {
  activationCount: number;
  averageCompletionRate: number; // 0-1
  averageSatisfaction: number; // 1-5
  averageFocusTime: number; // minutes
  burnoutPrevention: number; // 0-1
  userRetention: number; // days using this model
  lastPerformanceReview: Date;
}

/**
 * ML Generation Result
 */
export interface ModelGenerationResult {
  recommended: MLGeneratedWorkRestModel[];
  alternatives: MLGeneratedWorkRestModel[];
  confidence: GenerationConfidence;
  generationNotes: string[];
  personalizationInsights: string[];
}

export interface GenerationConfidence {
  overall: number; // 0-1
  byScenario: Record<ModelScenario, number>;
  dataSufficiency: DataSufficiency;
  factors: ConfidenceFactor[];
}

export enum DataSufficiency {
  INSUFFICIENT = 'insufficient',     // Need more data (0-2 weeks)
  ADEQUATE = 'adequate',            // Good data foundation (2-4 weeks)
  COMPREHENSIVE = 'comprehensive',   // Rich data available (>4 weeks)
  OPTIMAL = 'optimal'               // Extensive historical data
}

export interface ConfidenceFactor {
  factor: string;
  confidence: number;
  explanation: string;
  suggestion?: string;
}

/**
 * Federated Learning Types for Collective Intelligence
 */
export interface WorkRestFederatedModel {
  version: string;
  basePerformance: number; // Global baseline
  contributorCount: number;
  collectedInsights: FederatedInsight[];
  lastUpdated: Date;
  verificationProof: string;
}

export interface FederatedInsight {
  assessmentFingerprints: AssessmentFingerprint[];
  performanceAggregates: PerformanceAggregate[];
  regionalAdjustments: RegionalAdjustment[];
  temporalPatterns: TemporalPattern[];
}

export interface AssessmentFingerprint {
  workStyle: WorkStyle;
  breakStyle: BreakStyle;
  adaptability: number;
  clusterSize: number; // Number of users with similar profile
  successRate: number;
  recommendedScenarios: ModelScenario[];
}

export interface PerformanceAggregate {
  scenario: ModelScenario;
  averageCompletionRate: number;
  averageSatisfaction: number;
  sampleSize: number;
  confidenceInterval: [number, number];
}

export interface RegionalAdjustment {
  timeZone: string;
  workCulture: string;
  adjustments: ModelAdjustment;
  contributorCount: number;
}

export interface TemporalPattern {
  season: 'winter' | 'spring' | 'summer' | 'fall';
  workType: string;
  patterns: SeasonalPattern[];
}

export interface SeasonalPattern {
  month: number;
  energyBaseline: number;
  workCapacity: number;
  recommendations: string[];
}

/**
 * Usage Analytics Types - Advanced Data Collection for Learning AI
 */

export interface UsageEvent {
  id: string;
  type: UsageEventType;
  timestamp: Date;
  modelId?: string;
  source?: 'user_selection' | 'ai_recommendation' | 'default';
  context: ContextSnapshot;
  metadata: Record<string, any>;
}

export enum UsageEventType {
  MODEL_SELECTED = 'model_selected',
  SESSION_STARTED = 'session_started',
  SESSION_ENDED = 'session_ended',
  BREAK_TAKEN = 'break_taken',
  BREAK_SKIPPED = 'break_skipped',
  DISTRACTION_DETECTED = 'distraction_detected',
  USER_FEEDBACK = 'user_feedback'
}

export interface ContextSnapshot {
  timeOfDay: number; // 0-23
  dayOfWeek: number; // 0-6
  workType: 'coding' | 'debugging' | 'writing' | 'planning' | 'reviewing' | 'researching' | 'meeting';
  screenActivity: number; // 1-10 scale
  notificationLoad: 'low' | 'medium' | 'high';
  energyLevel: 'low' | 'medium' | 'high';
  lastBreakTime: Date | undefined;
  openEditors: number;
  statusMessages: string[];
}

export interface UserBehaviorProfile {
  preferencePatterns: Record<string, any>; // Time-based, task-based patterns
  successRates: Record<string, number>; // Success rates by context
  behavioralTendencies: Record<string, any>; // Learned user tendencies
}

export interface LearningDataPoint {
  timestamp: Date;
  modelId: string;
  success: boolean; // completionRate > 0.7
  context: ContextSnapshot;
  metrics: {
    completionRate: number;
    interruptions: number;
    breaksTaken: number;
    satisfactionRating?: number;
    focusPeriods: number;
    manualOverrides: number;
  };
  learning: {
    idealDurationAdjustment: number; // Minutes to adjust
    preferredBreakPattern: 'frequent_short' | 'infrequent_long' | 'as_needed';
    optimalBreakFrequency: number; // Minutes between breaks
    contextAdaptations: Record<string, any>; // Context-specific adjustments
  };
}

/**
 * Enhanced Model Usage Record
 */
export interface EnhancedModelUsageRecord extends ModelUsageRecord {
  // Extended properties for learning
  sessionDuration: number; // Actual session duration in minutes
  breaksCompleted: number; // Number of breaks actually taken
  workEfficiency: number; // 0-1, perceived work efficiency
  breakSatisfaction: number; // 0-1, perceived break satisfaction
  userRating?: number; // Override to make optional
}

/**
 * Differential Privacy Types
 */
export interface DifferentialPrivacyConfig {
  epsilon: number; // Privacy budget (lower = more private)
  sensitivity: number; // Maximum influence any single data point can have
  mechanism: 'laplace' | 'gaussian' | 'exponential';
  noiseScale: number;
}

export interface ZKPContribution {
  proof: string; // Zero-knowledge proof
  commitment: string; // Encrypted but verifiable data
  range: VerificationRange; // What the proof guarantees
  timestamp: Date;
}

export interface VerificationRange {
  minValidity: number;
  maxValidity: number;
  confidence: number;
  attributes: string[];
}

/**
 * Statistical Data Interfaces for ML Processing
 */
export interface StatisticalSummary {
  averageWorkDuration: number;
  averageCompletionRate: number;
  averageSatisfaction: number;
  peakProductivityHours: number[];
  energyPatterns: EnergyPattern[];
  sampleCount: number;
}

export interface AggregatedStatistics {
  averageWorkDuration: number;
  averageCompletionRate: number;
  averageSatisfaction: number;
}

export interface AnswerScoreData {
  [key: string]: any; // For flexible assessment scores
}

/**
 * Performance Analytics Types - Advanced Intelligence Processing
 */

export interface PerformanceReport {
  timeRange: 'week' | 'month' | 'all';
  generatedAt: Date;
  summary: {
    totalSessions: number;
    averageCompletionRate: number;
    mostEffectiveModel: string | null;
    peakPerformanceHours: number[];
    overallProductivityScore: number;
  };
  modelPerformance: { models: Record<string, ModelComparison>; mostEffective: string | null };
  contextualInsights: ContextualInsights;
  trends: TrendAnalysis;
  recommendations: OptimizationRecommendations;
  predictiveMetrics: PredictiveMetrics;
}

export interface ModelComparison {
  modelId: string;
  totalSessions: number;
  averageCompletionRate: number;
  averageSatisfaction: number;
  successRate: number;
  bestContext: string;
  performanceScore: number;
  usageFrequency: number;
}

export interface ContextualInsights {
  timeBasedPatterns: Array<{ timeSlot: string; effectiveness: number; recommendedModel: string }>;
  taskBasedPatterns: Array<{ taskType: string; optimalModel: string; successRate: number }>;
  energyBasedPatterns: Array<{ energyLevel: 'low' | 'medium' | 'high'; recommendedApproach: string; expectedOutcome: number }>;
  contextOptimization: Array<{ context: string; currentPerformance: number; optimizationOpportunity: string; expectedImprovement: number }>;
  adaptiveRules: Array<{ condition: string; action: string; confidence: number }>;
}

export interface TrendAnalysis {
  productivityTrend: number; // Change per week
  completionRateTrend: number; // Change per week (%)
  satisfactionTrend: number; // Change per week (points)
  modelUsageEvolution: Record<string, { usage: number; trend: number }>;
  behavioralShifts: Array<{ shift: string; impact: string; dateDetected: Date }>;
  improvementOpportunities: string[];
  baselineComparison: {
    currentScore: number;
    baselineScore: number;
    improvement: number;
  };
}

export interface OptimizationRecommendations {
  immediateActions: Array<{
    action: string;
    reason: string;
    expectedImpact: 'low' | 'medium' | 'high';
    implementationEffort: 'low' | 'medium' | 'high';
  }>;
  longTermImprovements: Array<{
    action: string;
    description: string;
    timeline: string;
    prerequisites: string[];
  }>;
  contextualAdjustments: Array<{
    adjustment: string;
    triggerCondition: string;
    expectedBenefit: string;
  }>;
  riskAssessments: Array<{
    risk: string;
    impact: 'low' | 'medium' | 'high';
    mitigation: string;
  }>;
}

export interface PredictiveMetrics {
  nextWeekPrediction: {
    expectedProductivityScore: number;
    recommendedModel: string | null;
    optimalScheduleTimes: number[];
    riskFactors: string[];
  };
  monthlyForecast: {
    projectedImprovement: number;
    learningOpportunities: string[];
    adaptationReadiness: 'confirmed' | 'pending' | 'insufficient_data';
  };
  patternConfidence: {
    scheduleReliability: number; // 0-1
    modelRecommendationAccuracy: number; // 0-1
    contextPredictionAccuracy: number; // 0-1
  };
}

export interface ABLegacyTestResults {
  testId: string;
  modelA: string;
  modelB: string;
  duration: number; // days
  sampleSizeA: number;
  sampleSizeB: number;
  completionRateA: number;
  completionRateB: number;
  satisfactionA: number;
  satisfactionB: number;
  winner: string;
  confidenceLevel: number;
  statisticalSignificance: boolean;
  recommendations: string[];
  status: 'running' | 'completed' | 'failed';
}
