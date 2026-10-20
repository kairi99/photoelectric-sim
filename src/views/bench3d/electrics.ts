// Electrics of the 3D bench (leaflet Fig. 2, right half): universal choke 451 30, electrometer amplifier 532 14 with the
// 100 pF capacitor and the key on plug-in blocks, the 12 V~ plug-in supply, the analog multimeter 531 120 and all cables.
// Procedural geometry only. Coordinates: see ./electrics/layout.ts and ../units.ts (cm, y up, table top y = 0).
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type * as THREE from 'three'
import type { MeterRange } from '../../apparatus/index.ts'
import type { Builder } from './builders.ts'
import { needleAngleDeg } from '../benchkit.ts'
import { cableCurve } from './electrics/cableCurve.ts'
import { drawAmpPlate, drawDial, drawKnobPlate, drawLabel } from './electrics/dial.ts'
import { easeTo, stepNeedle, type Spring } from './electrics/dynamics.ts'
import {
  AMP, BLOCK_SOCKET_Y, CABLES, CAP_BLOCK, KEY_BLOCK, SUPPLY_BOX, DIAL_CM, DIAL_PIVOT_CM, DIAL_PX, METER, METER_FACE, METER_KNOB_V, METER_TERMINALS, PLATE, PLATE_CM,
  SOCKET_FRONT, knobAngleDeg, needleTargetFraction,
} from './electrics/layout.ts'

const DEG = Math.PI / 180

