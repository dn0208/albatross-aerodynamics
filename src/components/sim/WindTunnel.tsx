import { useEffect, useRef, useState } from "react";
import { ActionButton, DataCard, Note, Panel, Slider } from "./ui";

export type TunnelMetrics = {
  deflection: number;
  load: number;
  stress: number;
  shake: number;
  gust: number;
};

type SimState = {
  t: number;
  windSpeed: number;
  gustIntensity: number;
  pulse: number;
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
  const cx = w / 2 + Math.sin(time * 37) * shake * 7;
  const cy = h / 2 + Math.cos(time * 53) * shake * 5;
  const roll = Math.sin(time * 29) * shake * 0.035;

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
  ctx.moveTo(-5, -h * 0.20);
  ctx.lineTo(0, -h * 0.30);
  ctx.lineTo(5, -h * 0.20);
  ctx.closePath();
  ctx.fill();

  const wing = (dir: 1 | -1) => {
    // inner wing panel
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
    ctx.rotate((-dir * deflection * Math.PI) / 180);
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
      const count = Math.round(Math.min(90, Math.max(35, w / 7)));
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

      const speedPx = (s.windSpeed / 30) * 3.6 * (1 + m.gust * 0.9);
      for (const p of parts) {
        p.y -= speedPx * p.v;
        if (p.y < -p.len) {
          p.y = h + p.len;
          p.x = Math.random() * w;
        }
        const turbulence = m.gust * 3.4;
        const xx = p.x + Math.sin((p.y + s.t * 120) * 0.02) * turbulence;
        const g = ctx.createLinearGradient(xx, p.y + p.len, xx, p.y);
        g.addColorStop(0, "rgba(90,220,255,0)");
        g.addColorStop(1, `rgba(120,235,255,${0.25 + m.gust * 0.45})`);
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(xx, p.y + p.len);
        ctx.lineTo(xx, p.y);
        ctx.stroke();
      }

      drawAircraft(ctx, w, h, {
        deflection: m.deflection,
        shake: m.shake,
        accent,
        time: s.t,
      });

      if (m.gust > 0.55) {
        ctx.fillStyle = "rgba(255,190,110,0.9)";
        ctx.font = "600 11px Inter, sans-serif";
        ctx.fillText("GUST FRONT", 12, h - 12);
      }
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [kind, sim]);

  return <canvas ref={ref} className="h-[230px] w-full sm:h-[300px] lg:h-[340px]" />;
}

export default function WindTunnel() {
  const [windSpeed, setWindSpeed] = useState(22);
  const [gustIntensity, setGustIntensity] = useState(45);
  const [running, setRunning] = useState(true);
  const [readout, setReadout] = useState<{ rigid: TunnelMetrics; flex: TunnelMetrics }>({
    rigid: emptyMetrics(),
    flex: emptyMetrics(),
  });

  const sim = useRef<SimState>({
    t: 0,
    windSpeed,
    gustIntensity,
    pulse: 0,
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
      if (running) s.t += dt;
      s.pulse = Math.max(0, s.pulse - dt * 0.55);

      const osc = 0.5 + 0.5 * Math.sin(s.t * 1.15);
      const gi = s.gustIntensity / 100;
      const gust = Math.min(1.4, gi * (0.35 + 0.65 * osc) + s.pulse);
      const q = (s.windSpeed * s.windSpeed) / 900;

      const rigidLoad = 38 * q * (1 + 1.7 * gust);
      const rigid: TunnelMetrics = {
        gust,
        deflection: 1.6 * gust,
        load: rigidLoad,
        stress: rigidLoad * 2.35,
        shake: Math.min(1.2, q * gust * 1.25),
      };

      const tipDefl = 34 * (1 - Math.exp(-2.3 * gust)) * Math.min(1, 0.45 + q * 0.6);
      const relief = 0.42 * (tipDefl / 34);
      const flexLoad = rigidLoad * (1 - relief);
      const flex: TunnelMetrics = {
        gust,
        deflection: tipDefl,
        load: flexLoad,
        stress: flexLoad * 2.35,
        shake: Math.min(1.2, q * gust * 1.25) * (1 - relief * 1.5),
      };

      s.rigid = rigid;
      s.flex = flex;

      acc += dt;
      if (acc > 0.12) {
        acc = 0;
        setReadout({ rigid, flex });
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  const reset = () => {
    sim.current.t = 0;
    sim.current.pulse = 0;
    setWindSpeed(22);
    setGustIntensity(45);
    setRunning(true);
  };

  const cards = (m: TunnelMetrics, flex: boolean) => (
    <div className="grid grid-cols-2 gap-2 sm:gap-3">
      <DataCard label="Wind Speed" value={windSpeed.toFixed(0)} unit="m/s" />
      <DataCard label="Gust Intensity" value={(m.gust * 100).toFixed(0)} unit="%" />
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
    </div>
  );

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
            label="Gust Intensity"
            value={gustIntensity}
            min={0}
            max={100}
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
            <ActionButton
              variant="alert"
              onClick={() => {
                sim.current.pulse = 0.75;
                setRunning(true);
              }}
            >
              Apply Gust
            </ActionButton>
          </div>
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
          Albatross-inspired hinged or flexible wingtips can move with gusts instead of
          resisting them completely. This can reduce peak loads transferred to the main
          wing structure. In a strong gust the rigid wing shows a higher wing-root load
          and more fuselage shaking, while the flexible tip shows larger controlled
          deflection with a lower peak root load.
        </Note>
        <Note>
          <span className="mt-2 block opacity-80">
            All numbers shown are illustrative simulation values, not verified real-world
            measurements.
          </span>
        </Note>
      </Panel>
    </div>
  );
}
