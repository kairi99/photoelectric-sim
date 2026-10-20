// Charts view: live U(t) trace and the U0-vs-nu fit chart with its result card.
// Renders Apparatus state. The only model numbers shown (ideal U0, ideal line) come from src/physics.
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import { H_Js, limitVoltage_V, nuFromLambda, HG_LINES } from '../physics/index.ts'
import type { HgLineId } from '../physics/index.ts'
import type { Measurement } from '../apparatus/index.ts'
import type { MountView, View } from './view.ts'
import { strings } from './strings/charts.ts'
import '../styles/charts.css'

/** A guided task sets <html data-hide-answers> while the student predicts and acts: the ideal overlays would give the answer away. */
const answersHidden = (): boolean => document.documentElement.hasAttribute('data-hide-answers')

const THROTTLE_ms = 100
const NU_MIN_THz = 450
const NU_MAX_THz = 850
const LINE_VAR: Record<string, string> = {
  yellow: '--phys-yellow', green: '--phys-green', blue: '--phys-blue', violet: '--phys-violet', uv: '--label-2',
}

interface Theme {
  font: string
  label: string
  label2: string
  grid: string
  surface: string
  accent: string
  line: Record<string, string>
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (text !== undefined) e.textContent = text
  return e
}

/** Straight line through two samples of a (linear above threshold) model function, as {a: slope, b: intercept}. */
function sampleLine(f: (nu_THz: number) => number, x1: number, x2: number): { a: number; b: number } {
  const y1 = f(x1)
  const y2 = f(x2)
  const a = (y2 - y1) / (x2 - x1)
  return { a, b: y1 - a * x1 }
}

