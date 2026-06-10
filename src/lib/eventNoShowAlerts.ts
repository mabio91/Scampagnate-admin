import type { Database } from "@/integrations/supabase/types";

type EventStatus = Database["public"]["Enums"]["event_status"];
type RegistrationStatus = Database["public"]["Enums"]["registration_status"];

export const HIGH_NO_SHOW_EVENT_FILTER = "high-no-show";
export const HIGH_NO_SHOW_RATE_THRESHOLD = 0.4;
export const HIGH_NO_SHOW_MIN_REGISTRATIONS = 3;

export const NO_SHOW_ALERT_REGISTRATION_STATUSES: RegistrationStatus[] = [
  "registered",
  "paid",
  "deposit_paid",
  "attended",
  "no_show",
];

const noShowAlertRegistrationStatusSet = new Set<string>(NO_SHOW_ALERT_REGISTRATION_STATUSES);
const completedEventStatusSet = new Set<string>(["past", "completed"]);

export type EventNoShowAlertEvent = {
  id: string;
  date: string;
  status: EventStatus | string | null;
};

export type EventNoShowAlertRegistration = {
  event_id: string | null;
  status: RegistrationStatus | string | null;
};

export type EventNoShowStats = {
  eventId: string;
  total: number;
  noShows: number;
  noShowRate: number;
  isHighNoShow: boolean;
};

export const isNoShowAlertEligibleEvent = (
  event: EventNoShowAlertEvent,
  today: string,
) => completedEventStatusSet.has(event.status || "") || event.date < today;

export const computeEventNoShowStats = (
  registrations: EventNoShowAlertRegistration[],
) => {
  const statsByEvent: Record<string, Omit<EventNoShowStats, "noShowRate" | "isHighNoShow">> = {};

  registrations.forEach((registration) => {
    if (!registration.event_id || !noShowAlertRegistrationStatusSet.has(registration.status || "")) return;

    if (!statsByEvent[registration.event_id]) {
      statsByEvent[registration.event_id] = {
        eventId: registration.event_id,
        total: 0,
        noShows: 0,
      };
    }

    statsByEvent[registration.event_id].total += 1;
    if (registration.status === "no_show") {
      statsByEvent[registration.event_id].noShows += 1;
    }
  });

  return Object.values(statsByEvent).reduce<Record<string, EventNoShowStats>>((acc, stats) => {
    const noShowRate = stats.total > 0 ? stats.noShows / stats.total : 0;
    acc[stats.eventId] = {
      ...stats,
      noShowRate,
      isHighNoShow: stats.total >= HIGH_NO_SHOW_MIN_REGISTRATIONS && noShowRate > HIGH_NO_SHOW_RATE_THRESHOLD,
    };
    return acc;
  }, {});
};
