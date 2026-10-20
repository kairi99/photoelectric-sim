// PLACEHOLDER electrics builder: choke, amplifier, capacitor, key, supply, multimeter and cables as labelled boxes.
// Replaced by the electrics agent. Positions follow Fig. 2 (cm, see units.ts).
import { placeholderBox } from './placeholder.ts'
import type { Builder } from './builders.ts'

export const buildElectrics: Builder = (ctx) => {
  const { three: T, scene, materials: M } = ctx
  const dispose: Array<{ dispose(): void }> = []
  const root = new T.Group()
  root.name = 'electrics-placeholder'
  scene.add(root)
  const box = (spec: Parameters<typeof placeholderBox>[1]) => placeholderBox(ctx, { parent: root, ...spec }, dispose)

  box({ id: 'choke', size: [13.5, 13, 14.4], at: [-37.2, 0], material: M.housing, label: 'choke' })
  box({ id: 'amplifier', size: [12.7, 12, 12.4], at: [25.3, 1.8], material: M.housing, label: 'amp' })
  box({ id: 'capacitor', size: [1.8, 3, 1.8], at: [16.5, 5], material: M.cable.blue, label: 'C' })
  box({ id: 'key', size: [3, 2, 3], at: [20, 12], material: M.rubber, controlId: 'key', label: 'key' })
  box({ id: 'supply', size: [5, 5.5, 4], at: [27, 12], material: M.enclosure, label: '12V' })
  box({ id: 'meter', size: [12, 7, 13], at: [38.5, 12.5], material: M.enclosure, label: 'meter' })
  const knobGeo = new T.CylinderGeometry(1.6, 1.6, 1, 20)
  const knob = new T.Mesh(knobGeo, M.rubber)
  knob.position.set(38.5, 7.5, 15)
  knob.castShadow = true
  root.add(knob)
  dispose.push(knobGeo)
  ctx.parts.registerPart('meterKnob', knob, { labelKey: 'parts.meterKnob.name', infoKey: 'parts.meterKnob.info', controlId: 'range' })

  // Cables: 8.1/8.2 sockets -> amplifier, amplifier -> meter, lamp -> choke (thin tubes lying on the table).
  const cables = new T.Group()
  root.add(cables)
  const cable = (pts: Array<[number, number, number]>, mat: typeof M.cable.red): void => {
    const curve = new T.CatmullRomCurve3(pts.map((p) => new T.Vector3(...p)))
    const geo = new T.TubeGeometry(curve, 24, 0.22, 6, false)
    const m = new T.Mesh(geo, mat)
    m.castShadow = true
    cables.add(m)
    dispose.push(geo)
  }
  cable([[14, 3, 0.5], [16, 0.3, 4], [20, 0.3, 4], [22, 6, 1.8]], M.cable.black)
  cable([[14, 6.5, -4.5], [18, 0.3, -7], [26, 0.3, -7], [28, 11, -4]], M.cable.red)
  cable([[31.6, 5, 5], [34, 0.3, 8], [36, 0.3, 10]], M.cable.black)
  cable([[-28, 0.3, 1], [-29, 0.3, 2], [-30.5, 0.3, 2]], M.cable.yellowGreen)
  ctx.parts.registerPart('cables', cables, { labelKey: 'parts.cables.name', infoKey: 'parts.cables.info' })

  return {
    update() { /* static placeholder */ },
    dispose() {
      for (const o of dispose) o.dispose()
      scene.remove(root)
    },
  }
}
