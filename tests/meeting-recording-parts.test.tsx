// @vitest-environment happy-dom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MeetingRecordingParts } from "@/components/meeting-recording-parts";

describe("MeetingRecordingParts", () => {
  it("switches between resumed recording parts", () => {
    render(
      <MeetingRecordingParts
        parts={[
          {
            audioUrl: "/audio?recording=part-1",
            durationMs: 420_000,
            endedAt: "2026-07-22T17:07:00.000Z",
            id: "part-1",
            startedAt: "2026-07-22T17:00:00.000Z",
          },
          {
            audioUrl: "/audio?recording=part-2",
            durationMs: 900_000,
            endedAt: "2026-07-22T17:35:00.000Z",
            id: "part-2",
            startedAt: "2026-07-22T17:20:00.000Z",
          },
        ]}
      />,
    );

    expect(screen.getByText("Recording continued in 2 parts")).toBeTruthy();
    const audio = document.querySelector("audio");
    expect(audio?.getAttribute("src")).toBe("/audio?recording=part-1");

    fireEvent.click(screen.getByRole("button", { name: "Part 2" }));

    expect(document.querySelector("audio")?.getAttribute("src")).toBe(
      "/audio?recording=part-2",
    );
  });
});
