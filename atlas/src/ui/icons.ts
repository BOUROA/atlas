// Vocabulario de iconos (docs/diseno-visual.md › Densidad e iconografía):
// un concepto, un icono, en toda la app. Importa desde aquí en lugar de elegir
// un icono de lucide a mano, para que cada icono conserve un solo significado.
import {
  Award, BookOpen, BookOpenCheck, BookText, Bookmark, Calendar, CalendarDays, CalendarPlus, Check, ChevronDown, ChevronRight,
  CircleAlert, CircleDashed, CirclePlay, CircleSlash, ClipboardCheck, ClipboardList, Clock, Compass, Contrast,
  ExternalLink, Eye, FileCheck, Flag, Flame, Gauge, Gift, GraduationCap, Hourglass, Info, Layers, Lightbulb, ListChecks,
  Lock, LockOpen, MapPin, Medal, Mountain, Route, Target, CalendarCheck, CalendarClock, Milestone, Moon, NotebookPen, Orbit, PenLine, Play, RefreshCcw, RefreshCcwDot, Rocket, RotateCcw,
  Scroll, Search, Settings, Snowflake, Sparkles, SquareCheck, Star, Sunrise, Telescope, Timer, TrendingDown, TrendingUp,
  Trophy, WandSparkles, Waypoints, type LucideIcon,
} from "lucide-react";

export const Icons = {
  // Estudio
  session: Play,
  review: RefreshCcw,
  firstRecall: RefreshCcwDot,
  newConcept: BookOpen,
  seen: BookOpenCheck,
  exercises: ListChecks,
  logStudy: PenLine,
  logClass: NotebookPen,
  view: Eye,
  // Gamificación
  streak: Flame,
  comodin: Moon,
  xp: Sparkles,
  badge: Award,
  chest: Gift,
  // Estructura
  subject: Layers,
  unit: Bookmark,
  notes: BookText,
  // Rumbo y misiones
  rumbo: Compass,
  control: ClipboardCheck,
  simulacro: Hourglass,
  trials: ClipboardList,
  exam: GraduationCap,
  mission: Rocket,
  guide: Telescope,
  // Estados
  late: CircleAlert,
  next: Flag,
  ready: CirclePlay,
  done: Check,
  skipped: CircleSlash,
  recommended: Lightbulb,
  provisional: CircleDashed,
  inProgress: Timer,
  // Motivos de la cola
  examSoon: Calendar,
  cooling: Snowflake,
  unlocks: LockOpen,
  dependencies: Waypoints,
  // Datos
  date: Calendar,
  duration: Clock,
  readiness: Gauge,
  grade: FileCheck,
  gradeStar: Star,
  paceUp: TrendingUp,
  paceDown: TrendingDown,
  // Navegación y sistema
  today: Sunrise,
  map: Orbit,
  calendar: CalendarDays,
  addAssessment: CalendarPlus,
  useTemplate: WandSparkles,
  progress: Trophy,
  settings: Settings,
  theme: Contrast,
  search: Search,
  help: Info,
  open: ChevronRight,
  more: ChevronDown,
  retry: RotateCcw,
  submit: SquareCheck,
  external: ExternalLink,
  // Misión del día y Camino
  reinforce: Target,
  dayComplete: CalendarCheck,
  tomorrow: CalendarClock,
  camino: Route,
  youAreHere: MapPin,
  locked: Lock,
  summit: Mountain,
  // Sellos de las biografías de las estrellas guía
  milestone: Milestone,
  medal: Medal,
  diploma: Scroll,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof Icons;

/** Escala de iconos: tamaño en px y trazo (regla 10). */
export const ICON_SIZE = {
  /** Dentro de etiquetas mono. */
  label: { size: 12, strokeWidth: 2 },
  /** Fichas, filas y enlaces. */
  row: { size: 14, strokeWidth: 1.75 },
  /** Botones y navegación. */
  button: { size: 16, strokeWidth: 1.75 },
  /** Cabeceras de tarjeta, estados vacíos, botón grande. */
  header: { size: 20, strokeWidth: 1.5 },
  /** Medallones. */
  medallion: { size: 24, strokeWidth: 1.5 },
} as const;
