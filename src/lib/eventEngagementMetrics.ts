import { supabase } from "@/integrations/supabase/client";

export type EventEngagementMetrics = {
  event_id: string;
  saved_count: number;
  opening_reminder_active_count: number;
  opening_reminder_notified_count: number;
  opening_notification_click_count: number;
};

export type EventEngagementAudienceType = "saved" | "reminder";

export type EventEngagementAudienceMember = {
  id: string;
  user_id: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  instagram_handle: string | null;
  avatar_url: string | null;
  created_at: string | null;
  status: "saved" | "active_reminder" | "notified_reminder";
};

type RawMetric = {
  event_id?: unknown;
  saved_count?: unknown;
  opening_reminder_active_count?: unknown;
  opening_reminder_notified_count?: unknown;
  opening_notification_click_count?: unknown;
};

type RawAudienceRow = {
  id?: unknown;
  user_id?: unknown;
  display_name?: unknown;
  email?: unknown;
  phone?: unknown;
  instagram_handle?: unknown;
  avatar_url?: unknown;
  created_at?: unknown;
  status?: unknown;
};

const toCount = (value: unknown) => Number(value || 0);

const toOptionalString = (value: unknown) => (typeof value === "string" && value.trim() ? value : null);

const toMetric = (row: RawMetric): EventEngagementMetrics => ({
  event_id: String(row.event_id),
  saved_count: toCount(row.saved_count),
  opening_reminder_active_count: toCount(row.opening_reminder_active_count),
  opening_reminder_notified_count: toCount(row.opening_reminder_notified_count),
  opening_notification_click_count: toCount(row.opening_notification_click_count),
});

const toAudienceStatus = (value: unknown, fallback: EventEngagementAudienceType): EventEngagementAudienceMember["status"] => {
  if (value === "active_reminder" || value === "notified_reminder" || value === "saved") return value;
  return fallback === "saved" ? "saved" : "active_reminder";
};

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

export const fetchEventEngagementAudience = async (
  eventId: string,
  type: EventEngagementAudienceType,
): Promise<EventEngagementAudienceMember[]> => {
  if (!eventId) return [];

  const { data, error } = await supabase.rpc("get_event_engagement_audience" as never, {
    p_event_id: eventId,
    p_kind: type,
  } as never);
  if (error) throw error;

  const rows = Array.isArray(data) ? (data as RawAudienceRow[]) : [];
  return rows.flatMap((row) => {
    const userId = toOptionalString(row.user_id);
    const id = toOptionalString(row.id);
    if (!userId || !id) return [];

    return {
      id,
      user_id: userId,
      display_name: toOptionalString(row.display_name) || `Utente ${userId.slice(0, 8)}`,
      email: toOptionalString(row.email),
      phone: toOptionalString(row.phone),
      instagram_handle: toOptionalString(row.instagram_handle),
      avatar_url: toOptionalString(row.avatar_url),
      created_at: toOptionalString(row.created_at),
      status: toAudienceStatus(row.status, type),
    };
  });
};
