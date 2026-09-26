// Raíz de Atlas: espera a cargar el estado (servidor local o caché) y monta el shell.
// #/ui (solo en desarrollo) muestra la galería de primitivas sin el shell.
import { lazy, Suspense, useEffect, useState } from "react";
import { AppShell } from "./features/shell/AppShell";
import { Logo } from "./features/shell/Logo";
import { useRoute } from "./state/router";
import { store } from "./state/store";
import { applyEnrollment } from "./state/catalog";
import { loadSession, type AcademySession } from "./state/session";
import { StarField } from "./ui";

const UiGallery = import.meta.env.DEV ? lazy(() => import("./features/ui-gallery/UiGallery")) : null;
if (import.meta.env.DEV) void import("./state/devtools");

const LAST_SESSION_KEY = "academy.lastSession";

/**
 * Arranque. En FlipyERP Academy: sesión → itinerario → caché del usuario →
 * estado. Sin academia (Atlas original), loadSession devuelve null y se
 * arranca como siempre.
 */
async function boot(): Promise<void> {
  let session = await loadSession();
  if (session) {
    try {
      localStorage.setItem(LAST_SESSION_KEY, JSON.stringify(session));
    } catch {
      /* sin almacenamiento */
    }
  } else {
    // Sin conexión: se reutilizan el usuario y el itinerario de la última
    // sesión de este navegador (la caché es la de ese usuario).
    try {
      const raw = localStorage.getItem(LAST_SESSION_KEY);
      session = raw ? (JSON.parse(raw) as AcademySession) : null;
    } catch {
      session = null;
    }
  }
  if (session) {
    applyEnrollment(session.enrollment.subjectIds);
    store.setCacheNamespace(session.user.id);
  }
  await store.init();
}

function LoadingScreen() {
  return (
    <>
      <StarField fixed />
      <div className="shell-loading" role="status" aria-label="Cargando Atlas">
        <Logo size={56} />
        <span>Atlas</span>
      </div>
    </>
  );
}

export function App() {
  const route = useRoute();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    void boot().finally(() => {
      if (alive) setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (UiGallery && route.name === "ui") {
    return (
      <Suspense fallback={null}>
        <UiGallery />
      </Suspense>
    );
  }
  return ready ? <AppShell /> : <LoadingScreen />;
}
