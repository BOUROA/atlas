// Raíz de Atlas: espera a cargar el estado (servidor local o caché) y monta el shell.
// #/ui (solo en desarrollo) muestra la galería de primitivas sin el shell.
import { lazy, Suspense, useEffect, useState } from "react";
import { AppShell } from "./features/shell/AppShell";
import { Logo } from "./features/shell/Logo";
import { useRoute } from "./state/router";
import { store } from "./state/store";
import { StarField } from "./ui";

const UiGallery = import.meta.env.DEV ? lazy(() => import("./features/ui-gallery/UiGallery")) : null;
if (import.meta.env.DEV) void import("./state/devtools");

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
    void store.init().finally(() => {
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
