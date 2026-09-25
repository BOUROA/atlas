// Cámara de la carta celeste. d3-zoom escucha en un <div> (el escenario) y la
// transformación se aplica sin React y sin repintar durante los gestos:
//
//  · El <svg> es más grande que la pantalla (un margen del 35 % por cada lado) y
//    va en su propia capa. Durante un gesto (arrastre, rueda, pellizco,
//    animación) se mueve y escala esa capa con una transformación CSS que
//    resuelve el compositor: no hay recálculo de estilos, ni disposición, ni
//    rasterizado del cielo en cada fotograma.
//  · El cielo se "consolida" (transformación real del <g> del mundo, escalas de
//    glifos y etiquetas, nivel de detalle) al terminar el gesto, o antes si el
//    desplazamiento se come el margen o la escala se aleja más de ×0,62 / ×2.
//    Un cambio de escala en SVG obliga a volver a disponer los ~6 000 trazos:
//    por eso no se hace en cada fotograma.
//
// Los elementos superpuestos (franjas, regla, avisos, tooltip) siguen la vista
// "virtual" en cada fotograma; las etiquetas y el nivel de detalle, la consolidada.
import { select, type Selection } from "d3-selection";
import { zoom as d3zoom, zoomIdentity, type D3ZoomEvent, type ZoomBehavior, type ZoomTransform } from "d3-zoom";

export type Lod = "far" | "mid" | "near";
export type View = { x: number; y: number; k: number; w: number; h: number };
export type Rect = { x0: number; y0: number; x1: number; y1: number };

/** Umbrales del zoom semántico (escala k del mundo). */
export const LOD_MID = 0.45;
export const LOD_NEAR = 1.1;
export const K_MAX = 2.6;

export const lodOf = (k: number): Lod => (k < LOD_MID ? "far" : k < LOD_NEAR ? "mid" : "near");

/**
 * Escala de los glifos en pantalla: crecen suavemente con el zoom (≈ 1,15 a
 * k = 0,45 · 1,40 a k = 1,1 · 1,70 a k = 2,6) en vez de escalar con k.
 */
export const screenGlyph = (k: number) => 1.15 * Math.pow(k / LOD_MID, 0.22);
/** Escala de los glifos respecto al mundo (la que se aplica dentro del <g> escalado). */
export const glyphScale = (k: number) => screenGlyph(k) / k;

/** Deriva máxima de escala sin consolidar durante un gesto. */
const DRIFT_MIN = 0.62;
const DRIFT_MAX = 2;
/** Margen del <svg> fuera de la pantalla, en fracción del ancho/alto visibles. */
const OVERSCAN = 0.35;

