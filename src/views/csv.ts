// Pure CSV export of the measurement table. No DOM.
import type { Measurement } from '../apparatus/index.ts'
import type { Lang } from '../i18n.ts'

const HEADERS: Record<Lang, string[]> = {
  en: ['line', 'lambda (nm)', 'nu (THz)', 'U0 (V)', 'wait (s)', 'settled'],
  es: ['línea', 'lambda (nm)', 'nu (THz)', 'U0 (V)', 'espera (s)', 'estable'],
}
const LINE_NAMES: Record<Lang, Record<string, string>> = {
  en: { yellow: 'yellow', green: 'green', blue: 'blue', violet: 'violet', uv: 'UV' },
  es: { yellow: 'amarillo', green: 'verde', blue: 'azul', violet: 'violeta', uv: 'UV' },
}
const YES_NO: Record<Lang, [string, string]> = { en: ['yes', 'no'], es: ['sí', 'no'] }
const NO_LINE: Record<Lang, string> = { en: 'none', es: 'ninguna' }

/** en: "," separator and "." decimals. es: ";" separator and "," decimals. */
export function toCSV(measurements: readonly Measurement[], lang: Lang): string {
  const sep = lang === 'es' ? ';' : ','
  const num = (x: number, d: number): string => {
    const s = x.toFixed(d)
    return lang === 'es' ? s.replace('.', ',') : s
  }
  const rows: string[][] = [HEADERS[lang]]
  for (const m of measurements) {
    rows.push([
      m.lineId ? (LINE_NAMES[lang][m.lineId] ?? m.lineId) : NO_LINE[lang],
      m.lambda_nm === null ? '' : num(m.lambda_nm, 1),
      m.nu_Hz === null ? '' : num(m.nu_Hz / 1e12, 1),
      num(m.U0_V, 3),
      num(m.t_wait_s, 1),
      m.settled ? YES_NO[lang][0] : YES_NO[lang][1],
    ])
  }
  return rows.map((r) => r.join(sep)).join('\n') + '\n'
}

/** Trigger a browser download (UTF-8 BOM so spreadsheets read accents correctly). */
export function downloadCSV(text: string, filename = 'photoelectric-data.csv'): void {
  const blob = new Blob(['﻿', text], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
