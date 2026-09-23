"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

type FlowState = "email" | "registration" | "sent";

export function LoginForm({ next }: { next: string }) {
  const [state, setState] = useState<FlowState>("email");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const firstNameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state === "registration") firstNameRef.current?.focus();
  }, [state]);

  async function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/request-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, next }),
      });
      const body = (await response.json()) as { registration_required?: boolean; error?: string };
      if (response.ok) {
        setState("sent");
      } else if (response.status === 409 && body.registration_required) {
        setState("registration");
      } else {
        setError(body.error ?? "Não foi possível continuar. Tente novamente.");
      }
    } catch {
      setError("Não foi possível continuar. Verifique sua conexão e tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function submitRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, firstName, lastName, next }),
      });
      const body = (await response.json()) as { sent?: boolean; error?: string };
      if (response.ok && body.sent) {
        setState("sent");
      } else {
        setError(body.error ?? "Não foi possível concluir o cadastro. Tente novamente.");
      }
    } catch {
      setError("Não foi possível concluir o cadastro. Verifique sua conexão e tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  if (state === "sent") {
    return (
      <section className="auth-confirmation" aria-labelledby="confirmation-title">
        <h2 id="confirmation-title">Verifique seu e-mail</h2>
        <p role="status">Enviamos um link de acesso para {email}.</p>
        <p>Abra o link nesse e-mail para entrar no PFY.</p>
        <button type="button" className="secondary-button" onClick={() => setState("email")}>
          Usar outro e-mail
        </button>
      </section>
    );
  }

  if (state === "registration") {
    return (
      <form
        className="auth-form"
        action="/api/auth/register"
        method="post"
        onSubmit={submitRegistration}
        noValidate
      >
        <p className="form-context">
          Vamos criar seu acesso. O link de acesso será enviado após o cadastro.
        </p>
        <label htmlFor="first-name">Nome</label>
        <input
          ref={firstNameRef}
          id="first-name"
          name="firstName"
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
          autoComplete="given-name"
          required
        />
        <label htmlFor="last-name">Sobrenome</label>
        <input
          id="last-name"
          name="lastName"
          value={lastName}
          onChange={(event) => setLastName(event.target.value)}
          autoComplete="family-name"
          required
        />
        <label htmlFor="registration-email">E-mail</label>
        <input id="registration-email" name="email" value={email} readOnly />
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy}>
          {busy ? "Enviando..." : "Cadastrar e enviar link"}
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            setState("email");
            setError(null);
          }}
        >
          Corrigir e-mail
        </button>
      </form>
    );
  }

  return (
    <form
      className="auth-form"
      action="/api/auth/request-link"
      method="post"
      onSubmit={submitEmail}
      noValidate
    >
      <label htmlFor="email">E-mail</label>
      <input
        id="email"
        name="email"
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        autoComplete="email"
        required
      />
      <input type="hidden" name="next" value={next} />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy}>
        {busy ? "Verificando..." : "Continuar"}
      </button>
    </form>
  );
}
