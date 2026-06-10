import { useState, type ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import RefreshButton from "@/components/RefreshButton";
import { Gift, Ticket, Award, CheckCircle, Clock, Package } from "lucide-react";

type Reward = Tables<"user_rewards">;
type RewardProfile = Pick<Tables<"profiles">, "id" | "first_name" | "last_name" | "email">;

const statusLabels: Record<string, string> = {
  active: "Attivo",
  used: "Utilizzato",
  expired: "Scaduto",
  pending: "Da riscattare",
  redeemed: "Riscattato",
};

type RewardTypeFilter = "all" | "points" | "physical" | "badge" | "coupon";

const rewardTypeOptions: { value: RewardTypeFilter; label: string }[] = [
  { value: "all", label: "Tutte" },
  { value: "points", label: "Punti" },
  { value: "physical", label: "Ricompense fisiche" },
  { value: "badge", label: "Badge" },
  { value: "coupon", label: "Coupon" },
];

const typeLabels: Record<string, string> = {
  coupon: "Coupon",
  badge: "Badge",
  physical: "Ricompensa fisica",
  points: "Punti",
};

const typeIcons: Record<string, ReactNode> = {
  coupon: <Ticket className="h-5 w-5" />,
  badge: <Award className="h-5 w-5" />,
  physical: <Gift className="h-5 w-5" />,
  points: <Package className="h-5 w-5" />,
};

export default function RewardsAdminPage() {
  const queryClient = useQueryClient();
  const [rewardTypeFilter, setRewardTypeFilter] = useState<RewardTypeFilter>("all");

  const { data: rewards = [] } = useQuery<Reward[]>({
    queryKey: ["admin-rewards"],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_rewards")
        .select("*")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: profiles = [] } = useQuery<RewardProfile[]>({
    queryKey: ["profiles-for-rewards"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, first_name, last_name, email");
      return data || [];
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: Record<string, string> = { status };
      if (status === "redeemed") updates.redeemed_at = new Date().toISOString();
      const { error } = await supabase.from("user_rewards").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-rewards"] });
      toast.success("Stato aggiornato");
    },
  });

  const getProfileName = (userId: string) => {
    const p = profiles.find((p) => p.id === userId);
    return p ? `${p.first_name} ${p.last_name}` : userId.slice(0, 8);
  };

  const activeRewards = rewards.filter((r) => r.status === "active" || r.status === "pending");
  const historyRewards = rewards.filter((r) => r.status === "used" || r.status === "expired" || r.status === "redeemed");
  const selectedRewardTypeLabel = rewardTypeOptions.find((option) => option.value === rewardTypeFilter)?.label || "";
  const activeRewardsByType = rewardTypeFilter === "all" ? activeRewards : activeRewards.filter((r) => r.type === rewardTypeFilter);
  const historyRewardsByType = rewardTypeFilter === "all" ? historyRewards : historyRewards.filter((r) => r.type === rewardTypeFilter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Gestione Ricompense</h1>
          <p className="text-muted-foreground">Monitora e gestisci le ricompense degli utenti</p>
        </div>
        <RefreshButton queryKeys={[["admin-rewards"]]} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-primary">{rewards.length}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Totale</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-accent-foreground">{activeRewards.length}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Attive</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-primary">
              {rewards.filter((r) => r.status === "pending").length}
            </div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Da ritirare</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-muted-foreground">{historyRewards.length}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Storico</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="active">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <TabsList>
            <TabsTrigger value="active">Attive ({activeRewardsByType.length})</TabsTrigger>
            <TabsTrigger value="history">Storico ({historyRewardsByType.length})</TabsTrigger>
          </TabsList>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Tipologia</span>
            <Select value={rewardTypeFilter} onValueChange={(value) => setRewardTypeFilter(value as RewardTypeFilter)}>
              <SelectTrigger className="w-full sm:w-[220px]" aria-label="Tipologia ricompensa">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {rewardTypeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <TabsContent value="active" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Utente</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Ricompensa</TableHead>
                      <TableHead>Stato</TableHead>
                      <TableHead>Scadenza</TableHead>
                      <TableHead>Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeRewardsByType.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                          <Gift className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          {rewardTypeFilter === "all"
                            ? "Nessuna ricompensa attiva"
                            : `Nessuna ricompensa attiva per ${selectedRewardTypeLabel.toLowerCase()}`}
                        </TableCell>
                      </TableRow>
                    ) : (
                      activeRewardsByType.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{getProfileName(r.user_id)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              {typeIcons[r.type]}
                              <span className="text-sm">{typeLabels[r.type] || r.type}</span>
                            </div>
                          </TableCell>
                          <TableCell>{r.title || r.value || "—"}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">
                              {statusLabels[r.status] || r.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {r.expiry_date ? new Date(r.expiry_date).toLocaleDateString("it-IT") : "—"}
                          </TableCell>
                          <TableCell>
                            {r.status === "pending" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateStatusMutation.mutate({ id: r.id, status: "redeemed" })}
                                className="gap-1"
                              >
                                <CheckCircle className="h-3.5 w-3.5" />
                                Consegnato
                              </Button>
                            )}
                            {r.status === "active" && r.type === "coupon" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateStatusMutation.mutate({ id: r.id, status: "used" })}
                                className="gap-1"
                              >
                                <CheckCircle className="h-3.5 w-3.5" />
                                Usato
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Utente</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Ricompensa</TableHead>
                      <TableHead>Stato</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyRewardsByType.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                          <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          {rewardTypeFilter === "all"
                            ? "Nessun elemento nello storico"
                            : `Nessun elemento nello storico per ${selectedRewardTypeLabel.toLowerCase()}`}
                        </TableCell>
                      </TableRow>
                    ) : (
                      historyRewardsByType.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{getProfileName(r.user_id)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              {typeIcons[r.type]}
                              <span className="text-sm">{typeLabels[r.type] || r.type}</span>
                            </div>
                          </TableCell>
                          <TableCell>{r.title || r.value || "—"}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">
                              {statusLabels[r.status] || r.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {r.redeemed_at ? new Date(r.redeemed_at).toLocaleDateString("it-IT") : new Date(r.created_at).toLocaleDateString("it-IT")}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
