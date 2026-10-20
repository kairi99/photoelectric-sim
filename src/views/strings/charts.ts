import type { Strings } from '../view.ts'

interface S {
  liveTitle: string
  liveAria: (n: number, latest: string) => string
  liveEmpty: string
  xTime: string
  yVoltage: string
  settled: string
  idealU0: string
  fitTitle: string
  fitAria: (n: number, summary: string) => string
  fitEmpty: string
  xFreq: string
  yU0: string
  showIdeal: string
  idealLine: string
  fitLine: string
  threshold: string
  resultTitle: string
  rule: string
  slope: string
  intercept: string
  planck: string
  deviation: string
  r2: string
  nPoints: (n: number) => string
  infoLabel: string
  infoText: string
  noFit: string
  lines: { yellow: string; green: string; blue: string; violet: string; uv: string }
}

export const strings: Strings<S> = {
  en: {
    liveTitle: 'Capacitor voltage',
    liveAria: (n, latest) => `Voltage against time since the key was released. ${n} readings, latest ${latest}.`,
    liveEmpty: 'Release the key to start the trace.',
    xTime: 'time since release (s)',
    yVoltage: 'U (V)',
    settled: 'Settled',
    idealU0: 'ideal U₀',
    fitTitle: 'Limit voltage against frequency',
    fitAria: (n, summary) => `Limit voltage U0 against frequency. ${n} points. ${summary}`,
    fitEmpty: 'No points yet.',
    xFreq: 'frequency ν (THz)',
    yU0: 'U₀ (V)',
    showIdeal: 'Show ideal line',
    idealLine: 'ideal',
    fitLine: 'fit',
    threshold: 'extrapolated U₀ = 0 (not the emission threshold) at',
    resultTitle: 'Result',
    rule: 'h = e × slope',
    slope: 'Slope',
    intercept: 'Intercept',
    planck: 'h',
    deviation: 'Deviation from literature',
    r2: 'r²',
    nPoints: (n) => `${n} points`,
    infoLabel: 'About the intercept',
    infoText:
      'The intercept is related to the work function of the anode, not the cathode: when the two are connected their Fermi levels align, so the electrons must overcome W_A + e·U₀.',
    noFit: 'Record at least two different lines to see the fit.',
    lines: { yellow: 'yellow', green: 'green', blue: 'blue', violet: 'violet', uv: 'UV' },
  },
  es: {
    liveTitle: 'Tensión del condensador',
    liveAria: (n, latest) => `Tensión frente al tiempo desde que se soltó el pulsador. ${n} lecturas, la última ${latest}.`,
    liveEmpty: 'Suelta el pulsador para iniciar la gráfica.',
    xTime: 'tiempo desde la suelta (s)',
    yVoltage: 'U (V)',
    settled: 'Estabilizada',
    idealU0: 'U₀ ideal',
    fitTitle: 'Tensión límite frente a frecuencia',
    fitAria: (n, summary) => `Tensión límite U0 frente a la frecuencia. ${n} puntos. ${summary}`,
    fitEmpty: 'Aún no hay puntos.',
    xFreq: 'frecuencia ν (THz)',
    yU0: 'U₀ (V)',
    showIdeal: 'Mostrar recta ideal',
    idealLine: 'ideal',
    fitLine: 'ajuste',
    threshold: 'U₀ = 0 extrapolado (no es el umbral de emisión) en',
    resultTitle: 'Resultado',
    rule: 'h = e × pendiente',
    slope: 'Pendiente',
    intercept: 'Ordenada en el origen',
    planck: 'h',
    deviation: 'Desviación respecto al valor de referencia',
    r2: 'r²',
    nPoints: (n) => `${n} puntos`,
    infoLabel: 'Sobre la ordenada en el origen',
    infoText:
      'La ordenada en el origen se relaciona con la función de trabajo del ánodo, no del cátodo: al conectarlos se igualan sus niveles de Fermi, así que los electrones deben vencer W_A + e·U₀.',
    noFit: 'Registra al menos dos rayas distintas para ver el ajuste.',
    lines: { yellow: 'amarilla', green: 'verde', blue: 'azul', violet: 'violeta', uv: 'UV' },
  },
}
