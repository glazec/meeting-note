import { afterEach, describe, expect, it, vi } from "vitest";

const { getSharedTranscriptByToken, requireCurrentUser } = vi.hoisted(() => ({
  getSharedTranscriptByToken: vi.fn(),
  requireCurrentUser: vi.fn(),
}));

vi.mock("@/lib/auth-guards", () => ({
  requireCurrentUser,
}));

vi.mock("@/lib/share-links", () => ({
  getSharedTranscriptByToken,
}));

describe("SharedTranscriptPage", () => {
  afterEach(() => {
    getSharedTranscriptByToken.mockReset();
    requireCurrentUser.mockReset();
    vi.resetModules();
  });

  it("requires sign in before reading token shared transcripts", async () => {
    requireCurrentUser.mockRejectedValue(
      new Error("NEXT_REDIRECT:/auth/sign-in"),
    );

    const { default: SharedTranscriptPage } = await import(
      "@/app/share/[token]/page"
    );

    await expect(
      SharedTranscriptPage({
        params: Promise.resolve({ token: "token_123" }),
      }),
    ).rejects.toThrow("NEXT_REDIRECT:/auth/sign-in");
    expect(getSharedTranscriptByToken).not.toHaveBeenCalled();
  });
});
