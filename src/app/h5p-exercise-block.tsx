"use client";

import { useEffect, useState } from "react";

interface H5pExerciseBlockProps {
  activityId: string;
  exerciseId: string;
}

type SessionState =
  | { status: "loading" }
  | { status: "ready"; runtimeUrl: string }
  | { status: "error"; message: string };

export function H5pExerciseBlock({ activityId, exerciseId }: H5pExerciseBlockProps) {
  const [state, setState] = useState<SessionState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        const response = await fetch("/api/h5p/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ activityId, exerciseId }),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(payload.error ?? `session-request-failed:${response.status}`);
        }

        const payload = (await response.json()) as { runtimeUrl: string };
        if (!cancelled) setState({ status: "ready", runtimeUrl: payload.runtimeUrl });
      } catch (error) {
        if (!cancelled) {
          setState({
            status: "error",
            message: error instanceof Error ? error.message : "unknown-error",
          });
        }
      }
    }

    void loadSession();
    return () => {
      cancelled = true;
    };
  }, [activityId, exerciseId]);

  if (state.status === "loading") {
    return (
      <section className="exercise-placeholder" aria-busy="true">
        <p className="card-kicker">Exercício</p>
        <p>Carregando exercício interativo…</p>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="exercise-placeholder">
        <p className="card-kicker">Exercício</p>
        <p>Não foi possível carregar o exercício: {state.message}</p>
      </section>
    );
  }

  return (
    <section className="exercise-frame" aria-label="Exercício interativo">
      <iframe
        allow="fullscreen"
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
        src={state.runtimeUrl}
        title="Exercício interativo"
      />
    </section>
  );
}
