"use client";

import { useState } from "react";

import type { MeetingRecordingPart } from "@/lib/meeting-queries";
import { Button } from "@/components/ui/button";

export function MeetingRecordingParts({
  parts,
}: {
  parts: MeetingRecordingPart[];
}) {
  const [activePartId, setActivePartId] = useState(parts[0]?.id ?? "");

  if (parts.length < 2) {
    return null;
  }

  const activeIndex = Math.max(
    0,
    parts.findIndex((part) => part.id === activePartId),
  );
  const activePart = parts[activeIndex];

  return (
    <section
      className="mb-5 rounded-lg border bg-background p-4"
      aria-labelledby="recording-parts-title"
    >
      <div>
        <h2 className="text-sm font-semibold" id="recording-parts-title">
          Recording continued in {parts.length} parts
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Each part stays attached to this meeting.
        </p>
      </div>
      <div
        className="mt-3 flex flex-wrap gap-2"
        role="group"
        aria-label="Recording parts"
      >
        {parts.map((part, index) => (
          <Button
            aria-pressed={part.id === activePart.id}
            key={part.id}
            onClick={() => setActivePartId(part.id)}
            size="sm"
            type="button"
            variant={part.id === activePart.id ? "default" : "outline"}
          >
            Part {index + 1}
          </Button>
        ))}
      </div>
      <audio
        className="mt-4 w-full"
        controls
        key={activePart.id}
        preload="metadata"
        src={activePart.audioUrl}
      />
    </section>
  );
}
