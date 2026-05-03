import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Minus, Award, Shield, History, Info } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LevelBadgeAvatar, useUserLevel } from "./LevelBadgeAvatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLanguage } from "@/i18n/LanguageContext";

interface UserGamificationSectionProps {
  userId: string;
  userName: string;
  totalPoints: number;
  avatarUrl?: string | null;
  firstName?: string;
  lastName?: string;
}

export function UserGamificationSection({
  userId,
  userName,
  totalPoints,
  avatarUrl,
  firstName = "",
  lastName = "",
}: UserGamificationSectionProps) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [pointsDialog, setPointsDialog] = useState<"add" | "remove" | null>(null);
  const [pointsAmount, setPointsAmount] = useState("");
  const [pointsReason, setPointsReason] = useState("");
  const [badgeDialog, setBadgeDialog] = useState<"assign" | "remove" | null>(null);
  const [selectedBadgeId, setSelectedBadgeId] = useState("");

  // Points history
  const { data: pointsHistory = [] } = useQuery({
    queryKey: ["points-history", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("points_history")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const historyTotalPoints = pointsHistory.reduce(
    (sum, point) => sum + (Number(point.value) || 0),
    0
  );
  const effectiveTotalPoints = pointsHistory.length > 0 ? historyTotalPoints : totalPoints;
  const { currentLevel, nextLevel } = useUserLevel(effectiveTotalPoints);

  const progressToNext = nextLevel
    ? ((effectiveTotalPoints - (currentLevel?.min_points || 0)) / (nextLevel.min_points - (currentLevel?.min_points || 0))) * 100
    : 100;

  // User badges
  const { data: userBadges = [] } = useQuery({
    queryKey: ["user-badges-detail", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_badges")
        .select("*, badges(*)")
        .eq("user_id", userId);
      return data || [];
    },
  });

  // All badges
  const { data: allBadges = [] } = useQuery({
    queryKey: ["all-badges"],
    queryFn: async () => {
      const { data } = await supabase.from("badges").select("*").order("name");
      return data || [];
    },
  });

  // Reliability calculation
  const { data: reliability } = useQuery({
    queryKey: ["user-reliability", userId],
    queryFn: async () => {
      const { data: registrations } = await supabase
        .from("event_registrations")
        .select("status, checked_in, events:event_id(date)")
        .eq("user_id", userId);

      if (!registrations || registrations.length === 0) return null;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const pastRegs = registrations.filter((r: any) => {
        const d = r.events?.date;
        return d && new Date(d) < today && (r.status === "registered" || r.status === "paid" || r.status === "cancelled" || r.status === "no_show");
      });

      if (pastRegs.length === 0) return null;

      const attended = pastRegs.filter((r: any) => r.checked_in).length;
      const noShows = pastRegs.filter((r: any) => !r.checked_in && (r.status === "registered" || r.status === "paid")).length;
      const cancelled = pastRegs.filter((r: any) => r.status === "cancelled").length;

      const total = pastRegs.length;
      const score = Math.round(((attended / total) * 70) + (((total - noShows) / total) * 30));
      const label = score >= 80 ? "Ottima affidabilità" : score >= 50 ? "Buona affidabilità" : "Da migliorare";
      const color = score >= 80 ? "text-green-600" : score >= 50 ? "text-yellow-600" : "text-destructive";

      return { score, label, color, attended, noShows, cancelled, total };
    },
  });

  // Mutations
  const addPointsMutation = useMutation({
    mutationFn: async ({ amount, reason }: { amount: number; reason: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.rpc("add_user_points", {
        p_user_id: userId,
        p_type: "admin_manual",
        p_value: amount,
        p_description: reason,
        p_admin_id: user?.id || null,
      });
      if (error) throw error;

      // Audit log
      await supabase.from("admin_action_log").insert({
        admin_id: user?.id || "",
        user_id: userId,
        action: amount > 0 ? "add_points" : "remove_points",
        details: { amount, reason },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["points-history", userId] });
      queryClient.invalidateQueries({ queryKey: ["user-detail", userId] });
      toast.success(pointsDialog === "add" ? "Punti aggiunti" : "Punti rimossi");
      setPointsDialog(null);
      setPointsAmount("");
      setPointsReason("");
    },
    onError: () => toast.error("Errore nell'operazione"),
  });

  const assignBadgeMutation = useMutation({
    mutationFn: async (badgeId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("user_badges").insert({
        user_id: userId,
        badge_id: badgeId,
        completed: true,
        completed_at: new Date().toISOString(),
      });
      if (error) throw error;

      await supabase.from("admin_action_log").insert({
        admin_id: user?.id || "",
        user_id: userId,
        action: "assign_badge",
        details: { badge_id: badgeId },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-badges-detail", userId] });
      toast.success("Badge assegnato");
      setBadgeDialog(null);
      setSelectedBadgeId("");
    },
    onError: () => toast.error("Errore nell'assegnazione"),
  });

  const removeBadgeMutation = useMutation({
    mutationFn: async (badgeId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("user_badges")
        .delete()
        .eq("user_id", userId)
        .eq("badge_id", badgeId);
      if (error) throw error;

      await supabase.from("admin_action_log").insert({
        admin_id: user?.id || "",
        user_id: userId,
        action: "remove_badge",
        details: { badge_id: badgeId },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-badges-detail", userId] });
      toast.success("Badge rimosso");
      setBadgeDialog(null);
      setSelectedBadgeId("");
    },
    onError: () => toast.error("Errore nella rimozione"),
  });

  const existingBadgeIds = userBadges.map((ub: any) => ub.badge_id);
  const availableBadges = allBadges.filter((b: any) => !existingBadgeIds.includes(b.id));

  return (
    <div className="space-y-6">
      {/* Level & Points Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-1">
          <CardContent className="p-6 flex flex-col items-center text-center gap-3">
            <LevelBadgeAvatar
              avatarUrl={avatarUrl}
              firstName={firstName}
              lastName={lastName}
              totalPoints={effectiveTotalPoints}
              size="lg"
            />
            <div>
              <p className="text-lg font-bold">
                {currentLevel?.icon} {currentLevel?.name || "—"}
              </p>
              <p className="text-2xl font-bold text-primary">{effectiveTotalPoints.toLocaleString()} punti</p>
            </div>
            {nextLevel && (
              <div className="w-full space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{currentLevel?.name}</span>
                  <span>{nextLevel.name}</span>
                </div>
                <Progress value={progressToNext} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {nextLevel.min_points - effectiveTotalPoints} punti per il prossimo livello
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Reliability */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Affidabilità
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-xs">Score = (presenze/totale × 70%) + ((totale - no-show)/totale × 30%)</p>
                </TooltipContent>
              </Tooltip>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {reliability ? (
              <div className="space-y-3">
                <div className="flex items-baseline gap-2">
                  <span className={`text-3xl font-bold ${reliability.color}`}>{reliability.score}%</span>
                  <span className={`text-sm font-medium ${reliability.color}`}>{reliability.label}</span>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Presenze:</span>{" "}
                    <span className="font-medium">{reliability.attended}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">No-show:</span>{" "}
                    <span className="font-medium text-destructive">{reliability.noShows}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Cancellazioni:</span>{" "}
                    <span className="font-medium">{reliability.cancelled}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Totale:</span>{" "}
                    <span className="font-medium">{reliability.total}</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Nessun dato disponibile</p>
            )}
          </CardContent>
        </Card>

        {/* Admin Actions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Azioni</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button size="sm" className="w-full justify-start gap-2" onClick={() => setPointsDialog("add")}>
              <Plus className="h-4 w-4" /> Aggiungi punti
            </Button>
            <Button size="sm" variant="outline" className="w-full justify-start gap-2" onClick={() => setPointsDialog("remove")}>
              <Minus className="h-4 w-4" /> Rimuovi punti
            </Button>
            <Button size="sm" variant="outline" className="w-full justify-start gap-2" onClick={() => setBadgeDialog("assign")}>
              <Award className="h-4 w-4" /> Assegna badge
            </Button>
            <Button size="sm" variant="outline" className="w-full justify-start gap-2 text-destructive" onClick={() => setBadgeDialog("remove")}>
              <Minus className="h-4 w-4" /> Rimuovi badge
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Badges */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Award className="h-4 w-4" /> Badge ({userBadges.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {userBadges.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nessun badge assegnato</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {userBadges.map((ub: any) => (
                <div key={ub.id} className="flex items-center gap-2 p-3 rounded-lg border bg-muted/30">
                  <span className="text-2xl">{ub.badges?.icon || "🏅"}</span>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{ub.badges?.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{ub.badges?.category || "—"}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Points History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" /> Storico Punti
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pointsHistory.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nessuna transazione registrata</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {pointsHistory.map((ph: any) => (
                <div key={ph.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{ph.description || ph.type}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(ph.created_at).toLocaleString()}
                    </p>
                  </div>
                  <span className={`font-bold text-sm ${ph.value > 0 ? "text-green-600" : "text-destructive"}`}>
                    {ph.value > 0 ? "+" : ""}{ph.value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Points Dialog */}
      <Dialog open={!!pointsDialog} onOpenChange={() => setPointsDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pointsDialog === "add" ? "Aggiungi Punti" : "Rimuovi Punti"} — {userName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Punti</label>
              <Input
                type="number"
                min={1}
                value={pointsAmount}
                onChange={(e) => setPointsAmount(e.target.value)}
                placeholder="es. 20"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Motivo</label>
              <Textarea
                value={pointsReason}
                onChange={(e) => setPointsReason(e.target.value)}
                placeholder="Motivo dell'operazione..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPointsDialog(null)}>Annulla</Button>
            <Button
              onClick={() => {
                const val = parseInt(pointsAmount);
                if (!val || val <= 0) return toast.error("Inserisci un valore valido");
                addPointsMutation.mutate({
                  amount: pointsDialog === "add" ? val : -val,
                  reason: pointsReason || (pointsDialog === "add" ? "Punti aggiunti manualmente" : "Punti rimossi manualmente"),
                });
              }}
              disabled={addPointsMutation.isPending}
            >
              {addPointsMutation.isPending ? "..." : "Conferma"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Badge Dialog */}
      <Dialog open={!!badgeDialog} onOpenChange={() => setBadgeDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {badgeDialog === "assign" ? "Assegna Badge" : "Rimuovi Badge"} — {userName}
            </DialogTitle>
          </DialogHeader>
          <div>
            <label className="text-sm font-medium">Badge</label>
            <Select value={selectedBadgeId} onValueChange={setSelectedBadgeId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona badge..." />
              </SelectTrigger>
              <SelectContent>
                {(badgeDialog === "assign" ? availableBadges : userBadges.map((ub: any) => ub.badges)).map((b: any) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.icon} {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBadgeDialog(null)}>Annulla</Button>
            <Button
              onClick={() => {
                if (!selectedBadgeId) return toast.error("Seleziona un badge");
                if (badgeDialog === "assign") {
                  assignBadgeMutation.mutate(selectedBadgeId);
                } else {
                  removeBadgeMutation.mutate(selectedBadgeId);
                }
              }}
              disabled={assignBadgeMutation.isPending || removeBadgeMutation.isPending}
              variant={badgeDialog === "remove" ? "destructive" : "default"}
            >
              {badgeDialog === "assign" ? "Assegna" : "Rimuovi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
