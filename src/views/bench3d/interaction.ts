// Direct manipulation of the 3D bench: picking handles, dragging the arm, pressing the key, turning the range knob, the lamp
// rocker and the window slider, plus hover outlines, tooltips, the floating arm readout, long-press info, keyboard orbit and
// the pulsing focus highlight. Part of the lazy scene chunk. Maths and apparatus calls live in controller.ts.
//
// Pointer rules: a press on a handle disables OrbitControls, captures the pointer and swallows the event (stage capture
// phase, before OrbitControls sees it); a non-passive touchstart on a handle stops the page from scrolling. Everything
// else is left to OrbitControls and to the tap-for-info behaviour.
import type * as THREE from 'three'
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { ARM_Y, ARM_PIVOT, windowPoint } from './optics/helpers.ts'
import { createController, type BenchActions } from './controller.ts'
import type { PartId, PartRegistry } from './parts.ts'

type Kind = 'arm' | 'range' | 'key' | 'lamp' | 'cover'
interface Target { kind: Kind; /** Object whose meshes get the hover outline. */ outline: Object3D | null; part: PartId | null }
type Object3D = THREE.Object3D

export const LONG_PRESS_MS = 500
const MOVE_PX = 3, KNOB_MOVE_PX = 8, TAP_PX = 6
/** Height of the plane the arm knob is dragged on (the top of the knob, a bit above the arm axis). */
const ARM_DRAG_Y = 4.5

export interface InteractionDeps {
  three: typeof THREE
  container: HTMLElement
  canvas: HTMLCanvasElement
  camera: THREE.PerspectiveCamera
  controls: OrbitControls
  scene: THREE.Scene
  parts: PartRegistry
  actions: BenchActions
  /** Accent colour (follows the theme). */
  accent: () => THREE.Color
  reducedMotion: () => boolean
  requestRender: () => void
  /** Show the info card of a part (tap on a non-interactive part, long press on an interactive one). */
  onInfo(id: PartId | null): void
  onHover(hovering: boolean): void
  onUserCamera(): void
  partName(id: PartId): string
  /** Text of the floating arm readout for the current apparatus state. */
  armReadout(): string
  debug: boolean
}

export interface Interaction {
  /** Per frame; returns true while something animates (the focus pulse). */
  tick(dt_s: number): boolean
  setFocus(ids: PartId[]): void
  refreshTheme(): void
  destroy(): void
}

