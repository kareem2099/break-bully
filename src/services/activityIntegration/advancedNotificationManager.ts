import { ActivityEvent } from './activityTypes';
import { WellnessMLAnalyzer } from './wellnessMLAnalyzer';

/**
 * Advanced Notification Manager with ML-powered optimization
 */
export class AdvancedNotificationManager {

  private notificationHistory: Array<{
    timestamp: number;
    type: 'stretch' | 'breathing' | 'eye' | 'water';
    message: string;
    successful: boolean;
    responseTime: number;
    userAccepted: boolean;
    userDismissed: boolean;
    context?: string;
  }> = [];

  constructor() {
    this.loadNotificationHistory();
  }

  /**
   * Gets the optimal notification for a wellness activity
   */
  getOptimalWellnessNotification(
    activityType: 'stretch' | 'breathing' | 'eye' | 'water',
    events: ActivityEvent[],
    currentHour: number = new Date().getHours()
  ): {
    shouldNotify: boolean;
    message: string;
    urgency: 'low' | 'medium' | 'high';
    reasoning: string;
    optimalTiming: boolean;
    estimatedAcceptanceRate: number;
  } {
    const notificationInsights = WellnessMLAnalyzer.optimizeNotifications(events, this.notificationHistory);

    // Check if this is an optimal timing for this activity
    const optimalTiming = notificationInsights.optimalNotificationTiming[activityType];
    const isOptimalTime = optimalTiming?.hours.includes(currentHour) || false;

    // Get historical success rate for this activity type
    const successRate = this.calculateRecentSuccessRate(activityType, 7); // Last 7 days

    // Determine if we should notify and with what urgency
    const shouldNotify = this.shouldSendNotification(activityType, currentHour, successRate);
    const urgency = this.calculateUrgency(activityType, currentHour, isOptimalTime, successRate);
    const message = this.generateMessage(activityType, urgency, notificationInsights.personalizedMessaging[activityType] || []);
    const reasoning = this.generateReasoning(activityType, currentHour, successRate, isOptimalTime);

    return {
      shouldNotify,
      message,
      urgency,
      reasoning,
      optimalTiming: isOptimalTime,
      estimatedAcceptanceRate: successRate
    };
  }

  /**
   * Records a notification interaction for learning
   */
  recordNotificationInteraction(
    type: 'stretch' | 'breathing' | 'eye' | 'water',
    message: string,
    accepted: boolean,
    dismissed: boolean,
    responseTime: number,
    context: string | undefined
  ): void {
    const interaction = {
      timestamp: Date.now(),
      type,
      message,
      successful: accepted,
      responseTime,
      userAccepted: accepted,
      userDismissed: dismissed,
      context: context || ''
    };

    this.notificationHistory.push(interaction);

    // Keep only last 1000 interactions to prevent memory bloat
    if (this.notificationHistory.length > 1000) {
      this.notificationHistory = this.notificationHistory.slice(-1000);
    }

    this.saveNotificationHistory();
  }

  /**
   * Gets notification performance analytics
   */
  getNotificationAnalytics(): {
    overall: { sent: number; accepted: number; successRate: number };
    byType: { [type: string]: { sent: number; accepted: number; successRate: number; avgResponseTime: number } };
    timing: { [hour: number]: { sent: number; accepted: number; successRate: number } };
    insights: string[];
  } {
    const overall = {
      sent: this.notificationHistory.length,
      accepted: this.notificationHistory.filter(n => n.userAccepted).length,
      successRate: 0
    };

    overall.successRate = overall.sent > 0 ? overall.accepted / overall.sent : 0;

    // Analyze by type
    const typeStats: { [type: string]: { sent: number; accepted: number; responseTimes: number[] } } = {};

    this.notificationHistory.forEach(notification => {
      if (!typeStats[notification.type]) {
        typeStats[notification.type] = { sent: 0, accepted: 0, responseTimes: [] };
      }

      typeStats[notification.type].sent++;
      if (notification.userAccepted) {
        typeStats[notification.type].accepted++;
        typeStats[notification.type].responseTimes.push(notification.responseTime);
      }
    });

    const byType: { [type: string]: { sent: number; accepted: number; successRate: number; avgResponseTime: number } } = {};

    Object.entries(typeStats).forEach(([type, stats]) => {
      const avgResponseTime = stats.responseTimes.length > 0
        ? stats.responseTimes.reduce((sum, time) => sum + time, 0) / stats.responseTimes.length
        : 300;

      byType[type] = {
        sent: stats.sent,
        accepted: stats.accepted,
        successRate: stats.sent > 0 ? stats.accepted / stats.sent : 0,
        avgResponseTime: Math.round(avgResponseTime)
      };
    });

    // Analyze by hour
    const timingStats: { [hour: number]: { sent: number; accepted: number; responseTimes: number[] } } = {};

    this.notificationHistory.forEach(notification => {
      const hour = new Date(notification.timestamp).getHours();
      if (!timingStats[hour]) {
        timingStats[hour] = { sent: 0, accepted: 0, responseTimes: [] };
      }

      timingStats[hour].sent++;
      if (notification.userAccepted) {
        timingStats[hour].accepted++;
        timingStats[hour].responseTimes.push(notification.responseTime);
      }
    });

    const timing: { [hour: number]: { sent: number; accepted: number; successRate: number } } = {};

    Object.entries(timingStats).forEach(([hour, stats]) => {
      timing[parseInt(hour)] = {
        sent: stats.sent,
        accepted: stats.accepted,
        successRate: stats.sent > 0 ? stats.accepted / stats.sent : 0
      };
    });

    // Generate insights
    const insights = this.generateNotificationInsights(overall, byType, timing);

    return { overall, byType, timing, insights };
  }

