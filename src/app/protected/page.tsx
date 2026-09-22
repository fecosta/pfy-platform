import { redirect } from "next/navigation";
import type { Route } from "next";

import { resolveCurrentUser } from "@/lib/auth/current-user";

export default async function ProtectedPage() {
  const currentUser = await resolveCurrentUser();
  if (currentUser.status === "unauthenticated") redirect("/login" as Route);
  if (currentUser.status === "missing-domain-identity")
    redirect("/auth/registration-required" as Route);
  if (currentUser.status !== "resolved") redirect("/auth/error" as Route);

  return (
    <main className="shell">
      <p className="eyebrow">Authenticated PFY surface</p>
      <h1>Welcome, {currentUser.user.profile.first_name}.</h1>
      <p className="lede">
        Your canonical PFY identity is available to this server-rendered request.
      </p>
      <form action="/api/auth/logout" method="post">
        <button type="submit">Log out</button>
      </form>
    </main>
  );
}
