import { ActivityEvent } from './activityTypes';

/**
 * Machine Learning Analyzer for Activity Monitoring
 * Provides intelligent insights into productivity patterns and optimal work times
 */
export class MachineLearningAnalyzer {

  /**
   * Analyzes productivity patterns to identify optimal work times
   */
  static analyzePeakPerformanceTimes(events: ActivityEvent[], days: number = 30): {
    peakHours: Array<{hour: number, avgScore: number, confidence: number}>;
    optimalWindows: Array<{startHour: number, endHour: number, score: number}>;
    insights: string[];
  } {
    const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
    const recentEvents = events.filter(e => e.timestamp > cutoffTime);

    if (recentEvents.length < 50) {
      return {
        peakHours: [],
        optimalWindows: [],
        insights: ['Not enough data available yet. Continue using the extension for more accurate insights.']
      };
    }

    // Group events by hour of day
    const hourGroups: { [hour: number]: ActivityEvent[] } = {};
    recentEvents.forEach(event => {
      const hour = new Date(event.timestamp).getHours();
      hourGroups[hour] = hourGroups[hour] || [];
      hourGroups[hour].push(event);
    });

    // Calculate average productivity score per hour
    const hourAverages: Array<{hour: number, avgScore: number, count: number}> = [];
    Object.entries(hourGroups).forEach(([hour, hourEvents]) => {
      const avgScore = hourEvents.reduce((sum, e) => sum + e.intensity, 0) / hourEvents.length;
      hourAverages.push({ hour: parseInt(hour), avgScore, count: hourEvents.length });
    });

    // Sort by productivity score
    hourAverages.sort((a, b) => b.avgScore - a.avgScore);

    // Calculate confidence (based on sample size)
    const peakHours = hourAverages.slice(0, 5).map(h => ({
      hour: h.hour,
      avgScore: Math.round(h.avgScore * 10) / 10,
      confidence: Math.min(h.count / 20, 1) // Confidence based on sample size (20 = perfect confidence)
    }));

    // Find optimal 2-hour windows (contiguous blocks of high productivity)
    const optimalWindows = this.findOptimalWindows(hourAverages.slice(0, 10), 2);

    // Generate insights
    const insights = this.generatePeakTimeInsights(peakHours, optimalWindows);

    return { peakHours, optimalWindows, insights };
  }

  /**
   * Detects burnout patterns and suggests intervention times
   */
  static detectBurnoutPatterns(events: ActivityEvent[]): {
    riskLevel: 'low' | 'medium' | 'high';
    warningSigns: string[];
    recommendedInterventions: string[];
    nextBreakSugestion: { timeToNextBreak: number, reason: string };
  } {
    const recentSessions = this.getRecentSessions(events, 7); // Last 7 days

    if (recentSessions.length < 10) {
      return {
        riskLevel: 'low',
        warningSigns: [],
        recommendedInterventions: [],
        nextBreakSugestion: { timeToNextBreak: 60, reason: 'Regular break schedule' }
      };
    }

    const avgSessionLength = recentSessions.reduce((sum, s) => sum + s.duration, 0) / recentSessions.length;
    const avgIntensityNow = this.calculateAverageIntensity(recentSessions.slice(-5)); // Last 5 sessions
    const avgIntensityBaseline = this.calculateAverageIntensity(recentSessions);

    const intensityDrop = avgIntensityBaseline - avgIntensityNow;
    const longSessions = recentSessions.filter(s => s.duration > avgSessionLength * 1.5).length;
    const consecutiveLongSessions = this.detectConsecutiveLongSessions(recentSessions);

    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    let warningSigns: string[] = [];
    let recommendedInterventions: string[] = [];
    let timeToNextBreak = 45; // Default 45 minutes
    let breakReason = 'Regular break schedule';

    // Assess burnout risk
    if (intensityDrop > 2 && longSessions > 3) {
      riskLevel = 'high';
      warningSigns = [
        `Productivity dropped ${intensityDrop.toFixed(1)} points from baseline`,
        `${longSessions} sessions were unusually long`,
        'Consecutive long sessions detected'
      ];
      recommendedInterventions = [
        'Take a 20-30 minute break immediately',
        'Consider switching to lighter tasks',
        'Try walking or stretching exercises normalize'
      ];
      timeToNextBreak = 10; // Immediate break
      breakReason = 'High burnout risk detected';
    } else if (consecutiveLongSessions >= 2 || intensityDrop > 1) {
      riskLevel = 'medium';
      warningSigns = [
        'Multiple consecutive long sessions detected',
        intensityDrop > 0 ? `Slight productivity dip (${intensityDrop.toFixed(1)} points)` : 'Sustained long sessions'
      ];
      recommendedInterventions = [
        'Take a 15-minute break soon',
        'Try the 20-20-20 rule if screen time is extensive',
        'Consider changing to a different type of task'
      ];
      timeToNextBreak = 20;
      breakReason = 'Medium burnout risk - prevention recommended';
    }

    return {
      riskLevel,
      warningSigns,
      recommendedInterventions,
      nextBreakSugestion: { timeToNextBreak, reason: breakReason }
    };
  }

