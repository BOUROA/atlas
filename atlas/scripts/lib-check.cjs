// Shared checks for Atlas v2 content.
const katex = require('katex');
const KINDS = ['concepto', 'definicion', 'teorema', 'metodo', 'algoritmo', 'estructura', 'herramienta'];
const QKINDS = ['recall', 'explain', 'exercise', 'distinguish', 'apply'];

function stripCode(s) {
  return s.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`]*`/g, ' ');
}
function mathSegments(text) {
  const s = stripCode(text).replace(/\\\$/g, '');
  const out = [];
  const re = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
  let m;
  while ((m = re.exec(s))) out.push({ tex: m[1] ?? m[2], display: !!m[1] });
  if (s.replace(re, '').includes('$')) out.push({ unbalanced: true });
  return out;
}
function checkTex(tex, display) {
  try {
    katex.renderToString(tex, { throwOnError: true, displayMode: display, strict: 'ignore' });
    return null;
  } catch (e) {
    return String(e.message).slice(0, 160);
  }
}
function checkText(where, text, errors) {
  if (typeof text !== 'string') return errors.push(`${where}: no es texto`);
  for (const seg of mathSegments(text)) {
    if (seg.unbalanced) { errors.push(`${where}: '$' desemparejado (usa \\$ para un dólar literal)`); continue; }
    const e = checkTex(seg.tex, seg.display);
    if (e) errors.push(`${where}: LaTeX inválido «${seg.tex.slice(0, 60)}» → ${e}`);
  }
}
function checkConcept(c, errors, warnings) {
  const w = `concepto ${c?.id ?? '?'}`;
  const req = ['id', 'name', 'aliases', 'unitId', 'order', 'kind', 'difficulty', 'summary', 'intuition', 'definition', 'formulas', 'example', 'mistakes', 'questions', 'alsoIn', 'syllabus'];
  for (const k of req) if (!(k in c)) errors.push(`${w}: falta el campo ${k}`);
  if (!/^[a-z]+\.[a-z0-9_]+$/.test(c.id ?? '')) errors.push(`${w}: id con formato no válido`);
  if (!KINDS.includes(c.kind)) errors.push(`${w}: kind no válido (${c.kind})`);
  if (![1, 2, 3, 4].includes(c.difficulty)) errors.push(`${w}: difficulty no válida`);
  if (!Number.isInteger(c.order)) errors.push(`${w}: order debe ser entero`);
  if (typeof c.summary === 'string' && c.summary.split(/\s+/).length > 32) warnings.push(`${w}: summary largo`);
  // Catálogo ligero: solo summary es obligatorio; intuition/definition pueden ir vacíos.
  for (const f of ['summary', 'intuition', 'definition']) {
    if (typeof c[f] === 'string') {
      if (f === 'summary' && !c[f].trim()) errors.push(`${w}: summary vacío`);
      checkText(`${w}.${f}`, c[f], errors);
    }
  }
  if (!Array.isArray(c.formulas)) errors.push(`${w}: formulas debe ser lista`);
  else c.formulas.forEach((f, i) => {
    if (!f || !f.label || !f.latex) return errors.push(`${w}.formulas[${i}]: falta label/latex`);
    const e = checkTex(f.latex, true);
    if (e) errors.push(`${w}.formulas[${i}]: LaTeX inválido → ${e}`);
  });
  if (c.example !== null && c.example !== undefined) {
    const ex = c.example;
    if (typeof ex.statement !== 'string' || !Array.isArray(ex.steps) || typeof ex.result !== 'string') errors.push(`${w}: example mal formado`);
    else {
      checkText(`${w}.example.statement`, ex.statement, errors);
      ex.steps.forEach((s, i) => checkText(`${w}.example.steps[${i}]`, s, errors));
      checkText(`${w}.example.result`, ex.result, errors);
    }
  }
  if (!Array.isArray(c.mistakes)) errors.push(`${w}: mistakes debe ser lista`);
  else c.mistakes.forEach((m, i) => checkText(`${w}.mistakes[${i}]`, m, errors));
  if (!Array.isArray(c.questions) || (c.questions.length > 0 && c.questions.length < 3)) errors.push(`${w}: si tiene preguntas, necesita ≥3`);
  else {
    const ids = new Set();
    c.questions.forEach((q, i) => {
      const qw = `${w}.questions[${i}]`;
      if (q.id !== `${c.id}#q${i + 1}`) errors.push(`${qw}: id debe ser ${c.id}#q${i + 1}`);
      if (ids.has(q.id)) errors.push(`${qw}: id repetido`);
      ids.add(q.id);
      if (!QKINDS.includes(q.kind)) errors.push(`${qw}: kind no válido`);
      if (![1, 2, 3, 4].includes(q.difficulty)) errors.push(`${qw}: difficulty no válida`);
      for (const f of ['prompt', 'answer']) {
        if (typeof q[f] !== 'string' || !q[f].trim()) errors.push(`${qw}: falta ${f}`);
        else checkText(`${qw}.${f}`, q[f], errors);
      }
      if (q.explanation !== undefined) checkText(`${qw}.explanation`, q.explanation, errors);
      if (typeof q.answer === 'string' && /^(s[ií]|no)\.?$/i.test(q.answer.trim())) errors.push(`${qw}: respuesta de sí/no sin justificar`);
    });
  }
  if (!Array.isArray(c.aliases)) errors.push(`${w}: aliases debe ser lista`);
  if (!Array.isArray(c.alsoIn)) errors.push(`${w}: alsoIn debe ser lista`);
  if (typeof c.syllabus !== 'boolean') errors.push(`${w}: syllabus debe ser booleano`);
}
module.exports = { checkConcept, checkText, checkTex, KINDS, QKINDS };
