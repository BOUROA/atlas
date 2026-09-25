// Icono lucide de cada insignia (Achievement.icon, en kebab-case) sin cargar
// toda la librería. Lo usan Celebrations y la pantalla Progreso.
import {
  Award, CalendarCheck, CalendarRange, CircleCheck, ClipboardCheck, Compass, Crown, Flame, Footprints, Galaxy, Gauge, Gem, Globe,
  GraduationCap, Infinity as InfinityIcon, Layers, Link, ListChecks, Moon, MoonStar, Mountain, Network, Orbit, Play,
  Repeat, Repeat2, Rocket, Shield, ShieldCheck, Sparkle, Sparkles, Star, StarHalf, Sun, Sunrise, Target, Telescope,
  Trophy, Zap, type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  award: Award,
  "calendar-check": CalendarCheck,
  "calendar-range": CalendarRange,
  "circle-check": CircleCheck,
  "clipboard-check": ClipboardCheck,
  compass: Compass,
  crown: Crown,
  flame: Flame,
  footprints: Footprints,
  galaxy: Galaxy,
  gauge: Gauge,
  gem: Gem,
  globe: Globe,
  "graduation-cap": GraduationCap,
  infinity: InfinityIcon,
  layers: Layers,
  link: Link,
  "list-checks": ListChecks,
  moon: Moon,
  "moon-star": MoonStar,
  mountain: Mountain,
  network: Network,
  orbit: Orbit,
  play: Play,
  repeat: Repeat,
  "repeat-2": Repeat2,
  rocket: Rocket,
  shield: Shield,
  "shield-check": ShieldCheck,
  sparkle: Sparkle,
  sparkles: Sparkles,
  stars: Sparkles,
  star: Star,
  "star-half": StarHalf,
  sun: Sun,
  sunrise: Sunrise,
  target: Target,
  telescope: Telescope,
  trophy: Trophy,
  zap: Zap,
};

/** Componente de icono para el nombre de icono de una insignia (Award si no se conoce). */
export const achievementIcon = (name: string): LucideIcon => ICONS[name] ?? Award;
