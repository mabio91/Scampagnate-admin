const ANALYTICS_EXCLUDED_EVENT_STATUSES = ["draft", "unpublished"] as const;
const ANALYTICS_EXCLUDED_EVENT_STATUS_SET = new Set<string>(ANALYTICS_EXCLUDED_EVENT_STATUSES);
type AnalyticsEventLike = { status?: string | null } | null | undefined;

export const ANALYTICS_EXCLUDED_EVENT_STATUS_FILTER = `(${ANALYTICS_EXCLUDED_EVENT_STATUSES.join(",")})`;

export const isAnalyticsEventStatus = (status: string | null | undefined) => {
  const normalized = String(status || "").trim().toLowerCase();
  return !ANALYTICS_EXCLUDED_EVENT_STATUS_SET.has(normalized);
};

export const isAnalyticsEvent = (event: AnalyticsEventLike) =>
  !!event && isAnalyticsEventStatus(event.status);

export const isAnalyticsRegistration = (registration: {
  events?: AnalyticsEventLike | AnalyticsEventLike[];
}) => {
  const event = Array.isArray(registration.events) ? registration.events[0] : registration.events;
  return isAnalyticsEvent(event);
};

export const applyAnalyticsEventStatusFilter = <T>(query: T, column = "status"): T =>
  (query as any).not(column, "in", ANALYTICS_EXCLUDED_EVENT_STATUS_FILTER);
