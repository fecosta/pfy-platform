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
      {/*
        SPEC-005 remediation: sandbox permissions reviewed after fixing
        runtime authorization (Finding 1). Each retained permission is
        required by H5P's own official embedding contract
        (https://h5p.org/embedding — "the iframe... must include" this exact
        permission set) and by representative content types in the corpus:
          - allow-scripts: H5P content is a JS application; required for any
            content type to run at all.
          - allow-same-origin: content types persist local state (e.g. video
            playback position, drag-and-drop progress) via the runtime
            origin's storage; without it every reload loses in-progress
            state. Because the runtime is a SEPARATE origin from the PFY app
            (ADR-001's isolated-runtime requirement), this grants the iframe
            access to the RUNTIME's origin only — not the parent PFY page's
            origin/cookies/session, which is what would make
            allow-same-origin + allow-scripts a sandbox-escape risk.
          - allow-forms: content types with fill-in/quiz inputs submit
            within the iframe.
          - allow-popups / allow-popups-to-escape-sandbox: content types
            with external reference links or the H5P "embed"/"view source"
            dialogs open a new tab; without allow-popups-to-escape-sandbox
            the opened tab would inherit this sandbox's restrictions too.
        Removing any of these breaks real, representative H5P content types
        rather than narrowing an actual attack surface — the isolation this
        SPEC requires comes from runtime authorization (token-gated content)
        and cross-origin isolation, not from further restricting the sandbox.
      */}
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
