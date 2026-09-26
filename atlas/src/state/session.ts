// Sesión de FlipyERP Academy (modo multiusuario).
//
// En el Atlas original (sin academia) no hay /api/me: loadSession devuelve null
// y la app funciona como siempre, con un solo usuario y todas las asignaturas.

export type Role = "admin" | "formador" | "alumno";
export type AcademySession = {
  user: { id: string; email: string; name: string; role: Role };
  organization: { id: string; name: string };
  enrollment: { itineraryId: string | null; subjectIds: string[] };
};

let current: AcademySession | null = null;

/** Sesión cargada al arrancar (null en el modo de un solo usuario). */
export const session = (): AcademySession | null => current;

/** Lleva al login conservando la ruta actual para volver después. */
export function redirectToLogin(): never {
  const next = location.pathname + location.search + location.hash;
  location.href = `/login?next=${encodeURIComponent(next)}`;
  // La navegación ya está en marcha: nada de lo que venga después debe ejecutarse.
  throw new Error("Redirigiendo al login");
}

export async function loadSession(): Promise<AcademySession | null> {
  let res: Response;
  try {
    res = await fetch("/api/me", { cache: "no-store", credentials: "same-origin" });
  } catch {
    return null; // sin conexión: la app arranca con la caché local
  }
  if (res.status === 401) redirectToLogin();
  // Sin academia, /api/me no existe (404 o la página de la SPA como HTML).
  if (!res.ok || !(res.headers.get("content-type") ?? "").includes("application/json")) return null;
  current = (await res.json()) as AcademySession;
  return current;
}

export async function logout(): Promise<void> {
  try {
    await fetch("/api/auth/logout", {
      method: "POST", credentials: "same-origin",
      headers: { "content-type": "application/json" }, body: "{}",
    });
  } finally {
    location.href = "/login";
  }
}
