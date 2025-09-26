import * as vscode from 'vscode';
import {
  ActivityIntegrationLevel,
  ActivitySettings,
  ActivityType
} from './activityTypes';

export class ActivitySettingsManager {
  private static instance: ActivitySettingsManager;
  private settings: ActivitySettings;

  private constructor() {
    this.settings = this.loadSettings();
  }

  static getInstance(): ActivitySettingsManager {
    if (!ActivitySettingsManager.instance) {
      ActivitySettingsManager.instance = new ActivitySettingsManager();
    }
    return ActivitySettingsManager.instance;
  }

  getSettings(): ActivitySettings {
    return { ...this.settings };
  }

  updateSettings(newSettings: Partial<ActivitySettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    this.saveSettings();
    this.notifySettingsChanged();
  }

  getIntegrationLevel(): ActivityIntegrationLevel {
    return this.settings.integrationLevel;
  }

  setIntegrationLevel(level: ActivityIntegrationLevel): void {
    this.settings.integrationLevel = level;
    this.saveSettings();
    this.notifySettingsChanged();
  }

  isEnabled(): boolean {
    return this.settings.integrationLevel !== ActivityIntegrationLevel.NONE;
  }

  isBasicEnabled(): boolean {
    return this.settings.integrationLevel === ActivityIntegrationLevel.BASIC ||
           this.settings.integrationLevel === ActivityIntegrationLevel.SMART ||
           this.settings.integrationLevel === ActivityIntegrationLevel.ADVANCED;
  }

  isSmartEnabled(): boolean {
    return this.settings.integrationLevel === ActivityIntegrationLevel.SMART ||
           this.settings.integrationLevel === ActivityIntegrationLevel.ADVANCED;
  }

  isAdvancedEnabled(): boolean {
    return this.settings.integrationLevel === ActivityIntegrationLevel.ADVANCED;
  }

  private loadSettings(): ActivitySettings {
    const config = vscode.workspace.getConfiguration('breakBully');

    return {
      integrationLevel: config.get('activityIntegrationLevel', ActivityIntegrationLevel.NONE),
      flowThreshold: config.get('activityFlowThreshold', 7),
      activityWeights: {
        [ActivityType.FILE_EDIT]: config.get('activityWeightFileEdit', 2),
        [ActivityType.FILE_SAVE]: config.get('activityWeightFileSave', 3),
        [ActivityType.FILE_OPEN]: config.get('activityWeightFileOpen', 1),
        [ActivityType.GIT_COMMIT]: config.get('activityWeightGitCommit', 5),
        [ActivityType.TYPING_BURST]: config.get('activityWeightTypingBurst', 1),
        [ActivityType.DEBUG_SESSION]: config.get('activityWeightDebugSession', 4),
        [ActivityType.TEST_RUN]: config.get('activityWeightTestRun', 3),
        [ActivityType.SEARCH_OPERATION]: config.get('activityWeightSearchOperation', 1),
        [ActivityType.REFACTOR_OPERATION]: config.get('activityWeightRefactorOperation', 4),
        [ActivityType.BREAK_TAKEN]: config.get('activityWeightBreakTaken', 1)
      },
      smartTiming: {
        maxExtension: config.get('activityMaxExtension', 15),
        minBreakDelay: config.get('activityMinBreakDelay', 5),
        flowProtection: config.get('activityFlowProtection', true)
      },
      privacy: {
        storeHistory: config.get('activityStoreHistory', true),
        shareAnalytics: config.get('activityShareAnalytics', false),
        retentionDays: config.get('activityRetentionDays', 30)
      },
      notifications: {
        flowStateAlerts: config.get('activityFlowStateAlerts', true),
        productivityTips: config.get('activityProductivityTips', true),
        breakSuggestions: config.get('activityBreakSuggestions', true)
      }
    };
  }

  private saveSettings(): void {
    const config = vscode.workspace.getConfiguration('breakBully');

    // Save integration level
    config.update('activityIntegrationLevel', this.settings.integrationLevel, vscode.ConfigurationTarget.Global);

    // Save flow threshold
    config.update('activityFlowThreshold', this.settings.flowThreshold, vscode.ConfigurationTarget.Global);

    // Save activity weights
    Object.entries(this.settings.activityWeights).forEach(([activityType, weight]) => {
      const configKey = `activityWeight${activityType.charAt(0).toUpperCase() + activityType.slice(1)}`;
      config.update(configKey, weight, vscode.ConfigurationTarget.Global);
    });

    // Save smart timing settings
    config.update('activityMaxExtension', this.settings.smartTiming.maxExtension, vscode.ConfigurationTarget.Global);
    config.update('activityMinBreakDelay', this.settings.smartTiming.minBreakDelay, vscode.ConfigurationTarget.Global);
    config.update('activityFlowProtection', this.settings.smartTiming.flowProtection, vscode.ConfigurationTarget.Global);

    // Save privacy settings
    config.update('activityStoreHistory', this.settings.privacy.storeHistory, vscode.ConfigurationTarget.Global);
    config.update('activityShareAnalytics', this.settings.privacy.shareAnalytics, vscode.ConfigurationTarget.Global);
    config.update('activityRetentionDays', this.settings.privacy.retentionDays, vscode.ConfigurationTarget.Global);

    // Save notification settings
    config.update('activityFlowStateAlerts', this.settings.notifications.flowStateAlerts, vscode.ConfigurationTarget.Global);
    config.update('activityProductivityTips', this.settings.notifications.productivityTips, vscode.ConfigurationTarget.Global);
    config.update('activityBreakSuggestions', this.settings.notifications.breakSuggestions, vscode.ConfigurationTarget.Global);
  }

  private notifySettingsChanged(): void {
    // Emit event for other components to react to settings changes
    vscode.commands.executeCommand('breakBully.activitySettingsChanged', this.settings);
  }

  // Default settings for reset functionality
  getDefaultSettings(): ActivitySettings {
    return {
      integrationLevel: ActivityIntegrationLevel.NONE,
      flowThreshold: 7,
      activityWeights: {
        [ActivityType.FILE_EDIT]: 2,
        [ActivityType.FILE_SAVE]: 3,
        [ActivityType.FILE_OPEN]: 1,
        [ActivityType.GIT_COMMIT]: 5,
        [ActivityType.TYPING_BURST]: 1,
        [ActivityType.DEBUG_SESSION]: 4,
        [ActivityType.TEST_RUN]: 3,
        [ActivityType.SEARCH_OPERATION]: 1,
        [ActivityType.REFACTOR_OPERATION]: 4,
        [ActivityType.BREAK_TAKEN]: 1
      },
      smartTiming: {
        maxExtension: 15,
        minBreakDelay: 5,
        flowProtection: true
      },
      privacy: {
        storeHistory: true,
        shareAnalytics: false,
        retentionDays: 30
      },
      notifications: {
        flowStateAlerts: true,
        productivityTips: true,
        breakSuggestions: true
      }
    };
  }

  resetToDefaults(): void {
    this.settings = this.getDefaultSettings();
    this.saveSettings();
    this.notifySettingsChanged();
  }
}

// Export singleton instance
export const activitySettings = ActivitySettingsManager.getInstance();
