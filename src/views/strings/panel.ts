import type { Strings } from '../view.ts'

interface PanelStrings {
  meterTitle: string
  meterLabel: string // aria-label of dial
  unitVdc: string
  meterOff: string
  overRange: string
  needleAt: string // "Needle at {frac} % of full scale"
  rangeGroup: string
  rangeOff: string
  rangeOption: string // "{v} V"
  digital: string
  keyTitle: string
  keyLabel: string
  keyHold: string
  keyHeld: string
  keyHelp: string
  ampTitle: string
  ampPower: string
  ampNote: string
  stopwatch: string
  stopwatchIdle: string
  held: string
  settled: string
  settledHint: string
  speed: string
  speedOption: string // "{n}×"
  speedHelp: string
}

const en: PanelStrings = {
  meterTitle: 'Analog multimeter',
  meterLabel: 'Analog voltmeter dial',
  unitVdc: 'V DC',
  meterOff: 'Meter off',
  overRange: 'Over range',
  needleAt: 'Needle at {frac} % of full scale',
  rangeGroup: 'Voltage range',
  rangeOff: 'Off',
  rangeOption: '{v} V',
  digital: 'Reading',
  keyTitle: 'Key switch',
  keyLabel: 'Hold to discharge',
  keyHold: 'Discharging…',
  keyHeld: 'Release to start charging',
  keyHelp: 'Hold the button (or hold Space) to short the capacitor. Release it to let the photocell charge it again.',
  ampTitle: 'Electrometer amplifier',
  ampPower: 'Power on',
  ampNote: 'Lets the meter read the 100 pF capacitor without draining it.',
  stopwatch: 'Time since release',
  stopwatchIdle: 'Not released yet',
  held: 'Key held',
  settled: 'Settled',
  settledHint: 'The needle has stopped moving.',
  speed: 'Time speed',
  speedOption: '{n}×',
  speedHelp: 'Run the simulated clock faster to skip the wait.',
}

const es: PanelStrings = {
  meterTitle: 'Multímetro analógico',
  meterLabel: 'Escala del voltímetro analógico',
  unitVdc: 'V CC',
  meterOff: 'Medidor apagado',
  overRange: 'Fuera de escala',
  needleAt: 'Aguja al {frac} % del fondo de escala',
  rangeGroup: 'Rango de tensión',
  rangeOff: 'Apagado',
  rangeOption: '{v} V',
  digital: 'Lectura',
  keyTitle: 'Pulsador',
  keyLabel: 'Mantén para descargar',
  keyHold: 'Descargando…',
  keyHeld: 'Suelta para que empiece a cargarse',
  keyHelp: 'Mantén pulsado el botón (o la barra espaciadora) para cortocircuitar el condensador. Al soltarlo, la fotocélula vuelve a cargarlo.',
  ampTitle: 'Amplificador de electrómetro',
  ampPower: 'Encendido',
  ampNote: 'Permite medir el condensador de 100 pF sin descargarlo.',
  stopwatch: 'Tiempo desde que soltaste',
  stopwatchIdle: 'Aún sin soltar',
  held: 'Pulsador apretado',
  settled: 'Estabilizado',
  settledHint: 'La aguja ya no se mueve.',
  speed: 'Velocidad del tiempo',
  speedOption: '{n}×',
  speedHelp: 'Acelera el reloj simulado para saltarte la espera.',
}

export const strings: Strings<PanelStrings> = { en, es }
