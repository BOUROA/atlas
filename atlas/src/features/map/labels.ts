// Colocación de etiquetas sin solapes (voraz por prioridad, en píxeles de
// pantalla). Se ejecuta al terminar un gesto, al cambiar de nivel de detalle y
// al cambiar la selección o la lente; nunca en cada fotograma.
import type { Rect, View } from "./view";

export type LabelSlot = {
  /** Desplazamiento de la esquina superior izquierda de la caja respecto al ancla (px). */
  dx: number;
  dy: number;
  w: number;
  h: number;
  /** Valor que recibe data-pos en el elemento. */
  pos: string;
};

export type LabelCand = {
  id: string;
  wx: number;
  wy: number;
  prio: number;
  slots: LabelSlot[];
  /** Se coloca aunque choque (seleccionado). */
  force?: boolean;
};

const CELL = 48;

export type Placed = { pos: string; shift: number };

/**
 * Devuelve id → posición de las etiquetas que caben, en orden de prioridad.
 * Una etiqueta que se saldría por un lado de la pantalla se desplaza hacia
 * dentro (`shift`, en px) antes de probar si choca.
 */
export function placeLabels(cands: LabelCand[], view: View, obstacles: Rect[] = [], margin = 80): Map<string, Placed> {
  const out = new Map<string, Placed>();
  const grid = new Map<number, Rect[]>();
  const key = (cx: number, cy: number) => cx * 4096 + cy;
  const cellsOf = (r: Rect, fn: (k: number) => boolean | void) => {
    const cx0 = Math.floor(r.x0 / CELL);
    const cx1 = Math.floor(r.x1 / CELL);
    const cy0 = Math.floor(r.y0 / CELL);
    const cy1 = Math.floor(r.y1 / CELL);
    for (let cx = cx0; cx <= cx1; cx++) for (let cy = cy0; cy <= cy1; cy++) if (fn(key(cx + 2048, cy + 2048)) === true) return true;
    return false;
  };
  const hits = (r: Rect) =>
    cellsOf(r, (k) => {
      const list = grid.get(k);
      if (!list) return;
      for (const o of list) if (r.x0 < o.x1 && r.x1 > o.x0 && r.y0 < o.y1 && r.y1 > o.y0) return true;
    });
  const add = (r: Rect) =>
    cellsOf(r, (k) => {
      const list = grid.get(k);
      if (list) list.push(r);
      else grid.set(k, [r]);
    });
  const { x, y, k, w, h } = view;
  // Las zonas vetadas se recortan a la pantalla (una franja "infinita" recorrería millones de celdas).
  const clip = (r: Rect): Rect => ({
    x0: Math.max(r.x0, -margin - CELL),
    y0: Math.max(r.y0, -margin - CELL),
    x1: Math.min(r.x1, w + margin + CELL),
    y1: Math.min(r.y1, h + margin + CELL),
  });
  for (const o of obstacles) {
    const r = clip(o);
    if (r.x1 > r.x0 && r.y1 > r.y0) add(r);
  }

  const sorted = [...cands].sort((a, b) => b.prio - a.prio);
  for (const c of sorted) {
    const sx = c.wx * k + x;
    const sy = c.wy * k + y;
    if (!c.force && (sx < -margin || sx > w + margin || sy < -margin || sy > h + margin)) continue;
    let placed = false;
    for (const s of c.slots) {
      let shift = 0;
      const left = sx + s.dx;
      const right = left + s.w;
      if (left < 6 && right < w - 6) shift = Math.min(6 - left, w - 6 - right);
      else if (right > w - 6 && left > 6) shift = Math.max(w - 6 - right, 6 - left);
      const r = { x0: left + shift - 2, y0: sy + s.dy - 1, x1: right + shift + 2, y1: sy + s.dy + s.h + 1 };
      if (!hits(r)) {
        add(clip(r));
        out.set(c.id, { pos: s.pos, shift: Math.round(shift) });
        placed = true;
        break;
      }
    }
    // La forzada (seleccionada): si no cabe, se prueba desplazada a los lados…
    if (!placed && c.force) {
      for (const s of c.slots) {
        for (const d of [-40, 40, -80, 80, -130, 130, -190, 190]) {
          const left = sx + s.dx + d;
          if (left < 6 || left + s.w > w - 6) continue;
          const r = { x0: left - 2, y0: sy + s.dy - 1, x1: left + s.w + 2, y1: sy + s.dy + s.h + 1 };
          if (hits(r)) continue;
          add(clip(r));
          out.set(c.id, { pos: s.pos, shift: d });
          placed = true;
          break;
        }
        if (placed) break;
      }
    }
    // …y si aun así choca, se queda en su primer hueco.
    if (!placed && c.force && c.slots[0]) {
      const s0 = c.slots[0];
      const left = sx + s0.dx;
      const shift = left < 6 ? 6 - left : left + s0.w > w - 6 ? w - 6 - left - s0.w : 0;
      add(clip({ x0: left + shift, y0: sy + s0.dy, x1: left + shift + s0.w, y1: sy + s0.dy + s0.h }));
      out.set(c.id, { pos: s0.pos, shift: Math.round(shift) });
    }
  }
  return out;
}

/** Aplica el resultado a los elementos (data-show / data-pos), sin pasar por React. */
export function applyLabels(els: Iterable<SVGElement>, placed: Map<string, Placed>, attr = "lid") {
  for (const el of els) {
    const id = el.dataset[attr];
    if (!id) continue;
    const p = placed.get(id);
    if (p) {
      if (el.dataset.pos !== p.pos) el.dataset.pos = p.pos;
      const lx = `${p.shift}px`;
      if (el.style.getPropertyValue("--lx") !== lx) el.style.setProperty("--lx", lx);
      if (!("show" in el.dataset)) el.dataset.show = "";
    } else if ("show" in el.dataset) delete el.dataset.show;
  }
}
