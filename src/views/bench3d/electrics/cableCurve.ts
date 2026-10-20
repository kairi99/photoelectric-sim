// Cable centre-lines: a centripetal Catmull-Rom spline through the control points, resampled and pressed onto the table
// (a spline can overshoot below y = radius where a cable lies flat). The end points stay exactly on the sockets.
import type * as THREE from 'three'
import type { CableDef } from './layout.ts'

export function cableCurve(T: typeof THREE, def: Pick<CableDef, 'points' | 'radius'>): THREE.CatmullRomCurve3 {
  const base = new T.CatmullRomCurve3(def.points.map((p) => new T.Vector3(p[0], p[1], p[2])), false, 'centripetal')
  const n = def.points.length * 12
  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= n; i++) {
    const p = base.getPoint(i / n)
    if (i > 0 && i < n) p.y = Math.max(p.y, def.radius)
    pts.push(p)
  }
  return new T.CatmullRomCurve3(pts, false, 'centripetal')
}
