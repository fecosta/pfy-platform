import Link from "next/link";
import type { Route } from "next";

/* External media URLs are validated by the content read model before rendering. */
/* eslint-disable @next/next/no-img-element */

import type {
  Activity,
  ActivityBlock,
  ActivitySummary,
  SyllabusSummary,
} from "@/lib/content/types";

export function ActivityCard({ activity }: { activity: ActivitySummary }) {
  return (
    <article className="content-card">
      <p className="card-kicker">Atividade{activity.level ? ` · ${activity.level}` : ""}</p>
      <h2>{activity.title}</h2>
      <p>{activity.summary || "Uma atividade composta para aprender no seu ritmo."}</p>
      <Link className="text-link" href={`/atividades/${activity.id}` as Route}>
        Abrir atividade <span aria-hidden="true">-&gt;</span>
      </Link>
    </article>
  );
}

export function SyllabusCard({ syllabus }: { syllabus: SyllabusSummary }) {
  return (
    <article className="content-card">
      <p className="card-kicker">Percurso{syllabus.level ? ` · ${syllabus.level}` : ""}</p>
      <h2>{syllabus.title}</h2>
      <p>{syllabus.description || "Uma sequência organizada de atividades."}</p>
      <Link className="text-link" href={`/percursos/${syllabus.id}` as Route}>
        Ver percurso <span aria-hidden="true">-&gt;</span>
      </Link>
    </article>
  );
}

export function ActivityComposition({ activity }: { activity: Activity }) {
  return (
    <div className="composition">
      {activity.blocks.map((block) => (
        <ActivityBlockView key={block.id} block={block} />
      ))}
      {activity.blocks.length === 0 ? (
        <p className="empty-state">Esta atividade ainda não tem conteúdo publicado.</p>
      ) : null}
    </div>
  );
}

function ActivityBlockView({ block }: { block: ActivityBlock }) {
  switch (block.type) {
    case "heading":
      return <h2 className="composition-heading">{block.text}</h2>;
    case "editorial":
      return <p className="composition-copy">{block.text}</p>;
    case "reflection":
      return (
        <aside className="reflection-block">
          <strong>Para refletir</strong>
          <p>{block.prompt}</p>
        </aside>
      );
    case "image":
    case "infographic":
      return (
        <figure className="media-block">
          {/* External media URLs are validated before rendering. */}
          <img src={block.src} alt={block.alt} />
          <figcaption>{block.alt}</figcaption>
        </figure>
      );
    case "video":
      return (
        <div className="media-block">
          <video controls src={block.src}>
            {block.title ?? "Vídeo da atividade"}
          </video>
          {block.title ? <p>{block.title}</p> : null}
        </div>
      );
    case "embed":
      return (
        <div className="embed-block">
          <a href={block.url} target="_blank" rel="noreferrer">
            {block.title ?? "Abrir conteúdo externo"}
          </a>
        </div>
      );
    case "exercise":
      return (
        <section className="exercise-placeholder">
          <p className="card-kicker">Exercício</p>
          <p>Este exercício interativo será disponibilizado em uma etapa futura.</p>
        </section>
      );
  }
}
