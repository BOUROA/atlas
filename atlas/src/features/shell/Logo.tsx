// Marca de Atlas: estrella de cuatro puntas dorada con halo (maqueta Observatorio).
export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg className="shell-logo" viewBox="0 0 32 32" width={size} height={size} aria-hidden="true" focusable="false">
      <circle cx="16" cy="16" r="15" className="shell-logo-halo" />
      <circle cx="16" cy="16" r="11.5" className="shell-logo-ring" />
      <path d="M16 3.5l1.7 10.8L28.5 16l-10.8 1.7L16 28.5l-1.7-10.8L3.5 16l10.8-1.7z" className="shell-logo-star" />
      <circle cx="16" cy="16" r="1.8" className="shell-logo-core" />
    </svg>
  );
}