  /**
   * Gets stress-level aware notification recommendations
   */
  getStressLevelNotifications(
    stressLevel: 'low' | 'medium' | 'high',
    events: ActivityEvent[]
  ): Array<{
    type: 'stretch' | 'breathing' | 'eye' | 'water';
    priority: 'immediate' | 'high' | 'normal' | 'low';
    message: string;
    reasoning: string;
  }> {
    const recommendations: Array<{
      type: 'stretch' | 'breathing' | 'eye' | 'water';
      priority: 'immediate' | 'high' | 'normal' | 'low';
      message: string;
      reasoning: string;
    }> = [];

    const burnoutAnalysis = WellnessMLAnalyzer.detectBurnoutPatterns(events);

    if (stressLevel === 'high' || burnoutAnalysis.riskLevel === 'high') {
      recommendations.push(
        {
          type: 'breathing',
          priority: 'immediate',
          message: '⚡ High stress detected! Take 5 deep breaths right now to reset.',
          reasoning: 'Immediate breathing exercise most effective for acute stress relief'
        },
        {
          type: 'stretch',
          priority: 'high',
          message: '💪 Quick shoulder rolls and neck stretches to release tension?',
          reasoning: 'Physical tension often accompanies high stress'
        }
      );
    }

    if (stressLevel === 'medium' || burnoutAnalysis.riskLevel === 'medium') {
      recommendations.push(
        {
          type: 'breathing',
          priority: 'normal',
          message: '🧘 Taking a mindful breathing break could help you refocus.',
          reasoning: 'Medium stress benefits from moderate breathing intervention'
        },
        {
          type: 'water',
          priority: 'normal',
          message: '💧 A hydration break might help clear your mind.',
          reasoning: 'Dehydration can compound mental fatigue'
        }
      );
    }

    if (stressLevel === 'low' && burnoutAnalysis.riskLevel === 'low') {
      recommendations.push(
        {
          type: 'stretch',
          priority: 'low',
          message: '🏃‍♂️ Feel like a gentle stretch to maintain your flow?',
          reasoning: 'Low stress - preventive maintenance optimal'
        }
      );
    }

    // Add contextual recommendations based on time of day
    const hour = new Date().getHours();
    if (hour >= 14 && hour <= 16) { // Afternoon slump
      recommendations.push({
        type: 'stretch',
        priority: 'high',
        message: '🌅 Afternoon energy boost with a full stretch routine?',
        reasoning: 'Afternoon timing aligns with natural energy dip'
      });
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { immediate: 4, high: 3, normal: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  // ===== PRIVATE METHODS =====

  private shouldSendNotification(
    activityType: 'stretch' | 'breathing' | 'eye' | 'water',
    currentHour: number,
    successRate: number
  ): boolean {
    // Don't send notifications during certain hours
    if (currentHour < 7 || currentHour > 22) return false; // Respect sleep hours

    // Check for recent successful notifications of same type
    const recentSameType = this.notificationHistory
      .filter(n => n.type === activityType && Date.now() - n.timestamp < 1800000) // Last 30 minutes
      .filter(n => n.userAccepted);

    if (recentSameType.length > 0) return false; // Don't spam with same activity

    // High success rate = more aggressive
    if (successRate > 0.7) return true;

    // Medium success rate = selective
    if (successRate > 0.4) {
      return Math.random() < 0.7; // 70% chance
    }

    // Low success rate = very selective
    return Math.random() < 0.3; // 30% chance
  }

  private calculateUrgency(
    activityType: 'stretch' | 'breathing' | 'eye' | 'water',
    currentHour: number,
    isOptimalTime: boolean,
    successRate: number
  ): 'low' | 'medium' | 'high' {
    let urgencyScore = 0;

    // Optimal timing boost
    if (isOptimalTime) urgencyScore += 2;

    // Success rate influence
    if (successRate > 0.7) urgencyScore += 1;
    else if (successRate < 0.4) urgencyScore -= 1;

    // Time-based urgency
    if (currentHour >= 14 && currentHour <= 16) urgencyScore += 1; // Afternoon slump

    // Activity-specific urgency
    if (activityType === 'breathing') urgencyScore += 1; // Breathing often more urgent
    if (activityType === 'water') urgencyScore -= 0.5; // Water less urgent

    if (urgencyScore >= 2.5) return 'high';
    if (urgencyScore >= 1) return 'medium';
    return 'low';
  }

  private generateMessage(
    activityType: 'stretch' | 'breathing' | 'eye' | 'water',
    urgency: 'low' | 'medium' | 'high',
    personalizedStrategies: string[]
  ): string {
    const baseMessages = {
      stretch: {
        high: [
          '💪 Urgent: Your body needs stretching now!',
          '🏃‍♂️ Critical: Time for immediate tension release',
          '🔥 High priority: Stretch NOW to prevent fatigue buildup'
        ],
        medium: [
          '🏃‍♂️ Ready for some stretches to keep the blood flowing?',
          '💪 Feel like a stretch break to maintain your energy?',
          '🏃‍♀️ A quick stretching routine could help you refocus'
        ],
        low: [
          '🏃‍♂️ Gentle reminder: Consider some stretches when convenient',
          '💪 Optional: Feel free to stretch if you have a moment',
          '🏃‍♀️ Low-key suggestion: Stretching could be beneficial now'
        ]
      },
      breathing: {
        high: [
          '🧘 CRITICAL: Take deep breaths RIGHT NOW for immediate relief',
          '🌬️ Urgent: Breathing exercise needed for stress reduction',
          '🔥 Emergency: Immediate breathing break required'
        ],
        medium: [
          '🧘 Ready for some mindful breathing to reset?',
          '🌬️ A breathing exercise could help clear your mind',
          '🧘 Consider taking a brief breathing break'
        ],
        low: [
          '🧘 Gentle suggestion: Breathing could help you recenter',
          '🌬️ Optional: Feel free to try a breathing exercise',
          '🧘 Low-key reminder: Breathing might be beneficial now'
        ]
      },
      eye: {
        high: [
          '👁️ URGENT: Eye break needed NOW to prevent strain!',
          '🔥 Critical: Immediate eye exercises for screen fatigue',
          '⚠️ Emergency: Eyes need immediate rest'
        ],
        medium: [
          '👁️ Time for an eye break from screens?',
          '🔥 Consider eye exercises to reduce screen fatigue',
          '👁️ A quick eye break could help maintain focus'
        ],
        low: [
          '👁️ Optional eye break when you get a moment',
          '🔥 Gentle reminder to rest your eyes occasionally',
          '👁️ Consider eye exercises if screens feel tiring'
        ]
      },
      water: {
        high: [
          '💧 CRITICAL: Hydration needed NOW for brain function!',
          '🏺 Urgent: Water break essential for mental clarity',
          '⚠️ Emergency: Immediate hydration required'
        ],
        medium: [
          '💧 Time for a hydration break?',
          '🏺 Consider drinking water to maintain focus',
          '💧 A water break could help sustain your energy'
        ],
        low: [
          '💧 Optional: Consider hydrating when convenient',
          '🏺 Gentle reminder to stay hydrated',
          '💧 Feel free to take a water break if thirsty'
        ]
      }
    };

    const messages = baseMessages[activityType][urgency];
    let selectedMessage = messages[Math.floor(Math.random() * messages.length)];

    // Apply personalization based on learned strategies
    if (personalizedStrategies.includes('use empowering, positive messaging') && urgency === 'medium') {
      // Add positive reinforcement
      selectedMessage += ' 🌟';
    }

    if (personalizedStrategies.includes('Consider adding social proof or gentle peer pressure')) {
      selectedMessage += ' (Recommended by health experts!)';
    }

    if (personalizedStrategies.includes('Try urgency-based messaging for faster engagement') && urgency !== 'high') {
      // Add subtle urgency
      selectedMessage = selectedMessage.replace('Consider', 'Good time to');
    }

    return selectedMessage;
  }

  private generateReasoning(
    activityType: 'stretch' | 'breathing' | 'eye' | 'water',
    currentHour: number,
    successRate: number,
    isOptimalTime: boolean
  ): string {
    let reasoning = '';

    if (successRate > 0.7) {
      reasoning += 'High historical success rate suggests good timing. ';
    } else if (successRate < 0.4) {
      reasoning += 'Lower success rate - extending notification experiment. ';
    }

    if (isOptimalTime) {
      reasoning += 'Optimal time based on your activity patterns. ';
    }

    if (currentHour >= 14 && currentHour <= 16) {
      reasoning += 'Strategic afternoon timing for energy boost. ';
    }

    if (currentHour >= 8 && currentHour <= 10) {
      reasoning += 'Morning timing supports healthy daily rhythm. ';
    }

    return reasoning.trim() || 'Standard wellness timing recommendation';
  }

  private calculateRecentSuccessRate(activityType: string, days: number): number {
    const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
    const recentNotifications = this.notificationHistory
      .filter(n => n.type === activityType && n.timestamp > cutoffTime);

    if (recentNotifications.length === 0) return 0.5; // Default

    const accepted = recentNotifications.filter(n => n.userAccepted).length;
    return accepted / recentNotifications.length;
  }

  private generateNotificationInsights(
    overall: { sent: number; accepted: number; successRate: number },
    byType: { [type: string]: { sent: number; accepted: number; successRate: number; avgResponseTime: number } },
    timing: { [hour: number]: { sent: number; accepted: number; successRate: number } }
  ): string[] {
    const insights: string[] = [];

    // Overall performance
    insights.push(`📊 Overall acceptance rate: ${Math.round(overall.successRate * 100)}% (${overall.accepted}/${overall.sent})`);

    // Best performing activity type
    const bestType = Object.entries(byType)
      .sort(([, a], [, b]) => b.successRate - a.successRate)[0];

    if (bestType && bestType[1].sent >= 10) {
      const [type, stats] = bestType;
      insights.push(`🥇 Best performing: ${type} (${Math.round(stats.successRate * 100)}% acceptance)`);
    }

    // Best performing hour
    const bestHour = Object.entries(timing)
      .filter(([, stats]) => stats.sent >= 5)
      .sort(([, a], [, b]) => b.successRate - a.successRate)[0];

    if (bestHour) {
      const [hour, stats] = bestHour;
      const hour12 = parseInt(hour) === 0 ? 12 : parseInt(hour) > 12 ? parseInt(hour) - 12 : hour;
      const ampm = parseInt(hour) >= 12 ? 'PM' : 'AM';
      const hourName = hour12 + ' ' + ampm;

      insights.push(`🏆 Best hour: ${hourName} (${Math.round(stats.successRate * 100)}% acceptance)`);
    }

    // Response time analysis
    const avgResponseTime = Object.values(byType)
      .reduce((sum, type) => sum + type.avgResponseTime, 0) / Object.values(byType).length;

    if (avgResponseTime < 120) {
      insights.push('⚡ Fast responses suggest highly engaging notifications');
    } else if (avgResponseTime > 600) {
      insights.push('🐌 Slower responses indicate need for more urgent messaging');
    }

    // Improvement recommendations
    const lowPerformingTypes = Object.entries(byType)
      .filter(([, stats]) => stats.successRate < 0.5 && stats.sent >= 10);

    if (lowPerformingTypes.length > 0) {
      insights.push(`🎯 Consider adjusting messaging for: ${lowPerformingTypes.map(([type]) => type).join(', ')}`);
    }

    return insights;
  }

  private loadNotificationHistory(): void {
    // In a real implementation, this would load from storage
    // For now, keep in memory
  }

  private saveNotificationHistory(): void {
    // In a real implementation, this would save to persistent storage
    // For now, just keep in memory
  }
}

// Export singleton instance
export const advancedNotificationManager = new AdvancedNotificationManager();
