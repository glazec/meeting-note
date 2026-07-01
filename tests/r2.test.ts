import { describe, expect, it } from "vitest";

import {
  buildMeetingObjectKey,
  buildPendingUploadObjectKey,
  parseR2Env,
} from "@/lib/r2";

describe("buildMeetingObjectKey", () => {
  it("builds the R2 object key for a meeting asset", () => {
    expect(
      buildMeetingObjectKey({
        teamId: "team_123",
        meetingId: "meeting_456",
        assetId: "asset_789",
        extension: "mp3",
      }),
    ).toBe("teams/team_123/meetings/meeting_456/assets/asset_789.mp3");
  });

  it("rejects traversal shaped segments", () => {
    expect(() =>
      buildMeetingObjectKey({
        teamId: "../other",
        meetingId: "meeting_456",
        assetId: "asset_789",
        extension: "mp3",
      }),
    ).toThrow("Unsafe object key segment");
  });

  it("rejects slash separated segments", () => {
    expect(() =>
      buildMeetingObjectKey({
        teamId: "team_123",
        meetingId: "a/b",
        assetId: "asset_789",
        extension: "mp3",
      }),
    ).toThrow("Unsafe object key segment");
  });
});

describe("buildPendingUploadObjectKey", () => {
  it("builds the R2 object key for a user scoped pending upload", () => {
    expect(
      buildPendingUploadObjectKey({
        userId: "user_123",
        uploadId: "upload_456",
        extension: "mp3",
      }),
    ).toBe("users/user_123/uploads/upload_456.mp3");
  });

  it("rejects unsafe user id segments", () => {
    expect(() =>
      buildPendingUploadObjectKey({
        userId: "user/123",
        uploadId: "upload_456",
        extension: "mp3",
      }),
    ).toThrow("Unsafe object key segment");
  });

  it("rejects unsafe upload id segments", () => {
    expect(() =>
      buildPendingUploadObjectKey({
        userId: "user_123",
        uploadId: "../upload",
        extension: "mp3",
      }),
    ).toThrow("Unsafe object key segment");
  });
});

describe("parseR2Env", () => {
  it("trims copied R2 credential values", () => {
    expect(
      parseR2Env({
        R2_ACCOUNT_ID: "account-id\n",
        R2_ACCESS_KEY_ID: "access-key-id\n",
        R2_SECRET_ACCESS_KEY: "secret-access-key\n",
        R2_BUCKET: "recordings\n",
      }),
    ).toEqual({
      R2_ACCOUNT_ID: "account-id",
      R2_ACCESS_KEY_ID: "access-key-id",
      R2_SECRET_ACCESS_KEY: "secret-access-key",
      R2_BUCKET: "recordings",
    });
  });

  it("removes copied escaped newline markers from R2 values", () => {
    expect(
      parseR2Env({
        R2_ACCOUNT_ID: "account-id\\n",
        R2_ACCESS_KEY_ID: "access-key-id\\n",
        R2_SECRET_ACCESS_KEY: "secret-access-key\\n",
        R2_BUCKET: "recordings\\n",
      }),
    ).toEqual({
      R2_ACCOUNT_ID: "account-id",
      R2_ACCESS_KEY_ID: "access-key-id",
      R2_SECRET_ACCESS_KEY: "secret-access-key",
      R2_BUCKET: "recordings",
    });
  });
});
