import { describe, expect, it } from 'vitest'
import { toCSV } from '../src/views/csv.ts'
import { strings as chartStrings } from '../src/views/strings/charts.ts'
import { strings as tableStrings } from '../src/views/strings/table.ts'
import type { Measurement } from '../src/apparatus/index.ts'

const keys = (o: object, p = ''): string[] =>
  Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? keys(v, `${p}${k}.`) : [`${p}${k}`])).sort()

describe('string parity', () => {
  it.each([['charts', chartStrings], ['table', tableStrings]])('%s en/es keys match', (_n, s) => {
    expect(keys(s.es)).toEqual(keys(s.en))
    for (const k of Object.keys(s.en) as (keyof typeof s.en)[]) expect(typeof s.es[k]).toBe(typeof s.en[k])
  })
})

const ms: Measurement[] = [
  { lineId: 'blue', lambda_nm: 435.8, nu_Hz: 6.88e14, U0_V: 1.2346, sigma_V: 0.02, sigmaSys_V: 0.075, t_wait_s: 62.04, settled: true, beamIntensity: 1, dirty: false, stray: false, dischargedSinceAlign: true },
  { lineId: null, lambda_nm: null, nu_Hz: null, U0_V: 0.5, sigma_V: 0.02, sigmaSys_V: 0.075, t_wait_s: 10, settled: false, beamIntensity: 1, dirty: false, stray: false, dischargedSinceAlign: true },
]

describe('toCSV', () => {
  it('en: header, comma separator, decimal point', () => {
    const lines = toCSV(ms, 'en').trim().split('\n')
    expect(lines).toHaveLength(3)
    expect(lines[0]).toBe('line,lambda (nm),nu (THz),U0 (V),u (V),wait (s),settled')
    expect(lines[1]).toBe('blue,435.8,688.0,1.235,0.020,62.0,yes')
    expect(lines[2]).toBe('none,,,0.500,0.020,10.0,no')
  })
  it('es: semicolon separator, decimal comma', () => {
    const lines = toCSV(ms, 'es').trim().split('\n')
    expect(lines[0]!.split(';')).toHaveLength(7)
    expect(lines[0]).toContain('incert. u (V)')
    expect(lines[1]).toBe('azul;435,8;688,0;1,235;0,020;62,0;sí')
  })
  it('empty list gives header only', () => {
    expect(toCSV([], 'en').trim().split('\n')).toHaveLength(1)
  })
})
