import { useEffect, useRef, useState } from "react";
import { ActionButton, DataCard, Note, Panel, Slider } from "./ui";

const STAGES = ["Climb", "Top Turn", "Descend", "Bottom Turn"] as const;
type Stage = (typeof STAGES)[number];

type PathStyle = "gentle" | "optimal" | "aggressive";

const PATH_STYLES: Record<
  PathStyle,
  { label: string; amplitude: number; efficiency: number; dragMultiplier: number }
> = {
  gentle: { label: "Gentle", amplitude: 0.26, efficiency: 0.72, dragMultiplier: 0.92 },
  optimal: { label: "Optimal", amplitude: 0.38, efficiency: 1.0, dragMultiplier: 1.15 },
  aggressive: { label: "Aggressive", amplitude: 0.47, efficiency: 0.88, dragMultiplier: 1.55 },
};

type EnergyState = "gain" | "loss" | "neutral";

type Craft = {
  x: number;
  y: number; // 0 = sea level, 1 = top of scene
  heading: number; // radians, points in direction of travel
  airspeed: number;
  altitude: number;
  localWind: number;
  energy: number;
  energyRate: number;
  state: EnergyState;
  stage: Stage;
  trail: { x: number; y: number }[];
};

type DSState = {
  t: number;
  cycleSpeed: number;
  lowerWind: number;
  upperWind: number;
  pathStyle: PathStyle;
  ds: Craft;
  history: { t: number; ds: number }[];
};

function newCraft(stage: Stage): Craft {
  return {
    x: 0.5,
    y: 0.25,
    heading: 0,
    airspeed: 16,
    altitude: 6,
    localWind: 7,
    energy: 0,
    energyRate: 0,
    state: "neutral",
    stage,
    trail: [],
  };
}

const BAND_HALF = 0.11; // shear band half-thickness in scene units

function windAt(y: number, lowerWind: number, upperWind: number) {
  // smooth shear across a band around y = 0.5
  const k = 1 / (1 + Math.exp(-(y - 0.5) * 9));
  return lowerWind + (upperWind - lowerWind) * k;
}

function drawScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  craft: Craft,
  lowerWind: number,
  upperWind: number,
  t: number,
) {
  ctx.clearRect(0, 0, w, h);
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "rgba(12,32,58,1)");
  sky.addColorStop(0.55, "rgba(14,44,70,1)");
  sky.addColorStop(1, "rgba(10,52,68,1)");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  const seaTop = h * 0.88;
  // ocean
  const sea = ctx.createLinearGradient(0, seaTop, 0, h);
  sea.addColorStop(0, "rgba(20,90,110,0.95)");
  sea.addColorStop(1, "rgba(8,38,58,1)");
  ctx.fillStyle = sea;
  ctx.fillRect(0, seaTop, w, h - seaTop);
  ctx.strokeStyle = "rgba(140,235,255,0.35)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    for (let x = 0; x <= w; x += 8) {
      const y = seaTop + 6 + i * 10 + Math.sin((x + t * 90 + i * 40) * 0.03) * 2.5;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  const toPx = (cy: number) => seaTop - cy * (seaTop - h * 0.06);

  // wind layer arrows
  const drawArrows = (yFrac: number, speed: number, rows: number) => {
    const alpha = speed > 12 ? 0.75 : 0.4;
    const len = Math.max(4, speed * 2.2);
    for (let r = 0; r < rows; r++) {
      const y = toPx(yFrac + r * 0.09);
      const offset = (t * speed * 14 + r * 60) % (w + 160);
      for (let k = -1; k < Math.ceil(w / 160) + 1; k++) {
        const x = offset + k * 160 - 80;
        ctx.strokeStyle = `rgba(120,235,255,${alpha})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(x - len, y);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 6, y - 3.5);
        ctx.lineTo(x - 6, y + 3.5);
        ctx.closePath();
        ctx.fillStyle = `rgba(120,235,255,${alpha})`;
        ctx.fill();
      }
    }
  };
  drawArrows(0.62, upperWind, 3);
  drawArrows(0.08, lowerWind, 3);

  // shear band (a region, not an infinitely thin line)
  const by = toPx(0.5);
  const bTop = toPx(0.5 + BAND_HALF);
  const bBot = toPx(0.5 - BAND_HALF);
  const band = ctx.createLinearGradient(0, bTop, 0, bBot);
  band.addColorStop(0, "rgba(255,196,110,0.05)");
  band.addColorStop(0.5, "rgba(255,196,110,0.16)");
  band.addColorStop(1, "rgba(255,196,110,0.05)");
  ctx.fillStyle = band;
  ctx.fillRect(0, bTop, w, bBot - bTop);
  ctx.strokeStyle = "rgba(255,200,120,0.28)";
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, bTop, w - 1, bBot - bTop);
  ctx.save();
  ctx.setLineDash([9, 9]);
  ctx.strokeStyle = "rgba(255,205,130,0.45)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, by);
  ctx.lineTo(w, by);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = "rgba(255,210,140,0.95)";
  ctx.font = "600 10px Inter, sans-serif";
  ctx.fillText("WIND GRADIENT / WIND SHEAR ZONE", 10, bTop - 5);

  ctx.fillStyle = "rgba(190,235,255,0.9)";
  ctx.font = "600 11px Inter, sans-serif";
  ctx.fillText(`Upper Layer  ${upperWind.toFixed(0)} m/s`, 10, toPx(0.85));
  ctx.fillText(`Lower Layer  ${lowerWind.toFixed(0)} m/s`, 10, toPx(0.2));

  // trail
  if (craft.trail.length > 1) {
    ctx.strokeStyle = "rgba(90,235,215,0.75)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    craft.trail.forEach((p, i) => {
      const px = p.x * w;
      const py = toPx(p.y);
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    });
    ctx.stroke();
  }

  // 3D-like albatross-inspired aircraft
  const px = craft.x * w;
  const py = toPx(craft.y);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(craft.heading);
  const s = Math.min(1.25, w / 420) * 16;

  // fuselage (shaded tube)
  const bodyGrad = ctx.createLinearGradient(-s * 0.2, -s * 0.25, s * 0.2, s * 0.25);
  bodyGrad.addColorStop(0, "rgba(210,245,255,0.98)");
  bodyGrad.addColorStop(0.5, "rgba(140,200,230,0.95)");
  bodyGrad.addColorStop(1, "rgba(90,160,200,0.95)");
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 1.05, s * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();

  // nose cone
  ctx.fillStyle = "rgba(235,250,255,0.98)";
  ctx.beginPath();
  ctx.moveTo(s * 1.1, 0);
  ctx.lineTo(s * 0.45, s * 0.18);
  ctx.lineTo(s * 0.45, -s * 0.18);
  ctx.closePath();
  ctx.fill();

  // main wings (swept back, gradient)
  const wingGrad = ctx.createLinearGradient(-s * 0.3, 0, s * 0.5, 0);
  wingGrad.addColorStop(0, "rgba(160,220,245,0.92)");
  wingGrad.addColorStop(1, "rgba(90,235,215,0.88)");
  ctx.fillStyle = wingGrad;
  ctx.beginPath();
  ctx.moveTo(s * 0.15, 0);
  ctx.lineTo(-s * 0.55, s * 1.25);
  ctx.lineTo(-s * 0.35, s * 1.3);
  ctx.lineTo(s * 0.35, s * 0.15);
  ctx.lineTo(-s * 0.35, -s * 1.3);
  ctx.lineTo(-s * 0.55, -s * 1.25);
  ctx.closePath();
  ctx.fill();

  // wingtips (hinged/flexible hint)
  ctx.fillStyle = "rgba(90,235,215,0.95)";
  ctx.beginPath();
  ctx.moveTo(-s * 0.45, s * 1.25);
  ctx.lineTo(-s * 0.75, s * 1.45);
  ctx.lineTo(-s * 0.6, s * 1.5);
  ctx.lineTo(-s * 0.32, s * 1.32);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-s * 0.45, -s * 1.25);
  ctx.lineTo(-s * 0.75, -s * 1.45);
  ctx.lineTo(-s * 0.6, -s * 1.5);
  ctx.lineTo(-s * 0.32, -s * 1.32);
  ctx.closePath();
  ctx.fill();

  // tail
  ctx.fillStyle = "rgba(120,210,235,0.9)";
  ctx.beginPath();
  ctx.moveTo(-s * 0.6, 0);
  ctx.lineTo(-s * 1.0, s * 0.42);
  ctx.lineTo(-s * 0.95, s * 0.48);
  ctx.lineTo(-s * 0.5, s * 0.1);
  ctx.lineTo(-s * 0.95, -s * 0.48);
  ctx.lineTo(-s * 1.0, -s * 0.42);
  ctx.closePath();
  ctx.fill();

  ctx.restore();

  // energy state indicator
  ctx.font = "700 12px Inter, sans-serif";
  const label =
    craft.state === "gain"
      ? "\u2191 ENERGY GAIN"
      : craft.state === "loss"
        ? "\u2193 ENERGY LOSS"
        : "\u2022 NEUTRAL";
  ctx.fillStyle =
    craft.state === "gain"
      ? "rgba(90,235,215,1)"
      : craft.state === "loss"
        ? "rgba(255,150,110,0.98)"
        : "rgba(165,195,215,0.9)";
  ctx.fillText(label, px + 18, py - 14);
}

function SceneCanvas({ sim }: { sim: React.RefObject<DSState> }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let w = 0;
    let h = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const s = sim.current;
      drawScene(ctx, w, h, s.ds, s.lowerWind, s.upperWind, s.t);
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [sim]);
  return <canvas ref={ref} className="h-[240px] w-full sm:h-[310px] lg:h-[360px]" />;
}

function EnergyGraph({ sim }: { sim: React.RefObject<DSState> }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let w = 0;
    let h = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const hist = sim.current.history;
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = "rgba(140,200,225,0.15)";
      ctx.lineWidth = 1;
      for (let i = 1; i < 4; i++) {
        const y = (h / 4) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      if (hist.length < 2) return;
      let min = 0;
      let max = 1;
      for (const p of hist) {
        min = Math.min(min, p.ds);
        max = Math.max(max, p.ds);
      }
      const pad = (max - min) * 0.12 + 1;
      min -= pad;
      max += pad;
      const t0 = hist[0]!.t;
      const t1 = Math.max(hist[hist.length - 1]!.t, t0 + 1);
      ctx.strokeStyle = "rgba(90,235,215,1)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      hist.forEach((p, i) => {
        const x = ((p.t - t0) / (t1 - t0)) * w;
        const y = h - ((p.ds - min) / (max - min)) * h;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [sim]);
  return <canvas ref={ref} className="h-[150px] w-full sm:h-[180px]" />;
}

export default function DynamicSoaring() {
  const [running, setRunning] = useState(true);
  const [lowerWind, setLowerWind] = useState(7);
  const [upperWind, setUpperWind] = useState(22);
  const [pathStyle, setPathStyle] = useState<PathStyle>("optimal");
  const [, force] = useState(0);

  const sim = useRef<DSState>({
    t: 0,
    cycleSpeed: 1,
    lowerWind: 7,
    upperWind: 22,
    pathStyle: "optimal",
    ds: newCraft("Climb"),
    history: [],
  });

  sim.current.lowerWind = lowerWind;
  sim.current.upperWind = upperWind;
  sim.current.pathStyle = pathStyle;

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let histAcc = 0;

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const s = sim.current;
      if (!running) return;
      s.t += dt;
      const k = s.cycleSpeed;
      const cfg = PATH_STYLES[s.pathStyle];
      const windDiff = s.upperWind - s.lowerWind;

      // --- Albatross-inspired: dynamic soaring cycle ---
      const period = 8 / k;
      const phase = (s.t % period) / period;
      const ds = s.ds;
      const stageIndex = Math.floor(phase * 4);
      ds.stage = STAGES[stageIndex]!;

      const theta = phase * Math.PI * 2;
      const A = cfg.amplitude;
      const B = 0.34;
      ds.y = Math.max(0.05, Math.min(0.95, 0.5 - A * Math.cos(theta)));
      ds.x = 0.5 + B * Math.sin(theta);

      // tangent angle (canvas y increases downward, so flip dy)
      const dx = B * Math.cos(theta);
      const dySim = A * Math.sin(theta);
      ds.heading = Math.atan2(-dySim, dx);

      ds.localWind = windAt(ds.y, s.lowerWind, s.upperWind);
      ds.altitude = 3 + ds.y * 45;

      // energy is extracted only while crossing the shear band, not by sitting
      // in the fast layer: needs vertical motion AND proximity to the band
      const vertical = Math.abs(Math.sin(theta));
      const inBand = Math.max(0, 1 - Math.abs(ds.y - 0.5) / (BAND_HALF * 2.2));
      const crossing = vertical * inBand;
      const gain = crossing * windDiff * cfg.efficiency * 0.55 * k;
      const drag = 1.0 * k * cfg.dragMultiplier;
      // turning losses peak at the top and bottom turns
      const turning = Math.abs(Math.cos(theta));
      const turnLoss = turning * 1.35 * k * cfg.dragMultiplier;
      const rate = gain - drag - turnLoss;
      ds.energyRate += (rate - ds.energyRate) * Math.min(1, dt * 4);
      ds.energy += rate * dt;
      ds.state = ds.energyRate > 0.35 ? "gain" : ds.energyRate < -0.35 ? "loss" : "neutral";

      // airspeed: live output — boosted by crossings and the fast upper layer
      ds.airspeed = 14 + crossing * 14 + (ds.y > 0.5 ? 3.5 : 0) + Math.sin(theta) * 0.6;

      ds.trail.push({ x: ds.x, y: ds.y });
      if (ds.trail.length > 260) ds.trail.shift();

      histAcc += dt;
      if (histAcc > 0.25) {
        histAcc = 0;
        s.history.push({ t: s.t, ds: ds.energy });
        if (s.history.length > 160) s.history.shift();
      }

      acc += dt;
      if (acc > 0.12) {
        acc = 0;
        force((n) => n + 1);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  const reset = () => {
    sim.current.t = 0;
    sim.current.ds = newCraft("Climb");
    sim.current.history = [];
    setLowerWind(7);
    setUpperWind(22);
    setPathStyle("optimal");
    setRunning(true);
  };

  const updateLowerWind = (v: number) => {
    setLowerWind(v);
    if (v >= upperWind) setUpperWind(Math.min(30, v + 1));
  };

  const updateUpperWind = (v: number) => {
    setUpperWind(v);
    if (v <= lowerWind) setLowerWind(Math.max(0, v - 1));
  };

  const ds = sim.current.ds;
  const gradient = upperWind - lowerWind;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top Section */}
      <Panel className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-display text-lg font-extrabold leading-tight glow-text sm:text-2xl">
              Dynamic Soaring Demonstration
            </h2>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              Albatross-Inspired Aircraft
            </p>
          </div>
          <div className="flex gap-2">
            <ActionButton
              variant={running ? "ghost" : "primary"}
              onClick={() => setRunning(true)}
              active={running}
            >
              Start
            </ActionButton>
            <ActionButton onClick={() => setRunning(false)} active={!running}>
              Pause
            </ActionButton>
            <ActionButton variant="alert" onClick={reset}>
              Reset
            </ActionButton>
          </div>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_360px]">
        {/* Main Simulation Area */}
        <Panel className="overflow-hidden p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-sm font-bold sm:text-base">Albatross-Inspired Aircraft</h3>
              <p className="text-xs text-muted-foreground">Extracting energy from the wind gradient</p>
            </div>
            <span className="tech-label rounded-full bg-accent/15 px-3 py-1 text-[10px] text-accent">
              {ds.stage}
            </span>
          </div>
          <div className="overflow-hidden rounded-xl border border-border">
            <SceneCanvas sim={sim} />
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {STAGES.map((st) => (
              <span
                key={st}
                className={`tech-label rounded-md px-2 py-1 text-[10px] ${
                  ds.stage === st
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground"
                }`}
              >
                {st.toUpperCase()}
              </span>
            ))}
          </div>
        </Panel>

        {/* Controls + Environment + Live Data */}
        <div className="space-y-4 sm:space-y-5">
          {/* Controls Section */}
          <Panel className="p-4 sm:p-5">
            <h4 className="tech-label mb-3 text-xs text-primary">Controls</h4>
            <div className="space-y-4">
              <Slider
                label="Lower-Layer Wind Speed"
                value={lowerWind}
                min={0}
                max={15}
                unit="m/s"
                onChange={updateLowerWind}
              />
              <Slider
                label="Upper-Layer Wind Speed"
                value={upperWind}
                min={10}
                max={30}
                unit="m/s"
                onChange={updateUpperWind}
              />
              <div>
                <div className="tech-label mb-2 text-xs text-muted-foreground">Soaring Path / Turn Style</div>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(PATH_STYLES) as PathStyle[]).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setPathStyle(key)}
                      className={`tech-label min-h-[44px] rounded-xl px-2 text-[10px] font-semibold transition-all sm:text-xs ${
                        pathStyle === key
                          ? "bg-primary text-primary-foreground shadow-[0_0_20px_oklch(0.8_0.14_200/40%)]"
                          : "border border-border text-foreground hover:bg-secondary"
                      }`}
                    >
                      {PATH_STYLES[key].label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Panel>

          {/* Environment Section */}
          <Panel className="p-4 sm:p-5">
            <h4 className="tech-label mb-3 text-xs text-primary">Environment</h4>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <DataCard label="Lower Wind" value={lowerWind.toFixed(0)} unit="m/s" />
              <DataCard label="Upper Wind" value={upperWind.toFixed(0)} unit="m/s" />
              <DataCard label="Wind Gradient" value={gradient.toFixed(0)} unit="m/s" tone="good" />
            </div>
          </Panel>

          {/* Live Data Section */}
          <Panel className="p-4 sm:p-5">
            <h4 className="tech-label mb-3 text-xs text-primary">Live Data</h4>
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <DataCard label="Airspeed" value={ds.airspeed.toFixed(1)} unit="m/s" />
              <DataCard label="Altitude" value={ds.altitude.toFixed(1)} unit="m" />
              <DataCard label="Local Wind Speed" value={ds.localWind.toFixed(1)} unit="m/s" />
              <DataCard label="Wind-Speed Difference" value={gradient.toFixed(0)} unit="m/s" />
              <div className="col-span-2 space-y-2 sm:space-y-3">
                <DataCard
                  label="Net Flight Energy"
                  value={(Math.abs(ds.energy) < 0.05 ? 0 : ds.energy).toFixed(1)}
                  unit="units"
                  tone={ds.energy > 0 ? "good" : "warn"}
                  big
                />
                <DataCard
                  label="Energy Change"
                  value={`${ds.energyRate >= 0 ? "+" : "\u2212"}${Math.abs(ds.energyRate).toFixed(1)}`}
                  unit="units/s"
                  tone={ds.state === "gain" ? "good" : ds.state === "loss" ? "warn" : "default"}
                />
              </div>
            </div>
          </Panel>
        </div>
      </div>

      {/* Bottom Section: Energy Graph */}
      <Panel className="p-4 sm:p-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h4 className="tech-label text-xs text-primary">Energy vs Time</h4>
          <div className="flex gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <i className="inline-block h-2 w-4 rounded bg-accent" /> Albatross-inspired
            </span>
          </div>
        </div>
        <EnergyGraph sim={sim} />
        <Note>
          Energy is only extracted while the aircraft repeatedly crosses the wind
          gradient — climbing into faster air and descending back into slower air. Staying
          inside the fast layer does not keep producing energy, and drag and turning losses
          always apply. Values are simulation estimates.
        </Note>
      </Panel>
    </div>
  );
}
