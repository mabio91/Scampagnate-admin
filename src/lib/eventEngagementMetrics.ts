import { supabase } from "@/integrations/supabase/client";

export type EventEngagementMetrics = {
  event_id: string;
  saved_count: number;
  opening_reminder_active_count: number;
  opening_reminder_notified_count: number;
  opening_notification_click_count: number;
};

type RawMetric = {
  event_id?: unknown;
  saved_count?: unknown;
  opening_reminder_active_count?: unknown;
  opening_reminder_notified_count?: unknown;
  opening_notification_click_count?: unknown;
};

const toCount = (value: unknown) => Number(value || 0);

const toMetric = (row: RawMetric): EventEngagementMetrics => ({
  event_id: String(row.event_id),
  saved_count: toCount(row.saved_count),
  opening_reminder_active_count: toCount(row.opening_reminder_active_count),
  opening_reminder_notified_count: toCount(row.opening_reminder_notified_count),
  opening_notification_click_count: toCount(row.opening_notification_click_count),
});

export const fetchEventEngagementMetrics = async (eventIds: string[]) => {
  const ids = [...new Set(eventIds.filter(Boolean))];
  if (ids.length === 0) return {} as Record<string, EventEngagementMetrics>;

  const { data, error } = await supabase.rpc("get_event_engagement_metrics" as never, {
    p_event_ids: ids,
  } as never);
  if (error) throw error;

  const rows = Array.isArray(data) ? (data as RawMetric[]) : [];
  return rows.reduce<Record<string, EventEngagementMetrics>>((acc, row) => {
    const metric = toMetric(row);
    acc[metric.event_id] = metric;
    return acc;
  }, {});
};

export const emptyEventEngagementMetrics = (eventId: string): EventEngagementMetrics => ({
  event_id: eventId,
  saved_count: 0,
  opening_reminder_active_count: 0,
  opening_reminder_notified_count: 0,
  opening_notification_click_count: 0,
});
