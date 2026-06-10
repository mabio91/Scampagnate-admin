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

type EngagementSourceRow = {
  id?: unknown;
  user_id?: unknown;
  created_at?: unknown;
  notified_at?: unknown;
};

type EngagementProfileRow = {
  id?: unknown;
  first_name?: unknown;
  last_name?: unknown;
  email?: unknown;
  phone?: unknown;
  instagram_handle?: unknown;
  avatar_url?: unknown;
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

const toProfileMap = (rows: EngagementProfileRow[]) =>
  rows.reduce<Record<string, EngagementProfileRow>>((acc, profile) => {
    const id = toOptionalString(profile.id);
    if (id) acc[id] = profile;
    return acc;
  }, {});

const getProfileDisplayName = (profile: EngagementProfileRow | undefined, userId: string) => {
  const name = [profile?.first_name, profile?.last_name]
    .map(toOptionalString)
    .filter(Boolean)
    .join(" ")
    .trim();
  return name || `Utente ${userId.slice(0, 8)}`;
};

const fetchProfilesByUserIds = async (userIds: string[]) => {
  if (userIds.length === 0) return {};

  const { data, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email, phone, instagram_handle, avatar_url")
    .in("id", userIds);
  if (error) throw error;

  return toProfileMap((data || []) as EngagementProfileRow[]);
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

  const query =
    type === "saved"
      ? supabase
          .from("saved_events")
          .select("id, user_id, created_at")
          .eq("event_id", eventId)
          .order("created_at", { ascending: false })
      : supabase
          .from("event_opening_reminders")
          .select("id, user_id, created_at, notified_at")
          .eq("event_id", eventId)
          .is("cancelled_at", null)
          .order("created_at", { ascending: false });

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data || []) as EngagementSourceRow[];
  const userIds = [...new Set(rows.map((row) => toOptionalString(row.user_id)).filter(Boolean))] as string[];
  const profilesById = await fetchProfilesByUserIds(userIds);

  return rows.flatMap((row) => {
    const userId = toOptionalString(row.user_id);
    const id = toOptionalString(row.id);
    if (!userId || !id) return [];

    const profile = profilesById[userId];
    const notifiedAt = toOptionalString(row.notified_at);
    return {
      id,
      user_id: userId,
      display_name: getProfileDisplayName(profile, userId),
      email: toOptionalString(profile?.email),
      phone: toOptionalString(profile?.phone),
      instagram_handle: toOptionalString(profile?.instagram_handle),
      avatar_url: toOptionalString(profile?.avatar_url),
      created_at: toOptionalString(row.created_at),
      status: type === "saved" ? "saved" : notifiedAt ? "notified_reminder" : "active_reminder",
    };
  });
};
