import { ActivityCard } from "@/app/content-components";
import { ContentNav } from "@/app/content-nav";
import { getPublishedActivities } from "@/lib/content/server";

export const dynamic = "force-dynamic";

export default async function ExplorePage() {
  const activities = await getPublishedActivities();
  return (
    <main className="content-shell">
      <ContentNav />
      <header className="content-header">
        <p className="eyebrow">Biblioteca compartilhada</p>
        <h1>Explorar</h1>
        <p className="lede">
          Atividades publicadas para estudantes e professores, sempre com a mesma identidade
          canônica.
        </p>
      </header>
      <section className="content-grid" aria-label="Atividades publicadas">
        {activities.map((activity) => (
          <ActivityCard key={activity.id} activity={activity} />
        ))}
        {activities.length === 0 ? (
          <p className="empty-state">Nenhuma atividade publicada ainda.</p>
        ) : null}
      </section>
    </main>
  );
}
