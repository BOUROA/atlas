import { useDeferredValue, useMemo } from "react";
import { getQueue, useDerived } from "../../state/derived";
import { href, navigate, useRoute, type RouteName } from "../../state/router";
import { useUserState } from "../../state/store";
import { openSearch } from "../../state/ui";
import { Icons, ICON_SIZE, IconButton, Kbd, Ring, cx, num, pct, type IconName } from "../../ui";
import { Logo } from "./Logo";
import { AccountMenu } from "./AccountMenu";
import { SaveIndicator } from "./SaveIndicator";
import { ThemeToggle } from "./ThemeToggle";

type NavItem = { path: string; label: string; icon: IconName; match: RouteName[] };

export const NAV_ITEMS: readonly NavItem[] = [
  { path: "/hoy", label: "Hoy", icon: "today", match: ["hoy"] },
  { path: "/asignaturas", label: "Asignaturas", icon: "subject", match: ["asignaturas", "asignatura"] },
  { path: "/mapa", label: "Mapa", icon: "map", match: ["mapa"] },
  { path: "/misiones", label: "Misiones", icon: "mission", match: ["misiones", "mision", "guia", "prueba"] },
  { path: "/progreso", label: "Progreso", icon: "progress", match: ["progreso"] },
];

/** Nº de elementos del plan de hoy, calculado en diferido (no bloquea al registrar). */
function useTodayCount(): number {
  const state = useUserState((s) => s);
  const derived = useDerived();
  const snapshot = useMemo(() => ({ state, derived }), [state, derived]);
  const deferred = useDeferredValue(snapshot);
  return useMemo(() => getQueue({}, deferred.state, deferred.derived).planned.length, [deferred]);
}

/** Cabecera fija: marca, secciones, buscador, racha, nivel, guardado, tema y ajustes. */
export function TopNav() {
  const route = useRoute();
  const { level, rank, streak } = useDerived();
  const count = useTodayCount();
  const levelRatio = level.needed > 0 ? level.into / level.needed : 0;

  return (
    <header className="shell-top">
      <a className="shell-skip" href="#contenido" onClick={(e) => { e.preventDefault(); document.getElementById("contenido")?.focus(); }}>
        Saltar al contenido
      </a>
      <div className="shell-top-in">
        <a className="shell-brand" href={href("/hoy")} aria-label="FlipyERP Academy, ir a Hoy">
          <Logo />
          <span>Academy</span>
        </a>

        <nav className="shell-nav" aria-label="Secciones">
          {NAV_ITEMS.map((item) => {
            const active = item.match.includes(route.name);
            const Icon = Icons[item.icon];
            return (
              <a key={item.path} href={href(item.path)} className={cx("shell-nav-link", active && "is-active")} aria-current={active ? "page" : undefined}>
                <Icon aria-hidden="true" size={ICON_SIZE.button.size} strokeWidth={ICON_SIZE.button.strokeWidth} />
                {item.label}
                {item.path === "/hoy" && count > 0 && (
                  <span className="shell-count num" aria-label={`${count} en el plan de hoy`}>
                    {count}
                  </span>
                )}
              </a>
            );
          })}
        </nav>

        <button type="button" className="shell-search" onClick={openSearch} aria-keyshortcuts="Control+K /">
          <Icons.search aria-hidden="true" />
          <span className="shell-search-text">Buscar conceptos, asignaturas o misiones…</span>
          <Kbd keys={["Ctrl", "K"]} className="shell-search-kbd" />
        </button>

        <div className="shell-right">
          <SaveIndicator compact />
          <span className="shell-chip" title={`Racha: ${streak.current} ${streak.current === 1 ? "día" : "días"}${streak.activeToday ? "" : " · hoy pendiente"}`}>
            <Icons.streak className={cx("shell-chip-flame", streak.activeToday && "is-lit")} aria-hidden="true" />
            <span>
              <b className="num">{num(streak.current)}</b>
              <span className="shell-chip-unit"> {streak.current === 1 ? "día" : "días"}</span>
            </span>
          </span>
          <a className="shell-chip shell-chip--level" href={href("/progreso")} title={`Nivel ${level.level} · ${rank} · ${pct(levelRatio)} hacia el nivel ${level.level + 1}`}>
            <Ring value={levelRatio} size={24} thickness={2.4} tone="gold" label={<span className="shell-level-n num">{level.level}</span>} animate={false} aria-label={`Nivel ${level.level}`} />
            <b className="shell-chip-rank">{rank}</b>
          </a>
          <ThemeToggle />
          <IconButton aria-label="Ajustes" icon={<Icons.settings />} tooltipSide="bottom" tooltipAlign="end" onClick={() => navigate("/ajustes")} className="shell-settings" />
          <AccountMenu />
          <IconButton aria-label="Buscar (Ctrl K)" icon={<Icons.search />} tooltipSide="bottom" tooltipAlign="end" onClick={openSearch} className="shell-search-icon" />
        </div>
      </div>
    </header>
  );
}

/** Barra inferior de secciones en móvil (< 768 px). */
export function BottomNav() {
  const route = useRoute();
  return (
    <nav className="shell-bottom" aria-label="Secciones">
      {NAV_ITEMS.map((item) => {
        const active = item.match.includes(route.name);
        const Icon = Icons[item.icon];
        return (
          <a key={item.path} href={href(item.path)} className={cx("shell-bottom-link", active && "is-active")} aria-current={active ? "page" : undefined}>
            <Icon aria-hidden="true" />
            <span>{item.label}</span>
          </a>
        );
      })}
    </nav>
  );
}
