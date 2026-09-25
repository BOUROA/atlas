/**
 * Progreso (#/progreso) · Task 8 + Task 12 (bitácora de misiones y galería
 * de estrellas guía).
 *
 * export function ProgressScreen(): JSX.Element — sin props.
 */
import "./progress.css";
import { useDerived } from "../../state/derived";
import { useUserState } from "../../state/store";
import { Page } from "../../ui";
import { RankSection } from "./RankSection";
import { BadgesSection } from "./BadgesSection";
import { ConstancySection, EvolutionSection } from "./ActivityEvolution";
import { ReadinessSection, CalibrationSection } from "./ReadinessCalibration";
import { MissionsLogSection, GuidesGallerySection } from "./MissionsGuides";

export function ProgressScreen() {
  const state = useUserState((s) => s);
  const derived = useDerived();

  return (
    <Page as="main" className="progress-page">
      <RankSection derived={derived} />
      <BadgesSection state={state} derived={derived} />
      <div className="progress-row">
        <ConstancySection state={state} derived={derived} />
        <EvolutionSection derived={derived} />
      </div>
      <div className="progress-row">
        <ReadinessSection state={state} derived={derived} />
        <CalibrationSection state={state} />
      </div>
      <div className="progress-row">
        <MissionsLogSection state={state} />
        <GuidesGallerySection progress={derived.progress} />
      </div>
    </Page>
  );
}
