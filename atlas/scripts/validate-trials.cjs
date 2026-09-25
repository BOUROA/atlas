// node scripts/validate-trials.cjs [fichero…]
// Valida las pruebas sintéticas de content/trials/*.json (ver
// docs/superpowers/specs/2026-09-24-rumbo-pruebas-design.md §4).
const fs = require('fs');
const path = require('path');
const katex = require('katex');

const root = path.join(__dirname, '..');
const content = path.join(root, 'content');
const subjects = JSON.parse(fs.readFileSync(path.join(content, 'subjects.json'), 'utf8'));
const conceptIds = new Set();
const unitsBySubject = new Map();
for (const s of subjects) {
  const f = JSON.parse(fs.readFileSync(path.join(content, s.file), 'utf8'));
  unitsBySubject.set(s.id, f.units.map((u) => u.id));
  for (const c of f.concepts) conceptIds.add(c.id);
}
const conceptUnit = new Map();
for (const s of subjects) {
  const f = JSON.parse(fs.readFileSync(path.join(content, s.file), 'utf8'));
  for (const c of f.concepts) conceptUnit.set(c.id, c.unitId);
}

const trialsDir = path.join(content, 'trials');
const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : fs.existsSync(trialsDir) ? fs.readdirSync(trialsDir).filter((f) => f.endsWith('.json')).map((f) => path.join(trialsDir, f)) : [];

const KINDS = ['control', 'parcial', 'final'];
const near = (a, b) => Math.abs(a - b) < 0.011;
let errors = 0, warnings = 0;
const err = (m) => { errors++; console.log('  ERROR ' + m); };
const warn = (m) => { warnings++; console.log('  aviso ' + m); };

function checkTex(where, md) {
  if (typeof md !== 'string') return;
  let s = md.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`\n]+`/g, ' ').replace(/\\\$/g, ' ');
  const segs = [];
  s = s.replace(/\$\$([\s\S]+?)\$\$/g, (_, m) => { segs.push([m, true]); return ' '; });
  s.replace(/\\\((.+?)\\\)/g, (_, m) => { segs.push([m, false]); return ' '; });
  s.replace(/\$(?!\s)([^$\n]+?)(?<!\s)\$(?!\d)/g, (_, m) => { segs.push([m, false]); return ' '; });
  for (const [m, display] of segs) {
    try { katex.renderToString(m, { throwOnError: true, displayMode: display, strict: 'ignore' }); }
    catch (e) { err(`${where}: KaTeX no compila «${m.slice(0, 60)}»: ${String(e.message).split('\n')[0]}`); }
  }
  const leftover = s.replace(/\$(?!\s)([^$\n]+?)(?<!\s)\$(?!\d)/g, ' ');
  if (/\$/.test(leftover)) warn(`${where}: queda un $ suelto (¿fórmula mal cerrada?)`);
}

// Palabras que en español llevan tilde: su forma sin tilde delata texto escrito sin acentos.
const UNACCENTED = /\b(arbol(es)?|raiz|indices?|numeros?|metodos?|ultim[oa]s?|busquedas?|lapidas?|paginas?|limites?|matematic[oa]s?|despues|tambien|algun|analisis|(func|soluc|posic|condic|ejecuc|eliminac|inserc|operac|demostrac|derivac)ion)\b/i;
function checkSpelling(where, md) {
  if (typeof md !== 'string') return;
  const prose = md.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`\n]+`/g, ' ').replace(/\$\$[\s\S]+?\$\$/g, ' ').replace(/\$[^$\n]+\$/g, ' ');
  const m = prose.match(UNACCENTED);
  if (m) warn(`${where}: «${m[0]}» sin tilde (¿texto escrito sin acentos?)`);
}

