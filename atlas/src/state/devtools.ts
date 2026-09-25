// Solo en desarrollo: expone el store, las acciones y los derivados en
// window.__atlas para probar desde la consola del navegador.
import * as actions from "./actions";
import { getDayPlanView, getDerived, getQueue, getSubjectLevels, getSubjectPath } from "./derived";
import { store } from "./store";
import { catalog } from "./catalog";

declare global {
  interface Window {
    __atlas?: unknown;
  }
}

window.__atlas = { store, actions, getDerived, getQueue, getDayPlanView, getSubjectPath, getSubjectLevels, catalog };
