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

/** Front-view aircraft rendered with shaded polygons for a 3D-like look. */
function drawAircraft(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  opts: { deflection: number; shake: number; accent: string; time: number },
) {
  const { deflection, shake, accent, time } = opts;
  const cx = w / 2 + Math.sin(time * 37) * shake * 6;
  const cy = h / 2 + Math.cos(time * 53) * shake * 4;
  const roll = Math.sin(time * 29) * shake * 0.03;

  const span = Math.min(w * 0.38, 240);
  const innerSpan = span * 0.62;
  const chordIn = Math.max(10, h * 0.055);
  const chordOut = chordIn * 0.62;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(roll);

  // vertical tail (farther back, smaller in front view)
  ctx.fillStyle = "rgba(120,190,215,0.35)";
  ctx.beginPath();
  ctx.moveTo(-5, -h * 0.2);
  ctx.lineTo(0, -h * 0.3);
  ctx.lineTo(5, -h * 0.2);
  ctx.closePath();
  ctx.fill();

  const wing = (dir: 1 | -1) => {
    // inner wing panel — slight elastic bend follows a fraction of the tip motion
    const bend = (-dir * deflection * Math.PI) / 180;
    ctx.save();
    ctx.rotate(bend * 0.12);
    const grad = ctx.createLinearGradient(0, chordIn, 0, -chordIn);
    grad.addColorStop(0, "rgba(60,95,125,0.95)");
    grad.addColorStop(0.5, "rgba(150,190,214,0.9)");
    grad.addColorStop(1, "rgba(226,246,255,0.95)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, chordIn * 0.5);
    ctx.lineTo(dir * innerSpan, chordOut * 0.6);
    ctx.lineTo(dir * innerSpan, -chordOut * 0.6);
    ctx.lineTo(0, -chordIn * 0.5);
    ctx.closePath();
    ctx.fill();

    // hinged / rigid outer tip
    ctx.save();
    ctx.translate(dir * innerSpan, 0);
    ctx.rotate(bend);
    const tipGrad = ctx.createLinearGradient(0, chordOut, 0, -chordOut);
    tipGrad.addColorStop(0, "rgba(30,60,90,0.95)");
    tipGrad.addColorStop(1, accent);
    ctx.fillStyle = tipGrad;
    ctx.beginPath();
    ctx.moveTo(0, chordOut * 0.6);
    ctx.lineTo(dir * (span - innerSpan), chordOut * 0.3);
    ctx.lineTo(dir * (span - innerSpan), -chordOut * 0.3);
    ctx.lineTo(0, -chordOut * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // hinge marker
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(dir * innerSpan, 0, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  wing(1);
  wing(-1);

  // fuselage (front view)
  const fGrad = ctx.createRadialGradient(0, chordIn * 0.6, 2, 0, 0, chordIn * 1.6);
  fGrad.addColorStop(0, "rgba(240,252,255,0.98)");
  fGrad.addColorStop(0.55, "rgba(120,160,195,0.9)");
  fGrad.addColorStop(1, "rgba(45,80,110,1)");
  ctx.fillStyle = fGrad;
  ctx.beginPath();
  ctx.ellipse(0, 0, chordIn * 0.95, chordIn * 1.05, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(160,225,245,0.7)";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // nose cone pointing toward viewer
  ctx.fillStyle = "rgba(200,245,255,0.9)";
  ctx.beginPath();
  ctx.moveTo(-chordIn * 0.45, chordIn * 0.7);
  ctx.quadraticCurveTo(0, chordIn * 1.55, chordIn * 0.45, chordIn * 0.7);
  ctx.lineTo(chordIn * 0.35, chordIn * 0.5);
  ctx.quadraticCurveTo(0, chordIn * 1.05, -chordIn * 0.35, chordIn * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(160,225,245,0.7)";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // nose / front glare
  ctx.fillStyle = "rgba(120,235,255,0.55)";
  ctx.beginPath();
  ctx.arc(0, chordIn * 0.95, chordIn * 0.32, 0, Math.PI * 2);
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
      // tunnel walls
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

      const speedPx = (s.windSpeed / 30) * 3.6 * (1 + m.gust * 0.9);
      for (const p of parts) {
        // near the gust front particles run faster and brighter
        const dist = Math.abs(p.y - frontPx);
        const near = s.showFront ? Math.max(0, 1 - dist / bandH) : 0;
        p.y -= speedPx * p.v * (1 + near * 1.5);
        if (p.y < -p.len) {
          p.y = h + p.len;
          p.x = Math.random() * w;
        }
        const turbulence = m.gust * 3.4 + near * 2.5;
        const xx = p.x + Math.sin((p.y + s.t * 120) * 0.02) * turbulence;
        const len = p.len * (1 + near * 0.8);
        const g = ctx.createLinearGradient(xx, p.y + len, xx, p.y);
        g.addColorStop(0, "rgba(90,220,255,0)");
        g.addColorStop(1, `rgba(${near > 0.2 ? "255,214,150" : "120,235,255"},${0.22 + m.gust * 0.4 + near * 0.5})`);
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.5 + near * 1.1;
        ctx.beginPath();
        ctx.moveTo(xx, p.y + len);
        ctx.lineTo(xx, p.y);
        ctx.stroke();
      }

      // translucent gust band travelling upward with the flow
      if (s.showFront) {
        const bandGrad = ctx.createLinearGradient(0, frontPx + bandH, 0, frontPx - bandH * 0.25);
        bandGrad.addColorStop(0, "rgba(255,190,110,0)");
        bandGrad.addColorStop(0.65, "rgba(255,190,110,0.16)");
        bandGrad.addColorStop(1, "rgba(255,220,170,0)");
        ctx.fillStyle = bandGrad;
        ctx.fillRect(0, frontPx - bandH * 0.25, w, bandH * 1.25);
        ctx.strokeStyle = "rgba(255,200,130,0.55)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, frontPx);
        ctx.lineTo(w, frontPx);
        ctx.stroke();
        ctx.fillStyle = "rgba(255,200,130,0.95)";
        ctx.font = "600 10px Inter, sans-serif";
        ctx.fillText("GUST FRONT ↑", 12, Math.max(14, frontPx - 8));
      }

      drawAircraft(ctx, w, h, {
        deflection: m.deflection,
        shake: m.shake,
        accent,
        time: s.t,
      });
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

  sim.current.windSpeed = windSpeed;
  sim.current.gustIntensity = gustIntensity;

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

      // ---- gust event timeline -------------------------------------------
      // 0.0-1.1s approach, 1.1-2.4s impact/peak, 2.4-4.4s pass & recover
      let target = 0;
      if (s.eventActive) {
        s.eventT += dt;
        const e = s.eventT;
        if (e < 1.1) {
          s.phase = "approaching";
          s.frontY = 1.3 - (e / 1.1) * 0.8; // travels up toward the aircraft
          s.showFront = true;
          target = 0;
        } else if (e < 2.4) {
          s.phase = "impact";
          s.frontY = 0.5 - ((e - 1.1) / 1.3) * 0.35;
          s.showFront = true;
          target = 1;
        } else if (e < 4.6) {
          s.phase = "recovering";
          s.frontY = 0.15 - ((e - 2.4) / 2.2) * 0.45;
          s.showFront = e < 3.4;
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

      // smooth build-up / decay of the gust reaching the aircraft
      const k = target > s.env ? 3.2 : 1.5;
      s.env += (target - s.env) * Math.min(1, dt * k);

      const gi = s.gustIntensity / 100;
      const gust = gi * s.env; // 0..1, identical for both aircraft
      const q = (s.windSpeed * s.windSpeed) / 900;

      // ---- wingtip response (smooth easing, first-order lag) -------------
      const rigidTarget = 1.0 * gust; // small elastic bending only, 0-1°
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
        s.peakFlex = s.peakRigid === rigidLoad ? flexLoad : s.peakFlex;
        if (flexLoad > s.peakFlex && rigidLoad >= s.peakRigid) s.peakFlex = flexLoad;
      }

      acc += dt;
      if (acc > 0.1) {
        acc = 0;
        const reduction =
          s.peakRigid > 0 ? ((s.peakRigid - s.peakFlex) / s.peakRigid) * 100 : 0;
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
      <DataCard
        label="Effective Gust at Aircraft"
        value={(m.gust * 100).toFixed(0)}
        unit="%"
      />
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
      <div className="col-span-2">
        <DataCard
          label="Structural Stress"
          value={m.stress.toFixed(0)}
          unit="MPa"
          tone={flex ? "good" : "warn"}
        />
      </div>
      {flex ? (
        <div className="col-span-2">
          <DataCard
            label="Peak Wing-Root Load Reduction (simulated)"
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
            <ActionButton
              variant={running ? "ghost" : "primary"}
              onClick={() => setRunning(true)}
            >
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
                    {flex ? "Hinged / flexible wingtips" : "Rigid / non-hinged wingtips"}
                  </p>
                </div>
                <span
                  className={`tech-label rounded-full px-3 py-1 text-[10px] ${
                    flex
                      ? "bg-accent/15 text-accent"
                      : "bg-[color:var(--warn)]/15 text-[color:var(--warn)]"
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
          Both aircraft face exactly the same wind speed and the same gust event. The
          gust front travels up the tunnel, hits both wings at the same moment, then
          passes and the aircraft settle. The rigid wingtip barely moves, so the gust
          energy goes straight into the wing root as a higher load, higher stress and
          more fuselage shake. The hinged tip deflects smoothly instead, relieving part
          of that peak load.
        </Note>
        <Note>
          <span className="mt-2 block opacity-80">
            All numbers shown, including the peak load reduction, are illustrative
            simulation values for teaching — not verified real-world aircraft results.
          </span>
        </Note>
      </Panel>
    </div>
  );
}
