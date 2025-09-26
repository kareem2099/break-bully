import * as vscode from 'vscode';
import {
  ProductivityInsights,
  ActivityEvent,
  ActivityType,
  ActivityLevel,
  ActivityMetrics
} from './activityTypes';
import { activitySettings } from './activitySettings';
import { BaseActivityMonitor } from './baseActivityMonitor';
import { SmartScheduler } from './smartScheduler';

export class PatternAnalyzer {
  private activityHistory: ActivityEvent[] = [];

  updateHistory(events: ActivityEvent[]): void {
    this.activityHistory = events;
  }

  // Analyze hourly productivity patterns
  findPeakHours(): number[] {
    const hourlyActivity: number[] = new Array(24).fill(0);
    const hourlyEvents: number[] = new Array(24).fill(0);

    this.activityHistory.forEach(event => {
      const hour = new Date(event.timestamp).getHours();
      hourlyActivity[hour] += event.intensity;
      hourlyEvents[hour] += 1;
    });

    // Calculate average intensity per hour
    const avgHourlyIntensity = hourlyActivity.map((total, hour) =>
      hourlyEvents[hour] > 0 ? total / hourlyEvents[hour] : 0
    );

    // Find top 3 peak hours
    const sortedHours = avgHourlyIntensity
      .map((intensity, hour) => ({ hour, intensity }))
      .sort((a, b) => b.intensity - a.intensity);

    return sortedHours.slice(0, 3).map(item => item.hour);
  }

  // Analyze productivity trends
  analyzeTrends(): {
    daily: number[];
    weekly: number[];
    monthly: number[];
  } {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const oneWeek = 7 * oneDay;
    const oneMonth = 30 * oneDay;

    // Daily trends (last 7 days)
    const dailyTrends = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = now - (i * oneDay);
      const dayEnd = dayStart + oneDay;
      const dayEvents = this.activityHistory.filter(e =>
        e.timestamp >= dayStart && e.timestamp < dayEnd
      );
      const avgIntensity = dayEvents.length > 0
        ? dayEvents.reduce((sum, e) => sum + e.intensity, 0) / dayEvents.length
        : 0;
      dailyTrends.push(avgIntensity);
    }

    // Weekly trends (last 4 weeks)
    const weeklyTrends = [];
    for (let i = 3; i >= 0; i--) {
      const weekStart = now - (i * oneWeek);
      const weekEnd = weekStart + oneWeek;
      const weekEvents = this.activityHistory.filter(e =>
        e.timestamp >= weekStart && e.timestamp < weekEnd
      );
      const avgIntensity = weekEvents.length > 0
        ? weekEvents.reduce((sum, e) => sum + e.intensity, 0) / weekEvents.length
        : 0;
      weeklyTrends.push(avgIntensity);
    }

    // Monthly trends (last 3 months)
    const monthlyTrends = [];
    for (let i = 2; i >= 0; i--) {
      const monthStart = now - (i * oneMonth);
      const monthEnd = monthStart + oneMonth;
      const monthEvents = this.activityHistory.filter(e =>
        e.timestamp >= monthStart && e.timestamp < monthEnd
      );
      const avgIntensity = monthEvents.length > 0
        ? monthEvents.reduce((sum, e) => sum + e.intensity, 0) / monthEvents.length
        : 0;
      monthlyTrends.push(avgIntensity);
    }

