import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import WindTunnel from "@/components/sim/WindTunnel";
import DynamicSoaring from "@/components/sim/DynamicSoaring";
import { Panel } from "@/components/sim/ui";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Biomimicry & Aerodynamics Project" },
      {
        name: "description",
        content:
          "Noise reduced and aerodynamically improved vehicle and aeroplane designs inspired by shark skin, albatross wings and boxfish geometry.",
      },
      { property: "og:title", content: "Biomimicry & Aerodynamics Project" },
      {
        property: "og:description",
        content:
          "Interactive project website with overview, simulations, presentation, citations and team.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const NAV = ["Overview", "Simulation", "Presentation", "Citations", "Team"] as const;
type Section = (typeof NAV)[number];

const REPO_RAW = "https://raw.githubusercontent.com/dn0208/albatross-aerodynamics/main";
const PRESENTATION_PDF_FILE = "Noise Reduced Aerodynamic Biomimicry_Final.pdf";
const PRESENTATION_PDF_URL = `${REPO_RAW}/Noise%20Reduced%20Aerodynamic%20Biomimicry_Final.pdf`;
const PDFJS_SCRIPT_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDFJS_WORKER_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

declare global {
  interface Window {
    pdfjsLib?: any;
  }
}

function base64ToBlob(base64: string, type: string) {
  const binary = atob(base64.replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

function ProjectImage({
  path,
  alt,
  className = "",
}: {
  path: string;
  alt: string;
  className?: string;
}) {
  const [src, setSrc] = useState(path.endsWith(".b64") ? "" : path);

  useEffect(() => {
    let alive = true;

    if (!path.endsWith(".b64")) {
      setSrc(path);
      return () => {
        alive = false;
      };
    }

    setSrc("");
    fetch(path)
      .then((r) => {
        if (!r.ok) throw new Error("Image asset not found");
        return r.text();
      })
      .then((b64) => {
        if (alive) setSrc(`data:image/jpeg;base64,${b64.trim()}`);
      })
      .catch(() => {
        if (alive) setSrc("");
      });

    return () => {
      alive = false;
    };
  }, [path]);

  return src ? (
    <img src={src} alt={alt} className={className} loading="lazy" />
  ) : (
    <div
      className={`flex items-center justify-center bg-secondary/40 text-xs text-muted-foreground ${className}`}
    >
      Loading image…
    </div>
  );
}

const DESIGNS = [
  {
    title: "Shark-Skin Inspired Drag Reduction",
    image: `${REPO_RAW}/Shark%20Skin.jpg`,
    points: [
      "Shark skin has microscopic dermal denticles instead of a perfectly smooth surface.",
      "Riblet surfaces copy these grooves to reduce skin-friction drag.",
      "The presentation reports about 5–8% drag reduction for riblet surfaces.",
      "Applications include aircraft, high-performance vehicles, marine hulls and wind-turbine blades.",
    ],
  },
  {
    title: "Albatross-Inspired Aircraft Wings",
    image: `${REPO_RAW}/Albatross.jpg`,
    points: [
      "Dynamic soaring crosses slower and faster air layers to extract useful wind energy.",
      "Long, narrow wings help the albatross glide efficiently over long distances.",
      "Hinged or flexible wingtips can react to gusts and reduce structural load.",
      "Lower loads can support lighter aircraft structures and better efficiency.",
    ],
  },
  {
    title: "Boxfish-Inspired Vehicle Design",
    image: `${REPO_RAW}/Boxfish.jpg`,
    points: [
      "The boxfish has a compact body, rigid shell and large internal volume.",
      "Its body form affects flow separation, wake formation and pressure drag.",
      "The idea inspired boxfish-like roof, side and rear vehicle contours.",
      "The PPT presents the Mercedes-Benz Bionic concept with a reported drag coefficient of 0.19.",
    ],
  },
];

const TEAM = [
  { name: "Dhruv Malkani", roll: "C302", image: `${REPO_RAW}/Dhruv.jpeg` },
  { name: "Arya Mozar", roll: "C322", image: `${REPO_RAW}/Arya.jpeg` },
  { name: "Tanaya Naik", roll: "C324", image: `${REPO_RAW}/Tanaya.jpeg` },
  { name: "Daksh Nandan", roll: "C327", image: `${REPO_RAW}/Daksh.jpeg?v=daksh-latest` },
];

const CITATIONS = [
  { label: "Riblets for aircraft – skin friction reduction – Michael J. Walsh", url: "" },
  { label: "YouTube – Shark-skin / riblet reference video", url: "https://www.youtube.com/watch?v=c_zvlwGqZpM" },
  { label: "Airbus – AlbatrossOne", url: "https://www.airbus.com/en/innovation/future-aircraft/wings/albatrossone" },
  { label: "Airbus – Biomimicry: engineering in nature’s style", url: "https://www.airbus.com/en/newsroom/news/2018-01-biomimicry-engineering-in-natures-style" },
  { label: "YouTube – Albatross-inspired concept reference", url: "https://www.youtube.com/watch?v=d1z8YUs2FLc" },
  { label: "Slate – Mercedes-Benz bionic car / boxfish stability and agility", url: "https://slate.com/technology/2015/03/mercedes-benz-bionic-car-boxfish-stability-and-agility-paradox-finally-solved.html" },
  { label: "YouTube – Boxfish biomimicry reference", url: "https://www.youtube.com/watch?v=xOQrVQfqE08" },
];

function Overview() {
  return (
    <div className="space-y-5 sm:space-y-7">
      <Panel className="overflow-hidden p-5 sm:p-7">
        <p className="tech-label text-[10px] text-accent sm:text-xs">Biomimicry • Aerodynamics</p>
        <h1 className="mt-2 max-w-5xl font-display text-2xl font-extrabold leading-tight glow-text sm:text-4xl lg:text-5xl">
          Noise reduced / aerodynamically improved vehicles and aeroplane designs
        </h1>
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-border bg-secondary/20 p-4">
            <div className="tech-label text-[10px] text-primary">What is biomimicry?</div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Biomimicry means learning from nature and translating those strategies into human design. The presentation describes evolution as natural optimisation for efficient performance with minimal energy input.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-secondary/20 p-4">
            <div className="tech-label text-[10px] text-primary">Why it helps aerodynamics</div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Nature offers textured surfaces, flexible structures and passive vortex control that can reduce energy losses without extra active actuators.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-secondary/20 p-4">
            <div className="tech-label text-[10px] text-primary">Engineering impact</div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              These ideas connect with lower drag, reduced energy consumption, improved stability and lighter, more efficient transport systems.
            </p>
          </div>
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-3">
        {DESIGNS.map((design) => (
          <Panel key={design.title} className="overflow-hidden p-0">
            <ProjectImage path={design.image} alt={design.title} className="h-52 w-full object-cover sm:h-60" />
            <div className="p-5">
              <h2 className="font-display text-lg font-bold leading-snug">{design.title}</h2>
              <ul className="mt-4 space-y-2 text-sm leading-relaxed text-muted-foreground">
                {design.points.map((point) => (
                  <li key={point} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}

function Simulation() {
  const [simTab, setSimTab] = useState<"tunnel" | "soaring">("tunnel");
  return (
    <div className="space-y-5">
      <Panel className="p-5 sm:p-7">
        <p className="tech-label text-[10px] text-accent sm:text-xs">Simulation</p>
        <h2 className="mt-1 font-display text-2xl font-extrabold leading-tight glow-text sm:text-4xl">
          Albatross Inspired Airplane Wings
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Interactive simulation showing how albatross-inspired wings use wind gradients for efficient flight.
        </p>
      </Panel>

      <div className="glass grid grid-cols-2 gap-1 rounded-2xl p-1 sm:inline-grid">
        <button
          onClick={() => setSimTab("tunnel")}
          className={`tech-label min-h-[46px] rounded-xl px-4 text-[10px] font-semibold transition-all sm:px-6 sm:text-xs ${
            simTab === "tunnel"
              ? "bg-primary text-primary-foreground shadow-[0_0_24px_oklch(0.8_0.14_200/40%)]"
              : "text-muted-foreground hover:bg-secondary"
          }`}
        >
          WIND TUNNEL
        </button>
        <button
          onClick={() => setSimTab("soaring")}
          className={`tech-label min-h-[46px] rounded-xl px-4 text-[10px] font-semibold transition-all sm:px-6 sm:text-xs ${
            simTab === "soaring"
              ? "bg-primary text-primary-foreground shadow-[0_0_24px_oklch(0.8_0.14_200/40%)]"
              : "text-muted-foreground hover:bg-secondary"
          }`}
        >
          DYNAMIC SOARING
        </button>
      </div>
      {simTab === "tunnel" ? (
        <WindTunnel />
      ) : (
        <div className="default-speed-only">
          <style>{`
            .default-speed-only button:nth-of-type(4),
            .default-speed-only button:nth-of-type(5) {
              display: none;
            }
          `}</style>
          <DynamicSoaring />
        </div>
      )}
    </div>
  );
}

function loadPdfJs() {
  return new Promise<any>((resolve, reject) => {
    if (window.pdfjsLib) {
      resolve(window.pdfjsLib);
      return;
    }

    const existingScript = document.getElementById("pdfjs-script") as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener(
        "load",
        () => {
          if (window.pdfjsLib) resolve(window.pdfjsLib);
          else reject(new Error("PDF preview script loaded without PDF.js"));
        },
        { once: true },
      );
      existingScript.addEventListener("error", () => reject(new Error("PDF preview script failed")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = "pdfjs-script";
    script.src = PDFJS_SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      if (window.pdfjsLib) resolve(window.pdfjsLib);
      else reject(new Error("PDF preview script loaded without PDF.js"));
    };
    script.onerror = () => reject(new Error("PDF preview script failed"));
    document.body.appendChild(script);
  });
}

function PdfPreview({ url }: { url: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const pdfRef = useRef<any>(null);
  const renderTaskRef = useRef<any>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [status, setStatus] = useState("Loading PDF preview…");

  useEffect(() => {
    let cancelled = false;
    setStatus("Loading PDF preview…");
    setPageNumber(1);
    setPageCount(0);
    pdfRef.current = null;

    loadPdfJs()
      .then((pdfjs) => {
        if (cancelled) return null;
        pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
        return pdfjs.getDocument({ url }).promise;
      })
      .then((pdf) => {
        if (!pdf || cancelled) return;
        pdfRef.current = pdf;
        setPageCount(pdf.numPages || 0);
        setStatus("");
      })
      .catch(() => {
        if (!cancelled) setStatus("PDF preview could not be loaded. Please use the Download button.");
      });

    return () => {
      cancelled = true;
      if (renderTaskRef.current?.cancel) renderTaskRef.current.cancel();
    };
  }, [url]);

  useEffect(() => {
    let cancelled = false;

    const renderPage = async () => {
      const pdf = pdfRef.current;
      const canvas = canvasRef.current;
      if (!pdf || !canvas || pageCount === 0) return;

      try {
        setStatus(`Loading page ${pageNumber}…`);
        if (renderTaskRef.current?.cancel) renderTaskRef.current.cancel();
        const page = await pdf.getPage(pageNumber);
        if (cancelled) return;

        const containerWidth = viewerRef.current ? viewerRef.current.clientWidth : 900;
        const baseViewport = page.getViewport({ scale: 1 });
        const maxPreviewHeight = Math.min(680, Math.max(320, window.innerHeight * 0.62));
        const widthScale = (containerWidth - 24) / baseViewport.width;
        const heightScale = maxPreviewHeight / baseViewport.height;
        const scale = Math.min(2.2, Math.max(0.25, Math.min(widthScale, heightScale)));
        const viewport = page.getViewport({ scale });
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        canvas.style.maxWidth = "100%";
        canvas.style.maxHeight = `${maxPreviewHeight}px`;

        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas context unavailable");
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, viewport.width, viewport.height);

        const renderTask = page.render({ canvasContext: ctx, viewport });
        renderTaskRef.current = renderTask;
        await renderTask.promise;
        if (!cancelled) setStatus("");
      } catch (error) {
        if (!cancelled && (error as { name?: string }).name !== "RenderingCancelledException") {
          setStatus("PDF page could not be shown. Please use the Download button.");
        }
      }
    };

    renderPage();
    window.addEventListener("resize", renderPage);

    return () => {
      cancelled = true;
      window.removeEventListener("resize", renderPage);
      if (renderTaskRef.current?.cancel) renderTaskRef.current.cancel();
    };
  }, [pageNumber, pageCount]);

  const goPrevious = () => setPageNumber((page) => Math.max(1, page - 1));
  const goNext = () => setPageNumber((page) => Math.min(pageCount || page, page + 1));

  return (
    <Panel className="overflow-hidden p-2 sm:p-3">
      <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
        <button
          onClick={goPrevious}
          disabled={pageNumber <= 1 || pageCount === 0}
          className="tech-label min-h-[38px] rounded-lg border border-border px-4 text-[10px] font-semibold text-muted-foreground transition-all hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>
        <div className="tech-label rounded-full bg-secondary/30 px-3 py-2 text-[10px] text-foreground">
          Page {pageCount ? pageNumber : "—"} / {pageCount || "—"}
        </div>
        <button
          onClick={goNext}
          disabled={pageNumber >= pageCount || pageCount === 0}
          className="tech-label min-h-[38px] rounded-lg border border-border px-4 text-[10px] font-semibold text-muted-foreground transition-all hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
      <div ref={viewerRef} className="min-h-[320px] overflow-hidden rounded-xl border border-white/25 bg-transparent p-1 text-center sm:min-h-[420px]">
        {status ? <div className="mb-3 text-center text-xs text-muted-foreground">{status}</div> : null}
        <canvas ref={canvasRef} className="mx-auto block rounded-md border-4 border-white bg-white shadow-lg" />
      </div>
    </Panel>
  );
}

function Presentation() {
  const downloadPdf = async () => {
    const response = await fetch(PRESENTATION_PDF_URL);
    if (!response.ok) return;
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = PRESENTATION_PDF_FILE;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="space-y-4">
      <Panel className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-xl font-bold sm:text-2xl">Presentation</h2>
          </div>
          <button
            onClick={downloadPdf}
            className="tech-label min-h-[44px] rounded-xl bg-primary px-5 text-xs font-semibold text-primary-foreground shadow-[0_0_24px_oklch(0.8_0.14_200/30%)] transition-transform hover:scale-[1.02]"
          >
            DOWNLOAD
          </button>
        </div>
      </Panel>
      <PdfPreview url={PRESENTATION_PDF_URL} />
    </div>
  );
}

function Citations() {
  return (
    <Panel className="p-5 sm:p-7">
      <h2 className="font-display text-2xl font-bold">Citations</h2>
      <div className="mt-5 space-y-3">
        {CITATIONS.map((citation, index) => (
          <div key={citation.label} className="flex gap-4 rounded-xl border border-border bg-secondary/20 p-4">
            <span className="tech-label flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-xs text-primary">{index + 1}</span>
            <div className="min-w-0">
              <div className="text-sm font-semibold leading-relaxed">{citation.label}</div>
              {citation.url ? (
                <a href={citation.url} target="_blank" rel="noreferrer" className="mt-1 block break-all text-xs text-accent hover:underline">{citation.url}</a>
              ) : (
                <div className="mt-1 text-xs text-muted-foreground">Research paper reference from the PPT</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Team() {
  return (
    <div className="space-y-5">
      <Panel className="p-5 sm:p-7">
        <h2 className="font-display text-2xl font-bold sm:text-3xl">Presented by</h2>
      </Panel>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {TEAM.map((member) => (
          <Panel key={member.roll} className="p-5 text-center">
            <div className="mx-auto flex justify-center rounded-full border border-primary/25 bg-secondary/20 p-2 shadow-[0_0_24px_oklch(0.8_0.14_200/18%)] sm:w-fit">
              <ProjectImage
                path={member.image}
                alt={member.name}
                className="h-52 w-52 rounded-full border-4 border-primary/45 object-cover object-top shadow-[0_0_22px_oklch(0.8_0.14_200/20%)] sm:h-56 sm:w-56 xl:h-60 xl:w-60"
              />
            </div>
            <div className="mt-4 font-display text-lg font-bold">{member.name}</div>
            <div className="tech-label mt-1 text-xs text-accent">{member.roll}</div>
          </Panel>
        ))}
      </div>
    </div>
  );
}

function Index() {
  const [section, setSection] = useState<Section>("Overview");

  return (
    <main className="mx-auto w-full max-w-[1500px] px-3 py-4 sm:px-6 sm:py-6">
      <header className="glass sticky top-3 z-50 mb-6 rounded-2xl border border-border/70 px-4 py-3 backdrop-blur-xl sm:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <button onClick={() => setSection("Overview")} className="text-left">
            <div className="tech-label text-[9px] text-accent sm:text-[10px]">Biomimicry • Aerodynamics</div>
            <div className="font-display text-sm font-extrabold sm:text-base">Nature-Inspired Transport Design</div>
          </button>
          <nav className="flex flex-wrap gap-1.5 lg:justify-end" aria-label="Project sections">
            {NAV.map((item) => (
              <button
                key={item}
                onClick={() => setSection(item)}
                className={`tech-label min-h-[38px] rounded-lg px-3 text-[9px] font-semibold transition-all sm:px-4 sm:text-[10px] ${
                  section === item
                    ? "bg-primary text-primary-foreground shadow-[0_0_18px_oklch(0.8_0.14_200/30%)]"
                    : "border border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                {item}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {section === "Overview" && <Overview />}
      {section === "Simulation" && <Simulation />}
      {section === "Presentation" && <Presentation />}
      {section === "Citations" && <Citations />}
      {section === "Team" && <Team />}
    </main>
  );
}
