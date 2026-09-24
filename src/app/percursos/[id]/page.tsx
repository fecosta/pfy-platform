import Link from "next/link";
import { notFound } from "next/navigation";
import type { Route } from "next";

import { ContentNav } from "@/app/content-nav";
import { getPublishedSyllabus } from "@/lib/content/server";

export const dynamic = "force-dynamic";

export default async function PercursoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const syllabus = await getPublishedSyllabus(id);
  if (!syllabus) notFound();

  return (
    <main className="content-shell">
      <ContentNav />
      <header className="content-header">
        <p className="eyebrow">Percurso{syllabus.level ? ` · ${syllabus.level}` : ""}</p>
        <h1>{syllabus.title}</h1>
        <p className="lede">{syllabus.description}</p>
        {syllabus.expectedWorkload ? (
          <p className="metadata">Carga esperada: {syllabus.expectedWorkload}</p>
        ) : null}
      </header>
      <ol className="syllabus-list" aria-label="Atividades do percurso">
        {syllabus.activities.map(({ position, activity, pedagogicalMetadata }) => (
          <li key={activity.id} className="syllabus-item">
            <span className="sequence-number">{position.toString().padStart(2, "0")}</span>
            <div>
              <p className="card-kicker">Atividade</p>
              <h2>
                <Link href={`/atividades/${activity.id}` as Route}>{activity.title}</Link>
              </h2>
              <p>{activity.summary}</p>
              {typeof pedagogicalMetadata.purpose === "string" ? (
                <p className="metadata">Propósito: {pedagogicalMetadata.purpose}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      {syllabus.activities.length === 0 ? (
        <p className="empty-state">Este percurso ainda não tem atividades publicadas.</p>
      ) : null}
    </main>
  );
}
