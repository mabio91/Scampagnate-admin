import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import RefreshButton from "@/components/RefreshButton";
import MissionFormDialog from "@/components/missions/MissionFormDialog";
import MissionStatsCards from "@/components/missions/MissionStatsCards";
import MissionsTable from "@/components/missions/MissionsTable";
import {
  cloneMissionForm,
  createEmptyCondition,
  createEmptyReward,
  deserializeMissionForm,
  emptyMissionForm,
  normalizeCategoryIds,
  type MissionBuilderForm,
  type MissionEnriched,
} from "@/components/missions/missionBuilder";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const PERIODIC_MISSION_TYPES = new Set(["monthly", "weekly"]);

const getZonedDateParts = (date: Date, timezone: string) => {
  const readParts = (timeZone: string) => {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = formatter.formatToParts(date);
    const getPart = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);

    return {
      year: getPart("year"),
      month: getPart("month"),
      day: getPart("day"),
    };
  };

  try {
    return readParts(timezone);
  } catch {
    return readParts("Europe/Rome");
  }
};

const getMissionCycleKey = (missionType: string, timezone?: string | null, date = new Date()) => {
  const normalizedType = missionType.toLowerCase();
  const safeTimezone = timezone?.trim() || "Europe/Rome";
  const parts = getZonedDateParts(date, safeTimezone);

  if (normalizedType === "monthly") {
    return `${parts.year}-${String(parts.month).padStart(2, "0")}`;
  }

  if (normalizedType === "weekly") {
    const utcDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
    const dayOfWeek = utcDate.getUTCDay() || 7;
    utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayOfWeek);
    const isoYear = utcDate.getUTCFullYear();
    const yearStart = new Date(Date.UTC(isoYear, 0, 1));
    const isoWeek = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);

    return `${isoYear}-W${String(isoWeek).padStart(2, "0")}`;
  }

  return "lifetime";
};

