// node validate-all.cjs <dir>  (dir contiene subjects.json y <slug>.json)
const fs = require('fs');
const path = require('path');
const { checkConcept } = require('./lib-check.cjs');
const dir = process.argv[2];
const errors = [], warnings = [];
const subjects = JSON.parse(fs.readFileSync(path.join(dir, 'subjects.json'), 'utf8'));
const concepts = new Map(), units = new Map(), rels = [];
for (const s of subjects) {
  const f = JSON.parse(fs.readFileSync(path.join(dir, s.file), 'utf8'));
  if (f.subjectId !== s.id) errors.push(`${s.file}: subjectId no coincide`);
  for (const u of f.units) {
    if (units.has(u.id)) errors.push(`tema duplicado ${u.id}`);
    if (!u.id.startsWith(s.id + '.t')) errors.push(`tema ${u.id}: el id debe empezar por ${s.id}.t`);
    units.set(u.id, { ...u, subjectId: s.id });
  }
  for (const c of f.concepts) {
    if (concepts.has(c.id)) errors.push(`concepto duplicado ${c.id}`);
    concepts.set(c.id, { ...c, subjectId: s.id });
    checkConcept(c, errors, warnings);
    if (!units.has(c.unitId) || units.get(c.unitId).subjectId !== s.id) errors.push(`${c.id}: unitId ${c.unitId} no pertenece a ${s.id}`);
  }
  for (const r of f.relations) rels.push({ ...r, file: s.file });
}
const subjectIds = new Set(subjects.map((s) => s.id));
for (const c of concepts.values())
  for (const a of c.alsoIn || [])
    if (!subjectIds.has(a.subjectId) || a.subjectId === c.subjectId) errors.push(`${c.id}: alsoIn no válido (${a.subjectId})`);
const seen = new Set();
for (const r of rels) {
  if (!concepts.has(r.source)) errors.push(`relación con source desconocido ${r.source} (${r.file})`);
  if (!concepts.has(r.target)) errors.push(`relación con target desconocido ${r.target} (${r.file})`);
  if (concepts.get(r.source) && concepts.get(r.source).subjectId + '.json' !== r.file) errors.push(`relación ${r.source}→${r.target} debe estar en el fichero de su source`);
  if (!['requires', 'related'].includes(r.type)) errors.push(`relación ${r.source}→${r.target}: type no válido`);
  if (r.source === r.target) errors.push(`relación reflexiva ${r.source}`);
  const k = `${r.source}|${r.type}|${r.target}`;
  if (seen.has(k)) errors.push(`relación duplicada ${k}`);
  seen.add(k);
  if (!r.reason || r.reason.split(/\s+/).length > 30) warnings.push(`relación ${k}: reason vacío o largo`);
}
const adj = new Map();
for (const r of rels) if (r.type === 'requires') { if (!adj.has(r.source)) adj.set(r.source, []); adj.get(r.source).push(r.target); }
const state = new Map(); const cycles = [];
function dfs(v, stack) {
  state.set(v, 1); stack.push(v);
  for (const w of adj.get(v) ?? []) {
    if (state.get(w) === 1) cycles.push([...stack.slice(stack.indexOf(w)), w].join(' → '));
    else if (!state.get(w)) dfs(w, stack);
  }
  stack.pop(); state.set(v, 2);
}
for (const v of concepts.keys()) if (!state.get(v)) dfs(v, []);
for (const c of cycles.slice(0, 30)) errors.push(`ciclo en requires: ${c}`);
const years = Object.fromEntries(subjects.map((s) => [s.id, s.year]));
for (const r of rels)
  if (r.type === 'requires' && concepts.has(r.source) && concepts.has(r.target) && years[concepts.get(r.target).subjectId] > years[concepts.get(r.source).subjectId])
    warnings.push(`requisito de curso posterior: ${r.source} → ${r.target}`);
const touched = new Set(rels.filter((r) => r.type === 'requires').flatMap((r) => [r.source, r.target]));
const isolated = [...concepts.keys()].filter((id) => !touched.has(id));
if (isolated.length) warnings.push(`${isolated.length} conceptos sin ninguna relación requires: ${isolated.slice(0, 20).join(', ')}${isolated.length > 20 ? '…' : ''}`);
const perSubject = Object.fromEntries(subjects.map((s) => [s.id, [...concepts.values()].filter((c) => c.subjectId === s.id).length]));
for (const e of errors) console.log('ERROR', e);
for (const w of warnings) console.log('AVISO', w);
console.log('Conceptos por asignatura:', JSON.stringify(perSubject));
console.log(`${concepts.size} conceptos · ${units.size} temas · ${rels.length} relaciones · ${errors.length} errores · ${warnings.length} avisos`);
process.exit(errors.length ? 1 : 0);
