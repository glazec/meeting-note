import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const {
  getCalendarConnectionSummaryForWorkspace,
  getMeetingDashboardSummaryForWorkspace,
  getWorkspace,
  getWorkspaceAccessSummary,
  listMeetingLibraryPageForWorkspace,
  requireCurrentUser,
} = vi.hoisted(() => ({
  getCalendarConnectionSummaryForWorkspace: vi.fn(),
  getMeetingDashboardSummaryForWorkspace: vi.fn(),
  getWorkspace: vi.fn(),
  getWorkspaceAccessSummary: vi.fn(),
  listMeetingLibraryPageForWorkspace: vi.fn(),
  requireCurrentUser: vi.fn(),
}));

vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/calendar-automation-panel", () => ({
  CalendarAutomationPanel: () => <div />,
}));

vi.mock("@/lib/auth-guards", () => ({
  requireCurrentUser,
}));

vi.mock("@/lib/calendar-connection-queries", () => ({
  getCalendarConnectionSummaryForWorkspace,
}));

vi.mock("@/lib/meeting-queries", () => ({
  getMeetingDashboardSummaryForWorkspace,
  listMeetingLibraryPageForWorkspace,
}));

vi.mock("@/lib/workspace", () => ({
  getOrCreateWorkspaceForSessionUser: getWorkspace,
  getWorkspaceAccessSummary,
}));

describe("DashboardPage", () => {
  afterEach(() => {
    getCalendarConnectionSummaryForWorkspace.mockReset();
    getMeetingDashboardSummaryForWorkspace.mockReset();
    getWorkspace.mockReset();
    getWorkspaceAccessSummary.mockReset();
    listMeetingLibraryPageForWorkspace.mockReset();
    requireCurrentUser.mockReset();
    vi.resetModules();
  });

  it("uses search params for meeting library pagination", async () => {
    const workspace = {
      userId: "user_123",
      teamId: "team_123",
      domain: "iosg.vc",
      canCreateMeetings: true,
    };
    requireCurrentUser.mockResolvedValue({
      id: "auth_user_123",
      email: "member@iosg.vc",
      name: null,
    });
    getWorkspace.mockResolvedValue(workspace);
    getWorkspaceAccessSummary.mockResolvedValue({
      canCreateMeetings: true,
      hasExternalShares: false,
      hasWorkspaceMeetings: true,
      isSharedOnly: false,
    });
    getMeetingDashboardSummaryForWorkspace.mockResolvedValue({
      upcomingBotJoins: 0,
      readyTranscripts: 0,
      activeWork: 0,
      failedMeetings: 0,
      scheduledWithoutBot: 0,
      overdueScheduled: 0,
      needsAttention: 0,
      nextBotJoin: null,
    });
    getCalendarConnectionSummaryForWorkspace.mockResolvedValue(null);
    listMeetingLibraryPageForWorkspace.mockResolvedValue({
      meetings: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          title: "Ready transcript",
          platform: "google_meet",
          startedAt: "2026-06-27T12:00:00.000Z",
          status: "ready",
        },
      ],
      page: 2,
      pageSize: 50,
      hasPreviousPage: true,
      hasNextPage: true,
    });

    const { default: DashboardPage } = await import("@/app/dashboard/page");
    const html = renderToStaticMarkup(
      await DashboardPage({
        searchParams: Promise.resolve({
          page: "2",
          q: "founder",
          syncCalendar: "1",
        }),
      }),
    );

    expect(listMeetingLibraryPageForWorkspace).toHaveBeenCalledWith(workspace, {
      page: 2,
      query: "founder",
    });
    expect(html).toContain("Page 2");
    expect(html).toContain("/dashboard?q=founder&amp;syncCalendar=1");
    expect(html).toContain(
      "/dashboard?q=founder&amp;syncCalendar=1&amp;page=3",
    );
  });
});
