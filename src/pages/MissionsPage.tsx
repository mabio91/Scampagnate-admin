import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import RefreshButton from "@/components/RefreshButton";
import MissionFormDialog, { MissionForm, emptyForm } from "@/components/missions/MissionFormDialog";
import MissionStatsCards from "@/components/missions/MissionStatsCards";
import MissionsTable from "@/components/missions/MissionsTable";

export default function MissionsPage() {
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState<MissionForm>(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: missions = [] } = useQuery({
    queryKey: ["missions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("missions")
        .select("*")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["event_categories"],
    queryFn: async () => {
      const { data } = await supabase.from("event_categories").select("id, name").order("sort_order");
      return data || [];
    },
  });

  const { data: badges = [] } = useQuery({
    queryKey: ["badges-list"],
    queryFn: async () => {
      const { data } = await supabase.from("badges").select("id, name, icon").order("name");
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (m: MissionForm) => {
      const payload: any = {
        title: m.title,
        description: m.description,
        icon: m.icon,
        type: m.type,
        target_action: m.target_action,
        target_value: m.target_value,
        streak_count: m.streak_count,
        reset_on_failure: m.reset_on_failure,
        reward_points: m.reward_points,
        reward_type: m.reward_type,
        reward_value: m.reward_value || null,
        reward_badge_id: m.reward_badge_id || null,
        is_active: m.is_active,
        category: m.category || null,
        expires_at: m.expires_at ? new Date(m.expires_at).toISOString() : null,
        starts_at: m.starts_at ? new Date(m.starts_at).toISOString() : null,
        max_completions_per_user: m.max_completions_per_user,
        notify_on_progress: m.notify_on_progress,
        auto_generate_coupon: m.auto_generate_coupon,
        category_filter: (m.category_filter && m.category_filter.length > 0) ? m.category_filter : null,
        updated_at: new Date().toISOString(),
      };
      if (m.id) {
        const { error } = await supabase.from("missions").update(payload).eq("id", m.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("missions").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["missions"] });
      toast.success("Missione salvata");
      setDialog(false);
      setForm(emptyForm);
    },
    onError: () => toast.error("Errore nel salvataggio"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("missions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["missions"] });
      toast.success("Missione eliminata");
      setDeleteId(null);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("missions").update({ is_active: active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["missions"] }),
  });

  const handleEdit = (m: any) => {
    setForm({
      id: m.id,
      title: m.title,
      description: m.description,
      icon: m.icon || "🎯",
      type: m.type,
      target_action: m.target_action || "event_attended",
      target_value: m.target_value,
      streak_count: m.streak_count,
      reset_on_failure: m.reset_on_failure || false,
      reward_points: m.reward_points,
      reward_type: m.reward_type || "points",
      reward_value: m.reward_value || "",
      reward_badge_id: m.reward_badge_id || "",
      is_active: m.is_active,
      category: m.category || "",
      expires_at: m.expires_at ? new Date(m.expires_at).toISOString().slice(0, 16) : "",
      starts_at: m.starts_at ? new Date(m.starts_at).toISOString().slice(0, 16) : "",
      max_completions_per_user: m.max_completions_per_user ?? null,
      notify_on_progress: m.notify_on_progress ?? false,
      auto_generate_coupon: m.auto_generate_coupon ?? false,
      category_filter: Array.isArray(m.category_filter) ? m.category_filter : [],
    });
    setDialog(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Obiettivi & Missioni</h1>
          <p className="text-muted-foreground">Gestisci le missioni e gli obiettivi per i membri</p>
        </div>
        <div className="flex gap-2">
          <RefreshButton queryKeys={[["missions"]]} />
          <Button onClick={() => { setForm(emptyForm); setDialog(true); }} className="gap-2">
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
            onToggle={(id, active) => toggleMutation.mutate({ id, active })}
          />
        </CardContent>
      </Card>

      <MissionFormDialog
        open={dialog}
        onOpenChange={setDialog}
        form={form}
        setForm={setForm}
        onSave={() => saveMutation.mutate(form)}
        isPending={saveMutation.isPending}
        categories={categories}
        badges={badges}
      />

      {/* Delete Confirm */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent aria-describedby="delete-mission-desc">
          <DialogHeader>
            <DialogTitle>Eliminare questa missione?</DialogTitle>
            <DialogDescription id="delete-mission-desc">
              Questa azione è irreversibile. La missione verrà eliminata definitivamente.
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
    </div>
  );
}