  /**
   * Predicts productivity for specific times and activities
   */
  static predictProductivity(
    events: ActivityEvent[],
    targetTime: number, // Timestamp for prediction
    activityType?: string
  ): {
    predictedScore: number;
    confidence: number;
    factors: string[];
    recommendations: string[];
  } {
    const targetHour = new Date(targetTime).getHours();
    const targetDayOfWeek = new Date(targetTime).getDay();

    // Analyze historical productivity at similar times
    const similarTimeEvents = events.filter(event => {
      const eventHour = new Date(event.timestamp).getHours();
      const eventDay = new Date(event.timestamp).getDay();
      return Math.abs(eventHour - targetHour) <= 1 && // Within 1 hour window
             Math.abs(eventDay - targetDayOfWeek) <= 1; // Similar day of week (±1)
    });

    if (similarTimeEvents.length < 10) {
      return {
        predictedScore: 5.0, // Default middle value
        confidence: 0.1,
        factors: ['Insufficient historical data for this time'],
        recommendations: ['Continue building activity history for better predictions']
      };
    }

    // Calculate weighted average with temporal decay (recent events more important)
    const now = Date.now();
    let totalWeightedScore = 0;
    let totalWeightedConfidence = 0;

    similarTimeEvents.forEach(event => {
      const daysOld = (now - event.timestamp) / (24 * 60 * 60 * 1000);
      const temporalWeight = Math.exp(-daysOld / 7); // Exponential decay over 7 days

      // Activity type bonus (if specified)
      const typeBonus = activityType && event.context &&
                       event.context.fileType === activityType ? 0.5 : 0;

      const finalWeight = temporalWeight * (1 + typeBonus);

      totalWeightedScore += event.intensity * finalWeight;
      totalWeightedConfidence += finalWeight;
    });

    const predictedScore = Math.min(10, Math.max(1, totalWeightedScore / totalWeightedConfidence));
    const confidence = Math.min(1, Math.sqrt(similarTimeEvents.length) / 20); // Confidence based on sample size

    // Generate factors and recommendations
    const factors = this.generatePredictionFactors(targetHour, similarTimeEvents.length, predictedScore);
    const recommendations = this.generateProductivityRecommendations(
      predictedScore,
      confidence,
      targetHour
    );

    return {
      predictedScore: Math.round(predictedScore * 10) / 10,
      confidence: Math.round(confidence * 100) / 100,
      factors,
      recommendations
    };
  }

