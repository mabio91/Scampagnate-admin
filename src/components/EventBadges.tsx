import type { Tables } from "@/integrations/supabase/types";

type Event = Tables<"events">;

export const MANUAL_BADGE_OPTIONS = [
  { value: "evento_top", label: "EVENTO TOP", color: "bg-amber-500 text-white" },
  { value: "best_seller", label: "BEST SELLER", color: "bg-emerald-500 text-white" },
  { value: "consigliato", label: "CONSIGLIATO", color: "bg-blue-500 text-white" },
  { value: "prezzo_speciale", label: "PREZZO SPECIALE", color: "bg-purple-500 text-white" },
  { value: "early_bird", label: "EARLY BIRD", color: "bg-orange-500 text-white" },
] as const;

export type EventBadgeEntry = {
  key: string;
  label: string;
  color: string;
  auto: boolean;
};

const AUTO_BADGE_STYLES: Record<string, { label: string; color: string }> = {
  ultimi_posti: { label: "ULTIMI POSTI", color: "bg-red-500 text-white" },
  founding_event: { label: "FOUNDING EVENT", color: "bg-amber-600 text-white" },
  gratuito: { label: "GRATUITO", color: "bg-emerald-600 text-white" },
};

/**
 * Computes the visible badges for an event (max 2).
 * Priority: ULTIMI POSTI > FOUNDING EVENT > GRATUITO > manual badges
 */
export function getEventBadges(event: Partial<Event>): EventBadgeEntry[] {
  const result: EventBadgeEntry[] = [];

  // --- Automatic badges (computed from event data) ---

  // ULTIMI POSTI: fill rate >= 80%
  const spotsTotal = event.spots_total ?? 0;
  const spotsTaken = event.spots_taken ?? 0;
  if (spotsTotal > 0 && spotsTaken / spotsTotal >= 0.8) {
    result.push({ key: "ultimi_posti", ...AUTO_BADGE_STYLES.ultimi_posti, auto: true });
  }

  // FOUNDING EVENT: event restricted to founding members
  const accessRules = event.access_rules as any;
  const isFoundingEvent = accessRules?.required_badge_id &&
    // Check if the required badge name contains "founding" — but we can't know badge name here.
    // Instead, check exclusivity_tags or a dedicated flag. 
    // Simplest: check if event_badges contains "founding_event" OR if required_badge matches founding member badge.
    // We'll also check event_badges array for explicit "founding_event".
    false; // We'll add it from event_badges stored data below

  // GRATUITO: price = 0
  if ((event.price ?? 0) === 0 && event.payment_type === "free") {
    result.push({ key: "gratuito", ...AUTO_BADGE_STYLES.gratuito, auto: true });
  }

  // --- Manual badges from event_badges jsonb ---
  const storedBadges = (event.event_badges as any[]) || [];
  
  // Check for founding_event in stored badges (it's auto-detected on save)
  if (storedBadges.includes("founding_event")) {
    result.push({ key: "founding_event", ...AUTO_BADGE_STYLES.founding_event, auto: true });
  }

  for (const badge of storedBadges) {
    if (typeof badge === "string") {
      const manual = MANUAL_BADGE_OPTIONS.find((m) => m.value === badge);
      if (manual) {
        result.push({ key: manual.value, label: manual.label, color: manual.color, auto: false });
      }
      // Custom badge (free text) — stored as object { type: "custom", label: "..." }
    } else if (badge && typeof badge === "object" && badge.type === "custom" && badge.label) {
      result.push({ key: "custom", label: badge.label.toUpperCase(), color: "bg-muted-foreground text-white", auto: false });
    }
  }

  // De-duplicate by key
  const seen = new Set<string>();
  const unique = result.filter((b) => {
    if (seen.has(b.key)) return false;
    seen.add(b.key);
    return true;
  });

  // Sort by priority: ultimi_posti > founding_event > gratuito > manual
  const priority: Record<string, number> = {
    ultimi_posti: 0,
    founding_event: 1,
    gratuito: 2,
  };
  unique.sort((a, b) => (priority[a.key] ?? 10) - (priority[b.key] ?? 10));

  return unique.slice(0, 2);
}

/** Pill-style badge component for event cards/hero */
export function EventBadgePills({ event, className = "" }: { event: Partial<Event>; className?: string }) {
  const badges = getEventBadges(event);
  if (badges.length === 0) return null;

  return (
    <div className={`flex gap-1.5 ${className}`}>
      {badges.map((b) => (
        <span
          key={b.key}
          className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide shadow-sm ${b.color}`}
        >
          {b.label}
        </span>
      ))}
    </div>
  );
}

/**
 * Determines which auto-badges should be stored based on access_rules.
 * Call this when saving an event to auto-set founding_event badge.
 */
export function computeAutoBadgesForStorage(event: Partial<Event>, foundingBadgeId?: string): string[] {
  const auto: string[] = [];
  const accessRules = event.access_rules as any;
  
  // If required_badge_id matches the founding member badge
  if (foundingBadgeId && accessRules?.required_badge_id === foundingBadgeId) {
    auto.push("founding_event");
  }

  return auto;
}
