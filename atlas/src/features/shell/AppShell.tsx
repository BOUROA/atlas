// Shell de la aplicación: cielo de fondo, cabecera, pantalla de la ruta, panel
// de ficha, buscador, registro de clase, celebraciones y avisos.
import { lazy, Suspense, useEffect, type ReactNode } from "react";
import "./shell.css";
import { TodayScreen } from "../today";
import { ClassLogDialog } from "../class-log";
import { catalog, expeditionById, guideById, trialById } from "../../state/catalog";
import { useRoute, type Route } from "../../state/router";
import { useUserState } from "../../state/store";
import { closeClassLog, useUi } from "../../state/ui";
import { StarField, Toaster } from "../../ui";
import { BottomNav, TopNav } from "./TopNav";
import { Celebrations } from "./Celebrations";
import { ConceptPanelHost } from "./ConceptPanelHost";
import { SearchPalette } from "./SearchPalette";
import { useGlobalShortcuts } from "./useGlobalShortcuts";

// Pantallas en trozos aparte (Hoy va en el principal: es la de inicio).
const SessionScreen = lazy(() => import("../session").then((m) => ({ default: m.SessionScreen })));
const SubjectsScreen = lazy(() => import("../subjects").then((m) => ({ default: m.SubjectsScreen })));
const SubjectDetailScreen = lazy(() => import("../subjects").then((m) => ({ default: m.SubjectDetailScreen })));
const MapScreen = lazy(() => import("../map").then((m) => ({ default: m.MapScreen })));
const MissionsScreen = lazy(() => import("../missions").then((m) => ({ default: m.MissionsScreen })));
const MissionDetailScreen = lazy(() => import("../missions").then((m) => ({ default: m.MissionDetailScreen })));
const GuideScreen = lazy(() => import("../missions").then((m) => ({ default: m.GuideScreen })));
const TrialScreen = lazy(() => import("../trial").then((m) => ({ default: m.TrialScreen })));
const NotesScreen = lazy(() => import("../notes").then((m) => ({ default: m.NotesScreen })));
const ProgressScreen = lazy(() => import("../progress").then((m) => ({ default: m.ProgressScreen })));
const SettingsScreen = lazy(() => import("../settings").then((m) => ({ default: m.SettingsScreen })));

function titleOf(route: Route): string {
  const id = route.params.id ?? "";
  switch (route.name) {
    case "hoy": return "Hoy";
    case "sesion": return "Sesión";
    case "asignaturas": return "Asignaturas";
    case "asignatura": return catalog.subjectById.get(id)?.shortName ?? "Asignatura";
    case "mapa": return "Carta celeste";
    case "misiones": return "Misiones";
    case "mision": return expeditionById.get(id)?.course ?? "Misión";
    case "guia": return guideById.get(id)?.name ?? "Estrella guía";
    case "prueba": return trialById.get(id)?.title ?? "Prueba";
    case "apuntes": return catalog.unitById.get(id) ? `Apuntes · Tema ${catalog.unitById.get(id)!.number}` : "Apuntes";
    case "progreso": return "Progreso";
    case "ajustes": return "Ajustes";
    case "ui": return "Primitivas";
  }
}

function Screen({ route }: { route: Route }): ReactNode {
  const id = route.params.id ?? "";
  switch (route.name) {
    case "sesion": return <SessionScreen />;
    case "asignaturas": return <SubjectsScreen />;
    case "asignatura": return <SubjectDetailScreen key={id} subjectId={id} tab={route.query.get("tab")} />;
    case "mapa": return <MapScreen />;
    case "misiones": return <MissionsScreen />;
    case "mision": return <MissionDetailScreen key={id} missionId={id} />;
    case "guia": return <GuideScreen key={id} guideId={id} />;
    case "prueba": return <TrialScreen key={id} trialId={id} />;
    case "apuntes": return <NotesScreen key={id} unitId={id} />;
    case "progreso": return <ProgressScreen />;
    case "ajustes": return <SettingsScreen />;
    default: return <TodayScreen />;
  }
}

export function AppShell() {
  const route = useRoute();
  const theme = useUserState((s) => s.settings.theme);
  const { classLogOpen } = useUi();
  useGlobalShortcuts();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route.path]);
  useEffect(() => {
    document.title = `${titleOf(route)} · Atlas`;
  }, [route]);

  const immersive = route.name === "sesion";
  return (
    <>
      <StarField fixed />
      {!immersive && <TopNav />}
      <div id="contenido" className="shell-main" tabIndex={-1}>
        <Suspense fallback={<div className="shell-suspense" aria-busy="true" />}>
          <Screen route={route} />
        </Suspense>
      </div>
      {!immersive && <BottomNav />}
      <ConceptPanelHost />
      <SearchPalette />
      <ClassLogDialog open={classLogOpen} onClose={closeClassLog} />
      <Celebrations />
      <Toaster />
    </>
  );
}
