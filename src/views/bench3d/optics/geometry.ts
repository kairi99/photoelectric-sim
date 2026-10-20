// Procedural geometry for the optics (lenses, prism, knurled knob). All builders take the three namespace.
import type * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

type T = typeof THREE

/** Biconvex lens, axis along +x: radius r, edge thickness e, sag s per face (all cm). */
export function lensGeometry(three: T, r: number, e: number, s: number, seg = 36): THREE.BufferGeometry {
  const R = (r * r + s * s) / (2 * s)
  const pts: THREE.Vector2[] = []
  const n = 8
  for (let i = 0; i <= n; i++) { // front arc: axis -> rim
    const rr = (r * i) / n
    pts.push(new three.Vector2(rr, e / 2 + (Math.sqrt(R * R - rr * rr) - Math.sqrt(R * R - r * r))))
  }
  for (let i = n; i >= 0; i--) {
    const rr = (r * i) / n
    pts.push(new three.Vector2(rr, -(e / 2 + (Math.sqrt(R * R - rr * rr) - Math.sqrt(R * R - r * r)))))
  }
  const g = new three.LatheGeometry(pts, seg)
  g.rotateZ(-Math.PI / 2) // lathe axis y -> x
  return g
}

/** Ring (lens holder), axis along x. */
export function ringGeometry(three: T, r: number, tube: number): THREE.BufferGeometry {
  const g = new three.TorusGeometry(r, tube, 10, 36)
  g.rotateY(Math.PI / 2)
  return g
}

/** Amici direct-vision prism: crown, flint, crown tiled into a block L (x) by W (z) by H (y), centred on the origin. */
export function amiciGeometries(three: T, L: number, W: number, H: number, gap = 0.04): { crowns: THREE.BufferGeometry; flint: THREE.BufferGeometry } {
  const h = W / 2
  const poly = (pts: Array<[number, number]>): THREE.BufferGeometry => {
    const shape = new three.Shape(pts.map(([x, y]) => new three.Vector2(x - L / 2, y)))
    const g = new three.ExtrudeGeometry(shape, { depth: H - 0.1, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 1 })
    g.rotateX(-Math.PI / 2)
    g.translate(0, -(H - 0.1) / 2, 0)
    return g
  }
  const a = L * 0.2, b = L * 0.45, c = L * 0.7
  const crownA = poly([[gap, -h + gap], [gap, h - gap], [a - gap, h - gap], [b - gap, -h + gap]])
  const crownB = poly([[c + gap, h - gap], [L - gap, h - gap], [L - gap, -h + gap], [b + gap, -h + gap]])
  const flint = poly([[a + gap, h - gap], [c - gap, h - gap], [b, -h + gap * 1.5]])
  return { crowns: mergeGeometries([crownA, crownB], false)!, flint }
}

/** Knurled knob (vertical axis): cylinder with `ridges` ridges merged into one geometry. */
export function knobGeometry(three: T, radius: number, height: number, ridges = 28): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [new three.CylinderGeometry(radius, radius, height, 40)]
  for (let i = 0; i < ridges; i++) {
    const a = (i / ridges) * Math.PI * 2
    const g = new three.BoxGeometry(0.1, height, 0.22)
    g.translate(radius, 0, 0)
    g.rotateY(a)
    parts.push(g)
  }
  const merged = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)), false)!
  for (const p of parts) p.dispose()
  return merged
}

/** Soft vertical streak texture (a line image of the slit): gaussian across, fading along. Greyscale in the alpha/colour. */
export function streakTexture(three: T): THREE.CanvasTexture {
  const w = 64, h = 128
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const g = c.getContext('2d')!
  const img = g.createImageData(w, h)
  for (let y = 0; y < h; y++) {
    const v = Math.abs((y + 0.5) / h - 0.5) * 2
    const fy = 1 - Math.pow(Math.min(1, Math.max(0, (v - 0.55) / 0.45)), 2) // flat middle, soft ends
    for (let x = 0; x < w; x++) {
      const u = ((x + 0.5) / w - 0.5) * 2
      const core = Math.exp(-(u * u) / (2 * 0.12 * 0.12))
      const halo = 0.28 * Math.exp(-(u * u) / (2 * 0.45 * 0.45))
      const val = Math.min(1, core + halo) * fy
      const o = (y * w + x) * 4
      img.data[o] = img.data[o + 1] = img.data[o + 2] = 255
      img.data[o + 3] = Math.round(val * 255)
    }
  }
  g.putImageData(img, 0, 0)
  const t = new three.CanvasTexture(c)
  t.colorSpace = three.SRGBColorSpace
  return t
}

/** Radial glow sprite texture. */
export function glowTexture(three: T): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.25, 'rgba(255,255,255,0.45)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  const t = new three.CanvasTexture(c)
  t.colorSpace = three.SRGBColorSpace
  return t
}
