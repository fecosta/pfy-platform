import { NextResponse } from "next/server";

import { hasValidEnv } from "@/lib/env";

export function GET() {
  const configured = hasValidEnv();

  return NextResponse.json(
    {
      status: configured ? "ok" : "misconfigured",
      service: "pfy-web",
    },
    { status: configured ? 200 : 503 },
  );
}
