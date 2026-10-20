// UI strings, English (default) and Spanish. Views never hard-code user-facing text.
const en = {
  title: "Planck's constant — photoelectric effect",
  language: 'Language',
  theme: 'Theme',
  themes: { auto: 'Auto', light: 'Light', dark: 'Dark' },
  mode: 'Mode',
  modes: { explore: 'Explore', lab: 'Lab' },
  modeHint: {
    explore: 'Ideal instrument: you can see the true voltage and change the hidden physics.',
    lab: 'Realistic instrument: noise, stray light and a meter you must read yourself.',
  },
  learn: 'Learn',
  learnClose: 'Close',
  learnEmpty: 'Guided tasks and explanations will appear here.',
  help: 'Help',
  helpLabel: 'Open the theory sheet',
  helpHref: 'help/index.html',
  regionBench: 'Bench',
  regionPanel: 'Instrument panel',
  regionCharts: 'Charts',
  regionTable: 'Data table',
  lines: { yellow: 'Yellow 578 nm', green: 'Green 546 nm', blue: 'Blue 436 nm', violet: 'Violet 405 nm' },
}
type Dict = typeof en
const es: Dict = {
  title: 'Constante de Planck — efecto fotoeléctrico',
  language: 'Idioma',
  theme: 'Tema',
  themes: { auto: 'Auto', light: 'Claro', dark: 'Oscuro' },
  mode: 'Modo',
  modes: { explore: 'Explorar', lab: 'Laboratorio' },
  modeHint: {
    explore: 'Instrumento ideal: ves la tensión real y puedes cambiar la física oculta.',
    lab: 'Instrumento realista: ruido, luz parásita y un medidor que debes leer tú.',
  },
  learn: 'Aprende',
  learnClose: 'Cerrar',
  learnEmpty: 'Aquí aparecerán las tareas guiadas y las explicaciones.',
  help: 'Ayuda',
  helpLabel: 'Abrir la hoja de teoría',
  helpHref: 'help/es.html',
  regionBench: 'Mesa',
  regionPanel: 'Panel de instrumentos',
  regionCharts: 'Gráficas',
  regionTable: 'Tabla de datos',
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

const MODE_KEY = 'photoelectric-mode'
export function loadMode(): 'explore' | 'lab' {
  try {
    const v = localStorage.getItem(MODE_KEY)
    if (v === 'explore' || v === 'lab') return v
  } catch { /* ignore */ }
  return 'explore'
}
export function saveMode(m: 'explore' | 'lab'): void {
  try { localStorage.setItem(MODE_KEY, m) } catch { /* ignore */ }
}
