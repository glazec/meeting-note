import { describe, expect, it } from "vitest";

import {
  getMeetingShareMatchKeys,
  meetingsShareAnyMatchKey,
} from "@/lib/meeting-sharing";

describe("meeting sharing", () => {
  it("matches similar meetings by stable title or external participants", () => {
    const currentKeys = getMeetingShareMatchKeys({
      attendeeEmails: ["alice@nascent.xyz", "owner@iosg.vc"],
      title: "IOSG <> Nascent",
      workspaceDomain: "iosg.vc",
    });

    expect(currentKeys).toEqual([
      "title:iosg <> nascent",
      "participant:email:alice@nascent.xyz",
      "participant:domain:nascent.xyz",
    ]);
    expect(
      meetingsShareAnyMatchKey(
        currentKeys,
        getMeetingShareMatchKeys({
          attendeeEmails: ["alice@nascent.xyz"],
          title: "Quarterly update",
          workspaceDomain: "iosg.vc",
        }),
      ),
    ).toBe(true);
    expect(
      meetingsShareAnyMatchKey(
        currentKeys,
        getMeetingShareMatchKeys({
          attendeeEmails: ["bob@example.com"],
          title: "Unrelated call",
          workspaceDomain: "iosg.vc",
        }),
      ),
    ).toBe(false);
  });

  it("does not create broad title rules for generic meeting names", () => {
    expect(
      getMeetingShareMatchKeys({
        attendeeEmails: [],
        title: "Google Meet",
        workspaceDomain: "iosg.vc",
      }),
    ).toEqual([]);
  });
});