export const mountCharts: MountView = (root, ctx): View => {
  const app = ctx.apparatus
  const S = () => strings[ctx.lang()]
  const nf = (x: number, d: number): string => {
    const s = x.toFixed(d)
    return ctx.lang() === 'es' ? s.replace('.', ',') : s
  }

  const wrap = el('section', 'ch')
  const probe = el('span', 'ch-probe')
  probe.setAttribute('aria-hidden', 'true')
  wrap.append(probe)
  root.append(wrap) // attach early: theme colours are resolved through computed style

  // ---- theme ---------------------------------------------------------------
  const resolve = (v: string): string => {
    probe.style.color = `var(${v})`
    return getComputedStyle(probe).color
  }
  const readTheme = (): Theme => {
    const line: Record<string, string> = {}
    for (const k of Object.keys(LINE_VAR)) line[k] = resolve(LINE_VAR[k]!)
    const cs = getComputedStyle(probe)
    return {
      font: `12px ${cs.fontFamily}`,
      label: resolve('--label'),
      label2: resolve('--label-2'),
      grid: resolve('--separator'),
      surface: resolve('--surface'),
      accent: resolve('--accent'),
      line,
    }
  }
  let theme = readTheme()

  // ---- layout --------------------------------------------------------------
  const livePanel = el('div', 'ch-panel')
  const liveH = el('h2', 'ch-title')
  const liveHost = el('div', 'ch-host')
  liveHost.setAttribute('role', 'img')
  const liveEmpty = el('p', 'ch-overlay ch-empty')
  const settledBadge = el('span', 'ch-badge')
  settledBadge.hidden = true
  const liveBox = el('div', 'ch-box')
  liveBox.append(liveHost, liveEmpty, settledBadge)
  livePanel.append(liveH, liveBox)

  const fitPanel = el('div', 'ch-panel')
  const fitH = el('h2', 'ch-title')
  const idealLabel = el('label', 'ch-toggle')
  const idealCheck = el('input')
  idealCheck.type = 'checkbox'
  const idealText = el('span')
  idealLabel.append(idealCheck, idealText)
  const fitHead = el('div', 'ch-head')
  fitHead.append(fitH, idealLabel)
  const fitHost = el('div', 'ch-host')
  fitHost.setAttribute('role', 'img')
  const fitEmpty = el('p', 'ch-overlay ch-empty')
  const fitBox = el('div', 'ch-box')
  fitBox.append(fitHost, fitEmpty)

  const card = el('div', 'ch-card')
  const cardHead = el('div', 'ch-card-head')
  const cardTitle = el('h3', 'ch-card-title')
  const infoBtn = el('button', 'ch-info')
  infoBtn.type = 'button'
  infoBtn.setAttribute('aria-expanded', 'false')
  const infoI = el('span', 'ch-i', 'i')
  infoI.setAttribute('aria-hidden', 'true')
  infoBtn.append(infoI)
  cardHead.append(cardTitle, infoBtn)
  const rule = el('p', 'ch-rule')
  const info = el('p', 'ch-infotext')
  info.hidden = true
  info.id = `ch-info-${Math.random().toString(36).slice(2, 8)}`
  infoBtn.setAttribute('aria-controls', info.id)
  const dl = el('dl', 'ch-dl')
  const noFit = el('p', 'ch-nofit')
  card.append(cardHead, rule, info, dl, noFit)
  fitPanel.append(fitHead, fitBox, card)

  wrap.append(livePanel, fitPanel)

  // ---- state ---------------------------------------------------------------
  let showIdeal = false
  let histLen = -1
  let histLastT = -1
  let alignedLine: HgLineId | null = null
  let settled = false
  let fitSig = ''
  let lastRun = 0
  let liveIdealU0: number | null = null
  let fitState: {
    pts: { nu: number; U: number; lineId: HgLineId | null; lambda: number | null }[]
    fit: { a: number; b: number; nu0: number | null } | null
    ideal: { a: number; b: number } | null
    xmin: number
    ymax: number
  } = { pts: [], fit: null, ideal: null, xmin: NU_MIN_THz, ymax: 1.6 }

  // ---- chart 1: live U(t) --------------------------------------------------
  const axisCommon = () => ({
    stroke: () => theme.label2,
    grid: { stroke: theme.grid, width: 1 },
    ticks: { stroke: theme.grid, width: 1 },
    font: theme.font,
    labelFont: theme.font,
  })
  const liveData: [number[], number[]] = [[], []]
  const live = new uPlot(
    {
      width: 300,
      height: 240,
      legend: { show: false },
      cursor: { show: false },
      select: { show: false, left: 0, top: 0, width: 0, height: 0 },
      padding: [8, 12, 0, 0],
      scales: {
        x: { time: false, range: (_u, _min, max) => [0, Math.max(10, max)] },
        y: {
          range: (_u, _min, max) => [0, Math.max(1, (liveIdealU0 ?? 0) * 1.15, max * 1.15)],
        },
      },
      axes: [
        { ...axisCommon(), label: '', labelSize: 18, size: 36, grid: { show: true, stroke: () => theme.grid, width: 1 } },
        { ...axisCommon(), label: '', labelSize: 18, size: 44, grid: { show: true, stroke: () => theme.grid, width: 1 } },
      ],
      series: [
        {},
        { stroke: () => (alignedLine ? theme.line[alignedLine]! : theme.label2), width: 2, points: { show: false } },
      ],
      hooks: {
        draw: [
          (u) => {
            if (liveIdealU0 === null) return
            const c = u.ctx
            const y = u.valToPos(liveIdealU0, 'y', true)
            const { left, width, top, height } = u.bbox
            if (y < top || y > top + height) return
            const r = devicePixelRatio
            c.save()
            c.strokeStyle = theme.label
            c.lineWidth = 1.5 * r
            c.setLineDash([6 * r, 4 * r])
            c.beginPath()
            c.moveTo(left, y)
            c.lineTo(left + width, y)
            c.stroke()
            c.setLineDash([])
            c.fillStyle = theme.label
            c.font = theme.font.replace('12px', `${12 * r}px`)
            c.textAlign = 'right'
            c.textBaseline = 'bottom'
            c.fillText(`${S().idealU0} = ${nf(liveIdealU0, 2)} V`, left + width - 4 * r, y - 3 * r)
            c.restore()
          },
        ],
      },
    },
    liveData,
    liveHost,
  )

  // ---- chart 2: U0 vs nu ---------------------------------------------------
  const fit = new uPlot(
    {
      width: 300,
      height: 280,
      legend: { show: false },
      cursor: { show: false },
      select: { show: false, left: 0, top: 0, width: 0, height: 0 },
      padding: [12, 16, 0, 0],
      scales: {
        x: { time: false, range: () => [fitState.xmin, NU_MAX_THz] },
        y: { range: () => [-0.06 * fitState.ymax, fitState.ymax] },
      },
      axes: [
        { ...axisCommon(), size: 36, incrs: [50, 100, 200], label: '', labelSize: 18 },
        { ...axisCommon(), size: 44, label: '', labelSize: 18 },
      ],
      series: [{}, { paths: () => null, points: { show: false } }],
      hooks: { draw: [drawFit] },
    },
    [[NU_MIN_THz, NU_MAX_THz], [null, null]] as unknown as uPlot.AlignedData,
    fitHost,
  )

  function drawFit(u: uPlot): void {
    const c = u.ctx
    const r = devicePixelRatio
    const { left, top, width, height } = u.bbox
    const X = (v: number): number => u.valToPos(v, 'x', true)
    const Y = (v: number): number => u.valToPos(v, 'y', true)
    const fontPx = (px: number): string => theme.font.replace('12px', `${px * r}px`)
    c.save()
    c.beginPath()
    c.rect(left, top - 12 * r, width + 16 * r, height + 12 * r)
    c.clip()
    // zero axis
    c.strokeStyle = theme.label2
    c.lineWidth = 1 * r
    c.beginPath()
    c.moveTo(left, Y(0))
    c.lineTo(left + width, Y(0))
    c.stroke()

    const segment = (a: number, b: number, x1: number, x2: number, dash: number[], color: string, w: number): void => {
      c.strokeStyle = color
      c.lineWidth = w * r
      c.setLineDash(dash.map((d) => d * r))
      c.beginPath()
      c.moveTo(X(x1), Y(a * x1 + b))
      c.lineTo(X(x2), Y(a * x2 + b))
      c.stroke()
    }
    const xlo = fitState.xmin
    if (fitState.ideal) {
      const { a, b } = fitState.ideal
      const start = a > 0 ? Math.max(xlo, -b / a) : xlo
      segment(a, b, start, NU_MAX_THz, [3, 4], theme.label2, 1.5)
    }
    if (fitState.fit) {
      const { a, b, nu0 } = fitState.fit
      const nus = fitState.pts.map((p) => p.nu)
      const dmin = Math.min(...nus)
      const dmax = Math.max(...nus)
      const start = nu0 !== null ? Math.max(xlo, nu0) : xlo
      // extrapolation (dashed) down to U0 = 0 and out to the right edge, measured range solid
      if (start < dmin) segment(a, b, start, dmin, [6, 4], theme.accent, 2)
      segment(a, b, dmin, dmax, [], theme.accent, 2.5)
      if (dmax < NU_MAX_THz) segment(a, b, dmax, NU_MAX_THz, [6, 4], theme.accent, 2)
      if (nu0 !== null && nu0 >= xlo) {
        c.setLineDash([])
        c.fillStyle = theme.surface
        c.strokeStyle = theme.accent
        c.lineWidth = 2 * r
        c.beginPath()
        c.arc(X(nu0), Y(0), 5 * r, 0, Math.PI * 2)
        c.fill()
        c.stroke()
        c.fillStyle = theme.label
        c.font = fontPx(12)
        c.textAlign = 'left'
        c.textBaseline = 'bottom'
        c.fillText(`${nf(nu0, 0)} THz`, X(nu0) + 8 * r, Y(0) - 8 * r)
      }
    }
    // points with wavelength labels
    c.setLineDash([])
    c.font = fontPx(12)
    c.textAlign = 'right'
    c.textBaseline = 'bottom'
    for (const p of fitState.pts) {
      const x = X(p.nu)
      const y = Y(p.U)
      c.fillStyle = p.lineId ? theme.line[p.lineId]! : theme.label2
      c.strokeStyle = theme.surface
      c.lineWidth = 2 * r
      c.beginPath()
      c.arc(x, y, 6 * r, 0, Math.PI * 2)
      c.fill()
      c.stroke()
      if (p.lambda !== null) {
        c.fillStyle = theme.label
        c.fillText(`${nf(p.lambda, 0)} nm`, x - 8 * r, y - 6 * r)
      }
    }
    c.restore()
  }

  // ---- sizing --------------------------------------------------------------
  const ro = new ResizeObserver(() => {
    const w1 = liveHost.clientWidth
    const h1 = liveHost.clientHeight
    if (w1 > 0 && h1 > 0) live.setSize({ width: w1, height: h1 })
    const w2 = fitHost.clientWidth
    const h2 = fitHost.clientHeight
    if (w2 > 0 && h2 > 0) fit.setSize({ width: w2, height: h2 })
  })
  ro.observe(liveHost)
  ro.observe(fitHost)

  // ---- theme observers -----------------------------------------------------
  const retheme = (): void => {
    theme = readTheme()
    live.redraw(false)
    fit.redraw(false)
  }
  const mo = new MutationObserver(retheme)
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] })
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  mq.addEventListener('change', retheme)

  // ---- controls ------------------------------------------------------------
  idealCheck.addEventListener('change', () => { showIdeal = idealCheck.checked; refreshFit(true) })
  infoBtn.addEventListener('click', () => {
    info.hidden = !info.hidden
    infoBtn.setAttribute('aria-expanded', String(!info.hidden))
  })

  // ---- text ----------------------------------------------------------------
  const setAxisLabels = (): void => {
    const s = S()
    live.axes[0]!.label = s.xTime
    live.axes[1]!.label = s.yVoltage
    fit.axes[0]!.label = s.xFreq
    fit.axes[1]!.label = s.yU0
    live.redraw(false)
    fit.redraw(false)
  }
  const relabel = (): void => {
    const s = S()
    liveH.textContent = s.liveTitle
    liveEmpty.textContent = s.liveEmpty
    settledBadge.textContent = `✓ ${s.settled}`
    fitH.textContent = s.fitTitle
    idealText.textContent = s.showIdeal
    fitEmpty.textContent = s.fitEmpty
    cardTitle.textContent = s.resultTitle
    rule.textContent = s.rule
    info.textContent = s.infoText
    infoBtn.setAttribute('aria-label', s.infoLabel)
    noFit.textContent = s.noFit
    setAxisLabels()
    histLen = -1
    fitSig = ''
    refreshLive(true)
    refreshFit(true)
  }

  // ---- refresh -------------------------------------------------------------
  const refreshLive = (force: boolean): void => {
    const ro_ = app.readout()
    const hist = app.getHistory()
    const last = hist.length ? hist[hist.length - 1]!.t_s : -1
    const line = ro_.lineOnCell
    const idealU0 =
      app.mode === 'explore' && !answersHidden() && line
        ? limitVoltage_V(nuFromLambda(HG_LINES.find((l) => l.id === line)!.lambda_nm))
        : null
    const changed = force || hist.length !== histLen || last !== histLastT || line !== alignedLine || idealU0 !== liveIdealU0
    if (ro_.settled !== settled || force) {
      settled = ro_.settled
      settledBadge.hidden = !settled
    }
    if (!changed) return
    histLen = hist.length
    histLastT = last
    alignedLine = line
    liveIdealU0 = idealU0
    liveData[0] = hist.map((p) => p.t_s)
    liveData[1] = hist.map((p) => p.U_V)
    live.setData(liveData)
    liveEmpty.hidden = hist.length > 0
    const latest = hist.length ? `${nf(hist[hist.length - 1]!.U_V, 2)} V` : '–'
    liveHost.setAttribute('aria-label', `${S().liveAria(hist.length, latest)}${settled ? ` ${S().settled}.` : ''}`)
  }

  const idealModel = (): { a: number; b: number } => sampleLine((nu) => limitVoltage_V(nu * 1e12), 700, 800)

  const refreshFit = (force: boolean): void => {
    idealLabel.hidden = app.mode !== 'explore' || answersHidden()
    const ms: Measurement[] = app.measurements
    const sig = `${app.mode}|${showIdeal}|${answersHidden()}|${ctx.lang()}|` + ms.map((m) => `${m.lineId}:${m.U0_V}`).join(';')
    if (!force && sig === fitSig) return
    fitSig = sig
    const s = S()
    const f = app.fitResult()
    const pts = ms
      .filter((m) => m.nu_Hz !== null)
      .map((m) => ({ nu: m.nu_Hz! / 1e12, U: m.U0_V, lineId: m.lineId, lambda: m.lambda_nm }))
    let fitLine: { a: number; b: number; nu0: number | null } | null = null
    if (f) {
      const a = f.slope_VperHz * 1e12
      const b = f.intercept_V
      fitLine = { a, b, nu0: a > 0 ? -b / a : null }
    }
    const ideal = app.mode === 'explore' && showIdeal && !answersHidden() ? idealModel() : null
    let xmin = NU_MIN_THz
    for (const nu0 of [fitLine?.nu0, ideal && ideal.a > 0 ? -ideal.b / ideal.a : null]) {
      if (nu0 != null && nu0 > 200 && nu0 < NU_MIN_THz + 20) xmin = Math.min(xmin, Math.floor((nu0 - 20) / 25) * 25)
    }
    let ymax = 1.6
    for (const p of pts) ymax = Math.max(ymax, p.U * 1.2)
    for (const l of [fitLine, ideal]) if (l) ymax = Math.max(ymax, (l.a * NU_MAX_THz + l.b) * 1.05)
    fitState = { pts, fit: fitLine, ideal, xmin, ymax: Math.min(ymax, 30) }
    fit.setData([[xmin, NU_MAX_THz], [null, null]] as unknown as uPlot.AlignedData)
    fitEmpty.hidden = pts.length > 0

    // result card
    card.classList.toggle('ch-card-off', !f)
    dl.hidden = !f
    rule.hidden = !f
    noFit.hidden = !!f
    let summary = s.noFit
    if (f) {
      const h = f.h_Js
      const dev = ((h - H_Js) / H_Js) * 100
      const rows: [string, string][] = [
        [s.slope, `${nf(f.slope_VperHz / 1e-15, 2)} ×10⁻¹⁵ V·s`],
        [s.intercept, `${nf(f.intercept_V, 2)} V`],
        [s.planck, `(${nf(h / 1e-34, 2)} ± ${nf(f.sigma_h_Js / 1e-34, 2)}) ×10⁻³⁴ J·s`],
        [s.deviation, `${dev >= 0 ? '+' : '−'}${nf(Math.abs(dev), 1)} %`],
        [s.r2, nf(f.r2, 3)],
        ['n', s.nPoints(f.n)],
      ]
      dl.replaceChildren(
        ...rows.flatMap(([k, v], i) => {
          const dt = el('dt', undefined, k)
          const dd = el('dd', i === 2 ? 'ch-main' : undefined, v)
          return [dt, dd]
        }),
      )
      summary = `h = ${nf(h / 1e-34, 2)} ×10⁻³⁴ J·s, ${s.deviation} ${nf(dev, 1)} %, r² ${nf(f.r2, 3)}.`
    }
    fitHost.setAttribute('aria-label', s.fitAria(pts.length, summary))
    fit.redraw(false)
  }

  relabel()

  return {
    update() {
      const now = performance.now()
      if (now - lastRun < THROTTLE_ms) return
      lastRun = now
      refreshLive(false)
      refreshFit(false)
    },
    relabel,
    destroy() {
      ro.disconnect()
      mo.disconnect()
      mq.removeEventListener('change', retheme)
      live.destroy()
      fit.destroy()
      wrap.remove()
    },
  }
}
