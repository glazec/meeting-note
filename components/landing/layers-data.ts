export const LAYERS = [
  {
    id: "recording",
    tag: "Layer 01 · Recording",
    title: "The meeting itself",
    body: "Bot joins Zoom, Meet, or Teams. Full-fidelity audio and video, captured without a local install.",
    chips: ["Zoom", "Google Meet", "Teams", "In-person"],
  },
  {
    id: "transcript",
    tag: "Layer 02 · Transcript",
    title: "Every word, with a speaker",
    body: "Diarized, timestamped, searchable the second the call ends. Correct a name once — it sticks.",
    chips: ["Diarized", "Timestamped", "37 languages"],
  },
  {
    id: "summary",
    tag: "Layer 03 · Summary",
    title: "The shape of the conversation",
    body: "Decisions, disagreements, and open questions — structured, not a wall of prose.",
    chips: ["Decisions", "Open questions", "Topics"],
  },
  {
    id: "insight",
    tag: "Layer 04 · Insight",
    title: "What your team should act on",
    body: "Owners, deadlines, and follow-ups pulled out and routed to the right person automatically.",
    chips: ["Owners", "Deadlines", "Follow-ups"],
  },
] as const;

export type Layer = (typeof LAYERS)[number];
