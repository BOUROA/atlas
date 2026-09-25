/**
 * Carta celeste (#/mapa).
 *
 * export function MapScreen(): JSX.Element — sin props.
 * Consulta (useRoute().query): lente ("dominio" | "examen" | "impacto" | "guia"),
 * eval (id de evaluación para la lente examen), foco (concepto a centrar y
 * seleccionar), guia (id de estrella guía). Selección → openConcept(id).
 *
 * Rendimiento (870 estrellas, ~1 800 líneas): ninguna capa de React se vuelve
 * a pintar al mover. Durante un gesto el compositor mueve y escala la capa ya
 * pintada (view.ts) y el cielo se consolida al terminar; las escalas del zoom
 * son reglas CSS compartidas, las estrellas son memo por concepto, las aristas
 * van agrupadas en pocos <path>, la selección se dibuja en una capa aparte
 * sobre un velo y las etiquetas se colocan sin solapes al acabar cada gesto
 * (labels.ts), escribiendo atributos en el DOM.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import { Crosshair, Minus, Plus, X } from "lucide-react";
import "./map.css";
import { catalog, guideById, guides, isLegend } from "../../state/catalog";
import { useDerived, useQueue } from "../../state/derived";
import { href, openConcept, setQuery, useRoute } from "../../state/router";
import { useUserState } from "../../state/store";
import { dependentsDeep, prerequisitesDeep } from "../../domain/graph";
import { neededEarly } from "../../domain/tutor/advance";
import { assessmentConcepts, examReadiness } from "../../domain/tutor/forecast";
import { progressOf } from "../../domain/tutor/mastery";
import { legendProgress, profileProgress } from "../../domain/legends";
import { searchConcepts } from "../../domain/search";
import { dayKey, daysBetween } from "../../domain/time";
import { subjectStateOf, type Assessment, type Legend, type Profile } from "../../domain/types";
import {
  cx,
  dateShort,
  Icons,
  IconButton,
  num,
  pct,
  plural,
  pluralWord,
  ProgressBar,
  relDays,
  Segmented,
  Star,
  STAR_STATE_LABELS,
  StarDefs,
  StarField,
  subjectFg,
  type StarState,
} from "../../ui";
import { skyModel, type WNode } from "./model";
import { computeSkyState, transitionOf, type SkyState } from "./states";
import { glyphScale, lodOf, SkyView, type Rect } from "./view";
import { applyLabels, placeLabels, type LabelCand, type LabelSlot, type Placed } from "./labels";
import {
  buildEdgeGroups,
  DEFS_ID,
  EdgeLayer,
  ExternalMarks,
  FarLayer,
  GridLayer,
  GuideLayer,
  HighlightLayer,
  HoverEdges,
  LabelLayer,
  NodeLayer,
  NoticeMarks,
  PATH_DEPTH,
  unitRadius,
  type Selection,
} from "./layers";
import { HoverTip, LaneLabels, Notices, Ruler, type LaneBadge, type Notice } from "./overlays";
import { setHover } from "./hover";

export { MiniSky } from "./MiniSky";

type Lens = "dominio" | "examen" | "impacto" | "guia";
const LENSES: Lens[] = ["dominio", "examen", "impacto", "guia"];
const parseLens = (v: string | null): Lens => (LENSES.includes(v as Lens) ? (v as Lens) : "dominio");

const FOCUS_K = 0.85;
const NO_NOTICES: Notice[] = [];

function useIsCompact() {
  const q = "(max-width: 767px)";
  const [m, setM] = useState(() => typeof matchMedia === "function" && matchMedia(q).matches);
  useEffect(() => {
    const mq = matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return m;
}

type DatedAssessment = { a: Assessment; subjectId: string; days: number };

const guideRoute = (g: Legend | Profile) => (isLegend(g) ? g.route : g.territory);

export function MapScreen() {
  const route = useRoute();
  const lens = parseLens(route.query.get("lente"));
  const foco = route.query.get("foco");
  const evalId = route.query.get("eval");
  const guiaId = route.query.get("guia");
  const panelOpen = !!route.query.get("c");
  const compact = useIsCompact();

  const derived = useDerived();
  const user = useUserState((s) => s);
  const queue = useQueue();
  const model = useMemo(skyModel, []);
  const sky = useMemo(() => computeSkyState(model, derived.progress, queue, user), [model, derived.progress, queue, user]);

  /* ───────── Lentes ───────── */

  const sizes = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of model.nodes) {
      const s = Math.sqrt(n.deps / model.maxDeps);
      m.set(n.id, lens === "impacto" ? 0.55 + 1.85 * s : 0.82 + 0.4 * s);
    }
    return m;
  }, [model, lens]);

  const dated = useMemo<DatedAssessment[]>(() => {
    const today = dayKey(derived.now);
    const out: DatedAssessment[] = [];
    for (const s of catalog.subjects) {
      for (const a of subjectStateOf(user, s.id).assessments) {
        if (!a.date) continue;
        out.push({ a, subjectId: s.id, days: daysBetween(today, dayKey(a.date)) });
      }
    }
    return out.sort((x, y) => (x.a.date! < y.a.date! ? -1 : x.a.date! > y.a.date! ? 1 : 0));
  }, [user, derived.now]);

  const exam = useMemo(() => {
    if (lens !== "examen") return null;
    const chosen =
      dated.find((d) => d.a.id === evalId) ??
      dated.find((d) => d.days >= 0 && d.a.grade === undefined && d.a.unitIds.length > 0) ??
      dated.find((d) => d.days >= 0) ??
      dated[dated.length - 1];
    if (!chosen) return { chosen: null, scope: new Set<string>(), external: [] as string[], readiness: null };
    const ids = assessmentConcepts(catalog, chosen.a);
    const units = new Set(chosen.a.unitIds);
    const external = ids.filter((id) => !units.has(catalog.conceptById.get(id)?.unitId ?? ""));
    const readiness = ids.length ? examReadiness({ index: catalog, progress: derived.progress, scheduler: derived.scheduler, assessment: chosen.a }) : null;
    return { chosen, scope: new Set(ids), external, readiness };
  }, [lens, dated, evalId, derived.progress, derived.scheduler]);

  const guide = useMemo(() => {
    if (lens !== "guia") return null;
    let g = guiaId ? guideById.get(guiaId) : undefined;
    if (!g) {
      let best = -1;
      for (const cand of guides) {
        const r = guideRoute(cand);
        if (r.length === 0) continue;
        const p = isLegend(cand) ? legendProgress(cand, derived.progress) : profileProgress(cand, derived.progress);
        if (p.ratio > best) {
          best = p.ratio;
          g = cand;
        }
      }
    }
    if (!g) return null;
    const ids = guideRoute(g).filter((id) => model.byId.has(id));
    const prog = isLegend(g) ? legendProgress(g, derived.progress) : profileProgress(g, derived.progress);
    return { g, ids, prog };
  }, [lens, guiaId, derived.progress, model]);

  const visibleNodes = useMemo(() => (exam ? model.nodes.filter((n) => exam.scope.has(n.id)) : model.nodes), [model, exam]);
  const edgeGroups = useMemo(() => buildEdgeGroups(model, sky.vis, exam ? exam.scope : undefined, !!exam), [model, sky.vis, exam]);

  /* ───────── Selección ───────── */

  const selection = useMemo<Selection | null>(() => {
    if (!foco || !model.byId.has(foco)) return null;
    return {
      id: foco,
      pre: new Map(prerequisitesDeep(catalog, foco).map((r) => [r.id, r.depth])),
      dep: new Map(dependentsDeep(catalog, foco).map((r) => [r.id, r.depth])),
    };
  }, [foco, model]);

  const laneBadges = useMemo(() => {
    if (!selection) return null;
    const m = new Map<string, LaneBadge>();
    const bump = (id: string, key: keyof LaneBadge) => {
      const s = model.byId.get(id)!.subjectId;
      const b = m.get(s) ?? { dep: 0, pre: 0 };
      b[key]++;
      m.set(s, b);
    };
    for (const id of selection.pre.keys()) bump(id, "pre");
    for (const id of selection.dep.keys()) bump(id, "dep");
    const own = model.byId.get(selection.id)!.subjectId;
    if (!m.has(own)) m.set(own, { dep: 0, pre: 0 });
    return m;
  }, [selection, model]);

  const dimmedLanes = useMemo(() => {
    if (!exam) return null;
    const inScope = new Set([...exam.scope].map((id) => model.byId.get(id)?.subjectId));
    return new Set(model.lanes.filter((l) => !inScope.has(l.subjectId)).map((l) => l.subjectId));
  }, [exam, model]);

  /* ───────── Avisos del tutor (máx. 2) ───────── */

  const notices = useMemo<Notice[]>(() => {
    const out: Notice[] = [];
    const short = (sid: string) => catalog.subjectById.get(sid)?.shortName ?? sid;
    const early = neededEarly(catalog, user).find((e) => catalog.conceptById.get(e.conceptId)?.subjectId !== e.bySubject);
    if (early && model.byId.has(early.conceptId)) {
      const c = catalog.conceptById.get(early.conceptId)!;
      out.push({ id: c.id, kind: "late", title: `${c.name} llega tarde`, body: `${short(early.bySubject)} ya lo necesita — te lo adelanto.` });
    }
    let best: WNode | null = null;
    for (const n of model.nodes) {
      if (out[0]?.id === n.id) continue;
      const v = sky.vis.get(n.id)!;
      if (v.lit) continue;
      const cu = subjectStateOf(user, n.subjectId).currentUnit;
      if (n.unitNumber > cu + 1) continue;
      if (!best || n.needed.length > best.needed.length || (n.needed.length === best.needed.length && n.deps > best.deps)) best = n;
    }
    if (best && best.needed.length >= 2) {
      const names = best.needed.map(short);
      const list = names.length > 3 ? `${names.slice(0, 3).join(", ")} y ${num(names.length - 3)} más` : `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
      out.push({
        id: best.id,
        kind: "cross",
        title: `Aquí se cruzan ${num(best.needed.length + 1)} constelaciones`,
        body: `${best.name} se necesita en ${list}.`,
      });
    }
    return out.slice(0, 2);
  }, [user, sky, model]);
  // Los avisos hablan de tu cielo: en las lentes Examen y Estrella guía estorban.
  const shownNotices = lens === "dominio" || lens === "impacto" ? notices : NO_NOTICES;

  /* ───────── Cámara ───────── */

  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const worldRef = useRef<SVGGElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lensCardRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<SkyView | null>(null);

  const insets = useMemo(
    () => (compact ? { left: 58, right: 50, top: 150, bottom: 150 } : { left: 196, right: panelOpen ? 520 + 64 : 72, top: 112, bottom: 104 }),
    [compact, panelOpen],
  );
  const insetsRef = useRef(insets);
  insetsRef.current = insets;

  /** La ficha se abrirá justo después de seleccionar: la cámara ya cuenta con ella. */
  const panelSoon = useRef(false);

  /** Zona libre de la pantalla (sin barras superpuestas ni panel). */
  const safeRect = useCallback((): Rect => {
    const v = view?.view ?? { w: rootRef.current?.clientWidth ?? 1200, h: rootRef.current?.clientHeight ?? 800 };
    const root = rootRef.current?.getBoundingClientRect();
    const i = insetsRef.current;
    let top = i.top;
    let bottom = i.bottom;
    let right = i.right;
    if (panelSoon.current && !compact) right = Math.max(right, 520 + 64);
    let x1 = v.w - right;
    if (root) {
      const tb = toolbarRef.current?.getBoundingClientRect();
      if (tb) top = Math.max(tb.bottom - root.top + 12, 60);
      const bb = bottomRef.current?.getBoundingClientRect();
      if (bb && bb.height > 0) bottom = Math.max(root.bottom - bb.top + 12, 40);
      // La tarjeta de lente: se descuenta por arriba o por la derecha, lo que deje más cielo.
      const lc = lensCardRef.current?.firstElementChild?.getBoundingClientRect();
      if (lc && lc.height > 0 && !compact) {
        const byRight = (lc.left - root.left - 16 - i.left) * (v.h - bottom - top);
        const byTop = (x1 - i.left) * (v.h - bottom - (lc.bottom - root.top + 12));
        if (byRight >= byTop) x1 = Math.min(x1, lc.left - root.left - 16);
        else top = Math.max(top, lc.bottom - root.top + 12);
      } else if (lc && lc.height > 0) top = Math.max(top, lc.bottom - root.top + 10);
    }
    return { x0: i.left, y0: top, x1, y1: v.h - bottom };
  }, [view, compact]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const stage = stageRef.current;
    const layer = layerRef.current;
    const svg = svgRef.current;
    const world = worldRef.current;
    if (!root || !stage || !layer || !svg || !world) return;
    const v = new SkyView(root, stage, layer, svg, world, { w: model.width, h: model.height });
    v.updateExtent();
    root.dataset.lod = v.lod;
    setView(v);
    return () => v.destroy();
  }, [model]);

  // La rueda sobre los superpuestos (nombres de franja, avisos) también mueve el cielo.
  useEffect(() => {
    const root = rootRef.current;
    const stage = stageRef.current;
    if (!root || !stage) return;
    const onWheel = (e: WheelEvent) => {
      const t = e.target as Element | null;
      if (!t || stage.contains(t) || !t.closest(".map-lanes, .map-notices, .map-ruler")) return;
      e.preventDefault();
      stage.dispatchEvent(new WheelEvent("wheel", e));
    };
    root.addEventListener("wheel", onWheel, { passive: false });
    return () => root.removeEventListener("wheel", onWheel);
  }, []);

  const fitAll = useCallback(
    (animate = true) => {
      if (!view) return;
      const s = safeRect();
      if (compact) {
        // En el móvil el cielo es muy ancho: se encaja en alto y se empieza por las bases.
        const k = Math.max(view.minK, (s.y1 - s.y0) / (model.height + 40));
        const x = s.x0 - (model.left - 60) * k;
        const y = s.y0 + 20 * k;
        if (animate) view.animateTo(x, y, k);
        else view.set(x, y, k);
        return;
      }
      view.fitRect({ x0: model.left - 70, y0: -20, x1: model.width - 90, y1: model.height + 20 }, s, { animate });
    },
    [view, safeRect, compact, model],
  );

  const fitIds = useCallback(
    (ids: string[], animate = true, maxK = 1.05) => {
      if (!view || ids.length === 0) return;
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      for (const id of ids) {
        const n = model.byId.get(id);
        if (!n) continue;
        x0 = Math.min(x0, n.x);
        y0 = Math.min(y0, n.y);
        x1 = Math.max(x1, n.x);
        y1 = Math.max(y1, n.y);
      }
      if (!Number.isFinite(x0)) return;
      view.fitRect({ x0: x0 - 120, y0: y0 - 70, x1: x1 + 120, y1: y1 + 90 }, safeRect(), { animate, maxK });
    },
    [view, model, safeRect],
  );

  /** Encaja la evaluación: con sus bases externas si caben de cerca; si no, solo sus temas. */
  const fitExam = useCallback(
    (animate = true) => {
      if (!view || !exam || exam.scope.size === 0) return;
      const all = [...exam.scope];
      const ext = new Set(exam.external);
      const own = all.filter((id) => !ext.has(id));
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      for (const id of all) {
        const n = model.byId.get(id)!;
        x0 = Math.min(x0, n.x);
        y0 = Math.min(y0, n.y);
        x1 = Math.max(x1, n.x);
        y1 = Math.max(y1, n.y);
      }
      const s = safeRect();
      const k = Math.min((s.x1 - s.x0) / (x1 - x0 + 240), (s.y1 - s.y0) / (y1 - y0 + 160));
      fitIds(k >= 0.45 || own.length === 0 ? all : own, animate, 1.05);
    },
    [view, exam, model, safeRect, fitIds],
  );

  /**
   * Lleva un concepto a la vista. Con `force` encaja la estrella con sus
   * requisitos y dependientes directos (aunque estén en otras constelaciones);
   * si no, solo se mueve si queda fuera de la zona libre.
   */
  const focusNode = useCallback(
    (id: string, force: boolean, animate = true) => {
      if (!view) return;
      const n = model.byId.get(id);
      if (!n) return;
      if (force) {
        fitIds([id, ...(catalog.requiresOf.get(id) ?? []), ...(catalog.requiredBy.get(id) ?? [])], animate, FOCUS_K);
        return;
      }
      const s = safeRect();
      const p = view.toScreen(n.x, n.y);
      const inside = p.x > s.x0 + 40 && p.x < s.x1 - 40 && p.y > s.y0 + 40 && p.y < s.y1 - 40;
      if (!inside) view.centerOn(n.x, n.y, s, view.view.k, animate);
    },
    [view, model, safeRect, fitIds],
  );

  // Cámara inicial y al cambiar de foco o de lente.
  const cameraDone = useRef(false);
  const lastFoco = useRef<string | null>(null);
  const clickedFoco = useRef<string | null>(null);
  useEffect(() => {
    if (!view) return;
    if (!cameraDone.current) {
      cameraDone.current = true;
      lastFoco.current = foco;
      if (foco && model.byId.has(foco)) {
        fitAll(false);
        focusNode(foco, true, false);
      } else if (exam?.scope.size) fitExam(false);
      else if (guide?.ids.length) fitIds(guide.ids, false, 0.9);
      else fitAll(false);
      return;
    }
    if (foco !== lastFoco.current) {
      lastFoco.current = foco;
      if (foco && model.byId.has(foco)) focusNode(foco, clickedFoco.current !== foco);
      clickedFoco.current = null;
      panelSoon.current = false;
    }
  }, [view, foco, model, exam, guide, fitAll, fitIds, focusNode]);

  // Encaja el ámbito al cambiar de evaluación o de estrella guía.
  const examKey = exam?.chosen?.a.id ?? "";
  const guideKey = guide?.g.id ?? "";
  const lensKeyRef = useRef(`${lens}|${examKey}|${guideKey}`);
  useEffect(() => {
    const key = `${lens}|${examKey}|${guideKey}`;
    if (!view || key === lensKeyRef.current) return;
    lensKeyRef.current = key;
    if (lens === "examen" && exam?.scope.size) fitExam();
    else if (lens === "guia" && guide?.ids.length) fitIds(guide.ids, true, 0.9);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, lens, examKey, guideKey]);

  /* ───────── Etiquetas ───────── */

  const labelData = useRef({ sky, selection, lens, exam, guide, notices: shownNotices, visibleNodes, sizes });
  labelData.current = { sky, selection, lens, exam, guide, notices: shownNotices, visibleNodes, sizes };

  /** Zonas ocupadas por los superpuestos (px del mapa). Se miden tras pintar, no en cada pasada. */
  const obstacleCache = useRef<Rect[] | null>(null);
  const measureObstacles = useCallback((): Rect[] => {
    const root = rootRef.current?.getBoundingClientRect();
    if (!root) return [];
    const out: Rect[] = [];
    const tb = toolbarRef.current?.getBoundingClientRect();
    if (tb) out.push({ x0: -9999, y0: -9999, x1: 99999, y1: tb.bottom - root.top - 18 });
    for (const el of [toolbarRef.current, bottomRef.current, lensCardRef.current, controlsRef.current]) {
      if (!el) continue;
      for (const child of Array.from(el.children) as HTMLElement[]) {
        const r = child.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        out.push({ x0: r.left - root.left, y0: r.top - root.top, x1: r.right - root.left, y1: r.bottom - root.top });
      }
    }
    out.push({ x0: -9999, y0: -9999, x1: insetsRef.current.left - 6, y1: 9999 });
    obstacleCache.current = out;
    return out;
  }, []);
  const obstacles = useCallback(() => obstacleCache.current ?? measureObstacles(), [measureObstacles]);

  const runLabels = useCallback(() => {
    const v = view;
    const svg = svgRef.current;
    if (!v || !svg) return;
    const d = labelData.current;
    const vw = v.view;
    const lod = lodOf(vw.k);
    const sgs = vw.k * glyphScale(vw.k);
    const obs = obstacles();
    const conceptEls = svg.querySelectorAll<SVGGElement>(".map-lbls .map-lbl");
    const unitEls = svg.querySelectorAll<SVGGElement>(".map-ulbl");
    const far = lod === "far" && d.lens !== "examen";
    const sel = d.selection;
    const noticeIds = new Set(d.notices.map((n) => n.id));
    const guideIds = new Set(d.guide?.ids ?? []);
    const cands: LabelCand[] = [];

    /** Candidata de etiqueta de concepto: debajo o encima; con insignia HOY/SIGUIENTE, solo debajo. */
    const push = (n: WNode, prio: number, force = false) => {
      const sz = d.sizes.get(n.id) ?? 1;
      const off = sgs * sz * 9 + 3;
      const isSel = sel?.id === n.id;
      const st = d.sky.vis.get(n.id)?.state;
      const tagged = !isSel && ((st === "today" && lod === "near") || (st === "next" && lod !== "far"));
      // La seleccionada va en serif de 18 px (≈ 8 px por carácter).
      const w = isSel ? Math.max(...n.lines.map((l) => l.length)) * 8 + 6 : n.lw;
      const lines = n.lines.length;
      const h = lines * (isSel ? 19 : 15) + 2;
      const slots: LabelSlot[] = tagged
        ? [{ dx: -Math.max(w, 70) / 2, dy: -off - 18, w: Math.max(w, 70), h: h + 2 * off + 18, pos: "b" }]
        : [
            { dx: -w / 2, dy: off + (isSel ? 6 : 0), w, h, pos: "b" },
            { dx: -w / 2, dy: -off - h - (isSel ? 6 : 0), w, h, pos: "a" },
          ];
      cands.push({ id: n.id, wx: n.x, wy: n.y, prio, force, slots });
    };

    if (far) {
      // De lejos: solo lo que importa ahora (selección y su entorno directo, estrella guía)…
      if (sel) {
        push(model.byId.get(sel.id)!, 1e7, true);
        for (const [id, dd] of sel.pre) if (dd === 1) push(model.byId.get(id)!, 5e5 + model.byId.get(id)!.impact);
        for (const [id, dd] of sel.dep) if (dd === 1) push(model.byId.get(id)!, 4e5 + model.byId.get(id)!.impact);
      }
      for (const id of guideIds) if (!sel || id !== sel.id) push(model.byId.get(id)!, 4.5e5);
      // …y los temas como estrellas mayores.
      for (const u of model.units) {
        const st = d.sky.units.get(u.id) ?? { lit: 0, seen: 0, total: u.nodeIds.length };
        // De muy lejos solo se rotulan los temas que ya has empezado.
        if (vw.k < 0.2 && st.seen === 0) continue;
        const R = unitRadius(u.nodeIds.length) + 7;
        const pctW = st.lit > 0 ? 44 : 0;
        const shortW = 26 + pctW;
        const longW = Math.max(shortW, Math.min(30, u.title.length) * 6.3 + 6);
        const slots: LabelSlot[] = [];
        if (vw.k >= 0.2) {
          slots.push({ dx: R, dy: -8, w: longW, h: 30, pos: "rl" }, { dx: -R - longW, dy: -8, w: longW, h: 30, pos: "ll" });
        }
        slots.push({ dx: R, dy: -8, w: shortW, h: 15, pos: "r" }, { dx: -R - shortW, dy: -8, w: shortW, h: 15, pos: "l" });
        cands.push({ id: `u:${u.id}`, wx: u.x, wy: u.y, prio: (st.lit > 0 ? 1000 : st.seen > 0 ? 500 : 0) + st.total, slots });
      }
    } else {
      const near = lod === "near";
      for (const n of d.visibleNodes) {
        const v2 = d.sky.vis.get(n.id)!;
        const imp = n.impact * 100;
        if (sel?.id === n.id) {
          push(n, 1e7, true);
          continue;
        }
        const ds = sel ? sel.pre.get(n.id) ?? sel.dep.get(n.id) : undefined;
        if (ds === 1) push(n, 5e5 + imp);
        else if (guideIds.has(n.id)) push(n, 4e5 + imp);
        else if (noticeIds.has(n.id)) push(n, 3.5e5);
        else if (d.sky.todaySet.has(n.id)) push(n, 3e5 + imp);
        else if (v2.state === "next") push(n, 2e5 + imp);
        else if (d.lens === "examen") push(n, 1e5 + imp);
        else if (ds !== undefined && ds <= PATH_DEPTH) push(n, 5e4 + imp - ds * 100);
        else if (near) push(n, imp);
        else if (n.deps >= 90 || (d.lens === "impacto" && n.deps >= 40)) push(n, 1e4 + imp);
      }
      // La seleccionada también fuera de visibleNodes (lente Examen).
      if (sel && !d.visibleNodes.some((n) => n.id === sel.id)) push(model.byId.get(sel.id)!, 1e7, true);
    }

    // Las estrellas visibles también cuentan como obstáculo (ninguna etiqueta encima de otra estrella).
    const starObs: Rect[] = [];
    if (!far || sel) {
      const pool = far ? [...(sel ? [sel.id, ...[...sel.pre].filter(([, dd]) => dd === 1).map(([id]) => id), ...[...sel.dep].filter(([, dd]) => dd === 1).map(([id]) => id)] : [])].map((id) => model.byId.get(id)!) : d.visibleNodes;
      for (const n of pool) {
        const sx = n.x * vw.k + vw.x;
        const sy = n.y * vw.k + vw.y;
        if (sx < -40 || sx > vw.w + 40 || sy < -40 || sy > vw.h + 40) continue;
        const r = sgs * (d.sizes.get(n.id) ?? 1) * 6;
        starObs.push({ x0: sx - r, y0: sy - r, x1: sx + r, y1: sy + r });
      }
    }
    const placed = placeLabels(cands, vw, [...obs, ...starObs]);
    const conceptPlaced = new Map<string, Placed>();
    const unitPlaced = new Map<string, Placed>();
    for (const [id, pos] of placed) {
      if (id.startsWith("u:")) unitPlaced.set(id.slice(2), pos);
      else conceptPlaced.set(id, pos);
    }
    applyLabels(unitEls, unitPlaced, "uid");
    applyLabels(conceptEls, conceptPlaced);
    // Atenuación y selección, sin React.
    for (const el of conceptEls) {
      const id = el.dataset.lid!;
      const isSel = sel?.id === id;
      const hl = !!sel && (sel.pre.get(id) === 1 || sel.dep.get(id) === 1);
      if (hl !== "hl" in el.dataset) {
        if (hl) el.dataset.hl = "";
        else delete el.dataset.hl;
      }
      const dd = sel ? sel.pre.get(id) ?? sel.dep.get(id) : undefined;
      const onPath = !sel || isSel || (dd !== undefined && dd <= PATH_DEPTH);
      const dim = (!!sel && !onPath) || (d.lens === "guia" && !sel && !guideIds.has(id));
      if (isSel !== "sel" in el.dataset) {
        if (isSel) el.dataset.sel = "";
        else delete el.dataset.sel;
      }
      if (dim !== "dim" in el.dataset) {
        if (dim) el.dataset.dim = "";
        else delete el.dataset.dim;
      }
    }
  }, [view, model, obstacles]);

  useEffect(() => {
    if (!view) return;
    const offEnd = view.onEnd(() => runLabels());
    const offLod = view.onLod(() => runLabels());
    return () => {
      offEnd();
      offLod();
    };
  }, [view, runLabels]);

  // Los superpuestos cambian de tamaño con la lente, la ficha o la ventana: se vuelven a medir.
  useLayoutEffect(() => {
    obstacleCache.current = null;
  });
  useEffect(() => {
    const onResize = () => (obstacleCache.current = null);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Tras cada cambio de datos que afecte a las etiquetas.
  useEffect(() => {
    const id = requestAnimationFrame(() => runLabels());
    return () => cancelAnimationFrame(id);
  }, [runLabels, sky, selection, lens, exam, guide, shownNotices, visibleNodes, sizes, compact, panelOpen]);

  /* ───────── Interacción ───────── */

  const select = useCallback(
    (id: string | null, center = false) => {
      if (!id) {
        setQuery({ foco: null, c: null });
        return;
      }
      clickedFoco.current = center ? null : id;
      panelSoon.current = true;
      if (foco === id) {
        if (center) focusNode(id, true);
        panelSoon.current = false;
        openConcept(id);
        return;
      }
      setQuery({ foco: id });
      openConcept(id);
    },
    [foco, focusNode],
  );

  const onSvgClick = (e: MouseEvent<SVGSVGElement>) => {
    const t = e.target as Element;
    const node = t.closest<SVGGElement>("[data-id]");
    if (node) {
      select(node.dataset.id!);
      return;
    }
    const unit = t.closest<SVGGElement>("[data-uid]");
    if (unit && view) {
      const u = model.unitBy.get(unit.dataset.uid!);
      if (u) fitIds(u.nodeIds, true, 1);
      return;
    }
    if (foco) select(null);
  };

  const onSvgOver = (e: PointerEvent<SVGSVGElement>) => {
    if (e.pointerType === "touch" || view?.moving) return;
    const t = e.target as Element;
    const node = t.closest<SVGGElement>("[data-id]");
    if (node) return setHover({ kind: "node", id: node.dataset.id! });
    const unit = t.closest<SVGGElement>("[data-uid]");
    if (unit) return setHover({ kind: "unit", id: unit.dataset.uid! });
    setHover(null);
  };

  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (!view) return;
    const step = 90;
    const s = safeRect();
    const map: Record<string, () => void> = {
      ArrowLeft: () => view.panBy(step, 0),
      ArrowRight: () => view.panBy(-step, 0),
      ArrowUp: () => view.panBy(0, step),
      ArrowDown: () => view.panBy(0, -step),
      "+": () => view.zoomBy(1.4, s),
      "=": () => view.zoomBy(1.4, s),
      "-": () => view.zoomBy(1 / 1.4, s),
      "0": () => fitAll(),
      Escape: () => foco && select(null),
    };
    const fn = map[e.key];
    if (fn) {
      e.preventDefault();
      fn();
    }
  };

  useEffect(() => () => setHover(null), []);

  const lensOptions = [
    { value: "dominio" as const, label: "Dominio" },
    { value: "examen" as const, label: "Examen" },
    { value: "impacto" as const, label: "Impacto" },
    { value: "guia" as const, label: "Estrella guía" },
  ];

  const veil = !!selection || lens === "guia";
  const hasPanel = panelOpen && !compact;

  return (
    <div
      ref={rootRef}
      className={cx("map-root", hasPanel && "has-panel", veil && "has-veil")}
      data-lens={lens}
      data-sel={selection ? "" : undefined}
      style={{ "--map-left": `${insets.left}px`, "--ruler-top": `${insets.top - 20}px` } as CSSProperties}
    >
      <Parallax view={view} />
      <div ref={stageRef} className="map-stage">
      <div ref={layerRef} className="map-layer">
      <svg
        ref={svgRef}
        className="map-svg"
        role="application"
        aria-roledescription="carta celeste"
        aria-label={`Carta celeste: ${model.nodes.length} conceptos en ${model.lanes.length} constelaciones. Flechas para moverte, más y menos para acercar, 0 para verla entera. Usa el buscador para ir a un concepto.`}
        tabIndex={0}
        onClick={onSvgClick}
        onPointerOver={onSvgOver}
        onPointerLeave={() => setHover(null)}
        onKeyDown={onKey}
      >
        <StarDefs id={DEFS_ID} />
        <g ref={worldRef} className="map-world">
          <GridLayer model={model} />
          {lens !== "examen" && <FarLayer model={model} sky={sky} impact={lens === "impacto"} />}
          <g className="map-near">
            <EdgeLayer groups={edgeGroups} />
            <HoverEdges model={model} />
            <NodeLayer nodes={visibleNodes} vis={sky.vis} sizes={sizes} />
            {exam && <ExternalMarks model={model} ids={exam.external} />}
          </g>
          <rect className="map-veil" x={-20000} y={-20000} width={60000} height={60000} />
          {selection && <HighlightLayer model={model} selection={selection} vis={sky.vis} sizes={sizes} />}
          {guide && guide.ids.length > 0 && <GuideLayer model={model} ids={guide.ids} vis={sky.vis} sizes={sizes} />}
          <NoticeMarks model={model} marks={shownNotices} />
          <LabelLayer nodes={model.nodes} vis={sky.vis} sizes={sizes} todaySet={sky.todaySet} />
        </g>
      </svg>
      </div>
      <div className="map-shield" aria-hidden="true" />
      </div>

      <Ruler model={model} view={view} leftInset={insets.left} />
      <LaneLabels
        model={model}
        sky={sky}
        view={view}
        badges={laneBadges}
        dimmed={dimmedLanes}
        compact={compact}
        topInset={insets.top - 8}
        bottomInset={insets.bottom - 8}
        onPick={(sid) => fitIds(model.laneBy.get(sid)?.nodeIds ?? [], true, 0.6)}
      />
      <Notices
        model={model}
        view={view}
        notices={shownNotices}
        safe={{ top: insets.top, bottom: insets.bottom, left: insets.left, right: insets.right }}
        onPick={(id) => select(id, true)}
      />
      <HoverTip model={model} sky={sky} view={view} />

      <header ref={toolbarRef} className="map-top">
        <div className="map-title">
          <p className="mono-label">Mapa · {model.lanes.length} constelaciones</p>
          <h1>Carta celeste</h1>
          <p className="map-stats num">
            <b>{num(sky.lit)}</b> de {num(model.nodes.length)} {pluralWord(model.nodes.length, "estrella encendida", "estrellas encendidas")}
            {sky.cooling > 0 && <span className="frost-text"> · {num(sky.cooling)} enfriándose</span>}
          </p>
        </div>
        <div className="map-tools">
          <Segmented<Lens>
            aria-label="Lente de la carta"
            variant="chips"
            size="sm"
            value={lens}
            onChange={(v) => setQuery({ lente: v === "dominio" ? null : v })}
            options={lensOptions}
            className="map-lenses"
          />
          <SkySearch sky={sky} onPick={(id) => select(id, true)} />
        </div>
      </header>

      <div ref={lensCardRef} className="map-lenscard-wrap">
        {lens === "examen" && <ExamCard dated={dated} exam={exam} />}
        {lens === "impacto" && (
          <div className="map-lenscard">
            <p className="mono-label is-gold">Lente · Impacto</p>
            <p className="map-lenscard-t">El radio crece con la raíz de lo que sostiene cada estrella.</p>
            <p className="map-lenscard-d">Las mayores son bases de cientos de conceptos: si se apagan, se apaga medio cielo.</p>
          </div>
        )}
        {lens === "guia" && <GuideCard guide={guide} />}
      </div>

      <div ref={controlsRef} className="map-controls">
        <div className="map-zoom" role="group" aria-label="Zoom de la carta">
          <IconButton aria-label="Acercar" icon={<Plus />} tooltipSide="top" tooltipAlign="end" onClick={() => view?.zoomBy(1.6, safeRect())} />
          <IconButton aria-label="Alejar" icon={<Minus />} tooltipSide="top" tooltipAlign="end" onClick={() => view?.zoomBy(1 / 1.6, safeRect())} />
          <IconButton aria-label="Ver el cielo entero" icon={<Crosshair />} tooltipSide="top" tooltipAlign="end" onClick={() => fitAll()} />
        </div>
        <Legend lens={lens} />
      </div>

      <div ref={bottomRef} className="map-bottom">
        <TodayStrip sky={sky} progress={derived.progress} onPick={(id) => select(id, true)} />
      </div>
    </div>
  );
}

/* ───────── Parallax del fondo ───────── */

function Parallax({ view }: { view: SkyView | null }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!view) return;
    return view.onChange((v) => {
      const el = ref.current;
      if (!el) return;
      // Solo traslación: el compositor la mueve sin volver a rasterizar el campo de estrellas.
      el.style.transform = `translate3d(${((v.x * 0.035) % 420).toFixed(1)}px, ${((v.y * 0.035) % 420).toFixed(1)}px, 0)`;
    });
  }, [view]);
  return (
    <div className="map-parallax" aria-hidden="true">
      <div ref={ref} className="map-parallax-in">
        <StarField seed={71} density={1.25} graticule="auto" />
      </div>
    </div>
  );
}

/* ───────── Buscador ───────── */

function SkySearch({ sky, onPick }: { sky: SkyState; onPick: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const results = useMemo(() => (q.trim() ? searchConcepts(catalog, q, 8) : []), [q]);
  const listId = "map-search-list";

  const pick = (id: string) => {
    onPick(id);
    setOpen(false);
    setQ("");
    setExpanded(false);
    inputRef.current?.blur();
  };

  return (
    <div className={cx("map-search", expanded && "is-expanded")}>
      <button type="button" className="map-search-toggle" aria-label="Buscar en la carta" onClick={() => {
        setExpanded(true);
        requestAnimationFrame(() => inputRef.current?.focus());
      }}>
        <Icons.search aria-hidden="true" />
      </button>
      <label className="map-search-field">
        <Icons.search aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          value={q}
          placeholder="Buscar una estrella…"
          aria-label="Buscar un concepto en la carta"
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls={listId}
          aria-activedescendant={open && results[active] ? `map-sr-${active}` : undefined}
          aria-autocomplete="list"
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => {
            setOpen(false);
            if (!q) setExpanded(false);
          }, 120)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(results.length - 1, a + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (e.key === "Enter" && results[active]) {
              e.preventDefault();
              pick(results[active]);
            } else if (e.key === "Escape") {
              e.stopPropagation();
              setQ("");
              setOpen(false);
              setExpanded(false);
              inputRef.current?.blur();
            }
          }}
        />
        {expanded && (
          <button type="button" className="map-search-close" aria-label="Cerrar el buscador" onMouseDown={(e) => e.preventDefault()} onClick={() => {
            setQ("");
            setExpanded(false);
          }}>
            <X aria-hidden="true" />
          </button>
        )}
      </label>
      {open && results.length > 0 && (
        <ul id={listId} role="listbox" className="map-search-list" aria-label="Estrellas encontradas">
          {results.map((id, i) => {
            const c = catalog.conceptById.get(id)!;
            const v = sky.vis.get(id);
            const unit = catalog.unitById.get(c.unitId);
            return (
              <li
                key={id}
                id={`map-sr-${i}`}
                role="option"
                aria-selected={i === active}
                className={cx("map-search-item", i === active && "is-active")}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(id)}
              >
                <Star state={v?.state ?? "unseen"} subjectId={c.subjectId} size={22} />
                <span className="map-search-main">
                  <b>{c.name}</b>
                  <small style={{ color: subjectFg(c.subjectId) }}>
                    {catalog.subjectById.get(c.subjectId)?.shortName} · tema {unit?.number}
                  </small>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ───────── Tarjetas de lente ───────── */

function ExamCard({
  dated,
  exam,
}: {
  dated: DatedAssessment[];
  exam: { chosen: DatedAssessment | null; scope: Set<string>; external: string[]; readiness: ReturnType<typeof examReadiness> | null } | null;
}) {
  if (!exam || !exam.chosen) {
    return (
      <div className="map-lenscard">
        <p className="mono-label is-gold">Lente · Examen</p>
        <p className="map-lenscard-t">Aún no hay evaluaciones con fecha.</p>
        <p className="map-lenscard-d">
          Añádelas en <a className="map-link" href={href("/asignaturas")}>Asignaturas → Evaluación</a> y aquí verás solo lo que entra.
        </p>
      </div>
    );
  }
  const { chosen, readiness, scope, external } = exam;
  const subject = catalog.subjectById.get(chosen.subjectId);
  const lit = readiness ? Math.round(readiness.coverage * scope.size) : 0;
  return (
    <div className="map-lenscard">
      <label className="map-select">
        <span className="mono-label is-gold">Lente · Examen</span>
        <select value={chosen.a.id} onChange={(e) => setQuery({ eval: e.target.value })} aria-label="Evaluación">
          {dated.map((d) => (
            <option key={d.a.id} value={d.a.id}>
              {d.a.title} · {catalog.subjectById.get(d.subjectId)?.shortName} · {dateShort(d.a.date!)}
            </option>
          ))}
        </select>
      </label>
      <p className="map-lenscard-t">
        {chosen.a.title} de {subject?.shortName} <span className="tone-3">· {chosen.days >= 0 ? relDays(chosen.days) : `fue ${relDays(chosen.days)}`}</span>
      </p>
      {chosen.a.unitIds.length === 0 ? (
        <p className="map-lenscard-d">
          No tiene temas asignados: elígelos en <a className="map-link" href={href(`/asignatura/${chosen.subjectId}?tab=evaluacion`)}>su evaluación</a>.
        </p>
      ) : (
        readiness && (
          <>
            <div className="map-ready">
              <span className="map-ready-n num">{pct(readiness.expected)}</span>
              <span className="map-ready-l">preparación prevista</span>
            </div>
            <ProgressBar value={readiness.expected} size="sm" tone={readiness.expected >= 0.7 ? "gold" : readiness.expected >= 0.4 ? "star" : "ember"} label="Preparación prevista" />
            <p className="map-lenscard-d num">
              {num(lit)} de {plural(scope.size, "estrella encendida", "estrellas encendidas")}
              {external.length > 0 && ` · ${plural(external.length, "base de fuera", "bases de fuera")}`}
            </p>
          </>
        )
      )}
    </div>
  );
}

function GuideCard({ guide }: { guide: { g: Legend | Profile; ids: string[]; prog: { done: number; total: number; ratio: number; golden: boolean } } | null }) {
  const legendsList = guides.filter(isLegend);
  const profilesList = guides.filter((g) => !isLegend(g));
  return (
    <div className="map-lenscard">
      <label className="map-select">
        <span className="mono-label is-gold">Lente · Estrella guía</span>
        <select value={guide?.g.id ?? ""} onChange={(e) => setQuery({ guia: e.target.value })} aria-label="Estrella guía">
          <optgroup label="Leyendas">
            {legendsList.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="Perfiles destacados">
            {profilesList.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </optgroup>
        </select>
      </label>
      {guide && (
        <>
          <p className="map-lenscard-t serif-italic">{guide.g.tagline}</p>
          {guide.ids.length === 0 ? (
            <p className="map-lenscard-d">Su constelación aún no tiene estrellas en tu temario.</p>
          ) : (
            <>
              <ProgressBar value={guide.prog.ratio} size="sm" tone="gold" label={`Constelación de ${guide.g.name}`} />
              <p className="map-lenscard-d num">
                {num(guide.prog.done)} de {plural(guide.prog.total, "estrella encendida", "estrellas encendidas")}
                {guide.prog.golden && " · constelación de oro"}
              </p>
            </>
          )}
          <a className="map-link" href={href(`/guia/${guide.g.id}`)}>
            Su historia <Icons.open aria-hidden="true" />
          </a>
        </>
      )}
    </div>
  );
}

/* ───────── Hoy se encienden ───────── */

function TodayStrip({ sky, progress, onPick }: { sky: SkyState; progress: ReturnType<typeof useDerived>["progress"]; onPick: (id: string) => void }) {
  const items = sky.today;
  const minutes = Math.round(items.reduce((s, i) => s + i.minutes, 0));
  return (
    <section className="map-today" aria-label="Hoy se encienden">
      <div className="map-today-head">
        <p className="mono-label is-gold">Hoy se encienden</p>
        <p className="map-today-sum num">
          {items.length > 0 ? `${plural(items.length, "estrella", "estrellas")} · ${num(minutes)} min` : "Plan de hoy vacío"}
        </p>
      </div>
      {items.length > 0 ? (
        <ul className="map-today-list">
          {items.map((it) => {
            const c = catalog.conceptById.get(it.conceptId);
            if (!c) return null;
            const tr = transitionOf(it, progressOf(progress, it.conceptId));
            return (
              <li key={it.conceptId}>
                <button type="button" className="map-chip" onClick={() => onPick(it.conceptId)} title={c.name}>
                  <i className="map-chip-dot" style={{ background: `var(--s-${c.subjectId})` }} aria-hidden="true" />
                  <span className="map-chip-name">{c.name}</span>
                  <span className="map-chip-tr num" aria-label={tr.to != null ? `nivel ${tr.from} a ${tr.to}` : `repaso, nivel ${tr.from}`}>
                    {tr.to != null ? (
                      <>
                        {tr.from}
                        <span aria-hidden="true">→</span>
                        {tr.to}
                      </>
                    ) : (
                      <>↻ {tr.from}</>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="map-today-empty">Tu cielo descansa: nada planificado para hoy.</p>
      )}
    </section>
  );
}

/* ───────── Leyenda plegable ───────── */

const LEGEND_STATES: StarState[] = ["mastered", "understood", "seen", "cooling", "today", "next", "locked", "unseen"];

function Legend({ lens }: { lens: Lens }) {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem("atlas.map.legend") === "1";
    } catch {
      return false;
    }
  });
  const toggle = () => {
    setOpen((o) => {
      try {
        localStorage.setItem("atlas.map.legend", o ? "0" : "1");
      } catch {
        /* sin almacenamiento: da igual */
      }
      return !o;
    });
  };
  return (
    <div className={cx("map-legend", open && "is-open")}>
      <button type="button" className="map-legend-toggle" aria-expanded={open} aria-controls="map-legend-body" onClick={toggle}>
        <Icons.help aria-hidden="true" />
        <span>Leyenda</span>
      </button>
      {open && (
        <div id="map-legend-body" className="map-legend-body">
          <ul className="map-legend-states">
            {LEGEND_STATES.map((s) => (
              <li key={s}>
                <Star state={s} size={22} subjectId="calculo" />
                <span>{STAR_STATE_LABELS[s]}</span>
              </li>
            ))}
          </ul>
          <ul className="map-legend-lines">
            <li>
              <svg viewBox="0 0 28 8" aria-hidden="true">
                <path d="M1 4H27" className="map-lg-in" />
              </svg>
              Requisito en la misma asignatura
            </li>
            <li>
              <svg viewBox="0 0 28 8" aria-hidden="true">
                <path d="M1 4H9M19 4H27" className="map-lg-x" />
              </svg>
              Cruza a otra asignatura: arranque en su color (entera al pasar por encima)
            </li>
            <li>
              <svg viewBox="0 0 28 8" aria-hidden="true">
                <path d="M1 4H27" className="map-lg-gold" />
              </svg>
              Ruta de la estrella elegida
            </li>
          </ul>
          <p className="map-legend-note">La regla de abajo mide pasos de profundidad desde las bases (0 = sin requisitos).</p>
          <p className="map-legend-note">
            {lens === "impacto"
              ? "Radio ∝ √ conceptos que dependen de ella."
              : "De lejos, cada tema es una estrella mayor: su arco dorado es lo encendido."}{" "}
            Izquierda: bases; derecha: lo que se apoya en ellas.
          </p>
        </div>
      )}
    </div>
  );
}