for (const file of files) {
  console.log(path.relative(root, file));
  let data;
  try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { err(`JSON no válido: ${e.message}`); continue; }
  const sid = data.subjectId;
  const units = unitsBySubject.get(sid);
  if (!units) { err(`subjectId desconocido ${sid}`); continue; }
  if (!Array.isArray(data.trials)) { err('falta trials[]'); continue; }
  const ids = new Set();
  const controlsByUnit = new Map();
  for (const t of data.trials) {
    const w = t.id || '(sin id)';
    if (!t.id || !t.id.startsWith(sid + '.')) err(`${w}: el id debe empezar por ${sid}.`);
    if (ids.has(t.id)) err(`${w}: id duplicado`);
    ids.add(t.id);
    if (!KINDS.includes(t.kind)) err(`${w}: kind no válido ${t.kind}`);
    if (![1, 2, 3, 4].includes(t.level)) err(`${w}: level no válido ${t.level}`);
    if (!t.title) err(`${w}: falta title`);
    if (!t.rules) warn(`${w}: sin rules`);
    if (!(t.durationMin >= 10 && t.durationMin <= 240)) err(`${w}: durationMin fuera de rango`);
    if (!Array.isArray(t.unitIds) || t.unitIds.length === 0) err(`${w}: unitIds vacío`);
    for (const u of t.unitIds || []) if (!units.includes(u)) err(`${w}: tema desconocido ${u}`);
    if (t.kind === 'control') {
      if ((t.unitIds || []).length !== 1) err(`${w}: un control cubre exactamente 1 tema`);
      else controlsByUnit.set(t.unitIds[0], (controlsByUnit.get(t.unitIds[0]) || 0) + 1);
    }
    if (!Array.isArray(t.problems) || t.problems.length === 0) { err(`${w}: sin problemas`); continue; }
    const ns = new Set();
    let total = 0;
    const covered = new Set();
    for (const p of t.problems) {
      const pw = `${w} #${p.n}`;
      if (!p.n || ns.has(p.n)) err(`${pw}: n vacío o duplicado`);
      ns.add(p.n);
      if (!(p.points > 0)) err(`${pw}: points debe ser > 0`);
      total += p.points || 0;
      if (![1, 2, 3, 4].includes(p.difficulty)) err(`${pw}: difficulty no válida`);
      if (!Array.isArray(p.concepts) || p.concepts.length === 0) err(`${pw}: sin conceptos`);
      for (const c of p.concepts || []) {
        if (!conceptIds.has(c)) err(`${pw}: concepto desconocido ${c}`);
        else covered.add(conceptUnit.get(c));
      }
      if (t.kind === 'control' && (t.unitIds || []).length === 1 && !(p.concepts || []).some((c) => conceptUnit.get(c) === t.unitIds[0]))
        warn(`${pw}: ningún concepto del tema del control`);
      if (!p.statement || p.statement.length < 20) err(`${pw}: statement vacío o muy corto`);
      if (!p.solution || p.solution.length < 40) err(`${pw}: solution vacía o muy corta`);
      if (!Array.isArray(p.rubric) || p.rubric.length === 0) err(`${pw}: sin rúbrica`);
      else {
        const rs = p.rubric.reduce((a, r) => a + (r.points || 0), 0);
        if (!near(rs, p.points)) err(`${pw}: la rúbrica suma ${rs} y el problema vale ${p.points}`);
        for (const r of p.rubric) if (!r.text || !(r.points > 0)) err(`${pw}: criterio de rúbrica sin texto o sin puntos`);
      }
      if (p.pitfalls !== undefined && !Array.isArray(p.pitfalls)) err(`${pw}: pitfalls debe ser una lista`);
      for (const [label, text] of [['enunciado', p.statement], ['solución', p.solution], ...(p.rubric || []).map((r) => ['rúbrica', r.text]), ...(p.pitfalls || []).map((f) => ['errores típicos', f])])
        checkSpelling(`${pw} ${label}`, text);
      checkTex(`${pw} enunciado`, p.statement);
      checkTex(`${pw} solución`, p.solution);
      for (const r of p.rubric || []) checkTex(`${pw} rúbrica`, r.text);
      for (const f of p.pitfalls || []) checkTex(`${pw} errores típicos`, f);
    }
    if (!near(total, 10)) err(`${w}: los puntos suman ${total}, deben sumar 10`);
    if (t.kind !== 'control') for (const u of t.unitIds || []) if (!covered.has(u)) warn(`${w}: ningún problema evalúa el tema ${u}`);
  }
  for (const u of units) {
    const n = controlsByUnit.get(u) || 0;
    if (n === 0) warn(`falta el control del tema ${u}`);
    if (n > 1) err(`hay ${n} controles del tema ${u}`);
  }
  console.log(`  ${data.trials.length} pruebas, ${data.trials.reduce((a, t) => a + (t.problems || []).length, 0)} problemas`);
}
console.log(`\n${errors} errores, ${warnings} avisos`);
process.exit(errors ? 1 : 0);
