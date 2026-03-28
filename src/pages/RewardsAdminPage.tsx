import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import RefreshButton from "@/components/RefreshButton";
import { Gift, Ticket, Award, CheckCircle, Clock, Package } from "lucide-react";

const statusLabels: Record<string, string> = {
  active: "Attivo",
  used: "Utilizzato",
  expired: "Scaduto",
  pending: "Da riscattare",
  redeemed: "Riscattato",
};

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  used: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  expired: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  redeemed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
};

const typeIcons: Record<string, React.ReactNode> = {
  coupon: <Ticket className="h-5 w-5" />,
  badge: <Award className="h-5 w-5" />,
  physical: <Gift className="h-5 w-5" />,
  points: <Package className="h-5 w-5" />,
};

export default function RewardsAdminPage() {
  const queryClient = useQueryClient();

  const { data: rewards = [], isLoading } = useQuery({
    queryKey: ["admin-rewards"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("user_rewards")
        .select("*")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-for-rewards"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, first_name, last_name, email");
      return data || [];
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: any = { status };
      if (status === "redeemed") updates.redeemed_at = new Date().toISOString();
      const { error } = await (supabase as any).from("user_rewards").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-rewards"] });
      toast.success("Stato aggiornato");
    },
  });

  const getProfileName = (userId: string) => {
    const p = profiles.find((p: any) => p.id === userId);
    return p ? `${p.first_name} ${p.last_name}` : userId.slice(0, 8);
  };

  const activeRewards = rewards.filter((r: any) => r.status === "active" || r.status === "pending");
  const historyRewards = rewards.filter((r: any) => r.status === "used" || r.status === "expired" || r.status === "redeemed");

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
            <div className="text-2xl font-bold text-green-600">{activeRewards.length}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Attive</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-amber-600">
              {rewards.filter((r: any) => r.status === "pending").length}
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
        <TabsList>
          <TabsTrigger value="active">Attive ({activeRewards.length})</TabsTrigger>
          <TabsTrigger value="history">Storico ({historyRewards.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4">
          <Card>
            <CardContent className="p-0">
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
                  {activeRewards.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                        <Gift className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        Nessuna ricompensa attiva
                      </TableCell>
                    </TableRow>
                  ) : (
                    activeRewards.map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{getProfileName(r.user_id)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {typeIcons[r.type]}
                            <span className="text-sm capitalize">{r.type}</span>
                          </div>
                        </TableCell>
                        <TableCell>{r.title || r.value || "—"}</TableCell>
                        <TableCell>
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[r.status]}`}>
                            {statusLabels[r.status]}
                          </span>
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardContent className="p-0">
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
                  {historyRewards.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                        <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        Nessun elemento nello storico
                      </TableCell>
                    </TableRow>
                  ) : (
                    historyRewards.map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{getProfileName(r.user_id)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {typeIcons[r.type]}
                            <span className="text-sm capitalize">{r.type}</span>
                          </div>
                        </TableCell>
                        <TableCell>{r.title || r.value || "—"}</TableCell>
                        <TableCell>
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[r.status]}`}>
                            {statusLabels[r.status]}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {r.redeemed_at ? new Date(r.redeemed_at).toLocaleDateString("it-IT") : new Date(r.created_at).toLocaleDateString("it-IT")}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
