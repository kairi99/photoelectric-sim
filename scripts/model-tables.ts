// Prints the numbers quoted in PARAMETERS.md / README, computed from the current model (nothing is written).
// Run with: node scripts/model-tables.ts   (Node 24+ strips types natively).
import { Apparatus, STRAY_PRESET_FRACTION } from '../src/apparatus/index.ts'
import {
  ANODE_ILLUM_FRACTION, C_DA_F, C_TOTAL_F, H_Js, HG_LAMP_POWER, HG_LINES, IDEAL, I_REF_A, K_B_eV_perK, LAB, OPTICS_TRANSMISSION,
  R_CELL_DIRTY_Ohm, R_INPUT_Ohm, TAU_DA_s, T_ROOM_K, W_A_eV, chargeCurve, forwardCurrent_A, getLine, limitVoltage_V, linePower,
  linearFit, maxContributingU0_V, nuFromLambda, photocurrent_A, photonEnergy_eV, planckFromFit, qeFactor, reverseCurrent_A, step,
  steadyState_V, CATHODES,
} from '../src/physics/index.ts'
import type { CircuitInputs, HgLineId } from '../src/physics/index.ts'

const VIS: HgLineId[] = ['yellow', 'green', 'blue', 'violet']
const NU = VIS.map((l) => nuFromLambda(getLine(l).lambda_nm))
const f3 = (x: number): string => x.toFixed(3)
const h34 = (h: number): string => (h / 1e-34).toFixed(2)
const pct = (h: number): string => `${(((h - H_Js) / H_Js) * 100).toFixed(1)} %`
type Extra = Partial<Omit<CircuitInputs, 'line'>>
const plateaus = (base: Extra, extra: Extra = {}): number[] => VIS.map((l) => steadyState_V({ ...base, ...extra, line: l }))
const fitH = (U: number[]): number => planckFromFit(linearFit(NU, U).slope)
const row = (label: string, U: number[]): string => `| ${label} | ${U.map(f3).join(' | ')} | ${h34(fitH(U))} | ${pct(fitH(U))} |`

console.log('## Lab calibration')
console.log(`W_A=${W_A_eV} I_REF_A=${I_REF_A} stray=${LAB.params.stray_fraction} R_cell=${LAB.params.R_cell_Ohm}`)
console.log('| Line | U(30 s) | U(60 s) | U(120 s) | U(600 s) | Steady | Table 1 | Residual | Ideal U0 |')
const T1 = [0.59, 0.70, 1.23, 1.40]
VIS.forEach((l, i) => {
  const p = { ...LAB.params, line: l }
  const c = chargeCurve(p, 600, 600)
  const ss = steadyState_V(p)
  console.log(`| ${l} ${getLine(l).lambda_nm.toFixed(0)} | ${[30, 60, 120, 600].map((t) => f3(c.U_V[t]!)).join(' | ')} | ${f3(ss)} | ${T1[i]} | ${(ss - T1[i]! >= 0 ? '+' : '') + f3(ss - T1[i]!)} | ${f3(limitVoltage_V(NU[i]!))} |`)
})
const labU = plateaus(LAB.params)
console.log(`Lab fitted h = ${h34(fitH(labU))} (${pct(fitH(labU))}); U(50 s) - steady: ${VIS.map((l) => f3(chargeCurve({ ...LAB.params, line: l }, 50, 50).U_V[50]! - steadyState_V({ ...LAB.params, line: l }))).join(' ')}`)

