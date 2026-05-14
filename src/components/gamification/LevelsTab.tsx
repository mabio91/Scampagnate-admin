import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Save, Plus, Trash2 } from "lucide-react";
import IconPicker from "@/components/IconPicker";
import DynamicIcon from "@/components/DynamicIcon";

export default function LevelsTab() {
  const queryClient = useQueryClient();
  const [editedLevels, setEditedLevels] = useState<Record<string, { name?: string; min_points?: number; icon?: string; color?: string }>>({});
  const [newLevelOpen, setNewLevelOpen] = useState(false);
  const [newLevel, setNewLevel] = useState({ level_number: 1, name: "", icon: "", color: "#22c55e", min_points: 0 });

  const { data: levels = [] } = useQuery({
    queryKey: ["community-levels-admin"],
    queryFn: async () => {
      const { data } = await supabase.from("community_levels").select("*").order("level_number");
      return data || [];
    },
  });

  const saveLevelsMutation = useMutation({
    mutationFn: async () => {
      for (const [id, changes] of Object.entries(editedLevels)) {
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

  const createLevelMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("community_levels").insert({
        level_number: newLevel.level_number,
        name: newLevel.name,
        icon: newLevel.icon,
        color: newLevel.color,
        min_points: newLevel.min_points,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["community-levels-admin"] });
      queryClient.invalidateQueries({ queryKey: ["community-levels"] });
      setNewLevel({ level_number: (levels.length || 0) + 2, name: "", icon: "", color: "#22c55e", min_points: 0 });
      setNewLevelOpen(false);
      toast.success("Livello creato");
    },
  });

  const deleteLevelMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("community_levels").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["community-levels-admin"] });
      queryClient.invalidateQueries({ queryKey: ["community-levels"] });
      toast.success("Livello eliminato");
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-base">Livelli Community</CardTitle>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Dialog open={newLevelOpen} onOpenChange={(open) => {
            setNewLevelOpen(open);
            if (open) setNewLevel((p) => ({ ...p, level_number: (levels.length || 0) + 1 }));
          }}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="w-full gap-2 sm:w-auto">
                <Plus className="h-4 w-4" /> Nuovo livello
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nuovo Livello Community</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Numero livello</Label>
                  <Input
                    type="number"
                    value={newLevel.level_number}
                    onChange={(e) => setNewLevel((p) => ({ ...p, level_number: parseInt(e.target.value) || 1 }))}
                  />
                </div>
                <div>
                  <Label>Nome</Label>
                  <Input
                    placeholder="es. Esploratore"
                    value={newLevel.name}
                    onChange={(e) => setNewLevel((p) => ({ ...p, name: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Icona</Label>
                  <IconPicker
                    value={newLevel.icon}
                    onChange={(v) => setNewLevel((p) => ({ ...p, icon: v }))}
                  />
                </div>
                <div>
                  <Label>Punti minimi</Label>
                  <Input
                    type="number"
                    value={newLevel.min_points}
                    onChange={(e) => setNewLevel((p) => ({ ...p, min_points: parseInt(e.target.value) || 0 }))}
                  />
                </div>
                <div>
                  <Label>Colore</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      className="h-10 w-10 rounded cursor-pointer"
                      value={newLevel.color}
                      onChange={(e) => setNewLevel((p) => ({ ...p, color: e.target.value }))}
                    />
                    <Input value={newLevel.color} onChange={(e) => setNewLevel((p) => ({ ...p, color: e.target.value }))} className="flex-1" />
                  </div>
                </div>
                <Button
                  className="w-full"
                  onClick={() => createLevelMutation.mutate()}
                  disabled={!newLevel.name || createLevelMutation.isPending}
                >
                  Crea livello
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button
            size="sm"
            onClick={() => saveLevelsMutation.mutate()}
            disabled={Object.keys(editedLevels).length === 0 || saveLevelsMutation.isPending}
            className="w-full gap-2 sm:w-auto"
          >
            <Save className="h-4 w-4" /> Salva
          </Button>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <Table className="min-w-[720px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Livello</TableHead>
              <TableHead className="min-w-[220px]">Nome</TableHead>
              <TableHead className="w-20 min-w-[220px]">Icona</TableHead>
              <TableHead className="w-28">Punti Min</TableHead>
              <TableHead className="w-28">Colore</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {levels.map((lv: any) => (
              <TableRow key={lv.id}>
                <TableCell className="font-bold">{lv.level_number}</TableCell>
                <TableCell>
                  <Input
                    className="h-8 min-w-[220px]"
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
                  <IconPicker
                    value={editedLevels[lv.id]?.icon !== undefined ? editedLevels[lv.id].icon! : lv.icon}
                    onChange={(v) =>
                      setEditedLevels((prev) => ({
                        ...prev,
                        [lv.id]: { ...prev[lv.id], icon: v },
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
                <TableCell>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Elimina livello</AlertDialogTitle>
                        <AlertDialogDescription>
                          Sei sicuro di voler eliminare il livello "{lv.name}"? Questa azione non può essere annullata.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annulla</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteLevelMutation.mutate(lv.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Elimina
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
