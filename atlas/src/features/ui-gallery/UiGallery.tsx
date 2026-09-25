// Galería de primitivas (#/ui). Solo en desarrollo: app.tsx la carga con
// import.meta.env.DEV y no entra en el build de producción.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  BookOpen,
  CalendarDays,
  ChevronRight,
  Clock,
  Columns2,
  Compass,
  GitBranch,
  Layers,
  Monitor,
  Moon,
  MoonStar,
  Orbit,
  Play,
  Plus,
  Search,
  Settings,
  Sparkles,
  Sun,
  Sunrise,
  Telescope,
  Trophy,
  Undo2,
  Waypoints,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  Freshness,
  Heatmap,
  HeroNumber,
  IconButton,
  InkCard,
  Kbd,
  LevelBars,
  Marker,
  Md,
  Page,
  ProgressBar,
  RankGlyph,
  Ring,
  Section,
  Segmented,
  SegmentedBar,
  SidePanel,
  Star,
  StarDefs,
  StarField,
  StarMark,
  STAR_STATE_LABELS,
  SubjectDot,
  SubjectTag,
  SUBJECT_IDS,
  TabPanel,
  Tabs,
  TeX,
  Toaster,
  Tooltip,
  dateLong,
  dateShort,
  dayKeyOf,
  minutes,
  minutesShort,
  pct,
  plural,
  relDays,
  seededRandom,
  signed,
  toast,
  weekday,
  type StarState,
} from "../../ui";

type ThemeMode = "system" | "dark" | "light" | "both";

const RANKS = ["Polvo estelar", "Nebulosa", "Protoestrella", "Estrella", "Gigante", "Supergigante", "Púlsar", "Cúmulo", "Galaxia", "Supernova"];

const MODES: ThemeMode[] = ["system", "dark", "light", "both"];

/** Tema inicial: #/ui?tema=light|dark|system|both, o el último elegido. */
function initialMode(): ThemeMode {
  const q = new URLSearchParams(window.location.hash.split("?")[1] ?? "").get("tema");
  if (q && (MODES as string[]).includes(q)) return q as ThemeMode;
  try {
    const saved = localStorage.getItem("atlas.ui.theme");
    if (saved && (MODES as string[]).includes(saved)) return saved as ThemeMode;
  } catch {
    /* sin almacenamiento */
  }
  return "dark";
}

export default function UiGallery() {
  const [mode, setMode] = useState<ThemeMode>(initialMode);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = mode === "both" ? "dark" : mode;
    try {
      localStorage.setItem("atlas.ui.theme", mode);
    } catch {
      /* sin almacenamiento: da igual */
    }
    document.title = "Atlas · primitivas";
  }, [mode]);

  return (
    <>
      <StarField fixed />
      <header className="gallery-top">
        <div className="gallery-top-in">
          <a className="gallery-brand" href="#/ui">
            <Logo />
            <span>Atlas</span>
            <em className="mono-label">sistema visual · Observatorio</em>
          </a>
          <Segmented<ThemeMode>
            aria-label="Tema"
            size="sm"
            value={mode}
            onChange={setMode}
            options={[
              { value: "system", label: "Sistema", icon: <Monitor /> },
              { value: "dark", label: "Observatorio", icon: <Moon /> },
              { value: "light", label: "Carta impresa", icon: <Sun /> },
              { value: "both", label: "Ambos", icon: <Columns2 /> },
            ]}
          />
        </div>
      </header>

      {mode === "both" ? (
        <div className="grid grid-cols-1 xl:grid-cols-2">
          <div data-theme="dark" className="relative overflow-hidden">
            <StarField seed={11} />
            <Page>
              <Showcase compact />
            </Page>
          </div>
          <div data-theme="light" className="relative overflow-hidden">
            <StarField seed={12} />
            <Page>
              <Showcase compact />
            </Page>
          </div>
        </div>
      ) : (
        <Page as="main">
          <Showcase />
        </Page>
      )}
      <Toaster />
      <style>{galleryCss}</style>
    </>
  );
}

function Logo() {
  return (
    <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true">
      <circle cx="16" cy="16" r="11.5" fill="none" stroke="var(--gold)" strokeOpacity=".45" strokeWidth=".8" />
      <path d="M16 3.5l1.7 10.8L28.5 16l-10.8 1.7L16 28.5l-1.7-10.8L3.5 16l10.8-1.7z" fill="var(--gold-hi)" />
      <circle cx="16" cy="16" r="1.8" fill="var(--star)" />
    </svg>
  );
}

/* ───────────────────────── Escaparate ───────────────────────── */

function Showcase({ compact = false }: { compact?: boolean }) {
  const cols = compact ? "grid grid-cols-1 gap-6" : "grid grid-cols-1 gap-6 lg:grid-cols-2";
  return (
    <div className="flex flex-col gap-7">
      <Intro />
      <HeroDemo />
      <div className={cols}>
        <TokensDemo />
        <TypeDemo />
      </div>
      <div className={cols}>
        <ButtonsDemo />
        <SubjectsDemo />
      </div>
      <MeasuresDemo compact={compact} />
      <StarsDemo />
      <BadgesDemo />
      <div className={cols}>
        <ControlsDemo />
        <OverlaysDemo />
      </div>
      <div className={cols}>
        <ContentDemo />
        <EmptyDemo />
      </div>
      <div className={cols}>
        <HeatDemo />
        <FormatDemo />
      </div>
    </div>
  );
}

