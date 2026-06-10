import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, MoreHorizontal, Eye, Edit2, Trash2, Plus, Upload, X, ArrowUp, ArrowDown, Image as ImageIcon, Loader2, Shield, Lock, Star, Users, Award, Crown, CheckCircle2, DollarSign, Tag, Sparkles, Copy, MessageCircle, CalendarX, CloudSun, Thermometer, MapPin, Package, Car, FileText, Bookmark, BellRing } from "lucide-react";
import { MANUAL_BADGE_OPTIONS, EventBadgePills } from "@/components/EventBadges";
import { RichTextEditor } from "@/components/RichTextEditor";
import RefreshButton from "@/components/RefreshButton";
import { RowActionButton, RowActionCell } from "@/components/RowActions";
import { useTrekkingDifficultyLevels } from "@/hooks/useTrekkingDifficultyLevels";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { useLanguage } from "@/i18n/LanguageContext";
import { GoogleAddressInput } from "@/components/GoogleAddressInput";
import ImageCropDialog from "@/components/ImageCropDialog";
import { HOME_CARD_IMAGE_FIELD, getEventHomeCardImageUrl } from "@/lib/eventImages";
import { compressImageForUpload } from "@/lib/imageCompression";
import { isGeneratedPriceOptionName } from "@/lib/priceOptions";
import { normalizeWhatsappGroupUrl } from "@/lib/eventWhatsapp";
import { fetchEventEngagementAudience, fetchEventEngagementMetrics, type EventEngagementAudienceType } from "@/lib/eventEngagementMetrics";
import { FIT_SCORE_EVENT_SECONDARY_MAX, INTEREST_CATEGORY_OPTIONS } from "@/lib/fitScoreCategories";

type Event = Tables<"events">;
type EventWithCategory = Event & {
  event_categories: { name: string; icon: string } | null;
  event_price_options?: { id: string }[] | null;
};
type EngagementDetailSelection = {
  event: EventWithCategory;
  type: EventEngagementAudienceType;
};
type PaymentType = "free" | "paid" | "deposit" | "location";
type BalancePaymentMode = "online" | "on_site";
type EventPeriodFilter = "upcoming" | "all" | "past";

const EVENT_PERIOD_FILTERS: EventPeriodFilter[] = ["upcoming", "all", "past"];

const getLocalDateString = () => {
  const today = new Date();
  const timezoneOffset = today.getTimezoneOffset() * 60 * 1000;
  return new Date(today.getTime() - timezoneOffset).toISOString().slice(0, 10);
};

const isEventPast = (event: Event, today = getLocalDateString()) =>
  ["past", "completed"].includes(event.status) || event.date < today;

const statusColors: Record<string, string> = {
  available: "text-success border-success/30 bg-success/10",
  published: "text-success border-success/30 bg-success/10",
  open: "text-success border-success/30 bg-success/10",
  upcoming: "text-warning border-warning/30 bg-warning/10",
  full: "text-warning border-warning/30 bg-warning/10",
  closed: "text-destructive border-destructive/30 bg-destructive/10",
  rescheduled: "text-warning border-warning/30 bg-warning/10",
  cancelled: "text-destructive border-destructive/30 bg-destructive/10",
  draft: "text-muted-foreground border-muted-foreground/30 bg-muted/50",
  unpublished: "text-muted-foreground border-muted-foreground/30 bg-muted/50",
  past: "text-muted-foreground border-muted-foreground/30 bg-muted/50",
  completed: "text-muted-foreground border-muted-foreground/30 bg-muted/50",
};
const visibilityColors: Record<string, string> = {
  public: "text-success border-success/30",
  private: "text-primary border-primary/30",
  hidden: "text-muted-foreground border-muted-foreground/30",
};

const normalizeEditableEventStatus = (status?: string | null) => {
  if (status === "available" || status === "published") return "open";
  if (status === "unpublished") return "draft";
  if (status === "past" || status === "completed") return "closed";
  return ["draft", "upcoming", "open", "closed", "full", "rescheduled", "cancelled"].includes(status || "")
    ? status!
    : "open";
};

const canSaveIncompleteEventDraft = (status?: string | null) =>
  normalizeEditableEventStatus(status) === "draft";

const engagementAudienceLabels: Record<EventEngagementAudienceType, { title: string; empty: string }> = {
  saved: {
    title: "Utenti che hanno salvato",
    empty: "Nessun utente ha ancora salvato questo evento.",
  },
  reminder: {
    title: "Utenti con reminder",
    empty: "Nessun utente ha ancora attivato il reminder.",
  },
};

const formatEngagementAudienceDate = (value: string | null) => {
  if (!value) return "Data non disponibile";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data non disponibile";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

/* ══════ Types ══════ */
type PricingRule = {
  id: string;
  isNew?: boolean;
  name: string;
  price: number;
  original_price?: number | null;
  condition: string;
  condition_operator?: string;
  condition_numeric_value?: number | null;
  condition_value?: string[] | null;
  is_promotional?: boolean;
  promo_start?: string | null;
  promo_end?: string | null;
  payment_type?: PaymentType;
  deposit_amount?: number | null;
  balance_amount?: number | null;
  balance_payment_mode?: BalancePaymentMode | null;
  has_dedicated_spots?: boolean;
  dedicated_spots?: number | null;
  spots_taken?: number | null;
};

type RegistrationField = { label: string; type: string; required: boolean; options?: string[] };
type AccessRuleEnforcement = "hard" | "soft";
type AccessRuleType =
  | "min_trekking_events"
  | "min_attended_events"
  | "min_activities"
  | "require_badge"
  | "require_membership"
  | "manual_approval"
  | "min_level"
  | "min_experience"
  | "min_activity_frequency";
type CanonicalAccessRule = {
  type: AccessRuleType;
  value?: number | string;
  badge_id?: string;
  badge_ids?: string[];
  enforcement?: AccessRuleEnforcement;
};
type AccessRules = {
  rules?: CanonicalAccessRule[];
  min_level?: number | null;
  min_experiences?: number | null;
  min_experience?: number | null;
  min_activity_frequency?: string | null;
  min_trekking_events?: number | null;
  min_activities?: number | null;
  min_attended_events?: number | null;
  required_badge_id?: string | null; // legacy single
  required_badge_ids?: string[] | null;
  require_active_membership?: boolean;
  require_manual_approval?: boolean;
  restriction_message?: string | null;
  exclusivity_label?: string | null;
  pricing_rules?: PricingRule[];
};

type AdditionalFields = {
  closing_sentence?: string | null;
  waiting_list_enabled?: boolean;
  weather_override_condition?: string | null;
  weather_override_temp_min?: number | null;
  weather_override_temp_max?: number | null;
  weather_override_temp_avg?: number | null;
  weather_override_temp?: number | null;
  weather_override?: { weather_condition?: string; temp_min?: number | null; temp_max?: number | null; temp_avg?: number | null };
  ask_car_availability?: boolean;
  car_availability_enabled?: boolean;
  show_car_availability?: boolean;
  home_card_image_url?: string | null;
  fields?: RegistrationField[];
  custom_fields?: RegistrationField[];
  fit_score_main_category?: string | null;
  fit_score_secondary_categories?: string[];
  duration_unit?: string;
};

type LocalMeetingPoint = { _key: string; id?: string; name: string; location: string; time: string; notes: string; sort_order: number };
type EquipmentItem = { name: string; is_mandatory: boolean; notes: string };
type AttendanceBadgeEntry = { type: "attendance_badge"; badge_id: string };
type GalleryImage = { url: string; order: number };
type StaffProfileSearchResult = Pick<Tables<"profiles">, "id" | "first_name" | "last_name" | "email" | "avatar_url">;
type EventStaffRow = Pick<Tables<"event_staff">, "id" | "profile_id" | "display_name" | "role_label" | "avatar_url" | "is_public" | "sort_order">;
type LocalEventStaff = {
  _key: string;
  id?: string;
  profile_id: string | null;
  display_name: string;
  role_label: string;
  avatar_url: string | null;
  is_public: boolean;
  profileSearch: string;
};

/* ══════ Constants ══════ */
const CANCELLATION_POLICY_OPTIONS = [
  { value: "flexible_24h", label: "Flessibile 24h" },
  { value: "flexible_48h", label: "Flessibile 48h" },
  { value: "non_refundable", label: "Non rimborsabile" },
];

const LEGACY_CANCELLATION_POLICY_MAP: Record<string, string> = {
  flexible: "flexible_24h",
  flessibile: "flexible_24h",
  "cancellazione gratuita fino a 24h prima": "flexible_24h",
  "cancellazione gratuita fino a 48h prima": "flexible_48h",
  "cancellazione gratuita fino a 7 giorni prima": "flexible_48h",
  moderate: "flexible_48h",
  moderata: "flexible_48h",
  strict: "non_refundable",
  rigida: "non_refundable",
  custom: "non_refundable",
  non_refundable: "non_refundable",
  "nessun rimborso": "non_refundable",
  "rimborso parziale (50%)": "non_refundable",
};

const normalizeCancellationPolicy = (value: string | null | undefined) => {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return "flexible_24h";
  const prefix = normalized.split(":", 1)[0];
  return LEGACY_CANCELLATION_POLICY_MAP[normalized]
    || LEGACY_CANCELLATION_POLICY_MAP[prefix]
    || (["flexible_24h", "flexible_48h", "non_refundable"].includes(normalized) ? normalized : "flexible_24h");
};

const PRICING_CONDITIONS = [
  { value: "everyone", label: "Tutti", description: "Visibile a tutti gli utenti" },
  { value: "active_members", label: "Soci attivi", description: "Utenti con tessera attiva" },
  { value: "new_users", label: "Nuovi utenti (0 eventi)", description: "Utenti senza eventi" },
  { value: "experienced_users", label: "Utenti esperti (1+ eventi)", description: "Utenti con almeno 1 evento" },
  { value: "loyal_participants", label: "Partecipanti fedeli (5+ eventi)", description: "Utenti con 5+ eventi" },
  { value: "specific_badge", label: "Badge / Livello specifico", description: "Seleziona badge o livelli" },
  { value: "trekking_count", label: "Numero trekking", description: "Basato sul numero di trekking completati" },
  { value: "events_count", label: "Numero eventi", description: "Basato sul numero totale di eventi" },
];

const CONDITION_OPERATORS = [
  { value: ">", label: ">" },
  { value: ">=", label: "≥" },
  { value: "=", label: "=" },
  { value: "<=", label: "≤" },
  { value: "<", label: "<" },
];

const WEATHER_OPTIONS = [
  { value: "sereno", emoji: "☀️", label: "Sereno" },
  { value: "parzialmente_nuvoloso", emoji: "🌤", label: "Parzialmente nuvoloso" },
  { value: "nuvoloso", emoji: "☁️", label: "Nuvoloso" },
  { value: "pioggia_debole", emoji: "🌦️", label: "Pioggia debole" },
  { value: "pioggia", emoji: "🌧", label: "Pioggia" },
  { value: "temporale", emoji: "⛈", label: "Temporale" },
  { value: "ventoso", emoji: "🌬", label: "Ventoso" },
  { value: "neve", emoji: "❄️", label: "Neve" },
  { value: "nebbia", emoji: "🌫", label: "Nebbia" },
];

const EVENT_CLOSING_SENTENCES = [
  "Porta leggerezza, al resto pensiamo noi",
  "Una community che arriva per i sentieri... e resta per le persone",
  "Il difficile è venire. Poi non vorrai più andare via",
  "Fidati: sarà una di quelle giornate che ricordi",
  "Vieni con lo spirito giusto - il resto viene da sé",
  "Qui si conoscono persone, non solo posti",
];

const normalizeEventClosingSentence = (sentence?: string | null) => {
  if (!sentence) return "";
  return sentence.replace(/^(?:✨\s*)+/u, "").trim();
};

const ACTIVITY_FREQUENCY_OPTIONS = [
  { value: "1", label: "Raramente" },
  { value: "2", label: "1-2 volte a settimana" },
  { value: "3", label: "Più di 2 volte a settimana" },
];
const LEGACY_ACTIVITY_FREQUENCY_MAP: Record<string, string> = {
  sedentario: "1",
  occasionale: "1",
  raramente: "1",
  settimanale: "2",
  "1-2 volte a settimana": "2",
  frequente: "3",
  quotidiano: "3",
  "più di 2 volte a settimana": "3",
  "piu di 2 volte a settimana": "3",
};
const STAFF_ROLE_PRESETS = ["STAFF", "FOTOGRAFO", "GUIDA"];
const CUSTOM_STAFF_ROLE_VALUE = "__custom__";

const emptyEvent: Record<string, any> = {
  title: "", description: "", location: "", location_label: "", date: "", time: "09:00",
  spots_total: 20, reserved_spots: 0, price: 0, deposit: null, payment_type: "free",
  status: "draft", visibility: "public", organizer_name: "", organizer_id: null,
  category_id: null, image_url: "", gallery_images: [], access_rules: null,
  whatsapp_group_url: "",
  featured: false, cancellation_policy: "flexible_24h", difficulty: null, duration: null,
  distance: null, elevation: null, event_badges: [], equipment_list: [],
  additional_fields: { waiting_list_enabled: true, fields: [], custom_fields: [] },
};

/* ══════ Helpers ══════ */
const parseMeasure = (val: string | null | undefined): string => {
  if (!val) return "";
  const m = val.match(/^([\d.,]+)/);
  return m ? m[1] : val;
};
const buildMeasure = (num: string, unit: string): string | null => {
  if (!num) return null;
  return `${num} ${unit}`;
};

const normalizeGalleryImages = (value: unknown): GalleryImage[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index): GalleryImage | null => {
      if (typeof item === "string") {
        return item ? { url: item, order: index } : null;
      }

      if (item && typeof item === "object" && typeof (item as any).url === "string") {
        const order = typeof (item as any).order === "number" ? (item as any).order : index;
        return { url: (item as any).url, order };
      }

      return null;
    })
    .filter((item): item is GalleryImage => Boolean(item?.url))
    .sort((a, b) => a.order - b.order)
    .map((item, index) => ({ ...item, order: index }));
};

const isPlainRecord = (value: unknown): value is Record<string, any> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const normalizeRegistrationFields = (value: unknown): RegistrationField[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((field): RegistrationField | null => {
      if (!isPlainRecord(field)) return null;
      const label = String(field.label || "").trim();
      if (!label) return null;
      const rawType = String(field.type || "text").trim().toLowerCase();
      const type = rawType === "select" || rawType === "dropdown" ? "select" : "text";
      const options = Array.isArray(field.options)
        ? field.options.map((option: unknown) => String(option).trim()).filter(Boolean)
        : typeof field.options === "string"
          ? field.options.split(",").map((option: string) => option.trim()).filter(Boolean)
          : [];
      return {
        label,
        type,
        required: Boolean(field.required),
        ...(type === "select" && options.length ? { options } : {}),
      };
    })
    .filter((field): field is RegistrationField => Boolean(field));
};