console.log('\n## h deficit breakdown (steady states)')
console.log('| Case | yellow | green | blue | violet | h (1e-34) | vs true |\n|---|---|---|---|---|---|---|')
const L = LAB.params
// Lab-brightness baseline for the breakdown (IDEAL.params carries the brighter Explore source).
const LAB_BASE: Extra = { ...IDEAL.params, I_ref_A: I_REF_A }
const bare: Extra = { ...IDEAL.params }
console.log(row('Ideal', plateaus(LAB_BASE)))
console.log(row('Electrometer input resistance only (1e13 Ohm)', plateaus(LAB_BASE, { R_input_Ohm: R_INPUT_Ohm })))
console.log(row('Leakage alone (cell + input)', plateaus(LAB_BASE, { R_cell_Ohm: L.R_cell_Ohm, R_input_Ohm: R_INPUT_Ohm })))
console.log(row('Stray light alone (input resistance only)', plateaus(LAB_BASE, { R_input_Ohm: R_INPUT_Ohm, stray_fraction: L.stray_fraction })))
console.log(row('Anode (reverse) current alone (input resistance only)', plateaus(LAB_BASE, { R_input_Ohm: R_INPUT_Ohm, anode_fraction: L.anode_fraction })))
console.log(row('Thermal tail alone (T = 298 K, input resistance only)', plateaus(LAB_BASE, { R_input_Ohm: R_INPUT_Ohm, T_K: T_ROOM_K })))
console.log(row('Leakage + stray light', plateaus(LAB_BASE, { R_cell_Ohm: L.R_cell_Ohm, stray_fraction: L.stray_fraction })))
console.log(row('Leakage + stray + anode', plateaus(L, { T_K: 0 })))
console.log(row('Leakage + stray + thermal tail', plateaus(L, { anode_fraction: 0 })))
console.log(row('Full LAB (all effects)', labU))
console.log(row('LAB without anode emission', plateaus(L, { anode_fraction: 0 })))
console.log(row('LAB without thermal tail', plateaus(L, { T_K: 0 })))
void bare

console.log('\n## Lab intensity')
for (const b of [1, 0.25]) console.log(`beam ${b}:`, plateaus(L, { beamIntensity: b }).map(f3).join(' '), h34(fitH(plateaus(L, { beamIntensity: b }))))

console.log('\n## Explore error toggles')
console.log('| Case | yellow | green | blue | violet | h | vs ideal |\n|---|---|---|---|---|---|---|')
const WITH_IN: Extra = { R_input_Ohm: R_INPUT_Ohm }
console.log(row('Clean (ideal)', plateaus(IDEAL.params)))
console.log(row('Dirty cell', plateaus(IDEAL.params, { ...WITH_IN, R_cell_Ohm: R_CELL_DIRTY_Ohm })))
console.log(row(`Stray ${STRAY_PRESET_FRACTION}`, plateaus(IDEAL.params, { ...WITH_IN, stray_fraction: STRAY_PRESET_FRACTION })))
console.log(row(`Anode emission ${ANODE_ILLUM_FRACTION}`, plateaus(IDEAL.params, { ...WITH_IN, anode_fraction: ANODE_ILLUM_FRACTION })))
console.log(row('Input resistance only', plateaus(IDEAL.params, WITH_IN)))
console.log('\nstray scan (explore):')
for (const s of [5e-6, 1e-5, 1.5e-5, 1.7e-5, 1.9e-5, 2e-5, 3e-5, 1e-4]) {
  const U = plateaus(IDEAL.params, { ...WITH_IN, stray_fraction: s })
  console.log(s, U.map(f3).join(' '), h34(fitH(U)), pct(fitH(U)))
}
console.log('\nanode scan (explore):')
for (const s of [0.001, 0.002, 0.005, 0.01, 0.02, 0.05]) {
  const U = plateaus(IDEAL.params, { ...WITH_IN, anode_fraction: s })
  console.log(s, U.map(f3).join(' '), h34(fitH(U)), pct(fitH(U)))
}

console.log('\n## Lines')
console.log('| Line | lambda | h nu | lamp | glass T | quartz T | rel (glass) | rel (quartz) | QE cathode | QE anode | I_sat lab (pA) | Ideal U0 |')
for (const l of HG_LINES) {
  const nu = nuFromLambda(l.lambda_nm)
  console.log(`| ${l.id} | ${l.lambda_nm} | ${photonEnergy_eV(nu).toFixed(3)} | ${HG_LAMP_POWER[l.id]} | ${OPTICS_TRANSMISSION.glass[l.id]} | ${OPTICS_TRANSMISSION.quartz[l.id]} | ${linePower(l.id, 'glass').toFixed(3)} | ${linePower(l.id, 'quartz').toFixed(3)} | ${qeFactor(nu, CATHODES.photocell.W_C_eV).toFixed(3)} | ${qeFactor(nu, W_A_eV).toFixed(3)} | ${((forwardCurrent_A(0, l.id, { ...IDEAL.params, I_ref_A: I_REF_A, stray_fraction: 0 })) * 1e12).toFixed(1)} | ${f3(limitVoltage_V(nu))} |`)
}
console.log('reverse current at 0.8 V / 0.3 V (pA, own line only, Lab anode fraction, unit lamp):')
for (const l of VIS) console.log(l, (reverseCurrent_A(0.8, l, { anode_fraction: ANODE_ILLUM_FRACTION, I_ref_A: I_REF_A }) * 1e12).toFixed(3), (reverseCurrent_A(0.3, l, { anode_fraction: ANODE_ILLUM_FRACTION, I_ref_A: I_REF_A }) * 1e12).toFixed(3), 'fwd(0)=', (forwardCurrent_A(0, l, { I_ref_A: I_REF_A }) * 1e12).toFixed(2))

