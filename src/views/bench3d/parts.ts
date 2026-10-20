// Part registry: maps leaflet part ids to scene objects, for highlighting (View.focus) and picking.
// One registry per scene (no module-level state, so it is safe across destroy/mount cycles).
import type * as THREE from 'three'

export const PART_IDS = [
  '1', '2', '3', '4', '5', '6', '7', '8.1', '8.2', '9', '10', '11', '12',
  'choke', 'amplifier', 'capacitor', 'key', 'supply', 'meter', 'meterKnob', 'cables',
] as const
export type PartId = (typeof PART_IDS)[number]

export interface PartMeta {
  /** Dot path into the bench3d strings, e.g. 'parts.1.name'. */
  labelKey: string
  /** Dot path into the bench3d strings, e.g. 'parts.1.info'. */
  infoKey: string
  /** `data-ctl` name of the control strip / panel card that operates this part (e.g. 'arm', 'lamp', 'range', 'key'). */
  controlId?: string
}
export interface Part extends PartMeta { id: PartId; object: THREE.Object3D }

export class PartRegistry {
  private parts = new Map<PartId, Part>()
  private byObject = new Map<THREE.Object3D, PartId>()
  private dimmed = new Map<THREE.Material, THREE.Material>()
  private active: ReadonlySet<PartId> | null = null
  private raycaster: THREE.Raycaster

  private requestRender: () => void

  constructor(three: typeof THREE, requestRender: () => void) {
    this.requestRender = requestRender
    this.raycaster = new three.Raycaster()
  }

  /** Register (or replace) a part. The object may be a Group; ids nest naturally (arm 9 contains 10 and 11). */
  registerPart(id: PartId, object: THREE.Object3D, meta: PartMeta): void {
    const old = this.parts.get(id)
    if (old) this.byObject.delete(old.object)
    this.parts.set(id, { id, object, ...meta })
    this.byObject.set(object, id)
    object.userData.partId = id
    if (this.active) this.apply()
  }
  getPart(id: PartId): Part | undefined { return this.parts.get(id) }
  all(): Part[] { return [...this.parts.values()] }
  /** Ids of the parts operated by any of the given control ids. */
  forControls(controls: readonly string[]): PartId[] {
    return this.all().filter((p) => p.controlId && controls.includes(p.controlId)).map((p) => p.id)
  }

  /** Dim every part that is not listed (null clears). Parts nested inside a listed part stay lit. */
  highlight(ids: readonly PartId[] | null): void {
    this.active = ids && ids.length ? new Set(ids) : null
    this.apply()
    this.requestRender()
  }
  /** Re-apply the current highlight (call after a builder swaps materials or adds meshes). */
  refresh(): void { if (this.active) this.apply() }

  private lit(obj: THREE.Object3D): boolean {
    for (let o: THREE.Object3D | null = obj; o; o = o.parent) {
      const id = this.byObject.get(o)
      if (id && this.active!.has(id)) return true
    }
    return false
  }
  private dimClone(mat: THREE.Material): THREE.Material {
    let d = this.dimmed.get(mat)
    if (!d) {
      d = mat.clone()
      d.transparent = true
      d.opacity = mat.opacity * 0.18
      d.depthWrite = false
      this.dimmed.set(mat, d)
    }
    return d
  }
  private apply(): void {
    for (const part of this.parts.values()) {
      part.object.traverse((o) => {
        const mesh = o as THREE.Mesh
        if (!mesh.isMesh || mesh.userData.overlay) return // outline overlays (interaction.ts) own their material
        const orig = (mesh.userData.origMaterial ??= mesh.material) as THREE.Material | THREE.Material[]
        const dim = this.active !== null && !this.lit(mesh)
        // A builder may have swapped the material while dimmed: treat anything that is not our clone as the new original.
        const cur = mesh.material
        const isClone = !Array.isArray(cur) && [...this.dimmed.values()].includes(cur)
        if (!isClone && cur !== orig) mesh.userData.origMaterial = cur
        const base = mesh.userData.origMaterial as THREE.Material | THREE.Material[]
        mesh.material = dim ? (Array.isArray(base) ? base.map((x) => this.dimClone(x)) : this.dimClone(base)) : base
      })
    }
  }

  /** Ids currently highlighted (empty when nothing is). */
  activeIds(): PartId[] { return this.active ? [...this.active] : [] }

  /** All meshes hit by a ray from normalised device coords (-1..1), nearest first. Outline overlays are ignored. */
  hits(ndcX: number, ndcY: number, camera: THREE.Camera): THREE.Intersection[] {
    this.raycaster.setFromCamera({ x: ndcX, y: ndcY } as THREE.Vector2, camera)
    return this.raycaster.intersectObjects([...this.parts.values()].map((p) => p.object), true)
      .filter((h) => (h.object as THREE.Mesh).isMesh && !h.object.userData.overlay)
  }

  /** The nearest registered part id up the parent chain of an object, or null. */
  partOf(object: THREE.Object3D): PartId | null {
    for (let o: THREE.Object3D | null = object; o; o = o.parent) {
      const id = this.byObject.get(o)
      if (id) return id
    }
    return null
  }

  /** Raycast from normalised device coords (-1..1); returns the id of the nearest registered part, or null. */
  pick(ndcX: number, ndcY: number, camera: THREE.Camera): PartId | null {
    const h = this.hits(ndcX, ndcY, camera)[0]
    return h ? this.partOf(h.object) : null
  }

  dispose(): void {
    this.active = null
    this.apply()
    for (const d of this.dimmed.values()) d.dispose()
    this.dimmed.clear()
    this.parts.clear()
    this.byObject.clear()
  }
}
