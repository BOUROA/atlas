// #/misiones: pestañas Principales · Pruebas · Élite · Estrellas guía · Camino (spec Rumbo §8, Camino §4).
import { Route } from "lucide-react";
import { currentSubjects, expeditions, guides, trials } from "../../state/catalog";
import { setQuery, useRoute } from "../../state/router";
import { Icons, Page, Tabs, TabPanel, type TabItem } from "../../ui";
import { PrincipalesTab } from "./rumbo/PrincipalesTab";
import { EliteTab } from "./rumbo/EliteTab";
import { PruebasTab } from "./rumbo/PruebasTab";
import { GuidesGallery } from "./GuidesGallery";
import { CaminoTab } from "./camino/CaminoTab";

type TabId = "principales" | "pruebas" | "elite" | "guia" | "camino";
const TAB_ITEMS: TabItem<TabId>[] = [
  { id: "principales", label: "Principales", count: currentSubjects.length, icon: <Icons.rumbo /> },
  { id: "pruebas", label: "Pruebas", count: trials.length, icon: <Icons.trials /> },
  { id: "elite", label: "Élite", count: expeditions.length, icon: <Icons.mission /> },
  { id: "guia", label: "Estrellas guía", count: guides.length, icon: <Icons.guide /> },
  { id: "camino", label: "Camino", count: currentSubjects.length, icon: <Route /> },
];

export function MissionsScreen() {
  const { query } = useRoute();
  const raw = query.get("tab");
  const active: TabId = raw === "pruebas" || raw === "elite" || raw === "guia" || raw === "camino" ? raw : "principales";

  return (
    <Page as="main" className="rumbo-page">
      <h1 className="rumbo-sr-only">Misiones</h1>
      <Tabs
        id="missions-tabs"
        aria-label="Misiones"
        items={TAB_ITEMS}
        value={active}
        onChange={(id) => setQuery({ tab: id === "principales" ? null : id })}
      />
      <TabPanel tabs="missions-tabs" tab={active}>
        {active === "principales" && <PrincipalesTab />}
        {active === "pruebas" && <PruebasTab />}
        {active === "elite" && <EliteTab />}
        {active === "guia" && <GuidesGallery />}
        {active === "camino" && <CaminoTab />}
      </TabPanel>
    </Page>
  );
}
