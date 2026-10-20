import type { Strings } from '../view.ts'

type Part = { name: string; short: string; info: string }
interface BenchStrings {
  figure: string
  tapHint: string
  closeInfo: string
  infoFor: string
  partLabel: string // "{n}: {name}. Show info"
  parts: { lamp: Part; condenser: Part; slit: Part; imaging: Part; prism: Part; mirror: Part; window: Part; arm: Part; lens: Part; cell: Part }
  lines: { yellow: string; green: string; blue: string; violet: string; uv: string }
  windowZoom: string
  windowZoomCap: string
  cellAperture: string
  lineNm: string // "{name} {nm} nm"
  aligned: string // "Aligned: {line}"
  between: string
  armLabel: string
  armHelp: string
  armValue: string // slider aria-valuetext
  lamp: string
  lampOff: string
  lampOn: string
  lampWarming: string // "Warming up {pct} %"
  dimming: string
  dimmingValue: string // "{pct} % open"
  cathode: string
  cathodes: { photocell: string; Cs: string; Na: string; K: string; Zn: string }
  stray: string
  dirty: string
  roomLights: string
  photonEnergy: string
  eV: string
  lampGlow: string
}

const en: BenchStrings = {
  figure: 'Top view of the compact arrangement: lamp, lenses, slit, prism and mirror send the spectrum to the emission window, where the swivelling arm carries the photocell.',
  tapHint: 'Tap a numbered badge to see what that part does.',
  closeInfo: 'Close',
  infoFor: 'Part info',
  partLabel: 'Part {n}: {name}. Show info',
  parts: {
    lamp: { name: 'Mercury lamp', short: 'Lamp', info: 'The high-pressure mercury lamp is the light source; it needs about a minute to reach full brightness.' },
    condenser: { name: 'Converging lens', short: 'Lens', info: 'This lens images the bright arc of the lamp onto the slit.' },
    slit: { name: 'Slit', short: 'Slit', info: 'The narrow slit makes the light source a thin line, so each colour forms a sharp line later.' },
    imaging: { name: 'Imaging lens', short: 'Lens', info: 'This lens focuses the image of the slit onto the emission window.' },
    prism: { name: 'Direct-vision prism', short: 'Prism', info: 'The prism splits white light into the mercury lines, each bent by a different amount.' },
    mirror: { name: 'Mirror', short: 'Mirror', info: 'The mirror folds the light path so the spectrum lands on the emission window.' },
    window: { name: 'Emission window', short: 'Window', info: 'The spectrum forms here as thin lines. The dimming slider covers it when the room is too bright.' },
    arm: { name: 'Swivelling arm', short: 'Arm', info: 'Turn the arm with its thread guide to bring one spectral line in front of the photocell.' },
    lens: { name: 'Lens with slit diaphragm', short: 'Lens', info: 'This lens with a slit diaphragm picks one line from the window and focuses it onto the cathode.' },
    cell: { name: 'Photocell', short: 'Cell', info: 'Light hitting the cathode frees electrons, which charge the capacitor through the ring anode.' },
  },
  lines: { yellow: 'Yellow', green: 'Green', blue: 'Blue', violet: 'Violet', uv: 'Ultraviolet' },
  windowZoom: 'Enlarged view of the emission window. The rectangle is the aperture in front of the photocell.',
  windowZoomCap: 'Emission window, enlarged',
  cellAperture: 'Cell aperture',
  lineNm: '{name} {nm} nm',
  aligned: 'Aligned: {line}',
  between: 'Between lines',
  armLabel: 'Swivelling arm position',
  armHelp: 'Arrow keys move in fine steps, Page Up and Page Down in coarse steps.',
  armValue: '{state}',
  lamp: 'Mercury lamp',
  lampOff: 'Off',
  lampOn: 'On',
  lampWarming: 'Warming up {pct} %',
  dimming: 'Window dimming',
  dimmingValue: '{pct} % open',
  cathode: 'Cathode',
  cathodes: { photocell: 'Photocell (K)', Cs: 'Caesium', Na: 'Sodium', K: 'Potassium', Zn: 'Zinc' },
  stray: 'Stray light',
  dirty: 'Dirty photocell',
  roomLights: 'Room lights on',
  photonEnergy: 'Photon energy hν',
  eV: 'eV',
  lampGlow: 'Lamp glow',
}