function Intro() {
  return (
    <section className="gallery-hello">
      <p className="mono-label">{dateLong(new Date(), { year: true })} · primitivas de src/ui</p>
      <h1>
        Un cielo que vas encendiendo.
        <em>
          Hoy puedes encender <Marker variant="glow">seis estrellas nuevas</Marker>.
        </em>
      </h1>
      <p>
        Todas las piezas de la interfaz en los dos temas: <b>Observatorio</b> (noche, por defecto) y <b>Carta impresa</b> (pergamino).
        Cambia el tema arriba; «Ambos» los pone lado a lado.
      </p>
    </section>
  );
}

function HeroDemo() {
  return (
    <InkCard aria-label="Sesión de hoy (demostración)">
      <div className="flex flex-wrap items-center gap-3">
        <span className="mono-label is-gold">✦ Sesión de hoy</span>
        <span className="gallery-pill">Preparada a las 07:00 · se adapta a tus fallos</span>
      </div>
      <div className="mt-5 flex flex-wrap items-end gap-6">
        <HeroNumber value={18} label="repasos" sub="9 se están enfriando" />
        <span className="gallery-plus hidden sm:inline" aria-hidden="true">
          +
        </span>
        <HeroNumber value={6} label="conceptos nuevos" sub="requisitos ya cumplidos" accent />
        <div className="ml-auto hidden md:block">
          <Ring value={0.64} size={112} tone="gold" label={<span className="gallery-ring-big">2 h 10</span>} aria-label="Tiempo previsto: 2 h 10 min" />
        </div>
      </div>
      <div className="gallery-meta">
        <span>
          <Clock /> <b>≈ 2 h 10 min</b> de estudio
        </span>
        <span>
          <Layers /> <b>7</b> asignaturas
        </span>
        <span className="gold-text">
          <Sparkles /> <b>+360 XP</b> estimados
        </span>
      </div>
      <div className="mt-4">
        <SegmentedBar
          format={minutesShort}
          segments={[
            { subjectId: "calculo", label: "Cálculo", value: 26 },
            { subjectId: "estructuras", label: "Estructuras", value: 26 },
            { subjectId: "operativos", label: "Métodos op.", value: 24 },
            { label: "Pausa", value: 10, pattern: "hatch" },
            { subjectId: "logica", label: "Lógica", value: 16 },
            { subjectId: "programacion", label: "Programación", value: 14 },
            { subjectId: "algebra", label: "Álgebra", value: 12 },
          ]}
        />
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button variant="primary" size="lg" icon={<Play fill="currentColor" />} kbd="Intro" aria-keyshortcuts="Enter">
          Empezar sesión
        </Button>
        <Button variant="ghost" size="lg">
          Solo repasos · 45 min
        </Button>
      </div>
      <p className="gallery-lvlup">
        <Sparkles />
        <span>
          Hacia la mitad de la sesión <b>subirás a Nivel 8</b> · te faltan 340 XP
        </span>
      </p>
    </InkCard>
  );
}

function TokensDemo() {
  const swatches: Array<[string, string]> = [
    ["--ink-0", "fondo"],
    ["--ink-1", "cielo"],
    ["--ink-2", "tarjeta"],
    ["--ink-3", "elevada"],
    ["--text", "texto"],
    ["--text-2", "texto 2"],
    ["--text-3", "texto 3"],
    ["--text-4", "decorativo"],
    ["--gold", "oro"],
    ["--gold-hi", "oro claro"],
    ["--gold-lo", "oro viejo"],
    ["--frost", "escarcha"],
    ["--ember", "ascua"],
    ["--star", "estrella"],
  ];
  return (
    <Section card number={1} eyebrow="Tokens" title="Color" description="Superficies, texto y acentos. Los colores de asignatura van en puntos, carriles, estrellas y etiquetas; nunca como fondo grande.">
      <ul className="grid grid-cols-4 gap-3 sm:grid-cols-7">
        {swatches.map(([v, name]) => (
          <li key={v} className="gallery-swatch">
            <span style={{ background: `var(${v})` }} />
            <b>{name}</b>
            <code>{v}</code>
          </li>
        ))}
      </ul>
      <ul className="mt-5 grid grid-cols-5 gap-3">
        {SUBJECT_IDS.map((id) => (
          <li key={id} className="gallery-swatch">
            <span style={{ background: `var(--s-${id})` }} />
            <SubjectTag subjectId={id} size="sm" />
          </li>
        ))}
      </ul>
    </Section>
  );
}

function TypeDemo() {
  return (
    <Section card number={2} eyebrow="Tipografía" title="Cormorant · Hanken · DM Mono">
      <div className="flex flex-col gap-4">
        <p className="gallery-type-56">Buenas tardes.</p>
        <p className="gallery-type-28">
          <em>Matrices se está apagando</em>: último repaso hace 11 días.
        </p>
        <p className="gallery-type-body">
          Hanken Grotesk para la interfaz y el texto corrido. La sesión de hoy recupera las <b>9 estrellas que se están apagando</b> y te deja lista la parte de
          Resolución para el test de Lógica del martes.
        </p>
        <p className="flex flex-wrap items-baseline gap-4">
          <span className="mono-label">Etiqueta mono · 11 px</span>
          <span className="mono num">2 h 10 min · 88 % · 1.240 XP</span>
        </p>
        <p className="gallery-scale">
          {[12, 13, 14, 16, 18, 22, 28, 40].map((s) => (
            <span key={s} style={{ fontSize: s }}>
              {s}
            </span>
          ))}
        </p>
      </div>
    </Section>
  );
}

