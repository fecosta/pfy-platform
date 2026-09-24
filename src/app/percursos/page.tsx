import { SyllabusCard } from "@/app/content-components";
import { ContentNav } from "@/app/content-nav";
import { getPublishedSyllabi } from "@/lib/content/server";

export const dynamic = "force-dynamic";

export default async function PercursosPage() {
  const syllabi = await getPublishedSyllabi();
  return (
    <main className="content-shell">
      <ContentNav />
      <header className="content-header">
        <p className="eyebrow">Sequências pedagógicas</p>
        <h1>Percursos</h1>
        <p className="lede">
          Caminhos organizados de atividades canônicas, sem duplicar o conteúdo da biblioteca.
        </p>
      </header>
      <section className="content-grid" aria-label="Percursos publicados">
        {syllabi.map((syllabus) => (
          <SyllabusCard key={syllabus.id} syllabus={syllabus} />
        ))}
        {syllabi.length === 0 ? (
          <p className="empty-state">Nenhum percurso publicado ainda.</p>
        ) : null}
      </section>
    </main>
  );
}
