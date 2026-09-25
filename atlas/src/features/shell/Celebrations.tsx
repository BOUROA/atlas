// Celebraciones: guarda las insignias recién desbloqueadas, las anuncia con un
// aviso (como mucho tres; el resto, resumido) y muestra la subida de nivel.
// Discretas, rápidas y omitibles; el movimiento respeta prefers-reduced-motion.
import { useEffect, useState } from "react";
import { ACHIEVEMENT_BY_ID } from "../../domain/game/achievements";
import { achievementIcon } from "./achievementIcons";
import { rankOf } from "../../domain/game/levels";
import { markAchievementsSeen, recordAchievements, setLevelShown } from "../../state/actions";
import { useDerived } from "../../state/derived";
import { store, useUserState } from "../../state/store";
import { Badge, Button, Dialog, plural, toast } from "../../ui";

const MAX_TOASTS = 3;

const idle = (fn: () => void): (() => void) => {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(fn, { timeout: 1500 });
    return () => window.cancelIdleCallback(id);
  }
  const id = setTimeout(fn, 200);
  return () => clearTimeout(id);
};

export function Celebrations() {
  const derived = useDerived();
  const achievements = useUserState((s) => s.achievements);
  const seen = useUserState((s) => s.seen);
  const [levelUp, setLevelUp] = useState<{ level: number; from: number } | null>(null);

  // 1. Insignias cumplidas que aún no están guardadas (en reposo: recorre todo el registro).
  useEffect(
    () =>
      idle(() => {
        const current = store.getState().achievements;
        const fresh = derived.unlocked.filter((id) => !(id in current));
        if (fresh.length > 0) recordAchievements(fresh);
      }),
    [derived],
  );

  // 2. Avisos de las guardadas que no se han celebrado.
  useEffect(() => {
    const seenSet = new Set(seen.achievements);
    const unseen = Object.keys(achievements).filter((id) => !seenSet.has(id));
    if (unseen.length === 0) return;
    const known = unseen.map((id) => ACHIEVEMENT_BY_ID.get(id)).filter((a) => a !== undefined);
    for (const a of known.slice(0, MAX_TOASTS)) {
      const Icon = achievementIcon(a.icon);
      toast(`Nueva insignia: ${a.title}`, {
        tone: "gold",
        description: `${a.description} · +${a.xp} XP`,
        icon: <Badge label={a.title} icon={<Icon />} size={36} caption={false} celebrate />,
        duration: 6000,
      });
    }
    if (known.length > MAX_TOASTS) {
      toast(`Y ${plural(known.length - MAX_TOASTS, "insignia más", "insignias más")}`, {
        tone: "gold",
        description: "Las tienes todas en Progreso.",
        duration: 6000,
      });
    }
    markAchievementsSeen(unseen);
  }, [achievements, seen.achievements]);

  // 3. Subida de nivel.
  const level = derived.level.level;
  useEffect(() => {
    if (level > seen.levelShown && !levelUp) setLevelUp({ level, from: seen.levelShown });
  }, [level, seen.levelShown, levelUp]);

  const close = () => {
    if (levelUp) setLevelShown(Math.max(levelUp.level, level));
    setLevelUp(null);
  };
  const newRank = levelUp ? rankOf(levelUp.level) : null;
  const rankChanged = levelUp ? rankOf(levelUp.from) !== newRank : false;

  return (
    <Dialog
      open={!!levelUp}
      onClose={close}
      size="sm"
      eyebrow="Subida de nivel"
      title={levelUp ? `Nivel ${levelUp.level}` : ""}
      description={levelUp ? (rankChanged ? `Nuevo rango: ${newRank}. Tu cielo se agranda.` : `Sigues en ${newRank}, cada vez más cerca del siguiente rango.`) : undefined}
      footer={
        <Button variant="primary" onClick={close} data-autofocus>
          Seguir
        </Button>
      }
    >
      {levelUp && (
        <div className="flex justify-center py-2">
          <Badge
            label={`Nivel ${levelUp.level}`}
            monogram={String(levelUp.level)}
            size={132}
            engraving={`ATLAS · NIVEL ${levelUp.level} · ${newRank?.toUpperCase()}`}
            caption={false}
            celebrate
          />
        </div>
      )}
    </Dialog>
  );
}
