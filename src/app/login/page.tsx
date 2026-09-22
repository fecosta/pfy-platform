import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; next?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="auth-shell">
      <div className="auth-intro">
        <p className="eyebrow">Portuguese for You ~</p>
        <h1>Entre no PFY</h1>
        <p className="lede">Use o seu e-mail para entrar ou criar o seu acesso.</p>
      </div>
      <LoginForm next={params.next ?? "/protected"} />
    </main>
  );
}
