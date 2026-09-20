/**
 * Simplified, illustrative gust-response model for the wind-tunnel comparison.
 * Pure TypeScript (no React / DOM) so the numbers can be tested on their own.
 *
 * All values are teaching values, not verified engineering data.
 */

export type Phase = "steady" | "approaching" | "impact" | "recovering";

export type TunnelMetrics = {
  /** effective gust reaching the aircraft, 0..1 (peaks exactly at the slider value) */
  gust: number;
  deflection: number;
  load: number;
  stress: number;
  /** 0..1 fuselage vibration amount */
  shake: number;
};

export type SimState = {
  t: number;
  windSpeed: number;
  gustIntensity: number;
  /** seconds since APPLY GUST (only meaningful while eventActive) */
  eventT: number;
  eventActive: boolean;
  /** 0..1+ vertical position of the gust front (1 = bottom of tunnel, 0 = top) */
  frontY: number;
  showFront: boolean;
  /** smoothed gust envelope reaching the aircraft, 0..1 of the slider value */
  env: number;
  phase: Phase;
  tipRigid: number;
  tipFlex: number;
  /** peak wing-root load reached by each aircraft during the current event */
  peakRigid: number;
  peakFlex: number;
  rigid: TunnelMetrics;
  flex: TunnelMetrics;
};

// ---- event timeline (seconds after APPLY GUST) ------------------------------
const T_APPROACH_END = 1.1; // front reaches the wings
const T_RISE_END = 1.9; // gust envelope reaches 100% of the slider value
const T_IMPACT_END = 2.4; // peak plateau ends, gust starts to pass
const T_DECAY_END = 4.4; // gust envelope back to 0
const T_EVENT_END = 4.6; // status returns to STEADY AIR

// ---- illustrative model constants ------------------------------------------
const TIP_MAX_DEG = 26; // saturation of the hinged tip
const RIGID_TIP_MAX_DEG = 1; // elastic bending of the rigid wing, 0-1°
const LOAD_REF_KN = 38;
const GUST_LOAD_GAIN = 1.7;
const STRESS_PER_KN = 2.35; // MPa per kN, so stress follows load
const MAX_LOAD_RELIEF = 0.45; // share of the peak load the hinge can relieve

export function emptyMetrics(): TunnelMetrics {
  return { gust: 0, deflection: 0, load: 0, stress: 0, shake: 0 };
}

export function smoothstep(x: number): number {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
}

/** Gust envelope (0..1) as a function of time since APPLY GUST. */
export function envelopeAt(e: number): number {
  if (e < T_APPROACH_END) return 0;
  if (e < T_IMPACT_END) return smoothstep((e - T_APPROACH_END) / (T_RISE_END - T_APPROACH_END));
  if (e < T_DECAY_END) return 1 - smoothstep((e - T_IMPACT_END) / (T_DECAY_END - T_IMPACT_END));
  return 0;
}

/** Steady tip angle each aircraft is heading for, for a given effective gust (0..1). */
export function tipTargets(windSpeed: number, gust: number) {
  const q = (windSpeed * windSpeed) / 900;
  return {
    rigid: RIGID_TIP_MAX_DEG * gust,
    flex: TIP_MAX_DEG * (1 - Math.exp(-2.4 * gust)) * Math.min(1, 0.5 + q * 0.6),
  };
}

/** Load / stress / shake for both aircraft from the current gust and tip angles. */
export function computeMetrics(
  windSpeed: number,
  gustIntensity: number,
  env: number,
  tipRigid: number,
  tipFlex: number,
): { rigid: TunnelMetrics; flex: TunnelMetrics } {
  const gust = (gustIntensity / 100) * env; // identical for both aircraft
  const q = (windSpeed * windSpeed) / 900;

  const rigidLoad = LOAD_REF_KN * q * (1 + GUST_LOAD_GAIN * gust);
  const relief = MAX_LOAD_RELIEF * (tipFlex / TIP_MAX_DEG);
  const flexLoad = rigidLoad * (1 - relief);

  // The rigid wing passes the gust straight into the fuselage; the hinge
  // isolates part of it, so the flexible aircraft shakes noticeably less.
  const shakeRigid = Math.min(1, gust * (0.5 + 0.8 * q));
  const isolation = Math.min(0.6, relief * 2.6);

  return {
    rigid: {
      gust,
      deflection: tipRigid,
      load: rigidLoad,
      stress: rigidLoad * STRESS_PER_KN,
      shake: shakeRigid,
    },
    flex: {
      gust,
      deflection: tipFlex,
      load: flexLoad,
      stress: flexLoad * STRESS_PER_KN,
      shake: shakeRigid * (1 - isolation),
    },
  };
}

