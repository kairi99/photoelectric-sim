// Shared helper for the placeholder builders: a labelled, shadow-casting box registered as a part.
// The real optics/electrics builders do not need it and may stop using it.
import type * as THREE from 'three'
import type { BuildCtx } from './builders.ts'
import type { PartId } from './parts.ts'

export interface BoxSpec {
  id: PartId
  /** Size in cm: x (left-right), y (height), z (front-back). */
  size: [number, number, number]
  /** Centre of the box base on the table in cm: x, z (y = 0 unless `y` is given for the centre height). */
  at: [number, number]
  y?: number
  material: THREE.Material
  controlId?: string
  /** Short text drawn on a sprite above the box. */
  label?: string
  parent?: THREE.Object3D
}

export function placeholderBox(ctx: BuildCtx, spec: BoxSpec, disposables: Array<{ dispose(): void }>): THREE.Mesh {
  const { three } = ctx
  const geo = new three.BoxGeometry(...spec.size)
  const mesh = new three.Mesh(geo, spec.material)
  mesh.position.set(spec.at[0], spec.y ?? spec.size[1] / 2, spec.at[1])
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.name = `placeholder-${spec.id}`
  ;(spec.parent ?? ctx.scene).add(mesh)
  disposables.push(geo)
  ctx.parts.registerPart(spec.id, mesh, { labelKey: `parts.${spec.id}.name`, infoKey: `parts.${spec.id}.info`, controlId: spec.controlId })
  if (spec.label) {
    const c = document.createElement('canvas')
    c.width = 128; c.height = 64
    const g = c.getContext('2d')!
    g.fillStyle = 'rgba(0,0,0,0.55)'; g.beginPath(); g.roundRect(2, 2, 124, 60, 14); g.fill()
    g.fillStyle = '#fff'; g.font = '600 34px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'
    g.fillText(spec.label, 64, 34)
    const tex = new three.CanvasTexture(c)
    tex.colorSpace = three.SRGBColorSpace
    const mat = new three.SpriteMaterial({ map: tex, depthTest: false, transparent: true })
    const sprite = new three.Sprite(mat)
    sprite.scale.set(5, 2.5, 1)
    sprite.position.set(0, spec.size[1] / 2 + 2.2, 0)
    sprite.renderOrder = 10
    mesh.add(sprite)
    disposables.push(tex, mat)
  }
  return mesh
}
