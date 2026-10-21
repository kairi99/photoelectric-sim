// The Learn drawer: Explore/Lab note, task list, task card (predict -> act -> observe -> explain), procedure
// checklist, tour replay and help link. The act step ends by itself when the task's success(a) holds.
import { H_Js } from '../physics/index.ts'
import type { Mode } from '../apparatus/index.ts'
import type { View, ViewContext } from '../views/view.ts'
import { createChecklist } from './checklist.ts'
import type { ChecklistView } from './checklist.ts'
import { button, el, store } from './dom.ts'
import { fmt, pt } from './strings.ts'
import type { PedagogyDict } from './strings.ts'
import { applyInitial, energyVars } from './task.ts'
import type { GuidedTask } from './task.ts'
import { TASKS } from './tasks/index.ts'

export const DONE_KEY = 'photoelectric-tasks-done'
export const CHECK_EVERY_MS = 150
export const HINT_DELAY_MS = 8000

export interface LearnHost {
  open(): void
  close(): void
  isOpen(): boolean
  /** True when the drawer sits beside the app instead of over it (wide screens). */
  docked(): boolean
}
export interface PedContext extends ViewContext {
  views: () => View[]
  learn: LearnHost
  dock: HTMLElement
  helpHref: () => string
  startTour: () => void
}

type Step = 0 | 1 | 2 | 3
const STEP_KEYS = ['predict', 'act', 'observe', 'explain'] as const

function loadDone(): Set<string> {
  try {
    const v: unknown = JSON.parse(store.get(DONE_KEY) ?? '[]')
    return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
  } catch { return new Set() }
}

export interface Learn {
  update(): void
  relabel(): void
  openTask(id: string, step?: Step): void
  destroy(): void
}

