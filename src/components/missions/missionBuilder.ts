export type MissionStatus = "active" | "inactive" | "draft" | "archived";
export type MissionVisibility = "visible" | "hidden" | "secret";
export type MissionType =
  | "one_time"
  | "repeatable"
  | "daily"
  | "weekly"
  | "monthly"
  | "seasonal"
  | "progressive"
  | "streak";
export type ConditionLogic = "all" | "any";
export type GoalMetric =
  | "count"
  | "unique_events"
  | "unique_categories"
  | "unique_organizers"
  | "events_in_period"
  | "points_accumulated"
  | "first_completion"
  | "streak";
export type GoalOperator = "at_least" | "exactly";
export type ResetPolicy = "none" | "full_reset" | "decrease_one" | "reset_streak_only" | "ignore_failure";
export type RewardKind = "points" | "badge" | "coupon" | "physical";
export type RequirementType = "completion" | "unlock";
export type TrackedAction =
  | "event_registration"
  | "event_attendance"
  | "event_completed_without_cancellation"
  | "consecutive_participations"
  | "category_participation"
  | "first_event_ever"
  | "first_event_in_category"
  | "membership_purchased"
  | "profile_completed"
  | "manual_admin_completion"
  | "coupon_used"
  | "checkin_meeting_point"
  | "custom_action";

export interface MissionConditionForm {
  id: string;
  title: string;
  target_action: TrackedAction;
  goal_metric: GoalMetric;
  goal_operator: GoalOperator;
  goal_value: number;
  unique_by: "action" | "event" | "category" | "organizer";
  allow_repeat_same_event: boolean;
  period_unit: "days" | "weeks" | "months" | "";
  period_value: number | null;
  event_filters: {
    category_ids: string[];
    secondary_category_names: string[];
    difficulty_min: string;
    organizer_ids: string[];
    event_tags: string[];
    event_type: string;
    price_type: "any" | "free" | "paid";
    price_min: number | null;
    price_max: number | null;
    location_query: string;
    starts_at: string;
    ends_at: string;
    campaign_tag: string;
    require_waitlist: boolean;
  };
  user_filters: {
    new_users_only: boolean;
    members_only: boolean;
    non_members_only: boolean;
    min_level: number | null;
    required_badge_ids: string[];
    required_mission_ids: string[];
    joined_after: string;
    joined_within_days_from_signup: number | null;
  };
  behavior_filters: {
    no_cancellation: boolean;
    no_late_cancellation: boolean;
    no_no_show: boolean;
    paid_successfully: boolean;
    checked_in: boolean;
    attended_within_days_from_signup: number | null;
  };
  failure_condition: {
    type: "" | "late_cancellation" | "no_show" | "refund_request" | "cancellation_after_confirmation" | "inactivity_days";
    inactivity_days: number | null;
  };
  reset_policy: ResetPolicy;
  push_notifications: boolean;
}

export interface MissionRewardForm {
  id: string;
  kind: RewardKind;
  title: string;
  points_value: number | null;
  badge_id: string;
  approval_required: boolean;
  visible_on_profile: boolean;
  badge_config: {
    create_inline: boolean;
    name: string;
    icon: string;
    rarity: string;
    color: string;
    tier: string;
  };
  coupon_config: {
    source_discount_code_id: string;
    auto_generate: boolean;
    code_prefix: string;
    discount_type: "percentage" | "fixed_amount";
    discount_value: number | null;
    validity_days: number | null;
    usage_limit: number | null;
    is_stackable: boolean;
  };
  physical_config: {
    reward_name: string;
    stock_quantity: number | null;
    claim_instructions: string;
    manual_validation_required: boolean;
  };
}

export interface MissionPrerequisiteForm {
  id: string;
  prerequisite_mission_id: string;
  requirement_type: RequirementType;
  auto_archive_previous: boolean;
}

export interface MissionBuilderForm {
  id?: string;
  icon: string;
  icon_color: string;
  icon_background: string;
  banner_url: string;
  title: string;
  internal_name: string;
  description: string;
  status: MissionStatus;
  visibility: MissionVisibility;
  type: MissionType;
  starts_at: string;
  ends_at: string;
  sort_order: number;
  priority: number;
  featured: boolean;
  repeatable: boolean;
  max_completions_per_user: number | null;
  mission_group: string;
  campaign_tag: string;
  campaign_id: string;
  campaign_description: string;
  campaign_icon: string;
  campaign_color: string;
  campaign_banner_url: string;
  campaign_reward_multiplier: number;
  campaign_is_active: boolean;
  timezone: string;
  conditions_logic: ConditionLogic;
  conditions: MissionConditionForm[];
  rewards: MissionRewardForm[];
  prerequisites: MissionPrerequisiteForm[];
  manual_completion_enabled: boolean;
  level: number | null;
  streak_requirement: number | null;
  streak_reset_rule: ResetPolicy;
}

