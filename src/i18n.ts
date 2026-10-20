// UI strings, English (default) and Spanish. Views never hard-code user-facing text.
const en = {
  title: "Planck's constant — photoelectric effect",
  language: 'Language',
  theme: 'Theme',
  themes: { auto: 'Auto', light: 'Light', dark: 'Dark' },
  regions: {
    bench: 'Bench',
    panel: 'Panel',
    charts: 'Charts',
    table: 'Data table',
    learn: 'Learn',
  },
  placeholder: 'Coming soon.',
  lines: { yellow: 'Yellow 578 nm', green: 'Green 546 nm', blue: 'Blue 436 nm', violet: 'Violet 405 nm' },
}
type Dict = typeof en
const es: Dict = {
  title: 'Constante de Planck — efecto fotoeléctrico',
  language: 'Idioma',
  theme: 'Tema',
  themes: { auto: 'Auto', light: 'Claro', dark: 'Oscuro' },
  regions: {
    bench: 'Mesa',
    panel: 'Panel',
    charts: 'Gráficas',
    table: 'Tabla de datos',
    learn: 'Aprende',
  },
  placeholder: 'Próximamente.',
  lines: { yellow: 'Amarillo 578 nm', green: 'Verde 546 nm', blue: 'Azul 436 nm', violet: 'Violeta 405 nm' },
}

export type Lang = 'en' | 'es'
export const dictionaries: Record<Lang, Dict> = { en, es }

const KEY = 'photoelectric-lang'
export function loadLang(): Lang {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'en' || v === 'es') return v
  } catch { /* storage blocked: fall back to English */ }
  return 'en'
}
export function saveLang(lang: Lang): void {
  try { localStorage.setItem(KEY, lang) } catch { /* ignore */ }
}
export function t(lang: Lang): Dict { return dictionaries[lang] }
