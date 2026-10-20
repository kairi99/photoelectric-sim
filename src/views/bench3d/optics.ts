// Optics of the 3D bench: Hg lamp 1, the compact arrangement 558 79 (parts 2 to 7 inside the tube, the triangular housing
// with the emission window 12 and its dimming slider), the beam and the spectrum, and the swivelling arm 9 carrying
// lens 10 and the photocell 11. All geometry is procedural. Pure maths lives in optics/helpers.ts.
//
// Layout (cm, see units.ts): optical axis y = AXIS_Y, z = AXIS_Z. Lamp x -28.5..-20.5; tube x -19.5..12.5, z -4.5..1.5;
// slider 2 x -18.5, lens 3 x -16.5, slit 4 x -13.2, lens 5 x -6.6, prism 6 x 0.5, mirror 7 x 9. Triangle housing A, B, C
// (helpers.ts). Sockets 8.2 (13.3, 6.5, -4.5) and 8.1 (13.3, 3, 0.5) on the right end wall of the tube.
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type * as THREE from 'three'
import type { Builder } from './builders.ts'
import { opacityFromIntensity } from '../benchkit.ts'
import { LINE_IDS, type LineId } from './materials.ts'
import {
  ARM_LENGTH, ARM_OMEGA, ARM_PIVOT, ARM_Y, ARM_DIR, TRI_A, TRI_B, TRI_C, WINDOW_LEN, WINDOW_U,
  armAimYaw, dampStep, knobAngleRad, windowPoint,
} from './optics/helpers.ts'
import { amiciGeometries, glowTexture, knobGeometry, lensGeometry, ringGeometry, streakTexture } from './optics/geometry.ts'

export { ARM_PIVOT, ARM_DIR, ARM_LENGTH }
/** Marker the interaction phase looks for: `mesh.userData.dragHandle === ARM_DRAG_HANDLE` means "dragging this moves the arm". */
export const ARM_DRAG_HANDLE = 'arm'

const WIN_Y0 = 1.5, WIN_Y1 = 6.1 // window panel height range on edge A-C
const XL = { slider: -18.5, lens3: -16.5, slit: -13.2, lens5: -6.6, prism: 0.5, mirror: 9 }
const LENS_ARM_X = 12.9 // lens 10 along the arm
const CELL_ARM_X = 18.9 // photocell centre along the arm