export type MissionEnriched = {
  id: string;
  title: string;
  internal_name: string | null;
  description: string;
  icon: string;
  icon_color: string | null;
  icon_background: string | null;
  banner_url: string | null;
  status: MissionStatus;
  visibility: MissionVisibility;
  type: MissionType;
  timezone: string | null;
  starts_at: string | null;
  ends_at: string | null;
  sort_order: number;
  priority: number;
  updated_at: string;
  featured: boolean;
  repeatable: boolean;
  conditions_logic: ConditionLogic;
  campaign?: any;
  conditions: any[];
  rewards: any[];
  prerequisites: any[];
  analytics: {
    startedUsers: number;
    completedUsers: number;
    completionRate: number;
    lastCompletedAt: string | null;
  };
};

export const MISSION_STATUS_OPTIONS = [
  { value: "active", label: "Attiva" },
  { value: "inactive", label: "Inattiva" },
  { value: "draft", label: "Bozza" },
  { value: "archived", label: "Archiviata" },
];

export const MISSION_VISIBILITY_OPTIONS = [
  { value: "visible", label: "Visibile" },
  { value: "hidden", label: "Nascosta" },
  { value: "secret", label: "Segreta" },
];

export const MISSION_TYPE_OPTIONS = [
  { value: "one_time", label: "Una tantum" },
  { value: "repeatable", label: "Ripetibile" },
  { value: "daily", label: "Giornaliera" },
  { value: "weekly", label: "Settimanale" },
  { value: "monthly", label: "Mensile" },
  { value: "seasonal", label: "Stagionale / Campagna" },
  { value: "progressive", label: "Progressiva / Multi-livello" },
  { value: "streak", label: "Streak" },
];

export const TRACKED_ACTION_OPTIONS = [
  { value: "event_registration", label: "Registrazione evento" },
  { value: "event_attendance", label: "Partecipazione evento" },
  { value: "event_completed_without_cancellation", label: "Evento completato senza cancellazione" },
  { value: "consecutive_participations", label: "Partecipazioni consecutive" },
  { value: "category_participation", label: "Partecipazione categoria" },
  { value: "first_event_ever", label: "Primo evento in assoluto" },
  { value: "first_event_in_category", label: "Primo evento in categoria" },
  { value: "membership_purchased", label: "Tessera acquistata" },
  { value: "profile_completed", label: "Profilo completato" },
  { value: "manual_admin_completion", label: "Completamento manuale admin" },
  { value: "coupon_used", label: "Coupon utilizzato" },
  { value: "checkin_meeting_point", label: "Check-in punto di ritrovo" },
  { value: "custom_action", label: "Azione custom organizzatore" },
];

export const GOAL_METRIC_OPTIONS = [
  { value: "count", label: "Conteggio azioni" },
  { value: "unique_events", label: "Eventi unici" },
  { value: "unique_categories", label: "Categorie uniche" },
  { value: "unique_organizers", label: "Organizzatori unici" },
  { value: "events_in_period", label: "Eventi nello stesso periodo" },
  { value: "points_accumulated", label: "Punti accumulati dalle azioni" },
  { value: "first_completion", label: "Prima occorrenza valida" },
  { value: "streak", label: "Streak consecutiva" },
];

export const GOAL_OPERATOR_OPTIONS = [
  { value: "at_least", label: "Almeno" },
  { value: "exactly", label: "Esattamente" },
];

export const CONDITIONS_LOGIC_OPTIONS = [
  { value: "all", label: "Tutte le condizioni (AND)" },
  { value: "any", label: "Almeno una condizione (OR)" },
];

export const RESET_POLICY_OPTIONS = [
  { value: "none", label: "Nessun reset" },
  { value: "full_reset", label: "Reset totale del progresso" },
  { value: "decrease_one", label: "Diminuisci di 1" },
  { value: "reset_streak_only", label: "Resetta solo la streak" },
  { value: "ignore_failure", label: "Ignora il fallimento" },
];

export const REWARD_KIND_OPTIONS = [
  { value: "points", label: "Solo punti" },
  { value: "badge", label: "Badge" },
  { value: "coupon", label: "Coupon" },
  { value: "physical", label: "Ricompensa fisica" },
];