console.log('\n## Thermal tail (blue, Lab params)')
{
  const nu = NU[2]!
  const U0 = limitVoltage_V(nu)
  const kT = K_B_eV_perK * T_ROOM_K
  console.log('kT =', kT.toFixed(5), 'eV; U0 =', f3(U0))
  for (const k of [-3, -1, 0, 1, 3, 6]) {
    const U = U0 + k * kT
    console.log(`U0${k >= 0 ? '+' : ''}${k}kT`, `F_T=${(forwardCurrent_A(U, 'blue', { T_K: T_ROOM_K, I_ref_A: 1 }) / forwardCurrent_A(0, 'blue', { T_K: T_ROOM_K, I_ref_A: 1 })).toExponential(2)}`)
  }
  console.log('bound', f3(maxContributingU0_V('blue', { T_K: T_ROOM_K })), 'vs U0', f3(U0))
}

console.log('\n## Quartz UV (explore)')
for (const optics of ['glass', 'quartz'] as const) {
  const p = { ...IDEAL.params, optics, line: 'uv' as HgLineId }
  console.log(optics, 'UV plateau', f3(steadyState_V(p)), 'I_sat(0) pA', (photocurrent_A(0, 'uv', p) * 1e12).toFixed(2))
}
{
  const U = (['yellow', 'green', 'blue', 'violet', 'uv'] as HgLineId[]).map((l) => steadyState_V({ ...IDEAL.params, optics: 'quartz', line: l }))
  const nu5 = (['yellow', 'green', 'blue', 'violet', 'uv'] as HgLineId[]).map((l) => nuFromLambda(getLine(l).lambda_nm))
  console.log('5-point quartz fit h', h34(planckFromFit(linearFit(nu5, U).slope)), U.map(f3).join(' '))
}

console.log('\n## Dielectric absorption (Lab leakage vs leak-free)')
{
  const dark = { relPower: { yellow: 0, green: 0, blue: 0, violet: 0, uv: 0 } }
  console.log(`C_da=${C_DA_F} F tau=${TAU_DA_s} s; recovered fraction (asymptotic, no leak) = ${(C_DA_F / (C_TOTAL_F + C_DA_F)).toExponential(2)}`)
  for (const hold of [0.5, 1, 5, 20, 60]) {
    for (const leak of [false, true]) {
      const inp: CircuitInputs = { ...LAB.params, ...dark, line: 'violet', ...(leak ? {} : { R_cell_Ohm: 1e21, R_input_Ohm: 1e21 }) }
      let s = { U_V: 1.4, Uda_V: 1.4 }
      s = step(s, { ...inp, keyPressed: true }, hold)
      let peak = 0
      for (let t = 0; t < 900; t += 1) { s = step(s, inp, 1); peak = Math.max(peak, s.U_V) }
      console.log(`hold ${hold} s, ${leak ? 'Lab leakage' : 'no leakage'}: peak soak-back ${(peak * 1e3).toFixed(3)} mV (${((peak / 1.4) * 100).toFixed(4)} % of 1.4 V)`)
    }
  }
}

console.log('\n## AMBIENT_REL (Lab, room lights on, 120 s reading)')
{
  const read = (cover: number, id: HgLineId, room: boolean): number => {
    const a = new Apparatus({ mode: 'lab', seed: 1 })
    a.setRoomLights(room); a.setWindowCover(cover); a.setRange(3); a.setLamp(true); a.setSpeed(5)
    for (let t = 0; t < 70; t += 5) a.tick(1)
    a.setArm(a.linePosition(id)); a.pressKey(); a.tick(2); a.releaseKey()
    for (let t = 0; t < 120; t += 5) a.tick(1)
    return a.serialize().U_V
  }
  for (const [cover, room] of [[0, false], [0, true], [0.5, true], [1, true]] as const) console.log(`cover ${cover} room ${room}:`, VIS.map((l) => f3(read(cover, l, room))).join(' '))
}
