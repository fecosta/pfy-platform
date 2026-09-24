import { notFound } from "next/navigation";

import { ActivityComposition } from "@/app/content-components";
import { ContentNav } from "@/app/content-nav";
import { getPublishedActivity } from "@/lib/content/server";

export const dynamic = "force-dynamic";

export default async function ActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const activity = await getPublishedActivity(id);
  if (!activity) notFound();

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
