import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => {
  const supabase = {
    marker: "supabase-client",
    rpc: vi.fn(function (this: { marker?: string }, functionName: string, args: { p_event_ids: string[] }) {
      if (this?.marker !== "supabase-client") {
        throw new Error("supabase.rpc lost its client context");
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

import { fetchEventEngagementMetrics } from "@/lib/eventEngagementMetrics";
import { supabase } from "@/integrations/supabase/client";

describe("fetchEventEngagementMetrics", () => {
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
});
