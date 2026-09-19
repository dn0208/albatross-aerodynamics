import { useEffect, useRef, useState } from "react";
import { ActionButton, DataCard, Note, Panel, Slider } from "./ui";

const LOWER_WIND = 7;
const UPPER_WIND = 22;
const STAGES = ["Climb", "Top Turn", "Descend", "Bottom Turn"] as const;
type Stage = (typeof STAGES)[number];

type Craft = {
  x: number;
  y: number; // 0 = sea level, 1 = top of scene
  heading: number;
  airspeed: number;
  altitude: number;
  localWind: number;
  energy: number;
  gaining: boolean;
  stage: Stage;
  trail: { x: number; y: number }[];
};

type DSState = {
  t: number;
  cycleSpeed: number;
  altitudeOffset: number;
  ds: Craft;
  trad: Craft;
  history: { t: number; ds: number; trad: number }[];
};

function newCraft(stage: Stage): Craft {
  return {
    x: 0.5,
    y: 0.25,
    heading: 0,
    airspeed: 18,
    altitude: 6,
    localWind: LOWER_WIND,
    energy: 0,
    gaining: false,
    stage,
    trail: [],
  };
}

function windAt(y: number) {
  // smooth shear between the two layers around y = 0.5
  const k = 1 / (1 + Math.exp(-(y - 0.5) * 14));
  return LOWER_WIND + (UPPER_WIND - LOWER_WIND) * k;
}

function drawScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  craft: Craft,
  t: number,
  isDS: boolean,
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
    const alpha = speed > 15 ? 0.75 : 0.4;
    const len = speed * 2.2;
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
  drawArrows(0.62, UPPER_WIND, 3);
  drawArrows(0.08, LOWER_WIND, 3);

  // shear boundary
  const by = toPx(0.5);
  ctx.save();
  ctx.setLineDash([10, 8]);
  ctx.strokeStyle = "rgba(255,200,120,0.9)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, by);
  ctx.lineTo(w, by);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = "rgba(255,210,140,0.95)";
  ctx.font = "600 10px Inter, sans-serif";
  ctx.fillText("Wind Gradient / Wind Shear Zone", 10, by - 6);

  ctx.fillStyle = "rgba(190,235,255,0.9)";
  ctx.font = "600 11px Inter, sans-serif";
  ctx.fillText(`Upper Layer  ${UPPER_WIND} m/s`, 10, toPx(0.85));
  ctx.fillText(`Lower Layer  ${LOWER_WIND} m/s`, 10, toPx(0.2));

  // trail
  if (craft.trail.length > 1) {
    ctx.strokeStyle = isDS ? "rgba(90,235,215,0.8)" : "rgba(255,190,110,0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    craft.trail.forEach((p, i) => {
      const px = p.x * w;
      const py = toPx(p.y);
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    });
    ctx.stroke();
  }

  // aircraft (small planform glyph)
  const px = craft.x * w;
  const py = toPx(craft.y);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(craft.heading);
  const s = Math.min(1.2, w / 420) * 14;
  const g = ctx.createLinearGradient(-s, 0, s, 0);
  g.addColorStop(0, "rgba(235,250,255,0.98)");
  g.addColorStop(1, "rgba(120,190,220,0.95)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(s * 1.15, 0);
  ctx.lineTo(-s * 0.3, s * 0.22);
  ctx.lineTo(-s * 0.9, s * 0.1);
  ctx.lineTo(-s * 0.9, -s * 0.1);
  ctx.lineTo(-s * 0.3, -s * 0.22);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = isDS ? "rgba(90,235,215,0.95)" : "rgba(255,190,110,0.95)";
  ctx.beginPath();
  ctx.moveTo(s * 0.1, 0);
  ctx.lineTo(-s * 0.45, s * 0.95);
  ctx.lineTo(-s * 0.15, s * 0.95);
  ctx.lineTo(s * 0.35, 0);
  ctx.lineTo(-s * 0.15, -s * 0.95);
  ctx.lineTo(-s * 0.45, -s * 0.95);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // energy indicator
  ctx.font = "700 12px Inter, sans-serif";
  if (craft.gaining) {
    ctx.fillStyle = "rgba(90,235,215,1)";
    ctx.fillText("+ Energy", px + 16, py - 14);
  } else {
    ctx.fillStyle = "rgba(255,150,130,0.95)";
    ctx.fillText("− Drag Loss", px + 16, py - 14);
  }
}

