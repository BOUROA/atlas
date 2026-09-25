// Genera un estado de demostración realista (≈ 11 días de estudio desde el 14-09-2026)
// para ver y probar la interfaz con datos. NUNCA escribe sobre userdata/ real salvo que se pida.
//   node scripts/demo-state.mjs <carpeta-destino> [--hoy 2026-09-24] [--eventos-extra 0] [--rumbo]
// --rumbo añade: la plantilla online (asignaturas sin evaluaciones), settings.courseStart
// y unos intentos de prueba ya corregidos (spec Rumbo §3, §6).
// Crea <carpeta-destino>/state.json con el formato del servidor ({ rev, savedAt, state }).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const args = process.argv.slice(2);
const out = args[0];
if (!out) {
  console.error("Uso: node scripts/demo-state.mjs <carpeta-destino> [--hoy AAAA-MM-DD] [--eventos-extra N] [--rumbo]");
  process.exit(1);
}
if (resolve(out) === resolve("userdata")) {
  console.error("Me niego a escribir sobre userdata/: usa otra carpeta.");
  process.exit(1);
}
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const today = opt("--hoy", "2026-09-24");
const extra = Number(opt("--eventos-extra", "0"));
const rumbo = args.includes("--rumbo");

// PRNG determinista
let seed = 20260924;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

const contentDir = resolve("content");
const subjects = JSON.parse(readFileSync(join(contentDir, "subjects.json"), "utf8"));
const bySubject = Object.fromEntries(subjects.map((s) => [s.id, JSON.parse(readFileSync(join(contentDir, s.file), "utf8"))]));

