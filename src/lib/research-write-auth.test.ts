import { afterEach, describe, expect, it, vi } from "vitest";
import { isResearchWritePath, setResearchSignInPrompt, withResearchSignIn } from "./research-write-auth";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
const authRequired = () => json(401, { detail: { code: "AUTH_REQUIRED", message: "Sign in" } });

afterEach(() => setResearchSignInPrompt(null));

describe("isResearchWritePath", () => {
  it("matches research write routes only", () => {
    expect(isResearchWritePath("/api/v1/comparisons")).toBe(true);
    expect(isResearchWritePath("/api/v1/runs")).toBe(true);
    expect(isResearchWritePath("/api/v1/reports/surgivision-frame")).toBe(true);
    expect(isResearchWritePath("/api/v1/models/cvs-adaptnet/validate")).toBe(true);
    expect(isResearchWritePath("/api/v1/cases/openkbp%3Apt_201/dose-artifacts?file_name=a.csv")).toBe(true);
    expect(isResearchWritePath("/api/v1/research-reviews")).toBe(true);
    expect(isResearchWritePath("/api/v1/auth/local-login")).toBe(false);
    expect(isResearchWritePath("/api/v1/academy/attempts")).toBe(false);
    expect(isResearchWritePath("/api/v1/educator/drafts")).toBe(false);
  });
});

describe("withResearchSignIn", () => {
  it("asks for sign-in once and retries after a successful sign-in", async () => {
    const send = vi.fn().mockResolvedValueOnce(authRequired()).mockResolvedValueOnce(json(200, { ok: true }));
    const prompt = vi.fn().mockResolvedValue(true);
    setResearchSignInPrompt(prompt);
    const response = await withResearchSignIn("/api/v1/reports", send);
    expect(response.status).toBe(200);
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("returns the 401 when the user cancels the sign-in", async () => {
    const send = vi.fn().mockResolvedValue(authRequired());
    setResearchSignInPrompt(vi.fn().mockResolvedValue(false));
    expect((await withResearchSignIn("/api/v1/runs", send)).status).toBe(401);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("requests the dedicated reviewer session when a review route denies the current role", async () => {
    const send = vi.fn().mockResolvedValueOnce(json(403, { detail: { code: "ROLE_REQUIRED", message: "Use a reviewer account" } })).mockResolvedValueOnce(json(200, { ok: true }));
    const prompt = vi.fn().mockResolvedValue(true);
    setResearchSignInPrompt(prompt);
    const response = await withResearchSignIn("/api/v1/research-reviews", send);
    expect(response.status).toBe(200);
    expect(prompt).toHaveBeenCalledWith("dose_review");
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("never prompts for non-research paths, other errors, or without a registered prompt", async () => {
    const prompt = vi.fn().mockResolvedValue(true);
    setResearchSignInPrompt(prompt);
    expect((await withResearchSignIn("/api/v1/academy/attempts", vi.fn().mockResolvedValue(authRequired()))).status).toBe(401);
    expect((await withResearchSignIn("/api/v1/runs", vi.fn().mockResolvedValue(json(403, { detail: { code: "ROLE_REQUIRED" } })))).status).toBe(403);
    expect((await withResearchSignIn("/api/v1/runs", vi.fn().mockResolvedValue(json(401, { detail: { code: "INVALID_CREDENTIALS" } })))).status).toBe(401);
    expect(prompt).not.toHaveBeenCalled();
    setResearchSignInPrompt(null);
    expect((await withResearchSignIn("/api/v1/runs", vi.fn().mockResolvedValue(authRequired()))).status).toBe(401);
  });
});
