import './styles/app.css'
import './styles/pedagogy.css'
import { Apparatus, type Mode } from './apparatus/index.ts'
import { loadLang, loadMode, saveLang, saveMode, t, type Lang } from './i18n.ts'
import type { View, ViewContext } from './views/view.ts'
import { mountBench } from './views/bench.ts'
import { mountPanel } from './views/panel.ts'
import { mountCharts } from './views/charts.ts'
import { mountTable } from './views/table.ts'
import { mountPedagogy } from './pedagogy/index.ts'

type Theme = 'auto' | 'light' | 'dark'
const THEME_KEY = 'photoelectric-theme'
const SVG_NS = 'http://www.w3.org/2000/svg'
const THEME_ICON: Record<Theme, Array<[string, Record<string, string>]>> = {
  auto: [['circle', { cx: '12', cy: '12', r: '8' }], ['path', { d: 'M12 4a8 8 0 0 0 0 16z', fill: 'currentColor' }]],
  light: [['circle', { cx: '12', cy: '12', r: '4' }], ['path', { d: 'M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4' }]],
  dark: [['path', { d: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z' }]],
}
function themeIcon(theme: Theme): SVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('aria-hidden', 'true')
  for (const [tag, attrs] of THEME_ICON[theme]) {
    const n = document.createElementNS(SVG_NS, tag)
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v)
    svg.append(n)
  }
  return svg
}
const THEMES: Theme[] = ['auto', 'light', 'dark']

function loadTheme(): Theme {
  try {
    const v = localStorage.getItem(THEME_KEY)
    if (v === 'light' || v === 'dark') return v
  } catch { /* ignore */ }
  return 'auto'
}
function applyTheme(theme: Theme, persist: boolean): void {
  if (theme === 'auto') document.documentElement.removeAttribute('data-theme')
  else document.documentElement.dataset.theme = theme
  if (!persist) return
  try {
    if (theme === 'auto') localStorage.removeItem(THEME_KEY)
    else localStorage.setItem(THEME_KEY, theme)
  } catch { /* ignore */ }
}

function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, parent?: Element): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  parent?.append(e)
  return e
}

