import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
    image: "/assets-b64/shark.jpg.b64",
    points: [
      "Shark skin has microscopic dermal denticles instead of a perfectly smooth surface.",
      "Riblet surfaces copy these grooves to reduce skin-friction drag.",
      "The presentation reports about 5–8% drag reduction for riblet surfaces.",
      "Applications include aircraft, high-performance vehicles, marine hulls and wind-turbine blades.",
    ],
  },
  {
    title: "Albatross-Inspired Aircraft Wings",
    image: "/assets-b64/albatross.jpg.b64",
    points: [
      "Dynamic soaring crosses slower and faster air layers to extract useful wind energy.",
      "Long, narrow wings help the albatross glide efficiently over long distances.",
      "Hinged or flexible wingtips can react to gusts and reduce structural load.",
      "Lower loads can support lighter aircraft structures and better efficiency.",
    ],
  },
  {
    title: "Boxfish-Inspired Vehicle Design",
    image: "/assets-b64/boxfish.jpg.b64",
    points: [
      "The boxfish has a compact body, rigid shell and large internal volume.",
      "Its body form affects flow separation, wake formation and pressure drag.",
      "The idea inspired boxfish-like roof, side and rear vehicle contours.",
      "The PPT presents the Mercedes-Benz Bionic concept with a reported drag coefficient of 0.19.",
    ],
  },
];

const TEAM = [
  { name: "Dhruv", roll: "C302", image: `${REPO_RAW}/Dhruv.jpeg` },
  { name: "Arya", roll: "C322", image: `${REPO_RAW}/Arya.jpeg` },
  { name: "Tanaya", roll: "C324", image: `${REPO_RAW}/Tanaya.jpeg` },
  { name: "Daksh", roll: "C327", image: `${REPO_RAW}/Daksh.jpeg?v=daksh-latest` },
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
    <div>
      <div className="glass mb-5 grid grid-cols-2 gap-1 rounded-2xl p-1 sm:mb-7 sm:inline-grid">
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
      {simTab === "tunnel" ? <WindTunnel /> : <DynamicSoaring />}
    </div>
  );
}

function Presentation() {
  const [pdfUrl, setPdfUrl] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let objectUrl = "";
    let alive = true;
    fetch("/assets-b64/presentation.pdf.b64")
      .then((r) => {
        if (!r.ok) throw new Error("Presentation preview not found");
        return r.text();
      })
      .then((b64) => {
        if (!alive) return;
        objectUrl = URL.createObjectURL(base64ToBlob(b64, "application/pdf"));
        setPdfUrl(objectUrl);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, []);

  const downloadPpt = async () => {
    const response = await fetch("/assets-b64/presentation.pptx.b64");
    if (!response.ok) return;
    const b64 = await response.text();
    const url = URL.createObjectURL(
      base64ToBlob(
        b64,
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "Noise_Reduced_Aerodynamic_Biomimicry_Presentation.pptx";
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
            <h2 className="font-display text-xl font-bold sm:text-2xl">Project Presentation</h2>
            <p className="mt-1 text-sm text-muted-foreground">View the complete presentation directly on the website.</p>
          </div>
          <button
            onClick={downloadPpt}
            className="tech-label min-h-[44px] rounded-xl bg-primary px-5 text-xs font-semibold text-primary-foreground shadow-[0_0_24px_oklch(0.8_0.14_200/30%)] transition-transform hover:scale-[1.02]"
          >
            DOWNLOAD PPT
          </button>
        </div>
      </Panel>
      <Panel className="overflow-hidden p-2 sm:p-3">
        {loading ? (
          <div className="flex min-h-[65vh] items-center justify-center text-sm text-muted-foreground">Loading presentation…</div>
        ) : pdfUrl ? (
          <iframe title="Project presentation" src={pdfUrl} className="h-[70vh] min-h-[520px] w-full rounded-xl border border-border bg-white" />
        ) : (
          <div className="flex min-h-[50vh] items-center justify-center p-8 text-center text-sm text-muted-foreground">Presentation preview could not be loaded.</div>
        )}
      </Panel>
    </div>
  );
}

function Citations() {
  return (
    <Panel className="p-5 sm:p-7">
      <p className="tech-label text-[10px] text-accent sm:text-xs">Project Sources</p>
      <h2 className="mt-1 font-display text-2xl font-bold">Citations</h2>
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
        <p className="tech-label text-[10px] text-accent sm:text-xs">Presented By</p>
        <h2 className="mt-1 font-display text-2xl font-bold sm:text-3xl">Team</h2>
        <p className="mt-2 text-sm text-muted-foreground">Team members and roll numbers from the first slide of the presentation.</p>
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

      <footer className="mt-8 pb-4 text-center text-[11px] text-muted-foreground">
        College biomimicry & aerodynamics project • Simulation values are illustrative educational estimates.
      </footer>
    </main>
  );
}
