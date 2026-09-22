import { redirect } from "next/navigation";
import type { Route } from "next";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  if (code) redirect(`/auth/callback?code=${encodeURIComponent(code)}` as Route);

  return (
    <main className="shell">
      <p className="eyebrow">Portuguese for You</p>
      <h1>The learning platform foundation is online.</h1>
      <p className="lede">
        The operational shell is ready for the next PFY specifications. Learning content and account
        features are intentionally not part of this baseline.
      </p>
      <a className="status" href="/api/health">
        Check application health <span aria-hidden="true">-&gt;</span>
      </a>
    </main>
  );
}
