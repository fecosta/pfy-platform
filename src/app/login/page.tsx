export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; next?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="shell">
      <p className="eyebrow">Portuguese for You</p>
      <h1>Sign in with a Magic Link</h1>
      <p className="lede">Enter the email for an existing PFY identity.</p>
      {params.sent === "1" && <p role="status">Check your email for the login link.</p>}
      <form action="/api/auth/request-link" method="post">
        <label>
          Email
          <input name="email" type="email" required />
        </label>
        <input name="next" type="hidden" value={params.next ?? "/protected"} />
        <button type="submit">Send Magic Link</button>
      </form>
    </main>
  );
}