export const buildOptics: Builder = (ctx) => {
  const { three: T, scene, materials: M, units: U, parts } = ctx
  const own: Array<{ dispose(): void }> = []
  const keep = <D extends { dispose(): void }>(d: D): D => { own.push(d); return d }
  const root = new T.Group()
  root.name = 'optics'
  scene.add(root)
  const AX = U.AXIS_Y, AZ = U.AXIS_Z
  const v3 = (x: number, y: number, z: number): THREE.Vector3 => new T.Vector3(x, y, z)

  // ---------- small construction helpers ----------
  const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D, at?: [number, number, number], shadow = true): THREE.Mesh => {
    keep(geo)
    const m = new T.Mesh(geo, mat)
    if (at) m.position.set(...at)
    m.castShadow = shadow
    m.receiveShadow = shadow
    parent.add(m)
    return m
  }
  const rbox = (w: number, h: number, d: number, mat: THREE.Material, parent: THREE.Object3D, at: [number, number, number], r = 0.1): THREE.Mesh =>
    mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, Math.min(w, h, d) / 2.2)), mat, parent, at)
  const cyl = (r: number, len: number, mat: THREE.Material, parent: THREE.Object3D, at: [number, number, number], axis: 'x' | 'y' | 'z' = 'y', seg = 24): THREE.Mesh => {
    const g = new T.CylinderGeometry(r, r, len, seg)
    if (axis === 'x') g.rotateZ(Math.PI / 2)
    if (axis === 'z') g.rotateX(Math.PI / 2)
    return mesh(g, mat, parent, at)
  }
  /** Box along the segment p0-p1 (xz), between heights y0 and y1; thickness across. Centre line on the segment. */
  const wall = (p0: { x: number; z: number }, p1: { x: number; z: number }, y0: number, y1: number, thick: number, mat: THREE.Material, parent: THREE.Object3D = root): THREE.Mesh => {
    const len = Math.hypot(p1.x - p0.x, p1.z - p0.z)
    const m = rbox(len, y1 - y0, thick, mat, parent, [(p0.x + p1.x) / 2, (y0 + y1) / 2, (p0.z + p1.z) / 2], 0.14)
    m.rotation.y = U.yawToward(p1.x - p0.x, p1.z - p0.z)
    return m
  }

  // ---------- local materials (all disposed in dispose()) ----------
  const std = (p: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial => keep(new T.MeshStandardMaterial(p))
  const lensMat = std({ color: 0xd6ebff, transparent: true, opacity: 0.38, roughness: 0.04, metalness: 0.1, depthWrite: false, envMapIntensity: 1.6 })
  const bulbMat = std({ color: 0xe6f2ff, transparent: true, opacity: 0.2, roughness: 0.04, metalness: 0, depthWrite: false, envMapIntensity: 1.4 })
  const mirrorMat = std({ color: 0xe9eef5, metalness: 1, roughness: 0.04, envMapIntensity: 1.8 })
  const flintMat = std({ color: 0xcfe0ee, transparent: true, opacity: 0.55, roughness: 0.05, metalness: 0.05, depthWrite: false, envMapIntensity: 1.4 })
  const paperMat = std({ color: 0xf2f4f6, transparent: true, opacity: 0.62, roughness: 0.55, metalness: 0, side: T.DoubleSide, depthWrite: false })
  const coverMat = std({ color: 0x151a20, transparent: true, opacity: 0.9, roughness: 0.35, metalness: 0.1 })
  const smokedMat = std({ color: 0x9fb0c0, transparent: true, opacity: 0.16, roughness: 0.1, metalness: 0, depthWrite: false, side: T.DoubleSide })
  const cathodeMat = std({ color: 0x4a3a1a, metalness: 0.7, roughness: 0.45, emissive: 0x000000, emissiveIntensity: 0, side: T.DoubleSide })
  const pinMat = std({ color: 0xb08a2e, metalness: 1, roughness: 0.3 })
  const knobMat = std({ color: 0xc9ced6, metalness: 0.6, roughness: 0.35 })

  // ---------- (1) Hg lamp ----------
  const lamp = new T.Group()
  lamp.name = 'lamp-1'
  root.add(lamp)
  const LX = -24.5, LR = 3.6
  rbox(7, 0.5, 6, M.housing, lamp, [LX, 0.25, AZ], 0.2) // foot
  rbox(3.2, 1.0, 2.6, M.housing, lamp, [LX, 0.8, AZ], 0.2) // stand
  const body = cyl(LR, 8, M.enclosure, lamp, [LX, AX, AZ], 'x', 48)
  body.name = 'lamp-body'
  cyl(LR + 0.12, 0.9, M.enclosure, lamp, [LX - 3.7, AX, AZ], 'x', 48) // rear cap
  const bezelGeo = new T.TorusGeometry(2.9, 0.28, 12, 48)
  bezelGeo.rotateY(Math.PI / 2)
  mesh(bezelGeo, M.metal, lamp, [LX + 4.05, AX, AZ])
  const apGeo = new T.CircleGeometry(2.7, 40)
  apGeo.rotateY(Math.PI / 2)
  mesh(apGeo, M.lampGlow, lamp, [LX + 4.03, AX, AZ], false) // aperture, facing +x
  // vent: a raised plate with slots on top
  rbox(4.6, 0.3, 3.2, M.housing, lamp, [LX - 0.4, AX + LR + 0.05, AZ], 0.1)
  for (let i = 0; i < 5; i++) rbox(0.22, 0.12, 2.5, M.metal, lamp, [LX - 2.2 + i * 0.95, AX + LR + 0.25, AZ], 0.04)
  const glowTex = keep(glowTexture(T))
  const glowMat = keep(new T.SpriteMaterial({ map: glowTex, color: 0xcfe0ff, blending: T.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }))
  const glow = new T.Sprite(glowMat)
  glow.position.set(LX + 4.3, AX, AZ)
  glow.scale.set(11, 11, 1)
  root.add(glow)
  const lampLight = new T.PointLight(0xcfe0ff, 0, 45, 2)
  lampLight.position.set(-19.0, AX, AZ)
  root.add(lampLight)
  parts.registerPart('1', lamp, { labelKey: 'parts.1.name', infoKey: 'parts.1.info', controlId: 'lamp' })

  // ---------- tube housing: floor, back wall, left end wall with aperture, right end wall, lid with a cut-away ----------
  const housing = new T.Group()
  housing.name = 'housing'
  root.add(housing)
  const TX0 = -19.5, TX1 = 12.5, TZ0 = -4.5, TZ1 = 1.5, TH = 9
  rbox(TX1 - TX0, 0.5, TZ1 - TZ0, M.housing, housing, [(TX0 + TX1) / 2, 0.25, (TZ0 + TZ1) / 2], 0.15)
  for (const dz of [-2.2, 0.8]) rbox(TX1 - TX0 - 1, 0.18, 0.5, M.metal, housing, [(TX0 + TX1) / 2, 0.59, AZ + dz], 0.05) // optical-bench rails
  wall({ x: TX0, z: TZ0 + 0.2 }, { x: TX1, z: TZ0 + 0.2 }, 0, TH, 0.4, M.housing, housing) // back wall
  wall({ x: TX1 - 0.2, z: TZ0 }, { x: TX1 - 0.2, z: TZ1 }, 0, TH, 0.4, M.housing, housing) // right end wall (sockets on it)
  { // left end wall with the lamp aperture
    const s = new T.Shape([new T.Vector2(-3, 0), new T.Vector2(3, 0), new T.Vector2(3, TH), new T.Vector2(-3, TH)])
    s.holes.push((() => { const h = new T.Path(); h.absarc(0, AX, 2.75, 0, Math.PI * 2, true); return h })())
    const g = new T.ExtrudeGeometry(s, { depth: 0.4, bevelEnabled: false, curveSegments: 24 })
    g.translate(0, 0, -0.2)
    g.rotateY(Math.PI / 2)
    mesh(g, M.housing, housing, [TX0 + 0.2, 0, (TZ0 + TZ1) / 2])
  }
  // front: a smoked-glass panel at the lamp end; the middle is open towards the triangle (low rail only)
  wall({ x: TX0, z: TZ1 - 0.1 }, { x: TRI_A.x, z: TZ1 - 0.1 }, 0.5, TH, 0.15, smokedMat, housing)
  wall({ x: TRI_A.x, z: TZ1 + 0.1 }, { x: TRI_B.x, z: TZ1 + 0.1 }, 0, 1.2, 0.3, M.housing, housing) // low rail A-B
  // lid: a U-shaped frame leaving a long cut-away over parts 2..7
  rbox(2.0, 0.4, TZ1 - TZ0, M.housing, housing, [TX0 + 1.0, TH - 0.2, (TZ0 + TZ1) / 2], 0.12)
  rbox(2.6, 0.4, TZ1 - TZ0, M.housing, housing, [TX1 - 1.3, TH - 0.2, (TZ0 + TZ1) / 2], 0.12)
  rbox(TX1 - TX0 - 4, 0.4, 0.9, M.housing, housing, [(TX0 + TX1) / 2 - 0.3, TH - 0.2, TZ0 + 0.45], 0.12)

  // ---------- triangular housing A, B, C ----------
  { // floor slab
    const shape = new T.Shape([new T.Vector2(TRI_A.x, -TRI_A.z), new T.Vector2(TRI_B.x, -TRI_B.z), new T.Vector2(TRI_C.x, -TRI_C.z)])
    const g = new T.ExtrudeGeometry(shape, { depth: 0.5, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2 })
    g.rotateX(-Math.PI / 2)
    mesh(g, M.housing, housing)
  }
  // BC: dark band + smoked panel + top rail; AC carries the window (below)
  wall(TRI_B, TRI_C, 0, 1.6, 0.4, M.housing, housing)
  wall(TRI_B, TRI_C, 1.6, TH, 0.1, smokedMat, housing)
  wall(TRI_B, TRI_C, TH - 0.25, TH, 0.4, M.housing, housing)
  for (const c of [TRI_B, TRI_C]) rbox(0.5, TH, 0.5, M.housing, housing, [c.x, TH / 2, c.z], 0.12)

  // ---------- (12) emission window on A-C with the dimming slider ----------
  const win = new T.Group()
  win.name = 'window-12'
  {
    const mid = windowPoint(0.5)
    win.position.set(mid.x, 0, mid.z)
    win.rotation.y = U.yawToward(WINDOW_U.x, WINDOW_U.z) // local +x runs C -> A, local +z points into the triangle
    root.add(win)
  }
  const WW = WINDOW_LEN * 0.94, WH = WIN_Y1 - WIN_Y0, WC = (WIN_Y0 + WIN_Y1) / 2
  rbox(WINDOW_LEN, WIN_Y0, 0.4, M.housing, win, [0, WIN_Y0 / 2, 0], 0.12) // lower band
  rbox(WINDOW_LEN, TH - WIN_Y1 - 0.0, 0.1, smokedMat, win, [0, (TH + WIN_Y1) / 2, 0], 0.02)
  rbox(WINDOW_LEN, 0.3, 0.45, M.housing, win, [0, TH - 0.15, 0], 0.1) // top rail
  rbox(WINDOW_LEN, 0.35, 0.45, M.housing, win, [0, WIN_Y1 + 0.05, 0], 0.1) // rail above the window
  for (const sx of [-1, 1]) rbox(0.5, TH, 0.5, M.housing, win, [sx * (WINDOW_LEN / 2 - 0.1), TH / 2, 0], 0.12)
  mesh(new T.PlaneGeometry(WW, WH), paperMat, win, [0, WC, 0], false) // the translucent paper / plexiglass
  // spectrum spots on the outer face (local -z is outward)
  const streak = keep(streakTexture(T))
  const lineMat = {} as Record<LineId, THREE.MeshBasicMaterial>
  const lineMatInner = {} as Record<LineId, THREE.MeshBasicMaterial>
  const spotMat = {} as Record<LineId, THREE.MeshBasicMaterial>
  const additive = (p: THREE.MeshBasicMaterialParameters = {}): THREE.MeshBasicMaterial =>
    keep(new T.MeshBasicMaterial({ transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, opacity: 0, ...p }))
  const spots = {} as Record<LineId, THREE.Mesh>
  const spotGeo = keep(new T.PlaneGeometry(1.5, 3.6))
  const lambdaOf: Record<LineId, number> = { uv: 365, violet: 405, blue: 436, green: 546, yellow: 578 }
  for (const id of LINE_IDS) {
    spotMat[id] = additive({ map: streak, blending: T.NormalBlending })
    lineMat[id] = additive()
    lineMatInner[id] = additive()
    const s = new T.Mesh(spotGeo, spotMat[id])
    s.position.set(0, WC, -0.28)
    s.rotation.y = Math.PI // face outward (-z)
    s.userData.lambda_nm = lambdaOf[id]
    s.renderOrder = 6
    s.visible = false
    win.add(s)
    spots[id] = s
  }
  // dimming slider: a smoked plate scaled along the window, anchored at the C end, with a grip at its moving edge
  const cover = new T.Group()
  cover.position.set(0, WC, -0.5)
  win.add(cover)
  const coverPlate = mesh(new RoundedBoxGeometry(1, WH + 0.6, 0.16, 2, 0.05), coverMat, cover, [0, 0, 0], false)
  const coverGrip = rbox(0.5, 1.6, 0.5, M.housing, cover, [0, 0, -0.2], 0.12)
  const setCover = (c: number): void => {
    const w = Math.max(0.001, WW * c)
    coverPlate.scale.x = w
    coverPlate.position.x = -WW / 2 + w / 2
    coverGrip.position.x = -WW / 2 + w - 0.35
    cover.visible = c > 0.005
  }
  parts.registerPart('12', win, { labelKey: 'parts.12.name', infoKey: 'parts.12.info', controlId: 'windowCover' })

  // ---------- parts 2 to 7 inside the tube ----------
  const carrier = (parent: THREE.Object3D, x: number, topY: number, width: number): void => {
    rbox(1.6, 0.5, width, M.metal, parent, [x, 0.85, AZ - 0.0], 0.08)
    if (topY > 1.3) rbox(0.5, topY - 1.0, 0.6, M.metal, parent, [x, 1.1 + (topY - 1.1) / 2, AZ], 0.08)
  }
  { // (2) slider: plate with a round opening, a grip on top
    const g2 = new T.Group(); root.add(g2)
    const s = new T.Shape([new T.Vector2(-2.9, 1.0), new T.Vector2(2.9, 1.0), new T.Vector2(2.9, 8.0), new T.Vector2(-2.9, 8.0)])
    s.holes.push((() => { const h = new T.Path(); h.absarc(0, AX, 2.3, 0, Math.PI * 2, true); return h })())
    const g = new T.ExtrudeGeometry(s, { depth: 0.7, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 1, curveSegments: 24 })
    g.translate(0, 0, -0.35)
    g.rotateY(Math.PI / 2)
    mesh(g, M.rubber, g2, [XL.slider, 0, AZ])
    rbox(0.8, 1.2, 1.8, M.metal, g2, [XL.slider, 8.4, AZ], 0.15)
    parts.registerPart('2', g2, { labelKey: 'parts.2.name', infoKey: 'parts.2.info', controlId: 'beam' })
  }
  const lensAssembly = (id: '3' | '5', x: number, r: number): void => {
    const g = new T.Group(); root.add(g)
    mesh(lensGeometry(T, r, 0.3, 0.55), lensMat, g, [x, AX, AZ], false)
    mesh(ringGeometry(T, r + 0.14, 0.2), M.metal, g, [x, AX, AZ])
    carrier(g, x, AX - r - 0.2, 4)
    parts.registerPart(id, g, { labelKey: `parts.${id}.name`, infoKey: `parts.${id}.info` })
  }
  lensAssembly('3', XL.lens3, 2.5)
  lensAssembly('5', XL.lens5, 2.4)
  { // (4) slit: two jaws with a gap, in a frame
    const g = new T.Group(); root.add(g)
    for (const sz of [-1, 1]) rbox(0.5, 5.4, 2.0, M.housing, g, [XL.slit, AX, AZ + sz * 1.15], 0.06)
    rbox(0.7, 0.4, 4.6, M.metal, g, [XL.slit, AX + 2.9, AZ], 0.08)
    rbox(0.7, 0.4, 4.6, M.metal, g, [XL.slit, AX - 2.9, AZ], 0.08)
    carrier(g, XL.slit, AX - 3.1, 4.6)
    parts.registerPart('4', g, { labelKey: 'parts.4.name', infoKey: 'parts.4.info' })
  }
  const PRISM = { L: 4, W: 3.4, H: 4.2 }
  { // (6) direct-vision prism: three glued prisms (crown, flint, crown) on a base
    const g = new T.Group(); root.add(g)
    const { crowns, flint } = amiciGeometries(T, PRISM.L, PRISM.W, PRISM.H)
    mesh(crowns, M.glass, g, [XL.prism, AX, AZ], false)
    mesh(flint, flintMat, g, [XL.prism, AX, AZ], false)
    rbox(PRISM.L + 0.8, 0.5, PRISM.W + 0.8, M.metal, g, [XL.prism, AX - PRISM.H / 2 - 0.25, AZ], 0.1)
    rbox(0.5, AX - PRISM.H / 2 - 0.7, 0.6, M.metal, g, [XL.prism, (AX - PRISM.H / 2 - 0.5) / 2 + 0.6, AZ], 0.06)
    parts.registerPart('6', g, { labelKey: 'parts.6.name', infoKey: 'parts.6.info' })
  }
  // (7) mirror: front-surface mirror in a holder, normal bisecting the incoming beam (+x) and the outgoing one (towards the window)
  const MIRROR = v3(XL.mirror, AX, AZ)
  const winMid = windowPoint(0.5)
  const outDir = v3(winMid.x - MIRROR.x, ARM_Y - MIRROR.y, winMid.z - MIRROR.z).normalize()
  const mirrorN = outDir.clone().sub(v3(1, 0, 0)).normalize()
  const mirrorTan = v3(-mirrorN.z, 0, mirrorN.x).normalize()
  {
    const g = new T.Group(); root.add(g)
    const plate = new T.Group()
    plate.position.copy(MIRROR)
    plate.quaternion.setFromUnitVectors(v3(0, 0, 1), mirrorN)
    g.add(plate)
    mesh(new RoundedBoxGeometry(4.6, 4.8, 0.3, 2, 0.12), M.metal, plate, [0, 0, -0.22])
    mesh(new RoundedBoxGeometry(3.9, 4.1, 0.08, 1, 0.03), mirrorMat, plate, [0, 0, -0.02], false)
    mesh(new T.CylinderGeometry(0.28, 0.28, AX - 2.4, 14), M.metal, g, [XL.mirror + 0.8, (AX - 2.4) / 2 + 0.55, AZ - 0.9])
    rbox(2, 0.5, 2, M.metal, g, [XL.mirror + 0.8, 0.85, AZ - 0.9], 0.1)
    parts.registerPart('7', g, { labelKey: 'parts.7.name', infoKey: 'parts.7.info' })
  }

  // ---------- sockets 8.2 (4 mm) and 8.1 (BNC) on the right end wall ----------
  {
    const g2 = new T.Group(); root.add(g2)
    cyl(0.62, 1.6, M.rubber, g2, [13.3, 6.5, -4.5], 'x', 20)
    cyl(0.3, 0.2, M.metal, g2, [14.15, 6.5, -4.5], 'x', 16)
    parts.registerPart('8.2', g2, { labelKey: 'parts.8.2.name', infoKey: 'parts.8.2.info' })
    const g1 = new T.Group(); root.add(g1)
    cyl(0.85, 1.6, M.metal, g1, [13.3, 3, 0.5], 'x', 28)
    cyl(0.5, 0.3, M.rubber, g1, [14.15, 3, 0.5], 'x', 20)
    cyl(0.12, 0.5, pinMat, g1, [14.25, 3, 0.5], 'x', 8)
    for (const s of [-1, 1]) cyl(0.12, 0.3, M.metal, g1, [13.6, 3 + s * 0.95, 0.5], 'y', 8)
    parts.registerPart('8.1', g1, { labelKey: 'parts.8.1.name', infoKey: 'parts.8.1.info' })
  }

  // ---------- beams ----------
  const beams = new T.Group()
  beams.name = 'beams'
  root.add(beams)
  /** A tapered translucent cone between two points; `layers` give a soft edge (radius factor, material). */
  const coneRig = (layers: Array<{ f: number; mat: THREE.Material }>, userData?: Record<string, unknown>) => {
    const meshes = layers.map(({ mat }) => {
      const m = new T.Mesh(new T.BufferGeometry(), mat)
      m.renderOrder = 5
      m.frustumCulled = false
      if (userData) Object.assign(m.userData, userData)
      beams.add(m)
      return m
    })
    let key = ''
    const dir = new T.Vector3(), up = v3(0, 1, 0)
    return {
      meshes,
      set(p0: THREE.Vector3, p1: THREE.Vector3, r0: number, r1: number): void {
        const k = [p0, p1].map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)}`).join('|') + `|${r0.toFixed(2)}|${r1.toFixed(2)}`
        if (k === key) return
        key = k
        dir.copy(p1).sub(p0)
        const len = dir.length()
        dir.normalize()
        layers.forEach(({ f }, i) => {
          const m = meshes[i]!
          m.geometry.dispose()
          m.geometry = new T.CylinderGeometry(Math.max(0.001, r1 * f), Math.max(0.001, r0 * f), len, 18, 1, true)
          m.position.copy(p0).addScaledVector(dir, len / 2)
          m.quaternion.setFromUnitVectors(up, dir)
        })
      },
      setVisible(v: boolean): void { for (const m of meshes) m.visible = v },
      dispose(): void { for (const m of meshes) m.geometry.dispose() },
    }
  }
  const whiteOuter = additive({ color: 0xfff2dc }), whiteInner = additive({ color: 0xfff6e8 })
  const whiteSegs: Array<ReturnType<typeof coneRig>> = []
  const white = (x0: number, r0: number, x1: number, r1: number): void => {
    const c = coneRig([{ f: 1, mat: whiteOuter }, { f: 0.55, mat: whiteInner }])
    c.set(v3(x0, AX, AZ), v3(x1, AX, AZ), r0, r1)
    whiteSegs.push(c)
  }
  // lamp -> lens 3 -> slit (focus) -> lens 5 -> prism: the white beam
  const PRISM_OUT = v3(XL.prism + PRISM.L / 2, AX, AZ)
  const midSpot = v3(winMid.x, ARM_Y, winMid.z)
  const pathTotal = PRISM_OUT.x - XL.lens5 + PRISM_OUT.distanceTo(MIRROR) + MIRROR.distanceTo(midSpot)
  const rPrism = 2.2 * (1 - (PRISM_OUT.x - XL.lens5) / pathTotal)
  white(-20.5, 2.4, XL.lens3, 2.45)
  white(XL.lens3, 2.45, XL.slit, 0.12)
  white(XL.slit, 0.12, XL.lens5, 2.2)
  white(XL.lens5, 2.2, PRISM_OUT.x, rPrism)
  // after the prism: one narrowing cone per spectral line, bent at the mirror, ending in its image on the window
  const fan = {} as Record<LineId, { a: ReturnType<typeof coneRig>; b: ReturnType<typeof coneRig> }>
  const lineKey = {} as Record<LineId, string>
  for (const id of LINE_IDS) {
    const ud = { lambda_nm: lambdaOf[id] }
    fan[id] = {
      a: coneRig([{ f: 1, mat: lineMat[id] }, { f: 0.5, mat: lineMatInner[id] }], ud),
      b: coneRig([{ f: 1, mat: lineMat[id] }, { f: 0.5, mat: lineMatInner[id] }], ud),
    }
    fan[id].a.setVisible(false); fan[id].b.setVisible(false)
    lineKey[id] = ''
  }
  const placeLine = (id: LineId, t: number): void => {
    const key = t.toFixed(4)
    if (lineKey[id] === key) return
    lineKey[id] = key
    const wp = windowPoint(t)
    // the spot sits at local x along the window edge
    spots[id].position.x = (t - 0.5) * WINDOW_LEN
    const spot = v3(wp.x - 0.0, ARM_Y, wp.z)
    const m = MIRROR.clone().addScaledVector(mirrorTan, (t - 0.5) * 1.2)
    const la = PRISM_OUT.distanceTo(m), lb = m.distanceTo(spot)
    const r0 = rPrism, r1 = 0.14
    const rm = r0 + (r1 - r0) * (la / (la + lb))
    fan[id].a.set(PRISM_OUT, m, r0, rm)
    fan[id].b.set(m, spot, rm, r1)
  }

  // ---------- (9) swivelling arm with (10) lens + slit diaphragm and (11) the photocell ----------
  const arm = new T.Group()
  arm.name = 'arm-9'
  arm.position.set(ARM_PIVOT.x, 0, ARM_PIVOT.z)
  root.add(arm)
  const BAR_Y = 2.0
  cyl(1.1, 2.4, M.metal, arm, [0, 1.4, 0], 'y', 28) // pivot hub
  cyl(0.55, 0.3, M.housing, arm, [0, 2.75, 0], 'y', 20)
  rbox(CELL_ARM_X - 0.6, 0.55, 0.9, M.metal, arm, [(CELL_ARM_X - 0.6) / 2 + 0.2, BAR_Y, 0], 0.12) // bar
  // thread-guide knob: a stem, a knurled knob; spins in proportion to the arm position
  const KNOB_X = 5.6
  cyl(0.28, 1.9, M.metal, arm, [KNOB_X, BAR_Y + 1.1, 0], 'y', 12)
  const knob = mesh(knobGeometry(T, 1.15, 1.5), knobMat, arm, [KNOB_X, BAR_Y + 2.45, 0])
  knob.name = 'arm-knob'
  rbox(0.18, 0.12, 0.8, M.housing, knob, [0.45, 0.78, 0], 0.03) // pointer notch on top
  knob.userData.dragHandle = ARM_DRAG_HANDLE
  knob.traverse((o) => { o.userData.dragHandle = ARM_DRAG_HANDLE })
  // (10) converging lens with a slit diaphragm
  const lens10 = new T.Group()
  lens10.position.set(LENS_ARM_X, 0, 0)
  arm.add(lens10)
  mesh(lensGeometry(T, 1.4, 0.25, 0.5), lensMat, lens10, [0, ARM_Y, 0], false)
  mesh(ringGeometry(T, 1.52, 0.17), M.metal, lens10, [0, ARM_Y, 0])
  rbox(0.35, 3.4, 0.9, M.housing, lens10, [0.7, ARM_Y, -1.35], 0.06) // diaphragm plate, left of the slit
  rbox(0.35, 3.4, 0.9, M.housing, lens10, [0.7, ARM_Y, 1.35], 0.06)
  rbox(0.9, ARM_Y - 1.5 - BAR_Y, 0.7, M.metal, lens10, [0, (BAR_Y + ARM_Y - 1.5) / 2 + 0.2, 0], 0.08)
  parts.registerPart('10', lens10, { labelKey: 'parts.10.name', infoKey: 'parts.10.info' })
  // (11) photocell: glass bulb on a socket, potassium cathode half shell at the far side, ring anode in front
  const cell = new T.Group()
  cell.position.set(CELL_ARM_X, 0, 0)
  arm.add(cell)
  const bulbGeo = new T.SphereGeometry(1.5, 28, 18)
  bulbGeo.scale(1.1, 1, 1)
  mesh(bulbGeo, bulbMat, cell, [0, ARM_Y, 0], false)
  const capGeo = new T.SphereGeometry(1.1, 22, 10, 0, Math.PI * 2, 0, Math.PI / 2)
  capGeo.rotateZ(-Math.PI / 2) // pole towards +x: the cathode faces the light from -x
  mesh(capGeo, cathodeMat, cell, [0.25, ARM_Y, 0], false)
  const anodeGeo = new T.TorusGeometry(0.62, 0.045, 8, 32)
  anodeGeo.rotateY(Math.PI / 2)
  mesh(anodeGeo, pinMat, cell, [-0.35, ARM_Y, 0], false)
  cyl(0.03, 1.5, pinMat, cell, [-0.35, ARM_Y - 0.75 - 0.25, 0.62], 'y', 6) // anode lead
  cyl(0.9, 0.9, M.rubber, cell, [-0.1, ARM_Y - 1.75, 0], 'y', 20) // socket
  rbox(2.8, 0.45, 2.2, M.metal, cell, [0, BAR_Y + 0.1, 0], 0.1)
  parts.registerPart('11', cell, { labelKey: 'parts.11.name', infoKey: 'parts.11.info', controlId: 'cathode' })
  parts.registerPart('9', arm, { labelKey: 'parts.9.name', infoKey: 'parts.9.info', controlId: 'arm' })
  // the line that reaches the cathode: from lens 10 onto the cathode, drawn in the colour of the strongest overlapping line
  const cellOuter = additive({ color: 0xffffff }), cellInner = additive({ color: 0xffffff })
  const cellBeam = coneRig([{ f: 1, mat: cellOuter }, { f: 0.5, mat: cellInner }])
  cellBeam.setVisible(false)

  // ---------- labels: small number tags, shown only when the camera is near (optics views) or looking down (top view) ----------
  const labels: THREE.Sprite[] = []
  const labelMats: THREE.SpriteMaterial[] = []
  const label = (text: string, parent: THREE.Object3D, at: [number, number, number]): void => {
    const c = document.createElement('canvas')
    c.width = 96; c.height = 48
    const g = c.getContext('2d')!
    g.fillStyle = 'rgba(12,16,22,0.62)'; g.beginPath(); g.roundRect(3, 3, 90, 42, 12); g.fill()
    g.fillStyle = '#f4f6f8'; g.font = '600 28px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'
    g.fillText(text, 48, 25)
    const tex = keep(new T.CanvasTexture(c))
    tex.colorSpace = T.SRGBColorSpace
    const mat = keep(new T.SpriteMaterial({ map: tex, depthTest: false, transparent: true, opacity: 0.8 }))
    const s = new T.Sprite(mat)
    s.scale.set(2.6, 1.3, 1)
    s.position.set(...at)
    s.renderOrder = 12
    s.onBeforeRender = (_r, _s, cam) => {
      const p = cam.position
      const d = Math.hypot(p.x + 3, p.y - 3, p.z - 4)
      const top = (p.y - 3) / d > 0.97
      mat.opacity = d < 78 || top ? 0.8 : 0
    }
    parent.add(s)
    labels.push(s); labelMats.push(mat)
  }
  label('1', root, [-24.5, 10.4, AZ]); label('2', root, [XL.slider, 10.4, AZ]); label('3', root, [XL.lens3, 10.4, AZ])
  label('4', root, [XL.slit, 10.4, AZ]); label('5', root, [XL.lens5, 10.4, AZ]); label('6', root, [XL.prism, 10.4, AZ])
  label('7', root, [XL.mirror, 10.4, AZ]); label('8.2', root, [14.4, 8.2, -4.5]); label('8.1', root, [14.4, 4.7, 0.5])
  label('12', root, [winMid.x - 2.4, 10.4, winMid.z + 1.0])
  label('9', arm, [KNOB_X, 8.4, 0]); label('10', lens10, [0, 6.6, 0]); label('11', cell, [0, 6.6, 0])

  // ---------- state ----------
  const reduced = (): boolean => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false } }
  let armPos = 0.5, armVel = 0, armTarget = 0.5, armInit = false
  let cellDom: LineId | null = null, cellStrength = 0
  const lensW = v3(0, 0, 0), cathW = v3(0, 0, 0)
  const applyArm = (): void => {
    arm.rotation.y = armAimYaw(armPos)
    knob.rotation.y = knobAngleRad(armPos)
    arm.updateMatrixWorld(true)
    lensW.set(0.4, ARM_Y, 0); lens10.localToWorld(lensW)
    cathW.set(0.3 + 1.0, ARM_Y, 0); cell.localToWorld(cathW)
    const on = cellDom !== null && cellStrength > 0.02
    cellBeam.setVisible(on)
    if (on) {
      cellBeam.set(lensW, cathW, 0.9, 0.35)
      cellOuter.color.copy(M.line[cellDom!].color); cellInner.color.copy(M.line[cellDom!].color)
      const o = opacityFromIntensity(cellStrength)
      cellOuter.opacity = 0.22 * o; cellInner.opacity = 0.55 * o
    }
    ctx.requestRender()
  }

  const model: ReturnType<Builder> = {
    update(r, a) {
      const b = r.lampOn ? Math.max(0, Math.min(1, r.lampBrightness)) : 0
      M.setLampGlow(b)
      glowMat.opacity = 0.5 * b
      lampLight.intensity = 70 * b
      const beamF = r.mode === 'explore' ? a.beamIntensity : 1
      const s = b * beamF
      const lit = s > 0.01
      for (const c of whiteSegs) c.setVisible(lit)
      whiteOuter.opacity = 0.04 * Math.min(1, s); whiteInner.opacity = 0.09 * Math.min(1, s)

      // the spectrum on the window and the cone of every line
      const spec = a.spectrumOnWindow()
      const dom = { id: null as LineId | null, w: 0 }
      let sum = 0
      for (const l of spec) {
        const id = l.id as LineId
        const show = lit && l.reachable && l.intensity > 0.003 && (id !== 'uv' || r.mode === 'explore')
        const o = opacityFromIntensity(l.intensity) * (id === 'uv' ? 0.55 : 1)
        spots[id].visible = show
        fan[id].a.setVisible(show); fan[id].b.setVisible(show)
        if (!l.reachable) continue
        placeLine(id, l.position)
        const col = M.line[id].color
        spotMat[id].color.copy(col); lineMat[id].color.copy(col); lineMatInner[id].color.copy(col)
        spotMat[id].opacity = o
        lineMat[id].opacity = 0.05 * o; lineMatInner[id].opacity = 0.12 * o
        if (show) {
          const w = l.overlap * l.intensity
          sum += w
          if (w > dom.w) { dom.w = w; dom.id = id }
        }
      }
      cellDom = dom.id; cellStrength = sum
      cathodeMat.emissive.copy(dom.id ? M.line[dom.id].color : new T.Color(0))
      cathodeMat.emissiveIntensity = Math.min(1.4, 1.8 * Math.sqrt(sum))
      setCover(a.windowCover)

      armTarget = r.armPosition
      if (!armInit || reduced()) { armPos = armTarget; armVel = 0; armInit = true }
      applyArm()
    },
    tick(dt) {
      if (Math.abs(armPos - armTarget) < 1e-4 && Math.abs(armVel) < 1e-3) {
        if (armPos !== armTarget) { armPos = armTarget; armVel = 0; applyArm() }
        return
      }
      if (reduced()) { armPos = armTarget; armVel = 0 } else {
        const s = dampStep(armPos, armVel, armTarget, ARM_OMEGA, dt)
        armPos = s.x; armVel = s.v
      }
      applyArm()
    },
    dispose() {
      for (const c of whiteSegs) c.dispose()
      for (const id of LINE_IDS) { fan[id].a.dispose(); fan[id].b.dispose() }
      cellBeam.dispose()
      for (const o of own) o.dispose()
      scene.remove(root)
    },
  }
  setCover(0)
  return model
}