    return {
      daily: dailyTrends,
      weekly: weeklyTrends,
      monthly: monthlyTrends
    };
  }

  // Predict break effectiveness based on historical data
  predictBreakEffectiveness(breakType: string): number {
    // Simple prediction based on historical patterns
    // In a real implementation, this would use ML models

    const breakEvents = this.activityHistory.filter(e =>
      e.context.breakType === breakType
    );

    if (breakEvents.length === 0) return 0.5; // Default effectiveness

    // Calculate effectiveness based on post-break activity
    const effectivenessScores = breakEvents.map(event => {
      // Look at activity in the hour after the break
      const postBreakStart = event.timestamp + event.duration! * 60 * 1000;
      const postBreakEnd = postBreakStart + (60 * 60 * 1000);

      const postBreakEvents = this.activityHistory.filter(e =>
        e.timestamp >= postBreakStart && e.timestamp < postBreakEnd
      );

      const avgPostBreakIntensity = postBreakEvents.length > 0
        ? postBreakEvents.reduce((sum, e) => sum + e.intensity, 0) / postBreakEvents.length
        : 0;

      // Higher post-break activity indicates better effectiveness
      return Math.min(1, avgPostBreakIntensity / 10);
    });

    return effectivenessScores.reduce((sum, score) => sum + score, 0) / effectivenessScores.length;
  }

  // Detect burnout patterns
  detectBurnoutPatterns(): {
    isBurnoutRisk: boolean;
    riskLevel: 'low' | 'medium' | 'high';
    indicators: string[];
  } {
    const recentEvents = this.activityHistory.filter(e =>
      e.timestamp > Date.now() - (7 * 24 * 60 * 60 * 1000) // Last 7 days
    );

    const indicators: string[] = [];
    let riskScore = 0;

    // Check for declining productivity
    const dailyAvg = this.analyzeTrends().daily;
    if (dailyAvg.length >= 3) {
      const recent = dailyAvg.slice(-3);
      const earlier = dailyAvg.slice(0, 3);
      const recentAvg = recent.reduce((a, b) => a + b) / recent.length;
      const earlierAvg = earlier.reduce((a, b) => a + b) / earlier.length;

      if (recentAvg < earlierAvg * 0.7) {
        indicators.push('Declining productivity over time');
        riskScore += 2;
      }
    }

    // Check for excessive high-intensity periods
    const highIntensityEvents = recentEvents.filter(e => e.intensity >= 9);
    if (highIntensityEvents.length > 20) {
      indicators.push('Excessive high-intensity work periods');
      riskScore += 1;
    }

    // Check for lack of breaks
    const breakEvents = recentEvents.filter(e => e.type === ActivityType.BREAK_TAKEN);
    if (breakEvents.length < 10) {
      indicators.push('Insufficient break frequency');
      riskScore += 1;
    }

    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (riskScore >= 3) riskLevel = 'high';
    else if (riskScore >= 2) riskLevel = 'medium';

    return {
      isBurnoutRisk: riskScore >= 2,
      riskLevel,
      indicators
    };
  }
}

export class AdvancedAnalytics {
  private baseMonitor: BaseActivityMonitor;
  private smartScheduler: SmartScheduler;
  private patternAnalyzer: PatternAnalyzer;

  constructor(baseMonitor: BaseActivityMonitor, smartScheduler: SmartScheduler) {
    this.baseMonitor = baseMonitor;
    this.smartScheduler = smartScheduler;
    this.patternAnalyzer = new PatternAnalyzer();
  }

  generateInsights(timeRange: 'week' | 'month' | 'all' = 'week'): ProductivityInsights {
    if (!activitySettings.isAdvancedEnabled()) {
      throw new Error('Advanced analytics requires advanced activity integration level');
    }

    // Update pattern analyzer with latest data
    const events = this.baseMonitor.getRecentEvents(
      timeRange === 'week' ? 168 : timeRange === 'month' ? 720 : 8760 // hours
    );
    this.patternAnalyzer.updateHistory(events);

    const peakHours = this.patternAnalyzer.findPeakHours();
    const trends = this.patternAnalyzer.analyzeTrends();
    const optimalSchedule = this.smartScheduler.getOptimalSchedule();

    // Generate personalized recommendations
    const recommendations = this.generateRecommendations();

    // Calculate break effectiveness
    const breakTypes = ['stretch', 'walk', 'meditation', 'coffee', 'social'];
    const effectiveness = breakTypes.map(breakType => ({
      breakType,
      effectiveness: this.patternAnalyzer.predictBreakEffectiveness(breakType)
    }));

    return {
      peakPerformanceHours: peakHours,
      optimalBreakSchedule: optimalSchedule,
      productivityTrends: trends,
      recommendations,
      effectiveness
    };
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const metrics = this.baseMonitor.getMetrics();
    const burnoutAnalysis = this.patternAnalyzer.detectBurnoutPatterns();

    // Burnout prevention
    if (burnoutAnalysis.isBurnoutRisk) {
      if (burnoutAnalysis.riskLevel === 'high') {
        recommendations.push('🚨 High burnout risk detected. Consider taking a full day off or extended break.');
      } else {
        recommendations.push('⚠️ Medium burnout risk. Increase break frequency and duration.');
      }
    }

    // Peak hours optimization
    const peakHours = this.patternAnalyzer.findPeakHours();
    if (peakHours.length > 0) {
      const hourLabels = peakHours.map(h => `${h}:00`).join(', ');
      recommendations.push(`⏰ Your peak productivity hours are: ${hourLabels}. Schedule important tasks during these times.`);
    }

    // Activity level optimization
    if (metrics.activityLevel === ActivityLevel.LOW) {
      recommendations.push('📈 Low activity detected. Consider increasing work intensity or adjusting break patterns.');
    } else if (metrics.activityLevel === ActivityLevel.HIGH) {
      recommendations.push('🔥 High activity sustained. Ensure adequate rest periods to maintain productivity.');
    }

    // Flow state optimization
    const flowTime = this.smartScheduler.getFlowStates(24).reduce((total, state) =>
      total + (state.duration || 0), 0);

    if (flowTime > 180) { // 3+ hours in flow
      recommendations.push('🎯 Excellent flow state achievement! Consider longer work sessions with fewer interruptions.');
    } else if (flowTime < 30) { // Less than 30 minutes in flow
      recommendations.push('🎯 Flow states are brief. Try minimizing distractions and batching similar tasks.');
    }

    // Break optimization
    const breakEffectiveness = this.getTopBreakTypes();
    if (breakEffectiveness.length > 0) {
      recommendations.push(`💡 Most effective breaks for you: ${breakEffectiveness.slice(0, 2).join(', ')}`);
    }

    return recommendations;
  }

