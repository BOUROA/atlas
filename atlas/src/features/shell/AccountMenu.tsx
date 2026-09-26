// FlipyERP Academy: persona conectada, acceso al panel (formadores y
// administradores) y salida. En el Atlas de un solo usuario no pinta nada.
import { LogOut, UsersRound } from "lucide-react";
import { logout, session } from "../../state/session";
import { IconButton } from "../../ui";

export function AccountMenu() {
  const s = session();
  if (!s) return null;
  const staff = s.user.role === "admin" || s.user.role === "formador";
  return (
    <>
      <span className="shell-chip shell-account" title={`${s.user.name} · ${s.organization.name}`}>
        <b className="shell-chip-rank">{s.user.name.split(" ")[0]}</b>
      </span>
      {staff && (
        <IconButton
          aria-label="Panel de formación"
          icon={<UsersRound />}
          tooltipSide="bottom"
          tooltipAlign="end"
          onClick={() => {
            location.href = "/admin";
          }}
        />
      )}
      <IconButton aria-label="Salir" icon={<LogOut />} tooltipSide="bottom" tooltipAlign="end" onClick={() => void logout()} />
    </>
  );
}