function ButtonsDemo() {
  return (
    <Section card number={3} eyebrow="Acciones" title="Botones" action={<Button variant="quiet" iconEnd={<ChevronRight />} href="#/ui">Todos</Button>}>
      <div className="flex flex-col gap-5">
        <Row label="primary · lg / md / sm">
          <Button variant="primary" size="lg" icon={<Play fill="currentColor" />} kbd="Intro">
            Empezar sesión
          </Button>
          <Button variant="primary">Guardar</Button>
          <Button variant="primary" size="sm">
            Añadir
          </Button>
        </Row>
        <Row label="ink · ghost · quiet">
          <Button variant="ink" icon={<Plus />}>
            Registrar clase
          </Button>
          <Button variant="ghost" icon={<Search />} kbd={["Ctrl", "K"]}>
            Buscar
          </Button>
          <Button variant="quiet" iconEnd={<ChevronRight />}>
            Ver la cola completa
          </Button>
        </Row>
        <Row label="deshabilitado · enlace · bloque">
          <Button variant="primary" disabled>
            Sin repasos
          </Button>
          <Button variant="ghost" href="#/ui" icon={<Compass />}>
            Abrir el mapa
          </Button>
        </Row>
        <Button variant="ink" block icon={<BookOpen />}>
          Abrir la ficha
        </Button>
        <Row label="IconButton (tooltip con su aria-label)">
          <IconButton aria-label="Ajustes" icon={<Settings />} />
          <IconButton aria-label="Buscar" icon={<Search />} variant="ghost" />
          <IconButton aria-label="Añadir evaluación" icon={<Plus />} variant="ink" />
          <IconButton aria-label="Pequeño" icon={<Moon />} size="sm" />
          <IconButton aria-label="Grande" icon={<Telescope />} size="lg" variant="ghost" tooltipSide="bottom" />
        </Row>
      </div>
    </Section>
  );
}

function SubjectsDemo() {
  return (
    <Section card number={4} eyebrow="10 asignaturas" title="Tus constelaciones">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {SUBJECT_IDS.map((id) => (
            <SubjectTag key={id} subjectId={id} />
          ))}
        </div>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {SUBJECT_IDS.map((id) => (
            <li key={id}>
              <SubjectTag subjectId={id} variant="name" />
            </li>
          ))}
        </ul>
        <p className="flex items-center gap-3 tone-3">
          <SubjectDot subjectId="calculo" /> <SubjectDot subjectId="algebra" size={9} /> <SubjectDot color="var(--gold)" label="Oro" />
          <span className="text-[12.5px]">SubjectDot con brillo en el tema oscuro</span>
        </p>
      </div>
    </Section>
  );
}

