import { useEffect, useRef, useState } from "react";
import { ActionButton, DataCard, Note, Panel, Slider } from "./ui";

export type TunnelMetrics = {
  deflection: number;
  load: number;
  stress: number;
  shake: number;
  gust: number;
};

type Phase = "steady" | "approaching" | "impact" | "recovering";

type SimState = {
  t: number;
  running: boolean;
  windSpeed: number;
  gustIntensity: number;
  /** 0 = no event running, else elapsed seconds since APPLY GUST */
  eventT: number;
  eventActive: boolean;
  /** 0..1 vertical position of the gust front (1 = bottom of tunnel, 0 = top) */
  frontY: number;
  showFront: boolean;
  /** smoothed effective gust reaching the aircraft, 0..1 of slider value */
  env: number;
  phase: Phase;
  tipRigid: number;
  tipFlex: number;
  peakRigid: number;
  peakFlex: number;
  rigid: TunnelMetrics;
  flex: TunnelMetrics;
};

function emptyMetrics(): TunnelMetrics {
  return { deflection: 0, load: 0, stress: 0, shake: 0, gust: 0 };
}

/** Rear, slightly elevated aircraft view rendered with shaded polygons for a 3D-like look. */
function drawAircraft(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  opts: { deflection: number; shake: number; accent: string; time: number },
) {
  const { deflection, shake, accent, time } = opts;

  const cameraElevationDeg = 15;
  const cameraAzimuthDeg = 12;
  const elevation = cameraElevationDeg / 90;
  const azimuth = cameraAzimuthDeg / 90;
  const viewOffsetX = w * azimuth * 0.12;
  const cx = w / 2 + viewOffsetX + Math.sin(time * 37) * shake * 5.5;
  const cy = h * (0.57 + elevation * 0.02) + Math.cos(time * 53) * shake * 3.3;
  const roll = Math.sin(time * 29) * shake * 0.024;

  const span = Math.min(w * 0.4, 245);
  const innerSpan = span * 0.63;
  const farWingScale = 0.92;
  const nearWingScale = 1.06;
  const rootChord = Math.max(14, h * 0.07);
  const tipChord = rootChord * 0.52;
  const wingY = 0;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(roll);

  ctx.fillStyle = "rgba(88,138,170,0.82)";
  ctx.beginPath();
  ctx.moveTo(-rootChord * 0.34, -h * 0.25);
  ctx.lineTo(rootChord * 0.12, -h * 0.25);
  ctx.lineTo(rootChord * 0.62, rootChord * 0.52);
  ctx.lineTo(-rootChord * 0.52, rootChord * 0.52);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(185,225,240,0.42)";
  ctx.beginPath();
  ctx.moveTo(-rootChord * 0.08, -h * 0.245);
  ctx.lineTo(rootChord * 0.38, rootChord * 0.44);
  ctx.lineTo(-rootChord * 0.02, rootChord * 0.24);
  ctx.lineTo(-rootChord * 0.38, rootChord * 0.43);
  ctx.closePath();
  ctx.fill();

  const wing = (dir: 1 | -1) => {
    const tipAngle = (-dir * deflection * Math.PI) / 180;
    const sideScale = dir === 1 ? farWingScale : nearWingScale;
    const sideInnerSpan = innerSpan * sideScale;
    const sideSpan = span * sideScale;

    ctx.save();
    ctx.rotate(tipAngle * 0.08);
    const wingGrad = ctx.createLinearGradient(0, -rootChord, 0, rootChord);
    wingGrad.addColorStop(0, "rgba(225,245,252,0.95)");
    wingGrad.addColorStop(0.48, "rgba(145,188,210,0.94)");
    wingGrad.addColorStop(1, "rgba(55,90,118,0.98)");
    ctx.fillStyle = wingGrad;
    ctx.beginPath();
    ctx.moveTo(dir * rootChord * 0.35, wingY - rootChord * 0.34);
    ctx.lineTo(dir * sideInnerSpan, wingY - tipChord * 0.30);
    ctx.lineTo(dir * sideInnerSpan, wingY + tipChord * 0.48);
    ctx.lineTo(dir * rootChord * 0.35, wingY + rootChord * 0.50);
    ctx.closePath();
    ctx.fill();

    ctx.save();
    ctx.translate(dir * sideInnerSpan, wingY);
    ctx.rotate(tipAngle);
    const tipGrad = ctx.createLinearGradient(0, -tipChord, 0, tipChord);
    tipGrad.addColorStop(0, "rgba(220,245,252,0.96)");
    tipGrad.addColorStop(0.55, accent);
    tipGrad.addColorStop(1, "rgba(35,72,100,0.98)");
    ctx.fillStyle = tipGrad;
    ctx.beginPath();
    ctx.moveTo(0, -tipChord * 0.32);
    ctx.lineTo(dir * (sideSpan - sideInnerSpan), -tipChord * 0.24);
    ctx.lineTo(dir * (sideSpan - sideInnerSpan), tipChord * 0.38);
    ctx.lineTo(0, tipChord * 0.50);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.55;
    ctx.fillRect(
      dir > 0 ? sideSpan - sideInnerSpan - 2 : -(sideSpan - sideInnerSpan),
      -tipChord * 0.18,
      dir > 0 ? 2 : -2,
      tipChord * 0.36,
    );
    ctx.globalAlpha = 1;
    ctx.restore();

    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(dir * sideInnerSpan, wingY, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  wing(-1);
  wing(1);

  const bodyGrad = ctx.createRadialGradient(0, rootChord * 0.25, 2, 0, rootChord * 0.25, rootChord * 1.3);
  bodyGrad.addColorStop(0, "rgba(225,247,253,0.98)");
  bodyGrad.addColorStop(0.6, "rgba(115,160,190,0.95)");
  bodyGrad.addColorStop(1, "rgba(40,72,100,1)");
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.ellipse(0, rootChord * 0.35, rootChord * 0.68, rootChord * 0.82, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(135,205,225,0.75)";
  ctx.beginPath();
  ctx.moveTo(-rootChord * 0.12, rootChord * 0.15);
  ctx.lineTo(0, -rootChord * 1.55);
  ctx.lineTo(rootChord * 0.15, rootChord * 0.18);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(115,185,210,0.72)";
  ctx.beginPath();
  ctx.moveTo(-rootChord * 0.2, rootChord * 0.25);
  ctx.lineTo(-rootChord * 1.35, rootChord * 0.55);
  ctx.lineTo(-rootChord * 1.15, rootChord * 0.78);
  ctx.lineTo(0, rootChord * 0.5);
  ctx.lineTo(rootChord * 1.15, rootChord * 0.78);
  ctx.lineTo(rootChord * 1.35, rootChord * 0.55);
  ctx.lineTo(rootChord * 0.2, rootChord * 0.25);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(15,35,52,0.95)";
  ctx.beginPath();
  ctx.ellipse(0, rootChord * 0.48, rootChord * 0.2, rootChord * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function TunnelCanvas({
  sim,
  kind,
}: {
  sim: React.RefObject<SimState>;
  kind: "rigid" | "flex";
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let w = 0;
    let h = 0;

    type P = { x: number; y: number; len: number; v: number };
    let parts: P[] = [];

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Math.min(130, Math.max(50, w / 5)));
      parts = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        len: 14 + Math.random() * 26,
        v: 0.6 + Math.random() * 0.8,
      }));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const accent = kind === "flex" ? "rgba(90,235,215,0.95)" : "rgba(255,190,110,0.95)";

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const s = sim.current;
      const m = kind === "flex" ? s.flex : s.rigid;

      ctx.clearRect(0, 0, w, h);
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, "rgba(16,34,56,0.9)");
      bg.addColorStop(0.5, "rgba(12,26,45,0.7)");
      bg.addColorStop(1, "rgba(16,34,56,0.9)");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "rgba(110,220,240,0.22)";
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, w - 2, h - 2);

      const frontPx = s.frontY * h;
      const bandH = h * 0.26;
      const windMoving = s.running;

      const speedPx = (s.windSpeed / 30) * 3.6;
      const vanishX = w / 2 - w * 0.035;
      for (const p of parts) {
        if (windMoving) {
          p.y -= speedPx * p.v;
          if (p.y < -p.len) {
            p.y = h + p.len;
            p.x = Math.random() * w;
          }
        }

        const depth = 1 - Math.max(0, Math.min(1, p.y / Math.max(1, h)));
        const px = p.x + (vanishX - p.x) * depth * 0.18 - depth * w * 0.025;
        const wobble = Math.sin((p.y + s.t * 90) * 0.015) * 0.8;
        const xx = px + wobble;
        const len = p.len * (0.85 + depth * 0.25);

        const g = ctx.createLinearGradient(xx, p.y + len, xx, p.y);
        g.addColorStop(0, "rgba(90,220,255,0)");
        g.addColorStop(1, "rgba(120,235,255,0.46)");
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(xx, p.y + len);
        ctx.lineTo(xx, p.y);
        ctx.stroke();

        if (p.y > 18 && p.y < h - 18 && Math.round(p.x) % 3 === 0) {
          ctx.beginPath();
          ctx.moveTo(xx, p.y);
          ctx.lineTo(xx - 3, p.y + 6);
          ctx.moveTo(xx, p.y);
          ctx.lineTo(xx + 3, p.y + 6);
          ctx.stroke();
        }
      }

      ctx.save();
      ctx.strokeStyle = "rgba(170,210,225,0.16)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(w / 2 - 24, h * 0.56);
      ctx.lineTo(w / 2 + 24, h * 0.56);
      ctx.moveTo(w / 2, h * 0.56 - 24);
      ctx.lineTo(w / 2, h * 0.56 + 24);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = "rgba(130,235,255,0.9)";
      ctx.font = "600 10px Inter, sans-serif";
      ctx.fillText("MAIN AIRFLOW ↑  ALONG FLIGHT PATH", Math.max(12, w - 206), 18);

      if (s.showFront && s.gustIntensity > 0) {
        const bandGrad = ctx.createLinearGradient(0, frontPx + bandH, 0, frontPx - bandH * 0.25);
        bandGrad.addColorStop(0, "rgba(255,190,110,0)");
        bandGrad.addColorStop(0.65, "rgba(255,190,110,0.18)");
        bandGrad.addColorStop(1, "rgba(255,220,170,0)");
        ctx.fillStyle = bandGrad;
        ctx.fillRect(0, frontPx - bandH * 0.25, w, bandH * 1.25);

        const gustStrength = Math.max(0.15, m.gust);
        ctx.strokeStyle = `rgba(255,205,135,${0.5 + gustStrength * 0.35})`;
        ctx.lineWidth = 2;
        for (let gx = 22; gx < w; gx += 34) {
          const wobble = Math.sin(gx * 0.08 + s.t * 7) * 5;
          const gy = frontPx + wobble;
          ctx.beginPath();
          ctx.moveTo(gx, gy + 28);
          ctx.lineTo(gx, gy - 12);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(gx, gy - 12);
          ctx.lineTo(gx - 4, gy - 5);
          ctx.moveTo(gx, gy - 12);
          ctx.lineTo(gx + 4, gy - 5);
          ctx.stroke();
        }

        ctx.strokeStyle = "rgba(255,200,130,0.7)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, frontPx);
        ctx.lineTo(w, frontPx);
        ctx.stroke();

        ctx.fillStyle = "rgba(255,210,145,0.98)";
        ctx.font = "700 10px Inter, sans-serif";
        ctx.fillText("VERTICAL GUST ↑", 12, Math.max(14, frontPx - 8));
      }

      const visualShake =
        kind === "rigid" ? Math.min(1.35, m.shake * 1.35) : Math.min(0.55, m.shake * 0.42);

      drawAircraft(ctx, w, h, {
        deflection: m.deflection,
        shake: visualShake,
        accent,
        time: s.t,
      });

      const shakeActive = s.phase === "impact" || s.phase === "recovering";
      ctx.font = "700 11px Inter, sans-serif";
      ctx.fillStyle = kind === "flex" ? "rgba(90,235,215,0.96)" : "rgba(255,190,110,0.96)";
      ctx.fillText(
        shakeActive
          ? kind === "flex"
            ? "STEADIER FUSELAGE • LESS VIBRATION"
            : "MORE FUSELAGE SHAKE"
          : kind === "flex"
            ? "FLEXIBLE TIPS • FUSELAGE STAYS STEADIER"
            : "RIGID TIPS • MORE LOAD REACHES FUSELAGE",
        12,
        h - 14,
      );
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [kind, sim]);

  return <canvas ref={ref} className="h-[230px] w-full sm:h-[300px] lg:h-[340px]" />;
}