export const TOOLTIP_TEXT: Record<string, string> = {
  icon: "Scegli un’icona per rappresentare visivamente la missione.\nServe solo a livello grafico e aiuta l’utente a riconoscere rapidamente il tipo di attività.\nNon influisce sulla logica della missione.",
  title: "Nome della missione visibile agli utenti.\nDeve essere breve, chiaro e motivante.",
  internal_name: "Nome visibile solo agli amministratori.\nUtile per distinguere missioni simili nel pannello admin.",
  description: "Spiega cosa deve fare l’utente per completare la missione.\nÈ il testo guida principale.",
  status: "Definisce se la missione è disponibile:\n• Attiva → visibile\n• Inattiva → nascosta\n• Bozza → non pubblicata",
  visibility: "Controlla come la missione appare:\n• Visibile\n• Nascosta\n• Segreta",
  type: "Definisce il comportamento:\n• Una tantum\n• Ripetibile\n• Giornaliera\n• Settimanale\n• Mensile\n• Stagionale\n• Progressiva\n• Streak",
  starts_at: "Data da cui la missione è attiva.",
  ends_at: "Data oltre la quale la missione non è più completabile.",
  featured: "Aumenta la visibilità della missione nell’app.",
  repeatable: "Permette più completamenti.",
  max_completions: "Limita quante volte un utente può completarla.",
  campaign: "Raggruppa missioni per eventi o stagioni.",
  icon_color: "Colore opzionale dell'icona missione.",
  icon_background: "Sfondo opzionale dell'icona missione.",
  banner_url: "Banner opzionale per missioni speciali o campagne.",
  campaign_description: "Descrizione della campagna o stagione associata.",
  campaign_icon: "Icona dedicata alla campagna, separata dall'icona della missione.",
  campaign_color: "Colore tema della campagna per card e badge.",
  campaign_banner_url: "Banner visuale della campagna o collezione speciale.",
  campaign_reward_multiplier: "Moltiplicatore opzionale delle ricompense per campagne speciali.",
  campaign_is_active: "Permette di attivare o sospendere una campagna senza rimuoverla.",
  target_action: "Definisce cosa viene tracciato (es. partecipazione evento).",
  event_filters: "Permette di limitare gli eventi validi (categoria, difficoltà, ecc.).",
  secondary_category_filter: "Usa questo filtro per creare missioni su tipologie specifiche di evento, ad esempio trekking notturni, cammini o degustazioni.",
  user_filters: "Limita a quali utenti si applica la missione.",
  behavior_filters: "Permette di escludere comportamenti (no-show, cancellazioni).",
  goal: "Numero di azioni richieste.",
  counting_type: "Definisce come vengono contate le azioni.",
  conditions_logic: "Permette AND / OR tra condizioni.",
  reset_on_failure: "Definisce cosa succede se l’utente sbaglia.",
  failure_condition: "Definisce cosa è considerato errore.",
  push_notifications: "Invia notifiche per progresso e completamento.",
  reward_points: "Numero di punti assegnati.",
  reward_type: "Tipo di premio (punti, badge, coupon, fisico).",
  badge: "Premio visivo nel profilo utente.",
  coupon: "Codice sconto assegnato.",
  physical: "Premio reale.",
  combined_rewards: "Permette più premi insieme.",
  manual_approval: "Richiede validazione admin.",
  prerequisite: "Richiede una missione precedente.",
  level: "Indica livello missione.",
  streak_requirement: "Numero azioni consecutive richieste.",
  streak_reset: "Quando la streak si interrompe.",
};

const uuid = () => crypto.randomUUID();

export const createEmptyCondition = (): MissionConditionForm => ({
  id: uuid(),
  title: "",
  target_action: "event_attendance",
  goal_metric: "count",
  goal_operator: "at_least",
  goal_value: 1,
  unique_by: "event",
  allow_repeat_same_event: false,
  period_unit: "",
  period_value: null,
  event_filters: {
    category_ids: [],
    secondary_category_names: [],
    difficulty_min: "",
    organizer_ids: [],
    event_tags: [],
    event_type: "",
    price_type: "any",
    price_min: null,
    price_max: null,
    location_query: "",
    starts_at: "",
    ends_at: "",
    campaign_tag: "",
    require_waitlist: false,
  },
  user_filters: {
    new_users_only: false,
    members_only: false,
    non_members_only: false,
    min_level: null,
    required_badge_ids: [],
    required_mission_ids: [],
    joined_after: "",
    joined_within_days_from_signup: null,
  },
  behavior_filters: {
    no_cancellation: false,
    no_late_cancellation: false,
    no_no_show: false,
    paid_successfully: false,
    checked_in: true,
    attended_within_days_from_signup: null,
  },
  failure_condition: {
    type: "",
    inactivity_days: null,
  },
  reset_policy: "none",
  push_notifications: false,
});

