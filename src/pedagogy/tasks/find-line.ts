import type { GuidedTask } from '../task.ts'

export const task: GuidedTask = {
  id: 'find-line',
  mode: 'explore',
  level: 1,
  controls: ['lamp', 'arm'],
  initial: {},
  predict: { kind: 'choice', answer: 3 }, // options: yellow, green, blue, violet
  success: (a) => a.lampOn && a.lineOnCell() === 'yellow',
  hints: [
    { when: (a) => !a.lampOn, key: 'lampOff' },
    { when: (a) => a.lampOn && a.lineOnCell() === null, key: 'moveArm' },
    { when: (a) => a.lampOn && a.lineOnCell() !== null, key: 'otherLine' },
  ],
}
