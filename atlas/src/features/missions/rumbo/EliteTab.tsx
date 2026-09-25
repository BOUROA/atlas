// Pestaña "Élite": una campaña (escalera de misiones) por asignatura que
// tiene alguna, de la más fácil a la cumbre. Peldaños compactos, a una línea.
import { Check, Mountain } from "lucide-react";
import type { CampaignRung } from "../../../domain/campaigns";
import { currentSubjects, expeditions } from "../../../state/catalog";
import { useCampaign } from "../../../state/derived";
import { href } from "../../../state/router";
import { EmptyState, Icons, IconButton, Ring, SubjectDot, Tooltip, cx, pct, subjectName } from "../../../ui";
import { missionKindLabel, gradeNum } from "../helpers";

/** Preparación, en pocas palabras: oculta si es 0 %. */
const readinessLabel = (ratio: number): string | null => (ratio > 0 ? pct(ratio) : null);

function DifficultyMarks({ value }: { value: number }) {
  return (
    <span className="rumbo-diff" role="img" aria-label={`Dificultad ${value} de 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <i key={i} className={i <= value ? "is-on" : undefined} aria-hidden="true" />
      ))}
    </span>
  );
}

function Rung({ rung }: { rung: CampaignRung }) {
  const exp = rung.expedition;
  const state = rung.passed ? "superada" : rung.isNext ? "siguiente" : rung.best != null ? `mejor nota ${gradeNum(rung.best)}` : "sin intentos";
  return (
    <li className={cx("rumbo-rung", rung.isNext && "is-next", rung.passed && "is-passed", rung.isSummit && "is-summit")}>
      <a
        className="missions-card-link"
        href={href(`/mision/${exp.id}`)}
        aria-label={`${exp.title} · ${exp.university} ${exp.course} (${missionKindLabel(exp.kind).toLowerCase()}), dificultad ${rung.difficulty} de 5, ${state}${rung.isSummit ? ", cumbre" : ""}`}
      />
      <DifficultyMarks value={rung.difficulty} />
      <p className="rumbo-rung-main">
        <span className="rumbo-rung-title">
          {rung.passed && <Check className="rumbo-rung-check" aria-hidden="true" />}
          {exp.title}
        </span>
        <Tooltip content={`${exp.university} · ${exp.course}`}>
          <span className="rumbo-rung-src" tabIndex={0}>
            {exp.university}
          </span>
        </Tooltip>
      </p>
      <span className="rumbo-rung-stats">
        <span className="rumbo-rung-score" title={rung.best != null ? "Mejor nota" : "Sin intentos"}>
          {rung.best != null ? <b className={cx("num", rung.passed && "gold-text")}>{gradeNum(rung.best)}</b> : <span className="rumbo-rung-none">—</span>}
        </span>
        {readinessLabel(rung.readiness.ratio) && (
          <span className="rumbo-rung-ready" title={`Preparación: ${pct(rung.readiness.ratio)}`}>
            <Ring value={rung.readiness.ratio} size={16} thickness={2.5} label={null} animate={false} />
            {readinessLabel(rung.readiness.ratio)}
          </span>
        )}
        <span className="rumbo-rung-end">
          {rung.isSummit && (
            <Tooltip content="Cumbre: la última de la escalera.">
              <Mountain className="rumbo-rung-summit" aria-hidden="true" tabIndex={0} />
            </Tooltip>
          )}
        </span>
      </span>
    </li>
  );
}

function SubjectCampaign({ subjectId }: { subjectId: string }) {
  const campaign = useCampaign(subjectId);
  if (campaign.rungs.length === 0) return null;
  return (
    <section className="rumbo-campaign" aria-labelledby={`rumbo-campaign-${subjectId}`}>
      <header className="rumbo-campaign-head">
        <SubjectDot subjectId={subjectId} size={9} />
        <h3 id={`rumbo-campaign-${subjectId}`}>{subjectName(subjectId)}</h3>
        <span className="tone-3 rumbo-campaign-count">
          <b className="num">{campaign.passed}</b> de <b className="num">{campaign.rungs.length}</b> superadas
          {campaign.summitPassed && " · cumbre alcanzada"}
        </span>
      </header>
      <ol className="rumbo-ladder">
        {campaign.rungs.map((rung) => (
          <Rung key={rung.expedition.id} rung={rung} />
        ))}
      </ol>
    </section>
  );
}

export function EliteTab() {
  if (expeditions.length === 0) {
    return <EmptyState title="Sin campañas de élite todavía" description="El catálogo de misiones de élite está vacío." />;
  }
  return (
    <div className="rumbo-elite">
      <p className="rumbo-elite-lead tone-2">
        Exámenes reales, de menos a más difícil · se superan con un <b>7</b>
        <Tooltip content="De MIT, Stanford, Berkeley y otras universidades. La última misión de cada escalera es la cumbre.">
          <IconButton aria-label="Ayuda" icon={<Icons.help aria-hidden="true" />} variant="quiet" size="sm" tooltip={false} />
        </Tooltip>
      </p>
      <div className="rumbo-campaigns">
        {currentSubjects.map((s) => (
          <SubjectCampaign key={s.id} subjectId={s.id} />
        ))}
      </div>
    </div>
  );
}
