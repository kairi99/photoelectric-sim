// Strings for the 3D bench (scene overlay, view toggle, part names and one-line explanations).
import type { Strings } from '../view.ts'

const en = {
  viewLabel: 'Bench view',
  view3d: '3D',
  view2d: '2D',
  figure: '3D model of the experimental setup. Drag empty space to orbit, pinch or scroll to zoom. Drag the arm knob, press the red key, turn the meter knob or flip the choke switch to operate it. The same controls are in the control panel, opened with the Show controls button below the view.',
  canvasLabel: '3D bench. With this focused, the arrow keys orbit the view and plus and minus zoom. The same controls are in the control panel, opened with the Show controls button below the view.',
  loading: 'Loading the 3D bench…',
  fallbackNote: 'The 3D bench needs WebGL2, which is not available here. Showing the 2D bench.',
  failNote: 'The 3D bench could not start. Showing the 2D bench.',
  presetsLabel: 'Camera views',
  roomLights: 'Room lights',
  presets: { overview: 'Overview', optics: 'Optics', meter: 'Meter', top: 'Top view' },
  close: 'Close',
  goToControl: 'Go to control',
  parts: {
    '1': { name: 'Mercury lamp', info: 'High-pressure Hg lamp. It needs about a minute to warm up before the lines reach full brightness.' },
    '2': { name: 'Slider', info: 'Slider at the lamp end of the tube; it limits the light entering the arrangement.' },
    '3': { name: 'Converging lens', info: 'Focuses the lamp light onto the slit.' },
    '4': { name: 'Slit', info: 'Makes a narrow, well-defined source for the spectrum.' },
    '5': { name: 'Imaging lens', info: 'Images the slit onto the emission window (12), through the prism.' },
    '6': { name: 'Direct-vision prism', info: 'Splits the light into the Hg lines without bending the central ray.' },
    '7': { name: 'Mirror', info: 'Sends the spectrum down into the housing, towards the photocell window.' },
    '8.1': { name: 'BNC socket (cathode)', info: 'Screened-cable socket to the electrometer amplifier input; it carries the cathode potential.' },
    '8.2': { name: '4 mm sockets (ring anode)', info: 'The ring anode is connected here; it is wired to the amplifier common.' },
    '9': { name: 'Swivelling arm', info: 'Swings the photocell across the spectrum to pick one spectral line.' },
    '10': { name: 'Lens with slit diaphragm', info: 'Narrows the beam so that only one line reaches the cathode.' },
    '11': { name: 'Photocell', info: 'Vacuum photocell with a potassium cathode and a ring anode.' },
    '12': { name: 'Window and dimming slider', info: 'Window of the housing. The slider covers it against room light; it does not dim the beam on the cathode.' },
    choke: { name: 'Universal choke', info: 'Ballast that powers the mercury lamp.' },
    amplifier: { name: 'Electrometer amplifier', info: 'Very high input resistance buffer: it reads the photocell voltage without draining the capacitor.' },
    capacitor: { name: 'Capacitor 100 pF', info: 'Charges to the limit voltage U0 and holds it while you read the meter.' },
    key: { name: 'Key switch', info: 'Press to discharge the capacitor, release to start a measurement.' },
    supply: { name: 'Plug-in power supply 12 V', info: 'Powers the electrometer amplifier.' },
    meter: { name: 'Multimeter', info: 'Analog multimeter that reads the amplifier output, equal to the limit voltage U0. Its needle has a mechanical zero: use Go to control to reach the zero-adjust slider, and set it with the key held.' },
    meterKnob: { name: 'Range dial', info: 'Selects the measuring range of the multimeter.' },
    cables: { name: 'Cables', info: 'Screened and 4 mm cables joining the cell, capacitor, key, amplifier and meter.' },
  },
}
type Dict = typeof en