function SceneCanvas({
  sim,
  isDS,
}: {
  sim: React.RefObject<DSState>;
  isDS: boolean;
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
      drawScene(ctx, w, h, isDS ? s.ds : s.trad, s.t, isDS);
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [isDS, sim]);
  return <canvas ref={ref} className="h-[240px] w-full sm:h-[310px] lg:h-[350px]" />;
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
        min = Math.min(min, p.ds, p.trad);
        max = Math.max(max, p.ds, p.trad);
      }
      const pad = (max - min) * 0.12 + 1;
      min -= pad;
      max += pad;
      const t0 = hist[0]!.t;
      const t1 = Math.max(hist[hist.length - 1]!.t, t0 + 1);
      const plot = (key: "ds" | "trad", color: string) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        hist.forEach((p, i) => {
          const x = ((p.t - t0) / (t1 - t0)) * w;
          const y = h - ((p[key] - min) / (max - min)) * h;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.stroke();
      };
      plot("trad", "rgba(255,190,110,0.9)");
      plot("ds", "rgba(90,235,215,1)");
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
  const [cycleSpeed, setCycleSpeed] = useState(100);
  const [altitude, setAltitude] = useState(0);
  const [, force] = useState(0);

  const sim = useRef<DSState>({
    t: 0,
    cycleSpeed: 1,
    altitudeOffset: 0,
    ds: newCraft("Climb"),
    trad: newCraft("Climb"),
    history: [],
  });
  sim.current.cycleSpeed = cycleSpeed / 100;
  sim.current.altitudeOffset = altitude;

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
      const yOffset = s.altitudeOffset / 45;

      // --- Albatross-inspired: dynamic soaring cycle ---
      const period = 8 / k;
      const phase = (s.t % period) / period;
      const ds = s.ds;
      const stageIndex = Math.floor(phase * 4);
      ds.stage = STAGES[stageIndex]!;
      // vertical: sinusoidal between 0.12 and 0.88, horizontal: figure sweep
      ds.y = Math.max(0.05, Math.min(0.95, 0.5 - 0.38 * Math.cos(phase * Math.PI * 2) + yOffset));
      ds.x = 0.5 + 0.34 * Math.sin(phase * Math.PI * 2);
      const dyn = Math.sin(phase * Math.PI * 2);
      ds.heading = -dyn * 0.9 + (ds.stage.includes("Turn") ? 0.2 : 0);
      ds.localWind = windAt(ds.y);
      ds.altitude = 3 + ds.y * 45;
      const crossing = Math.abs(dyn) * (1 - Math.abs(ds.y - 0.5) * 1.2);
      const gain = Math.max(0, crossing) * (UPPER_WIND - LOWER_WIND) * 0.5 * k;
      const drag = 1.25 * k;
      ds.airspeed = 16 + Math.max(0, crossing) * 18 + (ds.y > 0.5 ? 4 : 0);
      ds.gaining = gain > drag;
      ds.energy += (gain - drag) * dt;
      ds.trail.push({ x: ds.x, y: ds.y });
      if (ds.trail.length > 260) ds.trail.shift();

      // --- Traditional: level cruise inside the lower layer ---
      const tr = s.trad;
      tr.x = (0.08 + ((s.t * 0.12 * k) % 1) * 0.9) % 1;
      tr.y = Math.max(0.05, Math.min(0.95, 0.3 + Math.sin(s.t * 0.9 * k) * 0.03 + yOffset));
      tr.heading = Math.cos(s.t * 0.9 * k) * 0.08;
      tr.localWind = windAt(tr.y);
      tr.altitude = 3 + tr.y * 45;
      tr.airspeed = 19 + Math.sin(s.t * 0.9 * k) * 1.2;
      tr.stage = "Climb";
      tr.gaining = false;
      tr.energy += -0.95 * k * dt;
      tr.trail.push({ x: tr.x, y: tr.y });
      if (tr.trail.length > 90 || (tr.trail.length > 1 && tr.x < tr.trail[tr.trail.length - 2]!.x))
        tr.trail.shift();

      histAcc += dt;
      if (histAcc > 0.25) {
        histAcc = 0;
        s.history.push({ t: s.t, ds: ds.energy, trad: tr.energy });
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
    sim.current.trad = newCraft("Climb");
    sim.current.history = [];
    setCycleSpeed(100);
    setAltitude(0);
    setRunning(true);
  };

  const ds = sim.current.ds;
  const tr = sim.current.trad;

  const panel = (isDS: boolean) => {
    const c = isDS ? ds : tr;
    return (
      <Panel className="overflow-hidden p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-sm font-bold sm:text-base">
              {isDS ? "Albatross-Inspired Aircraft" : "Traditional Aircraft"}
            </h3>
            <p className="text-xs text-muted-foreground">
              {isDS ? "Dynamic soaring through the gradient" : "Level cruise, lower layer"}
            </p>
          </div>
          {isDS ? (
            <span className="tech-label rounded-full bg-accent/15 px-3 py-1 text-[10px] text-accent">
              {c.stage}
            </span>
          ) : (
            <span className="tech-label rounded-full bg-[color:var(--warn)]/15 px-3 py-1 text-[10px] text-[color:var(--warn)]">
              Powered
            </span>
          )}
        </div>
        <div className="overflow-hidden rounded-xl border border-border">
          <SceneCanvas sim={sim} isDS={isDS} />
        </div>
        {isDS && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {STAGES.map((st) => (
              <span
                key={st}
                className={`tech-label rounded-md px-2 py-1 text-[10px] ${
                  c.stage === st
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground"
                }`}
              >
                {st}
              </span>
            ))}
          </div>
        )}
        <div className="mt-3 grid grid-cols-2 gap-2 sm:gap-3">
          <DataCard label="Airspeed" value={c.airspeed.toFixed(1)} unit="m/s" />
          <DataCard label="Altitude" value={c.altitude.toFixed(1)} unit="m" />
          <DataCard label="Local Wind Speed" value={c.localWind.toFixed(1)} unit="m/s" />
          <DataCard
            label="Wind-Speed Difference"
            value={(UPPER_WIND - LOWER_WIND).toFixed(0)}
            unit="m/s"
          />
          <div className="col-span-2">
            <DataCard
              label="Energy Gained from the Wind"
              value={(Math.abs(c.energy) < 0.05 ? 0 : c.energy).toFixed(1)}
              unit="units"
              tone={c.energy > 0 ? "good" : "warn"}
              big
            />
          </div>
        </div>
      </Panel>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <Panel className="p-4 sm:p-5">
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <Slider
            label="Cycle Speed"
            value={cycleSpeed}
            min={40}
            max={180}
            unit="%"
            onChange={setCycleSpeed}
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
          </div>
        </div>
      </Panel>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        {panel(false)}
        {panel(true)}
      </div>

      <Panel className="p-4 sm:p-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h4 className="tech-label text-xs text-primary">Energy vs Time</h4>
          <div className="flex gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <i className="inline-block h-2 w-4 rounded bg-accent" /> Albatross-inspired
            </span>
            <span className="flex items-center gap-1.5">
              <i className="inline-block h-2 w-4 rounded bg-[color:var(--warn)]" />
              Traditional
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
