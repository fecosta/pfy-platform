import { z } from "zod";

import { resolveCurrentUser } from "@/lib/auth/current-user";
import { authorizeExercisePlayback } from "@/lib/h5p/adapter";

const requestSchema = z.object({
  activityId: z.string().uuid(),
  exerciseId: z.string().uuid(),
});

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const currentUser = await resolveCurrentUser();
  if (currentUser.status !== "resolved") {
    return Response.json({ error: "authentication-required" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid-json" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid-request" }, { status: 400 });
  }

  const result = await authorizeExercisePlayback(
    currentUser.user.id,
    parsed.data.activityId,
    parsed.data.exerciseId,
  );

  if (!result.authorized) {
    const status = result.reason === "entitlement-required" ? 402 : 403;
    return Response.json({ error: result.reason }, { status });
  }

  return Response.json({
    runtimeUrl: result.runtimeUrl,
    // Lumi content ID is intentionally NOT exposed to the browser.
  });
}