  private getTopBreakTypes(): string[] {
    const breakTypes = ['stretch', 'walk', 'meditation', 'coffee', 'social'];
    const effectiveness = breakTypes.map(breakType => ({
      type: breakType,
      score: this.patternAnalyzer.predictBreakEffectiveness(breakType)
    }));

    return effectiveness
      .sort((a, b) => b.score - a.score)
      .map(item => item.type);
  }

  // Advanced productivity scoring
  calculateProductivityScore(): {
    overall: number;
    components: {
      consistency: number;
      intensity: number;
      flow: number;
      recovery: number;
    };
    grade: 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F';
  } {
    const metrics = this.baseMonitor.getMetrics();
    const flowTime = this.smartScheduler.getFlowStates(24).reduce((total, state) =>
      total + (state.duration || 0), 0);

    // Consistency score (how steady is productivity)
    const trends = this.patternAnalyzer.analyzeTrends();
    const consistency = this.calculateConsistencyScore(trends.daily);

    // Intensity score (how intense is the work)
    const intensity = Math.min(100, (metrics.averageScore / 10) * 100);

    // Flow score (time spent in flow states)
    const flow = Math.min(100, (flowTime / 240) * 100); // Target: 4 hours flow/day

    // Recovery score (break effectiveness and frequency)
    const recovery = this.calculateRecoveryScore();

    const overall = (consistency * 0.3) + (intensity * 0.25) + (flow * 0.25) + (recovery * 0.2);

    return {
      overall,
      components: { consistency, intensity, flow, recovery },
      grade: this.scoreToGrade(overall)
    };
  }

  private calculateConsistencyScore(dailyTrends: number[]): number {
    if (dailyTrends.length < 3) return 50;

    const mean = dailyTrends.reduce((a, b) => a + b) / dailyTrends.length;
    const variance = dailyTrends.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / dailyTrends.length;
    const stdDev = Math.sqrt(variance);

    // Lower standard deviation = higher consistency
    const consistency = Math.max(0, 100 - (stdDev * 10));
    return consistency;
  }

  private calculateRecoveryScore(): number {
    const recentEvents = this.baseMonitor.getRecentEvents(24); // 24 hours
    const breakEvents = recentEvents.filter(e => e.type === ActivityType.BREAK_TAKEN);

    // Score based on break frequency and distribution
    const breaksPerHour = breakEvents.length / 24;
    const idealBreaksPerHour = 1/2; // One break every 2 hours

    const frequencyScore = Math.min(100, (breaksPerHour / idealBreaksPerHour) * 100);

    // Distribution score (are breaks evenly spaced?)
    const distributionScore = this.calculateBreakDistribution(breakEvents);

    return (frequencyScore * 0.7) + (distributionScore * 0.3);
  }

  private calculateBreakDistribution(breakEvents: ActivityEvent[]): number {
    if (breakEvents.length < 2) return 50;

    const intervals = [];
    for (let i = 1; i < breakEvents.length; i++) {
      const interval = breakEvents[i].timestamp - breakEvents[i-1].timestamp;
      intervals.push(interval);
    }

    const avgInterval = intervals.reduce((a, b) => a + b) / intervals.length;
    const variance = intervals.reduce((sum, interval) =>
      sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);

    // Lower variance = more consistent distribution
    return Math.max(0, 100 - (stdDev / avgInterval) * 100);
  }

  private scoreToGrade(score: number): 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F' {
    if (score >= 95) return 'A+';
    if (score >= 90) return 'A';
    if (score >= 85) return 'B+';
    if (score >= 80) return 'B';
    if (score >= 75) return 'C+';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  // Export detailed analytics data
  exportAnalyticsData(): {
    summary: ProductivityInsights;
    productivityScore: any;
    burnoutAnalysis: any;
    rawData: ActivityEvent[];
  } {
    return {
      summary: this.generateInsights(),
      productivityScore: this.calculateProductivityScore(),
      burnoutAnalysis: this.patternAnalyzer.detectBurnoutPatterns(),
      rawData: this.baseMonitor.getRecentEvents(168) // Last week
    };
  }
}
