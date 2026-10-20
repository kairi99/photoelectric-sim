import type { Lang } from '../i18n.ts'
import { en } from './i18n/en.ts'
import { es } from './i18n/es.ts'
import type { PedagogyDict } from './i18n/en.ts'

export type { PedagogyDict }
export const pedagogyStrings: Record<Lang, PedagogyDict> = { en, es }
export const pt = (lang: Lang): PedagogyDict => pedagogyStrings[lang]
export const fmt = (s: string, vars: Record<string, string | number>): string =>
  s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''))