  /**
   * Analyzes work patterns and suggests optimal session structures
   */
  static analyzeWorkPatterns(events: ActivityEvent[]): {
    optimalSessionLength: number;
    optimalBreakLength: number;
    workRestRatio: string;
    peakProductivityPatterns: string[];
    productivityTrends: 'improving' | 'stable' | 'declining';
  } {
    if (!events || !Array.isArray(events)) {
      return {
        optimalSessionLength: 45,
        optimalBreakLength: 10,
        workRestRatio: '45:10',
        peakProductivityPatterns: [],
        productivityTrends: 'stable'
      };
    }

    const recentSessions = this.getRecentSessions(events, 14); // Last 2 weeks

    if (recentSessions.length < 20) {
      return {
        optimalSessionLength: 45,
        optimalBreakLength: 10,
        workRestRatio: '45:10',
        peakProductivityPatterns: [],
        productivityTrends: 'stable'
      };
    }

    // Analyze session lengths and productivity
    const sessionAnalysis = this.analyzeSessionPerformance(recentSessions);
    const optimizationResult = this.optimizeWorkRestCycle(sessionAnalysis);

    return {
      optimalSessionLength: optimizationResult.sessionLength,
      optimalBreakLength: optimizationResult.breakLength,
      workRestRatio: `${optimizationResult.sessionLength}:${optimizationResult.breakLength}`,
      peakProductivityPatterns: this.generatePatternInsights(sessionAnalysis),
      productivityTrends: this.calculateProductivityTrend(recentSessions)
    };
  }

  // ===== PRIVATE HELPER METHODS =====

  private static findOptimalWindows(
    hourScores: Array<{hour: number, avgScore: number, count: number}>,
    windowSize: number
  ): Array<{startHour: number, endHour: number, score: number}> {
    const windows: Array<{startHour: number, endHour: number, score: number}> = [];

    for (let start = 0; start <= 24 - windowSize; start++) {
      let totalScore = 0;
      let validHours = 0;

      for (let h = start; h < start + windowSize; h++) {
        const hourScore = hourScores.find(hs => hs.hour === h);
        if (hourScore) {
          totalScore += hourScore.avgScore;
          validHours++;
        }
      }

      if (validHours === windowSize) {
        windows.push({
          startHour: start,
          endHour: start + windowSize,
          score: Math.round((totalScore / validHours) * 10) / 10
        });
      }
    }

    return windows.sort((a, b) => b.score - a.score).slice(0, 3);
  }

  private static generatePeakTimeInsights(
    peakHours: Array<{hour: number, avgScore: number, confidence: number}>,
    optimalWindows: Array<{startHour: number, endHour: number, score: number}>
  ): string[] {
    const insights: string[] = [];

    if (peakHours.length === 0) {
      insights.push('Not enough data to determine peak performance times yet.');
      return insights;
    }

    const bestTime = peakHours[0];
    const timeFormat = bestTime.hour === 0 ? '12 AM' :
                      bestTime.hour < 12 ? `${bestTime.hour} AM` :
                      bestTime.hour === 12 ? '12 PM' :
                      `${bestTime.hour - 12} PM`;

    insights.push(`🏆 Peak Performance: ${timeFormat} (Productivity: ${bestTime.avgScore}/10)`);

    if (optimalWindows.length > 0) {
      const bestWindow = optimalWindows[0];
      const startFormat = bestWindow.startHour === 0 ? '12 AM' :
                         bestWindow.startHour < 12 ? `${bestWindow.startHour} AM` :
                         bestWindow.startHour === 12 ? '12 PM' :
                         `${bestWindow.startHour - 12} PM`;
      const endFormat = bestWindow.endHour === 0 ? '12 AM' :
                       bestWindow.endHour < 12 ? `${bestWindow.endHour} AM` :
                       bestWindow.endHour === 12 ? '12 PM' :
                       `${bestWindow.endHour - 12} PM`;

      insights.push(`⏰ Optimal Window: ${startFormat}-${endFormat} (Avg: ${bestWindow.score}/10)`);
    }

    // Add confidence-based insights
    const highConfidenceHours = peakHours.filter(h => h.confidence > 0.7);
    if (highConfidenceHours.length >= 2) {
      insights.push('🎯 Strong confidence in your peak performance times.');
    }

    return insights;
  }

  private static getRecentSessions(events: ActivityEvent[], days: number): Array<{
    startTime: number;
    duration: number;
    avgIntensity: number;
    eventCount: number;
  }> {
    const sessionsByDay: { [date: string]: {events: ActivityEvent[], startTime: number} } = {};

    const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);

    // Group events by day
    events.forEach(event => {
      if (event.timestamp > cutoffTime) {
        const date = new Date(event.timestamp).toDateString();
        if (!sessionsByDay[date]) {
          sessionsByDay[date] = { events: [], startTime: event.timestamp };
        }
        sessionsByDay[date].events.push(event);
      }
    });