function boot(root: HTMLElement): void {
  const params = new URLSearchParams(location.search)
  const override = params.get('theme') // screenshots only: not persisted
  const langParam = params.get('lang') // screenshots only: not persisted
  let lang: Lang = langParam === 'en' || langParam === 'es' ? langParam : loadLang()
  let theme: Theme = override === 'dark' || override === 'light' ? override : loadTheme()
  applyTheme(theme, !(override === 'dark' || override === 'light'))
  const modeParam = params.get('mode') // screenshots only: not persisted
  const apparatus = new Apparatus({ mode: modeParam === 'lab' || modeParam === 'explore' ? modeParam : loadMode() })
  const reduced = matchMedia('(prefers-reduced-motion: reduce)')
  const ctx: ViewContext = { apparatus, lang: () => lang, reducedMotion: () => reduced.matches }

  // ---- header (built once, relabelled in place) ----
  const header = h('header', 'topbar', root)
  const title = h('h1', '', header)
  const acts = h('div', 'tools hdr-acts', header)
  const help = h('a', 'tool', acts) as HTMLAnchorElement
  help.textContent = '?'
  const learnBtn = h('button', 'tool tool-accent', acts)
  learnBtn.type = 'button'
  learnBtn.setAttribute('aria-expanded', 'false')
  learnBtn.setAttribute('aria-controls', 'learn')
  learnBtn.dataset.tour = 'learn'

  const modeGroup = h('div', 'seg-group hdr-mode', header)
  modeGroup.setAttribute('role', 'radiogroup')
  const modeBtns = (['explore', 'lab'] as const).map((m) => {
    const b = h('button', 'tool', modeGroup)
    b.type = 'button'
    b.setAttribute('role', 'radio')
    b.addEventListener('click', () => { apparatus.setMode(m); saveMode(m) })
    b.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
      e.preventDefault()
      const next: Mode = m === 'explore' ? 'lab' : 'explore'
      apparatus.setMode(next); saveMode(next)
      modeBtns[next === 'explore' ? 0 : 1]!.focus()
    })
    return b
  })
  const modeHint = h('p', 'mode-hint', header)
  modeHint.setAttribute('aria-live', 'polite')

  const tools = h('div', 'tools hdr-tools', header)
  const langGroup = h('div', 'seg-group', tools)
  langGroup.setAttribute('role', 'group')
  const langBtns = (['en', 'es'] as const).map((l) => {
    const b = h('button', 'tool', langGroup)
    b.type = 'button'
    b.textContent = l.toUpperCase()
    b.addEventListener('click', () => { lang = l; saveLang(l); labels(); for (const v of views) v.relabel() })
    return b
  })
  const themeBtn = h('button', 'tool', tools)
  themeBtn.type = 'button'
  themeBtn.addEventListener('click', () => {
    theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]!
    applyTheme(theme, true)
    labels()
  })

  // ---- regions ----
  const grid = h('main', 'app-grid', root)
  const colL = h('div', 'col col-left', grid)
  const colR = h('div', 'col col-right', grid)
  const mk = (name: string, parent: Element, surface: boolean): HTMLElement => {
    const e = h('div', surface ? 'region' : '', parent)
    e.dataset.region = name
    e.setAttribute('role', 'region')
    return e
  }
  const benchRoot = mk('bench', colL, false)
  const chartsRoot = mk('charts', colL, true)
  const panelRoot = mk('panel', colR, false)
  const tableRoot = mk('table', colR, true)

  // ---- Learn drawer (content is mounted by the pedagogy phase into .learn-body) ----
  const scrim = h('div', 'scrim', root)
  const learn = h('aside', 'learn', root)
  learn.id = 'learn'
  learn.dataset.region = 'learn'
  learn.setAttribute('inert', '')
  const learnHead = h('div', 'learn-head', learn)
  const learnTitle = h('h2', '', learnHead)
  const learnClose = h('button', 'tool', learnHead)
  learnClose.type = 'button'
  const learnBody = h('div', 'learn-body', learn)
  const dock = h('div', 'dock', root)
  const setLearn = (open: boolean, focus = true): void => {
    root.classList.toggle('has-learn', open)
    learn.classList.toggle('is-open', open)
    scrim.classList.toggle('is-open', open)
    learnBtn.setAttribute('aria-expanded', String(open))
    if (open) learn.removeAttribute('inert')
    else learn.setAttribute('inert', '')
    if (focus) (open ? learnClose : learnBtn).focus()
  }
  learnBtn.addEventListener('click', () => setLearn(!learn.classList.contains('is-open')))
  learnClose.addEventListener('click', () => setLearn(false))
  scrim.addEventListener('click', () => setLearn(false))
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && learn.classList.contains('is-open')) setLearn(false)
  })

  // ---- labels (in place) ----
  function labels(): void {
    const s = t(lang)
    document.documentElement.lang = lang
    document.title = s.title
    title.textContent = s.title
    help.setAttribute('aria-label', s.helpLabel)
    help.title = s.help
    help.href = s.helpHref
    learnBtn.textContent = s.learn
    modeGroup.setAttribute('aria-label', s.mode)
    modeBtns[0]!.textContent = s.modes.explore
    modeBtns[1]!.textContent = s.modes.lab
    syncMode()
    langGroup.setAttribute('aria-label', s.language)
    langBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(lang === (i === 0 ? 'en' : 'es'))))
    themeBtn.replaceChildren(themeIcon(theme))
    themeBtn.setAttribute('aria-label', `${s.theme}: ${s.themes[theme]}`)
    themeBtn.title = `${s.theme}: ${s.themes[theme]}`
    learnTitle.textContent = s.learn
    learnClose.textContent = s.learnClose
    benchRoot.setAttribute('aria-label', s.regionBench)
    panelRoot.setAttribute('aria-label', s.regionPanel)
    chartsRoot.setAttribute('aria-label', s.regionCharts)
    tableRoot.setAttribute('aria-label', s.regionTable)
    pedagogy.relabel()
  }
  function syncMode(): void {
    modeBtns.forEach((b, i) => {
      const on = apparatus.mode === (i === 0 ? 'explore' : 'lab')
      b.setAttribute('aria-checked', String(on))
      b.tabIndex = on ? 0 : -1
    })
    modeHint.textContent = t(lang).modeHint[apparatus.mode]
  }
  apparatus.on('mode', syncMode)

  // ---- views and the single animation loop ----
  const views: View[] = [
    mountBench(benchRoot, ctx),
    mountPanel(panelRoot, ctx),
    mountCharts(chartsRoot, ctx),
    mountTable(tableRoot, ctx),
  ]
  const wide = matchMedia('(min-width: 1200px)')
  const pedagogy = mountPedagogy({
    ctx,
    learnBody,
    panelRoot,
    dock,
    views: () => views,
    helpHref: () => t(lang).helpHref,
    learn: {
      open: () => setLearn(true, false),
      close: () => setLearn(false, false),
      isOpen: () => learn.classList.contains('is-open'),
      docked: () => wide.matches,
    },
  })
  labels()
  // views read the language at mount time; make sure they agree with the header
  for (const v of views) v.relabel()

  let last = performance.now()
  const frame = (now: number): void => {
    if (!document.hidden) {
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000))
      apparatus.tick(dt)
      for (const v of views) v.update()
      pedagogy.update()
    }
    last = now
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)

  // URL helpers for screenshots and deep links: ?learn=1, ?task=<id>[&step=0..3], ?tour=1|0, ?setup=lamp,meter,yellow
  const setup = (params.get('setup') ?? '').split(',')
  if (setup.includes('lamp')) { apparatus.setLamp(true); apparatus.load({ lampOn: true, lampWarm_s: 70 }) }
  if (setup.includes('meter')) apparatus.setRange(3)
  for (const id of ['yellow', 'green', 'blue', 'violet'] as const) if (setup.includes(id)) apparatus.setArm(apparatus.linePosition(id))
  const taskParam = params.get('task')
  if (taskParam || params.get('learn') === '1') {
    // deep links open the drawer without the slide-in so that screenshots and tests see the final state
    learn.style.transition = 'none'
    requestAnimationFrame(() => requestAnimationFrame(() => { learn.style.transition = '' }))
  }
  if (taskParam) {
    const n = Number(params.get('step') ?? 0)
    pedagogy.openTask(taskParam, (n >= 0 && n <= 3 ? n : 0) as 0 | 1 | 2 | 3)
    setLearn(true, false)
  } else if (params.get('learn') === '1') setLearn(true, false)
  const tourParam = params.get('tour')
  if (tourParam === '1' || (tourParam !== '0' && !params.has('learn') && !taskParam)) {
    window.setTimeout(() => (tourParam === '1' ? pedagogy.startTour() : pedagogy.maybeAutoTour()), 500)
  }
}

boot(document.getElementById('app')!)
