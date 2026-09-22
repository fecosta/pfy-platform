import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loginEmailExists: vi.fn(),
  signInWithOtp: vi.fn(),
}));

vi.mock("@/lib/identity/server", () => ({ loginEmailExists: mocks.loginEmailExists }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ auth: { signInWithOtp: mocks.signInWithOtp } })),
}));

import { POST } from "@/app/api/auth/request-link/route";

function request(email: string, ip: string): Request {
  return new Request("http://localhost/api/auth/request-link", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ email }),
  });
}

describe("request-link abuse boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loginEmailExists.mockImplementation(async (email: string) => email.startsWith("known"));
    mocks.signInWithOtp.mockResolvedValue({ error: null });
  });

  it("limits known and unknown email paths before the next directory lookup", async () => {
    const knownResponses = [];
    const unknownResponses = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      knownResponses.push(await POST(request("known-boundary@example.com", "192.0.2.10")));
      unknownResponses.push(await POST(request("unknown-boundary@example.com", "192.0.2.11")));
    }

    expect(knownResponses.slice(0, 5).every((response) => response.status === 200)).toBe(true);
    expect(unknownResponses.slice(0, 5).every((response) => response.status === 409)).toBe(true);
    expect(knownResponses[5].status).toBe(429);
    expect(unknownResponses[5].status).toBe(429);
    expect(await knownResponses[5].json()).toEqual(await unknownResponses[5].json());
    expect(mocks.loginEmailExists).toHaveBeenCalledTimes(10);
    expect(mocks.signInWithOtp).toHaveBeenCalledTimes(5);
  });
});
