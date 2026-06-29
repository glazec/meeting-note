import type { TranscriptJobStatus } from "@/lib/meeting-display-status";

export type MeetingTranslationStatus =
  | "not_started"
  | "not_needed"
  | "queued"
  | "running"
  | "partial"
  | "completed"
  | "failed";

export type MeetingTranslationSummary = {
  errorMessage?: string | null;
  hasTranslations: boolean;
  status: MeetingTranslationStatus;
  totalSegments: number;
  translatedSegments: number;
};

export function buildMeetingTranslationSummary(input: {
  errorMessage?: string | null;
  status?: TranscriptJobStatus | null;
  totalSegments: number;
  translatedSegments: number;
}): MeetingTranslationSummary {
  const totalSegments = Math.max(0, input.totalSegments);
  const translatedSegments = Math.min(
    Math.max(0, input.translatedSegments),
    totalSegments,
  );
  const hasTranslations = translatedSegments > 0;

  if (totalSegments === 0) {
    return withTranslationError(input.errorMessage, {
      hasTranslations: false,
      status: "not_started",
      totalSegments,
      translatedSegments,
    });
  }

  if (translatedSegments >= totalSegments) {
    return withTranslationError(input.errorMessage, {
      hasTranslations: true,
      status: "completed",
      totalSegments,
      translatedSegments,
    });
  }

  if (input.status === "completed") {
    return withTranslationError(input.errorMessage, {
      hasTranslations: false,
      status: "not_needed",
      totalSegments,
      translatedSegments,
    });
  }

  if (input.status === "queued" || input.status === "running") {
    return withTranslationError(input.errorMessage, {
      hasTranslations,
      status: input.status,
      totalSegments,
      translatedSegments,
    });
  }

  if (input.status === "failed") {
    return withTranslationError(input.errorMessage, {
      hasTranslations,
      status: "failed",
      totalSegments,
      translatedSegments,
    });
  }

  if (hasTranslations) {
    return withTranslationError(input.errorMessage, {
      hasTranslations,
      status: "partial",
      totalSegments,
      translatedSegments,
    });
  }

  return withTranslationError(input.errorMessage, {
    hasTranslations: false,
    status: "not_started",
    totalSegments,
    translatedSegments,
  });
}

export function getTranslationProgressLabel(summary: MeetingTranslationSummary) {
  return `${summary.translatedSegments} of ${summary.totalSegments} lines translated`;
}

export function isTranslationActive(status: MeetingTranslationStatus) {
  return status === "queued" || status === "running";
}

function withTranslationError(
  errorMessage: string | null | undefined,
  summary: Omit<MeetingTranslationSummary, "errorMessage">,
): MeetingTranslationSummary {
  const trimmedErrorMessage = errorMessage?.trim();

  if (!trimmedErrorMessage) {
    return summary;
  }

  return {
    ...summary,
    errorMessage: trimmedErrorMessage,
  };
}
