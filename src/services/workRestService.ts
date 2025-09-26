import * as vscode from 'vscode';
import { WorkRestModel } from '../types';
import { getWorkRestModelById, getDefaultWorkRestModel } from '../constants/workRestModels';
import { getConfiguration } from '../core/configuration';
import { state } from '../models/state';
import { startRestEnforcement, stopRestEnforcement } from './screenBlockingService';

export interface WorkRestSession {
  model: WorkRestModel;
  currentCycle: number;
  isWorking: boolean;
  startTime: Date;
  endTime: Date;
  totalCycles: number;
}

let currentSession: WorkRestSession | null = null;
let sessionTimer: NodeJS.Timeout | null = null;

export function initializeWorkRestModel(): void {
  const config = getConfiguration();
  const modelId = config.workRestModel;

  if (modelId) {
    const model = getWorkRestModelById(modelId);
    if (model) {
      startWorkRestSession(model);
    }
  }
}

export function startWorkRestSession(model: WorkRestModel): void {
  // Clear any existing session
  if (sessionTimer) {
    clearTimeout(sessionTimer);
    sessionTimer = null;
  }

  currentSession = {
    model,
    currentCycle: 1,
    isWorking: true,
    startTime: new Date(),
    endTime: new Date(Date.now() + model.workDuration * 60 * 1000),
    totalCycles: model.cycles || 0
  };

  // Start the work period
  startWorkPeriod();

  vscode.window.showInformationMessage(
    `🚀 Started ${model.name} session!\nWork: ${model.workDuration}min | Rest: ${model.restDuration}min\n\n💡 Remember: You must manually confirm rest periods!`
  );
}

export function stopWorkRestSession(): void {
  if (sessionTimer) {
    clearTimeout(sessionTimer);
    sessionTimer = null;
  }

  if (currentSession) {
    vscode.window.showInformationMessage(`⏹️ Stopped ${currentSession.model.name} session.`);
    currentSession = null;
  }
}

export function getCurrentSession(): WorkRestSession | null {
  return currentSession;
}

export function getAvailableModels(): WorkRestModel[] {
  return [
    getDefaultWorkRestModel(),
    ...require('../constants/workRestModels').workRestModels.filter((m: WorkRestModel) => m.id !== getDefaultWorkRestModel().id)
  ];
}

function startWorkPeriod(): void {
  if (!currentSession) return;

  currentSession.isWorking = true;
  currentSession.startTime = new Date();
  currentSession.endTime = new Date(Date.now() + currentSession.model.workDuration * 60 * 1000);

  // Set timer for work period end
  sessionTimer = setTimeout(() => {
    onWorkPeriodEnd();
  }, currentSession.model.workDuration * 60 * 1000);

  updateStatusBar();
}

function startRestPeriod(autoStart: boolean = false): void {
  if (!currentSession) return;

  currentSession.isWorking = false;
  currentSession.startTime = new Date();

  // Check if this should be a long rest
  const isLongRest = currentSession.model.cycles &&
                     currentSession.currentCycle >= currentSession.model.cycles &&
                     currentSession.model.longRestDuration;

  const restDuration = isLongRest ? currentSession.model.longRestDuration! : currentSession.model.restDuration;
  currentSession.endTime = new Date(Date.now() + restDuration * 60 * 1000);

  // Set timer for rest period end
  sessionTimer = setTimeout(() => {
    onRestPeriodEnd();
  }, restDuration * 60 * 1000);

  // Start screen blocking/enforcement
  startRestEnforcement();

  if (autoStart) {
    // Automatically started - just show confirmation message
    vscode.window.showInformationMessage('🛋️ Rest period started! Screen will be monitored for coding activity.');
  } else {
    // Manual start - show rest notification with snooze option
    const restType = isLongRest ? 'long break' : 'short break';
    vscode.window.showInformationMessage(
      `🔔 Time for a ${restType}!\nRest for ${restDuration} minutes to recharge.\n\n⏰ 10 seconds left to rest - then blocking activates!`,
      'Start Rest Now',
      'Snooze 10 min'
    ).then(selection => {
      if (selection === 'Start Rest Now') {
        // Rest enforcement already started
        vscode.window.showInformationMessage('🛋️ Rest period started! Screen will be monitored for coding activity.');
      } else if (selection === 'Snooze 10 min') {
        // Stop enforcement and extend work period
        stopRestEnforcement();
        if (currentSession) {
          currentSession.isWorking = true;
          currentSession.endTime = new Date(Date.now() + 10 * 60 * 1000); // 10 minute extension
          sessionTimer = setTimeout(() => {
            onWorkPeriodEnd();
          }, 10 * 60 * 1000);
          vscode.window.showInformationMessage('⏰ Extended work period by 10 minutes.');
          updateStatusBar();
        }
        return;
      }
    });
  }

  updateStatusBar();
}

