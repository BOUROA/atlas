export type SubjectStatus = "current" | "future";
/** Público de una constelación en FlipyERP Academy. */
export type Audience = "todos" | "desarrollo" | "operaciones";
export type Subject = {
  id: string; name: string; shortName: string;
  year: 1 | 2 | 3 | 4; semester: 1 | 2; status: SubjectStatus;
  color: string; order: number; file: string;
  // ── FlipyERP Academy (opcionales) ──
  /** Abreviatura de 3 letras en versalitas; por defecto, las 3 primeras del id. */
  abbr?: string;
  /** Color para el tema claro; por defecto, `color`. */
  colorLight?: string;
  /** Nivel de entrada: 0 desde cero, 1 básico, 2 medio, 3 avanzado. */
  level?: 0 | 1 | 2 | 3;
  /** Bloque temático (fundamentos, herramientas, flipyerp, operaciones, ingenieria-ia). */
  track?: string;
  audience?: Audience[];
  /** Constelaciones que se asignan automáticamente antes que esta. */
  prerequisites?: string[];
  description?: string;
};
export type Unit = { id: string; number: number; title: string; summary: string };
export type ConceptKind = "concepto" | "definicion" | "teorema" | "metodo" | "algoritmo" | "estructura" | "herramienta";
export type QuestionKind = "recall" | "explain" | "exercise" | "distinguish" | "apply";
export type Difficulty = 1 | 2 | 3 | 4;
export type Question = { id: string; kind: QuestionKind; prompt: string; answer: string; explanation?: string; difficulty: Difficulty };
export type Formula = { label: string; latex: string };
export type WorkedExample = { statement: string; steps: string[]; result: string };
export type AlsoIn = { subjectId: string; role: "studied" | "used"; note: string };
/** Recurso externo (curso gratuito, documentación, repositorio) que complementa un concepto. */
export type Resource = { title: string; url: string; provider: string; kind: "curso" | "documentacion" | "repositorio" | "articulo"; minutes?: number };
export type Concept = {
  id: string; name: string; aliases: string[]; unitId: string; order: number;
  kind: ConceptKind; difficulty: Difficulty; summary: string; intuition: string; definition: string;
  formulas: Formula[]; example: WorkedExample | null; mistakes: string[]; questions: Question[];
  alsoIn: AlsoIn[]; syllabus: boolean;
  // ── FlipyERP Academy (opcionales) ──
  resources?: Resource[];
  /**
   * Ficheros del repositorio de FlipyERP en los que se basa el concepto
   * (rutas relativas a FlipyERP_v1.0.1/). Sirven para avisar de lecciones que
   * hay que revisar cuando cambia el código.
   */
  sources?: string[];
};
export type RelationType = "requires" | "related";
export type Relation = { source: string; target: string; type: RelationType; reason: string };
export type SubjectContent = { subjectId: string; units: Unit[]; concepts: Concept[]; relations: Relation[] };
export type CatalogUnit = Unit & { subjectId: string };
export type CatalogConcept = Concept & { subjectId: string };
export type Catalog = { subjects: Subject[]; units: CatalogUnit[]; concepts: CatalogConcept[]; relations: Relation[] };

export type Level = 0 | 1 | 2 | 3;
export type Grade = 1 | 2 | 3 | 4;
export type EventKind = "seen" | "review" | "declared" | "implicit";
export type EventSource = "session" | "quick" | "class" | "concept" | "challenge";
export type StudyEvent = {
  id: string; at: string; conceptId: string; kind: EventKind;
  grade?: Grade; questionId?: string; questionKind?: QuestionKind;
  confidence?: 1 | 2 | 3; attempted?: boolean; ms?: number; source: EventSource;
};

// Misiones (exámenes reales de otras universidades) y estrellas guía
// (referentes históricos y perfiles destacados). Ver docs/superpowers/specs.
export type ExpeditionProblem = { n: string; topic: string; concepts: string[]; points?: number };
export type Expedition = {
  id: string; university: string; course: string; courseName: string; term: string; title: string;
  kind: "final" | "parcial" | "quiz"; durationMin: number; url: string; solutionsUrl: string; license: string;
  subjects: string[]; level: string; whyThisOne: string; problems: ExpeditionProblem[];
  /** true si `durationMin` es una estimación (el examen original no indicaba duración). */
  durationEstimated?: boolean;
  /** true si `url` y `solutionsUrl` apuntan al mismo documento (enunciado y soluciones juntos). */
  sameDocument?: boolean;
  /** Dificultad 1 (quiz de introducción) a 5 (posgrado o excepcional); ver spec §5. */
  difficulty?: 1 | 2 | 3 | 4 | 5;
};
export type ExpeditionAttempt = { id: string; startedAt: string; endedAt?: string; scores: Record<string, 0 | 0.5 | 1> };
export type LegendMilestone = { year: number; age?: number; text: string; source?: number };
export type Legend = {
  id: string; name: string; years: string; origin: string; tagline: string; story: string;
  milestones: LegendMilestone[]; route: string[];
  studyLesson: { title: string; text: string; atlasFeature: string };
  sources: { title: string; url: string }[];
};
/** Perfil destacado: como `Legend`, pero con ruta propia (`path`/`territory`) y sellos reales (`stamps`). */
export type Profile = {
  id: string; name: string; born?: string; origin: string; field: string; tagline: string; story: string;
  path: LegendMilestone[];
  stamps: { title: string; year: number; kind: string; source?: number }[];
  territory: string[];
  studyLesson: { title: string; text: string; atlasFeature?: string };
  sources: { title: string; url: string }[];
};
export type SessionLog = { id: string; startedAt: string; endedAt: string; reviews: number; newConcepts: number; completed: boolean };
export type AssessmentKind = "parcial" | "final" | "entrega" | "practica" | "otro";
export type Assessment = {
  id: string; title: string; kind: AssessmentKind; date?: string; weight: number; grade?: number; unitIds: string[];
  /** true si es un hueco de la plantilla online (sin guía docente todavía); se quita al editar fecha o peso. */
  template?: boolean;
};
export type SubjectState = { currentUnit: number; assessments: Assessment[]; updatedAt: string };
export type NoteLink = { label: string; url: string };
export type ConceptNote = { text: string; links: NoteLink[]; updatedAt: string };
export type Settings = {
  dailyMinutes: number; desiredRetention: number; theme: "system" | "dark" | "light";
  targetGrade: number; updatedAt: string;
  /** Día "YYYY-MM-DD" de inicio de curso, para el rumbo y el ritmo del 10. Por defecto DEFAULT_COURSE_START (route.ts). */
  courseStart?: string;
};