function MeasuresDemo({ compact }: { compact: boolean }) {
  const rs: Array<number | null> = [0.97, 0.84, 0.71, 0.42, null];
  return (
    <Section card number={5} eyebrow="Dominio · frescura · progreso" title="Medidas">
      <div className={compact ? "grid grid-cols-1 gap-7" : "grid grid-cols-1 gap-8 lg:grid-cols-3"}>
        <div className="flex flex-col gap-3">
          <p className="mono-label">LevelBars</p>
          {([0, 1, 2, 3] as const).map((l) => (
            <LevelBars key={l} level={l} showLabel="name" />
          ))}
          <LevelBars level={2} cooling showLabel="fraction" />
          <LevelBars level={3} subjectId="calculo" showLabel="fraction" />
          <p className="mono-label mt-3">Freshness</p>
          {rs.map((r, i) => (
            <div key={i} className="flex items-center gap-5">
              <Freshness r={r} />
              <Freshness r={r} variant="track" />
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-4">
          <p className="mono-label">Ring · auto / asignatura</p>
          <div className="flex flex-wrap items-center gap-4">
            <Ring value={0.24} />
            <Ring value={0.58} />
            <Ring value={0.91} />
            <Ring value={0.64} subjectId="programacion" tone="subject" />
            <Ring value={0.78} size={72} />
            <Ring value={0.41} size={96} tone="gold" aria-label="Preparación prevista: 41 %" />
          </div>
          <p className="mono-label mt-3">Hitos (preparación)</p>
          {[
            { n: 5, t: "Test del tema 2", s: "logica", v: 0.58 },
            { n: 23, t: "Parcial de Cálculo", s: "calculo", v: 0.38 },
          ].map((x) => (
            <div key={x.t} className="gallery-ex">
              <b className={x.n < 7 ? "is-urgent" : undefined}>{x.n}</b>
              <div className="min-w-0">
                <p className="gallery-ex-t">{x.t}</p>
                <SubjectTag subjectId={x.s} variant="name" size="sm" />
              </div>
              <div className="w-[78px] text-right">
                <span className="mono text-[11.5px]">{pct(x.v)}</span>
                <ProgressBar value={x.v} size="xs" tone="subject" subjectId={x.s} label={`Preparación de ${x.t}`} className="mt-1.5" />
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-4">
          <p className="mono-label">Nivel y XP</p>
          <div className="flex items-center gap-4">
            <RankGlyph rank={2} state="now" size={64} title="Protoestrella" />
            <div>
              <p className="mono-label is-gold">Rango · Protoestrella</p>
              <p className="gallery-level">Nivel 7</p>
            </div>
          </div>
          <ProgressBar value={360} today={90} preview={260} max={700} size="lg" cap="8" label="XP del nivel 7" valueText="360 de 700 XP; la sesión de hoy aporta 260" />
          <p className="flex justify-between text-[12px] tone-3">
            <span>
              <b className="mono text-[12px]" style={{ color: "var(--text)" }}>
                360 / 700
              </b>{" "}
              XP en este nivel
            </span>
            <span className="gold-text">
              sesión de hoy <b className="mono">+260</b>
            </span>
          </p>
          <div className="gallery-ladder">
            {RANKS.slice(0, 6).map((r, i) => (
              <div key={r} className={i < 2 ? "is-done" : i === 2 ? "is-now" : undefined}>
                <RankGlyph rank={i} state={i < 2 ? "done" : i === 2 ? "now" : "todo"} />
                <span>{r.split(" ")[0]}</span>
              </div>
            ))}
          </div>
          <p className="mono-label mt-2">Objetivos de la semana</p>
          {[
            ["Estudiar 6 días", 3, 6],
            ["25 horas de estudio", 13.7, 25],
            ["Dominar 8 conceptos", 5, 8],
          ].map(([t, v, m]) => (
            <div key={t as string} className="gallery-goal">
              <span>{t}</span>
              <em className="num">
                <b>{String(v).replace(".", ",")}</b> / {m}
              </em>
              <ProgressBar value={v as number} max={m as number} size="sm" label={t as string} />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-8">
        <p className="mono-label mb-3">SegmentedBar · reparto de la semana</p>
        <SegmentedBar
          height={12}
          format={minutes}
          highlight="computacion"
          segments={[
            { subjectId: "programacion", label: "Programación", value: 190 },
            { subjectId: "calculo", label: "Cálculo", value: 160 },
            { subjectId: "algoritmia", label: "Algoritmia", value: 120 },
            { subjectId: "estructuras", label: "Estructuras", value: 110 },
            { subjectId: "algebra", label: "Álgebra", value: 95 },
            { subjectId: "ia", label: "IA", value: 80 },
            { subjectId: "operativos", label: "Métodos op.", value: 70 },
            { subjectId: "preprocesamiento", label: "Preprocesamiento", value: 55 },
            { subjectId: "logica", label: "Lógica", value: 50 },
            { subjectId: "computacion", label: "Teoría de la computación", value: 35 },
          ]}
        />
        <p className="gallery-note">
          <Sparkles /> <span><b>Teoría de la computación</b> solo suma 35 min esta semana. Atlas le reserva 40 min en la sesión de mañana.</span>
        </p>
      </div>
    </Section>
  );
}

const ALL_STATES: StarState[] = ["unseen", "seen", "understood", "mastered", "cooling", "today", "locked", "next"];

function StarsDemo() {
  return (
    <Section card number={6} eyebrow="Carta celeste" title="Estrellas" description="El átomo visual del mapa. Cada estado se distingue por forma, halo y anillo; no solo por color.">
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
        {ALL_STATES.map((s) => (
          <li key={s} className="gallery-star">
            <Star state={s} size={44} subjectId="calculo" tag title={STAR_STATE_LABELS[s]} />
            <span>{STAR_STATE_LABELS[s]}</span>
            <code>{s}</code>
          </li>
        ))}
      </ul>
      <MiniSky />
    </Section>
  );
}

function MiniSky() {
  return (
    <div className="gallery-sky">
      <svg viewBox="0 0 720 190" role="img" aria-label="Fragmento de carta celeste de ejemplo">
        <StarDefs id="galsky" />
        <g className="gallery-sky-lanes">
          <path d="M0 64H720M0 144H720" />
        </g>
        <g className="gallery-sky-links" fill="none">
          <path d="M90 64 190 64 300 64" />
          <path d="M300 64C360 64 380 144 440 144" />
          <path d="M120 144 250 144" />
          <path d="M440 144 560 144" strokeDasharray="3 4" />
          <path d="M300 64 420 64" className="gallery-sky-unlock" />
        </g>
        <text className="gallery-sky-lane" x="8" y="40">
          Cálculo
        </text>
        <text className="gallery-sky-lane" x="8" y="120">
          Álgebra
        </text>
        <StarMark defsId="galsky" state="mastered" x={90} y={64} />
        <StarMark defsId="galsky" state="understood" x={190} y={64} />
        <StarMark defsId="galsky" state="today" x={300} y={64} />
        <StarMark defsId="galsky" state="unseen" x={420} y={64} />
        <StarMark defsId="galsky" state="locked" x={560} y={64} />
        <StarMark defsId="galsky" state="cooling" x={120} y={144} />
        <StarMark defsId="galsky" state="seen" subjectId="algebra" x={250} y={144} />
        <StarMark defsId="galsky" state="next" subjectId="algebra" x={440} y={144} />
        <StarMark defsId="galsky" state="unseen" x={560} y={144} />
        <g className="gallery-sky-labels">
          <text x="90" y="92">Límites</text>
          <text x="190" y="92">Derivadas</text>
          <text x="300" y="104" className="is-today">Regla de la cadena</text>
          <text x="420" y="92" className="is-off">Gradiente</text>
          <text x="120" y="172" className="is-cool">Matrices</text>
          <text x="250" y="172">Determinantes</text>
          <text x="440" y="184">Autovalores</text>
        </g>
      </svg>
    </div>
  );
}

function BadgesDemo() {
  return (
    <Section
      card
      number={7}
      eyebrow="12 de 48 conseguidas"
      title="Insignias"
      description="Medallones con limbo de reloj astronómico. Doradas al conseguirlas; apagadas y con candado mientras tanto."
    >
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.1fr_1fr]">
        <div className="gallery-next">
          <Badge label="Puente" icon={<Waypoints />} progress={0.67} size={88} caption={false} />
          <div>
            <p className="mono-label is-gold">Próxima insignia · +150 XP</p>
            <p className="gallery-next-t">Puente</p>
            <p className="gallery-next-d">
              Domina un concepto que se usa en 3 asignaturas. <b>Matrices</b> está en dominio 2 de 3: un repaso correcto hoy lo completa.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Badge label="Doce noches" sublabel="12 días seguidos" meta="ayer" icon={<MoonStar />} />
          <Badge label="Primera constelación" sublabel="Tema 1 de Programación" meta="21 sep" icon={<GitBranch />} celebrate />
          <Badge label="Madrugador" sublabel="Sesión antes de las 8:00" icon={<Sunrise />} locked />
        </div>
      </div>
      <div className="mt-8 flex flex-wrap items-end gap-8">
        <Badge label="Nivel 7" sublabel="Protoestrella" icon={<Orbit />} size={120} engraving="ATLAS · NIVEL SIETE · CURSO 26/27" />
        <Badge label="Alan Turing" sublabel="Estrella guía · 8 de 14" monogram="AT" subjectId="computacion" progress={8 / 14} size={84} />
        <Badge label="Ada Lovelace" sublabel="Estrella guía" monogram="AL" subjectId="programacion" size={84} />
        <Badge label="MIT 18.06" sublabel="Misión superada · 8,4" icon={<Trophy />} subjectId="algebra" size={84} />
        <Badge label="Maratón" sublabel="150 repasos en un día" icon={<Telescope />} locked progress={0.4} size={84} />
      </div>
      <div className="mt-8">
        <p className="mono-label mb-3">RankGlyph · camino de rangos</p>
        <div className="gallery-ranks">
          {RANKS.map((r, i) => (
            <div key={r}>
              <RankGlyph rank={i} state={i < 2 ? "done" : i === 2 ? "now" : "todo"} size={34} title={r} />
              <span>{r}</span>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

function ControlsDemo() {
  const [tab, setTab] = useState<"temario" | "evaluacion" | "bases" | "despues">("temario");
  const [filter, setFilter] = useState<"todo" | "repasos" | "nuevos">("todo");
  const [lens, setLens] = useState<"dominio" | "examen" | "impacto">("dominio");
  return (
    <Section card number={8} eyebrow="Controles" title="Pestañas, filtros y ayudas">
      <div className="flex flex-col gap-6">
        <div>
          <Tabs
            id="gal-tabs"
            aria-label="Secciones de la asignatura"
            value={tab}
            onChange={setTab}
            items={[
              { id: "temario", label: "Temario", count: 72 },
              { id: "evaluacion", label: "Evaluación" },
              { id: "bases", label: "Bases", count: 9 },
              { id: "despues", label: "Para qué te servirá" },
            ]}
          />
          <TabPanel tabs="gal-tabs" tab={tab} className="pt-4 text-[13.5px] tone-2">
            Panel «{tab}». Flechas ← → para cambiar de pestaña.
          </TabPanel>
        </div>
        <Row label="Segmented · pill">
          <Segmented
            aria-label="Filtrar la cola"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "todo", label: "Todo", count: 24 },
              { value: "repasos", label: "Repasos", count: 18 },
              { value: "nuevos", label: "Nuevos", count: 6 },
            ]}
          />
        </Row>
        <Row label="Segmented · chips">
          <Segmented
            aria-label="Lente del mapa"
            variant="chips"
            value={lens}
            onChange={setLens}
            options={[
              { value: "dominio", label: "Dominio" },
              { value: "examen", label: "Examen", icon: <CalendarDays /> },
              { value: "impacto", label: "Impacto" },
            ]}
          />
        </Row>
        <Row label="Kbd · Tooltip">
          <Kbd keys={["Ctrl", "K"]} />
          <Kbd>Esc</Kbd>
          <Tooltip content="Se calcula con FSRS: la probabilidad de que lo recuerdes hoy.">
            <Button variant="ghost" size="sm">
              ¿Qué es la frescura?
            </Button>
          </Tooltip>
        </Row>
        <p className="gallery-marker">
          Hoy toca afianzar <Marker subjectId="calculo">Cálculo</Marker>: el parcial está a 23 días. Un <Marker animate>subrayado dorado</Marker> suave, con moderación.
        </p>
      </div>
    </Section>
  );
}

function OverlaysDemo() {
  const [dialog, setDialog] = useState(false);
  const [panel, setPanel] = useState(false);
  return (
    <Section card number={9} eyebrow="Superposiciones" title="Diálogo, panel y avisos">
      <div className="flex flex-col gap-4">
        <Row label="Dialog · SidePanel">
          <Button variant="ink" onClick={() => setDialog(true)}>
            Hoy en clase he visto…
          </Button>
          <Button variant="ghost" icon={<BookOpen />} onClick={() => setPanel(true)}>
            Abrir ficha
          </Button>
        </Row>
        <Row label="toast()">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toast("Registrado: Límites y Continuidad", { action: { label: "Deshacer", onClick: () => toast("Deshecho", { tone: "frost" }) }, icon: <Undo2 /> })}
          >
            Con deshacer
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              toast("Nueva insignia: Doce noches", {
                tone: "gold",
                description: "12 días seguidos · +200 XP",
                icon: <Badge label="Doce noches" icon={<MoonStar />} size={34} caption={false} />,
              })
            }
          >
            Insignia
          </Button>
          <Button variant="ghost" size="sm" onClick={() => toast("Sin conexión: se guarda en este navegador", { tone: "ember" })}>
            Aviso
          </Button>
        </Row>
        <p className="text-[13px] tone-3">Esc cierra el diálogo y el panel; en móvil el panel es una hoja inferior que se cierra arrastrando el asa.</p>
      </div>

      <Dialog
        open={dialog}
        onClose={() => setDialog(false)}
        eyebrow="Registro rápido"
        title="Hoy en clase he visto…"
        description="Marca los conceptos que viste en clase; entrarán en la cola de mañana como primer recuerdo."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setDialog(false);
                toast("Registrados 2 conceptos", { tone: "gold" });
              }}
            >
              Registrar 2
            </Button>
          </>
        }
      >
        <ul className="flex flex-col gap-2">
          {["Límites", "Continuidad", "Derivadas"].map((c, i) => (
            <li key={c} className="gallery-check">
              <input type="checkbox" id={`gal-c${i}`} defaultChecked={i < 2} />
              <label htmlFor={`gal-c${i}`}>{c}</label>
              <SubjectTag subjectId="calculo" size="sm" />
            </li>
          ))}
        </ul>
      </Dialog>

      <SidePanel
        open={panel}
        onClose={() => setPanel(false)}
        eyebrow={
          <>
            <SubjectTag subjectId="algebra" size="sm" /> Tema 2 · Matrices
          </>
        }
        title="Matrices"
        actions={<IconButton aria-label="Ver en el mapa" icon={<Compass />} tooltipSide="bottom" />}
        footer={
          <>
            <Button variant="primary" icon={<Play fill="currentColor" />}>
              Practicar ahora
            </Button>
            <Button variant="ghost">Ya lo domino</Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-4">
            <LevelBars level={2} cooling showLabel="name" />
            <Freshness r={0.48} />
            <span className="text-[12.5px] tone-3">Próximo repaso: hoy</span>
          </div>
          <Md>{"Tabla rectangular de números con la que se representan **aplicaciones lineales** y sistemas: $A \\in \\mathbb{R}^{m\\times n}$."}</Md>
          <Card tone="glow" pad="sm">
            <p className="mono-label is-gold">Lo necesitarás en</p>
            <p className="mt-2 text-[14px]">
              <b>Preprocesamiento</b> (vía PCA) · <b>Métodos operativos</b> (vía Matriz de covarianza)
            </p>
          </Card>
          <p className="text-[13px] tone-3">Contenido largo para probar el desplazamiento del panel.</p>
          {Array.from({ length: 8 }, (_, i) => (
            <p key={i} className="text-[14px] tone-2">
              Línea de relleno {i + 1}: el cuerpo se desplaza y la cabecera y el pie quedan fijos.
            </p>
          ))}
        </div>
      </SidePanel>
    </Section>
  );
}

const SAMPLE_MD = `La **regla de la cadena** deriva una composición: si $h(x) = f(g(x))$, entonces

$$h'(x) = f'(g(x))\\,g'(x)$$

- Identifica la función *exterior* y la *interior*.
- Deriva cada una por separado y multiplica.
1. Primero \`g\`
2. Después \`f\`

\`\`\`python
def derivada(f, x, h=1e-6):
    return (f(x + h) - f(x - h)) / (2 * h)  # diferencia centrada
\`\`\`

> Un precio de 5 $ y otro de 10 $ no son fórmulas. [Documentación](https://katex.org)`;

function ContentDemo() {
  return (
    <Section card number={10} eyebrow="Fichas" title="Markdown ligero y fórmulas">
      <Md>{SAMPLE_MD}</Md>
      <div className="mt-5">
        <p className="mono-label mb-2">TeX (bloque)</p>
        <TeX math={"\\operatorname{Var}(X) = \\mathbb{E}\\left[(X-\\mu)^2\\right] = \\frac{1}{n}\\sum_{i=1}^{n}(x_i-\\bar x)^2"} />
      </div>
    </Section>
  );
}

function EmptyDemo() {
  return (
    <Section card number={11} eyebrow="Estados vacíos" title="Aún no hay nada aquí">
      <div className="flex flex-col gap-4">
        <EmptyState
          title="Tu cielo está por estrenar"
          description="Registra lo que viste en clase o empieza con el tema 1 de cada asignatura: las primeras estrellas se encienden hoy."
          action={
            <>
              <Button variant="primary" icon={<Play fill="currentColor" />}>
                Empezar
              </Button>
              <Button variant="ghost">Registrar clase</Button>
            </>
          }
        />
        <EmptyState size="sm" tone="dashed" title="Sin fechas a la vista" description="Añade tus exámenes y entregas para ver la cuenta atrás." action={<Button variant="quiet" iconEnd={<ChevronRight />}>Añadir evaluación</Button>} />
      </div>
    </Section>
  );
}

function HeatDemo() {
  const today = useMemo(() => new Date(), []);
  const { values, wild } = useMemo(() => {
    const rnd = seededRandom(9241);
    const v: Record<string, number> = {};
    const w: string[] = [];
    for (let i = 1; i < 140; i++) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      const key = dayKeyOf(d);
      const recent = i < 30;
      const r = rnd();
      if (i === 5) {
        w.push(key);
        continue;
      }
      if (r < (recent ? 0.85 : 0.55)) v[key] = Math.round((recent ? 150 + rnd() * 170 : 30 + rnd() * 200) / 5) * 5;
    }
    return { values: v, wild: w };
  }, [today]);
  return (
    <Section card number={12} eyebrow="Últimas 20 semanas" title="Actividad" action={<span className="text-[12.5px] tone-3">cuanto más brilla, más estudiaste</span>}>
      <Heatmap values={values} wildcards={wild} today={today} />
    </Section>
  );
}

function FormatDemo() {
  const rows: Array<[string, string]> = [
    ['plural(1, "concepto", "conceptos")', plural(1, "concepto", "conceptos")],
    ['plural(24, "concepto", "conceptos")', plural(24, "concepto", "conceptos")],
    ["pct(0.876)", pct(0.876)],
    ["minutes(130)", minutes(130)],
    ["minutes(45)", minutes(45)],
    ["minutesShort(26)", minutesShort(26)],
    ["relDays(0) · (1) · (5) · (−3)", [relDays(0), relDays(1), relDays(5), relDays(-3)].join(" · ")],
    ["weekday(hoy)", weekday(new Date())],
    ['dateShort("2026-10-03")', dateShort("2026-10-03")],
    ["dateLong(hoy)", dateLong(new Date())],
    ["signed(3) · signed(−2)", `${signed(3)} · ${signed(-2)}`],
  ];
  return (
    <Section card number={13} eyebrow="src/ui/format.ts" title="Formatos">
      <table className="gallery-table">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <td>
                <code>{k}</code>
              </td>
              <td>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="mono-label">{label}</span>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

/* Estilos propios de la galería (no forman parte del sistema). */
const galleryCss = `
.gallery-top{position:sticky;top:0;z-index:30;background:color-mix(in oklab,var(--ink-1) 72%,transparent);backdrop-filter:blur(16px) saturate(140%);border-bottom:1px solid var(--line)}
.gallery-top-in{max-width:1440px;margin:0 auto;padding:0 40px;min-height:64px;display:flex;align-items:center;gap:20px;flex-wrap:wrap}
.gallery-brand{display:flex;align-items:center;gap:10px;font-family:var(--serif);font-size:27px;font-weight:600;color:var(--text);margin-right:auto}
.gallery-brand em{font-style:normal;margin-left:6px}
@media (max-width:767px){.gallery-top-in{padding:10px 16px;gap:10px}.gallery-brand em{display:none}}
.gallery-hello h1{font-size:52px;font-weight:500;line-height:1;margin-top:14px}
.gallery-hello h1 em{display:block;font-style:italic;font-weight:500;color:var(--text-2)}
.gallery-hello p:last-child{margin-top:14px;max-width:640px;color:var(--text-2);font-size:15px}
.gallery-hello b{color:var(--text)}
@media (max-width:767px){.gallery-hello h1{font-size:38px}}
.gallery-pill{font-family:var(--mono);font-size:10.5px;letter-spacing:.06em;color:var(--text-2);padding:3px 9px;border-radius:999px;border:1px solid var(--line-2);background:var(--hover)}
.gallery-plus{font-family:var(--serif);font-size:44px;color:var(--text-4);line-height:1;padding-bottom:40px}
.gallery-ring-big{font-family:var(--serif);font-weight:600;font-size:24px;color:var(--text)}
.gallery-meta{display:flex;flex-wrap:wrap;gap:8px 18px;margin-top:22px;color:var(--text-2);font-size:13.5px}
.gallery-meta span{display:inline-flex;align-items:center;gap:7px}
.gallery-meta svg{width:15px;height:15px}
.gallery-meta b{color:var(--text);font-weight:600}
.gallery-meta .gold-text b{color:var(--gold-fg)}
.gallery-lvlup{display:flex;align-items:center;gap:9px;margin-top:18px;font-size:13px;color:var(--text-2)}
.gallery-lvlup svg{width:14px;height:14px;color:var(--gold)}
.gallery-lvlup b{color:var(--gold-fg)}
.gallery-swatch{display:flex;flex-direction:column;gap:4px;min-width:0}
.gallery-swatch>span{height:34px;border-radius:8px;box-shadow:inset 0 0 0 1px var(--line-2)}
.gallery-swatch b{font-size:12px;font-weight:600}
.gallery-swatch code{font-family:var(--mono);font-size:10px;color:var(--text-3);overflow:hidden;text-overflow:ellipsis}
.gallery-type-56{font-family:var(--serif);font-size:56px;font-weight:500;line-height:1}
.gallery-type-28{font-family:var(--serif);font-size:28px;font-weight:500;line-height:1.15;color:var(--text-2)}
.gallery-type-28 em{color:var(--frost-fg)}
.gallery-type-body{font-size:16px;color:var(--text-2);max-width:60ch}
.gallery-type-body b{color:var(--text)}
.gallery-scale{display:flex;flex-wrap:wrap;align-items:baseline;gap:14px;color:var(--text-3);font-family:var(--serif)}
@media (max-width:767px){.gallery-type-56{font-size:40px}}
.gallery-ex{display:grid;grid-template-columns:44px minmax(0,1fr) 78px;gap:12px;align-items:center;padding:10px 0;border-top:1px solid var(--line)}
.gallery-ex>b{font-family:var(--serif);font-size:32px;font-weight:600;line-height:.9;text-align:center}
.gallery-ex>b.is-urgent{color:var(--ember-fg)}
.gallery-ex-t{font-size:14px;font-weight:600;margin-bottom:3px}
.gallery-level{font-family:var(--serif);font-size:40px;font-weight:600;line-height:.95;margin-top:4px}
.gallery-ladder{position:relative;display:grid;grid-template-columns:repeat(6,1fr);margin-top:6px}
.gallery-ladder>div{display:flex;flex-direction:column;align-items:center;gap:6px;font-size:11px;color:var(--text-3)}
.gallery-ladder>div.is-now{color:var(--gold-fg);font-weight:600}
.gallery-goal{display:grid;grid-template-columns:1fr auto;gap:6px 12px;font-size:13px;color:var(--text-2)}
.gallery-goal em{font-style:normal;font-family:var(--mono);font-size:11.5px;color:var(--text-3)}
.gallery-goal em b{color:var(--text);font-weight:500}
.gallery-goal .ui-bar{grid-column:1/-1}
.gallery-note{display:flex;align-items:center;gap:10px;margin-top:14px;font-size:12.5px;color:var(--text-2)}
.gallery-note svg{width:15px;height:15px;color:var(--gold);flex:none}
.gallery-note b{color:var(--s-computacion-fg)}
.gallery-star{display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;padding:10px 4px;border-radius:14px}
.gallery-star:hover{background:var(--hover)}
.gallery-star span{font-size:12px;color:var(--text-2)}
.gallery-star code{font-family:var(--mono);font-size:10px;color:var(--text-3)}
.gallery-sky{margin-top:22px;padding-top:16px;border-top:1px solid var(--line);overflow-x:auto}
.gallery-sky svg{display:block;width:100%;max-width:780px;min-width:560px;height:auto;overflow:visible}
.gallery-sky-lanes path{stroke:var(--line);stroke-width:1}
.gallery-sky-links path{stroke:var(--line-2);stroke-width:1.1}
.gallery-sky-links .gallery-sky-unlock{stroke:var(--gold);stroke-width:1.6;stroke-dasharray:2 5;stroke-linecap:round;animation:gal-flow 1.8s linear infinite}
@keyframes gal-flow{to{stroke-dashoffset:-14}}
.gallery-sky-lane{font-family:var(--serif);font-weight:600;font-size:17px;fill:var(--text)}
.gallery-sky-labels text{font-family:var(--sans);font-size:11.5px;fill:var(--text-2);text-anchor:middle}
.gallery-sky-labels .is-today{fill:var(--gold-fg);font-weight:600}
.gallery-sky-labels .is-off{fill:var(--text-3)}
.gallery-sky-labels .is-cool{fill:var(--frost-fg)}
.gallery-next{display:grid;grid-template-columns:88px 1fr;gap:18px;align-items:center;padding:18px;border-radius:16px;background:radial-gradient(260px 140px at 0% 50%,var(--gold-soft),transparent 70%),var(--well);box-shadow:inset 0 0 0 1px var(--gold-line)}
.gallery-next-t{font-family:var(--serif);font-size:26px;font-weight:600;line-height:1;margin-top:4px}
.gallery-next-d{font-size:12.8px;color:var(--text-2);margin-top:6px;line-height:1.4}
.gallery-next-d b{color:var(--text)}
.gallery-ranks{display:grid;grid-template-columns:repeat(10,minmax(0,1fr));gap:6px}
.gallery-ranks>div{display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;font-size:11px;color:var(--text-3);line-height:1.15}
@media (max-width:767px){.gallery-ranks{grid-template-columns:repeat(5,minmax(0,1fr));row-gap:14px}}
.gallery-marker{font-family:var(--serif);font-style:italic;font-size:20px;line-height:1.45;color:var(--text-2)}
.gallery-check{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;background:var(--hover);box-shadow:inset 0 0 0 1px var(--line)}
.gallery-check label{flex:1;font-size:14px}
.gallery-check input{accent-color:var(--gold);width:16px;height:16px}
.gallery-table{width:100%;border-collapse:collapse;font-size:13.5px}
.gallery-table td{padding:8px 0;border-top:1px solid var(--line);vertical-align:top}
.gallery-table td:first-child{padding-right:16px;width:55%}
.gallery-table code{font-family:var(--mono);font-size:11.5px;color:var(--text-3);word-break:break-word}
`;
