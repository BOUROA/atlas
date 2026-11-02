// node scripts/validate-notes.cjs [fichero…]
// Valida los apuntes de content/apuntes/<asignatura>/<unidad>.md (ver
// docs/apuntes-guia.md): unidad existente, título, KaTeX que compila, Markdown
// que Atlas sabe pintar, estructura de la guía, tildes y cobertura de los
// conceptos de la unidad. `checkNote` se exporta para los tests.
const fs = require('fs');
const path = require('path');
const katex = require('katex');

const stripCode = (s) => s.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`\n]+`/g, ' ');
const stripMath = (s) => s.replace(/\$\$[\s\S]+?\$\$/g, ' ').replace(/\$[^$\n]+\$/g, ' ');

function checkTex(md, err, warn) {
  let s = stripCode(md).replace(/\\\$/g, ' ');
  const segs = [];
  s = s.replace(/\$\$([\s\S]+?)\$\$/g, (_, m) => { segs.push([m, true]); return ' '; });
  s.replace(/\$(?!\s)([^$\n]+?)(?<!\s)\$(?!\d)/g, (_, m) => { segs.push([m, false]); return ' '; });
  for (const [m, display] of segs) {
    try { katex.renderToString(m, { throwOnError: true, displayMode: display, strict: 'ignore' }); }
    catch (e) { err(`KaTeX no compila «${m.slice(0, 60)}»: ${String(e.message).split('\n')[0]}`); }
  }
  s.split('\n').forEach((line) => {
    const rest = line.replace(/\$(?!\s)([^$\n]+?)(?<!\s)\$(?!\d)/g, ' ');
    if (/\$/.test(rest)) warn(`$ suelto cerca de «${line.trim().slice(0, 60)}» (¿espacio junto al $ o fórmula sin cerrar?)`);
  });
}

// Palabras que en español llevan tilde: su forma sin tilde delata texto escrito sin acentos.
// Límites con lookarounds Unicode y no con `\b`, que no entiende letras acentuadas
// y cazaría «funcion» dentro de «funcionó».
const UNACCENTED = /(?<![\p{L}\p{N}])(logica|formulas?|deduccion|conclusion|proposicion|semantica|interpretacion|demostracion|tambien|ademas|despues|asi|segun|numeros?|metodos?|ultim[oa]s?|algun|analisis|arbol(es)?|matematic[oa]s?|(func|soluc|condic|operac|derivac|formalizac|sustituc|negac|conjunc|disyunc|implicac|introducc|eliminac|reducc|definic)ion)(?![\p{L}\p{N}])/iu;

// Rótulos de llamada de la guía (los pinta CALLOUT_CLASS en src/features/notes/NotesScreen.tsx).
const CALLOUT_LABELS = ['idea clave', 'error típico', 'ojo', 'truco'];

/**
 * Valida el Markdown de unos apuntes. `unit` es la unidad del catálogo (se usa
 * `number`) y `concepts`, sus conceptos. Devuelve los mensajes en orden
 * ({ level: 'error' | 'aviso', msg }), las secciones ## y las palabras.
 */