const es: BenchStrings = {
  figure: 'Vista superior del montaje compacto: lámpara, lentes, rendija, prisma y espejo llevan el espectro a la ventana de emisión, donde el brazo giratorio sostiene la fotocélula.',
  tapHint: 'Toca una insignia numerada para ver qué hace esa pieza.',
  closeInfo: 'Cerrar',
  infoFor: 'Información de la pieza',
  partLabel: 'Pieza {n}: {name}. Mostrar información',
  parts: {
    lamp: { name: 'Lámpara de mercurio', short: 'Lámpara', info: 'La lámpara de mercurio de alta presión es la fuente de luz; tarda cerca de un minuto en alcanzar el brillo completo.' },
    condenser: { name: 'Lente convergente', short: 'Lente', info: 'Esta lente forma la imagen del arco brillante de la lámpara sobre la rendija.' },
    slit: { name: 'Rendija', short: 'Rendija', info: 'La rendija estrecha convierte la fuente en una línea fina, y así cada color formará después una raya nítida.' },
    imaging: { name: 'Lente de imagen', short: 'Lente', info: 'Esta lente enfoca la imagen de la rendija sobre la ventana de emisión.' },
    prism: { name: 'Prisma de visión directa', short: 'Prisma', info: 'El prisma separa la luz blanca en las rayas del mercurio; cada una se desvía un ángulo distinto.' },
    mirror: { name: 'Espejo', short: 'Espejo', info: 'El espejo pliega el camino de la luz para que el espectro caiga sobre la ventana de emisión.' },
    window: { name: 'Ventana de emisión', short: 'Ventana', info: 'Aquí se forma el espectro como rayas finas. El regulador la tapa cuando la sala está demasiado iluminada.' },
    arm: { name: 'Brazo giratorio', short: 'Brazo', info: 'Gira el brazo con su guía de rosca para poner una raya espectral frente a la fotocélula.' },
    lens: { name: 'Lente con diafragma de rendija', short: 'Lente', info: 'Esta lente con diafragma de rendija elige una raya de la ventana y la enfoca sobre el cátodo.' },
    cell: { name: 'Fotocélula', short: 'Célula', info: 'La luz que llega al cátodo libera electrones, que cargan el condensador a través del ánodo en anillo.' },
  },
  lines: { yellow: 'Amarillo', green: 'Verde', blue: 'Azul', violet: 'Violeta', uv: 'Ultravioleta' },
  windowZoom: 'Vista ampliada de la ventana de emisión. El rectángulo es la abertura frente a la fotocélula.',
  windowZoomCap: 'Ventana de emisión, ampliada',
  cellAperture: 'Abertura de la célula',
  lineNm: '{name} {nm} nm',
  aligned: 'Alineada: {line}',
  between: 'Entre rayas',
  armLabel: 'Posición del brazo giratorio',
  armHelp: 'Las flechas mueven a pasos finos; Re Pág y Av Pág, a pasos grandes.',
  armValue: '{state}',
  lamp: 'Lámpara de mercurio',
  lampOff: 'Apagada',
  lampOn: 'Encendida',
  lampWarming: 'Calentando {pct} %',
  dimming: 'Regulador de la ventana',
  dimmingValue: '{pct} % abierta',
  cathode: 'Cátodo',
  cathodes: { photocell: 'Fotocélula (K)', Cs: 'Cesio', Na: 'Sodio', K: 'Potasio', Zn: 'Cinc' },
  stray: 'Luz parásita',
  dirty: 'Fotocélula sucia',
  roomLights: 'Luces de la sala encendidas',
  photonEnergy: 'Energía del fotón hν',
  eV: 'eV',
  lampGlow: 'Brillo de la lámpara',
}

export const strings: Strings<BenchStrings> = { en, es }
