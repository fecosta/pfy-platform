import { notFound, redirect } from "next/navigation";

import { ActivityComposition } from "@/app/content-components";
import { ContentNav } from "@/app/content-nav";
import { getPublishedActivity } from "@/lib/content/server";

export const dynamic = "force-dynamic";

export default async function ActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getPublishedActivity(id);
  if (result.status === "not-found") notFound();
  if (result.status === "authentication-required") {
    redirect(`/login?next=${encodeURIComponent(`/atividades/${id}`)}`);
  }

  if (result.status === "entitlement-required") {
    return (
      <main className="content-shell">
        <ContentNav />
        <section className="locked-content" aria-labelledby="locked-content-title">
          <p className="eyebrow">Conteúdo publicado</p>
          <h1 id="locked-content-title">Atividade disponível no catálogo</h1>
          <p className="lede">
            Esta atividade requer uma autorização de acesso que ainda não está disponível para esta
            conta.
          </p>
        </section>
      </main>
    );
  }

  const activity = result.activity;

  return (
    <main className="content-shell">
      <ContentNav />
      <header className="activity-header">
        <p className="eyebrow">Atividade{activity.level ? ` · ${activity.level}` : ""}</p>
        <h1>{activity.title}</h1>
        <p className="lede">{activity.summary}</p>
      </header>
      <ActivityComposition activity={activity} />
    </main>
  );
}
