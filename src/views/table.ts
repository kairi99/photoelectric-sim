// Data table view: measurement rows, record control, CSV export, clear-all with inline confirm.
import type { Measurement, RecordResult } from '../apparatus/index.ts'
import type { MountView, View } from './view.ts'
import { downloadCSV, toCSV } from './csv.ts'
import { strings } from './strings/table.ts'
import '../styles/table.css'

const LINE_VAR: Record<string, string> = {
  yellow: '--phys-yellow', green: '--phys-green', blue: '--phys-blue', violet: '--phys-violet', uv: '--label-2',
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (text !== undefined) e.textContent = text
  return e
}

export const mountTable: MountView = (root, ctx): View => {
  const app = ctx.apparatus
  const S = () => strings[ctx.lang()]
  let confirming = false
  let notice: { kind: 'error' | 'warn'; text: () => string } | null = null

  const wrap = el('section', 'tbl')
  const head = el('div', 'tbl-head')
  const h = el('h2', 'tbl-title')
  head.append(h)

  const rec = el('form', 'tbl-record')
  rec.noValidate = true
  const label = el('label', 'tbl-field')
  const labelText = el('span', 'tbl-label')
  const input = el('input', 'tbl-input')
  input.type = 'text'
  input.inputMode = 'decimal'
  input.autocomplete = 'off'
  label.append(labelText, input)
  const recBtn = el('button', 'tbl-btn tbl-btn-primary')
  recBtn.type = 'submit'
  rec.append(label, recBtn)

  const msg = el('p', 'tbl-msg')
  msg.setAttribute('role', 'status')

  const scroll = el('div', 'tbl-scroll')
  const table = el('table', 'tbl-table')
  const caption = el('caption', 'tbl-caption')
  const thead = el('thead')
  const tbody = el('tbody')
  table.append(caption, thead, tbody)
  scroll.append(table)
  const empty = el('p', 'tbl-empty')

  const foot = el('div', 'tbl-foot')
  const exportBtn = el('button', 'tbl-btn')
  exportBtn.type = 'button'
  const clearBtn = el('button', 'tbl-btn tbl-btn-danger')
  clearBtn.type = 'button'
  const confirmBox = el('div', 'tbl-confirm')
  confirmBox.setAttribute('role', 'alertdialog')
  const confirmText = el('span', 'tbl-confirm-text')
  const yesBtn = el('button', 'tbl-btn tbl-btn-danger-solid')
  yesBtn.type = 'button'
  const noBtn = el('button', 'tbl-btn')
  noBtn.type = 'button'
  confirmBox.append(confirmText, yesBtn, noBtn)
  foot.append(exportBtn, clearBtn, confirmBox)

  wrap.append(head, rec, msg, scroll, empty, foot)
  root.append(wrap)

  const parseValue = (raw: string): number | undefined => {
    const s = raw.trim().replace(',', '.')
    if (s === '') return undefined
    return s === '' || !/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s) ? NaN : Number(s)
  }

  const showResult = (r: RecordResult): void => {
    if (!r.ok) {
      const key = r.error === 'invalid-value' ? 'errInvalid' : r.error === 'value-required' ? 'errRequired' : 'errMeterOff'
      notice = { kind: 'error', text: () => S()[key] }
    } else {
      const m = r.measurement
      if (m.lineId === null) notice = { kind: 'warn', text: () => S().warnMisaligned }
      else if (!m.settled) notice = { kind: 'warn', text: () => S().warnUnsettled }
      else notice = null
      if (r.ok) input.value = ''
    }
    renderNotice()
  }
  const renderNotice = (): void => {
    msg.textContent = notice ? notice.text() : ''
    msg.dataset.kind = notice ? notice.kind : ''
    msg.hidden = !notice
    input.setAttribute('aria-invalid', notice?.kind === 'error' ? 'true' : 'false')
  }

  rec.addEventListener('submit', (e) => {
    e.preventDefault()
    if (app.mode === 'lab') showResult(app.record(parseValue(input.value)))
    else showResult(app.record())
  })
  input.addEventListener('input', () => {
    if (notice?.kind === 'error') { notice = null; renderNotice() }
  })
  exportBtn.addEventListener('click', () => downloadCSV(toCSV(app.measurements, ctx.lang())))
  clearBtn.addEventListener('click', () => { confirming = true; applyConfirm(); yesBtn.focus() })
  noBtn.addEventListener('click', () => { confirming = false; applyConfirm(); clearBtn.focus() })
  yesBtn.addEventListener('click', () => {
    app.clearMeasurements()
    confirming = false
    notice = null
    renderNotice()
    applyConfirm()
  })

  const applyConfirm = (): void => {
    const n = app.measurements.length
    confirmBox.hidden = !confirming || n === 0
    clearBtn.hidden = confirming && n > 0
    confirmText.textContent = S().confirmClear(n)
  }

  const row = (m: Measurement, i: number): HTMLTableRowElement => {
    const s = S()
    const tr = el('tr')
    if (m.lineId === null || !m.settled) tr.classList.add('tbl-flag')
    const th = el('th')
    th.scope = 'row'
    const chip = el('span', 'tbl-chip')
    chip.style.background = m.lineId ? `var(${LINE_VAR[m.lineId]})` : 'transparent'
    chip.setAttribute('aria-hidden', 'true')
    const name = el('span', 'tbl-name', m.lineId ? s.lines[m.lineId] : s.noLine)
    th.append(chip, name)
    if (m.lineId === null || !m.settled) {
      const w = el('span', 'tbl-warn', '!')
      w.title = m.lineId === null ? s.warnMisaligned : s.warnUnsettled
      w.setAttribute('role', 'img')
      w.setAttribute('aria-label', w.title)
      th.append(w)
    }
    const cells = [
      m.lambda_nm === null ? '–' : m.lambda_nm.toFixed(0),
      m.nu_Hz === null ? '–' : (m.nu_Hz / 1e12).toFixed(0),
      m.U0_V.toFixed(2),
      m.t_wait_s.toFixed(0),
    ].map((t) => el('td', 'tbl-num', t))
    const tdDel = el('td', 'tbl-del')
    const del = el('button', 'tbl-icon')
    del.type = 'button'
    del.textContent = '×'
    del.setAttribute('aria-label', s.deleteRow(i + 1))
    del.addEventListener('click', () => { app.removeMeasurement(i); notice = null; renderNotice() })
    tdDel.append(del)
    tr.append(th, ...cells, tdDel)
    return tr
  }

  const rebuild = (): void => {
    const s = S()
    const ms = app.measurements
    tbody.replaceChildren(...ms.map(row))
    empty.hidden = ms.length > 0
    scroll.hidden = ms.length === 0
    exportBtn.disabled = ms.length === 0
    clearBtn.disabled = ms.length === 0
    if (ms.length === 0) confirming = false
    applyConfirm()
    void s
  }

  const relabel = (): void => {
    const s = S()
    h.textContent = s.title
    caption.textContent = s.caption
    const tr = el('tr')
    const cols = [s.colLine, s.colLambda, s.colNu, s.colU0, s.colWait]
    cols.forEach((c, i) => { const th = el('th', i ? 'tbl-num' : '', c); th.scope = 'col'; tr.append(th) })
    const thd = el('th', 'tbl-del')
    thd.scope = 'col'
    thd.append(el('span', 'tbl-sr', s.colActions))
    tr.append(thd)
    thead.replaceChildren(tr)
    empty.textContent = s.empty
    exportBtn.textContent = s.exportCsv
    clearBtn.textContent = s.clearAll
    yesBtn.textContent = s.confirmYes
    noBtn.textContent = s.confirmNo
    applyMode()
    renderNotice()
    rebuild()
  }

  const applyMode = (): void => {
    const s = S()
    const lab = app.mode === 'lab'
    label.hidden = !lab
    input.placeholder = s.readingHint
    labelText.textContent = s.readingLabel
    recBtn.textContent = lab ? s.record : s.recordNow
  }

  relabel()

  const offs = [
    app.on('measurements', () => { notice = null; renderNotice(); rebuild() }),
    app.on('mode', () => { notice = null; applyMode(); renderNotice(); rebuild() }),
  ]

  return {
    update() { /* event-driven */ },
    relabel,
    destroy() { for (const off of offs) off(); wrap.remove() },
  }
}
