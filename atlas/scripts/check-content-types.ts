// Comprueba en tiempo de compilación que el contenido encaja con los tipos del dominio.
import type { Expedition, Legend, Profile } from "../src/domain/types";
import expeditions from "../content/expeditions.json";
import legends from "../content/legends.json";
import profiles from "../content/profiles.json";

export const e: Expedition[] = expeditions.expeditions as Expedition[];
export const l: Legend[] = legends.legends satisfies Legend[];
export const p: Profile[] = profiles.profiles satisfies Profile[];
