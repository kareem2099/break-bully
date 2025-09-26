import { WorkRestModel } from '../types';

export const workRestModels: WorkRestModel[] = [
  {
    id: 'pomodoro-classic',
    name: 'Classic Pomodoro',
    description: '25 minutes work, 5 minutes rest. Based on Francesco Cirillo\'s Pomodoro Technique.',
    workDuration: 25,
    restDuration: 5,
    cycles: 4,
    longRestDuration: 15,
    basedOn: 'pomodoro'
  },
  {
    id: 'who-1hour-work-30min-rest',
    name: 'WHO Recommended: 1 Hour Work, 30 Min Rest',
    description: 'Based on WHO guidelines for computer work. 1 hour of focused work followed by 30 minutes of rest to prevent musculoskeletal disorders.',
    workDuration: 60,
    restDuration: 30,
    basedOn: 'who'
  },
  {
    id: 'who-2hour-work-1hour-rest',
    name: 'WHO Recommended: 2 Hours Work, 1 Hour Rest',
    description: 'WHO guidelines for prolonged computer work. 2 hours of work with 1 hour rest periods to maintain optimal health and productivity.',
    workDuration: 120,
    restDuration: 60,
    basedOn: 'who'
  },
  {
    id: 'who-45min-work-15min-rest',
    name: 'WHO Recommended: 45 Min Work, 15 Min Rest',
    description: 'WHO guidelines for intensive computer tasks. 45 minutes work with 15 minutes rest to prevent eye strain and mental fatigue.',
    workDuration: 45,
    restDuration: 15,
    basedOn: 'who'
  },
  {
    id: 'who-90min-work-30min-rest',
    name: 'WHO Recommended: 90 Min Work, 30 Min Rest',
    description: 'WHO guidelines for creative and analytical work. 90 minutes work followed by 30 minutes rest to optimize cognitive performance.',
    workDuration: 90,
    restDuration: 30,
    basedOn: 'who'
  },
  {
    id: 'custom-flexible',
    name: 'Custom Flexible',
    description: 'Customize your own work-rest intervals based on your preferences and work requirements.',
    workDuration: 50,
    restDuration: 10,
    basedOn: 'custom'
  }
];

export function getWorkRestModelById(id: string): WorkRestModel | undefined {
  return workRestModels.find(model => model.id === id);
}

export function getDefaultWorkRestModel(): WorkRestModel {
  return workRestModels.find(model => model.id === 'who-45min-work-15min-rest') || workRestModels[0];
}
