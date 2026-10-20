// PLACEHOLDER optics builder: labelled boxes at the Fig. 2 positions. Replaced by the optics agent.
// Layout (cm, see units.ts): lamp axis y = AXIS_Y, z = AXIS_Z. See the module report for every coordinate.
import { placeholderBox } from './placeholder.ts'
import type { Builder } from './builders.ts'
import { ARM_SPAN_DEG } from '../benchkit.ts'

/** Pivot of the swivelling arm 9 (under the mirror corner) and the direction it points at position 0.5. */
export const ARM_PIVOT = { x: 10, z: -2 }
export const ARM_DIR = { x: -0.799, z: 0.602 }
export const ARM_LENGTH = 20.8

export const buildOptics: Builder = (ctx) => {
  const { three: T, scene, materials: M, units: U } = ctx
  const dispose: Array<{ dispose(): void }> = []
  const root = new T.Group()
  root.name = 'optics-placeholder'
  scene.add(root)
  const box = (spec: Parameters<typeof placeholderBox>[1]) => placeholderBox(ctx, { parent: root, ...spec }, dispose)

  // Lamp 1: cylinder along +x, resting on the table, left of the tube.
  const lampGeo = new T.CylinderGeometry(4.5, 4.5, 9, 24)
  lampGeo.rotateZ(Math.PI / 2)
  const lamp = new T.Mesh(lampGeo, M.enclosure)
  lamp.position.set(-25, U.AXIS_Y, U.AXIS_Z)
  lamp.castShadow = true
  root.add(lamp)
  dispose.push(lampGeo)
  const glow = new T.Mesh(new T.CircleGeometry(3.4, 24), M.lampGlow)
  glow.rotation.y = Math.PI / 2
  glow.position.set(4.52, 0, 0)
  lamp.add(glow)
  dispose.push(glow.geometry)
  ctx.parts.registerPart('1', lamp, { labelKey: 'parts.1.name', infoKey: 'parts.1.info', controlId: 'lamp' })

  // Tube (rectangular, translucent): x -19.5..12.5, z -4.5..1.5, height 9.
  box({ id: '2', size: [1, 7, 5], at: [-18.5, U.AXIS_Z], y: U.AXIS_Y, material: M.rubber, controlId: 'beam', label: '2' })
  box({ id: '3', size: [1, 6, 5], at: [-16.5, U.AXIS_Z], y: U.AXIS_Y, material: M.glass, label: '3' })
  box({ id: '4', size: [0.6, 6, 4], at: [-13.2, U.AXIS_Z], y: U.AXIS_Y, material: M.metal, label: '4' })
  box({ id: '5', size: [1, 6, 5], at: [-6.6, U.AXIS_Z], y: U.AXIS_Y, material: M.glass, label: '5' })
  box({ id: '6', size: [3, 5, 4], at: [0.5, U.AXIS_Z], y: U.AXIS_Y, material: M.glass, label: '6' })
  box({ id: '7', size: [0.6, 6, 5], at: [9, U.AXIS_Z], y: U.AXIS_Y, material: M.metal, label: '7' })
  const tubeGeo = new T.BoxGeometry(32, 9, 6)
  const tube = new T.Mesh(tubeGeo, M.glassLite)
  tube.position.set(-3.5, 4.5, U.AXIS_Z + 0.0)
  root.add(tube)
  dispose.push(tubeGeo)

  // Triangular housing below the tube's right end: vertices (x, z) A(-12.6, 1.6) B(12.5, 1.6) C(-6.6, 14.8), height 9.
  const shape = new T.Shape([new T.Vector2(-12.6, -1.6), new T.Vector2(12.5, -1.6), new T.Vector2(-6.6, -14.8)])
  const triGeo = new T.ExtrudeGeometry(shape, { depth: 9, bevelEnabled: false })
  triGeo.rotateX(-Math.PI / 2)
  const tri = new T.Mesh(triGeo, M.housing)
  tri.castShadow = true; tri.receiveShadow = true
  root.add(tri)
  dispose.push(triGeo)

  // Window 12 on the short edge A-C (faces lower-left).
  const wGeo = new T.BoxGeometry(9, 5, 0.5)
  const win = new T.Mesh(wGeo, M.glassLite)
  win.position.set(-8.6, 4.5, 10.5)
  win.rotation.y = U.yawToward(6, 13.2)
  root.add(win)
  dispose.push(wGeo)
  ctx.parts.registerPart('12', win, { labelKey: 'parts.12.name', infoKey: 'parts.12.info', controlId: 'windowCover' })

  // Sockets 8.1 (BNC) and 8.2 (4 mm) on the tube's right end.
  box({ id: '8.2', size: [1.5, 1.5, 1.5], at: [13.3, -4.5], y: 6.5, material: M.metal, label: '8.2' })
  box({ id: '8.1', size: [1.5, 1.5, 1.5], at: [13.3, 0.5], y: 3, material: M.metal, label: '8.1' })

  // Arm 9 pivots at ARM_PIVOT; rotate the group about y. 10 (lens + slit) and 11 (photocell) ride on it.
  const arm = new T.Group()
  arm.position.set(ARM_PIVOT.x, 0, ARM_PIVOT.z)
  root.add(arm)
  const armYaw = U.yawToward(ARM_DIR.x, ARM_DIR.z)
  const along = (d: number): [number, number] => [ARM_DIR.x * d, ARM_DIR.z * d]
  const bar = box({ id: '9', size: [ARM_LENGTH, 1.2, 1.4], at: along(ARM_LENGTH / 2), y: U.AXIS_Y, material: M.metal, label: '9', parent: arm })
  bar.rotation.y = armYaw
  ctx.parts.registerPart('9', arm, { labelKey: 'parts.9.name', infoKey: 'parts.9.info', controlId: 'arm' })
  const lens10 = box({ id: '10', size: [1.6, 3.5, 3.5], at: along(ARM_LENGTH * 0.86), y: U.AXIS_Y, material: M.rubber, label: '10', parent: arm })
  lens10.rotation.y = armYaw
  const cell = box({ id: '11', size: [3, 3.5, 3.5], at: along(ARM_LENGTH * 0.97), y: U.AXIS_Y, material: M.glass, controlId: 'cathode', label: '11', parent: arm })
  cell.rotation.y = armYaw
  // 0.5 = pointing at the window; rotation sign matches the 2D bench (screen clockwise as the position grows).
  const setArm = (pos: number): void => { arm.rotation.y = -(pos - 0.5) * ARM_SPAN_DEG * U.DEG; ctx.requestRender() }

  return {
    update(r) {
      M.setLampGlow(r.lampOn ? r.lampBrightness : 0)
      setArm(r.armPosition)
    },
    dispose() {
      for (const o of dispose) o.dispose()
      scene.remove(root)
    },
  }
}
