type EventActivityRef = {
  id?: string | null;
  created_at?: string | null;
  events?: {
    id?: string | null;
    title?: string | null;
    date?: string | null;
    status?: string | null;
  } | null;
};

const PAST_EVENT_STATUSES = new Set(["past", "completed", "cancelled", "archived"]);

const parseEventDate = (date?: string | null): Date | null => {
  if (!date) return null;
  const [year, month, day] = date.slice(0, 10).split("-").map(Number);
  return year && month && day ? new Date(year, month - 1, day) : null;
};

const startOfLocalDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const eventSortTime = (activity: EventActivityRef, fallback: number) =>
  parseEventDate(activity.events?.date)?.getTime() ?? fallback;

const isPastActivity = (activity: EventActivityRef, referenceDate: Date) => {
  const normalizedStatus = activity.events?.status?.trim().toLowerCase();
  if (normalizedStatus && PAST_EVENT_STATUSES.has(normalizedStatus)) return true;
  const date = parseEventDate(activity.events?.date);
  return date ? startOfLocalDay(date) < startOfLocalDay(referenceDate) : false;
};

const compareFallback = (left: EventActivityRef, right: EventActivityRef) => {
  const titleCompare = (left.events?.title || "").localeCompare(right.events?.title || "", "it", { sensitivity: "base" });
  if (titleCompare !== 0) return titleCompare;
  return (right.created_at || "").localeCompare(left.created_at || "") || (left.id || "").localeCompare(right.id || "");
};

export const sortEventActivitiesByRelevantDate = <T extends EventActivityRef>(
  activities: T[],
  referenceDate = new Date()
): T[] =>
  [...activities].sort((left, right) => {
    const leftPast = isPastActivity(left, referenceDate);
    const rightPast = isPastActivity(right, referenceDate);
    if (leftPast !== rightPast) return leftPast ? 1 : -1;

    const leftTime = eventSortTime(left, leftPast ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY);
    const rightTime = eventSortTime(right, rightPast ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY);
    const dateCompare = leftPast ? rightTime - leftTime : leftTime - rightTime;
    return dateCompare || compareFallback(left, right);
  });
