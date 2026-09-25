// Selector de asignatura del Camino: diez anillos (el nivel sobre 7, del color
// de la asignatura), la seleccionada más grande y en oro.
import type { CSSProperties } from "react";
import { currentSubjects } from "../../../state/catalog";
import { useSubjectLevels } from "../../../state/derived";
import { href } from "../../../state/router";
import { cx, Icons, ICON_SIZE, subjectAbbr, subjectColor } from "../../../ui";

const TOP_LEVEL = 7;

function SubjectRing({ subjectId, name, level, selected }: { subjectId: string; name: string; level: number; selected: boolean }) {
  const size = selected ? 58 : 44;
  const sw = selected ? 3 : 2.5;
  const r = size / 2 - sw;
  const c = 2 * Math.PI * r;
  return (
    <a
      className={cx("camino-world", selected && "is-selected", level === 0 && "is-zero")}
      href={href(`/misiones?tab=camino&asig=${subjectId}`)}
      aria-current={selected ? "true" : undefined}
      aria-label={`${name}, nivel ${level} de ${TOP_LEVEL}${selected ? " · seleccionada" : ""}`}
    >
      <span className="camino-world-orb" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={sw} />
          {level > 0 && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={selected ? "var(--gold-hi)" : subjectColor(subjectId)}
              strokeWidth={sw}
              strokeLinecap="round"
              strokeDasharray={`${(c * level) / TOP_LEVEL} ${c}`}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          )}
        </svg>
        <b className="num camino-world-lv">{level}</b>
      </span>
      {selected ? <span className="camino-world-name">{name}</span> : <span className="camino-world-code" style={{ "--c": subjectColor(subjectId) } as CSSProperties}>{subjectAbbr(subjectId)}</span>}
    </a>
  );
}

/** Diez mundos: uno por asignatura del curso, con su nivel del Camino. */
export function SubjectRail({ subjectId }: { subjectId: string }) {
  const levels = useSubjectLevels();
  return (
    <nav className="camino-worlds" aria-label="Elegir asignatura">
      <span className="camino-worlds-legend">
        <span className="mono-label"><Icons.subject aria-hidden="true" {...ICON_SIZE.label} /> Asignatura</span>
        <span className="mono-label"><Icons.next aria-hidden="true" {...ICON_SIZE.label} /> nivel / 7</span>
      </span>
      <div className="camino-worlds-list">
        {currentSubjects.map((s) => (
          <SubjectRing key={s.id} subjectId={s.id} name={s.shortName} level={levels[s.id]?.level ?? 0} selected={s.id === subjectId} />
        ))}
      </div>
    </nav>
  );
}