const es: Dict = {
  viewLabel: 'Vista del banco',
  view3d: '3D',
  view2d: '2D',
  figure: 'Modelo 3D del montaje experimental. Arrastra el espacio vacío para orbitar, pellizca o usa la rueda para acercar. Arrastra la perilla del brazo, pulsa el pulsador rojo, gira la perilla del multímetro o acciona el interruptor del estrangulador para manejarlo. Los mismos controles están en el panel de controles, que se abre con el botón Mostrar controles bajo la vista.',
  canvasLabel: 'Banco 3D. Con el foco aquí, las flechas orbitan la vista y más y menos acercan. Los mismos controles están en el panel de controles, que se abre con el botón Mostrar controles bajo la vista.',
  loading: 'Cargando el banco 3D…',
  fallbackNote: 'El banco 3D necesita WebGL2, que no está disponible aquí. Se muestra el banco 2D.',
  failNote: 'No se pudo iniciar el banco 3D. Se muestra el banco 2D.',
  presetsLabel: 'Vistas de cámara',
  roomLights: 'Luces de la sala',
  presets: { overview: 'General', optics: 'Óptica', meter: 'Medidor', top: 'Planta' },
  close: 'Cerrar',
  goToControl: 'Ir al control',
  parts: {
    '1': { name: 'Lámpara de mercurio', info: 'Lámpara de Hg de alta presión. Necesita cerca de un minuto de calentamiento para que las líneas alcancen su brillo pleno.' },
    '2': { name: 'Corredera', info: 'Corredera en el extremo de la lámpara; limita la luz que entra al conjunto.' },
    '3': { name: 'Lente convergente', info: 'Concentra la luz de la lámpara sobre la rendija.' },
    '4': { name: 'Rendija', info: 'Crea una fuente estrecha y bien definida para el espectro.' },
    '5': { name: 'Lente de imagen', info: 'Forma la imagen de la rendija en la ventana de emisión (12), a través del prisma.' },
    '6': { name: 'Prisma de visión directa', info: 'Separa la luz en las líneas del Hg sin desviar el rayo central.' },
    '7': { name: 'Espejo', info: 'Envía el espectro hacia abajo, a la carcasa, en dirección a la ventana de la fotocélula.' },
    '8.1': { name: 'Conector BNC (cátodo)', info: 'Conector del cable apantallado a la entrada del amplificador del electrómetro; lleva el potencial del cátodo.' },
    '8.2': { name: 'Bornes de 4 mm (ánodo anular)', info: 'Aquí se conecta el ánodo anular; va unido a la masa del amplificador.' },
    '9': { name: 'Brazo giratorio', info: 'Desplaza la fotocélula a lo largo del espectro para elegir una línea espectral.' },
    '10': { name: 'Lente con diafragma de rendija', info: 'Estrecha el haz para que solo una línea llegue al cátodo.' },
    '11': { name: 'Fotocélula', info: 'Fotocélula de vacío con cátodo de potasio y ánodo anular.' },
    '12': { name: 'Ventana y corredera de atenuación', info: 'Ventana de la carcasa. La corredera la tapa contra la luz ambiente; no atenúa el haz sobre el cátodo.' },
    choke: { name: 'Estrangulador universal', info: 'Balasto que alimenta la lámpara de mercurio.' },
    amplifier: { name: 'Amplificador de electrómetro', info: 'Adaptador de resistencia de entrada muy alta: lee la tensión de la fotocélula sin descargar el condensador.' },
    capacitor: { name: 'Condensador de 100 pF', info: 'Se carga hasta la tensión límite U0 y la mantiene mientras lees el medidor.' },
    key: { name: 'Pulsador', info: 'Púlsalo para descargar el condensador y suéltalo para iniciar una medida.' },
    supply: { name: 'Fuente enchufable de 12 V', info: 'Alimenta el amplificador del electrómetro.' },
    meter: { name: 'Multímetro', info: 'Multímetro analógico que lee la salida del amplificador, igual a la tensión límite U0. Su aguja tiene un cero mecánico: con Ir al control llegas al deslizador de ajuste del cero; ajústalo con el pulsador apretado.' },
    meterKnob: { name: 'Selector de rango', info: 'Elige el rango de medida del multímetro.' },
    cables: { name: 'Cables', info: 'Cables apantallados y de 4 mm que unen la célula, el condensador, el pulsador, el amplificador y el medidor.' },
  },
}

export const strings: Strings<Dict> = { en, es }
export type Bench3DStrings = Dict

/** Resolve a dot path such as 'parts.1.name'. Part ids contain dots ('8.1'), so match greedily against object keys. */
export function lookup(obj: unknown, path: string): string {
  const walk = (o: unknown, rest: string): string | undefined => {
    if (typeof o === 'string') return rest === '' ? o : undefined
    if (typeof o !== 'object' || o === null) return undefined
    for (const k of Object.keys(o)) {
      if (rest === k) { const v = (o as Record<string, unknown>)[k]; if (typeof v === 'string') return v }
      if (rest.startsWith(k + '.')) { const r = walk((o as Record<string, unknown>)[k], rest.slice(k.length + 1)); if (r !== undefined) return r }
    }
    return undefined
  }
  return walk(obj, path) ?? path
}
