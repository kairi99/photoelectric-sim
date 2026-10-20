// The three.js scene of the 3D bench. This module (and three itself) is a lazy chunk: only index.ts imports it, via
// dynamic import(). Style follows the kairi99/parametricResonance-sim scene: ACES tone mapping, sRGB output, soft shadows,
// RoomEnvironment PMREM, damped OrbitControls, standard materials.
//
// Rendering is on demand: nothing is drawn while nothing changed (no readout change, no camera motion, no damping).
// There is no private requestAnimationFrame: main.ts calls update() once per frame, which does the cheap checks.
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import type { Apparatus } from '../../apparatus/index.ts'
import type { ViewContext } from '../view.ts'
import { BUILDERS, type BuildCtx, type BuiltModel } from './builders.ts'
import { createMaterials } from './materials.ts'
import { PartRegistry, type PartId } from './parts.ts'
import { TABLE, units } from './units.ts'

export type PresetName = 'overview' | 'optics' | 'meter' | 'top'
export const PRESET_NAMES: readonly PresetName[] = ['overview', 'optics', 'meter', 'top']

interface PresetDef {
  target: [number, number, number]
  /** Azimuth (deg) around y: 0 = camera in front (+z) looking at -z; positive swings it to the right (+x). */
  azimuth: number
  elevation: number
  /** Half extents (cm) that must fit the view: horizontally on screen and vertically on screen. */
  halfW: number
  halfH: number
}
const PRESETS: Record<PresetName, PresetDef> = {
  overview: { target: [-1, 2, 6], azimuth: 0, elevation: 35, halfW: 43, halfH: 18 },
  optics: { target: [-3, 3, 4], azimuth: -8, elevation: 38, halfW: 24, halfH: 11 },
  meter: { target: [38.5, 4, 12.5], azimuth: 12, elevation: 28, halfW: 10, halfH: 6.5 },
  top: { target: [-1, 0, 5], azimuth: 0, elevation: 89, halfW: 48, halfH: 17 },
}
const FOV = 35
const TRANSITION_MS = 400

export interface SceneOptions {
  initialPreset: PresetName
  onPick(id: PartId | null): void
  onFail(reason: string): void
}

export interface BenchScene {
  update(): void
  setVisible(visible: boolean): void
  setPreset(name: PresetName): void
  currentPreset(): PresetName | null
  focus(controls: string[] | null): void
  highlight(ids: PartId[] | null): void
  destroy(): void
}

const easeOut = (t: number): number => 1 - Math.pow(1 - t, 3)

