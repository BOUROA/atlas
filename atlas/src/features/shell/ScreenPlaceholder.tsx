// Marco provisional de pantalla mientras cada tarea construye la suya.
import type { ReactNode } from "react";
import { EmptyState, Page, Section } from "../../ui";

export function ScreenPlaceholder({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children?: ReactNode }) {
  return (
    <Page as="main">
      <Section card eyebrow={eyebrow} title={title}>
        {children}
        <EmptyState size="sm" tone="dashed" title="Esta pantalla se está construyendo" description={description} />
      </Section>
    </Page>
  );
}
