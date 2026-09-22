import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loginEmailStatus: vi.fn(),
  provisionIdentity: vi.fn(),
  signInWithOtp: vi.fn(),
}));

vi.mock("@/lib/identity/server", () => ({
  loginEmailStatus: mocks.loginEmailStatus,
  provisionIdentity: mocks.provisionIdentity,
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ auth: { signInWithOtp: mocks.signInWithOtp } })),
}));

import { POST } from "@/app/api/auth/register/route";

function request(body: object, ip = "192.0.2.30"): Request {
  return new Request("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

describe("progressive registration boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loginEmailStatus.mockResolvedValue({ exists: false, authLinked: false });
    mocks.provisionIdentity.mockResolvedValue("pfy-user-id");
    mocks.signInWithOtp.mockResolvedValue({ error: null });
  });

  it("provisions once and explicitly permits Auth creation for a new user", async () => {
    const response = await POST(
      request({
        email: "  New.User@Example.COM ",
        firstName: "  Ana ",
        lastName: "Silva",
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ sent: true });
    expect(mocks.provisionIdentity).toHaveBeenCalledWith("new.user@example.com", "Ana", "Silva");
    expect(mocks.signInWithOtp.mock.calls[0][0]).toMatchObject({
      email: "new.user@example.com",
      options: { shouldCreateUser: true },
    });
  });

  it("uses the existing-user path when the email wins a concurrent race", async () => {
    mocks.loginEmailStatus.mockResolvedValue({ exists: true, authLinked: true });

    const response = await POST(
      request({ email: "race@example.com", firstName: "New", lastName: "Name" }, "192.0.2.31"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ sent: true });
    expect(mocks.provisionIdentity).not.toHaveBeenCalled();
    expect(mocks.signInWithOtp.mock.calls[0][0].options.shouldCreateUser).toBe(false);
  });

  it("does not provision for invalid names or email", async () => {
    const responses = await Promise.all([
      POST(request({ email: "bad", firstName: "Ana", lastName: "Silva" }, "192.0.2.32")),
      POST(
        request(
          { email: "invalid-name@example.com", firstName: " ", lastName: "Silva" },
          "192.0.2.33",
        ),
      ),
      POST(
        request(
          { email: "invalid-name-2@example.com", firstName: "Ana", lastName: " " },
          "192.0.2.34",
        ),
      ),
    ]);

    expect(responses.every((response) => response.status === 400)).toBe(true);
    expect(mocks.provisionIdentity).not.toHaveBeenCalled();
    expect(mocks.signInWithOtp).not.toHaveBeenCalled();
  });

  it("keeps the PFY identity when Magic Link delivery fails", async () => {
    mocks.signInWithOtp.mockResolvedValue({ error: new Error("mail service failure") });

    const response = await POST(
      request({ email: "retry@example.com", firstName: "Retry", lastName: "User" }, "192.0.2.35"),
    );

    expect(response.status).toBe(502);
    expect(mocks.provisionIdentity).toHaveBeenCalledOnce();
    expect(mocks.signInWithOtp).toHaveBeenCalledOnce();
  });

  it("shares the bounded email limiter with repeated registration attempts", async () => {
    const responses = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      responses.push(
        await POST(
          request(
            { email: "limited-registration@example.com", firstName: "Rate", lastName: "Limited" },
            "192.0.2.36",
          ),
        ),
      );
    }

    expect(responses.slice(0, 5).every((response) => response.status === 200)).toBe(true);
    expect(responses[5].status).toBe(429);
    expect(mocks.provisionIdentity).toHaveBeenCalledTimes(5);
  });
});