const normalizeActivityFrequencyValue = (value: unknown): string | null => {
  if (value == null || value === "") return null;
  const raw = String(value).trim().toLowerCase();
  const numeric = Number(raw);
  if (Number.isFinite(numeric) && numeric > 0) return String(Math.min(3, Math.max(1, Math.round(numeric))));
  return LEGACY_ACTIVITY_FREQUENCY_MAP[raw] || null;
};

const normalizeAdditionalFields = (value: unknown): AdditionalFields => {
  const raw = isPlainRecord(value) ? { ...value } as AdditionalFields : {};
  const fields = normalizeRegistrationFields(raw.fields || raw.custom_fields);
  const legacyWeather = isPlainRecord(raw.weather_override) ? raw.weather_override : {};
  const askCarAvailability = Boolean(
    raw.ask_car_availability ?? raw.car_availability_enabled ?? raw.show_car_availability,
  );

  return {
    ...raw,
    fields,
    custom_fields: fields,
    ask_car_availability: askCarAvailability,
    show_car_availability: askCarAvailability,
    weather_override_condition: raw.weather_override_condition ?? legacyWeather.weather_condition ?? null,
    weather_override_temp_min: raw.weather_override_temp_min ?? legacyWeather.temp_min ?? null,
    weather_override_temp_max: raw.weather_override_temp_max ?? legacyWeather.temp_max ?? null,
    weather_override_temp_avg: raw.weather_override_temp_avg ?? raw.weather_override_temp ?? legacyWeather.temp_avg ?? null,
  };
};

const buildAdditionalFieldsForStorage = (value: unknown): AdditionalFields => {
  const raw = isPlainRecord(value) ? value : {};
  const normalized = normalizeAdditionalFields(value);
  const secondary = Array.isArray(normalized.fit_score_secondary_categories)
    ? normalized.fit_score_secondary_categories.filter(Boolean).slice(0, FIT_SCORE_EVENT_SECONDARY_MAX)
    : [];
  const next: AdditionalFields = {
    ...normalized,
    fields: normalizeRegistrationFields(normalized.fields),
    custom_fields: normalizeRegistrationFields(normalized.fields),
    ask_car_availability: Boolean(normalized.ask_car_availability),
    waiting_list_enabled: Boolean(normalized.waiting_list_enabled),
    fit_score_main_category: normalized.fit_score_main_category || null,
    fit_score_secondary_categories: secondary,
    weather_override_condition: normalized.weather_override_condition || null,
    weather_override_temp_min: normalized.weather_override_temp_min ?? null,
    weather_override_temp_max: normalized.weather_override_temp_max ?? null,
    weather_override_temp_avg: normalized.weather_override_temp_avg ?? null,
  };

  delete next.weather_override;
  delete next.weather_override_temp;
  if ("car_availability_enabled" in raw) {
    next.car_availability_enabled = Boolean(normalized.ask_car_availability);
  } else {
    delete next.car_availability_enabled;
  }
  if ("show_car_availability" in raw) {
    next.show_car_availability = Boolean(normalized.ask_car_availability);
  } else {
    delete next.show_car_availability;
  }
  return next;
};

const numberRuleValue = (value: unknown): number | null => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const getRuleValue = (rules: CanonicalAccessRule[], type: AccessRuleType): number | null =>
  numberRuleValue(rules.find((rule) => rule.type === type)?.value);

const getRequiredBadgeIdsFromRules = (rules: CanonicalAccessRule[]) => {
  const rule = rules.find((entry) => entry.type === "require_badge");
  if (!rule) return [];
  if (Array.isArray(rule.badge_ids) && rule.badge_ids.length > 0) return rule.badge_ids;
  if (rule.badge_id) return [rule.badge_id];
  return rule.value ? [String(rule.value)] : [];
};

const normalizeRuleEnforcement = (value: unknown): AccessRuleEnforcement =>
  value === "soft" ? "soft" : "hard";

const getRuleEnforcementFromRules = (rules: CanonicalAccessRule[], type: AccessRuleType): AccessRuleEnforcement =>
  normalizeRuleEnforcement(rules.find((rule) => rule.type === type)?.enforcement);

const normalizeAccessRules = (value: unknown): AccessRules => {
  const raw = isPlainRecord(value) ? { ...value } as AccessRules : {};
  const rules = Array.isArray(raw.rules)
    ? raw.rules.filter((rule): rule is CanonicalAccessRule => isPlainRecord(rule) && typeof rule.type === "string")
    : [];
  const minAttendedEvents = getRuleValue(rules, "min_attended_events")
    ?? getRuleValue(rules, "min_activities")
    ?? raw.min_attended_events
    ?? raw.min_activities
    ?? null;

  return {
    ...raw,
    rules,
    min_level: getRuleValue(rules, "min_level") ?? raw.min_level ?? null,
    min_experiences: getRuleValue(rules, "min_experience") ?? raw.min_experiences ?? raw.min_experience ?? null,
    min_activity_frequency: normalizeActivityFrequencyValue(rules.find((rule) => rule.type === "min_activity_frequency")?.value)
      ?? normalizeActivityFrequencyValue(raw.min_activity_frequency)
      ?? null,
    min_trekking_events: getRuleValue(rules, "min_trekking_events") ?? raw.min_trekking_events ?? null,
    min_attended_events: minAttendedEvents,
    min_activities: minAttendedEvents,
    required_badge_ids: getRequiredBadgeIdsFromRules(rules).length
      ? getRequiredBadgeIdsFromRules(rules)
      : raw.required_badge_ids ?? (raw.required_badge_id ? [raw.required_badge_id] : null),
    require_active_membership: rules.some((rule) => rule.type === "require_membership") || Boolean(raw.require_active_membership),
    require_manual_approval: rules.some((rule) => rule.type === "manual_approval") || Boolean(raw.require_manual_approval),
    restriction_message: raw.restriction_message || null,
    exclusivity_label: raw.exclusivity_label || null,
  };
};

const buildAccessRulesForStorage = (value: unknown): AccessRules | null => {
  const source = normalizeAccessRules(value);
  const next: AccessRules = {};
  const rules: CanonicalAccessRule[] = [];
  const addNumberRule = (type: AccessRuleType, value?: number | null) => {
    const numeric = numberRuleValue(value);
    if (numeric) rules.push({ type, value: numeric, enforcement: getRuleEnforcementFromRules(source.rules || [], type) });
  };

  addNumberRule("min_level", source.min_level);
  addNumberRule("min_experience", source.min_experiences);
  const activityFrequency = normalizeActivityFrequencyValue(source.min_activity_frequency);
  if (activityFrequency) {
    rules.push({
      type: "min_activity_frequency",
      value: Number(activityFrequency),
      enforcement: getRuleEnforcementFromRules(source.rules || [], "min_activity_frequency"),
    });
  }
  addNumberRule("min_trekking_events", source.min_trekking_events);
  addNumberRule("min_attended_events", source.min_attended_events ?? source.min_activities);

  const badgeIds = (source.required_badge_ids || []).filter(Boolean);
  if (badgeIds.length > 0) {
    rules.push({ type: "require_badge", badge_ids: badgeIds, badge_id: badgeIds[0], enforcement: "hard" });
  }
  if (source.require_active_membership) rules.push({ type: "require_membership", enforcement: "hard" });
  if (source.require_manual_approval) rules.push({ type: "manual_approval", enforcement: "hard" });

  if (source.restriction_message?.trim()) next.restriction_message = source.restriction_message.trim();
  if (source.exclusivity_label?.trim()) next.exclusivity_label = source.exclusivity_label.trim();
  if (rules.length > 0) next.rules = rules;

  return Object.keys(next).length > 0 ? next : null;
};

const getLegacySpecialBadgeIdsFromEventBadges = (eventBadges: any): string[] => {
  if (!Array.isArray(eventBadges)) return [];
  return eventBadges
    .filter((entry: any): entry is AttendanceBadgeEntry => (
      entry &&
      typeof entry === "object" &&
      entry.type === "attendance_badge" &&
      typeof entry.badge_id === "string"
    ))
    .map((entry) => entry.badge_id);
};

const MANAGED_EVENT_BADGES = new Set([
  ...MANUAL_BADGE_OPTIONS.map((option) => option.value),
  "ultimi_posti",
  "founding_event",
  "gratuito",
]);

const canonicalizeEventBadges = (eventBadges: any): string[] => {
  if (!Array.isArray(eventBadges)) return [];
  const values = eventBadges
    .map((entry: any) => {
      if (typeof entry === "string") return entry.trim();
      if (entry && typeof entry === "object" && entry.type === "custom" && typeof entry.label === "string") {
        return entry.label.trim();
      }
      return "";
    })
    .filter(Boolean);
  return [...new Set(values)];
};

const getCustomEventBadge = (eventBadges: any) =>
  canonicalizeEventBadges(eventBadges).find((badge) => !MANAGED_EVENT_BADGES.has(badge)) || "";

const ruleConditionFromEligibleGroup = (group: string | null | undefined): Pick<PricingRule, "condition" | "condition_value" | "condition_numeric_value" | "condition_operator"> => {
  if (!group || group === "all") return { condition: "everyone" };
  if (group === "members") return { condition: "active_members" };
  if (group === "new_users") return { condition: "new_users" };
  if (group === "experienced") return { condition: "experienced_users" };
  if (group === "loyal") return { condition: "loyal_participants" };
  if (group.startsWith("badge:")) {
    return { condition: "specific_badge", condition_value: group.replace("badge:", "").split(",").filter(Boolean) };
  }
  if (group.startsWith("trekking_gt:")) {
    return { condition: "trekking_count", condition_operator: ">", condition_numeric_value: Number(group.split(":")[1] || 0) };
  }
  if (group.startsWith("events_gt:")) {
    return { condition: "events_count", condition_operator: ">", condition_numeric_value: Number(group.split(":")[1] || 0) };
  }
  return { condition: "everyone" };
};

const eligibleGroupFromRule = (rule: PricingRule) => {
  if (rule.condition === "active_members") return "members";
  if (rule.condition === "new_users") return "new_users";
  if (rule.condition === "experienced_users") return "experienced";
  if (rule.condition === "loyal_participants") return "loyal";
  if (rule.condition === "specific_badge") {
    const ids = (rule.condition_value || []).filter((value) => !value.startsWith("level_"));
    return ids.length ? `badge:${ids.join(",")}` : "all";
  }
  if (rule.condition === "trekking_count") return `trekking_gt:${rule.condition_numeric_value ?? 0}`;
  if (rule.condition === "events_count") return `events_gt:${rule.condition_numeric_value ?? 0}`;
  return "all";
};

const normalizeFormulaInputName = (name: string | null | undefined, index: number) => {
  const trimmedName = name?.trim() || "";
  return trimmedName === `Formula ${index + 1}` || isGeneratedPriceOptionName(trimmedName) ? "" : trimmedName;
};

const priceOptionToRule = (option: any, fallbackPaymentType: PaymentType, index: number): PricingRule => {
  const paymentType = (option.payment_type || fallbackPaymentType) as PaymentType;
  const depositAmount = option.deposit_amount != null ? Number(option.deposit_amount) : null;
  const price = Number(option.price || 0);
  return {
    id: option.id,
    isNew: false,
    name: normalizeFormulaInputName(option.name, index),
    price,
    original_price: option.original_price != null ? Number(option.original_price) : null,
    ...ruleConditionFromEligibleGroup(option.eligible_group),
    is_promotional: !!option.is_promotional,
    promo_start: option.promo_start || null,
    promo_end: option.promo_end || null,
    payment_type: paymentType,
    deposit_amount: depositAmount,
    balance_amount: paymentType === "deposit" ? Math.max(0, price - Number(depositAmount || 0)) : null,
    balance_payment_mode: (option.balance_payment_mode || "online") as BalancePaymentMode,
    has_dedicated_spots: !!option.has_dedicated_spots,
    dedicated_spots: option.dedicated_spots != null ? Number(option.dedicated_spots) : null,
    spots_taken: option.spots_taken != null ? Number(option.spots_taken) : 0,
  };
};

const legacyEventPriceOptionToRule = (event: any): PricingRule => {
  const paymentType = (event.payment_type || "free") as PaymentType;
  const price = Number(event.price || 0);
  const depositAmount = paymentType === "deposit" ? Number(event.deposit || 0) : null;
  return {
    id: crypto.randomUUID(),
    isNew: true,
    name: "",
    price: paymentType === "free" ? 0 : price,
    condition: "everyone",
    payment_type: paymentType,
    deposit_amount: depositAmount,
    balance_amount: paymentType === "deposit" ? Math.max(0, price - Number(depositAmount || 0)) : null,
    balance_payment_mode: (event.balance_payment_mode || "online") as BalancePaymentMode,
    has_dedicated_spots: false,
    dedicated_spots: null,
    spots_taken: 0,
  };
};

