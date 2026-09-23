import { useEffect, useRef, useState, type RefObject } from "react";
import { ActionButton, DataCard, Note, Panel, Slider } from "./ui";

const STAGES = ["Climb", "Top Turn", "Descend", "Bottom Turn"] as const;
type Stage = (typeof STAGES)[number];
type EnergyState = "gain" | "loss" | "neutral";

type Craft = {
  x: number;
  y: number;
  heading: number;
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
  ds: Craft;
  history: { t: number; ds: number }[];
};

const SOARING_PATH = {
  amplitude: 0.38,
  efficiency: 1.0,
  dragMultiplier: 1.15,
};

const BAND_HALF = 0.11;
const DEFAULT_CYCLE_SPEED = 1.55;

function newCraft(stage: Stage): Craft {
  return {
    x: 0.62,
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

function windAt(y: number, lowerWind: number, upperWind: number) {
  const k = 1 / (1 + Math.exp(-(y - 0.5) * 9));
  return lowerWind + (upperWind - lowerWind) * k;
}

function wrapOffset(value: number, span: number) {
  return ((value % span) + span) % span;
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
  const toPx = (cy: number) => seaTop - cy * (seaTop - h * 0.06);
  const scroll = t * 86;

  ctx.strokeStyle = "rgba(115,205,225,0.13)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 8; i++) {
    const x = w - wrapOffset(scroll + i * 135, w + 135);
    ctx.beginPath();
    ctx.moveTo(x, h * 0.08);
    ctx.lineTo(x - 44, seaTop - 4);
    ctx.stroke();
  }

  const sea = ctx.createLinearGradient(0, seaTop, 0, h);
  sea.addColorStop(0, "rgba(20,90,110,0.95)");
  sea.addColorStop(1, "rgba(8,38,58,1)");
  ctx.fillStyle = sea;
  ctx.fillRect(0, seaTop, w, h - seaTop);
  ctx.strokeStyle = "rgba(140,235,255,0.35)";
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    for (let x = -40; x <= w + 40; x += 8) {
      const sx = x - wrapOffset(t * 70 + i * 35, 80);
      const y = seaTop + 6 + i * 10 + Math.sin((sx + t * 90 + i * 40) * 0.03) * 2.5;
      x === -40 ? ctx.moveTo(sx, y) : ctx.lineTo(sx, y);
    }
    ctx.stroke();
  }

  const by = toPx(0.5);
  const bTop = toPx(0.5 + BAND_HALF);
  const bBot = toPx(0.5 - BAND_HALF);
  const inShearZone = Math.abs(craft.y - 0.5) <= BAND_HALF * 1.15;

  const band = ctx.createLinearGradient(0, bTop, 0, bBot);
  band.addColorStop(0, inShearZone ? "rgba(255,196,110,0.13)" : "rgba(255,196,110,0.05)");
  band.addColorStop(0.5, inShearZone ? "rgba(255,196,110,0.34)" : "rgba(255,196,110,0.16)");
  band.addColorStop(1, inShearZone ? "rgba(255,196,110,0.13)" : "rgba(255,196,110,0.05)");
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

  const drawArrows = (yFrac: number, speed: number, rows: number) => {
    const alpha = speed > 12 ? 0.75 : 0.4;
    const len = Math.max(4, speed * 2.2);
    for (let r = 0; r < rows; r++) {
      const y = toPx(yFrac + r * 0.09);
      const offset = wrapOffset(-t * speed * 18 + r * 60, w + 160);
      for (let k = -1; k < Math.ceil(w / 160) + 2; k++) {
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
  [0.36, 0.43, 0.5, 0.57].forEach((yFrac) => drawArrows(yFrac, windAt(yFrac, lowerWind, upperWind), 1));

  ctx.fillStyle = inShearZone ? "rgba(255,225,160,1)" : "rgba(255,210,140,0.95)";
  ctx.font = "600 10px Inter, sans-serif";
  ctx.fillText("MOVING WIND GRADIENT / WIND SHEAR ZONE", 10, bTop - 5);
  ctx.fillStyle = "rgba(190,235,255,0.9)";
  ctx.font = "600 11px Inter, sans-serif";
  ctx.fillText(`Upper Layer  ${upperWind.toFixed(0)} m/s`, 10, toPx(0.85));
  ctx.fillText(`Lower Layer  ${lowerWind.toFixed(0)} m/s`, 10, toPx(0.2));

  ctx.strokeStyle = "rgba(90,235,215,0.9)";
  ctx.lineWidth = 2;
  const fx = Math.max(120, w - 190);
  const fy = h * 0.105;
  ctx.beginPath();
  ctx.moveTo(fx, fy);
  ctx.lineTo(fx + 120, fy);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(fx + 120, fy);
  ctx.lineTo(fx + 110, fy - 5);
  ctx.lineTo(fx + 110, fy + 5);
  ctx.closePath();
  ctx.fillStyle = "rgba(90,235,215,0.9)";
  ctx.fill();
  ctx.font = "700 10px Inter, sans-serif";
  ctx.fillText("FORWARD FLIGHT", fx, fy - 8);

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

  const px = craft.x * w;
  const py = toPx(craft.y);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(craft.heading);
  const s = Math.min(1.25, w / 420) * 16;

  const bodyGrad = ctx.createLinearGradient(-s * 0.2, -s * 0.25, s * 0.2, s * 0.25);
  bodyGrad.addColorStop(0, "rgba(210,245,255,0.98)");
  bodyGrad.addColorStop(0.5, "rgba(140,200,230,0.95)");
  bodyGrad.addColorStop(1, "rgba(90,160,200,0.95)");
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 1.05, s * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(235,250,255,0.98)";
  ctx.beginPath();
  ctx.moveTo(s * 1.1, 0);
  ctx.lineTo(s * 0.45, s * 0.18);
  ctx.lineTo(s * 0.45, -s * 0.18);
  ctx.closePath();
  ctx.fill();

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

  const label = craft.state === "gain" ? "↑ ENERGY GAIN" : craft.state === "loss" ? "↓ ENERGY LOSS" : "• NEUTRAL";
  const reason = craft.state === "gain" ? "Crossing wind gradient" : craft.state === "loss" ? "Drag + turning" : "Little net energy change";
  ctx.font = "700 12px Inter, sans-serif";
  ctx.fillStyle = craft.state === "gain" ? "rgba(90,235,215,1)" : craft.state === "loss" ? "rgba(255,150,110,0.98)" : "rgba(165,195,215,0.9)";
  ctx.fillText(label, px + 18, py - 17);
  ctx.font = "600 10px Inter, sans-serif";
  ctx.fillStyle = "rgba(220,240,248,0.9)";
  ctx.fillText(reason, px + 18, py - 3);
}

function SceneCanvas({ sim }: { sim: RefObject<DSState> }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const rect = canvas.getBoundingClientRect();
      const s = sim.current;
      drawScene(ctx, rect.width, rect.height, s.ds, s.lowerWind, s.upperWind, s.t);
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [sim]);
  return <canvas ref={ref} className="h-[240px] w-full sm:h-[310px] lg:h-[360px]" />;
}

export default function DynamicSoaring() {
  const [running, setRunning] = useState(true);
  const [lowerWind, setLowerWind] = useState(7);
  const [upperWind, setUpperWind] = useState(22);
  const [, force] = useState(0);

  const sim = useRef<DSState>({
    t: 0,
    cycleSpeed: DEFAULT_CYCLE_SPEED,
    lowerWind: 7,
    upperWind: 22,
    ds: newCraft("Climb"),
    history: [],
  });

  sim.current.lowerWind = lowerWind;
  sim.current.upperWind = upperWind;
  sim.current.cycleSpeed = DEFAULT_CYCLE_SPEED;

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
      const windDiff = s.upperWind - s.lowerWind;
      const period = 8 / k;
      const phase = (s.t % period) / period;
      const ds = s.ds;
      const stageIndex = Math.floor(phase * 4);
      ds.stage = STAGES[stageIndex]!;

      const theta = phase * Math.PI * 2;
      const A = SOARING_PATH.amplitude;
      ds.y = Math.max(0.05, Math.min(0.95, 0.5 - A * Math.cos(theta)));
      ds.x = 0.62 + Math.sin(theta) * 0.035;

      const verticalDirection = A * Math.sin(theta);
      ds.heading = Math.atan2(-verticalDirection * 0.9, 1.45);
      ds.localWind = windAt(ds.y, s.lowerWind, s.upperWind);
      ds.altitude = 3 + ds.y * 45;

      const vertical = Math.abs(Math.sin(theta));
      const inBand = Math.max(0, 1 - Math.abs(ds.y - 0.5) / (BAND_HALF * 2.2));
      const crossing = vertical * inBand;
      const gain = crossing * windDiff * SOARING_PATH.efficiency * 0.55 * k;
      const drag = 1.0 * k * SOARING_PATH.dragMultiplier;
      const turning = Math.abs(Math.cos(theta));
      const turnLoss = turning * 1.35 * k * SOARING_PATH.dragMultiplier;
      const rate = gain - drag - turnLoss;
      ds.energyRate += (rate - ds.energyRate) * Math.min(1, dt * 4);
      ds.energy += rate * dt;
      ds.state = ds.energyRate > 0.35 ? "gain" : ds.energyRate < -0.35 ? "loss" : "neutral";
      ds.airspeed = 14 + crossing * 14 + (ds.y > 0.5 ? 3.5 : 0) + Math.sin(theta) * 0.6;

      ds.trail = ds.trail
        .map((p) => ({ x: p.x - dt * 0.13 * k, y: p.y }))
        .filter((p) => p.x > -0.08);
      ds.trail.push({ x: ds.x, y: ds.y });
      if (ds.trail.length > 180) ds.trail.shift();

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
  const crossingNow = Math.abs(ds.y - 0.5) <= BAND_HALF * 1.15;
  const guidedText = crossingNow
    ? `Wind-gradient crossing: local wind is changing between ${lowerWind.toFixed(0)} and ${upperWind.toFixed(0)} m/s. This is where useful wind energy can be extracted.`
    : ds.stage === "Climb"
      ? "Climb: the aircraft flies forward while rising from slower air toward the faster upper wind."
      : ds.stage === "Top Turn"
        ? "Top Turn: the aircraft turns in the faster upper wind. Drag and turning remove some energy."
        : ds.stage === "Descend"
          ? "Descend: the aircraft keeps moving forward while dropping back toward the slower lower wind layer."
          : "Bottom Turn: the aircraft turns in slower air and prepares for the next climb.";

  return (
    <div className="space-y-4 sm:space-y-6">
      <Panel className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-display text-lg font-extrabold leading-tight glow-text sm:text-2xl">
              DYNAMIC SOARING
            </h2>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              Albatross-Inspired Aircraft
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionButton variant={running ? "ghost" : "primary"} onClick={() => setRunning(true)} active={running}>
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
        <Panel className="overflow-hidden p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-sm font-bold sm:text-base">Albatross-Inspired Aircraft</h3>
              <p className="text-xs text-muted-foreground">Forward flight through a moving wind gradient</p>
            </div>
            <span className="tech-label rounded-full bg-accent/15 px-3 py-1 text-[10px] text-accent">
              {ds.stage}
            </span>
          </div>
          <div className="overflow-hidden rounded-xl border border-border">
            <SceneCanvas sim={sim} />
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {STAGES.map((st, index) => (
              <span
                key={st}
                className={`tech-label rounded-md px-2 py-1 text-[10px] ${
                  ds.stage === st ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"
                }`}
              >
                {index + 1}. {st.toUpperCase()}
              </span>
            ))}
          </div>
          <div className="mt-3 rounded-xl border border-primary/25 bg-primary/5 p-3">
            <div className="tech-label mb-1 text-[10px] text-primary">GUIDED EXPLANATION</div>
            <p className="text-xs leading-relaxed text-foreground sm:text-sm">{guidedText}</p>
          </div>
        </Panel>

        <div className="space-y-4 sm:space-y-5">
          <Panel className="p-4 sm:p-5">
            <h4 className="tech-label mb-3 text-xs text-primary">Controls</h4>
            <div className="space-y-4">
              <Slider label="Lower-Layer Wind Speed" value={lowerWind} min={0} max={15} unit="m/s" onChange={updateLowerWind} />
              <Slider label="Upper-Layer Wind Speed" value={upperWind} min={10} max={30} unit="m/s" onChange={updateUpperWind} />
            </div>
          </Panel>

          <Panel className="p-4 sm:p-5">
            <h4 className="tech-label mb-3 text-xs text-primary">Environment</h4>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <DataCard label="Lower Wind" value={lowerWind.toFixed(0)} unit="m/s" />
              <DataCard label="Upper Wind" value={upperWind.toFixed(0)} unit="m/s" />
              <DataCard label="Wind Gradient Speed" value={gradient.toFixed(0)} unit="m/s" tone="good" />
            </div>
          </Panel>

          <Panel className="p-4 sm:p-5">
            <h4 className="tech-label mb-3 text-xs text-primary">Live Data</h4>
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <DataCard label="Airspeed" value={ds.airspeed.toFixed(1)} unit="m/s" />
              <DataCard label="Altitude" value={ds.altitude.toFixed(1)} unit="m" />
              <DataCard label="Local Wind Speed" value={ds.localWind.toFixed(1)} unit="m/s" />
              <DataCard
                label="Energy Change"
                value={`${ds.energyRate >= 0 ? "+" : "−"}${Math.abs(ds.energyRate).toFixed(1)}`}
                unit="units/s"
                tone={ds.state === "gain" ? "good" : ds.state === "loss" ? "warn" : "default"}
              />
            </div>
          </Panel>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Panel className="p-4 sm:p-5">
          <h4 className="tech-label mb-2 text-xs text-primary">What is Dynamic Soaring?</h4>
          <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
            Dynamic soaring is a flight technique that extracts useful energy by repeatedly crossing between
            slower and faster moving air. The aircraft is still flying forward; the up-and-down motion is only
            the repeated climb and descent through the moving wind gradient.
          </p>
        </Panel>
        <Panel className="p-4 sm:p-5">
          <h4 className="tech-label mb-2 text-xs text-primary">Energy Mechanism</h4>
          <div className="grid gap-2 text-xs sm:grid-cols-3 sm:text-sm">
            <div className="rounded-lg border border-accent/25 bg-accent/5 p-2">
              <span className="font-semibold text-accent">Gradient crossing</span>
              <div className="mt-1 text-muted-foreground">Energy gain</div>
            </div>
            <div className="rounded-lg border border-border bg-secondary/20 p-2">
              <span className="font-semibold text-foreground">Turning + drag</span>
              <div className="mt-1 text-muted-foreground">Energy loss</div>
            </div>
            <div className="rounded-lg border border-primary/25 bg-primary/5 p-2">
              <span className="font-semibold text-primary">Forward repeat cycle</span>
              <div className="mt-1 text-muted-foreground">Sustained flight</div>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
