import { redirect } from "next/navigation";
import type { Route } from "next";

import { readOwnProfile } from "@/lib/auth/authorization";

export default async function ProtectedPage() {
  const profile = await readOwnProfile();
  if (profile.status === "unauthenticated") redirect("/login" as Route);
  if (profile.status === "missing-domain-identity")
    redirect("/auth/registration-required" as Route);
  if (profile.status !== "allowed") redirect("/auth/error" as Route);

  return (
    <main className="shell">
      <p className="eyebrow">Authenticated PFY surface</p>
      <h1>Welcome, {profile.profile.first_name}.</h1>
      <p className="lede">
        Your canonical PFY identity is available to this server-rendered request.
      </p>
      <form action="/api/auth/logout" method="post">
        <button type="submit">Log out</button>
      </form>
    </main>
  );
}
