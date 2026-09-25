// Logros: cuadrícula de todas las insignias, conseguidas y bloqueadas.
import { useMemo } from "react";
import { ACHIEVEMENTS } from "../../domain/game/achievements";
import type { UserState } from "../../domain/types";
import { catalog, expeditions, guides } from "../../state/catalog";
import type { Derived } from "../../state/derive-core";
import { achievementIcon } from "../shell/achievementIcons";
import { achievementProgress } from "../today/helpers";
import { Badge, Section, dateShort } from "../../ui";

export function BadgesSection({ state, derived }: { state: UserState; derived: Derived }) {
  const earned = state.achievements;
  const earnedCount = Object.keys(earned).length;
  const progressMap = useMemo(
    () => achievementProgress({ index: catalog, state, progress: derived.progress, longestStreak: derived.longestStreak, expeditions, guides }),
    [state, derived],
  );

  return (
    <Section card aria-label="Logros" eyebrow={`${earnedCount} de ${ACHIEVEMENTS.length} conseguidos`} title="Logros">
      <div className="progress-badges">
        {ACHIEVEMENTS.map((a) => {
          const at = earned[a.id];
          const Icon = achievementIcon(a.icon);
          const p = progressMap.get(a.id);
          return (
            <Badge
              key={a.id}
              size={72}
              icon={<Icon />}
              label={a.title}
              sublabel={a.description}
              meta={at ? dateShort(at) : p ? `${Math.round((p.value / p.target) * 100)} %` : undefined}
              locked={!at}
              progress={!at ? (p ? Math.min(1, p.value / p.target) : undefined) : undefined}
            />
          );
        })}
      </div>
      <p className="progress-badges-note">Las insignias bloqueadas muestran su condición; cuando es medible, también el progreso.</p>
    </Section>
  );
}