export default function EventsPage() {
  type SortField = "date" | "organizer";
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const dashboardFilter = searchParams.get("filter");
  const periodParam = searchParams.get("period") as EventPeriodFilter | null;
  const eventPeriod = periodParam && EVENT_PERIOD_FILTERS.includes(periodParam) ? periodParam : "upcoming";
  const [editEvent, setEditEvent] = useState<(Record<string, any> & { isNew?: boolean }) | null>(null);
  const [localMeetingPoints, setLocalMeetingPoints] = useState<LocalMeetingPoint[]>([]);
  const [localPriceOptions, setLocalPriceOptions] = useState<PricingRule[]>([]);
  const [localSpecialBadgeIds, setLocalSpecialBadgeIds] = useState<string[]>([]);
  const [localEventStaff, setLocalEventStaff] = useState<LocalEventStaff[]>([]);
  const [activeStaffSearchIndex, setActiveStaffSearchIndex] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [imageCropTarget, setImageCropTarget] = useState<{ file: File; type: "cover" | "coverHome"; coverFile?: File } | null>(null);
  const [convertProposalId, setConvertProposalId] = useState<string | null>(null);
  const [engagementDetail, setEngagementDetail] = useState<EngagementDetailSelection | null>(null);
  const queryClient = useQueryClient();
  const { data: difficultyLevels = [] } = useTrekkingDifficultyLevels();

  /* ── Handle "Convert to Event" from ProposalsPage ── */
  useEffect(() => {
    const state = location.state as any;
    if (state?.convertProposal) {
      const p = state.convertProposal;
      setLocalMeetingPoints([]);
      setLocalPriceOptions([]);
      setLocalSpecialBadgeIds([]);
      setLocalEventStaff([]);
      setEditEvent({
        ...emptyEvent,
        isNew: true,
        title: p.title || "",
        description: p.description || "",
        location: p.location || "",
        location_label: p.location_label || "",
        date: p.date || "",
        time: p.time || "09:00",
        spots_total: p.spots_total || 20,
        category_id: p.category_id || null,
      });
      if (state.proposalId) {
        setConvertProposalId(state.proposalId);
      }
      // Clear the state so it doesn't re-trigger on re-render
      navigate("/events", { replace: true, state: {} });
    }
  }, [location.state]);

  /* ── Queries ── */
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["admin-events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*, event_categories(name, icon), event_price_options(id)").order("date", { ascending: true });
      if (error) throw error;
      return (data || []) as EventWithCategory[];
    },
  });
  const eventIds = events.map((event) => event.id);
  const eventIdsKey = eventIds.join(",");
  const { data: eventEngagementMetrics = {} } = useQuery({
    queryKey: ["admin-event-engagement-metrics", eventIdsKey],
    queryFn: () => fetchEventEngagementMetrics(eventIds),
    enabled: eventIds.length > 0,
  });
  const { data: engagementAudience = [], isLoading: isEngagementAudienceLoading } = useQuery({
    queryKey: ["admin-event-engagement-audience", engagementDetail?.event.id, engagementDetail?.type],
    queryFn: () => fetchEventEngagementAudience(engagementDetail!.event.id, engagementDetail!.type),
    enabled: !!engagementDetail,
  });
  const { data: pendingEventIds = [] } = useQuery({
    queryKey: ["admin-events-pending-approvals"],
    queryFn: async () => {
      const { data } = await supabase.from("event_registrations").select("event_id").eq("status", "pending_approval");
      if (!data) return [];
      return [...new Set(data.map(r => r.event_id))];
    },
    enabled: dashboardFilter === "pending",
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["admin-categories-list"],
    queryFn: async () => { const { data } = await supabase.from("event_categories").select("id, name"); return data || []; },
  });
  const { data: badges = [] } = useQuery({
    queryKey: ["admin-badges-list"],
    queryFn: async () => { const { data } = await supabase.from("badges").select("id, name, icon, category, description"); return data || []; },
  });
  const { data: communityLevels = [] } = useQuery({
    queryKey: ["admin-community-levels"],
    queryFn: async () => { const { data } = await supabase.from("community_levels").select("id, name, icon, level_number").order("level_number"); return data || []; },
  });
  const { data: organizers = [] } = useQuery({
    queryKey: ["admin-organizers-list"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id, role").in("role", ["organizer", "admin"]);
      if (!roles || !roles.length) return [];
      const ids = [...new Set(roles.map(r => r.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("id, first_name, last_name").in("id", ids);
      return (profiles || []).map(p => ({ id: p.id, name: `${p.first_name} ${p.last_name}`.trim() }));
    },
  });
  const activeStaffSearchTerm =
    activeStaffSearchIndex !== null ? localEventStaff[activeStaffSearchIndex]?.profileSearch.trim() || "" : "";
  const { data: staffProfileResults = [] } = useQuery({
    queryKey: ["admin-event-staff-profile-search", activeStaffSearchTerm],
    queryFn: async () => {
      if (activeStaffSearchTerm.length < 2) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email, avatar_url")
        .or(`first_name.ilike.%${activeStaffSearchTerm}%,last_name.ilike.%${activeStaffSearchTerm}%,email.ilike.%${activeStaffSearchTerm}%`)
        .limit(8);
      if (error) throw error;
      return (data || []) as StaffProfileSearchResult[];
    },
    enabled: activeStaffSearchTerm.length >= 2,
  });
  const { data: equipmentTemplates = [] } = useQuery({
    queryKey: ["admin-equipment-templates-select"],
    queryFn: async () => {
      const { data } = await supabase.from("equipment_templates").select("id, name, equipment_template_items(name, is_mandatory, notes, sort_order)").order("name");
      return data || [];
    },
  });
  const { data: remoteClosingSentences = [] } = useQuery<string[]>({
    queryKey: ["event-closing-sentences"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_closing_sentences" as any)
        .select("sentence")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("sentence", { ascending: true });

      if (error) throw error;
      return ((data as Array<{ sentence?: string | null }> | null) || [])
        .map((row) => normalizeEventClosingSentence(row.sentence))
        .filter(Boolean);
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
  const closingSentenceOptions =
    remoteClosingSentences.length > 0 ? remoteClosingSentences : [...EVENT_CLOSING_SENTENCES];

  /* ── Access rules helpers ── */
  const getAR = (evt: any): AccessRules => normalizeAccessRules(evt?.access_rules);
  const getAF = (evt: any): AdditionalFields => normalizeAdditionalFields(evt?.additional_fields);
  const getWeather = (evt: any) => {
    const af = getAF(evt);
    return {
      weather_condition: af.weather_override_condition || "",
      temp_min: af.weather_override_temp_min ?? null,
      temp_max: af.weather_override_temp_max ?? null,
      temp_avg: af.weather_override_temp_avg ?? null,
    };
  };
  const getClosingSentence = (evt: any) => normalizeEventClosingSentence(getAF(evt).closing_sentence);
  const getClosingSentenceMode = (evt: any): "random" | "preset" | "manual" => {
    const sentence = getClosingSentence(evt);
    if (!sentence) return "random";
    return closingSentenceOptions.includes(sentence) ? "preset" : "manual";
  };
  const getRequiredBadgeIds = (rules: AccessRules): string[] => {
    if (rules.required_badge_ids?.length) return rules.required_badge_ids;
    if (rules.required_badge_id) return [rules.required_badge_id];
    return [];
  };

  const updateAR = (patch: Partial<AccessRules>) => {
    if (!editEvent) return;
    setEditEvent({
      ...editEvent,
      access_rules: buildAccessRulesForStorage({ ...getAR(editEvent), ...patch }),
    });
  };
  const getAccessRuleEnforcement = (type: AccessRuleType): AccessRuleEnforcement =>
    getRuleEnforcementFromRules(getAR(editEvent).rules || [], type);
  const updateAccessRuleEnforcement = (type: AccessRuleType, enforcement: AccessRuleEnforcement) => {
    if (!editEvent) return;
    const current = getAR(editEvent);
    const rules = [...(current.rules || [])];
    const index = rules.findIndex((rule) => rule.type === type);
    if (index === -1) return;
    rules[index] = { ...rules[index], enforcement };
    updateAR({ rules });
  };
  const renderAccessRuleEnforcementSelect = (type: AccessRuleType) => (
    <Select
      value={getAccessRuleEnforcement(type)}
      onValueChange={(value) => updateAccessRuleEnforcement(type, value as AccessRuleEnforcement)}
    >
      <SelectTrigger className="h-8 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="hard">Bloccante</SelectItem>
        <SelectItem value="soft">Avviso</SelectItem>
      </SelectContent>
    </Select>
  );
  const renderEngagementChips = (event: EventWithCategory) => {
    const metric = eventEngagementMetrics[event.id];
    if (!metric) return null;
    const reminderCount = metric.opening_reminder_active_count + metric.opening_reminder_notified_count;
    const chips = [
      { icon: Bookmark, label: "Salvati", value: metric.saved_count, type: "saved" as const },
      { icon: BellRing, label: "Reminder", value: reminderCount, type: "reminder" as const },
    ];

    return (
      <div className="flex flex-wrap gap-1.5 pt-1">
        {chips.map(({ icon: Icon, label, value, type }) => (
          <button
            key={label}
            type="button"
            className="inline-flex min-h-6 items-center gap-1 rounded-md border border-border bg-muted/40 px-1.5 text-[10px] font-medium leading-none text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
            title={`${label}: ${value}`}
            onClick={(e) => {
              e.stopPropagation();
              setEngagementDetail({ event, type });
            }}
          >
            <Icon className="h-3 w-3" />
            {value}
          </button>
        ))}
      </div>
    );
  };
  const updateAF = (patch: Partial<AdditionalFields>) => {
    if (!editEvent) return;
    const rawCurrent = isPlainRecord(editEvent.additional_fields) ? editEvent.additional_fields : {};
    const current = getAF(editEvent);
    const next: AdditionalFields = { ...current, ...patch };
    if ("fields" in patch || "custom_fields" in patch) {
      const fields = normalizeRegistrationFields(patch.fields || patch.custom_fields);
      next.fields = fields;
      next.custom_fields = fields;
    }
    if ("ask_car_availability" in patch || "show_car_availability" in patch || "car_availability_enabled" in patch) {
      const value = Boolean(patch.ask_car_availability ?? patch.show_car_availability ?? patch.car_availability_enabled);
      next.ask_car_availability = value;
      if ("car_availability_enabled" in rawCurrent || "car_availability_enabled" in patch) {
        next.car_availability_enabled = value;
      } else {
        delete next.car_availability_enabled;
      }
      if ("show_car_availability" in rawCurrent || "show_car_availability" in patch) {
        next.show_car_availability = value;
      } else {
        delete next.show_car_availability;
      }
    }
    setEditEvent({ ...editEvent, additional_fields: next });
  };
  const updateWeather = (patch: any) => {
    const next = { ...getWeather(editEvent), ...patch };
    updateAF({
      weather_override_condition: next.weather_condition || null,
      weather_override_temp_min: next.temp_min ?? null,
      weather_override_temp_max: next.temp_max ?? null,
      weather_override_temp_avg: next.temp_avg ?? null,
    });
  };
  const updateClosingSentenceMode = (mode: "random" | "preset" | "manual") => {
    if (mode === "random") {
      updateAF({ closing_sentence: null });
      return;
    }

    if (mode === "preset") {
      const current = getClosingSentence(editEvent);
      updateAF({
        closing_sentence: closingSentenceOptions.includes(current)
          ? current
          : closingSentenceOptions[0] || null,
      });
    }
  };
  const updateClosingSentence = (sentence: string) => {
    updateAF({ closing_sentence: normalizeEventClosingSentence(sentence) || null });
  };
  const updateSpecialBadgeIds = (badgeIds: string[]) => {
    setLocalSpecialBadgeIds([...new Set(badgeIds.filter(Boolean))]);
  };

  const getPricingRules = (_evt: any): PricingRule[] => localPriceOptions;
  const addPricingRule = () => {
    const lastRule = localPriceOptions[localPriceOptions.length - 1];
    const paymentType = (lastRule?.payment_type || editEvent?.payment_type || "free") as PaymentType;
    const basePrice = Number(lastRule?.price ?? editEvent?.price ?? 0);
    const baseDeposit = Number(lastRule?.deposit_amount ?? editEvent?.deposit ?? 0);
    setLocalPriceOptions((rules) => [
      ...rules,
      {
        id: crypto.randomUUID(),
        isNew: true,
        name: "",
        price: basePrice,
        condition: "everyone",
        payment_type: paymentType,
        deposit_amount: paymentType === "deposit" ? baseDeposit : null,
        balance_amount: paymentType === "deposit" ? Math.max(0, basePrice - baseDeposit) : null,
        balance_payment_mode: lastRule?.balance_payment_mode || "online",
        has_dedicated_spots: false,
        dedicated_spots: null,
        spots_taken: 0,
      },
    ]);
  };
  const updatePricingRule = (id: string, patch: Partial<PricingRule>) => {
    setLocalPriceOptions((rules) => rules.map(r => r.id === id ? { ...r, ...patch } : r));
  };
  const removePricingRule = (id: string) => {
    setLocalPriceOptions((rules) => rules.filter(r => r.id !== id));
  };

  const hasAnyAccessRule = (evt: any): boolean => {
    const r = getAR(evt);
    return !!(r.min_trekking_events || r.min_attended_events || r.min_level || r.min_experiences || r.required_badge_ids?.length || r.required_badge_id || r.require_active_membership || r.require_manual_approval);
  };

  /* ── Equipment list helpers ── */
  const getEquipmentList = (evt: any): EquipmentItem[] => {
    if (!evt?.equipment_list) return [];
    return (evt.equipment_list as EquipmentItem[]) || [];
  };
  const updateEquipmentList = (items: EquipmentItem[]) => {
    if (!editEvent) return;
    setEditEvent({ ...editEvent, equipment_list: items });
  };

  /* ── Custom fields helpers ── */
  const getCustomFields = (evt: any): RegistrationField[] => getAF(evt).fields || getAF(evt).custom_fields || [];
  const updateCustomField = (index: number, patch: Partial<RegistrationField>) => {
    const fields = [...getCustomFields(editEvent)];
    const nextField = { ...fields[index], ...patch };
    if (patch.type === "text") delete nextField.options;
    if (patch.type === "select" && !nextField.options) nextField.options = [];
    fields[index] = nextField;
    updateAF({ fields });
  };
  const updateCustomFieldOption = (fieldIndex: number, optionIndex: number, value: string) => {
    const fields = [...getCustomFields(editEvent)];
    const options = [...(fields[fieldIndex].options || [])];
    options[optionIndex] = value;
    fields[fieldIndex] = { ...fields[fieldIndex], options };
    updateAF({ fields });
  };
  const addCustomFieldOption = (fieldIndex: number) => {
    const fields = [...getCustomFields(editEvent)];
    fields[fieldIndex] = { ...fields[fieldIndex], options: [...(fields[fieldIndex].options || []), ""] };
    updateAF({ fields });
  };
  const removeCustomFieldOption = (fieldIndex: number, optionIndex: number) => {
    const fields = [...getCustomFields(editEvent)];
    fields[fieldIndex] = {
      ...fields[fieldIndex],
      options: (fields[fieldIndex].options || []).filter((_, index) => index !== optionIndex),
    };
    updateAF({ fields });
  };

  /* ── Event staff helpers ── */
  const addStaffMember = () => {
    setLocalEventStaff((staff) => [
      ...staff,
      {
        _key: crypto.randomUUID(),
        profile_id: null,
        display_name: "",
        role_label: "STAFF",
        avatar_url: null,
        is_public: true,
        profileSearch: "",
      },
    ]);
  };
  const updateStaffMember = <K extends keyof LocalEventStaff>(index: number, key: K, value: LocalEventStaff[K]) => {
    setLocalEventStaff((staff) => staff.map((member, memberIndex) => memberIndex === index ? { ...member, [key]: value } : member));
  };
  const removeStaffMember = (index: number) => {
    setLocalEventStaff((staff) => staff.filter((_, memberIndex) => memberIndex !== index));
    setActiveStaffSearchIndex((current) => current === index ? null : current);
  };
  const selectStaffProfile = (index: number, profile: StaffProfileSearchResult) => {
    const displayName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || profile.email || "Staff";
    setLocalEventStaff((staff) => staff.map((member, memberIndex) => memberIndex === index
      ? {
        ...member,
        profile_id: profile.id,
        display_name: displayName,
        avatar_url: profile.avatar_url || null,
        profileSearch: displayName,
      }
      : member));
    setActiveStaffSearchIndex(null);
  };
  const clearStaffProfile = (index: number) => {
    setLocalEventStaff((staff) => staff.map((member, memberIndex) => memberIndex === index
      ? { ...member, profile_id: null, avatar_url: null, profileSearch: "" }
      : member));
  };

  /* ── Open edit dialog ── */
  const handleOpenEdit = async (event: EventWithCategory) => {
    let mps: LocalMeetingPoint[] = [];
    const { data } = await supabase.from("event_meeting_points").select("*").eq("event_id", event.id).order("sort_order");
    if (data) mps = data.map(mp => ({ ...mp, _key: mp.id, notes: mp.notes || "" }));
    const { data: priceOptions, error: priceOptionsError } = await supabase
      .from("event_price_options")
      .select("*")
      .eq("event_id", event.id)
      .order("sort_order");
    if (priceOptionsError) throw priceOptionsError;
    const { data: specialBadgeLinks, error: specialBadgesError } = await supabase
      .from("event_special_badges")
      .select("badge_id")
      .eq("event_id", event.id);
    if (specialBadgesError) throw specialBadgesError;
    const { data: staffRows, error: staffError } = await supabase
      .from("event_staff")
      .select("id, profile_id, display_name, role_label, avatar_url, is_public, sort_order")
      .eq("event_id", event.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (staffError) throw staffError;
    const { data: whatsappLinkRow, error: whatsappLinkError } = await supabase
      .from("event_whatsapp_links" as any)
      .select("url")
      .eq("event_id", event.id)
      .maybeSingle();
    if (whatsappLinkError) throw whatsappLinkError;
    const specialBadgeIds = [
      ...(specialBadgeLinks || []).map((link) => link.badge_id).filter(Boolean),
      ...getLegacySpecialBadgeIdsFromEventBadges((event as any).event_badges),
    ];
    const mappedPriceOptions = (priceOptions || []).map((option, index) => priceOptionToRule(option, event.payment_type as PaymentType, index));
    setLocalMeetingPoints(mps);
    setLocalPriceOptions(mappedPriceOptions.length ? mappedPriceOptions : [legacyEventPriceOptionToRule(event)]);
    setLocalSpecialBadgeIds([...new Set(specialBadgeIds)]);
    setLocalEventStaff(((staffRows || []) as EventStaffRow[]).map((member) => ({
      _key: member.id,
      id: member.id,
      profile_id: member.profile_id || null,
      display_name: member.display_name || "",
      role_label: member.role_label || "STAFF",
      avatar_url: member.avatar_url || null,
      is_public: member.is_public !== false,
      profileSearch: member.display_name || "",
    })));
    setEditEvent({
      ...event,
      gallery_images: normalizeGalleryImages(event.gallery_images),
      access_rules: buildAccessRulesForStorage(event.access_rules),
      additional_fields: buildAdditionalFieldsForStorage(event.additional_fields),
      cancellation_policy: normalizeCancellationPolicy(event.cancellation_policy),
      event_badges: canonicalizeEventBadges((event as any).event_badges),
      whatsapp_group_url: normalizeWhatsappGroupUrl((whatsappLinkRow as any)?.url) || "",
    });
  };
  const handleOpenCreate = () => {
    setLocalMeetingPoints([]);
    setLocalPriceOptions([]);
    setLocalSpecialBadgeIds([]);
    setLocalEventStaff([]);
    setEditEvent({ ...emptyEvent, isNew: true });
  };

  /* ── Image upload ── */
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: "cover" | "gallery") => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !editEvent) return;
    const currentGallery = normalizeGalleryImages(editEvent.gallery_images);
    if (type === "gallery" && currentGallery.length >= 5) {
      toast.error("Massimo 5 immagini galleria");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Seleziona un file immagine");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast.error("L'immagine originale deve essere inferiore a 25MB");
      return;
    }
    if (type === "gallery") {
      void uploadGalleryImage(file);
      return;
    }
    setImageCropTarget({ file, type });
  };

  const uploadEventImageFile = async (file: File): Promise<string> => {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("event-images").upload(path, file, {
      cacheControl: "31536000",
      contentType: file.type,
    });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from("event-images").getPublicUrl(path);
    return publicUrl;
  };

  const uploadCoverImages = async (coverFile: File, homeCardFile?: File) => {
    if (!editEvent) return;
    setIsUploading(true);
    try {
      const coverUrl = await uploadEventImageFile(coverFile);
      const homeCardUrl = homeCardFile ? await uploadEventImageFile(homeCardFile) : null;
      setEditEvent((current) => {
        if (!current) return current;
        const af = { ...getAF(current) };
        if (homeCardUrl) {
          af[HOME_CARD_IMAGE_FIELD] = homeCardUrl;
        } else {
          delete af[HOME_CARD_IMAGE_FIELD];
        }
        return {
          ...current,
          image_url: coverUrl,
          additional_fields: af,
        };
      });
      toast.success("Immagine caricata");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const uploadGalleryImage = async (file: File) => {
    if (!editEvent) return;
    const currentGallery = normalizeGalleryImages(editEvent.gallery_images);
    setIsUploading(true);
    try {
      const galleryFile = await compressImageForUpload(file, {
        maxDimension: 1800,
        quality: 0.82,
        outputType: "image/jpeg",
      });
      const publicUrl = await uploadEventImageFile(galleryFile);
      setEditEvent({
        ...editEvent,
        gallery_images: [...currentGallery, { url: publicUrl, order: currentGallery.length }],
      });
      toast.success("Immagine caricata");
    } catch (err: any) { toast.error(err.message); }
    finally { setIsUploading(false); }
  };
  const removeGalleryImage = (i: number) => {
    if (!editEvent) return;
    const g = normalizeGalleryImages(editEvent.gallery_images)
      .filter((_, index) => index !== i)
      .map((item, index) => ({ ...item, order: index }));
    setEditEvent({ ...editEvent, gallery_images: g });
  };
  const moveGalleryImage = (i: number, dir: "up" | "down") => {
    if (!editEvent) return;
    const g = normalizeGalleryImages(editEvent.gallery_images);
    const j = dir === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= g.length) return;
    [g[i], g[j]] = [g[j], g[i]];
    setEditEvent({ ...editEvent, gallery_images: g.map((item, index) => ({ ...item, order: index })) });
  };

  /* ── Save mutation ── */
  const saveMutation = useMutation({
    mutationFn: async (payload: { evt: any; mps: LocalMeetingPoint[]; priceOptions: PricingRule[] }) => {
      const { evt, mps, priceOptions } = payload;
      const requestedWhatsappGroupUrl = String(evt.whatsapp_group_url || "").trim();
      const whatsappGroupUrl = normalizeWhatsappGroupUrl(requestedWhatsappGroupUrl);
      if (requestedWhatsappGroupUrl && !whatsappGroupUrl) {
        throw new Error("Il link gruppo WhatsApp deve iniziare con https://chat.whatsapp.com/");
      }

      const { isNew, event_categories, event_price_options, whatsapp_group_url, event_whatsapp_links, ...data } = evt;
      const validPriceOptions = priceOptions;
      const primaryPriceOption = validPriceOptions[0];
      if (primaryPriceOption) {
        const primaryPaymentType = primaryPriceOption.payment_type || data.payment_type || "free";
        data.price = Number(primaryPriceOption.price || 0);
        data.payment_type = primaryPaymentType;
        data.deposit = primaryPaymentType === "deposit" ? Number(primaryPriceOption.deposit_amount || 0) : null;
        data.balance_payment_mode = primaryPaymentType === "deposit" ? (primaryPriceOption.balance_payment_mode || "online") : null;
      }

      // Build duration with unit
      const af = buildAdditionalFieldsForStorage(data.additional_fields);
      const durationUnit = af.duration_unit || "h";
      if (data._durationValue !== undefined) {
        data.duration = data._durationValue ? `${data._durationValue} ${durationUnit}` : null;
        delete data._durationValue;
      }
      if (data._distanceValue !== undefined) {
        data.distance = data._distanceValue ? `${data._distanceValue} km` : null;
        delete data._distanceValue;
      }
      if (data._elevationValue !== undefined) {
        data.elevation = data._elevationValue ? `${data._elevationValue} m` : null;
        delete data._elevationValue;
      }

      data.additional_fields = af;
      data.access_rules = buildAccessRulesForStorage(data.access_rules);
      data.cancellation_policy = normalizeCancellationPolicy(data.cancellation_policy);
      data.event_badges = canonicalizeEventBadges(data.event_badges);
      data.gallery_images = normalizeGalleryImages(data.gallery_images);

      let savedId = data.id;
      if (isNew) {
        const { data: inserted, error } = await supabase.from("events").insert(data).select("id").single();
        if (error) throw error;
        savedId = inserted.id;
      } else {
        const { error } = await supabase.from("events").update({ ...data, updated_at: new Date().toISOString() }).eq("id", data.id);
        if (error) throw error;
      }

      // Sync meeting points while preserving existing IDs where possible.
      // Registrations can reference meeting points, so removed points must be
      // unlinked before deletion or Postgres will reject the delete.
      if (savedId) {
        if (whatsappGroupUrl) {
          const { error: whatsappUpsertError } = await supabase
            .from("event_whatsapp_links" as any)
            .upsert({ event_id: savedId, url: whatsappGroupUrl }, { onConflict: "event_id" });
          if (whatsappUpsertError) throw whatsappUpsertError;
        } else {
          const { error: whatsappDeleteError } = await supabase
            .from("event_whatsapp_links" as any)
            .delete()
            .eq("event_id", savedId);
          if (whatsappDeleteError) throw whatsappDeleteError;
        }

        const validMps = mps.filter(mp => mp.name.trim());

        const { data: existingMps, error: existingMpsError } = await supabase
          .from("event_meeting_points")
          .select("id")
          .eq("event_id", savedId);
        if (existingMpsError) throw existingMpsError;

        const keptIds = new Set(validMps.map(mp => mp.id).filter(Boolean));
        const removedIds = (existingMps || [])
          .map(mp => mp.id)
          .filter(id => !keptIds.has(id));

        if (removedIds.length) {
          const { error: unlinkError } = await supabase
            .from("event_registrations")
            .update({ meeting_point_id: null })
            .eq("event_id", savedId)
            .in("meeting_point_id", removedIds);
          if (unlinkError) throw unlinkError;

          const { error: deleteError } = await supabase
            .from("event_meeting_points")
            .delete()
            .eq("event_id", savedId)
            .in("id", removedIds);
          if (deleteError) throw deleteError;
        }

        for (const [idx, mp] of validMps.entries()) {
          const row = {
            event_id: savedId,
            name: mp.name,
            location: mp.location,
            time: mp.time || "09:00",
            notes: mp.notes || null,
            sort_order: idx,
          };

          const { error } = mp.id
            ? await supabase
              .from("event_meeting_points")
              .update(row)
              .eq("id", mp.id)
              .eq("event_id", savedId)
            : await supabase
              .from("event_meeting_points")
              .insert(row);
          if (error) throw error;
        }

        const { error: deleteStaffError } = await supabase
          .from("event_staff")
          .delete()
          .eq("event_id", savedId);
        if (deleteStaffError) throw deleteStaffError;

        const staffRows = localEventStaff
          .map((member, index) => ({
            event_id: savedId,
            profile_id: member.profile_id || null,
            display_name: member.display_name.trim(),
            role_label: member.role_label.trim() || "STAFF",
            avatar_url: member.avatar_url || null,
            sort_order: index,
            is_public: member.is_public,
          }))
          .filter((member) => member.display_name);

        if (staffRows.length > 0) {
          const { error: insertStaffError } = await supabase
            .from("event_staff")
            .insert(staffRows);
          if (insertStaffError) throw insertStaffError;
        }

        const retainedOptionIds = validPriceOptions
          .filter((option) => !option.isNew)
          .map((option) => option.id);

        const { data: existingOptions, error: existingOptionsError } = await supabase
          .from("event_price_options")
          .select("id")
          .eq("event_id", savedId);
        if (existingOptionsError) throw existingOptionsError;

        const removedOptions = (existingOptions || []).filter((option) => !retainedOptionIds.includes(option.id));
        for (const removedOption of removedOptions) {
          const { data: linkedRegistrations, error: linkedRegistrationsError } = await supabase
            .from("event_registrations")
            .select("id")
            .eq("price_option_id", removedOption.id)
            .limit(1);
          if (linkedRegistrationsError) throw linkedRegistrationsError;
          if ((linkedRegistrations || []).length > 0) continue;

          const { error: deleteOptionError } = await supabase
            .from("event_price_options")
            .delete()
            .eq("id", removedOption.id)
            .eq("event_id", savedId);
          if (deleteOptionError) throw deleteOptionError;
        }

        for (const [idx, option] of validPriceOptions.entries()) {
          const optionPaymentType = option.payment_type || (data.payment_type as PaymentType) || "free";
          const depositAmount = optionPaymentType === "deposit" ? Number(option.deposit_amount || 0) : null;
          const optionPayload = {
            event_id: savedId,
            name: option.name.trim(),
            price: Number(option.price || 0),
            sort_order: idx,
            eligible_group: eligibleGroupFromRule(option),
            original_price: option.original_price || null,
            is_promotional: !!option.is_promotional,
            promo_start: option.promo_start || null,
            promo_end: option.promo_end || null,
            payment_type: optionPaymentType,
            deposit_amount: depositAmount,
            balance_amount: optionPaymentType === "deposit"
              ? Math.max(0, Number(option.price || 0) - Number(depositAmount || 0))
              : null,
            balance_payment_mode: optionPaymentType === "deposit" ? (option.balance_payment_mode || "online") : null,
            has_dedicated_spots: !!option.has_dedicated_spots,
            dedicated_spots: option.has_dedicated_spots ? Number(option.dedicated_spots || 0) : null,
            waitlist_enabled: false,
          };

          if (!option.isNew) {
            const { error: updateOptionError } = await supabase
              .from("event_price_options")
              .update(optionPayload)
              .eq("id", option.id)
              .eq("event_id", savedId);
            if (updateOptionError) throw updateOptionError;
          } else {
            const { error: insertOptionError } = await supabase
              .from("event_price_options")
              .insert(optionPayload);
            if (insertOptionError) throw insertOptionError;
          }
        }

        const { error: deleteSpecialBadgesError } = await supabase
          .from("event_special_badges")
          .delete()
          .eq("event_id", savedId);
        if (deleteSpecialBadgesError) throw deleteSpecialBadgesError;

        const allowedSpecialBadgeIds = new Set(
          badges
            .filter((badge) => badge.category === "special" && badge.name !== "Founding Member")
            .map((badge) => badge.id),
        );
        const specialBadgeIds = [...new Set(localSpecialBadgeIds.filter((badgeId) => allowedSpecialBadgeIds.has(badgeId)))];
        if (specialBadgeIds.length) {
          const { error: insertSpecialBadgesError } = await supabase
            .from("event_special_badges")
            .insert(specialBadgeIds.map((badgeId) => ({ event_id: savedId, badge_id: badgeId })));
          if (insertSpecialBadgesError) throw insertSpecialBadgesError;
        }
      }
    },
    onSuccess: async () => {
      // If converting from a proposal, mark it as "converted"
      if (convertProposalId) {
        await supabase
          .from("activity_proposals")
          .update({ status: "converted", updated_at: new Date().toISOString() })
          .eq("id", convertProposalId);
        setConvertProposalId(null);
      }
      toast.success("Evento salvato");
      queryClient.invalidateQueries({ queryKey: ["admin-events"] });
      queryClient.invalidateQueries({ queryKey: ["admin-proposals"] });
      setEditEvent(null);
      setLocalPriceOptions([]);
      setLocalSpecialBadgeIds([]);
      setLocalEventStaff([]);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Evento eliminato"); queryClient.invalidateQueries({ queryKey: ["admin-events"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  /* ── Filtering ── */
  const today = getLocalDateString();
  const filtered = events.filter(e => {
    if (!e.title.toLowerCase().includes(search.toLowerCase())) return false;
    const pastEvent = isEventPast(e, today);
    if (eventPeriod === "upcoming" && pastEvent) return false;
    if (eventPeriod === "past" && !pastEvent) return false;
    if (dashboardFilter === "empty") {
      return e.date >= today && ["published", "available", "open"].includes(e.status) && e.spots_taken === 0;
    }
    if (dashboardFilter === "pending") return pendingEventIds.includes(e.id);
    return true;
  });
  const getCategoryName = (id: string | null) => categories.find(c => c.id === id)?.name || "—";

  /* ══════ RENDER ══════ */
  const sortedEvents = [...filtered].sort((a, b) => {
    if (sortField === "organizer") {
      const organizerA = (a.organizer_name || "").toLocaleLowerCase();
      const organizerB = (b.organizer_name || "").toLocaleLowerCase();
      const organizerComparison = organizerA.localeCompare(organizerB);
      if (organizerComparison !== 0) return sortDirection === "asc" ? organizerComparison : -organizerComparison;

      const dateComparison = a.date.localeCompare(b.date);
      return sortDirection === "asc" ? dateComparison : -dateComparison;
    }

    const dateComparison = a.date.localeCompare(b.date);
    if (dateComparison !== 0) return sortDirection === "asc" ? dateComparison : -dateComparison;

    const organizerComparison = (a.organizer_name || "").localeCompare(b.organizer_name || "");
    return sortDirection === "asc" ? organizerComparison : -organizerComparison;
  });
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(current => current === "asc" ? "desc" : "asc");
      return;
    }
    setSortField(field);
    setSortDirection("asc");
  };
  const setEventPeriod = (value: EventPeriodFilter) => {
    const nextParams = new URLSearchParams(searchParams);
    if (value === "upcoming") {
      nextParams.delete("period");
    } else {
      nextParams.set("period", value);
    }
    setSearchParams(nextParams, { replace: true });
  };
  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowDown className="h-3.5 w-3.5 opacity-40" />;
    return sortDirection === "asc"
      ? <ArrowUp className="h-3.5 w-3.5" />
      : <ArrowDown className="h-3.5 w-3.5" />;
  };
  const specialBadges = badges.filter((badge) => badge.category === "special" && badge.name !== "Founding Member");
  const handleSaveEvent = () => {
    if (!editEvent) return;
    const requiresPublicationFields = !canSaveIncompleteEventDraft(editEvent.status);
    if (requiresPublicationFields && !editEvent.image_url) {
      toast.error("Carica un'immagine di copertina");
      return;
    }
    if (requiresPublicationFields && !getAF(editEvent).fit_score_main_category) {
      toast.error("Seleziona la categoria fit score principale");
      return;
    }
    saveMutation.mutate({ evt: editEvent, mps: localMeetingPoints, priceOptions: localPriceOptions });
  };
  const engagementDetailCopy = engagementDetail ? engagementAudienceLabels[engagementDetail.type] : null;

  return (
    <>
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">{t("events.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("events.subtitle")} ({events.length} {t("common.total").toLowerCase()})</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <RefreshButton queryKeys={[["admin-events"], ["admin-categories-list"]]} />
          <Button className="gap-2 flex-1 sm:flex-initial" onClick={handleOpenCreate}>
            <Plus className="h-4 w-4" /> {t("events.addEvent")}
          </Button>
        </div>
      </div>

      {dashboardFilter && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-warning/30 bg-warning/5">
          <CalendarX className="h-4 w-4 text-warning shrink-0" />
          <p className="text-sm text-foreground flex-1">
            {dashboardFilter === "empty" ? "Filtro attivo: eventi senza iscritti" : dashboardFilter === "pending" ? "Filtro attivo: iscrizioni in attesa" : `Filtro: ${dashboardFilter}`}
          </p>
          <Button variant="ghost" size="sm" onClick={() => navigate("/events")}>Rimuovi filtro</Button>
        </div>
      )}

      {/* ═══ TABLE ═══ */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder={t("events.searchPlaceholder")} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <div className="inline-flex w-full rounded-md border bg-muted p-1 sm:w-auto">
              {EVENT_PERIOD_FILTERS.map((filter) => (
                <Button
                  key={filter}
                  type="button"
                  variant={eventPeriod === filter ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 flex-1 px-3 text-xs sm:flex-initial"
                  onClick={() => setEventPeriod(filter)}
                >
                  {t(`events.period.${filter}`)}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-hidden px-2 sm:px-6">
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
          ) : (
            <Table className="table-fixed text-xs sm:text-sm">
              <colgroup>
                <col className="w-[30%]" />
                <col className="w-[16%]" />
                <col className="w-[13%]" />
                <col className="w-[11%]" />
                <col className="w-[8%]" />
                <col className="w-[9%]" />
                <col className="w-[9%]" />
                <col className="w-[4%]" />
              </colgroup>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-2 py-3 sm:px-3">{t("events.event")}</TableHead>
                  <TableHead className="px-2 py-3 sm:px-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="-ml-2 h-auto min-h-8 gap-1 whitespace-normal px-2 text-left text-xs font-medium leading-tight sm:text-sm"
                      onClick={() => toggleSort("organizer")}
                    >
                      {t("events.organizer")}
                      {renderSortIcon("organizer")}
                    </Button>
                  </TableHead>
                  <TableHead className="px-2 py-3 sm:px-3">{t("events.category")}</TableHead>
                  <TableHead className="px-2 py-3 sm:px-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="-ml-2 h-auto min-h-8 gap-1 whitespace-normal px-2 text-left text-xs font-medium leading-tight sm:text-sm"
                      onClick={() => toggleSort("date")}
                    >
                      {t("common.date")}
                      {renderSortIcon("date")}
                    </Button>
                  </TableHead>
                  <TableHead className="px-2 py-3 sm:px-3">{t("events.spots")}</TableHead>
                  <TableHead className="px-2 py-3 sm:px-3">{t("common.status")}</TableHead>
                  <TableHead className="px-2 py-3 sm:px-3">{t("events.visibility")}</TableHead>
                  <TableHead className="px-1 py-3" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedEvents.map(event => (
                  <TableRow key={event.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/events/${event.id}`)}>
                    <TableCell className="px-2 py-3 font-medium sm:px-3">
                      <div className="flex min-w-0 items-start gap-1.5">
                        <div className="mt-0.5 flex shrink-0 items-center gap-1">
                          {hasAnyAccessRule(event) && <Shield className="h-3.5 w-3.5 text-primary shrink-0" />}
                          {(event.event_price_options?.length || 0) > 0 && <DollarSign className="h-3.5 w-3.5 text-accent-foreground shrink-0" />}
                        </div>
                        <div className="min-w-0 space-y-1">
                          <span className="block whitespace-normal break-words leading-snug">{event.title}</span>
                          <EventBadgePills event={event} className="flex-wrap" />
                          {renderEngagementChips(event)}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="break-words px-2 py-3 text-muted-foreground sm:px-3">{event.organizer_name}</TableCell>
                    <TableCell className="px-2 py-3 sm:px-3"><Badge variant="secondary" className="max-w-full whitespace-normal break-words text-center leading-tight">{getCategoryName(event.category_id)}</Badge></TableCell>
                    <TableCell className="break-words px-2 py-3 text-muted-foreground sm:px-3">{event.date}</TableCell>
                    <TableCell className="px-2 py-3 sm:px-3">{event.spots_taken}/{event.spots_total}</TableCell>
                    <TableCell className="px-2 py-3 sm:px-3"><Badge variant="outline" className={`max-w-full whitespace-normal break-words text-center leading-tight ${statusColors[event.status] || ""}`}>{event.status}</Badge></TableCell>
                    <TableCell className="px-2 py-3 sm:px-3"><Badge variant="outline" className={`max-w-full whitespace-normal break-words text-center leading-tight ${visibilityColors[event.visibility] || ""}`}>{event.visibility}</Badge></TableCell>
                    <RowActionCell className="px-1 py-1 sm:py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <RowActionButton aria-label="Azioni evento">
                            <MoreHorizontal className="h-4 w-4" />
                          </RowActionButton>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/events/${event.id}`)}><Eye className="h-4 w-4 mr-2" /> Visualizza</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleOpenEdit(event)}><Edit2 className="h-4 w-4 mr-2" /> Modifica</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/events/${event.id}`); toast.success("Link copiato!"); }}><Copy className="h-4 w-4 mr-2" /> Copia link</DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <a href={`https://wa.me/?text=${encodeURIComponent(`Sei invitato a "${event.title}"!\n${window.location.origin}/events/${event.id}`)}`} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-4 w-4 mr-2" /> Condividi WhatsApp</a>
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => { if (confirm("Eliminare questo evento?")) deleteMutation.mutate(event.id); }}><Trash2 className="h-4 w-4 mr-2" /> Elimina</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </RowActionCell>
                  </TableRow>
                ))}
                {sortedEvents.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">{t("events.noEventsFound")}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════════
           EDIT / CREATE DIALOG
         ═══════════════════════════════════════════════════════════ */}
      <Dialog open={!!editEvent} onOpenChange={o => { if (!o) setEditEvent(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader><DialogTitle>{editEvent?.isNew ? "Crea evento" : "Modifica evento"}</DialogTitle></DialogHeader>
          {editEvent && (
            <div className="space-y-5 overflow-y-auto pr-1 flex-1">

              {/* ═══ 1. INFORMAZIONI BASE ═══ */}
              <section className="space-y-3">
                <h4 className="text-sm font-semibold border-b pb-1">📋 Informazioni base</h4>
                <div>
                  <Label>Titolo</Label>
                  <Input value={editEvent.title || ""} onChange={e => setEditEvent({ ...editEvent, title: e.target.value })} />
                </div>
                <div>
                  <Label>Descrizione</Label>
                  <RichTextEditor content={editEvent.description || ""} onChange={(html) => setEditEvent({ ...editEvent, description: html })} />
                </div>
                <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
                  <Label className="flex items-center gap-1.5 text-sm font-semibold">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Frase conclusiva
                  </Label>
                  <Select value={getClosingSentenceMode(editEvent)} onValueChange={(value) => updateClosingSentenceMode(value as "random" | "preset" | "manual")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="random">Random</SelectItem>
                      <SelectItem value="preset">Scegli frase</SelectItem>
                      <SelectItem value="manual">Frase manuale</SelectItem>
                    </SelectContent>
                  </Select>

                  {getClosingSentenceMode(editEvent) === "preset" && (
                    <Select
                      value={getClosingSentence(editEvent) || closingSentenceOptions[0]}
                      onValueChange={updateClosingSentence}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {closingSentenceOptions.map((sentence) => (
                          <SelectItem key={sentence} value={sentence}>
                            {sentence}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {getClosingSentenceMode(editEvent) === "manual" && (
                    <Input
                      value={getClosingSentence(editEvent)}
                      onChange={(event) => updateClosingSentence(event.target.value)}
                      placeholder="Inserisci una frase conclusiva"
                    />
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    Le frasi disponibili si gestiscono da Admin &gt; Frasi evento. Random usa automaticamente una frase attiva.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Luogo (coordinate/indirizzo)</Label>
                    <GoogleAddressInput
                      value={editEvent.location || ""}
                      onValueChange={(location) => setEditEvent({ ...editEvent, location })}
                      onPlaceSelect={({ address }) => setEditEvent({ ...editEvent, location: address })}
                    />
                  </div>
                  <div><Label>Etichetta luogo</Label><Input value={editEvent.location_label || ""} onChange={e => setEditEvent({ ...editEvent, location_label: e.target.value })} placeholder="es. Rifugio Rosso" /></div>
                </div>
                <div className="space-y-2 rounded-lg border bg-card p-3">
                  <Label className="flex items-center gap-1.5 text-sm font-semibold">
                    <MessageCircle className="h-4 w-4 text-[#25D366]" />
                    Gruppo WhatsApp evento
                  </Label>
                  <Input
                    value={editEvent.whatsapp_group_url || ""}
                    onChange={e => setEditEvent({ ...editEvent, whatsapp_group_url: e.target.value })}
                    placeholder="https://chat.whatsapp.com/..."
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Opzionale. Visibile solo ad admin, organizzatore e utenti con iscrizione confermata.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Data</Label><Input type="date" value={editEvent.date || ""} onChange={e => setEditEvent({ ...editEvent, date: e.target.value })} /></div>
                  <div><Label>Ora</Label><Input type="time" value={editEvent.time || ""} onChange={e => setEditEvent({ ...editEvent, time: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Organizzatore</Label>
                    <Select value={editEvent.organizer_id || "none"} onValueChange={v => {
                      if (v === "none") setEditEvent({ ...editEvent, organizer_id: null, organizer_name: "" });
                      else { const o = organizers.find(x => x.id === v); setEditEvent({ ...editEvent, organizer_id: v, organizer_name: o?.name || "" }); }
                    }}>
                      <SelectTrigger><SelectValue placeholder="Seleziona organizzatore" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nessuno</SelectItem>
                        {organizers.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Categoria</Label>
                    <Select value={editEvent.category_id || "none"} onValueChange={v => setEditEvent({ ...editEvent, category_id: v === "none" ? null : v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nessuna</SelectItem>
                        {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-3 rounded-lg border bg-card p-3">
                  <div>
                    <Label className="text-xs font-semibold">Categoria fit score principale</Label>
                    <Select
                      value={getAF(editEvent).fit_score_main_category || "none"}
                      onValueChange={(value) => {
                        const selected = value === "none" ? null : value;
                        const secondary = (getAF(editEvent).fit_score_secondary_categories || []).filter((category) => category !== selected);
                        updateAF({ fit_score_main_category: selected, fit_score_secondary_categories: secondary });
                      }}
                    >
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Seleziona categoria" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nessuna</SelectItem>
                        {INTEREST_CATEGORY_OPTIONS.map((option) => (
                          <SelectItem key={option.id} value={option.label}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Categorie fit score secondarie</Label>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {INTEREST_CATEGORY_OPTIONS.filter((option) => option.label !== getAF(editEvent).fit_score_main_category).map((option) => {
                        const selected = (getAF(editEvent).fit_score_secondary_categories || []).includes(option.label);
                        const disabled = !selected && (getAF(editEvent).fit_score_secondary_categories || []).length >= FIT_SCORE_EVENT_SECONDARY_MAX;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            disabled={disabled}
                            onClick={() => {
                              const current = getAF(editEvent).fit_score_secondary_categories || [];
                              updateAF({
                                fit_score_secondary_categories: selected
                                  ? current.filter((category) => category !== option.label)
                                  : [...current, option.label].slice(0, FIT_SCORE_EVENT_SECONDARY_MAX),
                              });
                            }}
                            className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                              selected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-muted/40 text-foreground"
                            } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div className="space-y-2 rounded-lg border bg-card p-3">
                  <div className="flex items-center gap-2">
                    <Award className="h-4 w-4 text-primary" />
                    <h5 className="text-sm font-semibold">Badge speciali evento</h5>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Seleziona badge speciali</Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" variant="outline" className="h-auto min-h-10 w-full justify-between whitespace-normal text-left font-normal">
                          <span className="flex flex-wrap gap-1.5">
                            {(() => {
                              const selectedBadges = specialBadges.filter((badge) => localSpecialBadgeIds.includes(badge.id));

                              if (!selectedBadges.length) {
                                return <span className="text-muted-foreground">Nessun badge speciale selezionato</span>;
                              }

                              return selectedBadges.map((badge) => (
                                <Badge key={badge.id} variant="secondary" className="gap-1">
                                  <span>{badge.icon}</span>
                                  {badge.name}
                                </Badge>
                              ));
                            })()}
                          </span>
                          <Sparkles className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-72 overflow-y-auto">
                        {specialBadges.map((badge) => {
                          const selected = localSpecialBadgeIds.includes(badge.id);

                          return (
                            <DropdownMenuCheckboxItem
                              key={badge.id}
                              checked={selected}
                              onCheckedChange={(checked) => {
                                const nextIds = checked
                                  ? [...localSpecialBadgeIds, badge.id]
                                  : localSpecialBadgeIds.filter((id) => id !== badge.id);
                                updateSpecialBadgeIds(nextIds);
                              }}
                              onSelect={(event) => event.preventDefault()}
                            >
                              <span className="mr-2">{badge.icon}</span>
                              <span className="truncate">{badge.name}</span>
                            </DropdownMenuCheckboxItem>
                          );
                        })}
                        {specialBadges.length === 0 && (
                          <DropdownMenuItem disabled>Nessun badge speciale disponibile</DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <p className="text-[11px] text-muted-foreground">Questi badge verranno assegnati solo agli utenti segnati come presenti all’evento.</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Stato</Label>
	                    <Select value={normalizeEditableEventStatus(editEvent.status)} onValueChange={v => setEditEvent({ ...editEvent, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Non pubblicato</SelectItem>
                        <SelectItem value="upcoming">In arrivo</SelectItem>
                        <SelectItem value="open">Aperto</SelectItem>
                        <SelectItem value="closed">Iscrizioni chiuse</SelectItem>
                        <SelectItem value="full">Sold out</SelectItem>
                        <SelectItem value="rescheduled">Riprogrammato</SelectItem>
                        <SelectItem value="cancelled">Annullato</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between pt-6">
                    <Label>Evento in evidenza</Label>
                    <Switch checked={editEvent.featured || false} onCheckedChange={v => setEditEvent({ ...editEvent, featured: v })} />
                  </div>
                </div>
              </section>

              {/* ═══ 2. GALLERIA ═══ */}
              <Separator />
              <section className="space-y-3">
                <h4 className="text-sm font-semibold border-b pb-1">🖼️ Galleria</h4>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    Immagine di copertina
                    {!canSaveIncompleteEventDraft(editEvent.status) && <span className="text-destructive font-bold">*</span>}
                  </Label>
                  <div className="flex items-start gap-4">
                    <div className="relative h-24 w-24 bg-muted rounded-md border border-dashed overflow-hidden flex items-center justify-center">
                      {editEvent.image_url ? (
                        <>
                          <img src={editEvent.image_url} alt="Copertina" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => {
                              const nextAdditionalFields = { ...getAF(editEvent) };
                              delete nextAdditionalFields[HOME_CARD_IMAGE_FIELD];
                              setEditEvent({ ...editEvent, image_url: "", additional_fields: nextAdditionalFields });
                            }}
                            className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </>
                      ) : <ImageIcon className="h-6 w-6 text-muted-foreground" />}
                    </div>
                    {editEvent.image_url && (
                      <div className="space-y-1">
                        <div className="relative h-24 w-24 overflow-hidden rounded-md border bg-muted">
                          <img
                            src={getEventHomeCardImageUrl(editEvent) || editEvent.image_url}
                            alt="Anteprima home"
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <p className="text-[10px] text-muted-foreground">Anteprima home 1:1</p>
                      </div>
                    )}
                    <Button variant="outline" size="sm" asChild disabled={isUploading}>
                      <label className="cursor-pointer">{isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}Carica copertina<input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, "cover")} /></label>
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center justify-between">
                    <span>Immagini galleria ({normalizeGalleryImages(editEvent.gallery_images).length}/5)</span>
                    {normalizeGalleryImages(editEvent.gallery_images).length < 5 && (
                      <Button variant="ghost" size="sm" asChild disabled={isUploading} className="h-7 text-xs">
                        <label className="cursor-pointer"><Plus className="h-3 w-3 mr-1" /> Aggiungi<input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, "gallery")} /></label>
                      </Button>
                    )}
                  </Label>
                  {normalizeGalleryImages(editEvent.gallery_images).length === 0 && <p className="text-xs text-muted-foreground italic">Nessuna immagine aggiunta.</p>}
                  {normalizeGalleryImages(editEvent.gallery_images).map((img, idx) => (
                    <div key={idx} className="flex items-center gap-3 bg-muted/30 p-2 rounded-md border">
                      <img src={img.url} alt={`Galleria ${idx}`} className="w-12 h-10 object-cover rounded border" />
                      <div className="flex-1 text-[10px] truncate max-w-[200px] font-mono text-muted-foreground">{img.url.split("/").pop()}</div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" disabled={idx === 0} onClick={() => moveGalleryImage(idx, "up")}><ArrowUp className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" disabled={idx === normalizeGalleryImages(editEvent.gallery_images).length - 1} onClick={() => moveGalleryImage(idx, "down")}><ArrowDown className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeGalleryImage(idx)}><X className="h-3 w-3" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* ═══ 3. CAPACITÀ E PREZZI ═══ */}
              <Separator />
              <section className="space-y-3">
                <h4 className="text-sm font-semibold border-b pb-1">💰 Capacità e prezzi</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Posti totali</Label><Input type="number" value={editEvent.spots_total ?? ""} onChange={e => setEditEvent({ ...editEvent, spots_total: e.target.value === "" ? undefined : parseInt(e.target.value) })} /></div>
                  <div><Label>Posti riservati</Label><Input type="number" value={editEvent.reserved_spots ?? 0} onChange={e => setEditEvent({ ...editEvent, reserved_spots: parseInt(e.target.value) || 0 })} /></div>
                </div>
                <div>
                  <Label>Politica di cancellazione</Label>
                  <Select value={normalizeCancellationPolicy(editEvent.cancellation_policy)} onValueChange={v => setEditEvent({ ...editEvent, cancellation_policy: normalizeCancellationPolicy(v) })}>
                    <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                    <SelectContent>
                      {CANCELLATION_POLICY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {/* ── Modalità di partecipazione (inside capacity) ── */}
                {(editEvent.payment_type === "paid" || editEvent.payment_type === "deposit" || editEvent.payment_type === "location") && (
                  <div className="space-y-3 p-3 rounded-lg border border-dashed border-primary/30 bg-primary/5">
                    <div className="flex items-center justify-between">
	                      <Label className="text-xs font-semibold flex items-center gap-1.5"><Tag className="h-3.5 w-3.5 text-primary" /> Modalità di partecipazione</Label>
	                      <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={addPricingRule}><Plus className="h-3 w-3 mr-1" /> Aggiungi formula</Button>
                    </div>
	                    <p className="text-[10px] text-muted-foreground">Prezzo standard: <strong>€{editEvent.price ?? 0}</strong>. Le formule vengono valutate dall'alto verso il basso.</p>

	                    {getPricingRules(editEvent).length === 0 && <p className="text-xs text-muted-foreground italic text-center py-2">Nessuna formula. Tutti vedono il prezzo standard.</p>}

                    {getPricingRules(editEvent).map((rule, ri) => (
                      <div key={rule.id} className="space-y-2 p-3 rounded-md border bg-card">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-muted-foreground bg-muted rounded-full w-5 h-5 flex items-center justify-center shrink-0">{ri + 1}</span>
	                          <Input className="h-8 text-sm" placeholder="Nome formula" value={rule.name} onChange={e => updatePricingRule(rule.id, { name: e.target.value })} />
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive" onClick={() => removePricingRule(rule.id)}><X className="h-3.5 w-3.5" /></Button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-[10px]">Prezzo (€)</Label>
                            <Input type="number" step="0.01" min={0} className="h-8 text-sm" value={rule.price ?? ""} onChange={e => {
                              const price = parseFloat(e.target.value) || 0;
                              updatePricingRule(rule.id, {
                                price,
                                balance_amount: rule.payment_type === "deposit" ? Math.max(0, price - Number(rule.deposit_amount || 0)) : rule.balance_amount,
                              });
                            }} />
                          </div>
                          <div>
                            <Label className="text-[10px]">Prezzo originale (€)</Label>
                            <Input type="number" step="0.01" className="h-8 text-sm" placeholder="Opzionale" value={rule.original_price ?? ""} onChange={e => updatePricingRule(rule.id, { original_price: e.target.value ? parseFloat(e.target.value) : null })} />
                          </div>
                          <div>
                            <Label className="text-[10px]">Visibilità prezzo</Label>
                            <Select value={rule.condition} onValueChange={v => updatePricingRule(rule.id, { condition: v, condition_value: null, condition_numeric_value: null })}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>{PRICING_CONDITIONS.map(c => <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <Label className="text-[10px]">Pagamento</Label>
                            <Select value={rule.payment_type || (editEvent.payment_type as PaymentType) || "free"} onValueChange={v => {
                              const paymentType = v as PaymentType;
                              const depositAmount = paymentType === "deposit" ? Number(rule.deposit_amount ?? editEvent.deposit ?? 0) : null;
                              updatePricingRule(rule.id, {
                                payment_type: paymentType,
                                deposit_amount: depositAmount,
                                balance_amount: paymentType === "deposit" ? Math.max(0, Number(rule.price || 0) - Number(depositAmount || 0)) : null,
                                balance_payment_mode: paymentType === "deposit" ? (rule.balance_payment_mode || "online") : null,
                              });
                            }}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="free">Gratis</SelectItem>
                                <SelectItem value="paid">Online completo</SelectItem>
                                <SelectItem value="location">Sul posto</SelectItem>
                                <SelectItem value="deposit">Acconto + saldo</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-end gap-2">
                            <Switch
                              checked={!!rule.has_dedicated_spots}
                              onCheckedChange={v => updatePricingRule(rule.id, { has_dedicated_spots: v, dedicated_spots: v ? (rule.dedicated_spots ?? 1) : null })}
                            />
                            <Label className="text-xs pb-1">Posti dedicati</Label>
                          </div>
                        </div>

                        {rule.payment_type === "deposit" && (
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <Label className="text-[10px]">Acconto (€)</Label>
                              <Input type="number" step="0.01" min={0} className="h-8 text-sm" value={rule.deposit_amount ?? ""} onChange={e => {
                                const depositAmount = parseFloat(e.target.value) || 0;
                                updatePricingRule(rule.id, {
                                  deposit_amount: depositAmount,
                                  balance_amount: Math.max(0, Number(rule.price || 0) - depositAmount),
                                });
                              }} />
                            </div>
                            <div>
                              <Label className="text-[10px]">Saldo calcolato</Label>
                              <div className="h-8 rounded-md border border-input bg-muted/40 px-3 text-sm font-semibold flex items-center">
                                €{Math.max(0, Number(rule.price || 0) - Number(rule.deposit_amount || 0)).toFixed(2)}
                              </div>
                            </div>
                            <div>
                              <Label className="text-[10px]">Modalità saldo</Label>
                              <Select value={rule.balance_payment_mode || "online"} onValueChange={v => updatePricingRule(rule.id, { balance_payment_mode: v as BalancePaymentMode })}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="online">Online</SelectItem>
                                  <SelectItem value="on_site">Sul posto</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        )}

                        {rule.has_dedicated_spots && (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
	                              <Label className="text-[10px]">Posti formula</Label>
                              <Input type="number" min={0} className="h-8 text-sm" value={rule.dedicated_spots ?? ""} onChange={e => updatePricingRule(rule.id, { dedicated_spots: parseInt(e.target.value) || 0 })} />
                            </div>
                            <div className="flex items-end text-[10px] text-muted-foreground pb-2">
	                              {rule.spots_taken ? `${rule.spots_taken} posti gia presi` : "Nessun posto preso su questa formula"}
                            </div>
                          </div>
                        )}

                        {/* Numeric condition (trekking_count / events_count) */}
                        {(rule.condition === "trekking_count" || rule.condition === "events_count") && (
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <Label className="text-[10px]">Tipo regola</Label>
                              <Input className="h-8 text-xs" value={rule.condition === "trekking_count" ? "Numero trekking" : "Numero eventi"} disabled />
                            </div>
                            <div>
                              <Label className="text-[10px]">Operatore</Label>
                              <Select value={rule.condition_operator || ">"} onValueChange={v => updatePricingRule(rule.id, { condition_operator: v })}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>{CONDITION_OPERATORS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-[10px]">Valore</Label>
                              <Input type="number" min={0} className="h-8 text-sm" value={rule.condition_numeric_value ?? ""} onChange={e => updatePricingRule(rule.id, { condition_numeric_value: e.target.value ? parseInt(e.target.value) : null })} />
                            </div>
                          </div>
                        )}

                        {/* Badge/level selection */}
                        {rule.condition === "specific_badge" && (
                          <div className="space-y-1.5">
                            <Label className="text-[10px]">Seleziona badge o livelli</Label>
                            <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto p-2 rounded border bg-muted/30">
                              {badges.length > 0 && (
                                <>
                                  <p className="col-span-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Badge</p>
                                  {badges.map(b => {
                                    const sel = (rule.condition_value || []).includes(b.id);
                                    return (
                                      <div key={b.id} className="flex items-center gap-1.5">
                                        <Checkbox checked={sel} onCheckedChange={v => {
                                          const cur = rule.condition_value || [];
                                          updatePricingRule(rule.id, { condition_value: v ? [...cur, b.id] : cur.filter(x => x !== b.id) || null });
                                        }} />
                                        <span className="text-xs">{b.icon} {b.name}</span>
                                      </div>
                                    );
                                  })}
                                </>
                              )}
                              {communityLevels.length > 0 && (
                                <>
                                  <p className="col-span-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-1">Livelli</p>
                                  {communityLevels.map(l => {
                                    const k = `level_${l.id}`;
                                    const sel = (rule.condition_value || []).includes(k);
                                    return (
                                      <div key={l.id} className="flex items-center gap-1.5">
                                        <Checkbox checked={sel} onCheckedChange={v => {
                                          const cur = rule.condition_value || [];
                                          updatePricingRule(rule.id, { condition_value: v ? [...cur, k] : cur.filter(x => x !== k) || null });
                                        }} />
                                        <span className="text-xs">{l.icon} {l.name}</span>
                                      </div>
                                    );
                                  })}
                                </>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Promo toggle */}
                        <div className="flex items-center gap-3 pt-1">
                          <Checkbox checked={rule.is_promotional || false} onCheckedChange={v => updatePricingRule(rule.id, { is_promotional: !!v })} />
                          <Label className="text-xs cursor-pointer">Promo temporanea</Label>
                        </div>
                        {rule.is_promotional && (
                          <div className="grid grid-cols-2 gap-2">
                            <div><Label className="text-[10px]">Inizio promo</Label><Input type="datetime-local" className="h-8 text-xs" value={rule.promo_start || ""} onChange={e => updatePricingRule(rule.id, { promo_start: e.target.value || null })} /></div>
                            <div><Label className="text-[10px]">Fine promo</Label><Input type="datetime-local" className="h-8 text-xs" value={rule.promo_end || ""} onChange={e => updatePricingRule(rule.id, { promo_end: e.target.value || null })} /></div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* ═══ 4. DETTAGLI EVENTO ═══ */}
              <Separator />
              <section className="space-y-3">
                <h4 className="text-sm font-semibold border-b pb-1">🏔️ Dettagli evento</h4>
                <div>
                  <Label>Difficoltà</Label>
                  <Select value={editEvent.difficulty || "none"} onValueChange={v => setEditEvent({ ...editEvent, difficulty: v === "none" ? null : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nessuna difficoltà</SelectItem>
                      {difficultyLevels.map(l => (
                        <SelectItem key={l.id} value={String(l.level_number)}>
                          <span className="flex items-center gap-2"><span>{l.icon}</span> Livello {l.level_number} – {l.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <Label>Durata</Label>
                    <div className="flex gap-2">
                      <Input type="number" step="0.5" className="flex-1" placeholder="es. 3" value={editEvent._durationValue !== undefined ? editEvent._durationValue : parseMeasure(editEvent.duration)} onChange={e => setEditEvent({ ...editEvent, _durationValue: e.target.value })} />
                      <Select value={getAF(editEvent).duration_unit || "h"} onValueChange={v => updateAF({ duration_unit: v })}>
                        <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="h">Ore</SelectItem>
                          <SelectItem value="giorni">Giorni</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Distanza</Label>
                    <div className="relative">
                      <Input type="number" step="0.1" placeholder="es. 12" value={editEvent._distanceValue !== undefined ? editEvent._distanceValue : parseMeasure(editEvent.distance)} onChange={e => setEditEvent({ ...editEvent, _distanceValue: e.target.value })} className="pr-10" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">km</span>
                    </div>
                  </div>
                  <div>
                    <Label>Dislivello</Label>
                    <div className="relative">
                      <Input type="number" step="1" placeholder="es. 500" value={editEvent._elevationValue !== undefined ? editEvent._elevationValue : parseMeasure(editEvent.elevation)} onChange={e => setEditEvent({ ...editEvent, _elevationValue: e.target.value })} className="pr-8" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">m</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* ═══ 5. BADGE EVENTO ═══ */}
              <Separator />
              <section className="space-y-3">
                <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /><h4 className="text-sm font-semibold">Badge evento</h4></div>
                <p className="text-[10px] text-muted-foreground">Massimo 2 badge visibili. I badge automatici hanno priorità sui manuali.</p>
                <div className="grid grid-cols-2 gap-2">
                  {MANUAL_BADGE_OPTIONS.map(badge => {
                    const stored = ((editEvent.event_badges as any[]) || []).filter((b: any) => typeof b === "string");
                    const sel = stored.includes(badge.value);
                    return (
                      <button key={badge.value} type="button" onClick={() => {
                        const cur = (editEvent.event_badges as any[]) || [];
                        setEditEvent({ ...editEvent, event_badges: sel ? cur.filter((b: any) => b !== badge.value) : [...cur, badge.value] });
                      }} className={`flex items-center gap-2 p-2 rounded-lg border text-xs text-left transition-colors ${sel ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:border-primary/50"}`}>
                        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${badge.color}`}>{badge.label}</span>
                      </button>
                    );
                  })}
                </div>
                <div>
                  <Label className="text-xs">Badge personalizzato</Label>
                  <Input className="h-8 text-sm" placeholder="es. NUOVO, SPECIALE..." value={getCustomEventBadge(editEvent.event_badges)} onChange={e => {
                    const cur = canonicalizeEventBadges(editEvent.event_badges).filter((badge) => MANAGED_EVENT_BADGES.has(badge));
                    const v = e.target.value.trim();
                    setEditEvent({ ...editEvent, event_badges: v ? [...cur, v] : cur });
                  }} />
                </div>
                <div className="p-2 rounded border bg-muted/30">
                  <p className="text-[10px] text-muted-foreground mb-1">Anteprima badge:</p>
                  <EventBadgePills event={editEvent as any} />
                </div>
              </section>

              {/* ═══ 6. OVERRIDE METEO ═══ */}
              <Separator />
              <section className="space-y-3">
                <div className="flex items-center gap-2"><CloudSun className="h-4 w-4 text-primary" /><h4 className="text-sm font-semibold">Override meteo</h4></div>
                <div>
                  <Label className="text-xs">Condizione meteo</Label>
                  <Select value={getWeather(editEvent).weather_condition || "none"} onValueChange={v => updateWeather({ weather_condition: v === "none" ? undefined : v })}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Seleziona condizione..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Nessun override —</SelectItem>
                      {WEATHER_OPTIONS.map(w => <SelectItem key={w.value} value={w.value}>{w.emoji} {w.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {getWeather(editEvent).weather_condition && (
                  <div className="grid grid-cols-3 gap-3">
                    <div><Label className="text-xs flex items-center gap-1"><Thermometer className="h-3 w-3" /> Min (°C)</Label><Input type="number" value={getWeather(editEvent).temp_min ?? ""} onChange={e => updateWeather({ temp_min: e.target.value ? Number(e.target.value) : null })} className="h-8" /></div>
                    <div><Label className="text-xs flex items-center gap-1"><Thermometer className="h-3 w-3" /> Media (°C)</Label><Input type="number" value={getWeather(editEvent).temp_avg ?? ""} onChange={e => updateWeather({ temp_avg: e.target.value ? Number(e.target.value) : null })} className="h-8" /></div>
                    <div><Label className="text-xs flex items-center gap-1"><Thermometer className="h-3 w-3" /> Max (°C)</Label><Input type="number" value={getWeather(editEvent).temp_max ?? ""} onChange={e => updateWeather({ temp_max: e.target.value ? Number(e.target.value) : null })} className="h-8" /></div>
                  </div>
                )}
              </section>

              {/* ═══ 7. REGOLE DI ISCRIZIONE ═══ */}
              <Separator />
              <section className="space-y-3">
                <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-primary" /><h4 className="text-sm font-semibold">Regole di iscrizione</h4></div>
                <div className="space-y-2 p-3 rounded-lg border bg-card">
                  <Label className="text-xs font-semibold flex items-center gap-1.5"><Eye className="h-3.5 w-3.5 text-primary" /> Visibilità</Label>
                  <Select value={editEvent.visibility || "public"} onValueChange={v => setEditEvent({ ...editEvent, visibility: v })}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Pubblico — visibile a tutti</SelectItem>
                      <SelectItem value="private">Privato — solo link diretto</SelectItem>
                      <SelectItem value="hidden">Nascosto — solo organizzatori e admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Lista d'attesa</Label>
                    <p className="text-[10px] text-muted-foreground">
                      Se l'evento va sold out, gli utenti possono entrare in lista senza occupare posti o generare pagamenti.
                    </p>
                  </div>
                  <Switch
                    checked={getAF(editEvent).waiting_list_enabled === true}
                    onCheckedChange={(value) => updateAF({ waiting_list_enabled: value })}
                  />
                </div>
              </section>

              {/* ═══ 8. REQUISITI DI REGISTRAZIONE ═══ */}
              <Separator />
              <section className="space-y-3">
                <div className="flex items-center gap-2"><Lock className="h-4 w-4 text-primary" /><h4 className="text-sm font-semibold">Requisiti di registrazione</h4></div>
                <p className="text-[10px] text-muted-foreground">Lascia vuoto per accesso libero.</p>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Livello minimo richiesto</Label>
                    <div className={`grid gap-2 ${getAR(editEvent).min_level ? "grid-cols-[minmax(0,1fr)_120px]" : "grid-cols-1"}`}>
                      <Select value={getAR(editEvent).min_level ? String(getAR(editEvent).min_level) : "none"} onValueChange={v => updateAR({ min_level: v === "none" ? null : parseInt(v) })}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Nessuno" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nessuno</SelectItem>
                          {difficultyLevels.map(l => <SelectItem key={l.id} value={String(l.level_number)}>{l.icon} {l.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {getAR(editEvent).min_level ? renderAccessRuleEnforcementSelect("min_level") : null}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Frequenza attività fisica minima</Label>
                    <div className={`grid gap-2 ${getAR(editEvent).min_activity_frequency ? "grid-cols-[minmax(0,1fr)_120px]" : "grid-cols-1"}`}>
                      <Select value={getAR(editEvent).min_activity_frequency || "none"} onValueChange={v => updateAR({ min_activity_frequency: v === "none" ? null : v })}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Nessuna" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nessuna</SelectItem>
                          {ACTIVITY_FREQUENCY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {getAR(editEvent).min_activity_frequency ? renderAccessRuleEnforcementSelect("min_activity_frequency") : null}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Numero minimo di esperienze</Label>
                    <div className={`grid gap-2 ${getAR(editEvent).min_experiences ? "grid-cols-[minmax(0,1fr)_120px]" : "grid-cols-1"}`}>
                      <Input type="number" min={0} className="h-8 text-sm" placeholder="Nessun minimo" value={getAR(editEvent).min_experiences ?? ""} onChange={e => updateAR({ min_experiences: e.target.value ? parseInt(e.target.value) : null })} />
                      {getAR(editEvent).min_experiences ? renderAccessRuleEnforcementSelect("min_experience") : null}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Min. eventi trekking completati</Label>
                    <div className={`grid gap-2 ${getAR(editEvent).min_trekking_events ? "grid-cols-[minmax(0,1fr)_120px]" : "grid-cols-1"}`}>
                      <Input type="number" min={0} className="h-8 text-sm" placeholder="Nessun minimo" value={getAR(editEvent).min_trekking_events ?? ""} onChange={e => updateAR({ min_trekking_events: e.target.value ? parseInt(e.target.value) : null })} />
                      {getAR(editEvent).min_trekking_events ? renderAccessRuleEnforcementSelect("min_trekking_events") : null}
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Min. presenze totali</Label>
                  <div className={`grid gap-2 ${getAR(editEvent).min_attended_events ? "grid-cols-[minmax(0,1fr)_120px] sm:w-1/2" : "grid-cols-1 sm:w-1/2"}`}>
                    <Input type="number" min={0} className="h-8 text-sm" placeholder="Nessun minimo" value={getAR(editEvent).min_attended_events ?? ""} onChange={e => updateAR({ min_attended_events: e.target.value ? parseInt(e.target.value) : null })} />
                    {getAR(editEvent).min_attended_events ? renderAccessRuleEnforcementSelect("min_attended_events") : null}
                  </div>
                </div>

                <div className="flex items-center gap-3 p-2.5 rounded-md border bg-card">
                  <Checkbox id="req-membership" checked={getAR(editEvent).require_active_membership || false} onCheckedChange={v => updateAR({ require_active_membership: !!v })} />
                  <label htmlFor="req-membership" className="text-xs font-medium cursor-pointer flex items-center gap-1.5"><Award className="h-3.5 w-3.5 text-primary" /> Membership attiva richiesta</label>
                </div>
                <div className="flex items-center gap-3 p-2.5 rounded-md border bg-card">
                  <Checkbox id="req-approval" checked={getAR(editEvent).require_manual_approval || false} onCheckedChange={v => updateAR({ require_manual_approval: !!v })} />
                  <label htmlFor="req-approval" className="text-xs font-medium cursor-pointer flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Approvazione manuale richiesta</label>
                </div>

                {/* Badge specifico richiesto (multi-select) */}
                <div>
                  <Label className="text-xs">Badge specifico richiesto</Label>
                  <div className="grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto p-2 rounded border bg-muted/30 mt-1">
                    {badges.map(b => {
                      const ids = getRequiredBadgeIds(getAR(editEvent));
                      const sel = ids.includes(b.id);
                      return (
                        <div key={b.id} className="flex items-center gap-1.5">
                          <Checkbox checked={sel} onCheckedChange={v => {
                            const cur = ids;
                            const updated = v ? [...cur, b.id] : cur.filter(x => x !== b.id);
                            updateAR({ required_badge_ids: updated.length ? updated : null, required_badge_id: null });
                          }} />
                          <span className="text-xs">{b.icon} {b.name}</span>
                        </div>
                      );
                    })}
                    {badges.length === 0 && <p className="text-xs text-muted-foreground col-span-2">Nessun badge disponibile</p>}
                  </div>
                </div>

                {/* Restriction message */}
                <div>
                  <Label className="text-xs">Messaggio di restrizione personalizzato</Label>
                  <Textarea value={getAR(editEvent).restriction_message || ""} onChange={e => updateAR({ restriction_message: e.target.value || undefined })} rows={2} placeholder='es. "Evento riservato ai soci con almeno 2 trekking completati."' />
                </div>
              </section>

              {/* ═══ 9. PUNTI DI RITROVO ═══ */}
              <Separator />
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /><h4 className="text-sm font-semibold">Punti di ritrovo</h4></div>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setLocalMeetingPoints([...localMeetingPoints, { _key: crypto.randomUUID(), name: "", location: "", time: "09:00", notes: "", sort_order: localMeetingPoints.length }])}>
                    <Plus className="h-3 w-3 mr-1" /> Aggiungi
                  </Button>
                </div>
                {localMeetingPoints.length === 0 && <p className="text-xs text-muted-foreground italic">Nessun punto di ritrovo.</p>}
                {localMeetingPoints.map((mp, idx) => (
                  <div key={mp._key} className="space-y-2 p-3 rounded-md border bg-card">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-muted-foreground">{idx + 1}</span>
                      <Input className="h-8 text-sm flex-1" placeholder="Nome punto" value={mp.name} onChange={e => { const arr = [...localMeetingPoints]; arr[idx] = { ...arr[idx], name: e.target.value }; setLocalMeetingPoints(arr); }} />
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setLocalMeetingPoints(localMeetingPoints.filter((_, i) => i !== idx))}><X className="h-3.5 w-3.5" /></Button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <GoogleAddressInput
                        className="h-8 text-sm"
                        placeholder="Luogo"
                        value={mp.location}
                        onValueChange={(location) => {
                          const arr = [...localMeetingPoints];
                          arr[idx] = { ...arr[idx], location };
                          setLocalMeetingPoints(arr);
                        }}
                        onPlaceSelect={({ address }) => {
                          const arr = [...localMeetingPoints];
                          arr[idx] = { ...arr[idx], location: address };
                          setLocalMeetingPoints(arr);
                        }}
                      />
                      <Input type="time" className="h-8 text-sm" value={mp.time} onChange={e => { const arr = [...localMeetingPoints]; arr[idx] = { ...arr[idx], time: e.target.value }; setLocalMeetingPoints(arr); }} />
                      <Input className="h-8 text-sm" placeholder="Note" value={mp.notes} onChange={e => { const arr = [...localMeetingPoints]; arr[idx] = { ...arr[idx], notes: e.target.value }; setLocalMeetingPoints(arr); }} />
                    </div>
                  </div>
                ))}
              </section>

              {/* ═══ 10. STAFF EVENTO ═══ */}
              <Separator />
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /><h4 className="text-sm font-semibold">Staff evento</h4></div>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={addStaffMember}>
                    <Plus className="h-3 w-3 mr-1" /> Aggiungi
                  </Button>
                </div>
                {localEventStaff.length === 0 && <p className="text-xs text-muted-foreground italic">Nessuno staff aggiuntivo inserito.</p>}
                {localEventStaff.map((member, idx) => {
                  const isPresetRole = STAFF_ROLE_PRESETS.includes(member.role_label);
                  const staffSearchTerm = member.profileSearch.trim();
                  const showStaffResults = activeStaffSearchIndex === idx && staffSearchTerm.length >= 2;

                  return (
                    <div key={member._key} className="space-y-3 p-3 rounded-md border bg-card">
                      <div className="flex items-center gap-3">
                        {member.avatar_url ? (
                          <img src={member.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                            {(member.display_name || "S").slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{member.display_name || "Nuovo membro staff"}</p>
                          <p className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">{member.role_label || "STAFF"}</p>
                        </div>
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeStaffMember(idx)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
                        <div className="relative space-y-1">
                          <Label className="text-xs">Profilo collegato</Label>
                          <Input
                            className="h-8 text-sm"
                            placeholder="Cerca per nome o email"
                            value={member.profileSearch}
                            onChange={(e) => {
                              updateStaffMember(idx, "profileSearch", e.target.value);
                              setActiveStaffSearchIndex(idx);
                            }}
                            onFocus={() => setActiveStaffSearchIndex(idx)}
                          />
                          {showStaffResults && (
                            <div className="absolute z-50 mt-1 max-h-44 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
                              {staffProfileResults.length === 0 && (
                                <p className="px-2 py-1.5 text-xs text-muted-foreground">Nessun profilo trovato</p>
                              )}
                              {staffProfileResults.map((profile: StaffProfileSearchResult) => {
                                const profileName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || profile.email || "Profilo";
                                return (
                                  <button
                                    key={profile.id}
                                    type="button"
                                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted"
                                    onClick={() => selectStaffProfile(idx, profile)}
                                  >
                                    {profile.avatar_url ? (
                                      <img src={profile.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover" />
                                    ) : (
                                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
                                        {profileName.slice(0, 1).toUpperCase()}
                                      </span>
                                    )}
                                    <span className="min-w-0">
                                      <span className="block truncate font-medium">{profileName}</span>
                                      {profile.email && <span className="block truncate text-muted-foreground">{profile.email}</span>}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                          <Label className="text-xs">Visibile</Label>
                          <Switch checked={member.is_public} onCheckedChange={(value) => updateStaffMember(idx, "is_public", value)} />
                        </div>
                      </div>

                      {member.profile_id && (
                        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => clearStaffProfile(idx)}>
                          Usa nominativo manuale
                        </Button>
                      )}

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Nome visualizzato</Label>
                          <Input className="h-8 text-sm" value={member.display_name} onChange={(e) => updateStaffMember(idx, "display_name", e.target.value)} placeholder="Nome staff" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Ruolo</Label>
                          <Select
                            value={isPresetRole ? member.role_label : CUSTOM_STAFF_ROLE_VALUE}
                            onValueChange={(value) => updateStaffMember(idx, "role_label", value === CUSTOM_STAFF_ROLE_VALUE ? "" : value)}
                          >
                            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {STAFF_ROLE_PRESETS.map((role) => <SelectItem key={role} value={role}>{role}</SelectItem>)}
                              <SelectItem value={CUSTOM_STAFF_ROLE_VALUE}>Ruolo personalizzato</SelectItem>
                            </SelectContent>
                          </Select>
                          {!isPresetRole && (
                            <Input className="h-8 text-sm" value={member.role_label} onChange={(e) => updateStaffMember(idx, "role_label", e.target.value)} placeholder="Ruolo personalizzato" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </section>

              {/* ═══ 11. LISTA ATTREZZATURA ═══ */}
              <Separator />
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><Package className="h-4 w-4 text-primary" /><h4 className="text-sm font-semibold">Lista attrezzatura</h4></div>
                  <div className="flex gap-1">
                    {equipmentTemplates.length > 0 && (
                      <Select onValueChange={v => {
                        const tmpl = equipmentTemplates.find(t => t.id === v);
                        if (!tmpl) return;
                        const items: EquipmentItem[] = ((tmpl as any).equipment_template_items || []).sort((a: any, b: any) => a.sort_order - b.sort_order).map((i: any) => ({ name: i.name, is_mandatory: i.is_mandatory, notes: i.notes || "" }));
                        updateEquipmentList([...getEquipmentList(editEvent), ...items]);
                      }}>
                        <SelectTrigger className="h-7 text-xs w-auto"><SelectValue placeholder="Da template..." /></SelectTrigger>
                        <SelectContent>{equipmentTemplates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                      </Select>
                    )}
                    <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => updateEquipmentList([...getEquipmentList(editEvent), { name: "", is_mandatory: false, notes: "" }])}>
                      <Plus className="h-3 w-3 mr-1" /> Aggiungi
                    </Button>
                  </div>
                </div>
                {getEquipmentList(editEvent).length === 0 && <p className="text-xs text-muted-foreground italic">Nessun oggetto in lista.</p>}
                {getEquipmentList(editEvent).map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 rounded-md border bg-card">
                    <Checkbox checked={item.is_mandatory} onCheckedChange={v => { const arr = [...getEquipmentList(editEvent)]; arr[idx] = { ...arr[idx], is_mandatory: !!v }; updateEquipmentList(arr); }} />
                    <Input className="h-8 text-sm flex-1" placeholder="Nome oggetto" value={item.name} onChange={e => { const arr = [...getEquipmentList(editEvent)]; arr[idx] = { ...arr[idx], name: e.target.value }; updateEquipmentList(arr); }} />
                    <Input className="h-8 text-sm w-32" placeholder="Note" value={item.notes} onChange={e => { const arr = [...getEquipmentList(editEvent)]; arr[idx] = { ...arr[idx], notes: e.target.value }; updateEquipmentList(arr); }} />
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => updateEquipmentList(getEquipmentList(editEvent).filter((_, i) => i !== idx))}><X className="h-3.5 w-3.5" /></Button>
                  </div>
                ))}
              </section>

              {/* ═══ 12. DISPONIBILITÀ AUTO ═══ */}
              <Separator />
              <section className="space-y-2">
                <div className="flex items-center gap-2"><Car className="h-4 w-4 text-primary" /><h4 className="text-sm font-semibold">Disponibilità auto</h4></div>
                <div className="flex items-center justify-between p-3 rounded-md border bg-card">
                  <div>
                    <p className="text-xs font-medium">Mostra campo disponibilità auto nella registrazione</p>
                    <p className="text-[10px] text-muted-foreground">Gli utenti potranno indicare: Sì, Preferirei di no, Non sono automunito</p>
                  </div>
                  <Switch checked={getAF(editEvent).ask_car_availability || false} onCheckedChange={v => updateAF({ ask_car_availability: v })} />
                </div>
              </section>

              {/* ═══ 13. RICHIESTE SPECIALI (Custom registration fields) ═══ */}
              <Separator />
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /><h4 className="text-sm font-semibold">Richieste speciali</h4></div>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => {
                    const fields = getCustomFields(editEvent);
                    updateAF({ fields: [...fields, { label: "", type: "text", required: false, options: [] }] });
                  }}>
                    <Plus className="h-3 w-3 mr-1" /> Aggiungi campo
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">Campi personalizzati mostrati nel modulo di registrazione.</p>
                {getCustomFields(editEvent).length === 0 && <p className="text-xs text-muted-foreground italic">Nessun campo personalizzato.</p>}
                {getCustomFields(editEvent).map((f, idx) => (
                  <div key={idx} className="space-y-3 p-3 rounded-md border bg-card">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_130px_auto_auto] sm:items-end">
                      <div className="space-y-1">
                        <Label className="text-xs">Etichetta</Label>
                        <Input className="h-8 text-sm" placeholder="Etichetta campo" value={f.label} onChange={e => updateCustomField(idx, { label: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Tipo</Label>
                        <Select value={f.type === "select" ? "select" : "text"} onValueChange={v => updateCustomField(idx, { type: v })}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="text">Testo</SelectItem>
                            <SelectItem value="select">Selezione</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <label className="flex h-8 items-center gap-2 text-xs">
                        <Checkbox checked={f.required} onCheckedChange={v => updateCustomField(idx, { required: !!v })} />
                        Obbligatorio
                      </label>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => {
                        updateAF({ fields: getCustomFields(editEvent).filter((_, i) => i !== idx) });
                      }}><X className="h-3.5 w-3.5" /></Button>
                    </div>
                    {f.type === "select" && (
                      <div className="space-y-2 rounded-md border bg-muted/30 p-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Opzioni selezione</Label>
                          <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => addCustomFieldOption(idx)}>
                            <Plus className="h-3 w-3 mr-1" /> Opzione
                          </Button>
                        </div>
                        {(f.options || []).length === 0 && <p className="text-[10px] text-muted-foreground">Aggiungi almeno una opzione.</p>}
                        {(f.options || []).map((option, optionIndex) => (
                          <div key={optionIndex} className="flex items-center gap-2">
                            <Input className="h-8 text-sm" value={option} onChange={(e) => updateCustomFieldOption(idx, optionIndex, e.target.value)} placeholder={`Opzione ${optionIndex + 1}`} />
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeCustomFieldOption(idx, optionIndex)}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </section>

            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEvent(null)}>Annulla</Button>
            <Button
              onClick={handleSaveEvent}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? "Salvataggio..." : "Salva"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    <Dialog open={!!engagementDetail} onOpenChange={(open) => { if (!open) setEngagementDetail(null); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{engagementDetailCopy?.title || "Dettaglio interesse"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {engagementDetail && (
            <div>
              <p className="text-sm font-medium text-foreground">{engagementDetail.event.title}</p>
              <p className="text-xs text-muted-foreground">
                {engagementAudience.length} {engagementAudience.length === 1 ? "utente" : "utenti"}
              </p>
            </div>
          )}

          {isEngagementAudienceLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-14 w-full" />
              ))}
            </div>
          ) : engagementAudience.length === 0 ? (
            <p className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              {engagementDetailCopy?.empty || "Nessun dettaglio disponibile."}
            </p>
          ) : (
            <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
              {engagementAudience.map((member) => {
                const contacts = [member.phone, member.email, member.instagram_handle ? `@${member.instagram_handle}` : null].filter(Boolean);
                return (
                  <div key={member.id} className="flex items-start justify-between gap-3 rounded-md border border-border p-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-foreground">{member.display_name}</p>
                        {engagementDetail?.type === "reminder" && (
                          <Badge variant="outline" className="text-[10px]">
                            {member.status === "notified_reminder" ? "Gia avvisato" : "Attivo"}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatEngagementAudienceDate(member.created_at)}
                      </p>
                      {contacts.length > 0 && (
                        <p className="mt-1 truncate text-xs text-muted-foreground">{contacts.join(" · ")}</p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 shrink-0 text-xs"
                      onClick={() => {
                        const userId = member.user_id;
                        setEngagementDetail(null);
                        navigate(`/users/${userId}`);
                      }}
                    >
                      Apri profilo
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
    <ImageCropDialog
      open={!!imageCropTarget}
      file={imageCropTarget?.file || null}
      title={imageCropTarget?.type === "coverHome" ? "Ritaglia anteprima home" : "Ritaglia copertina"}
      description={
        imageCropTarget?.type === "coverHome"
          ? "Scegli la porzione quadrata mostrata nelle card della home."
          : imageCropTarget?.type === "cover"
            ? "Scegli il ritaglio 1:1 usato nel dettaglio evento."
            : undefined
      }
      aspect={{ width: 1, height: 1 }}
      outputWidth={1200}
      outputHeight={1200}
      onCancel={() => {
        const target = imageCropTarget;
        setImageCropTarget(null);
        if (target?.type === "coverHome" && target.coverFile) {
          void uploadCoverImages(target.coverFile);
        }
      }}
      onCropped={(croppedFile) => {
        const target = imageCropTarget;
        setImageCropTarget(null);
        if (!target) return;
        if (target.type === "cover") {
          setImageCropTarget({ file: target.file, type: "coverHome", coverFile: croppedFile });
          return;
        }
        if (target.type === "coverHome" && target.coverFile) {
          void uploadCoverImages(target.coverFile, croppedFile);
          return;
        }
      }}
    />
    </>
  );
}
