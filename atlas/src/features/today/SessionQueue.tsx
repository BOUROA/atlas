// En la cola (tabla de la cola de estudio libre, bajo la Misión de hoy).
import { useMemo, useState } from "react";
import type { QueueItem, QueueResult } from "../../domain/tutor/queue";
import { progressOf } from "../../domain/tutor/mastery";
import { catalog } from "../../state/catalog";
import { openConcept } from "../../state/router";
import type { Derived } from "../../state/derive-core";
import {
  EmptyState, Freshness, ICON_SIZE, Icons, LevelBars, Section, SubjectTag, Tabs, TabPanel, Tooltip, cx, minutesShort, plural,
} from "../../ui";
import { queueReasonChips } from "./helpers";

const SIZE_ROW = { size: ICON_SIZE.row.size, strokeWidth: ICON_SIZE.row.strokeWidth };
const SIZE_LABEL = { size: ICON_SIZE.label.size, strokeWidth: ICON_SIZE.label.strokeWidth };

const BADGE_TEXT = (item: QueueItem): string => (item.type === "review" ? "Repaso" : item.type === "first" ? "Primer recuerdo" : "Nuevo");
const BADGE_ICON = (item: QueueItem) => (item.type === "review" ? Icons.review : item.type === "first" ? Icons.firstRecall : Icons.newConcept);

const PAGE_SIZE = 8;
type QueueTab = "todo" | "repasos" | "nuevos";

/** En la cola: los conceptos de la sesión con su motivo, priorizados. */
export function QueueSection({ derived, queue }: { derived: Derived; queue: QueueResult }) {
  const [tab, setTab] = useState<QueueTab>("todo");
  const [expanded, setExpanded] = useState(false);

  const items = queue.items;
  const counts = useMemo(
    () => ({
      todo: items.length,
      repasos: items.filter((i) => i.type !== "new").length,
      nuevos: items.filter((i) => i.type === "new").length,
    }),
    [items],
  );
  const filtered = useMemo(() => {
    if (tab === "repasos") return items.filter((i) => i.type !== "new");
    if (tab === "nuevos") return items.filter((i) => i.type === "new");
    return items;
  }, [items, tab]);
  const visible = expanded ? filtered : filtered.slice(0, PAGE_SIZE);
  const rest = filtered.length - visible.length;

  return (
    <Section
      card
      aria-label="Cola de estudio"
      title="En la cola"
      action={
        <div className="today-queue-act">
          <Tooltip content="Orden: examen cercano × lo que desbloquea × riesgo de olvido">
            <button type="button" className="today-info" aria-label="Cómo se ordena la cola">
              <Icons.help aria-hidden="true" {...SIZE_ROW} />
            </button>
          </Tooltip>
          <Tabs
            id="today-queue-tabs"
            aria-label="Filtrar la cola"
            value={tab}
            onChange={(v) => {
              setTab(v);
              setExpanded(false);
            }}
            items={[
              { id: "todo", label: "Todo", count: counts.todo },
              { id: "repasos", label: "Repasos", count: counts.repasos },
              { id: "nuevos", label: "Nuevos", count: counts.nuevos },
            ]}
          />
        </div>
      }
    >
      {items.length === 0 ? (
        <EmptyState size="sm" tone="dashed" title="La cola está vacía" description="No hay nada pendiente ahora mismo." />
      ) : (
        <TabPanel tabs="today-queue-tabs" tab={tab}>
          <ol className="today-queue">
            {visible.map((item, i) => (
              <QueueRow key={item.conceptId} item={item} index={i + 1} derived={derived} />
            ))}
          </ol>
          {rest > 0 && (
            <div className="today-q-foot">
              <button type="button" className="today-link" onClick={() => setExpanded(true)}>
                Ver {plural(rest, "más", "más")}
                <Icons.more aria-hidden="true" {...SIZE_ROW} />
              </button>
            </div>
          )}
        </TabPanel>
      )}
    </Section>
  );
}

function QueueRow({ item, index, derived }: { item: QueueItem; index: number; derived: Derived }) {
  const concept = catalog.conceptById.get(item.conceptId);
  if (!concept) return null;
  const p = progressOf(derived.progress, item.conceptId);
  const cooling = item.type === "review" && (p.retrievability ?? 1) < 0.65;
  const BadgeIcon = BADGE_ICON(item);
  const chips = queueReasonChips(item.reasons);

  return (
    <li className="today-q">
      <button type="button" className="today-q-btn" onClick={() => openConcept(item.conceptId)}>
        <span className="today-q-n num">{String(index).padStart(2, "0")}</span>
        <span className="today-q-main">
          <span className="today-q-t">
            <span className="today-q-name">{concept.name}</span>
            <SubjectTag subjectId={concept.subjectId} variant="code" size="sm" />
            <span className={cx("today-tag", `is-${item.type}`)}>
              <BadgeIcon aria-hidden="true" {...SIZE_LABEL} />
              {BADGE_TEXT(item)}
            </span>
          </span>
          {chips.length > 0 && (
            <span className="today-q-why">
              {chips.map((chip, i) => {
                const ReasonIcon = Icons[chip.icon];
                return (
                  <span key={i} className={cx("today-q-reason", chip.tone && `is-${chip.tone}`)}>
                    <ReasonIcon aria-hidden="true" {...SIZE_ROW} />
                    {chip.text}
                  </span>
                );
              })}
            </span>
          )}
        </span>
        <span className="today-q-state" title={p.retrievability == null ? "Sin ver" : undefined}>
          <LevelBars level={p.level} cooling={cooling} size="sm" />
          {p.retrievability != null && <Freshness r={p.retrievability} variant="track" size="sm" showPct={false} showLabel={false} />}
        </span>
        <span className="today-q-time num">{minutesShort(item.minutes)}</span>
        <Icons.open className="today-q-go" aria-hidden="true" {...SIZE_ROW} />
      </button>
    </li>
  );
}