// Pruebas sintéticas (exámenes escritos para Atlas): controles de tema y
// simulacros de parcial/final. Ver docs/superpowers/specs §4 y §7.
export type TrialKind = "control" | "parcial" | "final";
export type TrialLevel = 1 | 2 | 3 | 4;
export type RubricItem = { text: string; points: number };
export type TrialProblem = {
  n: string; points: number; difficulty: Difficulty; concepts: string[];
  statement: string; solution: string; rubric: RubricItem[]; pitfalls?: string[];
};
export type Trial = {
  id: string; subjectId: string; kind: TrialKind; level: TrialLevel; title: string;
  unitIds: string[]; durationMin: number; rules?: string; problems: TrialProblem[];
};
/** Un intento de prueba: `earned` son los puntos por problema, `checked` los índices de rúbrica marcados. */
export type TrialAttempt = {
  id: string; startedAt: string; endedAt?: string;
  earned: Record<string, number>; checked?: Record<string, number[]>;
};

// Misión del día (spec 2026-09-25-mision-del-dia-camino §3): plan cerrado de
// 3–5 misiones, congelado al empezar el día y guardado como instantánea.
export type DayMissionKind = "review" | "reinforce" | "advance" | "trial";
export type DayMission = {
  /** Estable: `${day}:${kind}` o `${day}:advance:${subjectId}`. */
  id: string;
  kind: DayMissionKind;
  /** Título corto: «Calentamiento», «Refuerzo», «Álgebra · Tema 1» o el título de la prueba. */
  title: string;
  /** Asignatura del Avance o de la prueba (Calentamiento y Refuerzo mezclan asignaturas). */
  subjectId?: string;
  /** Tema del primer concepto de un Avance. */
  unitId?: string;
  /** Prueba de un Demuestra. */
  trialId?: string;
  /** Conceptos de la misión (vacío en un Demuestra). */
  conceptIds: string[];
  /** Objetivo: repasos (Calentamiento), conceptos (Refuerzo, Avance) o 1 intento (Demuestra). */
  target: number;
  /** Minutos estimados. */
  minutes: number;
  /** true si arrastra conceptos del Avance sin terminar de ayer. */
  carried?: boolean;
};
export type DayPlan = {
  /** "YYYY-MM-DD" local. */
  day: string;
  /** ISO de creación: al fusionar gana la instantánea más antigua. */
  createdAt: string;
  /** Asignaturas con Avance, en el orden de sus misiones. */
  focus: string[];
  missions: DayMission[];
};

export type UserState = {
  version: 2; createdAt: string; settings: Settings;
  events: StudyEvent[]; sessions: SessionLog[];
  notes: Record<string, ConceptNote>; subjects: Record<string, SubjectState>;
  achievements: Record<string, string>;            // id → ISO de desbloqueo
  seen: { achievements: string[]; levelShown: number };
  /** Intentos de misión (expedición) por id de expedición. */
  expeditions?: Record<string, ExpeditionAttempt[]>;
  /** Intentos de prueba sintética por id de prueba. */
  trials?: Record<string, TrialAttempt[]>;
  /** Instantáneas de la Misión del día por "YYYY-MM-DD". */
  dayPlans?: Record<string, DayPlan>;
};
export const defaultSettings = (now: string): Settings => ({
  dailyMinutes: 120, desiredRetention: 0.9, theme: "dark", targetGrade: 10, updatedAt: now,
});
export const emptyUserState = (now: string): UserState => ({
  version: 2, createdAt: now, settings: defaultSettings(now), events: [], sessions: [],
  notes: {}, subjects: {}, achievements: {}, seen: { achievements: [], levelShown: 1 },
});
export const subjectStateOf = (s: UserState, subjectId: string): SubjectState =>
  s.subjects[subjectId] ?? { currentUnit: 1, assessments: [], updatedAt: "" };