export function createBenchScene(container: HTMLElement, ctx: ViewContext, opts: SceneOptions): BenchScene {
  const a: Apparatus = ctx.apparatus
  const coarse = matchMedia('(pointer: coarse)').matches || innerWidth < 700

  // ---------- renderer ----------
  const renderer = new THREE.WebGLRenderer({ antialias: !coarse, alpha: false, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const canvas = renderer.domElement
  canvas.setAttribute('tabindex', '-1')
  container.append(canvas)

  // ---------- theme probe + materials ----------
  const probe = document.createElement('span')
  probe.setAttribute('aria-hidden', 'true')
  probe.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;visibility:hidden'
  container.append(probe) // attached: tokens resolve through computed style
  const materials = createMaterials(THREE, probe)

  // ---------- scene, camera, lights ----------
  const scene = new THREE.Scene()
  scene.background = materials.tokens.plate.clone()
  const pmrem = new THREE.PMREMGenerator(renderer)
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environment = envTex
  scene.environmentIntensity = 0.9

  const camera = new THREE.PerspectiveCamera(FOV, 1.6, 1, 600)
  const controls = new OrbitControls(camera, canvas)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.minDistance = 8
  controls.maxDistance = 220
  controls.maxPolarAngle = (89.9 * Math.PI) / 180
  controls.screenSpacePanning = false
  if (matchMedia('(pointer: coarse)').matches) canvas.style.touchAction = 'pan-y' // keep vertical page scroll over the canvas

  scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x20242c, 0.45))
  const sun = new THREE.DirectionalLight(0xffffff, 2.2)
  sun.position.set(-35, 110, 70)
  sun.target.position.set(0, 0, 4)
  sun.castShadow = true
  const sm = coarse ? 1024 : 2048
  sun.shadow.mapSize.set(sm, sm)
  Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 50, bottom: -50, near: 20, far: 260 })
  sun.shadow.bias = -0.0004
  sun.shadow.normalBias = 0.05
  sun.shadow.radius = 3
  scene.add(sun, sun.target)

  // ---------- table (top face at y = 0) with a subtle grid texture ----------
  const gridTex = (() => {
    const c = document.createElement('canvas')
    c.width = 1200; c.height = 700 // 10 px per cm
    const g = c.getContext('2d')!
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height)
    const line = (x0: number, y0: number, x1: number, y1: number, w: number, alpha: number): void => {
      g.strokeStyle = `rgba(0,0,0,${alpha})`; g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke()
    }
    for (let x = 0; x <= 120; x++) line(x * 10, 0, x * 10, 700, x % 10 === 0 ? 2.5 : 1, x % 10 === 0 ? 0.28 : 0.1)
    for (let y = 0; y <= 70; y++) line(0, y * 10, 1200, y * 10, y % 10 === 0 ? 2.5 : 1, y % 10 === 0 ? 0.28 : 0.1)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy())
    return t
  })()
  materials.table.map = gridTex
  materials.table.needsUpdate = true
  const tableGeo = new THREE.BoxGeometry(TABLE.width, TABLE.thickness, TABLE.depth)
  const table = new THREE.Mesh(tableGeo, materials.table)
  table.position.set(TABLE.x, -TABLE.thickness / 2, TABLE.z)
  table.receiveShadow = true
  scene.add(table)

  // ---------- rendering on demand ----------
  let needsRender = true
  let visible = true
  const requestRender = (): void => { needsRender = true }
  controls.addEventListener('change', requestRender)

  // ---------- camera presets ----------
  const poseFor = (name: PresetName): { target: THREE.Vector3; pos: THREE.Vector3 } => {
    const p = PRESETS[name]
    const tan = Math.tan((FOV * Math.PI) / 360)
    const aspect = camera.aspect
    const el = (p.elevation * Math.PI) / 180, az = (p.azimuth * Math.PI) / 180
    // vertical screen extent of a flat table region grows with 1/sin(el): foreshortening shrinks it by sin(el).
    const dist = 1.12 * Math.max(p.halfW / (tan * aspect), p.halfH / (tan * Math.max(Math.sin(el), 0.5)))
    const target = new THREE.Vector3(...p.target)
    const pos = target.clone().add(new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).multiplyScalar(dist))
    if (name === 'top') pos.z += 0.01 // keep a defined "up" for the top-down camera
    return { target, pos }
  }
  let preset: PresetName | null = null
  let anim: { t0: number; fromT: THREE.Vector3; toT: THREE.Vector3; fromP: THREE.Vector3; toP: THREE.Vector3 } | null = null
  const applyPose = (pose: { target: THREE.Vector3; pos: THREE.Vector3 }): void => {
    controls.target.copy(pose.target)
    camera.position.copy(pose.pos)
    camera.lookAt(pose.target)
    controls.update()
    requestRender()
  }
  const setPreset = (name: PresetName): void => {
    preset = name
    const pose = poseFor(name)
    if (ctx.reducedMotion()) { anim = null; applyPose(pose); return }
    anim = { t0: performance.now(), fromT: controls.target.clone(), toT: pose.target, fromP: camera.position.clone(), toP: pose.pos }
    requestRender()
  }
  controls.addEventListener('start', () => { anim = null; preset = null }) // the user took over

  // ---------- parts, builders ----------
  const parts = new PartRegistry(THREE, requestRender)
  const buildCtx: BuildCtx = { scene, three: THREE, materials, parts, units, requestRender }
  const models: BuiltModel[] = BUILDERS.map((b) => b(buildCtx))
  let lastSig = ''
  const signature = (): string => {
    const r = a.readout()
    return `${Object.values(r).join('|')}|${a.windowCover}|${a.beamIntensity}|${a.cathode}`
  }
  const pushState = (): void => {
    const r = a.readout()
    for (const m of models) m.update(r, a)
    requestRender()
  }

  // ---------- size ----------
  const resize = (): void => {
    const w = Math.max(1, container.clientWidth), h = Math.max(1, container.clientHeight)
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    if (preset && !anim) applyPose(poseFor(preset)) // keep the framing while the user has not moved the camera
    requestRender()
  }
  const ro = new ResizeObserver(resize)
  ro.observe(container)
  resize()
  setPreset(opts.initialPreset)
  anim = null
  applyPose(poseFor(opts.initialPreset))
  pushState()

  // ---------- picking (tap without dragging) ----------
  let down: { x: number; y: number; t: number } | null = null
  const onDown = (e: PointerEvent): void => { down = { x: e.clientX, y: e.clientY, t: performance.now() } }
  const onUp = (e: PointerEvent): void => {
    if (!down) return
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y)
    const quick = performance.now() - down.t < 600
    down = null
    if (moved > 6 || !quick) return
    const r = canvas.getBoundingClientRect()
    const id = parts.pick(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1, camera)
    opts.onPick(id)
  }
  canvas.addEventListener('pointerdown', onDown)
  canvas.addEventListener('pointerup', onUp)

  // ---------- theme, visibility, context loss ----------
  const onTheme = (): void => { materials.refresh(); (scene.background as THREE.Color).copy(materials.tokens.plate); requestRender() }
  const mo = new MutationObserver(onTheme)
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  const scheme = matchMedia('(prefers-color-scheme: dark)')
  scheme.addEventListener('change', onTheme)
  const onVis = (): void => { if (!document.hidden) requestRender() }
  document.addEventListener('visibilitychange', onVis)
  const onLost = (e: Event): void => { e.preventDefault(); opts.onFail('context lost') }
  canvas.addEventListener('webglcontextlost', onLost)

  let lastFrame = performance.now()
  return {
    update() {
      if (document.hidden || !visible) return
      const now = performance.now()
      const dt = Math.min(0.1, (now - lastFrame) / 1000)
      lastFrame = now
      const sig = signature()
      if (sig !== lastSig) { lastSig = sig; pushState() }
      for (const m of models) m.tick?.(dt)
      if (anim) {
        const k = Math.min(1, (now - anim.t0) / TRANSITION_MS)
        const e = easeOut(k)
        controls.target.lerpVectors(anim.fromT, anim.toT, e)
        camera.position.lerpVectors(anim.fromP, anim.toP, e)
        camera.lookAt(controls.target)
        if (k >= 1) anim = null
        needsRender = true
      }
      if (controls.update()) needsRender = true // true while damping or moving
      if (needsRender) {
        needsRender = false
        renderer.render(scene, camera)
      }
    },
    setVisible(v) { visible = v; if (v) { resize(); requestRender() } },
    setPreset,
    currentPreset: () => preset,
    focus(list) {
      const ids = list ? parts.forControls(list) : []
      parts.highlight(ids.length ? ids : null)
    },
    highlight: (ids) => parts.highlight(ids),
    destroy() {
      for (const m of models) m.dispose()
      parts.dispose()
      controls.dispose()
      ro.disconnect(); mo.disconnect()
      scheme.removeEventListener('change', onTheme)
      document.removeEventListener('visibilitychange', onVis)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('webglcontextlost', onLost)
      const seen = new Set<THREE.Material>()
      scene.traverse((o) => {
        const m = o as THREE.Mesh
        if (m.geometry) m.geometry.dispose()
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : []
        for (const x of mats) if (!seen.has(x)) { seen.add(x); x.dispose() }
      })
      gridTex.dispose()
      materials.dispose()
      envTex.dispose()
      pmrem.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      canvas.remove()
      probe.remove()
    },
  }
}
