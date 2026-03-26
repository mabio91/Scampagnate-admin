import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import RefreshButton from "@/components/RefreshButton";
import { Save } from "lucide-react";

export default function GamificationSettingsPage() {
  const queryClient = useQueryClient();

  // Points config
  const { data: pointsConfig = [] } = useQuery({
    queryKey: ["points-config"],
    queryFn: async () => {
      const { data } = await supabase.from("points_config").select("*").order("action_type");
      return data || [];
    },
  });

  // Community levels
  const { data: levels = [] } = useQuery({
    queryKey: ["community-levels-admin"],
    queryFn: async () => {
      const { data } = await supabase.from("community_levels").select("*").order("level_number");
      return data || [];
    },
  });

  const [editedPoints, setEditedPoints] = useState<Record<string, number>>({});
  const [editedLevels, setEditedLevels] = useState<Record<string, { name?: string; min_points?: number; icon?: string; color?: string }>>({});

  const savePointsMutation = useMutation({
    mutationFn: async () => {
      const updates = Object.entries(editedPoints);
      for (const [id, points] of updates) {
        const { error } = await supabase.from("points_config").update({ points, updated_at: new Date().toISOString() }).eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["points-config"] });
      setEditedPoints({});
      toast.success("Configurazione punti salvata");
    },
  });

  const saveLevelsMutation = useMutation({
    mutationFn: async () => {
      const updates = Object.entries(editedLevels);
      for (const [id, changes] of updates) {
        const { error } = await supabase.from("community_levels").update(changes).eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["community-levels-admin"] });
      queryClient.invalidateQueries({ queryKey: ["community-levels"] });
      setEditedLevels({});
      toast.success("Livelli aggiornati");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Impostazioni Gamification</h1>
          <p className="text-muted-foreground">Configura punti, livelli e ricompense</p>
        </div>
        <RefreshButton queryKeys={[["points-config"], ["community-levels-admin"]]} />
      </div>

      <Tabs defaultValue="points">
        <TabsList>
          <TabsTrigger value="points">Punti</TabsTrigger>
          <TabsTrigger value="levels">Livelli</TabsTrigger>
        </TabsList>

        <TabsContent value="points" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Configurazione Punti</CardTitle>
              <Button
                size="sm"
                onClick={() => savePointsMutation.mutate()}
                disabled={Object.keys(editedPoints).length === 0 || savePointsMutation.isPending}
                className="gap-2"
              >
                <Save className="h-4 w-4" /> Salva
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Azione</TableHead>
                    <TableHead>Descrizione</TableHead>
                    <TableHead className="w-28">Punti</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pointsConfig.map((pc: any) => (
                    <TableRow key={pc.id}>
                      <TableCell className="font-mono text-sm">{pc.action_type}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{pc.description}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          className="w-20 h-8"
                          value={editedPoints[pc.id] !== undefined ? editedPoints[pc.id] : pc.points}
                          onChange={(e) =>
                            setEditedPoints((prev) => ({ ...prev, [pc.id]: parseInt(e.target.value) || 0 }))
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="levels" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Livelli Community</CardTitle>
              <Button
                size="sm"
                onClick={() => saveLevelsMutation.mutate()}
                disabled={Object.keys(editedLevels).length === 0 || saveLevelsMutation.isPending}
                className="gap-2"
              >
                <Save className="h-4 w-4" /> Salva
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Livello</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead className="w-20">Icona</TableHead>
                    <TableHead className="w-28">Punti Min</TableHead>
                    <TableHead className="w-28">Colore</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {levels.map((lv: any) => (
                    <TableRow key={lv.id}>
                      <TableCell className="font-bold">{lv.level_number}</TableCell>
                      <TableCell>
                        <Input
                          className="h-8"
                          value={editedLevels[lv.id]?.name !== undefined ? editedLevels[lv.id].name : lv.name}
                          onChange={(e) =>
                            setEditedLevels((prev) => ({
                              ...prev,
                              [lv.id]: { ...prev[lv.id], name: e.target.value },
                            }))
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          className="h-8 w-16"
                          value={editedLevels[lv.id]?.icon !== undefined ? editedLevels[lv.id].icon : lv.icon}
                          onChange={(e) =>
                            setEditedLevels((prev) => ({
                              ...prev,
                              [lv.id]: { ...prev[lv.id], icon: e.target.value },
                            }))
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          className="h-8 w-24"
                          value={editedLevels[lv.id]?.min_points !== undefined ? editedLevels[lv.id].min_points : lv.min_points}
                          onChange={(e) =>
                            setEditedLevels((prev) => ({
                              ...prev,
                              [lv.id]: { ...prev[lv.id], min_points: parseInt(e.target.value) || 0 },
                            }))
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <input
                            type="color"
                            className="h-8 w-8 rounded cursor-pointer"
                            value={editedLevels[lv.id]?.color || lv.color}
                            onChange={(e) =>
                              setEditedLevels((prev) => ({
                                ...prev,
                                [lv.id]: { ...prev[lv.id], color: e.target.value },
                              }))
                            }
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