const at = (day, hour, min = 0) => new Date(`${day}T${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}:00`).toISOString();
const addDays = (day, n) => { const d = new Date(`${day}T12:00:00`); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const days = [];
for (let d = "2026-09-14"; d < today; d = addDays(d, 1)) days.push(d);

let n = 0;
const id = () => `demo-${(n++).toString(36)}`;
const events = [];
const sessions = [];
const seenOn = new Map();

// Conceptos de los temas 0–2 de cada asignatura en orden de temario
const pool = subjects.flatMap((s) => {
  const f = bySubject[s.id];
  const units = new Set(f.units.filter((u) => u.number <= 2).map((u) => u.id));
  return f.concepts.filter((c) => units.has(c.unitId)).sort((a, b) => a.unitId.localeCompare(b.unitId, "es", { numeric: true }) || a.order - b.order);
});
let cursor = 0;

for (const [i, day] of days.entries()) {
  const weekend = [0, 6].includes(new Date(`${day}T12:00:00`).getDay());
  if (day === "2026-09-19") continue; // un sábado sin actividad (lo cubre el comodín)
  // Clase: 6-10 conceptos vistos por la mañana
  const newToday = weekend ? 3 : 6 + Math.floor(rnd() * 5);
  for (let k = 0; k < newToday && cursor < pool.length; k++, cursor++) {
    const c = pool[cursor];
    events.push({ id: id(), at: at(day, 10, k), conceptId: c.id, kind: "seen", source: weekend ? "session" : "class" });
    seenOn.set(c.id, day);
  }
  // Sesión de tarde: repasos de lo visto en días anteriores
  const start = at(day, 18, 0);
  let reviews = 0;
  for (const [cid, seenDay] of seenOn) {
    if (seenDay >= day || rnd() < 0.45) continue;
    const r = rnd();
    const grade = r < 0.1 ? 1 : r < 0.25 ? 2 : r < 0.85 ? 3 : 4;
    events.push({ id: id(), at: at(day, 18, 5 + reviews), conceptId: cid, kind: "review", grade, attempted: true, questionKind: rnd() < 0.3 ? "exercise" : "recall", confidence: grade >= 3 ? 3 : 2, ms: 60000 + Math.floor(rnd() * 90000), source: "session" });
    reviews++;
    if (reviews > 30) break;
  }
  sessions.push({ id: id(), startedAt: start, endedAt: at(day, 19, Math.min(59, 10 + reviews)), reviews, newConcepts: weekend ? newToday : 0, completed: true });
  if (i === 2) events.push({ id: id(), at: at(day, 20), conceptId: pool[0].id, kind: "declared", source: "concept" });
}
for (let k = 0; k < extra; k++) {
  const c = pick(pool);
  events.push({ id: id(), at: at(pick(days), 8 + Math.floor(rnd() * 12), Math.floor(rnd() * 60)), conceptId: c.id, kind: "review", grade: 1 + Math.floor(rnd() * 4), attempted: true, questionKind: "recall", source: "session" });
}
events.sort((a, b) => a.at.localeCompare(b.at));

const now = at(today, 9);
const subjState = (currentUnit, assessments = []) => ({ currentUnit, assessments, updatedAt: now });
const state = {
  version: 2,
  createdAt: at("2026-09-14", 9),
  settings: { dailyMinutes: 150, desiredRetention: 0.9, theme: "dark", targetGrade: 10, updatedAt: now },
  events,
  sessions,
  notes: {
    [pool[1].id]: { text: "Repasar con los ejercicios del boletín 1.", links: [{ label: "Apuntes (PDF)", url: "file:///C:/Apuntes/tema1.pdf" }], updatedAt: now },
  },
  subjects: {
    calculo: subjState(2, [
      { id: "cal-p1", title: "Parcial 1", kind: "parcial", date: "2026-10-17", weight: 30, unitIds: ["calculo.t1", "calculo.t2", "calculo.t3"] },
      { id: "cal-f", title: "Examen final", kind: "final", date: "2027-01-14", weight: 70, unitIds: [] },
    ]),
    logica: subjState(2, [
      { id: "log-t1", title: "Test del tema 2", kind: "parcial", date: "2026-09-29", weight: 10, unitIds: ["logica.t1", "logica.t2"] },
      { id: "log-f", title: "Examen final", kind: "final", date: "2027-01-19", weight: 90, unitIds: [] },
    ]),
    programacion: subjState(2, [
      { id: "fp-pr1", title: "Práctica 1", kind: "entrega", date: "2026-10-03", weight: 20, unitIds: ["programacion.t1", "programacion.t2"] },
      { id: "fp-f", title: "Examen final", kind: "final", date: "2027-01-12", weight: 80, unitIds: [] },
    ]),
    algebra: subjState(2, [{ id: "alg-e1", title: "Entrega 1", kind: "entrega", date: "2026-10-06", weight: 15, grade: undefined, unitIds: ["algebra.t1", "algebra.t2"] }]),
    ia: subjState(1, [{ id: "ia-c1", title: "Cuestionario 1", kind: "parcial", date: "2026-09-18", weight: 10, grade: 9.6, unitIds: ["ia.t1"] }]),
  },
  achievements: {},
  seen: { achievements: [], levelShown: 1 },
  expeditions: {},
};

// ───── --rumbo: plantilla online, inicio de curso y unos intentos de prueba (spec §3, §6, §7) ─────
let rumboSummary = "";
if (rumbo) {
  state.settings.courseStart = "2026-10-21";

  // Días laborables del 8 al 19 de febrero de 2027, uno por asignatura (mismo criterio que
  // src/domain/calendar-template.ts: el índice es la posición en subjects.json, no un contador
  // aparte de las asignaturas sin evaluaciones).
  const businessDays = (startDay, endDay) => {
    const days = [];
    for (let d = startDay; d <= endDay; d = addDays(d, 1)) {
      const dow = new Date(`${d}T12:00:00`).getDay();
      if (dow !== 0 && dow !== 6) days.push(d);
    }
    return days;
  };
  const TEMPLATE_FINAL_DAYS = businessDays("2027-02-08", "2027-02-19");

  let filled = 0;
  subjects.forEach((s, i) => {
    const existing = state.subjects[s.id];
    if (existing && existing.assessments.length > 0) return; // ya tiene evaluaciones reales
    const unitIds = bySubject[s.id].units.map((u) => u.id);
    const day = TEMPLATE_FINAL_DAYS[Math.min(i, TEMPLATE_FINAL_DAYS.length - 1)];
    state.subjects[s.id] = subjState(existing?.currentUnit ?? 1, [
      { id: `${s.id}.plantilla.continua`, title: "Evaluación continua", kind: "entrega", weight: 40, unitIds, template: true },
      { id: `${s.id}.plantilla.final`, title: "Examen final", kind: "final", date: day, weight: 60, unitIds, template: true },
    ]);
    filled++;
  });

  // Unos intentos de prueba ya corregidos (Cálculo), con nota realista: uno por debajo de 7
  // y una prueba repetida. Repartidos en earned por problema a partir de sus puntos.
  const loadTrials = (subjectId) => {
    try {
      return JSON.parse(readFileSync(join(contentDir, "trials", `${subjectId}.json`), "utf8")).trials ?? [];
    } catch {
      return [];
    }
  };
  const earnedForScore = (trial, score) => {
    const total = trial.problems.reduce((sum, p) => sum + p.points, 0);
    const desired = (total * score) / 10;
    const earned = {};
    let used = 0;
    trial.problems.forEach((p, i) => {
      const v = i === trial.problems.length - 1
        ? Math.max(0, Math.min(p.points, Math.round((desired - used) * 100) / 100))
        : Math.max(0, Math.min(p.points, Math.round(p.points * (score / 10) * 100) / 100));
      earned[p.n] = v;
      used += v;
    });
    return earned;
  };
  const calcTrials = Object.fromEntries(loadTrials("calculo").map((t) => [t.id, t]));
  const trialAttempts = {};
  let trialCount = 0;
  const addTrialAttempt = (trialId, score, daysBeforeToday, hour = 17) => {
    const trial = calcTrials[trialId];
    if (!trial) return;
    const day = addDays(today, -daysBeforeToday);
    const attempt = { id: id(), startedAt: at(day, hour), endedAt: at(day, hour, 45), earned: earnedForScore(trial, score) };
    (trialAttempts[trialId] ??= []).push(attempt);
    trialCount++;
  };
  addTrialAttempt("calculo.control.t0", 9.2, 9);
  addTrialAttempt("calculo.control.t1", 6.2, 7); // primer intento: por debajo de 7
  addTrialAttempt("calculo.control.t1", 8.4, 4); // repetida: aprobada
  addTrialAttempt("calculo.control.t2", 7.8, 2);
  if (trialCount > 0) state.trials = trialAttempts;

  rumboSummary = ` · rumbo: ${filled} asignaturas con plantilla, ${trialCount} intentos de prueba`;
}

mkdirSync(out, { recursive: true });
writeFileSync(join(out, "state.json"), JSON.stringify({ rev: 1, savedAt: now, state }, null, 2));
console.log(`Estado de demostración en ${join(out, "state.json")}: ${events.length} eventos, ${sessions.length} sesiones, ${seenOn.size} conceptos vistos${rumboSummary}.`);
