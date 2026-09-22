export default function AuthErrorPage() {
  return (
    <main className="shell">
      <h1>Authentication could not be completed</h1>
      <p className="lede">The link may be invalid or expired. Request a new one to try again.</p>
      <a className="status" href="/login">
        Request another link
      </a>
    </main>
  );
}
