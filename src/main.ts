import './styles/app.css'
import { loadLang, saveLang, t, type Lang } from './i18n'

type Theme = 'auto' | 'light' | 'dark'
const THEME_KEY = 'photoelectric-theme'

function loadTheme(): Theme {
  try {
    const v = localStorage.getItem(THEME_KEY)
    if (v === 'light' || v === 'dark') return v
  } catch { /* ignore */ }
  return 'auto'
}
function applyTheme(theme: Theme): void {
  if (theme === 'auto') document.documentElement.removeAttribute('data-theme')
  else document.documentElement.dataset.theme = theme
  try {
    if (theme === 'auto') localStorage.removeItem(THEME_KEY)
    else localStorage.setItem(THEME_KEY, theme)
  } catch { /* ignore */ }
}

let lang: Lang = loadLang()
let theme: Theme = loadTheme()
const REGIONS = ['bench', 'panel', 'charts', 'table', 'learn'] as const

function render(root: HTMLElement): void {
  const s = t(lang)
  document.documentElement.lang = lang
  document.title = s.title
  root.replaceChildren()

  const header = document.createElement('header')
  header.className = 'topbar'
  const h1 = document.createElement('h1')
  h1.textContent = s.title
  const tools = document.createElement('div')
  tools.className = 'tools'

  const langGroup = document.createElement('div')
  langGroup.setAttribute('role', 'group')
  langGroup.setAttribute('aria-label', s.language)
  langGroup.className = 'tools'
  for (const l of ['en', 'es'] as const) {
    const b = document.createElement('button')
    b.className = 'tool'
    b.textContent = l.toUpperCase()
    b.setAttribute('aria-pressed', String(lang === l))
    b.addEventListener('click', () => { lang = l; saveLang(l); render(root) })
    langGroup.append(b)
  }

  const themeBtn = document.createElement('button')
  themeBtn.className = 'tool'
  themeBtn.textContent = s.themes[theme]
  themeBtn.setAttribute('aria-label', `${s.theme}: ${s.themes[theme]}`)
  themeBtn.addEventListener('click', () => {
    theme = theme === 'auto' ? 'light' : theme === 'light' ? 'dark' : 'auto'
    applyTheme(theme)
    render(root)
  })
  tools.append(langGroup, themeBtn)
  header.append(h1, tools)

  const main = document.createElement('main')
  for (const r of REGIONS) {
    const sec = document.createElement('section')
    sec.className = 'region'
    sec.dataset.region = r
    const h2 = document.createElement('h2')
    h2.textContent = s.regions[r]
    const p = document.createElement('p')
    p.textContent = s.placeholder
    sec.append(h2, p)
    main.append(sec)
  }
  root.append(header, main)
}

applyTheme(theme)
render(document.getElementById('app')!)