type Listener = (v: View) => void;

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class SkyView {
  readonly svg: SVGSVGElement;
  /** Capa HTML que envuelve al <svg>: la transformación del gesto va aquí. En el
   *  propio <svg> obligaría a volver a disponer el texto (cambia su escala de pantalla). */
  private layer: HTMLDivElement;
  readonly world: SVGGElement;
  readonly root: HTMLElement;
  private sel: Selection<HTMLDivElement, unknown, null, undefined>;
  private behavior: ZoomBehavior<HTMLDivElement, unknown>;
  private listeners = new Set<Listener>();
  private endListeners = new Set<Listener>();
  private lodListeners = new Set<(lod: Lod) => void>();
  private ro: ResizeObserver;
  private tween = 0;
  private tweening = false;
  private endTimer: ReturnType<typeof setTimeout> | null = null;
  /**
   * Escalas dependientes del zoom como reglas CSS compartidas en una hoja
   * propia (no variables en la raíz, que obligarían a recalcular los ~10 000
   * elementos): .map-gs (glifos), .map-ts (tamaño fijo en pantalla), .map-lu
   * (etiquetas) y --u en .map-u (grosor de los trazos, px de pantalla).
   */
  private styleEl: HTMLStyleElement;
  private rules: { gs: CSSStyleRule; ts: CSSStyleRule; lu: CSSStyleRule; u: CSSStyleRule };
  private kMin = 0.05;
  /** Vista que ve el usuario (incluye la transformación CSS del gesto). */
  view: View = { x: 0, y: 0, k: 0.2, w: 1, h: 1 };
  /** Vista consolidada: la que tiene pintada el SVG. */
  committed = { x: 0, y: 0, k: 0 };
  /** Margen del <svg> por cada lado (px). */
  private mx = 0;
  private my = 0;
  lod: Lod = "far";
  moving = false;

  constructor(
    root: HTMLElement,
    stage: HTMLDivElement,
    layer: HTMLDivElement,
    svg: SVGSVGElement,
    world: SVGGElement,
    private worldSize: { w: number; h: number },
  ) {
    this.root = root;
    this.layer = layer;
    this.svg = svg;
    this.world = world;
    this.sel = select(stage);
    this.styleEl = document.createElement("style");
    this.styleEl.dataset.map = "zoom";
    this.styleEl.textContent = ".map-gs{transform:scale(1)}.map-ts{transform:scale(1)}.map-lu{transform:scale(1)}.map-u{--u:1}";
    document.head.appendChild(this.styleEl);
    const rs = this.styleEl.sheet!.cssRules;
    this.rules = { gs: rs[0] as CSSStyleRule, ts: rs[1] as CSSStyleRule, lu: rs[2] as CSSStyleRule, u: rs[3] as CSSStyleRule };
    const r = stage.getBoundingClientRect();
    this.view.w = Math.max(1, r.width);
    this.view.h = Math.max(1, r.height);
    this.layoutSvg();
    this.behavior = d3zoom<HTMLDivElement, unknown>()
      .scaleExtent([this.kMin, K_MAX])
      .extent((): [[number, number], [number, number]] => [[0, 0], [this.view.w, this.view.h]])
      .on("start", () => {
        // data-moving (velo del puntero) solo cuando algo se mueve de verdad: un clic
        // sin arrastre debe llegar a la estrella que hay debajo.
        this.moving = true;
      })
      .on("zoom", (e: D3ZoomEvent<HTMLDivElement, unknown>) => this.apply(e.transform))
      .on("end", () => {
        if (this.tweening) return;
        this.settle();
      });
    this.sel.call(this.behavior);
    this.ro = new ResizeObserver(() => {
      const rr = stage.getBoundingClientRect();
      if (rr.width < 1 || rr.height < 1) return;
      this.view.w = rr.width;
      this.view.h = rr.height;
      this.layoutSvg();
      this.updateExtent();
      if (this.committed.k > 0) this.commit(this.view.x, this.view.y, this.view.k, true);
      this.emit();
      for (const l of this.endListeners) l(this.view);
    });
    this.ro.observe(stage);
  }

  /** Límites de escala y de desplazamiento (el cielo no se pierde de vista). */
  updateExtent() {
    const { w, h } = this.view;
    const fitK = Math.min(w / this.worldSize.w, h / this.worldSize.h);
    this.kMin = Math.max(0.03, Math.min(fitK * 0.7, 0.4));
    const pad = Math.max(this.kMin, 0.05);
    this.behavior.scaleExtent([this.kMin, K_MAX]).translateExtent([
      [(-w * 0.6) / pad, (-h * 0.6) / pad],
      [this.worldSize.w + (w * 0.6) / pad, this.worldSize.h + (h * 0.6) / pad],
    ]);
  }

  /** Tamaño y posición de la capa del <svg> con su margen fuera de la pantalla. */
  private layoutSvg() {
    this.mx = Math.round(this.view.w * OVERSCAN);
    this.my = Math.round(this.view.h * OVERSCAN);
    const st = this.layer.style;
    st.left = `${-this.mx}px`;
    st.top = `${-this.my}px`;
    st.width = `${this.view.w + 2 * this.mx}px`;
    st.height = `${this.view.h + 2 * this.my}px`;
  }

  private apply(t: ZoomTransform) {
    if (this.moving && !("moving" in this.root.dataset)) this.root.dataset.moving = "";
    this.view.x = t.x;
    this.view.y = t.y;
    this.view.k = t.k;
    const c = this.committed;
    const s = c.k > 0 ? t.k / c.k : 0;
    // Desplazamiento de la capa respecto a lo pintado (con la escala s alrededor de su esquina).
    const tx = t.x - s * (c.x + this.mx) + this.mx;
    const ty = t.y - s * (c.y + this.my) + this.my;
    const within =
      this.moving &&
      s >= DRIFT_MIN &&
      s <= DRIFT_MAX &&
      // lo que se ve sigue dentro de lo pintado (margen incluido)
      tx <= this.mx + 1 &&
      ty <= this.my + 1 &&
      tx + (this.view.w + 2 * this.mx) * s - this.mx >= this.view.w - 1 &&
      ty + (this.view.h + 2 * this.my) * s - this.my >= this.view.h - 1;
    if (!within) this.commit(t.x, t.y, t.k);
    else this.layer.style.transform = `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${s.toFixed(5)})`;
    this.emit();
  }

  /** Pinta el cielo a la vista dada: transformación del mundo, escalas y nivel de detalle. */
  private commit(x: number, y: number, k: number, force = false) {
    const c = this.committed;
    const scaleChanged = force || Math.abs(k - c.k) > 1e-9;
    c.x = x;
    c.y = y;
    c.k = k;
    // El <svg> empieza mx/my píxeles antes que la pantalla.
    this.world.setAttribute("transform", `translate(${(x + this.mx).toFixed(2)} ${(y + this.my).toFixed(2)}) scale(${k.toFixed(5)})`);
    if (this.layer.style.transform) this.layer.style.transform = "";
    if (!scaleChanged) return;
    const gs = glyphScale(k);
    this.rules.gs.style.transform = `scale(${gs.toFixed(4)})`;
    this.rules.ts.style.transform = `scale(${(1 / k).toFixed(4)})`;
    this.rules.lu.style.transform = `scale(${(1 / (gs * k)).toFixed(4)})`;
    this.rules.u.style.setProperty("--u", (1 / k).toFixed(5));
    const lod = lodOf(k);
    if (lod !== this.lod || !this.root.dataset.lod) {
      this.lod = lod;
      this.root.dataset.lod = lod;
      for (const l of this.lodListeners) l(lod);
    }
  }

  /** Fin de un gesto o de una animación: consolida y avisa (etiquetas). */
  private settle() {
    this.moving = false;
    delete this.root.dataset.moving;
    const v = this.view;
    const c = this.committed;
    if (Math.abs(v.k - c.k) > 1e-9 || v.x !== c.x || v.y !== c.y) this.commit(v.x, v.y, v.k);
    if (this.endTimer) clearTimeout(this.endTimer);
    this.endTimer = setTimeout(() => {
      this.endTimer = null;
      for (const l of this.endListeners) l(this.view);
    }, 40);
  }

  /** Los superpuestos se recolocan en el mismo fotograma. */
  private emit() {
    for (const l of this.listeners) l(this.view);
  }

  onChange(l: Listener) {
    this.listeners.add(l);
    l(this.view);
    return () => void this.listeners.delete(l);
  }
  onEnd(l: Listener) {
    this.endListeners.add(l);
    return () => void this.endListeners.delete(l);
  }
  onLod(l: (lod: Lod) => void) {
    this.lodListeners.add(l);
    return () => void this.lodListeners.delete(l);
  }

  /** Transformación inmediata (sin animación). */
  set(x: number, y: number, k: number) {
    this.cancelTween();
    this.sel.call(this.behavior.transform, zoomIdentity.translate(x, y).scale(k));
  }

  /** Anima hacia (x, y, k): interpolación del centro en el mundo y de log k. */
  animateTo(x: number, y: number, k: number, ms = 650) {
    this.cancelTween();
    const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const from = { ...this.view };
    if (reduce || ms <= 0) {
      this.set(x, y, k);
      return;
    }
    const cx0 = (from.w / 2 - from.x) / from.k;
    const cy0 = (from.h / 2 - from.y) / from.k;
    const cx1 = (from.w / 2 - x) / k;
    const cy1 = (from.h / 2 - y) / k;
    const lk0 = Math.log(from.k);
    const lk1 = Math.log(k);
    const t0 = performance.now();
    this.tweening = true;
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      const e = easeInOut(p);
      const kk = Math.exp(lk0 + (lk1 - lk0) * e);
      const cx = cx0 + (cx1 - cx0) * e;
      const cy = cy0 + (cy1 - cy0) * e;
      // Cada fotograma cuenta como gesto (d3 emite start/zoom/end en cada llamada).
      this.moving = true;
      this.sel.call(this.behavior.transform, zoomIdentity.translate(from.w / 2 - cx * kk, from.h / 2 - cy * kk).scale(kk));
      if (p < 1) this.tween = requestAnimationFrame(step);
      else {
        this.tween = 0;
        this.tweening = false;
        this.settle();
      }
    };
    this.tween = requestAnimationFrame(step);
  }

  private cancelTween() {
    if (this.tween) cancelAnimationFrame(this.tween);
    this.tween = 0;
    if (this.tweening) {
      this.tweening = false;
      this.settle();
    }
  }

  /** Encaja un rectángulo del mundo en la zona libre `safe` (px de pantalla). */
  fitRect(r: Rect, safe: Rect, opts: { animate?: boolean; maxK?: number; minK?: number } = {}) {
    const sw = Math.max(40, safe.x1 - safe.x0);
    const sh = Math.max(40, safe.y1 - safe.y0);
    const rw = Math.max(1, r.x1 - r.x0);
    const rh = Math.max(1, r.y1 - r.y0);
    let k = Math.min(sw / rw, sh / rh);
    k = Math.max(opts.minK ?? this.kMin, Math.min(opts.maxK ?? K_MAX, k));
    const x = (safe.x0 + safe.x1) / 2 - ((r.x0 + r.x1) / 2) * k;
    const y = (safe.y0 + safe.y1) / 2 - ((r.y0 + r.y1) / 2) * k;
    if (opts.animate === false) this.set(x, y, k);
    else this.animateTo(x, y, k);
  }

  /** Centra un punto del mundo en la zona libre, con la escala dada (o la actual). */
  centerOn(wx: number, wy: number, safe: Rect, k = this.view.k, animate = true) {
    const x = (safe.x0 + safe.x1) / 2 - wx * k;
    const y = (safe.y0 + safe.y1) / 2 - wy * k;
    if (animate) this.animateTo(x, y, k);
    else this.set(x, y, k);
  }

  /** Acerca o aleja respecto al centro de la zona libre. */
  zoomBy(factor: number, safe: Rect) {
    const { x, y, k } = this.view;
    const nk = Math.max(this.kMin, Math.min(K_MAX, k * factor));
    const cx = (safe.x0 + safe.x1) / 2;
    const cy = (safe.y0 + safe.y1) / 2;
    const wx = (cx - x) / k;
    const wy = (cy - y) / k;
    this.animateTo(cx - wx * nk, cy - wy * nk, nk, 320);
  }

  /** Desplaza en píxeles de pantalla (teclado). */
  panBy(dx: number, dy: number) {
    const { x, y, k } = this.view;
    this.animateTo(x + dx, y + dy, k, 180);
  }

  /** Punto del mundo → pantalla. */
  toScreen(wx: number, wy: number) {
    return { x: wx * this.view.k + this.view.x, y: wy * this.view.k + this.view.y };
  }

  get minK() {
    return this.kMin;
  }

  destroy() {
    this.tweening = false;
    if (this.tween) cancelAnimationFrame(this.tween);
    if (this.endTimer) clearTimeout(this.endTimer);
    this.ro.disconnect();
    this.sel.on(".zoom", null);
    this.styleEl.remove();
    this.listeners.clear();
    this.endListeners.clear();
    this.lodListeners.clear();
  }
}