export function createInteraction(d: InteractionDeps): Interaction {
  const { three: T, container, canvas, camera, controls, parts } = d
  const ctl = createController(d.actions)
  const ray = new T.Raycaster()
  const ndc = new T.Vector2()
  const hitPoint = new T.Vector3()
  const named = (n: string): Object3D | null => d.scene.getObjectByName(n) ?? null

  // ---------------------------------------------------------------- DOM: tooltip and arm readout
  const tip = document.createElement('div')
  tip.className = 'bench3d-tip'
  tip.hidden = true
  tip.setAttribute('aria-hidden', 'true')
  const readout = document.createElement('div')
  readout.className = 'bench3d-readout'
  readout.hidden = true
  readout.setAttribute('aria-hidden', 'true')
  container.append(tip, readout)
  const place = (el: HTMLElement, cx: number, cy: number, dy: number): void => {
    const r = container.getBoundingClientRect()
    const x = Math.min(Math.max(cx - r.left, 8), Math.max(8, r.width - el.offsetWidth - 8))
    const y = Math.min(Math.max(cy - r.top + dy, 8), Math.max(8, r.height - el.offsetHeight - 8))
    el.style.transform = `translate(${x}px, ${y}px)`
  }

  // ---------------------------------------------------------------- outlines (inverted-hull rims)
  const hoverMat = new T.MeshBasicMaterial({ color: 0xffffff, side: T.BackSide, transparent: true, opacity: 0.6, depthWrite: false })
  const focusMat = new T.MeshBasicMaterial({ color: 0xffffff, side: T.BackSide, transparent: true, opacity: 0.5, depthWrite: false })
  const refreshTheme = (): void => { hoverMat.color.copy(d.accent()); focusMat.color.copy(d.accent()) }
  refreshTheme()
  const overlays = (root: Object3D, mat: THREE.Material): THREE.Mesh[] => {
    const out: THREE.Mesh[] = []
    const ws = new T.Vector3()
    const size = new T.Vector3(), center = new T.Vector3()
    root.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh || m.userData.overlay || m.userData.lambda_nm !== undefined || m.renderOrder >= 5) return
      const base = (m.userData.origMaterial ?? m.material) as THREE.Material | THREE.Material[]
      if (Array.isArray(base) || !base || base.visible === false) return
      const geo = m.geometry
      if (!geo.boundingBox) geo.computeBoundingBox()
      const bb = geo.boundingBox!
      bb.getSize(size); bb.getCenter(center)
      m.getWorldScale(ws)
      const half = (Math.max(size.x * ws.x, size.y * ws.y, size.z * ws.z) / 2) || 1
      const s = 1 + Math.min(0.35, 0.13 / half)
      const ov = new T.Mesh(geo, mat)
      ov.scale.setScalar(s)
      ov.position.copy(center).multiplyScalar(1 - s)
      ov.userData.overlay = true
      ov.raycast = () => {}
      ov.renderOrder = 3
      m.add(ov)
      out.push(ov)
    })
    return out
  }
  const drop = (list: THREE.Mesh[]): void => { for (const o of list) o.parent?.remove(o); list.length = 0 }
  let hoverOv: THREE.Mesh[] = []
  let hoverRoot: Object3D | null = null
  const setHoverOutline = (root: Object3D | null): void => {
    if (root === hoverRoot) return
    drop(hoverOv)
    hoverRoot = root
    if (root) hoverOv = overlays(root, hoverMat)
    d.requestRender()
  }
  let focusOv: THREE.Mesh[] = []
  let pulse_s = 0
  const setFocus = (ids: PartId[]): void => {
    drop(focusOv)
    for (const id of ids) {
      const p = parts.getPart(id)
      if (p) focusOv.push(...overlays(p.object, focusMat))
    }
    focusMat.opacity = 0.5
    d.requestRender()
  }

  // ---------------------------------------------------------------- picking
  const setRay = (clientX: number, clientY: number): boolean => {
    const r = canvas.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) return false
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1)
    ray.setFromCamera(ndc, camera)
    return true
  }
  interface Pick { target: Target | null; part: PartId | null }
  const pickAt = (clientX: number, clientY: number): Pick => {
    if (!setRay(clientX, clientY)) return { target: null, part: null }
    const hits = parts.hits(ndc.x, ndc.y, camera)
    const h0 = hits[0]
    if (!h0) return { target: null, part: null }
    let kind: Kind | null = null
    let nearest: PartId | null = null
    let inArm = false, inLamp = false, viaRocker = false
    for (let o: Object3D | null = h0.object; o; o = o.parent) {
      const u = o.userData
      if (!kind) {
        const dh = u.dragHandle as string | undefined
        if (dh === 'arm' || dh === 'range' || dh === 'cover') kind = dh
        else if (u.pressHandle === 'key') kind = 'key'
        else if (u.clickHandle === 'lamp') { kind = 'lamp'; viaRocker = true }
      }
      const pid = u.partId as PartId | undefined
      if (pid) { nearest ??= pid; if (pid === '9') inArm = true; if (pid === '1') inLamp = true }
    }
    if (!kind) kind = inLamp ? 'lamp' : inArm ? 'arm' : null
    if (!kind) return { target: null, part: nearest }
    const outline = kind === 'arm' ? named('arm-knob')
      : kind === 'range' ? parts.getPart('meterKnob')?.object ?? null
      : kind === 'key' ? named('key-cap')
      : kind === 'cover' ? named('cover-grip')
      : viaRocker ? named('choke-rocker') : parts.getPart('1')?.object ?? null
    const part: PartId | null = kind === 'arm' ? '9' : kind === 'range' ? 'meterKnob' : kind === 'key' ? 'key' : kind === 'cover' ? '12' : viaRocker ? 'choke' : '1'
    return { target: { kind, outline, part }, part: nearest ?? part }
  }

  // ---------------------------------------------------------------- planes for the drags
  const plane = new T.Plane()
  const intersect = (clientX: number, clientY: number, kind: Kind): THREE.Vector3 | null => {
    if (!setRay(clientX, clientY)) return null
    if (kind === 'arm') plane.set(new T.Vector3(0, 1, 0), -ARM_DRAG_Y)
    else if (kind === 'cover') plane.set(new T.Vector3(0, 1, 0), -ARM_Y) // grip height; the point is projected on the edge (a vertical plane would be edge-on from above)
    else if (kind === 'range') {
      const knob = parts.getPart('meterKnob')?.object
      if (!knob?.parent) return null
      knob.updateWorldMatrix(true, false)
      const n = new T.Vector3(0, 0, 1).transformDirection(knob.parent.matrixWorld)
      plane.setFromNormalAndCoplanarPoint(n, knob.getWorldPosition(new T.Vector3()))
    } else return null
    return ray.ray.intersectPlane(plane, hitPoint)
  }
  /** Pointer position in the range knob's frame (u right, v up), from the face frame (not the knob, which turns). */
  const knobFrame = (clientX: number, clientY: number): { u: number; v: number } | null => {
    const knob = parts.getPart('meterKnob')?.object
    const p = intersect(clientX, clientY, 'range')
    if (!knob?.parent || !p) return null
    const l = knob.parent.worldToLocal(p.clone())
    return { u: l.x - knob.position.x, v: l.y - knob.position.y }
  }

  // ---------------------------------------------------------------- drag state
  interface Active {
    pointerId: number
    target: Target
    sx: number; sy: number
    moved: boolean
    consumed: boolean
    side: 1 | -1
    timer: number
  }
  let active: Active | null = null
  let plain: { id: number; x: number; y: number; t: number } | null = null
  const setCursor = (c: string): void => { canvas.style.cursor = c }
  const cursorFor = (k: Kind | null): string => (k === 'arm' || k === 'cover' || k === 'range' ? 'grab' : k ? 'pointer' : '')

  const showReadout = (x: number, y: number): void => {
    readout.textContent = d.armReadout()
    readout.hidden = false
    place(readout, x + 14, y, -44)
  }
  const hideReadout = (): void => { readout.hidden = true }

  const finish = (e: { pointerId: number } | null): void => {
    const a = active
    if (!a || (e && e.pointerId !== a.pointerId)) return
    active = null
    window.clearTimeout(a.timer)
    try { canvas.releasePointerCapture(a.pointerId) } catch { /* already released */ }
    controls.enabled = true
    hideReadout()
    if (a.target.kind === 'key') ctl.releaseKey()
    else if (!a.consumed && !a.moved) {
      if (a.target.kind === 'lamp') ctl.toggleLamp()
      else if (a.target.kind === 'range') ctl.stepRange(a.side)
      else d.onInfo(a.target.part) // a tap on the arm or the slider has no action of its own: show what it is
    }
    setCursor(cursorFor(a.target.kind))
  }

  const onDown = (e: PointerEvent): void => {
    if (e.target !== canvas) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (active) { e.stopPropagation(); return } // a second finger while a handle is held: ignore
    const { target } = pickAt(e.clientX, e.clientY)
    plain = null
    if (!target) { plain = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() }; return }
    e.preventDefault()
    e.stopPropagation()
    controls.enabled = false
    try { canvas.setPointerCapture(e.pointerId) } catch { /* synthetic pointer */ }
    setHoverOutline(null)
    tip.hidden = true
    const a: Active = { pointerId: e.pointerId, target, sx: e.clientX, sy: e.clientY, moved: false, consumed: false, side: 1, timer: 0 }
    active = a
    if (target.kind === 'key') { ctl.pressKey(); setCursor('pointer'); return } // a held key: no long-press info
    if (target.kind === 'arm') {
      const p = intersect(e.clientX, e.clientY, 'arm')
      if (p) ctl.beginArmDrag(p.x, p.z)
      setCursor('grabbing')
    } else if (target.kind === 'cover') {
      const p = intersect(e.clientX, e.clientY, 'cover')
      if (p) ctl.beginCoverDrag(p.x, p.z)
      setCursor('grabbing')
    } else if (target.kind === 'range') {
      const f = knobFrame(e.clientX, e.clientY)
      a.side = f && f.u < 0 ? -1 : 1
    }
    a.timer = window.setTimeout(() => {
      if (active !== a || a.moved) return
      a.consumed = true
      d.onInfo(target.part)
    }, LONG_PRESS_MS)
  }

  const onMove = (e: PointerEvent): void => {
    const a = active
    if (a) {
      if (e.pointerId !== a.pointerId) return
      const dist = Math.hypot(e.clientX - a.sx, e.clientY - a.sy)
      const k = a.target.kind
      if (!a.moved && dist > (k === 'range' ? KNOB_MOVE_PX : MOVE_PX) && k !== 'key') { a.moved = true; window.clearTimeout(a.timer) }
      if (!a.moved) return
      if (k === 'arm') {
        const p = intersect(e.clientX, e.clientY, 'arm')
        if (p) ctl.dragArm(p.x, p.z)
        showReadout(e.clientX, e.clientY)
      } else if (k === 'cover') {
        const p = intersect(e.clientX, e.clientY, 'cover')
        if (p) ctl.dragCover(p.x, p.z)
      } else if (k === 'range') {
        const f = knobFrame(e.clientX, e.clientY)
        if (f) ctl.dragRange(f.u, f.v)
      }
      return
    }
    if (e.pointerType !== 'mouse') return
    scheduleHover(e.clientX, e.clientY)
  }

  let hoverRaf = 0
  let hoverXY = { x: 0, y: 0 }
  const scheduleHover = (x: number, y: number): void => {
    hoverXY = { x, y }
    if (hoverRaf) return
    hoverRaf = requestAnimationFrame(() => {
      hoverRaf = 0
      if (active) return
      const { target, part } = pickAt(hoverXY.x, hoverXY.y)
      setHoverOutline(target?.outline ?? null)
      setCursor(cursorFor(target?.kind ?? null))
      d.onHover(part !== null)
      if (part) {
        tip.textContent = d.partName(part)
        tip.hidden = false
        place(tip, hoverXY.x + 14, hoverXY.y, 16)
      } else tip.hidden = true
    })
  }
  const clearHover = (): void => {
    if (active) return
    if (hoverRaf) { cancelAnimationFrame(hoverRaf); hoverRaf = 0 }
    setHoverOutline(null)
    tip.hidden = true
    d.onHover(false)
    if (!active) setCursor('')
  }

  const onUp = (e: PointerEvent): void => {
    if (active) { finish(e); return }
    const p = plain
    plain = null
    if (!p || p.id !== e.pointerId) return
    if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > TAP_PX || performance.now() - p.t > LONG_PRESS_MS + 100) return
    d.onInfo(pickAt(e.clientX, e.clientY).part)
  }
  const onCancel = (e: PointerEvent): void => { plain = null; finish(e) }

  // a held key must never stick when the page loses focus
  const releaseAll = (): void => { if (active) finish(active) }
  const onVis = (): void => { if (document.hidden) releaseAll() }

  // touch: a touch that starts on a handle must not scroll the page (pointer events cannot cancel a scroll)
  const onTouchStart = (e: TouchEvent): void => {
    const t = e.touches[0]
    if (!t || e.touches.length > 1 && !active) return
    if (active || pickAt(t.clientX, t.clientY).target) e.preventDefault()
  }

  const onWheel = (e: WheelEvent): void => {
    if (e.target !== canvas) return
    const { target } = pickAt(e.clientX, e.clientY)
    if (target?.kind !== 'arm') return
    e.preventDefault()
    e.stopPropagation()
    ctl.nudgeArm(e.deltaY)
    showReadout(e.clientX, e.clientY)
    window.clearTimeout(wheelTimer)
    wheelTimer = window.setTimeout(hideReadout, 900)
  }
  let wheelTimer = 0

  // keyboard: arrows orbit, plus and minus zoom (the strip under the canvas operates the instruments)
  const onKey = (e: KeyboardEvent): void => {
    if (e.altKey || e.ctrlKey || e.metaKey) return
    const step = (5 * Math.PI) / 180
    let dTheta = 0, dPhi = 0, zoom = 1
    switch (e.key) {
      case 'ArrowLeft': dTheta = -step; break
      case 'ArrowRight': dTheta = step; break
      case 'ArrowUp': dPhi = -step; break
      case 'ArrowDown': dPhi = step; break
      case '+': case '=': zoom = 0.9; break
      case '-': case '_': zoom = 1.1; break
      default: return
    }
    e.preventDefault()
    const off = camera.position.clone().sub(controls.target)
    const sph = new T.Spherical().setFromVector3(off)
    sph.theta += dTheta
    sph.phi = Math.min(controls.maxPolarAngle, Math.max(0.05, sph.phi + dPhi))
    sph.radius = Math.min(controls.maxDistance, Math.max(controls.minDistance, sph.radius * zoom))
    off.setFromSpherical(sph)
    camera.position.copy(controls.target).add(off)
    camera.lookAt(controls.target)
    controls.update()
    d.onUserCamera()
    d.requestRender()
  }

  container.addEventListener('pointerdown', onDown, true)
  canvas.addEventListener('pointermove', onMove)
  canvas.addEventListener('pointerup', onUp)
  canvas.addEventListener('pointercancel', onCancel)
  canvas.addEventListener('lostpointercapture', onCancel)
  canvas.addEventListener('pointerleave', clearHover)
  canvas.addEventListener('touchstart', onTouchStart, { passive: false })
  container.addEventListener('wheel', onWheel, { passive: false, capture: true })
  canvas.addEventListener('keydown', onKey)
  window.addEventListener('blur', releaseAll)
  document.addEventListener('visibilitychange', onVis)

  // ---------------------------------------------------------------- debug hook (?debug3d=1 only)
  const debugNames: Record<string, () => Object3D | null> = {
    armKnob: () => named('arm-knob'),
    key: () => named('key-cap'),
    rangeKnob: () => parts.getPart('meterKnob')?.object ?? null,
    lampRocker: () => named('choke-rocker'),
    coverGrip: () => named('cover-grip'),
    lamp: () => parts.getPart('1')?.object ?? null,
  }
  if (d.debug) {
    ;(window as unknown as { __bench3dDebug?: unknown }).__bench3dDebug = {
      /** Client coordinates of a handle's centre, or null when it is off screen. */
      screenPos(id: string): { x: number; y: number } | null {
        const o = debugNames[id]?.()
        if (!o) return null
        camera.updateMatrixWorld()
        const box = new T.Box3().setFromObject(o, true)
        const v = box.getCenter(new T.Vector3()).project(camera)
        const r = canvas.getBoundingClientRect()
        return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height }
      },
      /** Client coordinates of the arm knob when the arm is at position t (for scripted drags). */
      armKnobAt(t: number): { x: number; z: number; screen: { x: number; y: number } } {
        const w = windowPoint(t)
        const dx = w.x - ARM_PIVOT.x, dz = w.z - ARM_PIVOT.z, n = Math.hypot(dx, dz)
        const p = new T.Vector3(ARM_PIVOT.x + (5.6 * dx) / n, ARM_DRAG_Y, ARM_PIVOT.z + (5.6 * dz) / n)
        camera.updateMatrixWorld()
        const v = p.clone().project(camera)
        const r = canvas.getBoundingClientRect()
        return { x: p.x, z: p.z, screen: { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height } }
      },
    }
  }

  return {
    tick(dt) {
      if (focusOv.length === 0) return false
      if (d.reducedMotion()) { focusMat.opacity = 0.5; return false }
      pulse_s += dt
      focusMat.opacity = 0.42 + 0.26 * Math.sin((pulse_s * 2 * Math.PI) / 1.8)
      return true
    },
    setFocus,
    refreshTheme,
    destroy() {
      releaseAll()
      window.clearTimeout(wheelTimer)
      container.removeEventListener('pointerdown', onDown, true)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onCancel)
      canvas.removeEventListener('lostpointercapture', onCancel)
      canvas.removeEventListener('pointerleave', clearHover)
      canvas.removeEventListener('touchstart', onTouchStart)
      container.removeEventListener('wheel', onWheel, true)
      canvas.removeEventListener('keydown', onKey)
      window.removeEventListener('blur', releaseAll)
      document.removeEventListener('visibilitychange', onVis)
      if (hoverRaf) cancelAnimationFrame(hoverRaf)
      drop(hoverOv); drop(focusOv)
      hoverMat.dispose(); focusMat.dispose()
      tip.remove(); readout.remove()
      delete (window as unknown as { __bench3dDebug?: unknown }).__bench3dDebug
    },
  }
}
