import Link from "next/link";
import type { Route } from "next";

export function ContentNav() {
  return (
    <nav className="content-nav" aria-label="Navegação principal">
      <Link href={"/explorar" as Route}>Explorar</Link>
      <Link href={"/percursos" as Route}>Percursos</Link>
      <Link href="/login">Entrar</Link>
    </nav>
  );
}
