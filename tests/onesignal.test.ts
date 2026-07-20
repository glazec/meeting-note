import { afterEach, describe, expect, it, vi } from "vitest";

describe("OneSignal vendor", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("sends a location reminder to the signed in user alias", async () => {
    vi.stubEnv("ONESIGNAL_REST_API_KEY", "rest-key\n");
    vi.stubEnv(
      "NEXT_PUBLIC_ONESIGNAL_APP_ID",
      "117c1d1c-ada4-4b49-bb2e-9f4b5cb747ef\n",
    );
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "notification_123" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { sendOneSignalLocationReminder } = await import(
      "@/lib/vendors/onesignal"
    );

    await expect(
      sendOneSignalLocationReminder({
        externalUserId: "11111111-1111-4111-8111-111111111111",
        meetingId: "22222222-2222-4222-8222-222222222222",
        meetingTitle: "Founder office visit",
        location: "IOSG 12F",
      }),
    ).resolves.toEqual({ id: "notification_123" });

    expect(fetchMock).toHaveBeenCalledWith("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        Authorization: "Key rest-key",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        app_id: "117c1d1c-ada4-4b49-bb2e-9f4b5cb747ef",
        target_channel: "push",
        isIos: true,
        isAndroid: true,
        isAnyWeb: true,
        include_aliases: {
          external_id: ["11111111-1111-4111-8111-111111111111"],
        },
        headings: { en: "Meeting starts soon" },
        contents: { en: "Founder office visit at IOSG 12F" },
        url: "https://tape.inevitable.tech/meetings/22222222-2222-4222-8222-222222222222/record",
      }),
    });
  });

  it("rejects OneSignal success responses with alias errors", async () => {
    vi.stubEnv("ONESIGNAL_REST_API_KEY", "rest-key\n");
    vi.stubEnv(
      "NEXT_PUBLIC_ONESIGNAL_APP_ID",
      "117c1d1c-ada4-4b49-bb2e-9f4b5cb747ef\n",
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: "",
            errors: {
              invalid_aliases: {
                external_id: ["11111111-1111-4111-8111-111111111111"],
              },
            },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      ),
    );

    const { sendOneSignalLocationReminder } = await import(
      "@/lib/vendors/onesignal"
    );

    await expect(
      sendOneSignalLocationReminder({
        externalUserId: "11111111-1111-4111-8111-111111111111",
        meetingId: "22222222-2222-4222-8222-222222222222",
        meetingTitle: "Founder office visit",
        location: "IOSG 12F",
      }),
    ).rejects.toThrow(
      "OneSignal notification failed: invalid_aliases.external_id",
    );
  });
});
