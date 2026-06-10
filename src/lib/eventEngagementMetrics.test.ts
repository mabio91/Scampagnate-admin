import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => {
  const supabase = {
    marker: "supabase-client",
    rpc: vi.fn(function (
      this: { marker?: string },
      functionName: string,
      args: { p_event_ids?: string[]; p_event_id?: string; p_kind?: string },
    ) {
      if (this?.marker !== "supabase-client") {
        throw new Error("supabase.rpc lost its client context");
      }

      if (functionName === "get_event_engagement_audience") {
        expect(args).toEqual({ p_event_id: "event-1", p_kind: "reminder" });

        return Promise.resolve({
          data: [
            {
              id: "reminder-1",
              user_id: "user-1",
              display_name: "Mario Rossi",
              email: "mario@example.com",
              phone: "+3900000000",
              instagram_handle: "mariorossi",
              avatar_url: null,
              created_at: "2026-06-10T12:00:00Z",
              status: "active_reminder",
            },
          ],
          error: null,
        });
      }

      expect(functionName).toBe("get_event_engagement_metrics");
      expect(args.p_event_ids).toEqual(["event-1", "event-2"]);

      return Promise.resolve({
        data: [
          {
            event_id: "event-1",
            saved_count: "3",
            opening_reminder_active_count: 1,
            opening_reminder_notified_count: "6",
            opening_notification_click_count: null,
          },
        ],
        error: null,
      });
    }),
  };

  return { supabase };
});

import { fetchEventEngagementAudience, fetchEventEngagementMetrics } from "@/lib/eventEngagementMetrics";
import { supabase } from "@/integrations/supabase/client";

describe("fetchEventEngagementMetrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls the Supabase RPC with the client context intact", async () => {
    const metrics = await fetchEventEngagementMetrics(["event-1", "event-1", "", "event-2"]);

    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(metrics).toEqual({
      "event-1": {
        event_id: "event-1",
        saved_count: 3,
        opening_reminder_active_count: 1,
        opening_reminder_notified_count: 6,
        opening_notification_click_count: 0,
      },
    });
  });

  it("loads engagement audience through the Supabase RPC", async () => {
    const members = await fetchEventEngagementAudience("event-1", "reminder");

    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(members).toEqual([
      {
        id: "reminder-1",
        user_id: "user-1",
        display_name: "Mario Rossi",
        email: "mario@example.com",
        phone: "+3900000000",
        instagram_handle: "mariorossi",
        avatar_url: null,
        created_at: "2026-06-10T12:00:00Z",
        status: "active_reminder",
      },
    ]);
  });
});
