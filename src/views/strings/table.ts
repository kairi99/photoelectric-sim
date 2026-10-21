import type { Strings } from '../view.ts'

interface S {
  title: string
  caption: string
  empty: string
  colLine: string
  colLambda: string
  colNu: string
  colU0: string
  colWait: string
  colN: string
  colMean: string
  colSd: string
  colSem: string
  sigmaLabel: string
  summaryTitle: string
  summaryCaption: string
  summaryRule: string
  errUncertainty: string
  colActions: string
  noLine: string
  lines: { yellow: string; green: string; blue: string; violet: string; uv: string }
  readingLabel: string
  readingHint: string
  record: string
  recordNow: string
  errInvalid: string
  errRequired: string
  errMeterOff: string
  warnUnsettled: string
  warnMisaligned: string
  /** Row marker: the capacitor was not discharged after the line was set (Measurement.dischargedSinceAlign === false). */
  warnNotDischarged: string
  deleteRow: (n: number) => string
  exportCsv: string
  clearAll: string
  confirmClear: (n: number) => string
  confirmYes: string
  confirmNo: string
}

export const strings: Strings<S> = {
  en: {
    title: 'Measurements',
    caption: 'Recorded limit voltages',
    empty: 'Record your first measurement after the needle stops moving.',
    colLine: 'Line',
    colLambda: 'λ (nm)',
    colNu: 'ν (THz)',
    colU0: 'U₀ ± σ (V)',
    colWait: 'Wait (s)',
    colN: 'n',
    colMean: 'Mean ± σ (V)',
    colSd: 's (V)',
    colSem: 's/√n (V)',
    sigmaLabel: 'Your reading uncertainty ± (V), optional',
    summaryTitle: 'Repeated readings per line',
    summaryCaption: 'Mean, spread and standard error for each line',
    summaryRule: 'σ of the mean = larger of s and the reading uncertainty, divided by √n. This is the error bar used in the fit.',
    errUncertainty: 'The uncertainty must be a positive number of volts (leave it empty for the default).',
    colActions: 'Delete',
    noLine: 'No line',
    lines: { yellow: 'Yellow', green: 'Green', blue: 'Blue', violet: 'Violet', uv: 'UV' },
    readingLabel: 'Value read from the needle (V)',
    readingHint: 'e.g. 0.62',
    record: 'Record',
    recordNow: 'Record current value',
    errInvalid: 'Enter a voltage between 0 and 30 V.',
    errRequired: 'Type the value you read on the meter first.',
    errMeterOff: 'The multimeter is off, so there is nothing to record.',
    warnUnsettled: 'The voltage may not have settled. You may not have waited long enough.',
    warnMisaligned: 'No spectral line was on the cell. This point cannot be used in the fit.',
    warnNotDischarged: 'Not discharged since the line changed: leftover charge may be in this reading.',
    deleteRow: (n) => `Delete measurement ${n}`,
    exportCsv: 'Export CSV',
    clearAll: 'Clear all',
    confirmClear: (n) => `Delete all ${n} measurements?`,
    confirmYes: 'Delete all',
    confirmNo: 'Cancel',
  },
  es: {
    title: 'Mediciones',
    caption: 'Tensiones límite registradas',
    empty: 'Registra tu primera medida cuando la aguja deje de moverse.',
    colLine: 'Línea',
    colLambda: 'λ (nm)',
    colNu: 'ν (THz)',
    colU0: 'U₀ ± σ (V)',
    colWait: 'Espera (s)',
    colN: 'n',
    colMean: 'Media ± σ (V)',
    colSd: 's (V)',
    colSem: 's/√n (V)',
    sigmaLabel: 'Tu incertidumbre de lectura ± (V), opcional',
    summaryTitle: 'Lecturas repetidas por línea',
    summaryCaption: 'Media, dispersión y error estándar de cada línea',
    summaryRule: 'σ de la media = el mayor entre s y la incertidumbre de lectura, dividido por √n. Es la barra de error que usa el ajuste.',
    errUncertainty: 'La incertidumbre debe ser un número positivo de voltios (déjala vacía para usar el valor por defecto).',
    colActions: 'Borrar',
    noLine: 'Sin línea',
    lines: { yellow: 'Amarilla', green: 'Verde', blue: 'Azul', violet: 'Violeta', uv: 'UV' },
    readingLabel: 'Valor leído en la aguja (V)',
    readingHint: 'p. ej. 0,62',
    record: 'Registrar',
    recordNow: 'Registrar el valor actual',
    errInvalid: 'Introduce una tensión entre 0 y 30 V.',
    errRequired: 'Primero escribe el valor que lees en el multímetro.',
    errMeterOff: 'El multímetro está apagado, no hay nada que registrar.',
    warnUnsettled: 'Puede que la tensión no se haya estabilizado: quizá no esperaste lo suficiente.',
    warnMisaligned: 'Ninguna línea del espectro incidía en la célula. Este punto no sirve para el ajuste.',
    warnNotDischarged: 'Sin descargar desde el cambio de línea: la lectura puede incluir carga residual.',
    deleteRow: (n) => `Borrar la medida ${n}`,
    exportCsv: 'Exportar CSV',
    clearAll: 'Borrar todo',
    confirmClear: (n) => `¿Borrar las ${n} medidas?`,
    confirmYes: 'Borrar todo',
    confirmNo: 'Cancelar',
  },
}