export const createEmptyReward = (): MissionRewardForm => ({
  id: uuid(),
  kind: "points",
  title: "",
  points_value: 10,
  badge_id: "",
  approval_required: false,
  visible_on_profile: true,
  badge_config: {
    create_inline: false,
    name: "",
    icon: "lucide:Award",
    rarity: "common",
    color: "#22c55e",
    tier: "standard",
  },
  coupon_config: {
    source_discount_code_id: "",
    auto_generate: false,
    code_prefix: "",
    discount_type: "percentage",
    discount_value: null,
    validity_days: null,
    usage_limit: null,
    is_stackable: false,
  },
  physical_config: {
    reward_name: "",
    stock_quantity: null,
    claim_instructions: "",
    manual_validation_required: true,
  },
});

export const createEmptyPrerequisite = (): MissionPrerequisiteForm => ({
  id: uuid(),
  prerequisite_mission_id: "",
  requirement_type: "completion",
  auto_archive_previous: false,
});

export const emptyMissionForm: MissionBuilderForm = {
  icon: "lucide:Target",
  icon_color: "",
  icon_background: "",
  banner_url: "",
  title: "",
  internal_name: "",
  description: "",
  status: "draft",
  visibility: "visible",
  type: "one_time",
  starts_at: "",
  ends_at: "",
  sort_order: 0,
  priority: 0,
  featured: false,
  repeatable: false,
  max_completions_per_user: null,
  mission_group: "",
  campaign_tag: "",
  campaign_id: "",
  campaign_description: "",
  campaign_icon: "lucide:Sparkles",
  campaign_color: "",
  campaign_banner_url: "",
  campaign_reward_multiplier: 1,
  campaign_is_active: true,
  timezone: "Europe/Rome",
  conditions_logic: "all",
  conditions: [createEmptyCondition()],
  rewards: [createEmptyReward()],
  prerequisites: [],
  manual_completion_enabled: false,
  level: null,
  streak_requirement: null,
  streak_reset_rule: "reset_streak_only",
};

export function rewardSummary(rewards: any[]) {
  const cleaned = (rewards || []).filter(Boolean);
  if (cleaned.length === 0) return "Nessuna ricompensa";
  return cleaned
    .map((reward) => {
      if (reward.reward_kind === "points" || reward.kind === "points") return `${reward.points_value ?? 0} pt`;
      if (reward.reward_kind === "badge" || reward.kind === "badge") return "Badge";
      if (reward.reward_kind === "coupon" || reward.kind === "coupon") return "Coupon";
      if (reward.reward_kind === "physical" || reward.kind === "physical") return "Ricompensa fisica";
      return "Reward";
    })
    .join(" + ");
}

export function actionLabel(action: string) {
  return TRACKED_ACTION_OPTIONS.find((option) => option.value === action)?.label || action;
}

export function typeLabel(type: string) {
  return MISSION_TYPE_OPTIONS.find((option) => option.value === type)?.label || type;
}

