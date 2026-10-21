import type { GuidedTask } from '../task.ts'
import { task as findLine } from './find-line.ts'
import { task as firstU0 } from './first-u0.ts'
import { task as intensity } from './intensity.ts'
import { task as repeatSpread } from './repeat-spread.ts'
import { task as planck } from './planck.ts'
import { task as threshold } from './threshold.ts'
import { task as errorSources } from './error-sources.ts'

export const TASKS: GuidedTask[] = [findLine, firstU0, repeatSpread, intensity, planck, threshold, errorSources]