    // Calculate session metrics
    const sessions: Array<{
      startTime: number;
      duration: number;
      avgIntensity: number;
      eventCount: number;
    }> = [];

    Object.values(sessionsByDay).forEach(day => {
      if (day.events.length > 0) {
        const duration = day.events.length * 1; // Rough duration estimate (1 min per event)
        const avgIntensity = day.events.reduce((sum, e) => sum + e.intensity, 0) / day.events.length;

        sessions.push({
          startTime: day.startTime,
          duration,
          avgIntensity,
          eventCount: day.events.length
        });
      }
    });

    return sessions.sort((a, b) => b.startTime - a.startTime);
  }

  private static calculateAverageIntensity(sessions: Array<{avgIntensity: number}>): number {
    return sessions.length > 0
      ? sessions.reduce((sum, s) => sum + s.avgIntensity, 0) / sessions.length
      : 0;
  }

  private static detectConsecutiveLongSessions(sessions: Array<{duration: number}>): number {
    const avgDuration = sessions.reduce((sum, s) => sum + s.duration, 0) / sessions.length;
    const longThreshold = avgDuration * 1.3;

    let consecutiveCount = 0;
    let maxConsecutive = 0;

    sessions.forEach(session => {
      if (session.duration > longThreshold) {
        consecutiveCount++;
        maxConsecutive = Math.max(maxConsecutive, consecutiveCount);
      } else {
        consecutiveCount = 0;
      }
    });

    return maxConsecutive;
  }

  private static generatePredictionFactors(
    targetHour: number,
    sampleSize: number,
    predictedScore: number
  ): string[] {
    const factors: string[] = [];
    factors.push(`Historical data from ${sampleSize} similar time periods`);
    factors.push(`Time of day: ${targetHour}:00`);

    if (predictedScore >= 8) {
      factors.push('High productivity potential predicted for this time slot');
    } else if (predictedScore < 4) {
      factors.push('Lower productivity potential predicted - consider alternative scheduling');
    }

    if (sampleSize < 20) {
      factors.push('Limited sample size - predictions may improve with more activity data');
    } else if (sampleSize > 100) {
      factors.push('Strong statistical confidence from extensive historical data');
    }

    return factors;
  }

  private static generateProductivityRecommendations(
    predictedScore: number,
    confidence: number,
    targetHour: number
  ): string[] {
    const recommendations: string[] = [];

    if (predictedScore >= 8) {
      recommendations.push('🎯 Perfect time for complex tasks or deep work');
    } else if (predictedScore >= 6) {
      recommendations.push('👍 Good time for regular coding work');
    } else if (predictedScore < 4) {
      recommendations.push('⚡ Consider lighter tasks or review work');

      if (confidence > 0.5) {
        recommendations.push('This appears to be a low-productivity time - consider avoiding complex tasks');
      }

      // Add time-specific advice for low productivity hours
      if (targetHour >= 22 || targetHour <= 6) {
        recommendations.push('Late/early hours - consider rest instead of intensive work');
      }
    }

    // Add morning vs evening specific advice
    if (targetHour >= 9 && targetHour <= 12 && predictedScore >= 7) {
      recommendations.push('🔄 Morning momentum - great for tackling your most important tasks');
    } else if (targetHour >= 14 && targetHour <= 16 && predictedScore < 6) {
      recommendations.push('🌅 Afternoon slump - consider a short walk or hydration break');
    }

    if (confidence > 0.8) {
      recommendations.push('💯 High confidence prediction based on extensive activity history');
    }

    return recommendations;
  }

  private static analyzeSessionPerformance(sessions: Array<{duration: number, avgIntensity: number}>): Array<{
    duration: number,
    avgIntensity: number,
    efficiency: number // Intensity per unit time
  }> {
    return sessions.map(session => ({
      duration: session.duration,
      avgIntensity: session.avgIntensity,
      efficiency: session.avgIntensity / Math.max(session.duration, 1)
    })).sort((a, b) => b.efficiency - a.efficiency);
  }

  private static optimizeWorkRestCycle(sessionAnalysis: Array<{
    duration: number,
    avgIntensity: number,
    efficiency: number
  }>): {
    sessionLength: number,
    breakLength: number,
    efficiency: number
  } {
    // Find the duration range with highest average efficiency
    const durationGroups: { [duration: number]: { intensities: number[], efficiency: number[] } } = {};

    sessionAnalysis.forEach(session => {
      const duration = Math.round(session.duration / 5) * 5; // Round to nearest 5 minutes
      if (!durationGroups[duration]) {
        durationGroups[duration] = { intensities: [], efficiency: [] };
      }
      durationGroups[duration].intensities.push(session.avgIntensity);
      durationGroups[duration].efficiency.push(session.efficiency);
    });

    const results: Array<{duration: number, avgIntensity: number, avgEfficiency: number, sampleSize: number}> = [];

    Object.entries(durationGroups).forEach(([duration, data]) => {
      if (data.intensities.length >= 3) { // Minimum sample size
        const avgIntensity = data.intensities.reduce((sum, i) => sum + i, 0) / data.intensities.length;
        const avgEfficiency = data.efficiency.reduce((sum, e) => sum + e, 0) / data.efficiency.length;

        results.push({
          duration: parseInt(duration),
          avgIntensity,
          avgEfficiency,
          sampleSize: data.intensities.length
        });
      }
    });

    if (results.length === 0) {
      // Default fallback
      return { sessionLength: 45, breakLength: 10, efficiency: 0 };
    }

    // Find optimal work duration (balance between length and efficiency)
    results.sort((a, b) => b.avgEfficiency - a.avgEfficiency);

    const bestWorkDuration = Math.max(25, Math.min(90, results[0].duration));

    // Suggest break duration (typically 1/4 to 1/3 of work time for optimal recovery)
    const bestBreakDuration = Math.max(5, Math.round(bestWorkDuration / 6));

    return {
      sessionLength: bestWorkDuration,
      breakLength: bestBreakDuration,
      efficiency: results[0].avgEfficiency
    };
  }

  private static generatePatternInsights(analysis: Array<{
    duration: number,
    avgIntensity: number,
    efficiency: number
  }>): string[] {
    const insights: string[] = [];

    if (analysis.length === 0) return insights;

    const avgEfficiency = analysis.reduce((sum, a) => sum + a.efficiency, 0) / analysis.length;
    const highEfficiencySessions = analysis.filter(a => a.efficiency > avgEfficiency * 1.2);

    if (highEfficiencySessions.length > 0) {
      const avgHighEffDuration = highEfficiencySessions.reduce((sum, s) => sum + s.duration, 0) / highEfficiencySessions.length;
      const roundedDuration = Math.round(avgHighEffDuration / 5) * 5; // Round to 5 minutes
      insights.push(`🔥 High-efficiency sessions average ${roundedDuration} minutes`);
    }

    if (analysis[0].efficiency > avgEfficiency * 1.3) {
      insights.push('⚡ Your most efficient sessions are longer than average - sustained focus works for you');
    } else if (analysis[0].efficiency < avgEfficiency * 0.8) {
      insights.push('🔔 Longer sessions tend to be less efficient - consider more frequent breaks');
    }

    return insights;
  }

  private static calculateProductivityTrend(
    sessions: Array<{startTime: number, avgIntensity: number}>
  ): 'improving' | 'stable' | 'declining' {
    if (sessions.length < 10) return 'stable';

    // Calculate trend over recent sessions by comparing first half vs second half
    const midpoint = Math.floor(sessions.length / 2);
    const firstHalf = sessions.slice(0, midpoint);
    const secondHalf = sessions.slice(midpoint);

    const firstHalfAvg = firstHalf.reduce((sum, s) => sum + s.avgIntensity, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, s) => sum + s.avgIntensity, 0) / secondHalf.length;

    const difference = secondHalfAvg - firstHalfAvg;

    if (difference > 0.5) {
      return 'improving';
    } else if (difference < -0.5) {
      return 'declining';
    } else {
      return 'stable';
    }
  }
}
