// Shared material palette. Colours come from the design tokens (CSS custom properties) and are re-read on theme change.
// The stage is a dark plate in both themes (see tokens.css), so most surfaces derive from the --stage-* tokens; the
// --phys-* tokens follow the theme and are exposed as `physColor` for any UI-adjacent use (labels, legends).
import type * as THREE from 'three'

type T = typeof THREE
export type LineId = 'yellow' | 'green' | 'blue' | 'violet' | 'uv'
export const LINE_IDS: readonly LineId[] = ['yellow', 'green', 'blue', 'violet', 'uv']

export interface Materials {
  /** Anodised dark grey housing (compact arrangement, choke, amplifier). */
  housing: THREE.MeshStandardMaterial
  /** LD-style light-grey enclosure plastic (lamp housing, multimeter, supply). */
  enclosure: THREE.MeshStandardMaterial
  metal: THREE.MeshStandardMaterial
  /** Transmissive physical glass. Costs an extra render pass (three transmission): use sparingly. */
  glass: THREE.MeshPhysicalMaterial
  /** Cheap transparent glass (no transmission pass); good default for tubes and covers. */
  glassLite: THREE.MeshStandardMaterial
  rubber: THREE.MeshStandardMaterial
  cable: { red: THREE.MeshStandardMaterial; blue: THREE.MeshStandardMaterial; black: THREE.MeshStandardMaterial; yellowGreen: THREE.MeshStandardMaterial }
  /** Emissive Hg line colours on the dark stage (same hues as --stage-* / dark --phys-*). */
  line: Record<LineId, THREE.MeshBasicMaterial>
  /** The --phys-* tokens as colours (theme dependent). */
  physColor: Record<Exclude<LineId, 'uv'>, THREE.Color>
  /** Emissive lamp glow; drive with `setLampGlow(0..1)`. */
  lampGlow: THREE.MeshStandardMaterial
  setLampGlow(brightness_0_1: number): void
  /** Dark lab table. */
  table: THREE.MeshStandardMaterial
  /** Table grid colour (rgba string) and the stage background colour, for scene.ts. */
  tokens: { plate: THREE.Color; gridCss: string }
  /** Re-read CSS tokens (call after a theme change). */
  refresh(): void
  dispose(): void
}

export function createMaterials(three: T, probe: HTMLElement): Materials {
  const resolve = (v: string): string => {
    probe.style.color = `var(${v})`
    return getComputedStyle(probe).color
  }
  const rgb = (css: string): [number, number, number] => {
    const n = css.match(/[\d.]+/g)?.map(Number) ?? [128, 128, 128]
    return [(n[0] ?? 0) / 255, (n[1] ?? 0) / 255, (n[2] ?? 0) / 255]
  }
  const col = (v: string): THREE.Color => new three.Color().setRGB(...rgb(resolve(v)), three.SRGBColorSpace)
  const mix = (a: THREE.Color, b: THREE.Color, k: number): THREE.Color => a.clone().lerp(b, k)
  const white = new three.Color(1, 1, 1)
  const black = new three.Color(0, 0, 0)

  const std = (p: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial => new three.MeshStandardMaterial(p)
  const m: Materials = {
    housing: std({ metalness: 0.7, roughness: 0.42 }),
    enclosure: std({ metalness: 0.05, roughness: 0.55 }),
    metal: std({ metalness: 1, roughness: 0.3 }),
    glass: new three.MeshPhysicalMaterial({ transmission: 0.95, thickness: 0.6, roughness: 0.05, ior: 1.5, transparent: true }),
    glassLite: std({ transparent: true, opacity: 0.28, roughness: 0.08, metalness: 0, depthWrite: false }),
    rubber: std({ metalness: 0, roughness: 0.9 }),
    // Cable colours describe physical objects (insulation), so they are not UI tokens; red/blue follow --danger/--accent.
    cable: { red: std({ roughness: 0.6 }), blue: std({ roughness: 0.6 }), black: std({ roughness: 0.6 }), yellowGreen: std({ roughness: 0.6 }) },
    line: Object.fromEntries(LINE_IDS.map((id) => [id, new three.MeshBasicMaterial({ transparent: true, opacity: 1 })])) as Materials['line'],
    physColor: { yellow: new three.Color(), green: new three.Color(), blue: new three.Color(), violet: new three.Color() },
    lampGlow: std({ emissiveIntensity: 0, roughness: 0.4 }),
    setLampGlow(b) { m.lampGlow.emissiveIntensity = 0.1 + 3 * Math.max(0, Math.min(1, b)) },
    table: std({ metalness: 0.2, roughness: 0.78 }),
    tokens: { plate: new three.Color(), gridCss: 'rgba(255,255,255,0.1)' },
    refresh() {
      const metal = col('--stage-metal'), metalHi = col('--stage-metal-hi'), plate = col('--stage-plate')
      m.housing.color.copy(mix(metal, black, 0.35))
      m.enclosure.color.copy(mix(metalHi, white, 0.55))
      m.metal.color.copy(metalHi)
      m.glass.color.copy(white)
      m.glassLite.color.copy(col('--stage-glass'))
      m.rubber.color.copy(mix(black, metal, 0.12))
      m.cable.red.color.copy(col('--danger'))
      m.cable.blue.color.copy(col('--accent'))
      m.cable.black.color.copy(mix(black, metal, 0.2))
      m.cable.yellowGreen.color.setRGB(0.55, 0.78, 0.1, three.SRGBColorSpace)
      for (const id of LINE_IDS) m.line[id].color.copy(col(`--stage-${id}`))
      for (const id of ['yellow', 'green', 'blue', 'violet'] as const) m.physColor[id].copy(col(`--phys-${id}`))
      const glow = col('--stage-glow')
      m.lampGlow.color.copy(mix(glow, black, 0.4)); m.lampGlow.emissive.copy(glow)
      m.table.color.copy(mix(plate, metalHi, 0.16))
      m.tokens.plate.copy(plate)
      const [r, g, b] = rgb(resolve('--stage-ink')).map((v) => Math.round(v * 255))
      m.tokens.gridCss = `rgba(${r},${g},${b},`
      for (const mat of Object.values(m.cable)) mat.needsUpdate = true
    },
    dispose() {
      const all = [m.housing, m.enclosure, m.metal, m.glass, m.glassLite, m.rubber, ...Object.values(m.cable), ...Object.values(m.line), m.lampGlow, m.table]
      for (const x of all) x.dispose()
    },
  }
  m.refresh()
  return m
}