export function deserializeMissionForm(
  mission: any,
  relations?: {
    conditions?: any[];
    rewards?: any[];
    prerequisites?: any[];
  },
): MissionBuilderForm {
  const conditions = relations?.conditions?.length
    ? relations.conditions.map((condition: any) => ({
        ...createEmptyCondition(),
        ...condition,
        id: condition.id,
        event_filters: { ...createEmptyCondition().event_filters, ...(condition.event_filters || {}) },
        user_filters: { ...createEmptyCondition().user_filters, ...(condition.user_filters || {}) },
        behavior_filters: { ...createEmptyCondition().behavior_filters, ...(condition.behavior_filters || {}) },
        failure_condition: { ...createEmptyCondition().failure_condition, ...(condition.failure_condition || {}) },
      }))
    : [
        {
          ...createEmptyCondition(),
          target_action: mission.target_action === "event_attended" ? "event_attendance" : mission.target_action || "event_attendance",
          goal_metric: mission.type === "streak" ? "streak" : "count",
          goal_value: mission.target_value || 1,
          event_filters: {
            ...createEmptyCondition().event_filters,
            category_ids: [],
            campaign_tag: mission.campaign_tag || "",
          },
          behavior_filters: {
            ...createEmptyCondition().behavior_filters,
            no_cancellation: !!mission.reset_on_failure,
            no_late_cancellation: !!mission.reset_on_failure,
          },
          reset_policy: mission.reset_on_failure ? "full_reset" : "none",
        },
      ];

  const rewards = relations?.rewards?.length
    ? relations.rewards.map((reward: any) => ({
        ...createEmptyReward(),
        ...reward,
        id: reward.id,
        kind: reward.reward_kind,
        badge_id: reward.badge_id || "",
        badge_config: { ...createEmptyReward().badge_config, ...(reward.badge_config || {}) },
        coupon_config: { ...createEmptyReward().coupon_config, ...(reward.coupon_config || {}) },
        physical_config: { ...createEmptyReward().physical_config, ...(reward.physical_config || {}) },
      }))
    : [
        {
          ...createEmptyReward(),
          kind: mission.reward_type || "points",
          points_value: mission.reward_points ?? 0,
          badge_id: mission.reward_badge_id || "",
          coupon_config: {
            ...createEmptyReward().coupon_config,
            auto_generate: !!mission.auto_generate_coupon,
            code_prefix: mission.reward_value || "",
          },
          physical_config: {
            ...createEmptyReward().physical_config,
            reward_name: mission.reward_value || "",
          },
        },
      ];

  return {
    id: mission.id,
    icon: mission.icon || "lucide:Target",
    icon_color: mission.icon_color || "",
    icon_background: mission.icon_background || "",
    banner_url: mission.banner_url || "",
    title: mission.title || "",
    internal_name: mission.internal_name || "",
    description: mission.description || "",
    status: mission.status || (mission.is_active ? "active" : "inactive"),
    visibility: mission.visibility || "visible",
    type: mission.type || "one_time",
    starts_at: mission.starts_at ? new Date(mission.starts_at).toISOString().slice(0, 16) : "",
    ends_at: (mission.ends_at || mission.expires_at) ? new Date(mission.ends_at || mission.expires_at).toISOString().slice(0, 16) : "",
    sort_order: mission.sort_order ?? 0,
    priority: mission.priority ?? 0,
    featured: !!mission.featured,
    repeatable: !!mission.repeatable,
    max_completions_per_user: mission.max_completions_per_user ?? null,
    mission_group: mission.mission_group || "",
    campaign_tag: mission.campaign_tag || "",
    campaign_id: mission.campaign_id || "",
    campaign_description: mission.campaign?.description || "",
    campaign_icon: mission.campaign?.icon || mission.icon || "lucide:Sparkles",
    campaign_color: mission.campaign?.color || "",
    campaign_banner_url: mission.campaign?.banner_url || "",
    campaign_reward_multiplier: Number(mission.campaign?.reward_multiplier ?? 1),
    campaign_is_active: mission.campaign?.is_active ?? true,
    timezone: mission.timezone || "Europe/Rome",
    conditions_logic: mission.conditions_logic || "all",
    conditions,
    rewards,
    prerequisites: (relations?.prerequisites || []).map((item: any) => ({
      ...createEmptyPrerequisite(),
      id: item.id,
      prerequisite_mission_id: item.prerequisite_mission_id,
      requirement_type: item.requirement_type || "completion",
      auto_archive_previous: !!item.auto_archive_previous,
    })),
    manual_completion_enabled: conditions.some((condition) => condition.target_action === "manual_admin_completion"),
    level: mission.level ?? null,
    streak_requirement: mission.type === "streak" ? mission.streak_count ?? mission.target_value ?? null : null,
    streak_reset_rule: conditions[0]?.reset_policy || "reset_streak_only",
  };
}

export function cloneMissionForm(form: MissionBuilderForm): MissionBuilderForm {
  return {
    ...form,
    id: undefined,
    title: `${form.title} (copia)`,
    internal_name: form.internal_name ? `${form.internal_name}_copy` : "",
    status: "draft",
    conditions: form.conditions.map((condition) => ({ ...condition, id: uuid() })),
    rewards: form.rewards.map((reward) => ({ ...reward, id: uuid() })),
    prerequisites: form.prerequisites.map((prerequisite) => ({ ...prerequisite, id: uuid() })),
  };
}

export function normalizeCategoryIds(
  condition: MissionConditionForm,
  categoryLookup: Record<string, string>,
): MissionConditionForm {
  if (condition.event_filters.category_ids.length > 0) return condition;

  const legacyNames = Array.isArray((condition.event_filters as any).category_names)
    ? ((condition.event_filters as any).category_names as string[])
    : [];

  if (legacyNames.length === 0) return condition;

  const normalizedIds = Object.entries(categoryLookup)
    .filter(([, name]) => legacyNames.includes(name))
    .map(([id]) => id);

  return {
    ...condition,
    event_filters: {
      ...condition.event_filters,
      category_ids: normalizedIds,
    },
  };
}