export default function MissionsPage() {
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState<MissionBuilderForm>(emptyMissionForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: missionBundle, isLoading } = useQuery({
    queryKey: ["missions-v2"],
    queryFn: async () => {
      const [missionsRes, conditionsRes, rewardsRes, prerequisitesRes, campaignsRes, progressRes] = await Promise.all([
        supabase.from("missions").select("*").order("sort_order", { ascending: true }).order("updated_at", { ascending: false }),
        supabase.from("mission_conditions" as any).select("*").order("sort_order", { ascending: true }),
        supabase.from("mission_rewards" as any).select("*").order("sort_order", { ascending: true }),
        supabase.from("mission_prerequisites" as any).select("*").order("sort_order", { ascending: true }),
        supabase.from("mission_campaigns" as any).select("*").order("starts_at", { ascending: false }),
        supabase.from("user_mission_progress" as any).select("mission_id, user_id, cycle_key, is_completed, completed_at"),
      ]);

      if (missionsRes.error) throw missionsRes.error;
      if (conditionsRes.error) throw conditionsRes.error;
      if (rewardsRes.error) throw rewardsRes.error;
      if (prerequisitesRes.error) throw prerequisitesRes.error;
      if (campaignsRes.error) throw campaignsRes.error;
      if (progressRes.error) throw progressRes.error;

      const conditions = (conditionsRes.data || []) as any[];
      const rewards = (rewardsRes.data || []) as any[];
      const prerequisites = (prerequisitesRes.data || []) as any[];
      const progressRows = (progressRes.data || []) as any[];
      const campaignRows = (campaignsRes.data || []) as any[];

      const conditionsByMission = new Map<string, any[]>();
      const rewardsByMission = new Map<string, any[]>();
      const prerequisitesByMission = new Map<string, any[]>();
      const progressByMission = new Map<string, any[]>();

      for (const condition of conditions) {
        const list = conditionsByMission.get(condition.mission_id) || [];
        list.push(condition);
        conditionsByMission.set(condition.mission_id, list);
      }
      for (const reward of rewards) {
        const list = rewardsByMission.get(reward.mission_id) || [];
        list.push(reward);
        rewardsByMission.set(reward.mission_id, list);
      }
      for (const prerequisite of prerequisites) {
        const list = prerequisitesByMission.get(prerequisite.mission_id) || [];
        list.push(prerequisite);
        prerequisitesByMission.set(prerequisite.mission_id, list);
      }
      for (const progress of progressRows) {
        const list = progressByMission.get(progress.mission_id) || [];
        list.push(progress);
        progressByMission.set(progress.mission_id, list);
      }

      const missions: MissionEnriched[] = (missionsRes.data || []).map((mission: any) => {
        const campaign = campaignRows.find((item) => item.id === mission.campaign_id) || null;
        const allProgressRows = progressByMission.get(mission.id) || [];
        const progressRows = PERIODIC_MISSION_TYPES.has(String(mission.type || "").toLowerCase())
          ? allProgressRows.filter((row: any) => row.cycle_key === getMissionCycleKey(mission.type, mission.timezone))
          : allProgressRows;
        const startedUsers = new Set(progressRows.map((row: any) => row.user_id)).size;
        const completedRows = progressRows.filter((row: any) => row.is_completed);
        const completedUsers = new Set(completedRows.map((row: any) => row.user_id)).size;
        const lastCompletedAt = completedRows
          .map((row: any) => row.completed_at)
          .filter(Boolean)
          .sort()
          .at(-1) || null;

        return {
          ...mission,
          campaign,
          conditions: conditionsByMission.get(mission.id) || [],
          rewards: rewardsByMission.get(mission.id) || [],
          prerequisites: prerequisitesByMission.get(mission.id) || [],
          analytics: {
            startedUsers,
            completedUsers,
            completionRate: startedUsers > 0 ? Math.round((completedUsers / startedUsers) * 100) : 0,
            lastCompletedAt,
          },
        };
      });

      return {
        missions,
        campaigns: campaignRows,
      };
    },
  });

  const missions = missionBundle?.missions || [];
  const campaigns = missionBundle?.campaigns || [];

  const { data: categories = [] } = useQuery({
    queryKey: ["event_categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("event_categories").select("id, name").order("sort_order");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: secondaryCategories = [] } = useQuery({
    queryKey: ["event-secondary-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("additional_fields");
      if (error) throw error;

      const names = new Set<string>();
      (data || []).forEach((event: { additional_fields: unknown }) => {
        const additionalFields = (event.additional_fields || {}) as {
          fit_score_main_category?: unknown;
          fit_score_secondary_categories?: unknown;
        };
        const main = additionalFields.fit_score_main_category;
        if (typeof main === "string" && main.trim()) names.add(main.trim());

        const secondary = additionalFields.fit_score_secondary_categories;
        if (Array.isArray(secondary)) {
          secondary.forEach((name) => {
            if (typeof name === "string" && name.trim()) names.add(name.trim());
          });
        }
      });

      return [...names].sort((a, b) => a.localeCompare(b, "it"));
    },
  });

  const { data: badges = [] } = useQuery({
    queryKey: ["badges-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("badges").select("id, name, icon").order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: coupons = [] } = useQuery({
    queryKey: ["discount-codes-for-missions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("discount_codes").select("id, code, discount_type, discount_value").order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: organizers = [] } = useQuery({
    queryKey: ["organizers-for-missions"],
    queryFn: async () => {
      const { data: roles, error: rolesError } = await supabase.from("user_roles").select("user_id, role").in("role", ["organizer", "admin"]);
      if (rolesError) throw rolesError;
      const ids = [...new Set((roles || []).map((role) => role.user_id))];
      if (ids.length === 0) return [];
      const { data: profiles, error: profilesError } = await supabase.from("profiles").select("id, first_name, last_name").in("id", ids);
      if (profilesError) throw profilesError;
      return (profiles || []).map((profile) => ({ id: profile.id, name: `${profile.first_name} ${profile.last_name}`.trim() }));
    },
  });

  const missionLookup = useMemo(
    () => Object.fromEntries(categories.map((category: any) => [category.id, category.name])),
    [categories],
  );

  const reorderMutation = useMutation({
    mutationFn: async (nextMissions: MissionEnriched[]) => {
      await Promise.all(
        nextMissions.map((mission, index) =>
          supabase
            .from("missions")
            .update({ sort_order: index })
            .eq("id", mission.id),
        ),
      );
    },
    onMutate: async (nextMissions) => {
      await queryClient.cancelQueries({ queryKey: ["missions-v2"] });
      const previous = queryClient.getQueryData(["missions-v2"]);

      queryClient.setQueryData(["missions-v2"], (current: any) => ({
        ...current,
        missions: nextMissions.map((mission, index) => ({
          ...mission,
          sort_order: index,
        })),
      }));

      return { previous };
    },
    onError: (error: any, _nextMissions, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["missions-v2"], context.previous);
      }
      toast.error(error.message || "Errore nel riordino delle missioni");
    },
    onSuccess: () => {
      toast.success("Ordine missioni aggiornato");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["missions-v2"] });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ mission, mode }: { mission: MissionBuilderForm; mode: "draft" | "publish" }) => {
      let campaignId = mission.campaign_id || null;

      if (!campaignId && mission.campaign_tag.trim()) {
        const slug = slugify(mission.campaign_tag);
        const existingCampaign = campaigns.find((campaign: any) => campaign.slug === slug);
        if (existingCampaign) {
          campaignId = existingCampaign.id;
        } else {
          const { data: insertedCampaign, error: campaignError } = await supabase
            .from("mission_campaigns" as any)
            .insert({
              name: mission.campaign_tag.trim(),
              slug,
              description: mission.campaign_description.trim() || "",
              icon: mission.campaign_icon || mission.icon,
              banner_url: mission.campaign_banner_url.trim() || null,
              color: mission.campaign_color.trim() || null,
              starts_at: mission.starts_at ? new Date(mission.starts_at).toISOString() : null,
              ends_at: mission.ends_at ? new Date(mission.ends_at).toISOString() : null,
              reward_multiplier: mission.campaign_reward_multiplier || 1,
              is_active: mission.campaign_is_active,
            })
            .select("*")
            .single();
          if (campaignError) throw campaignError;
          campaignId = (insertedCampaign as any).id;
        }
      }

      if (campaignId) {
        const slug = slugify(mission.campaign_tag || mission.title);
        const { error: campaignUpdateError } = await supabase
          .from("mission_campaigns" as any)
          .update({
            name: mission.campaign_tag.trim() || mission.title.trim(),
            slug,
            description: mission.campaign_description.trim() || "",
            icon: mission.campaign_icon || mission.icon,
            banner_url: mission.campaign_banner_url.trim() || null,
            color: mission.campaign_color.trim() || null,
            starts_at: mission.starts_at ? new Date(mission.starts_at).toISOString() : null,
            ends_at: mission.ends_at ? new Date(mission.ends_at).toISOString() : null,
            reward_multiplier: mission.campaign_reward_multiplier || 1,
            is_active: mission.campaign_is_active,
            updated_at: new Date().toISOString(),
          })
          .eq("id", campaignId);
        if (campaignUpdateError) throw campaignUpdateError;
      }

      const preparedRewards = [];
      for (const reward of mission.rewards) {
        let badgeId = reward.badge_id || null;

        if (reward.kind === "badge" && reward.badge_config.create_inline && !badgeId && reward.badge_config.name.trim()) {
          const { data: createdBadge, error: badgeError } = await supabase
            .from("badges")
            .insert({
              name: reward.badge_config.name.trim(),
              description: `Badge creato dalla missione ${mission.title}`,
              icon: reward.badge_config.icon,
              category: reward.badge_config.rarity || "mission",
              requirement_type: "mission_reward",
              requirement_value: 1,
            })
            .select("id")
            .single();
          if (badgeError) throw badgeError;
          badgeId = (createdBadge as any).id;
        }

        preparedRewards.push({ ...reward, badge_id: badgeId });
      }

      const primaryCondition = mission.conditions[0] || createEmptyCondition();
      const pointsRewardTotal = preparedRewards
        .filter((reward) => reward.kind === "points")
        .reduce((sum, reward) => sum + (reward.points_value || 0), 0);
      const primaryExtraReward = preparedRewards.find((reward) => reward.kind !== "points");
      const primaryCategoryNames = (primaryCondition.event_filters.category_ids || [])
        .map((id) => missionLookup[id])
        .filter(Boolean);

      const payload: any = {
        title: mission.title.trim(),
        internal_name: mission.internal_name.trim() || null,
        description: mission.description.trim(),
        icon: mission.icon,
        icon_color: mission.icon_color.trim() || null,
        icon_background: mission.icon_background.trim() || null,
        banner_url: mission.banner_url.trim() || null,
        type: mission.type,
        status: mode === "draft" ? "draft" : mission.status,
        visibility: mission.visibility,
        sort_order: mission.sort_order,
        priority: mission.priority,
        featured: mission.featured,
        repeatable: mission.repeatable,
        max_completions_per_user: mission.max_completions_per_user,
        mission_group: mission.mission_group.trim() || null,
        campaign_tag: mission.campaign_tag.trim() || null,
        campaign_id: campaignId,
        timezone: mission.timezone.trim() || "Europe/Rome",
        conditions_logic: mission.conditions_logic,
        is_archived: mission.status === "archived",
        level: mission.level,
        starts_at: mission.starts_at ? new Date(mission.starts_at).toISOString() : null,
        ends_at: mission.ends_at ? new Date(mission.ends_at).toISOString() : null,
        expires_at: mission.ends_at ? new Date(mission.ends_at).toISOString() : null,
        is_active: (mode === "draft" ? "draft" : mission.status) === "active",
        target_action: primaryCondition.target_action === "event_attendance" ? "event_attended" : primaryCondition.target_action,
        target_value: primaryCondition.goal_value,
        streak_count: mission.streak_requirement,
        reset_on_failure: mission.conditions.some((condition) => condition.reset_policy !== "none"),
        reward_points: pointsRewardTotal,
        reward_type: primaryExtraReward?.kind || "points",
        reward_value:
          primaryExtraReward?.kind === "coupon"
            ? primaryExtraReward.coupon_config.code_prefix || null
            : primaryExtraReward?.kind === "physical"
              ? primaryExtraReward.physical_config.reward_name || null
              : null,
        reward_badge_id: primaryExtraReward?.kind === "badge" ? primaryExtraReward.badge_id || null : null,
        notify_on_progress: mission.conditions.some((condition) => condition.push_notifications),
        auto_generate_coupon: preparedRewards.some((reward) => reward.kind === "coupon" && reward.coupon_config.auto_generate),
        category: primaryCategoryNames[0] || null,
        category_filter: primaryCategoryNames.length ? primaryCategoryNames : null,
        prerequisite_summary: mission.prerequisites
          .filter((item) => item.prerequisite_mission_id)
          .map((item) => ({
            prerequisite_mission_id: item.prerequisite_mission_id,
            requirement_type: item.requirement_type,
            auto_archive_previous: item.auto_archive_previous,
          })),
        legacy_config: {
          builder_version: 2,
          manual_completion_enabled: mission.manual_completion_enabled,
          streak_reset_rule: mission.streak_reset_rule,
        },
        updated_at: new Date().toISOString(),
      };

      let missionId = mission.id;
      if (mission.id) {
        const { error } = await supabase.from("missions").update(payload).eq("id", mission.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("missions").insert(payload).select("id").single();
        if (error) throw error;
        missionId = data.id;
      }

      if (!missionId) throw new Error("Mission ID missing after save");

      const { data: existingRewardRows, error: existingRewardsError } = await supabase
        .from("mission_rewards" as any)
        .select("id")
        .eq("mission_id", missionId);
      if (existingRewardsError) throw existingRewardsError;

      await Promise.all([
        supabase.from("mission_conditions" as any).delete().eq("mission_id", missionId),
        supabase.from("mission_prerequisites" as any).delete().eq("mission_id", missionId),
      ]);

      const conditionsPayload = mission.conditions.map((condition, index) => ({
        mission_id: missionId,
        sort_order: index,
        title: condition.title || `Condizione ${index + 1}`,
        target_action: condition.target_action,
        goal_metric: condition.goal_metric,
        goal_operator: condition.goal_operator,
        goal_value: condition.goal_value,
        unique_by: condition.unique_by,
        allow_repeat_same_event: condition.allow_repeat_same_event,
        period_unit: condition.period_unit || null,
        period_value: condition.period_value,
        event_filters: condition.event_filters,
        user_filters: condition.user_filters,
        behavior_filters: condition.behavior_filters,
        failure_condition: condition.failure_condition,
        reset_policy: condition.reset_policy,
        push_notifications: condition.push_notifications,
        metadata: {
          manual_completion_enabled: mission.manual_completion_enabled,
          streak_requirement: mission.streak_requirement,
          streak_reset_rule: mission.streak_reset_rule,
        },
      }));

      const rewardsPayload = preparedRewards.map((reward, index) => ({
        id: reward.id,
        mission_id: missionId,
        sort_order: index,
        reward_kind: reward.kind,
        title: reward.title || `${reward.kind} reward`,
        points_value: reward.kind === "points" ? reward.points_value : null,
        badge_id: reward.kind === "badge" ? reward.badge_id || null : null,
        source_discount_code_id: reward.kind === "coupon" ? reward.coupon_config.source_discount_code_id || null : null,
        approval_required: reward.approval_required,
        visible_on_profile: reward.visible_on_profile,
        badge_config: reward.badge_config,
        coupon_config: reward.coupon_config,
        physical_config: reward.physical_config,
      }));

      const prerequisitesPayload = mission.prerequisites
        .filter((item) => item.prerequisite_mission_id)
        .map((item, index) => ({
          mission_id: missionId,
          prerequisite_mission_id: item.prerequisite_mission_id,
          requirement_type: item.requirement_type,
          sort_order: index,
          auto_archive_previous: item.auto_archive_previous,
        }));

      if (conditionsPayload.length) {
        const { error } = await supabase.from("mission_conditions" as any).insert(conditionsPayload);
        if (error) throw error;
      }
      if (rewardsPayload.length) {
        const { error } = await supabase
          .from("mission_rewards" as any)
          .upsert(rewardsPayload, { onConflict: "id" });
        if (error) throw error;
      }
      const keptRewardIds = new Set(rewardsPayload.map((reward) => reward.id));
      const removedRewardIds = (existingRewardRows || [])
        .map((reward: any) => reward.id)
        .filter((id: string) => !keptRewardIds.has(id));
      if (removedRewardIds.length) {
        const { error } = await supabase
          .from("mission_rewards" as any)
          .delete()
          .in("id", removedRewardIds);
        if (error) throw error;
      }
      if (prerequisitesPayload.length) {
        const { error } = await supabase.from("mission_prerequisites" as any).insert(prerequisitesPayload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["missions-v2"] });
      toast.success("Missione salvata");
      setDialog(false);
      setForm(emptyMissionForm);
    },
    onError: (error: any) => toast.error(error.message || "Errore nel salvataggio della missione"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("missions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["missions-v2"] });
      toast.success("Missione eliminata");
      setDeleteId(null);
    },
    onError: (error: any) => toast.error(error.message || "Errore nell'eliminazione"),
  });

  const archiveMutation = useMutation({
    mutationFn: async (mission: MissionEnriched) => {
      const nextStatus = mission.status === "archived" ? "inactive" : "archived";
      const { error } = await supabase
        .from("missions")
        .update({
          status: nextStatus,
          is_archived: nextStatus === "archived",
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", mission.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["missions-v2"] });
      toast.success("Stato missione aggiornato");
    },
    onError: (error: any) => toast.error(error.message || "Errore nell'aggiornamento stato"),
  });

  const handleEdit = (mission: MissionEnriched) => {
    const deserialized = deserializeMissionForm(mission, {
      conditions: mission.conditions,
      rewards: mission.rewards,
      prerequisites: mission.prerequisites,
    });
    setForm({
      ...deserialized,
      conditions: deserialized.conditions.map((condition) => normalizeCategoryIds(condition, missionLookup)),
    });
    setDialog(true);
  };

  const handleDuplicate = (mission: MissionEnriched) => {
    const deserialized = deserializeMissionForm(mission, {
      conditions: mission.conditions,
      rewards: mission.rewards,
      prerequisites: mission.prerequisites,
    });
    const nextForm = cloneMissionForm({
      ...deserialized,
      conditions: deserialized.conditions.map((condition) => normalizeCategoryIds(condition, missionLookup)),
    });
    nextForm.sort_order = missions.length;
    setForm(nextForm);
    setDialog(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Mission Builder</h1>
          <p className="text-muted-foreground">Motore missioni flessibile per onboarding, campagne, streak, combo e reward avanzati.</p>
        </div>
        <div className="flex gap-2">
          <RefreshButton queryKeys={[["missions-v2"], ["event_categories"], ["event-secondary-categories"], ["badges-list"], ["discount-codes-for-missions"], ["organizers-for-missions"]]} />
          <Button
            onClick={() => {
              setForm({ ...emptyMissionForm, sort_order: missions.length });
              setDialog(true);
            }}
            className="gap-2"
          >
            <Plus className="h-4 w-4" /> Nuova Missione
          </Button>
        </div>
      </div>

      <MissionStatsCards missions={missions} />

      <Card>
        <CardContent className="p-0">
          <MissionsTable
            missions={missions}
            onEdit={handleEdit}
            onDelete={setDeleteId}
            onDuplicate={handleDuplicate}
            onArchive={(mission) => archiveMutation.mutate(mission)}
            onReorder={(nextMissions) => reorderMutation.mutate(nextMissions)}
            isReordering={reorderMutation.isPending}
          />
        </CardContent>
      </Card>

      <MissionFormDialog
        open={dialog}
        onOpenChange={setDialog}
        form={form}
        setForm={setForm}
        onSave={(mode) => saveMutation.mutate({ mission: form, mode: mode || "publish" })}
        isPending={saveMutation.isPending}
        categories={categories}
        badges={badges}
        coupons={coupons}
        organizers={organizers}
        existingMissions={missions}
        campaigns={campaigns}
        secondaryCategories={secondaryCategories}
      />

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent aria-describedby="delete-mission-desc">
          <DialogHeader>
            <DialogTitle>Eliminare questa missione?</DialogTitle>
            <DialogDescription id="delete-mission-desc">
              Questa azione è irreversibile. Le definizioni avanzate, i reward e i prerequisiti collegati verranno rimossi.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Annulla</Button>
            <Button variant="destructive" onClick={() => deleteId && deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending}>
              Elimina
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isLoading && <div className="text-sm text-muted-foreground">Caricamento missioni avanzate...</div>}
    </div>
  );
}