function checkNote(md, { unit, concepts = [] }) {
  const messages = [];
  const err = (msg) => messages.push({ level: 'error', msg });
  const warn = (msg) => messages.push({ level: 'aviso', msg });

  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const title = lines[0] || '';
  if (!new RegExp(`^# Tema ${unit.number} · \\S`).test(title)) err(`la primera línea debe ser «# Tema ${unit.number} · Título» (es «${title.slice(0, 60)}»)`);
  if (lines.slice(1).some((l) => /^# /.test(l))) err('solo puede haber un título «# » (el de la primera línea)');

  let inFence = false;
  let section = null;
  let cases = 0, checks = 0;
  const sections = [];
  lines.forEach((l, i) => {
    if (/^```/.test(l.trim())) {
      if (!inFence) warn(`línea ${i + 1}: bloque de código; los apuntes van sin código (nombres en \`código en línea\`)`);
      inFence = !inFence;
      return;
    }
    if (inFence) return;
    if (/^## /.test(l)) { section = l.slice(3).trim(); sections.push(section); }
    if (/^#### /.test(l)) warn(`línea ${i + 1}: «####» no se distingue de «###»; usa ## o ###`);
    if (/^\s{2,}([-*+]|\d+[.)])\s/.test(l)) warn(`línea ${i + 1}: lista anidada; Atlas no anida listas`);
    if (/<\/?[a-zA-Z][a-zA-Z0-9]*(\s[^>]*)?>/.test(stripMath(stripCode(l)))) warn(`línea ${i + 1}: HTML; Atlas lo muestra como texto`);
    if (/!\[[^\]]*\]\(/.test(l)) warn(`línea ${i + 1}: imagen; Atlas no pinta imágenes`);
    const callout = /^>\s*\*\*([^*]+)\*\*/.exec(l);
    if (callout) {
      const label = callout[1].trim().replace(/[.:]+$/, '');
      if (!CALLOUT_LABELS.includes(label.toLowerCase())) warn(`línea ${i + 1}: rótulo de llamada «${label}» desconocido; usa Idea clave, Error típico, Ojo o Truco`);
    }
    if (section === 'Casos prácticos' && /^### Caso \d+ · \S/.test(l)) cases++;
    if (section === 'Antes de seguir' && /^([-*+]|\d+[.)])\s+Sé\s/.test(l)) checks++;
  });
  const dup = sections.filter((s, i) => sections.indexOf(s) !== i);
  if (dup.length) err(`secciones ## repetidas: ${[...new Set(dup)].join(', ')}`);
  for (const need of ['Chuleta', 'Casos prácticos', 'Antes de seguir']) {
    if (!sections.includes(need)) warn(`falta la sección «## ${need}»`);
  }
  if (sections.includes('Casos prácticos') && (cases < 4 || cases > 6)) warn(`«## Casos prácticos» tiene ${cases} casos «### Caso N · …»; la guía pide 4–6`);
  if (sections.includes('Antes de seguir') && (checks < 6 || checks > 10)) warn(`«## Antes de seguir» tiene ${checks} comprobaciones «Sé …»; la guía pide 6–10`);

  checkTex(md, err, warn);

  const prose = stripMath(stripCode(md));
  const acc = prose.match(new RegExp(UNACCENTED.source, 'giu'));
  if (acc) warn(`sin tilde: ${[...new Set(acc.map((w) => w.toLowerCase()))].join(', ')}`);

  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const text = norm(md);
  for (const c of concepts) {
    const names = [c.name, ...(c.aliases || [])].map((n) => norm(n.replace(/\s*\(.*\)\s*$/, '').trim())).filter(Boolean);
    if (!names.some((n) => text.includes(n))) warn(`no se nombra el concepto ${c.id} («${c.name}»)`);
  }

  const words = prose.split(/\s+/).filter((w) => /[a-záéíóúñ]/i.test(w)).length;
  return { messages, sections, words };
}

function main(args) {
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

  const files = args.length
    ? args.map((f) => path.resolve(f))
    : fs.existsSync(notesDir)
      ? fs.readdirSync(notesDir).flatMap((d) => {
          const dir = path.join(notesDir, d);
          return fs.statSync(dir).isDirectory() ? fs.readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => path.join(dir, f)) : [];
        })
      : [];

  let errors = 0, warnings = 0;
  const err = (m) => { errors++; console.log('  ERROR ' + m); };
  const warn = (m) => { warnings++; console.log('  aviso ' + m); };

  for (const file of files) {
    console.log(path.relative(root, file));
    const md = fs.readFileSync(file, 'utf8');
    const unitId = path.basename(file, '.md');
    const subjectId = path.basename(path.dirname(file));
    const unit = units.get(unitId);
    if (!unit) { err(`«${unitId}» no es una unidad del catálogo`); continue; }
    if (unit.subjectId !== subjectId) err(`la unidad ${unitId} es de ${unit.subjectId}, no de ${subjectId}`);

    const { messages, sections, words } = checkNote(md, { unit, concepts: conceptsByUnit.get(unitId) || [] });
    for (const { level, msg } of messages) (level === 'error' ? err : warn)(msg);
    console.log(`  ${sections.length} secciones, ~${words} palabras, ~${Math.max(1, Math.round(words / 200))} min de lectura`);
  }

  console.log(`\n${files.length} ficheros · ${errors} errores · ${warnings} avisos`);
  return errors ? 1 : 0;
}

module.exports = { checkNote, UNACCENTED, CALLOUT_LABELS };

if (require.main === module) process.exit(main(process.argv.slice(2)));
