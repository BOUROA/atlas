// node scripts/validate-notes.cjs [fichero…]
// Valida los apuntes de content/apuntes/<asignatura>/<unidad>.md (ver
// docs/apuntes-guia.md): unidad existente, título, KaTeX que compila, Markdown
// que Atlas sabe pintar, tildes y cobertura de los conceptos de la unidad.
const fs = require('fs');
const path = require('path');
const katex = require('katex');

const root = path.join(__dirname, '..');
const content = path.join(root, 'content');
const notesDir = path.join(content, 'apuntes');
const subjects = JSON.parse(fs.readFileSync(path.join(content, 'subjects.json'), 'utf8'));
const units = new Map();
const conceptsByUnit = new Map();
for (const s of subjects) {
  const f = JSON.parse(fs.readFileSync(path.join(content, s.file), 'utf8'));
  for (const u of f.units) units.set(u.id, { ...u, subjectId: s.id });
  for (const c of f.concepts) {
    if (!conceptsByUnit.has(c.unitId)) conceptsByUnit.set(c.unitId, []);
    conceptsByUnit.get(c.unitId).push(c);
  }
}

const files = process.argv.slice(2).length
  ? process.argv.slice(2).map((f) => path.resolve(f))
  : fs.existsSync(notesDir)
    ? fs.readdirSync(notesDir).flatMap((d) => {
        const dir = path.join(notesDir, d);
        return fs.statSync(dir).isDirectory() ? fs.readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => path.join(dir, f)) : [];
      })
    : [];

let errors = 0, warnings = 0;
const err = (m) => { errors++; console.log('  ERROR ' + m); };
const warn = (m) => { warnings++; console.log('  aviso ' + m); };

const stripCode = (s) => s.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`\n]+`/g, ' ');
const stripMath = (s) => s.replace(/\$\$[\s\S]+?\$\$/g, ' ').replace(/\$[^$\n]+\$/g, ' ');

function checkTex(md) {
  let s = stripCode(md).replace(/\\\$/g, ' ');
  const segs = [];
  s = s.replace(/\$\$([\s\S]+?)\$\$/g, (_, m) => { segs.push([m, true]); return ' '; });
  s.replace(/\$(?!\s)([^$\n]+?)(?<!\s)\$(?!\d)/g, (_, m) => { segs.push([m, false]); return ' '; });
  for (const [m, display] of segs) {
    try { katex.renderToString(m, { throwOnError: true, displayMode: display, strict: 'ignore' }); }
    catch (e) { err(`KaTeX no compila «${m.slice(0, 60)}»: ${String(e.message).split('\n')[0]}`); }
  }
  s.split('\n').forEach((line, i) => {
    const rest = line.replace(/\$(?!\s)([^$\n]+?)(?<!\s)\$(?!\d)/g, ' ');
    if (/\$/.test(rest)) warn(`$ suelto cerca de «${line.trim().slice(0, 60)}» (¿espacio junto al $ o fórmula sin cerrar?)`);
  });
}

// Palabras que en español llevan tilde: su forma sin tilde delata texto escrito sin acentos.
const UNACCENTED = /\b(logica|formulas?|deduccion|conclusion|proposicion|semantica|interpretacion|demostracion|tambien|ademas|despues|asi|segun|numeros?|metodos?|ultim[oa]s?|algun|analisis|arbol(es)?|matematic[oa]s?|(func|soluc|condic|operac|derivac|formalizac|sustituc|negac|conjunc|disyunc|implicac|introducc|eliminac|reducc|definic)ion)\b/i;

for (const file of files) {
  const rel = path.relative(root, file);
  console.log(rel);
  const md = fs.readFileSync(file, 'utf8');
  const unitId = path.basename(file, '.md');
  const subjectId = path.basename(path.dirname(file));
  const unit = units.get(unitId);
  if (!unit) { err(`«${unitId}» no es una unidad del catálogo`); continue; }
  if (unit.subjectId !== subjectId) err(`la unidad ${unitId} es de ${unit.subjectId}, no de ${subjectId}`);

  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const title = lines[0] || '';
  if (!new RegExp(`^# Tema ${unit.number} · \\S`).test(title)) err(`la primera línea debe ser «# Tema ${unit.number} · Título» (es «${title.slice(0, 60)}»)`);
  if (lines.slice(1).some((l) => /^# /.test(l))) err('solo puede haber un título «# » (el de la primera línea)');

  let inFence = false;
  const sections = [];
  lines.forEach((l, i) => {
    if (/^```/.test(l.trim())) inFence = !inFence;
    if (inFence) return;
    if (/^## /.test(l)) sections.push(l.slice(3).trim());
    if (/^#### /.test(l)) warn(`línea ${i + 1}: «####» no se distingue de «###»; usa ## o ###`);
    if (/^\s{2,}([-*+]|\d+[.)])\s/.test(l)) warn(`línea ${i + 1}: lista anidada; Atlas no anida listas`);
    if (/<\/?[a-zA-Z][a-zA-Z0-9]*(\s[^>]*)?>/.test(stripMath(stripCode(l)))) warn(`línea ${i + 1}: HTML; Atlas lo muestra como texto`);
    if (/!\[[^\]]*\]\(/.test(l)) warn(`línea ${i + 1}: imagen; Atlas no pinta imágenes`);
  });
  const dup = sections.filter((s, i) => sections.indexOf(s) !== i);
  if (dup.length) err(`secciones ## repetidas: ${[...new Set(dup)].join(', ')}`);
  for (const need of ['Chuleta', 'Ejercicios resueltos', 'Antes del control']) {
    if (!sections.includes(need)) warn(`falta la sección «## ${need}»`);
  }

  checkTex(md);

  const prose = stripMath(stripCode(md));
  const acc = prose.match(new RegExp(UNACCENTED.source, 'gi'));
  if (acc) warn(`sin tilde: ${[...new Set(acc.map((w) => w.toLowerCase()))].join(', ')}`);

  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const text = norm(md);
  for (const c of conceptsByUnit.get(unitId) || []) {
    const names = [c.name, ...(c.aliases || [])].map((n) => norm(n.replace(/\s*\(.*\)\s*$/, '').trim())).filter(Boolean);
    if (!names.some((n) => text.includes(n))) warn(`no se nombra el concepto ${c.id} («${c.name}»)`);
  }

  const words = prose.split(/\s+/).filter((w) => /[a-záéíóúñ]/i.test(w)).length;
  console.log(`  ${sections.length} secciones, ~${words} palabras, ~${Math.max(1, Math.round(words / 200))} min de lectura`);
}

console.log(`\n${files.length} ficheros · ${errors} errores · ${warnings} avisos`);
process.exit(errors ? 1 : 0);