const PHASE_LABEL: Record<Phase, string> = {
  steady: "STEADY AIR",
  approaching: "GUST APPROACHING",
  impact: "GUST IMPACT",
  recovering: "RECOVERING",
};

export default function WindTunnel() {
  const [windSpeed, setWindSpeed] = useState(22);
  const [gustIntensity, setGustIntensity] = useState(40);
  const [running, setRunning] = useState(true);
  const [readout, setReadout] = useState<{
    rigid: TunnelMetrics;
    flex: TunnelMetrics;
    phase: Phase;
    reduction: number;
  }>({
    rigid: emptyMetrics(),
    flex: emptyMetrics(),
    phase: "steady",
    reduction: 0,
  });

  const sim = useRef<SimState>({
    t: 0,
    running,
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
  });

  sim.current.running = running;
  sim.current.windSpeed = windSpeed;
  sim.current.gustIntensity = gustIntensity;
  if (gustIntensity === 0) sim.current.showFront = false;

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const s = sim.current;
      if (!running) return;
      s.t += dt;

      let target = 0;
      const canShowGust = s.gustIntensity > 0;
      if (s.eventActive) {
        s.eventT += dt;
        const e = s.eventT;
        if (e < 1.1) {
          s.phase = "approaching";
          s.frontY = 1.3 - (e / 1.1) * 0.8;
          s.showFront = canShowGust;
          target = 0;
        } else if (e < 2.4) {
          s.phase = "impact";
          s.frontY = 0.5 - ((e - 1.1) / 1.3) * 0.35;
          s.showFront = canShowGust;
          target = 1;
        } else if (e < 4.6) {
          s.phase = "recovering";
          s.frontY = 0.15 - ((e - 2.4) / 2.2) * 0.45;
          s.showFront = canShowGust && e < 3.4;
          target = 0;
        } else {
          s.eventActive = false;
          s.eventT = 0;
          s.phase = "steady";
          s.showFront = false;
          s.frontY = 1.3;
          target = 0;
        }
      } else {
        s.phase = "steady";
        s.showFront = false;
      }

      const k = target > s.env ? 3.2 : 1.5;
      s.env += (target - s.env) * Math.min(1, dt * k);

      const gi = s.gustIntensity / 100;
      const gust = gi * s.env;
      const q = (s.windSpeed * s.windSpeed) / 900;

      const rigidTarget = 1.0 * gust;
      const flexTarget = 26 * (1 - Math.exp(-2.4 * gust)) * Math.min(1, 0.5 + q * 0.6);
      s.tipRigid += (rigidTarget - s.tipRigid) * Math.min(1, dt * 5);
      s.tipFlex += (flexTarget - s.tipFlex) * Math.min(1, dt * 3);

      const rigidLoad = 38 * q * (1 + 1.7 * gust);
      const rigid: TunnelMetrics = {
        gust,
        deflection: s.tipRigid,
        load: rigidLoad,
        stress: rigidLoad * 2.35,
        shake: Math.min(1.2, q * gust * 1.3),
      };

      const relief = 0.45 * (s.tipFlex / 26);
      const flexLoad = rigidLoad * (1 - relief);
      const flex: TunnelMetrics = {
        gust,
        deflection: s.tipFlex,
        load: flexLoad,
        stress: flexLoad * 2.35,
        shake: Math.min(1.2, q * gust * 1.3) * (1 - relief * 1.4),
      };

      s.rigid = rigid;
      s.flex = flex;
      if (s.eventActive) {
        s.peakRigid = Math.max(s.peakRigid, rigidLoad);
        s.peakFlex = Math.max(s.peakFlex, flexLoad);
      }

      acc += dt;
      if (acc > 0.1) {
        acc = 0;
        const reduction = s.peakRigid > 0 ? ((s.peakRigid - s.peakFlex) / s.peakRigid) * 100 : 0;
        setReadout({ rigid, flex, phase: s.phase, reduction });
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  const reset = () => {
    const s = sim.current;
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
    setWindSpeed(22);
    setGustIntensity(40);
    setRunning(true);
    setReadout({
      rigid: emptyMetrics(),
      flex: emptyMetrics(),
      phase: "steady",
      reduction: 0,
    });
  };

  const applyGust = () => {
    const s = sim.current;
    if (s.gustIntensity <= 0) {
      s.eventActive = false;
      s.eventT = 0;
      s.showFront = false;
      s.env = 0;
      s.phase = "steady";
      setReadout({ rigid: s.rigid, flex: s.flex, phase: "steady", reduction: 0 });
      return;
    }
    s.eventActive = true;
    s.eventT = 0;
    s.frontY = 1.3;
    s.showFront = true;
    s.peakRigid = 0;
    s.peakFlex = 0;
    setRunning(true);
  };

  const cards = (m: TunnelMetrics, flex: boolean) => (
    <div className="grid grid-cols-2 gap-2 sm:gap-3">
      <DataCard label="Wind Speed" value={windSpeed.toFixed(0)} unit="m/s" />
      <DataCard label="Gust Intensity (target)" value={gustIntensity.toFixed(0)} unit="%" />
      <DataCard label="Current Gust at Aircraft" value={(m.gust * 100).toFixed(0)} unit="%" />
      <DataCard
        label="Wingtip Deflection"
        value={m.deflection.toFixed(1)}
        unit="°"
        tone={flex ? "good" : "default"}
      />
      <DataCard
        label="Wing-Root Load"
        value={m.load.toFixed(1)}
        unit="kN"
        tone={flex ? "good" : "warn"}
      />
      <DataCard
        label="Structural Stress"
        value={m.stress.toFixed(0)}
        unit="MPa"
        tone={flex ? "good" : "warn"}
      />
      {flex ? (
        <div className="col-span-2">
          <DataCard
            label="Wing Stress Reduction"
            value={readout.reduction.toFixed(1)}
            unit="%"
            tone="good"
            big
          />
        </div>
      ) : null}
    </div>
  );

  const phase = readout.phase;

  return (
    <div className="space-y-4 sm:space-y-6">
      <Panel className="p-4 sm:p-5">
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
          <Slider
            label="Wind Speed"
            value={windSpeed}
            min={5}
            max={60}
            unit="m/s"
            onChange={setWindSpeed}
          />
          <Slider
            label="Gust Intensity (target)"
            value={gustIntensity}
            min={0}
            max={100}
            step={20}
            unit="%"
            onChange={setGustIntensity}
          />
          <div className="flex flex-wrap gap-2">
            <ActionButton variant={running ? "ghost" : "primary"} onClick={() => setRunning(true)}>
              Start
            </ActionButton>
            <ActionButton onClick={() => setRunning(false)}>Pause</ActionButton>
            <ActionButton onClick={reset}>Reset</ActionButton>
            <ActionButton variant="alert" onClick={applyGust}>
              Apply Gust
            </ActionButton>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="tech-label text-[10px] text-muted-foreground">Status</span>
          {(["steady", "approaching", "impact", "recovering"] as const).map((p) => (
            <span
              key={p}
              className={`tech-label rounded-full px-3 py-1 text-[10px] transition-all ${
                phase === p
                  ? p === "impact"
                    ? "bg-[color:var(--warn)] text-primary-foreground"
                    : "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground"
              }`}
            >
              {PHASE_LABEL[p]}
            </span>
          ))}
        </div>
      </Panel>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        {(["rigid", "flex"] as const).map((kind) => {
          const flex = kind === "flex";
          const m = flex ? readout.flex : readout.rigid;
          return (
            <Panel key={kind} className="overflow-hidden p-3 sm:p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <h3 className="font-display text-sm font-bold sm:text-base">
                    {flex ? "Albatross-Inspired Aircraft" : "Traditional Aircraft"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {flex ? "Flexible / hinged wingtips" : "Rigid / non-hinged wingtips"}
                  </p>
                </div>
                <span
                  className={`tech-label rounded-full px-3 py-1 text-[10px] ${
                    flex ? "bg-accent/15 text-accent" : "bg-[color:var(--warn)]/15 text-[color:var(--warn)]"
                  }`}
                >
                  {flex ? "Flexible" : "Rigid"}
                </span>
              </div>
              <div className="overflow-hidden rounded-xl border border-border">
                <TunnelCanvas sim={sim} kind={kind} />
              </div>
              <div className="mt-3">{cards(m, flex)}</div>
            </Panel>
          );
        })}
      </div>

      <Panel className="p-4 sm:p-5">
        <h4 className="tech-label mb-2 text-xs text-primary">Why it matters</h4>
        <Note>
          Both aircraft face exactly the same steady main airflow and the same target gust.
          Cyan streaks show the normal tunnel airflow moving along the aircraft's flight
          path toward the nose, while the orange vertical gust rises from below. “Current
          Gust at Aircraft” increases only when that upward gust reaches the wings. The gust
          reaches both aircraft at the same moment, then passes and the aircraft settle. The
          rigid wingtip barely moves, so more of the temporary load reaches the wing root and
          the first fuselage visibly shakes more. The hinged tip deflects smoothly, relieves
          part of the peak load, and the second fuselage remains noticeably steadier with less
          visible vibration.
        </Note>
        <Note>
          <span className="mt-2 block opacity-80">
            All numbers shown, including the peak load reduction, are illustrative simulation
            values for teaching — not verified real-world aircraft results.
          </span>
        </Note>
      </Panel>
    </div>
  );
}