export function mountLearn(root: HTMLElement, ctx: PedContext): Learn {
  const a = ctx.apparatus
  const teacher = new URLSearchParams(location.search).has('teacher')
  const done = loadDone()
  const fullChecklist: ChecklistView = createChecklist(ctx, 'full')
  const S = (): PedagogyDict => pt(ctx.lang())
  const X = (k: GuidedTask): PedagogyDict['task']['find-line'] => S().task[k.id as keyof PedagogyDict['task']]

  let task: GuidedTask | null = null
  let step: Step = 0
  let prediction: string | null = null // choice index as string, or the number as typed
  let modeNote: Mode | null = null // set when starting a task switched the mode
  let actSince = 0
  let lastCheck = 0
  let selfModeChange = false

  // ---- compact task bar in the dock (small screens, while the drawer is closed) ----
  const bar = el('div', 'taskbar', ctx.dock)
  bar.hidden = true
  const barText = el('p', 'taskbar-text', bar)
  const barTitle = el('strong', '', barText)
  const barHint = el('span', 'taskbar-hint', barText)
  const barBtn = button('', 'taskbar-open', bar, () => ctx.learn.open())

  const setHideAnswers = (on: boolean): void => {
    if (on) document.documentElement.setAttribute('data-hide-answers', '')
    else document.documentElement.removeAttribute('data-hide-answers')
  }
  const focusViews = (controls: string[] | null): void => {
    for (const v of ctx.views()) v.focus?.(controls)
  }

  const currentHint = (): string | null => {
    if (!task || step !== 1) return null
    const h = task.hints.find((x) => x.when(a))
    return h ? S().hints[h.key] : null
  }

  // ---- rendering ----
  const chipFor = (k: GuidedTask, parent: Element): void => { el('span', 'chip', parent).textContent = X(k).concept }

  function renderList(): void {
    const s = S()
    root.replaceChildren()
    const wrap = el('div', 'ped', root)
    el('p', 'ped-note', wrap).textContent = a.mode === 'lab' ? s.ui.noteLab : s.ui.noteExplore
    const renderProc = (): void => {
    el('h3', 'ped-h', wrap).textContent = s.ui.procedureTitle
    el('p', 'ped-note', wrap).textContent = a.mode === 'lab' ? s.ui.procedureLabLine : s.ui.procedureExploreLine
    if (a.mode === 'lab') wrap.append(fullChecklist.el)
    }
    const renderTasks = (): void => {
    el('h3', 'ped-h', wrap).textContent = s.ui.tasksTitle
    const ul = el('ul', 'task-list', wrap)
    for (const k of TASKS) {
      const b = button('', 'task-item', el('li', '', ul), () => start(k))
      const top = el('span', 'task-item-top', b)
      chipFor(k, top)
      if (done.has(k.id)) {
        const ok = el('span', 'task-ok', top)
        ok.textContent = '✓'
        ok.setAttribute('aria-label', s.ui.completed)
      }
      el('strong', 'task-item-title', b).textContent = X(k).title
      el('span', 'task-item-meta', b).textContent = `${s.ui.levels[k.level]} · ${s.ui.modes[k.mode]}`
    }
    }
    if (a.mode === 'lab') { renderProc(); renderTasks() } else { renderTasks(); renderProc() }
    const links = el('div', 'ped-links', wrap)
    button(s.ui.replayTour, 'ped-link', links, () => ctx.startTour())
    const help = el('a', 'ped-link', links)
    help.href = ctx.helpHref()
    help.textContent = s.ui.helpLink
  }

  function renderTask(k: GuidedTask): void {
    const s = S()
    const x = X(k)
    root.replaceChildren()
    const wrap = el('div', 'ped', root)
    button(`‹ ${s.ui.back}`, 'ped-back', wrap, close)
    const head = el('div', 'ped-head', wrap)
    el('h3', 'ped-title', head).textContent = x.title
    chipFor(k, head)
    const ol = el('ol', 'steps', wrap)
    STEP_KEYS.forEach((key, i) => {
      const li = el('li', '', ol)
      li.textContent = s.ui.steps[key]
      if (i === step) li.setAttribute('aria-current', 'step')
      if (i < step) li.dataset.past = ''
    })
    const bodyEl = el('div', 'task-body', wrap)
    bodyEl.setAttribute('aria-live', 'polite')
    let commit!: HTMLButtonElement
    if (modeNote && step === 0) el('p', 'ped-note', bodyEl).textContent = fmt(s.ui.switchedMode, { mode: s.ui.modes[modeNote] })

    if (step === 0) {
      el('p', '', bodyEl).textContent = x.predict
      if (k.predict.kind === 'number') {
        const lab = el('label', 'predict-number', bodyEl)
        el('span', 'visually-hidden', lab).textContent = s.ui.predictNumber
        const inp = el('input', '', lab)
        inp.inputMode = 'decimal'
        inp.autocomplete = 'off'
        inp.value = prediction ?? ''
        inp.setAttribute('aria-label', s.ui.predictNumber)
        el('span', 'predict-unit', lab).textContent = k.predict.unit
        inp.addEventListener('input', () => {
          const t = inp.value.trim().replace(',', '.')
          prediction = t !== '' && Number.isFinite(Number(t)) ? t : null
          commit.disabled = prediction === null
        })
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' && prediction !== null) go(1) })
      } else {
        const g = el('div', 'choices', bodyEl)
        g.setAttribute('role', 'radiogroup')
        g.setAttribute('aria-label', s.ui.predictChoice)
        x.options.forEach((o, i) => {
          const b = button(o, 'choice', g, () => {
            prediction = String(i)
            g.querySelectorAll('button').forEach((n, j) => { n.setAttribute('aria-checked', String(j === i)) })
            commit.disabled = false
          })
          b.setAttribute('role', 'radio')
          b.setAttribute('aria-checked', String(prediction === String(i)))
        })
      }
      commit = button(s.ui.commit, 'primary', bodyEl, () => go(1))
      commit.disabled = prediction === null
    } else if (step === 1) {
      el('p', '', bodyEl).textContent = x.act
      el('p', 'ped-hint', bodyEl).hidden = true
      el('p', 'ped-waiting', bodyEl).textContent = s.ui.waiting
    } else if (step === 2) {
      el('p', 'ped-done', bodyEl).textContent = `✓ ${s.ui.done}`
      el('p', '', bodyEl).textContent = x.observe
      fitLine(bodyEl)
      button(s.ui.next, 'primary', bodyEl, () => go(3))
    } else {
      verdict(k, bodyEl)
      el('p', '', bodyEl).textContent = fmt(x.explain, energyVars(ctx.lang()))
      fitLine(bodyEl)
      const dl = el('dl', 'recall', bodyEl)
      el('dt', '', dl).textContent = s.ui.yourPrediction
      el('dd', '', dl).textContent = predictionText(k)
      el('dt', '', dl).textContent = s.ui.answer
      el('dd', '', dl).textContent = answerText(k)
      button(s.ui.restart, 'ped-back', bodyEl, () => start(k))
    }
    if (teacher) {
      const d = el('details', 'teacher', wrap)
      el('summary', '', d).textContent = s.ui.teacher
      el('p', '', d).textContent = fmt(x.teacher, energyVars(ctx.lang()))
    }
  }

  const fitLine = (parent: Element): void => {
    if (!task || task.id !== 'planck') return
    const f = a.fitResult()
    el('p', 'ped-fit', parent).textContent = f ? fmt(S().ui.yourFit, { h: (f.h_Js / 1e-34).toFixed(2) }) : S().ui.noFit
  }
  /** Choice predictions: tell the student whether they were right before the explanation. */
  const verdict = (k: GuidedTask, parent: Element): void => {
    if (k.predict.kind !== 'choice' || prediction === null) return
    const right = Number(prediction) === k.predict.answer
    el('p', `ped-verdict ${right ? 'is-right' : 'is-wrong'}`, parent).textContent = `${right ? '✓' : '✗'} ${right ? S().ui.verdictRight : S().ui.verdictWrong}`
  }
  const predictionText = (k: GuidedTask): string => {
    if (prediction === null) return S().ui.noPrediction
    if (k.predict.kind === 'number') return `${prediction} ${k.predict.unit}`
    return X(k).options[Number(prediction)] ?? S().ui.noPrediction
  }
  const answerText = (k: GuidedTask): string =>
    k.predict.kind === 'choice' ? (X(k).options[k.predict.answer] ?? '') : `${(H_Js / 1e-34).toFixed(2)} ${k.predict.unit}`

  function build(): void {
    if (task) renderTask(task)
    else renderList()
    syncBar()
  }

  function syncBar(): void {
    const show = task !== null && step === 1 && !ctx.learn.isOpen()
    bar.hidden = !show
    if (!task) return
    const s = S()
    barTitle.textContent = `${X(task).title} · ${s.ui.steps.act}`
    barHint.textContent = currentHint() ?? ''
    barBtn.textContent = s.ui.openTask
    barBtn.setAttribute('aria-label', s.ui.openTaskLabel)
  }

  // ---- flow ----
  function go(next: Step): void {
    step = next
    // The ideal-U0 line and the photon-energy overlay would give the answer away before the act step is done.
    setHideAnswers(task !== null && next < 2)
    if (task && next === 2) {
      done.add(task.id)
      store.set(DONE_KEY, JSON.stringify([...done]))
    }
    actSince = performance.now()
    build()
    root.querySelector<HTMLElement>('.task-body input, .task-body button')?.focus({ preventScroll: true })
    if (next === 1 && !ctx.learn.docked()) ctx.learn.close()
    if (next === 2) ctx.learn.open()
    syncBar()
  }

  function start(k: GuidedTask, atStep: Step = 0): void {
    task = k
    prediction = null
    const before = a.mode
    selfModeChange = true
    applyInitial(a, k)
    selfModeChange = false
    modeNote = before !== k.mode ? k.mode : null
    focusViews(k.controls)
    go(atStep)
  }

  function close(): void {
    task = null
    modeNote = null
    setHideAnswers(false)
    focusViews(null)
    build()
  }

  a.on('mode', () => {
    if (selfModeChange) return
    if (task) close()
    else build()
  })

  const check = (): void => {
    if (!task || step !== 1) return
    if (task.success(a)) go(2)
  }
  a.on('measurements', () => { lastCheck = 0; check() })

  return {
    update() {
      fullChecklist.update()
      const now = performance.now()
      if (now - lastCheck < CHECK_EVERY_MS) return
      lastCheck = now
      check()
      if (task && step === 1) {
        const hint = now - actSince >= HINT_DELAY_MS ? currentHint() : null
        const hp = root.querySelector<HTMLElement>('.ped-hint')
        if (hp) {
          hp.hidden = hint === null
          hp.textContent = hint ? `${S().ui.hintLabel}: ${hint}` : ''
        }
        barHint.textContent = hint ?? ''
        syncBar()
      } else if (bar.hidden === false) syncBar()
    },
    relabel() { fullChecklist.relabel(); build() },
    openTask(id, atStep = 0) {
      const k = TASKS.find((t) => t.id === id)
      if (k) start(k, atStep)
    },
    destroy() { bar.remove(); setHideAnswers(false) },
  }
}
