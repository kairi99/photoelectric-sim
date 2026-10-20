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
import { createInteraction } from './interaction.ts'
import { fill } from '../benchkit.ts'
import { strings as benchStrings } from '../strings/bench.ts'
import { lookup, strings as bench3dStrings } from '../strings/bench3d.ts'
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
  overview: { target: [2, 2, 9], azimuth: 0, elevation: 36, halfW: 43, halfH: 20 },
  optics: { target: [-3, 3, 4], azimuth: -8, elevation: 38, halfW: 24, halfH: 11 },
  meter: { target: [38.5, 4, 12.5], azimuth: 12, elevation: 28, halfW: 10, halfH: 6.5 },
  top: { target: [1, 0, 8], azimuth: 0, elevation: 89, halfW: 48, halfH: 21 },
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
  /** Redraw text on textures and re-read the aria-label after a language change. */
  relabel(): void
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
  canvas.tabIndex = 0 // focusable: arrow keys orbit; the control panel operates the same parts
  canvas.setAttribute('role', 'application')
  canvas.setAttribute('aria-label', bench3dStrings[ctx.lang()].canvasLabel)
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

  const hemi = new THREE.HemisphereLight(0xcfe0ff, 0x20242c, 0.45)
  scene.add(hemi)
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

  // ---------- room lights: 0 = lit, 1 = dark room, eased over ~300 ms (instant with reduced motion) ----------
  const DIM_LEVEL = 0.15 // fraction of the room-light intensity that is left in the dark room
  const HEMI_I = 0.45, SUN_I = 2.2, ENV_I = 0.9
  const roomTarget = (): number => (a.roomLights ? 0 : 1)
  let darkness = roomTarget()
  const applyLighting = (): void => {
    const level = 1 - (1 - DIM_LEVEL) * darkness
    hemi.intensity = HEMI_I * level
    sun.intensity = SUN_I * level
    scene.environmentIntensity = ENV_I * level
    ;(scene.background as THREE.Color).copy(materials.tokens.plate).multiplyScalar(1 - 0.55 * darkness)
  }
  applyLighting()
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
  let lastPreset: PresetName | null = opts.initialPreset
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
    lastPreset = name
    requestRender()
    const pose = poseFor(name)
    if (ctx.reducedMotion()) { anim = null; applyPose(pose); return }
    anim = { t0: performance.now(), fromT: controls.target.clone(), toT: pose.target, fromP: camera.position.clone(), toP: pose.pos }
    requestRender()
  }
  const userTookOver = (): void => { anim = null; preset = null } // the user took over (lastPreset is kept: it drives the number tags)
  controls.addEventListener('start', userTookOver)

  // ---------- parts, builders ----------
  const parts = new PartRegistry(THREE, requestRender)
  let hovering = false
  const buildCtx: BuildCtx = { scene, three: THREE, materials, parts, units, requestRender, darkness: () => darkness, lang: ctx.lang, preset: () => lastPreset, hovering: () => hovering }
  const models: BuiltModel[] = BUILDERS.map((b) => b(buildCtx))
  let lastSig = ''
  const signature = (): string => {
    const r = a.readout()
    return `${Object.values(r).join('|')}|${a.windowCover}|${a.beamIntensity}|${a.cathode}|${a.roomLights}`
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

  // ---------- direct manipulation: handles, hover, tooltips, keyboard (interaction.ts) ----------
  const interaction = createInteraction({
    three: THREE, container, canvas, camera, controls, scene, parts, actions: a,
    accent: () => materials.cable.blue.color, // --accent
    reducedMotion: ctx.reducedMotion,
    requestRender,
    onInfo: (id) => opts.onPick(id),
    onHover: (h) => { if (h !== hovering) { hovering = h; requestRender() } },
    onUserCamera: userTookOver,
    partName: (id) => lookup(bench3dStrings[ctx.lang()], `parts.${id}.name`),
    armReadout: () => {
      const B = benchStrings[ctx.lang()]
      const id = a.lineOnCell()
      if (!id) return B.between
      const nm = a.spectrumOnWindow().find((l) => l.id === id)?.lambda_nm ?? 0
      return fill(B.lineNm, { name: B.lines[id], nm: Math.round(nm) })
    },
    debug: new URLSearchParams(location.search).get('debug3d') === '1',
  })

  // ---------- theme, visibility, context loss ----------
  const onTheme = (): void => { materials.refresh(); interaction.refreshTheme(); applyLighting(); requestRender() }
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
      if (darkness !== roomTarget()) {
        const t = roomTarget()
        darkness = ctx.reducedMotion() ? t : Math.abs(t - darkness) < 0.02 ? t : darkness + Math.sign(t - darkness) * Math.min(Math.abs(t - darkness), dt / 0.3)
        applyLighting()
        pushState() // beams, glow and the dial follow the room darkness
      }
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
      if (interaction.tick(dt)) needsRender = true
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
      interaction.setFocus(ids)
    },
    relabel() {
      canvas.setAttribute('aria-label', bench3dStrings[ctx.lang()].canvasLabel)
      for (const m of models) m.relabel?.()
      requestRender()
    },
    highlight: (ids) => parts.highlight(ids),
    destroy() {
      interaction.destroy()
      for (const m of models) m.dispose()
      parts.dispose()
      controls.dispose()
      ro.disconnect(); mo.disconnect()
      scheme.removeEventListener('change', onTheme)
      document.removeEventListener('visibilitychange', onVis)
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