function onWorkPeriodEnd(): void {
  if (!currentSession) return;

  // Notify user that work period is over
  vscode.window.showInformationMessage(
    `⏰ Work period complete!\nYou've worked for ${currentSession.model.workDuration} minutes.`,
    'Take Break Now',
    'Snooze 5 min'
  ).then(selection => {
    if (selection === 'Take Break Now') {
      startRestPeriod();
    } else if (selection === 'Snooze 5 min') {
      // Extend work period by 5 minutes
      sessionTimer = setTimeout(() => {
        onWorkPeriodEnd();
      }, 5 * 60 * 1000);
    }
  });
}

function onRestPeriodEnd(): void {
  if (!currentSession) return;

  // Stop screen blocking/enforcement
  stopRestEnforcement();

  // Check if we should start a new cycle or end session
  const isLongRest = currentSession.model.cycles &&
                     currentSession.currentCycle >= currentSession.model.cycles;

  if (isLongRest && currentSession.model.longRestDuration) {
    // Long rest just ended, reset cycle counter
    currentSession.currentCycle = 1;
  } else {
    // Increment cycle counter
    currentSession.currentCycle++;
  }

  // Check if session should continue
  if (currentSession.model.cycles && currentSession.currentCycle > currentSession.model.cycles) {
    // Session complete
    vscode.window.showInformationMessage(
      `🎉 ${currentSession.model.name} session complete!\nYou've completed ${currentSession.model.cycles} cycles.`
    );
    stopWorkRestSession();
    return;
  }

  // Start next work period
  startWorkPeriod();

  vscode.window.showInformationMessage(
    `🔄 Rest complete! Screen unlocked. Starting work period ${currentSession.currentCycle}/${currentSession.model.cycles || '∞'}`
  );
}

function updateStatusBar(): void {
  if (!currentSession) return;

  const timeLeft = Math.max(0, Math.floor((currentSession.endTime.getTime() - Date.now()) / 1000 / 60));
  const phase = currentSession.isWorking ? 'Work' : 'Rest';
  const phaseEmoji = currentSession.isWorking ? '💼' : '🛋️';

  const statusText = `${phaseEmoji} ${phase}: ${timeLeft}min (${currentSession.model.name})`;

  if (state.statusBarItem) {
    state.statusBarItem.text = statusText;
    state.statusBarItem.show();
  }
}

export function switchWorkRestModel(modelId: string): void {
  const model = getWorkRestModelById(modelId);
  if (model) {
    stopWorkRestSession();
    startWorkRestSession(model);

    // Save preference
    const config = vscode.workspace.getConfiguration('breakBully');
    config.update('workRestModel', modelId, vscode.ConfigurationTarget.Global);
  }
}

export function getTimeRemaining(): { minutes: number; seconds: number; phase: string } | null {
  if (!currentSession) return null;

  const timeLeft = Math.max(0, currentSession.endTime.getTime() - Date.now());
  const minutes = Math.floor(timeLeft / (1000 * 60));
  const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

  return {
    minutes,
    seconds,
    phase: currentSession.isWorking ? 'work' : 'rest'
  };
}

export function takeManualBreak(): boolean {
  if (!currentSession || !currentSession.isWorking) {
    return false; // Not in a work period or no active session
  }

  // Clear the current work timer
  if (sessionTimer) {
    clearTimeout(sessionTimer);
    sessionTimer = null;
  }

  // Start rest period immediately (auto-start mode)
  startRestPeriod(true);
  return true;
}

export function endRestEarly(): boolean {
  if (!currentSession || currentSession.isWorking) {
    return false; // Not in a rest period or no active session
  }

  // Clear the current rest timer
  if (sessionTimer) {
    clearTimeout(sessionTimer);
    sessionTimer = null;
  }

  // Stop screen blocking/enforcement
  stopRestEnforcement();

  // Start next work period immediately
  startWorkPeriod();

  vscode.window.showInformationMessage('🔄 Rest ended early! Starting next work period.');
  return true;
}
