import { describe, expect, it } from "vitest";

import {
  computeEventNoShowStats,
  isNoShowAlertEligibleEvent,
} from "@/lib/eventNoShowAlerts";

describe("event no-show alert helpers", () => {
  it("flags events only when explicit no-show registrations are above 40 percent", () => {
    const stats = computeEventNoShowStats([
      { event_id: "event-1", status: "registered" },
      { event_id: "event-1", status: "paid" },
      { event_id: "event-1", status: "no_show" },
      { event_id: "event-1", status: "no_show" },
      { event_id: "event-2", status: "registered" },
      { event_id: "event-2", status: "paid" },
      { event_id: "event-2", status: "no_show" },
      { event_id: "event-3", status: "no_show" },
      { event_id: "event-3", status: "no_show" },
    ]);

    expect(stats["event-1"]).toMatchObject({
      total: 4,
      noShows: 2,
      noShowRate: 0.5,
      isHighNoShow: true,
    });
    expect(stats["event-2"]).toMatchObject({
      total: 3,
      noShows: 1,
      noShowRate: 1 / 3,
      isHighNoShow: false,
    });
    expect(stats["event-3"]).toMatchObject({
      total: 2,
      noShows: 2,
      noShowRate: 1,
      isHighNoShow: false,
    });
  });

  it("ignores registrations that should not count toward the alert denominator", () => {
    const stats = computeEventNoShowStats([
      { event_id: "event-1", status: "waitlist" },
      { event_id: "event-1", status: "cancelled" },
      { event_id: "event-1", status: "pending_approval" },
      { event_id: null, status: "no_show" },
    ]);

    expect(stats).toEqual({});
  });

  it("treats completed events and older dated events as eligible", () => {
    expect(isNoShowAlertEligibleEvent({ id: "event-1", status: "completed", date: "2026-06-12" }, "2026-06-10")).toBe(true);
    expect(isNoShowAlertEligibleEvent({ id: "event-2", status: "closed", date: "2026-06-09" }, "2026-06-10")).toBe(true);
    expect(isNoShowAlertEligibleEvent({ id: "event-3", status: "closed", date: "2026-06-12" }, "2026-06-10")).toBe(false);
  });
});
