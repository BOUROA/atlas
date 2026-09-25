import type { Concept, Subject, SubjectContent } from "../../src/domain/types";

const subject = (id: string, shortName: string, year: 1 | 2, order: number): Subject => ({
  id, name: shortName, shortName, year, semester: 1, status: "current", color: "#888", order, file: `${id}.json`,
});
export const fixtureSubjects: Subject[] = [
  subject("algebra", "Álgebra", 1, 1),
  subject("calculo", "Cálculo", 1, 2),
  subject("prepro", "Preprocesamiento", 2, 3),
];
const c = (id: string, name: string, unitId: string, order: number, extra: Partial<Concept> = {}): Concept => ({
  id, name, aliases: [], unitId, order, kind: "concepto", difficulty: 2, summary: name, intuition: name,
  definition: name, formulas: [], example: null, mistakes: [],
  questions: [
    { id: `${id}#q1`, kind: "recall", prompt: `¿Qué es ${name}?`, answer: name, difficulty: 1 },
    { id: `${id}#q2`, kind: "exercise", prompt: `Ejercicio de ${name}`, answer: name, difficulty: 2 },
    { id: `${id}#q3`, kind: "explain", prompt: `Explica ${name}`, answer: name, difficulty: 2 },
  ],
  alsoIn: [], syllabus: true, ...extra,
});
const req = (source: string, target: string) => ({ source, target, type: "requires" as const, reason: "base" });
export const fixtureFiles: SubjectContent[] = [
  {
    subjectId: "algebra",
    units: [
      { id: "algebra.t1", number: 1, title: "Vectores y matrices", summary: "" },
      { id: "algebra.t2", number: 2, title: "Autovalores", summary: "" },
    ],
    concepts: [
      c("algebra.vectors", "Vectores", "algebra.t1", 1, { aliases: ["vector"] }),
      c("algebra.matrices", "Matrices", "algebra.t1", 2, { alsoIn: [{ subjectId: "calculo", role: "used", note: "jacobianas" }] }),
      c("algebra.eigen", "Autovalores", "algebra.t2", 1, { aliases: ["valores propios"] }),
    ],
    relations: [req("algebra.matrices", "algebra.vectors"), req("algebra.eigen", "algebra.matrices")],
  },
  {
    subjectId: "calculo",
    units: [
      { id: "calculo.t1", number: 1, title: "Funciones", summary: "" },
      { id: "calculo.t2", number: 2, title: "Derivadas", summary: "" },
    ],
    concepts: [
      c("calculus.functions", "Funciones", "calculo.t1", 1),
      c("calculus.derivative", "Derivada", "calculo.t2", 1),
      c("calculus.chain_rule", "Regla de la cadena", "calculo.t2", 2),
    ],
    relations: [req("calculus.derivative", "calculus.functions"), req("calculus.chain_rule", "calculus.derivative")],
  },
  {
    subjectId: "prepro",
    units: [
      { id: "prepro.t1", number: 1, title: "Estadística", summary: "" },
      { id: "prepro.t2", number: 2, title: "Reducción", summary: "" },
    ],
    concepts: [
      c("stats.variance", "Varianza", "prepro.t1", 1),
      c("stats.covariance", "Covarianza", "prepro.t1", 2),
      c("data.pca", "PCA", "prepro.t2", 1, { difficulty: 3, aliases: ["análisis de componentes principales"] }),
      c("data.gradient_descent", "Descenso de gradiente", "prepro.t2", 2),
    ],
    relations: [
      req("stats.covariance", "stats.variance"), req("stats.covariance", "algebra.matrices"),
      req("data.pca", "stats.covariance"), req("data.pca", "algebra.eigen"),
      req("data.gradient_descent", "calculus.chain_rule"),
      { source: "data.pca", target: "data.gradient_descent", type: "related", reason: "se confunden" },
    ],
  },
];
