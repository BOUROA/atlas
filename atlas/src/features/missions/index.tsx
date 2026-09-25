/**
 * Misiones y estrellas guía · Task 12.
 *
 * export function MissionsScreen(): JSX.Element — #/misiones, sin props.
 * export function MissionDetailScreen(props: { missionId: string }): JSX.Element — #/mision/:id
 * export function GuideScreen(props: { guideId: string }): JSX.Element — #/guia/:id
 */
import "./missions.css";

export { MissionsScreen } from "./MissionsScreen";
export { MissionDetailScreen } from "./MissionDetail";
export { GuideScreen } from "./GuideDetail";
