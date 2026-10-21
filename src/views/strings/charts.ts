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
  systematic: string
  chi2red: string
  agree1: string
  agree2: string
  agree3: string
  short1: string
  short2: string
  short3: string
  sysNote: string
  errorBars: string
  r2: string
  readings: (n: number, lines: number) => string
  statTag: string
  sysTag: string
  combined: string
  excluded: string
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
    threshold: 'U₀ = 0 at',
    resultTitle: 'Result',
    rule: 'h = e × slope',
    slope: 'Slope',
    intercept: 'Intercept',
    planck: 'h',
    deviation: 'Deviation from literature',
    systematic: 'Meter systematic σ_sys (class limit / √3)',
    chi2red: 'χ² per degree of freedom',
    agree1: 'Accepted value within 1σ_tot.',
    agree2: 'Accepted value within 2σ_tot.',
    agree3: 'More than 2σ_tot from the accepted value: look for systematic errors.',
    short1: 'accepted value within 1σ_tot',
    short2: 'accepted value within 2σ_tot',
    short3: '>2σ_tot from accepted: look for systematic errors',
    sysNote:
      'Error bars and the statistical ± combine the scatter of repeated readings (s/√n) with the reading uncertainty of the needle, which does not average down. The meter\'s calibration error scales every point alike, so it is fully correlated: it tilts the line instead of scattering the points, and it is not in the error bars. It is given separately as a systematic, the class limit treated as a rectangular distribution (GUM): σ_sys = h × class / √3. The comparison with the accepted value uses σ_tot = √(σ_stat² + σ_sys²).',
    errorBars: 'bars: ±σ of the mean for each line',
    r2: 'r²',
    readings: (n, l) => `${n} ${n === 1 ? 'reading' : 'readings'}, ${l} ${l === 1 ? 'line' : 'lines'}`,
    statTag: 'stat',
    sysTag: 'sys',
    combined: 'Combined σ_tot (stat ⊕ sys)',
    excluded: 'Readings left out of the fit',
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
    threshold: 'U₀ = 0 en',
    resultTitle: 'Resultado',
    rule: 'h = e × pendiente',
    slope: 'Pendiente',
    intercept: 'Ordenada en el origen',
    planck: 'h',
    deviation: 'Desviación respecto al valor de referencia',
    systematic: 'Sistemático del multímetro σ_sys (límite de clase / √3)',
    chi2red: 'χ² por grado de libertad',
    agree1: 'Valor aceptado dentro de 1σ_tot.',
    agree2: 'Valor aceptado dentro de 2σ_tot.',
    agree3: 'A más de 2σ_tot del valor aceptado: busca errores sistemáticos.',
    short1: 'valor aceptado dentro de 1σ_tot',
    short2: 'valor aceptado dentro de 2σ_tot',
    short3: '>2σ_tot del aceptado: busca errores sistemáticos',
    sysNote:
      'Las barras de error y el ± estadístico combinan la dispersión de las lecturas repetidas (s/√n) con la incertidumbre de lectura de la aguja, que no se reduce al promediar. El error de calibración del multímetro afecta a todos los puntos por igual, así que está totalmente correlacionado: inclina la recta en vez de dispersar los puntos y no está en las barras de error. Se da aparte como sistemático, tratando el límite de clase como una distribución rectangular (GUM): σ_sys = h × clase / √3. La comparación con el valor aceptado usa σ_tot = √(σ_estad² + σ_sist²).',
    errorBars: 'barras: ±σ de la media de cada línea',
    r2: 'r²',
    readings: (n, l) => `${n} ${n === 1 ? 'lectura' : 'lecturas'}, ${l} ${l === 1 ? 'línea' : 'líneas'}`,
    statTag: 'estad.',
    sysTag: 'sist.',
    combined: 'σ_tot combinada (estad. ⊕ sist.)',
    excluded: 'Lecturas excluidas del ajuste',
    infoLabel: 'Sobre la ordenada en el origen',
    infoText:
      'La ordenada en el origen se relaciona con la función de trabajo del ánodo, no del cátodo: al conectarlos se igualan sus niveles de Fermi, así que los electrones deben vencer W_A + e·U₀.',
    noFit: 'Registra al menos dos líneas distintas para ver el ajuste.',
    lines: { yellow: 'amarilla', green: 'verde', blue: 'azul', violet: 'violeta', uv: 'UV' },
  },
}
