import { redirect } from "next/navigation";
import type { Route } from "next";

import { ContentNav } from "@/app/content-nav";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  if (code) redirect(`/auth/callback?code=${encodeURIComponent(code)}` as Route);

  return (
    <main className="shell">
      <ContentNav />
      <p className="eyebrow">Portuguese for You</p>
      <h1>Aprender português, com propósito.</h1>
      <p className="lede">
        Explore atividades compostas e Percursos publicados na biblioteca compartilhada do PFY.
      </p>
      <a className="status" href="/explorar">
        Explorar atividades <span aria-hidden="true">-&gt;</span>
      </a>
    </main>
  );
}