/** Wind-only condition (no gust) — used for the first paint and after Reset. */
export function baselineMetrics(windSpeed: number, gustIntensity: number) {
  return computeMetrics(windSpeed, gustIntensity, 0, 0, 0);
}

export function loadReductionPct(peakRigid: number, peakFlex: number): number {
  return peakRigid > 0 ? ((peakRigid - peakFlex) / peakRigid) * 100 : 0;
}

export function createSim(windSpeed: number, gustIntensity: number): SimState {
  return {
    t: 0,
    windSpeed,
    gustIntensity,
    eventT: 0,
    eventActive: false,
    frontY: 1.3,
    showFront: false,
    env: 0,
    phase: "steady",
    tipRigid: 0,
    tipFlex: 0,
    peakRigid: 0,
    peakFlex: 0,
    rigid: emptyMetrics(),
    flex: emptyMetrics(),
  };
}

export function startGust(s: SimState) {
  s.eventActive = true;
  s.eventT = 0;
  s.frontY = 1.3;
  s.showFront = true;
  s.peakRigid = 0;
  s.peakFlex = 0;
}

export function resetSim(s: SimState) {
  s.t = 0;
  s.eventT = 0;
  s.eventActive = false;
  s.showFront = false;
  s.frontY = 1.3;
  s.env = 0;
  s.tipRigid = 0;
  s.tipFlex = 0;
  s.peakRigid = 0;
  s.peakFlex = 0;
  s.phase = "steady";
}

/** Advance the whole simulation by dt seconds (mutates s). */
export function stepSim(s: SimState, dt: number) {
  s.t += dt;

  // ---- gust event timeline: approaches -> hits -> peak -> passes -> settles
  let envTarget = 0;
  if (s.eventActive) {
    s.eventT += dt;
    const e = s.eventT;
    if (e < T_APPROACH_END) {
      s.phase = "approaching";
      s.frontY = 1.3 - (e / T_APPROACH_END) * 0.8; // travels up toward the aircraft
      s.showFront = true;
    } else if (e < T_IMPACT_END) {
      s.phase = "impact";
      s.frontY = 0.5 - ((e - T_APPROACH_END) / (T_IMPACT_END - T_APPROACH_END)) * 0.35;
      s.showFront = true;
    } else if (e < T_EVENT_END) {
      s.phase = "recovering";
      s.frontY = 0.15 - ((e - T_IMPACT_END) / (T_EVENT_END - T_IMPACT_END)) * 0.45;
      s.showFront = e < 3.4;
    } else {
      s.eventActive = false;
      s.eventT = 0;
      s.phase = "steady";
      s.showFront = false;
      s.frontY = 1.3;
    }
    if (s.eventActive) envTarget = envelopeAt(e);
  } else {
    s.phase = "steady";
    s.showFront = false;
  }

  // Tiny lag so a re-triggered gust never makes the numbers jump; the
  // envelope still reaches 100% of the slider value during the peak.
  s.env += (envTarget - s.env) * Math.min(1, dt * 14);

  // ---- wingtip response: smooth first-order easing, never a jump
  const gust = (s.gustIntensity / 100) * s.env;
  const target = tipTargets(s.windSpeed, gust);
  s.tipRigid += (target.rigid - s.tipRigid) * Math.min(1, dt * 5);
  s.tipFlex += (target.flex - s.tipFlex) * Math.min(1, dt * 3.5);

  const m = computeMetrics(s.windSpeed, s.gustIntensity, s.env, s.tipRigid, s.tipFlex);
  s.rigid = m.rigid;
  s.flex = m.flex;

  // Each aircraft's own peak load during the event.
  if (s.eventActive) {
    s.peakRigid = Math.max(s.peakRigid, m.rigid.load);
    s.peakFlex = Math.max(s.peakFlex, m.flex.load);
  }
}
