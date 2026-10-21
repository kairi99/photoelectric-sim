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
  /** Shown under the table when some readings are flagged. */
  excludedNote: string
  /** Short tags for the measurement conditions of a non-clean group in the per-line summary. */
  cond: { dirty: string; stray: string; anode: string; quartz: string; cathodes: { photocell: string; Cs: string; Na: string; K: string; Zn: string } }
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
    summaryRule: 'Error bar = √(s²/n + u²): the scatter of the readings averages down with √n, the reading uncertainty u (needle readability) does not. Only valid readings are used, grouped by line and by conditions.',
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
    warnUnsettled: 'The voltage may not have settled. You may not have waited long enough. Excluded from the fit.',
    warnMisaligned: 'No spectral line was on the cell. This reading is excluded from the fit.',
    warnNotDischarged: 'Not discharged since the line changed: leftover charge may be in this reading. Excluded from the fit.',
    excludedNote: 'Readings marked ! stay in the table but are excluded from the fit.',
    cond: { dirty: 'dirty cell', stray: 'stray light', anode: 'anode emission', quartz: 'quartz', cathodes: { photocell: 'photocell', Cs: 'Cs cathode', Na: 'Na cathode', K: 'K cathode', Zn: 'Zn cathode' } },
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
    summaryRule: 'Barra de error = √(s²/n + u²): la dispersión de las lecturas se reduce con √n; la incertidumbre de lectura u (resolución de la aguja) no. Solo se usan lecturas válidas, agrupadas por línea y por condiciones.',
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
    warnUnsettled: 'Puede que la tensión no se haya estabilizado: quizá no esperaste lo suficiente. Excluida del ajuste.',
    warnMisaligned: 'Ninguna línea del espectro incidía en la célula. Esta lectura queda excluida del ajuste.',
    warnNotDischarged: 'Sin descargar desde el cambio de línea: la lectura puede incluir carga residual. Excluida del ajuste.',
    excludedNote: 'Las lecturas marcadas con ! siguen en la tabla pero quedan excluidas del ajuste.',
    cond: { dirty: 'célula sucia', stray: 'luz parásita', anode: 'emisión del ánodo', quartz: 'cuarzo', cathodes: { photocell: 'fotocélula', Cs: 'cátodo de Cs', Na: 'cátodo de Na', K: 'cátodo de K', Zn: 'cátodo de Zn' } },
    deleteRow: (n) => `Borrar la medida ${n}`,
    exportCsv: 'Exportar CSV',
    clearAll: 'Borrar todo',
    confirmClear: (n) => `¿Borrar las ${n} medidas?`,
    confirmYes: 'Borrar todo',
    confirmNo: 'Cancelar',
  },
}
