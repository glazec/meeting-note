import { afterEach, describe, expect, it, vi } from "vitest";

const getCurrentUser = vi.fn();
const createUploadUrl = vi.fn();

vi.mock("@/lib/auth", () => ({
  getCurrentUser,
}));

vi.mock("@/lib/r2", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/r2")>();

  return {
    ...actual,
    createUploadUrl,
  };
});

async function postUpload(body: unknown) {
  const { POST } = await import("@/app/api/upload/route");

  return POST(
    new Request("https://app.example.com/api/upload", {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "content-type": "application/json",
      },
    }),
  );
}

const validBody = {
  teamId: "team_123",
  meetingId: "meeting_456",
  assetId: "asset_789",
  extension: "mp3",
  contentType: "audio/mpeg",
};

describe("POST /api/upload", () => {
  afterEach(() => {
    getCurrentUser.mockReset();
    createUploadUrl.mockReset();
    vi.resetModules();
  });

  it("returns 401 when the request is unauthenticated", async () => {
    getCurrentUser.mockResolvedValue(null);

    const response = await postUpload(validBody);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(createUploadUrl).not.toHaveBeenCalled();
  });

  it("returns a controlled 500 when signing fails", async () => {
    getCurrentUser.mockResolvedValue({
      id: "user_123",
      email: "user@example.com",
      name: null,
    });
    createUploadUrl.mockRejectedValue(new Error("missing R2 env"));

    const response = await postUpload(validBody);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Upload URL unavailable",
    });
  });

  it("returns 400 for unsafe object key segments", async () => {
    getCurrentUser.mockResolvedValue({
      id: "user_123",
      email: "user@example.com",
      name: null,
    });

    const response = await postUpload({ ...validBody, teamId: "../other" });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid upload request",
    });
    expect(createUploadUrl).not.toHaveBeenCalled();
  });
});