export const buildElectrics: Builder = (ctx) => {
  const { three: T, scene, materials: M } = ctx
  const dispose: Array<{ dispose(): void }> = []
  const track = <X extends { dispose(): void }>(x: X): X => { dispose.push(x); return x }
  const root = new T.Group()
  root.name = 'electrics'
  scene.add(root)

  // ---------------------------------------------------------------- small helpers
  const rbox = (w: number, h: number, d: number, r: number, seg = 3): THREE.BufferGeometry => track(new RoundedBoxGeometry(w, h, d, seg, r))
  const box = (w: number, h: number, d: number): THREE.BufferGeometry => track(new T.BoxGeometry(w, h, d))
  /** Cylinder whose axis is z (pointing out of a front face). */
  const cylZ = (rad: number, len: number, seg = 20): THREE.BufferGeometry => track(new T.CylinderGeometry(rad, rad, len, seg).rotateX(Math.PI / 2))
  const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, shadow = true): THREE.Mesh => {
    const m = new T.Mesh(geo, mat)
    m.position.set(x, y, z)
    m.castShadow = shadow
    m.receiveShadow = true
    parent.add(m)
    return m
  }
  const std = (p: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial => track(new T.MeshStandardMaterial(p))
  const canvasTex = (w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): { tex: THREE.CanvasTexture; g: CanvasRenderingContext2D } => {
    const c = document.createElement('canvas')
    c.width = w; c.height = h
    const g = c.getContext('2d')!
    draw(g)
    const tex = track(new T.CanvasTexture(c))
    tex.colorSpace = T.SRGBColorSpace
    tex.anisotropy = 16 // clamped by the renderer to what the GPU supports
    return { tex, g }
  }
  const printed = (map: THREE.Texture, emissive = 0): THREE.MeshStandardMaterial =>
    std({ map, roughness: 0.85, metalness: 0, ...(emissive ? { emissive: 0xffffff, emissiveMap: map, emissiveIntensity: emissive } : {}) })

  const yellow = std({ color: 0xd9ac22, roughness: 0.55, metalness: 0.02 })
  const dark = std({ color: 0x1b1d21, roughness: 0.6, metalness: 0.1 })
  const white = std({ color: 0xf0eee8, roughness: 0.5, metalness: 0 })
  const blueBody = std({ color: 0x2a5aa8, roughness: 0.45, metalness: 0.05 })

  /** A 4 mm socket (z axis, protrudes 0.45 from the surface at z0) and a BNC socket. */
  const socket4 = (parent: THREE.Object3D, x: number, y: number, z0: number, body: THREE.Material): void => {
    add(parent, cylZ(0.5, SOCKET_FRONT - 0.05), body, x, y, z0 + (SOCKET_FRONT - 0.05) / 2)
    add(parent, cylZ(0.3, 0.06, 14), M.metal, x, y, z0 + SOCKET_FRONT - 0.02, false)
    add(parent, track(new T.CircleGeometry(0.17, 12)), dark, x, y, z0 + SOCKET_FRONT + 0.012, false)
  }
  const socketBnc = (parent: THREE.Object3D, x: number, y: number, z0: number): void => {
    add(parent, cylZ(0.78, SOCKET_FRONT - 0.05, 24), M.metal, x, y, z0 + (SOCKET_FRONT - 0.05) / 2)
    add(parent, cylZ(0.5, 0.08, 20), dark, x, y, z0 + SOCKET_FRONT - 0.01, false)
    add(parent, cylZ(0.1, 0.1, 8), M.metal, x, y, z0 + SOCKET_FRONT, false)
  }

  /** 4 mm contact socket on the back face (towards the amplifier) of a plug-in block, z0 = half depth of the block. */
  const backSocket = (block: THREE.Object3D, z0: number): void => {
    const g = new T.Group()
    g.position.set(0, BLOCK_SOCKET_Y, -z0)
    g.rotation.y = Math.PI
    block.add(g)
    socket4(g, 0, 0, 0, dark)
  }

  // ================================================================ universal choke 451 30
  const choke = new T.Group()
  choke.position.set(-37.2, 0, 0)
  root.add(choke)
  add(choke, rbox(13.5, 13, 14.4, 0.9), M.enclosure, 0, 6.5, 0)
  const slotGeo = box(0.28, 0.12, 8)
  for (let i = 0; i < 7; i++) add(choke, slotGeo, dark, -4.2 + i * 1.4, 13.0, 0, false)
  const cz = 7.2 // front face
  // fuse holder: knurled cap with a screwdriver slot
  add(choke, cylZ(1.3, 0.9, 28), dark, -3.4, 9.3, cz + 0.4)
  add(choke, cylZ(1.5, 0.15, 28), M.metal, -3.4, 9.3, cz + 0.05, false)
  add(choke, box(1.9, 0.3, 0.16), M.metal, -3.4, 9.3, cz + 0.9, false)
  const chokeLabel = canvasTex(512, 224, (g) => drawLabel(g, 512, 224, ['451 30', '230 V ~'], '#f2f0ea', '#1b1d21'))
  add(choke, track(new T.PlaneGeometry(5.4, 2.36)), printed(chokeLabel.tex), 2.6, 9.6, cz + 0.012, false)
  socket4(choke, 3.8, 4.2, cz, dark)
  socket4(choke, 1.4, 4.2, cz, M.cable.red)
  add(choke, rbox(12.4, 0.5, 0.2, 0.1, 2), M.metal, 0, 1.4, cz + 0.02, false) // trim line below the sockets
  // power rocker switch: tilts in when the lamp is on; clicking it (or the lamp) toggles the lamp
  const rocker = new T.Group()
  rocker.position.set(-4.0, 4.6, cz)
  choke.add(rocker)
  add(rocker, rbox(2.5, 3.4, 0.3, 0.2, 2), dark, 0, 0, 0.1)
  const rockerOnMat = std({ color: 0xc43a2a, roughness: 0.45, emissive: 0x000000 })
  const rockerPaddle = new T.Group()
  rockerPaddle.position.set(0, 0, 0.3)
  rocker.add(rockerPaddle)
  const paddle = add(rockerPaddle, rbox(1.8, 2.7, 0.7, 0.25, 2), rockerOnMat, 0, 0, 0.2)
  paddle.name = 'choke-rocker'
  add(rocker, track(new T.CircleGeometry(0.14, 12)), white, 0, -2.2, 0.26, false) // I / O hint dots
  add(rocker, track(new T.RingGeometry(0.1, 0.18, 14)), white, 0, 2.2, 0.26, false)
  const rockerHit = add(rocker, box(3.2, 4.2, 1.4), track(new T.MeshBasicMaterial({ visible: false })), 0, 0, 0.5, false)
  rockerHit.name = 'choke-rocker-hit'
  for (const m of [paddle, rockerHit]) m.userData.clickHandle = 'lamp'
  ctx.parts.registerPart('choke', choke, { labelKey: 'parts.choke.name', infoKey: 'parts.choke.info' })

  // ================================================================ electrometer amplifier 532 14
  const amp = new T.Group()
  amp.position.set(AMP.x, 0, AMP.z)
  root.add(amp)
  add(amp, rbox(AMP.w, AMP.h, AMP.d, 0.7), M.housing, 0, AMP.h / 2, 0)
  const pz = AMP.d / 2 + 0.012
  const plate = canvasTex(1024, Math.round((1024 * PLATE_CM.h) / PLATE_CM.w), (g) => drawAmpPlate(g, 1024, Math.round((1024 * PLATE_CM.h) / PLATE_CM.w)))
  add(amp, track(new T.PlaneGeometry(PLATE_CM.w, PLATE_CM.h)), printed(plate.tex), 0, AMP.h / 2, pz, false)
  const at = (p: { u: number; v: number }): [number, number, number] => [p.u, AMP.h / 2 + p.v, AMP.d / 2]
  socketBnc(amp, ...at(PLATE.bnc))
  socket4(amp, ...at(PLATE.groundA), dark)
  socket4(amp, ...at(PLATE.capIn), dark)
  socket4(amp, ...at(PLATE.keyIn), dark)
  socket4(amp, ...at(PLATE.supply), dark)
  socket4(amp, ...at(PLATE.outRed), M.cable.red)
  socket4(amp, ...at(PLATE.outBlue), M.cable.blue)
  { // earth socket on the right side face (turned to face +x)
    const side = new T.Group()
    side.position.set(AMP.w / 2, 3, 0.2)
    side.rotation.y = Math.PI / 2
    amp.add(side)
    socket4(side, 0, 0, 0, std({ color: 0x8cc719, roughness: 0.5 }))
  }
  { // offset knob
    const [x, y, z] = at(PLATE.offset)
    add(amp, cylZ(0.62, 0.5, 28), dark, x, y, z + 0.25)
    add(amp, box(0.1, 0.5, 0.06), white, x, y + 0.2, z + 0.52, false)
  }
  // power LED: always lit while the scene runs (there is no power state)
  const led = std({ color: 0x2f7a3e, emissive: 0x3fe060, emissiveIntensity: 2.4, roughness: 0.3 })
  { const [x, y, z] = at(PLATE.led)
    add(amp, cylZ(0.34, 0.2, 18), dark, x, y, z + 0.1, false)
    add(amp, track(new T.SphereGeometry(0.21, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2)), led, x, y, z + 0.2, false) }
  ctx.parts.registerPart('amplifier', amp, { labelKey: 'parts.amplifier.name', infoKey: 'parts.amplifier.info' })

  // ================================================================ capacitor 578 22 on a plug-in block
  const cap = new T.Group()
  cap.position.set(CAP_BLOCK.x, 0, CAP_BLOCK.z)
  root.add(cap)
  add(cap, rbox(3.4, 0.9, 2.6, 0.25, 2), dark, 0, 0.45, 0)
  for (const x of [-0.7, 0.7]) add(cap, track(new T.CylinderGeometry(0.16, 0.16, 0.5, 10)), M.metal, x, 1.05, 0, false) // pins
  backSocket(cap, CAP_BLOCK.d / 2)
  add(cap, rbox(2.3, 2.7, 1.1, 0.22, 3), blueBody, 0, 0.9 + 1.35, 0)
  const capLabel = canvasTex(256, 256, (g) => drawLabel(g, 256, 256, ['100 pF', '630 V'], '#2a5aa8', '#f4f1e6'))
  add(cap, track(new T.PlaneGeometry(1.9, 1.9)), printed(capLabel.tex), 0, 0.9 + 1.4, 0.56, false)
  ctx.parts.registerPart('capacitor', cap, { labelKey: 'parts.capacitor.name', infoKey: 'parts.capacitor.info' })

  // ================================================================ key switch 579 10 on a plug-in block
  const key = new T.Group()
  key.position.set(KEY_BLOCK.x, 0, KEY_BLOCK.z)
  root.add(key)
  add(key, rbox(4, 0.9, 3.2, 0.25, 2), dark, 0, 0.45, 0)
  backSocket(key, KEY_BLOCK.d / 2)
  add(key, track(new T.CylinderGeometry(1.05, 1.15, 1.3, 28)), M.metal, 0, 0.9 + 0.65, 0)
  const KEY_REST_Y = 0.9 + 1.3 + 0.4, KEY_TRAVEL = 0.55
  const capMesh = add(key, track(new T.CylinderGeometry(0.8, 0.86, 0.8, 28)), M.cable.red, 0, KEY_REST_Y, 0)
  add(key, track(new T.CylinderGeometry(0.28, 0.28, 0.5, 12)), M.metal, 0, 0.9 + 1.3 + 0.1, 0, false) // stem seen when pressed
  capMesh.name = 'key-cap'
  const keyHit = add(key, track(new T.CylinderGeometry(1.7, 1.7, 2.2, 16)), track(new T.MeshBasicMaterial({ visible: false })), 0, 1.9, 0, false)
  keyHit.name = 'key-hit'
  for (const m of [capMesh, keyHit]) m.userData.pressHandle = 'key'
  key.userData.pressHandle = 'key'
  ctx.parts.registerPart('key', key, { labelKey: 'parts.key.name', infoKey: 'parts.key.info', controlId: 'key' })

  // ================================================================ plug-in supply 562 791
  const supply = new T.Group()
  supply.position.set(SUPPLY_BOX.x, 0, SUPPLY_BOX.z)
  root.add(supply)
  add(supply, rbox(5, 5.5, 4, 0.5), M.rubber, 0, 2.75, 0)
  const supLabel = canvasTex(256, 128, (g) => drawLabel(g, 256, 128, ['12 V ~', '562 791'], '#d9d7d0', '#1b1d21'))
  add(supply, track(new T.PlaneGeometry(3.4, 1.7)), printed(supLabel.tex), 0, 3.3, 2.012, false)
  add(supply, rbox(1.2, 0.5, 0.2, 0.1, 2), M.metal, 0, 1.4, 2.02, false)
  add(supply, track(new T.CylinderGeometry(0.4, 0.4, 0.3, 12).rotateX(Math.PI / 2)), M.rubber, 0, 1.4, -SUPPLY_BOX.d / 2 - 0.05, false) // cord grommet
  ctx.parts.registerPart('supply', supply, { labelKey: 'parts.supply.name', infoKey: 'parts.supply.info' })

  // ================================================================ multimeter 531 120
  const meter = new T.Group()
  meter.position.set(METER.x, 0, METER.z)
  root.add(meter)
  const bev = METER_FACE.bevel
  const shape = new T.Shape()
  const { lip, top } = METER_FACE
  const back = -METER.depth / 2
  shape.moveTo(back, 0); shape.lineTo(lip.z, 0); shape.lineTo(lip.z, lip.y); shape.lineTo(top.z, top.y); shape.lineTo(back, top.y); shape.closePath()
  const bodyGeo = track(new T.ExtrudeGeometry(shape, { depth: METER.width - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 3, curveSegments: 4 }))
  bodyGeo.translate(0, 0, -(METER.width - 2 * bev) / 2)
  bodyGeo.rotateY(-Math.PI / 2) // shape x -> world z, extrusion -> world x
  add(meter, bodyGeo, yellow, 0, bev, 0)
  // dark bumper feet along the bottom
  add(meter, rbox(METER.width + 0.1, 0.5, METER.depth - 1, 0.2, 2), dark, 0, 0.12, 0, false)

  // face frame: origin at the lip edge of the sloped face, local y up the slope, local z out of the face
  const phi = Math.atan2(top.y - lip.y, lip.z - top.z)
  const face = new T.Group()
  face.position.set(0, lip.y + bev + bev * Math.cos(phi), lip.z + bev * Math.sin(phi))
  face.rotation.x = -(Math.PI / 2 - phi)
  meter.add(face)
  const dialV = 8.4
  // dial window: printed face, 3D frame
  const dial = canvasTex(DIAL_PX.w, DIAL_PX.h, (g) => drawDial(g, 'OFF', ctx.lang()))
  // unlit and not tone-mapped: the printed scale keeps its ink contrast under any light (this is the student's reading instrument)
  const dialMat = track(new T.MeshBasicMaterial({ map: dial.tex, toneMapped: false }))
  add(face, track(new T.PlaneGeometry(DIAL_CM.w, DIAL_CM.h)), dialMat, 0, dialV, 0.28, false)
  const lipH = 0.45
  add(face, rbox(DIAL_CM.w + 2 * lipH, lipH, 0.55, 0.14, 2), dark, 0, dialV + DIAL_CM.h / 2 + lipH / 2, 0.27)
  add(face, rbox(DIAL_CM.w + 2 * lipH, lipH, 0.55, 0.14, 2), dark, 0, dialV - DIAL_CM.h / 2 - lipH / 2, 0.27)
  for (const s of [-1, 1]) add(face, rbox(lipH, DIAL_CM.h, 0.55, 0.14, 2), dark, s * (DIAL_CM.w / 2 + lipH / 2), dialV, 0.27)
  // needle
  const needleGroup = new T.Group()
  needleGroup.position.set(DIAL_PIVOT_CM.u, dialV + DIAL_PIVOT_CM.v, 0.4)
  face.add(needleGroup)
  const L = DIAL_PIVOT_CM.r + 0.1
  const nShape = new T.Shape([new T.Vector2(-0.07, -1.0), new T.Vector2(0.07, -1.0), new T.Vector2(0.03, L), new T.Vector2(-0.03, L)])
  const needleMat = track(new T.MeshStandardMaterial({ color: 0x9e1a12, roughness: 0.5, side: T.DoubleSide }))
  add(needleGroup, track(new T.ShapeGeometry(nShape)), needleMat, 0, 0, 0, false)
  add(needleGroup, track(new T.CylinderGeometry(0.2, 0.24, 0.18, 20).rotateX(Math.PI / 2)), dark, 0, 0, 0.06, false)
  // range knob and printed strip
  const kv = METER_KNOB_V, plateH = 3.6, plateV = 2.2
  const ppc = 98
  const drawStrip = (g: CanvasRenderingContext2D): void =>
    drawKnobPlate(g, Math.round(DIAL_CM.w * ppc), Math.round(plateH * ppc), (DIAL_CM.w * ppc) / 2, (plateH / 2 + (plateV - kv)) * ppc, ppc, ctx.lang())
  const strip = canvasTex(Math.round(DIAL_CM.w * ppc), Math.round(plateH * ppc), drawStrip)
  add(face, track(new T.PlaneGeometry(DIAL_CM.w, plateH)), printed(strip.tex), 0, plateV, 0.02, false)
  const knob = new T.Group()
  knob.position.set(0, kv, 0.03)
  face.add(knob)
  add(knob, cylZ(0.98, 0.5, 40), dark, 0, 0, 0.25)
  add(knob, cylZ(0.78, 0.18, 40), std({ color: 0x3a3d44, roughness: 0.4, metalness: 0.3 }), 0, 0, 0.55, false)
  add(knob, box(0.15, 0.78, 0.07), white, 0, 0.42, 0.65, false)
  const knobHit = add(knob, cylZ(1.6, 0.9, 20), track(new T.MeshBasicMaterial({ visible: false })), 0, 0, 0.35, false)
  knobHit.name = 'range-knob-hit'
  knob.userData.dragHandle = 'range'
  knob.traverse((o) => { o.userData.dragHandle = 'range' })
  // input terminals on the front lip
  for (const [name, mat] of [['black', M.cable.blue], ['red', M.cable.red]] as const) {
    const t = METER_TERMINALS[name]
    socket4(meter, t[0] - METER.x, t[1], lip.z + bev, mat)
  }
  ctx.parts.registerPart('meter', meter, { labelKey: 'parts.meter.name', infoKey: 'parts.meter.info', controlId: 'range' })
  ctx.parts.registerPart('meterKnob', knob, { labelKey: 'parts.meterKnob.name', infoKey: 'parts.meterKnob.info', controlId: 'range' })

  // ================================================================ cables and distribution box 502 04
  const cables = new T.Group()
  root.add(cables)
  const distBox = new T.Group()
  distBox.position.set(46, 0, -11)
  cables.add(distBox)
  add(distBox, rbox(6, 3, 4, 0.35), M.enclosure, 0, 1.5, 0)
  for (let i = 0; i < 4; i++) {
    const x = -2.1 + i * 1.4
    socket4(distBox, x, 1.5, 2, i === 3 ? std({ color: 0x8cc719, roughness: 0.5 }) : dark)
  }
  const plugGeo = track(new T.CylinderGeometry(1, 1, 1, 14))
  const up = new T.Vector3(0, 1, 0)
  const curves: THREE.CatmullRomCurve3[] = []
  for (const def of CABLES) {
    const curve = cableCurve(T, def)
    curves.push(curve)
    add(cables, track(new T.TubeGeometry(curve, 160, def.radius, 8, false)), M.cable[def.mat], 0, 0, 0)
    ;([0, 1] as const).forEach((end) => {
      const kind = def.ends[end]
      const p = curve.getPoint(end), tan = curve.getTangent(end)
      const out = end === 1 ? tan.clone() : tan.clone().negate() // pointing into the socket
      const bnc = kind === 'bnc', boot = kind === 'none'
      const rad = bnc ? 0.62 : boot ? def.radius * 1.7 : 0.42
      const len = bnc ? 1.6 : boot ? 0.9 : 1.4
      const plug = new T.Mesh(plugGeo, bnc ? M.metal : M.rubber)
      plug.scale.set(rad, len, rad)
      plug.quaternion.setFromUnitVectors(up, out)
      plug.position.copy(p).addScaledVector(out, boot ? len / 2 : -len / 2)
      if (boot && end === 0) plug.position.copy(p).addScaledVector(out, -len / 2)
      plug.castShadow = true
      cables.add(plug)
    })
  }
  ctx.parts.registerPart('cables', cables, { labelKey: 'parts.cables.name', infoKey: 'parts.cables.info' })

  // triangle count (for the report and for budget tests)
  let triangles = 0
  root.traverse((o) => {
    const g = (o as THREE.Mesh).geometry as THREE.BufferGeometry | undefined
    if (g) triangles += (g.index ? g.index.count : g.attributes.position!.count) / 3
  })
  root.userData.triangles = triangles

  // ================================================================ state, update and tick
  const needleSpring: Spring = { x: 0, v: 0 }
  let needleTarget = 0
  let knobDeg = knobAngleDeg('OFF'), knobTarget = knobDeg
  let keyDepth = 0, keyTarget = 0
  let drawnKey: string | null = `OFF|${ctx.lang()}`
  let moving = false
  let first = true
  let lastRange: MeterRange = 'OFF'
  let rockerTarget = 0, rocker01 = 0

  const apply = (): void => {
    needleGroup.rotation.z = -needleAngleDeg(needleSpring.x) * DEG
    knob.rotation.z = -knobDeg * DEG
    capMesh.position.y = KEY_REST_Y - KEY_TRAVEL * keyDepth
    rockerPaddle.rotation.x = (rocker01 - 0.5) * 0.5 // top edge in when on
    rockerOnMat.emissive.setHex(rocker01 > 0.5 ? 0x5a1008 : 0x000000)
  }
  const reduced = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

  return {
    update(r) {
      dialMat.color.setScalar(1 - 0.22 * (ctx.darkness?.() ?? 0)) // faint spill light in the dark room, still readable
      needleTarget = needleTargetFraction(r)
      knobTarget = knobAngleDeg(r.meterRange)
      keyTarget = r.keyPressed ? 1 : 0
      lastRange = r.meterRange
      const rk = `${r.meterRange}|${ctx.lang()}`
      if (rk !== drawnKey) {
        drawnKey = rk
        drawDial(dial.g, r.meterRange, ctx.lang())
        dial.tex.needsUpdate = true
      }
      rockerTarget = r.lampOn ? 1 : 0
      if (first || reduced()) {
        first = false
        needleSpring.x = needleTarget; needleSpring.v = 0
        knobDeg = knobTarget
        keyDepth = keyTarget
        rocker01 = rockerTarget
        moving = false
        apply()
      } else moving = true
      ctx.requestRender()
    },
    tick(dt) {
      if (!moving) return
      let m = stepNeedle(needleSpring, needleTarget, dt)
      const k = easeTo(knobDeg, knobTarget, dt, 0.07, 0.05)
      const d = easeTo(keyDepth, keyTarget, dt, 0.04, 0.01)
      const rk = easeTo(rocker01, rockerTarget, dt, 0.05, 0.01)
      m = m || k !== knobTarget || d !== keyTarget || rk !== rockerTarget
      knobDeg = k; keyDepth = d; rocker01 = rk
      apply()
      moving = m
      ctx.requestRender()
    },
    relabel() {
      drawnKey = `${lastRange}|${ctx.lang()}`
      drawDial(dial.g, lastRange, ctx.lang())
      dial.tex.needsUpdate = true
      drawStrip(strip.g)
      strip.tex.needsUpdate = true
      ctx.requestRender()
    },
    dispose() {
      for (const o of dispose) o.dispose()
      scene.remove(root)
    },
  }
}
