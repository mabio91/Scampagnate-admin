import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Save, Plus, Trash2 } from "lucide-react";

const ALL_ACTION_TYPES = [
  { value: "event_attended", label: "Evento frequentato (check-in)", description: "Evento frequentato (check-in)" },
  { value: "event_registration", label: "Iscrizione ad evento", description: "Iscrizione ad evento completata" },
  { value: "first_event_ever", label: "Primo evento in assoluto", description: "Primo evento in assoluto (bonus)" },
  { value: "first_event_category", label: "Primo evento in nuova categoria", description: "Primo evento in una nuova categoria" },
  { value: "streak_3", label: "Serie di 3 eventi", description: "Serie di 3 eventi senza cancellazioni" },
  { value: "profile_completed", label: "Profilo completato", description: "Profilo completato al 100%" },
  { value: "proposal_submitted", label: "Proposta inviata", description: "Proposta attività inviata" },
  { value: "proposal_approved", label: "Proposta approvata", description: "Proposta attività approvata" },
  { value: "no_show", label: "Assenza senza preavviso", description: "Assenza senza preavviso" },
  { value: "late_cancellation", label: "Cancellazione tardiva", description: "Cancellazione tardiva" },
  { value: "referral", label: "Referral", description: "Invito di un nuovo utente" },
  { value: "review_submitted", label: "Recensione inviata", description: "Recensione evento inviata" },
  { value: "photo_shared", label: "Foto condivisa", description: "Foto evento condivisa" },
  { value: "volunteer", label: "Volontariato", description: "Attività di volontariato" },
];

export default function PointsConfigTab() {
  const queryClient = useQueryClient();
  const [editedPoints, setEditedPoints] = useState<Record<string, { points?: number; is_active?: boolean }>>({});
  const [newRuleOpen, setNewRuleOpen] = useState(false);
  const [newRule, setNewRule] = useState({ action_type: "", description: "", points: 0 });

  const { data: pointsConfig = [] } = useQuery({
    queryKey: ["points-config"],
    queryFn: async () => {
      const { data } = await supabase.from("points_config").select("*").order("action_type");
      return data || [];
    },
  });

  const savePointsMutation = useMutation({
    mutationFn: async () => {
      for (const [id, changes] of Object.entries(editedPoints)) {
        const updateData: any = { updated_at: new Date().toISOString() };
        if (changes.points !== undefined) updateData.points = changes.points;
        if (changes.is_active !== undefined) updateData.is_active = changes.is_active;
        const { error } = await supabase.from("points_config").update(updateData).eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["points-config"] });
      setEditedPoints({});
      toast.success("Configurazione punti salvata");
    },
  });

  const createRuleMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("points_config").insert({
        action_type: newRule.action_type,
        description: newRule.description,
        points: newRule.points,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["points-config"] });
      setNewRule({ action_type: "", description: "", points: 0 });
      setNewRuleOpen(false);
      toast.success("Regola punti creata");
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("points_config").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["points-config"] });
      toast.success("Regola eliminata");
    },
  });

  const getEditedValue = (id: string, field: "points" | "is_active", original: any) => {
    return editedPoints[id]?.[field] !== undefined ? editedPoints[id][field] : original;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Configurazione Punti</CardTitle>
        <div className="flex gap-2">
          <Dialog open={newRuleOpen} onOpenChange={setNewRuleOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-2">
                <Plus className="h-4 w-4" /> Nuova regola
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nuova Regola Punti</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Tipo azione</Label>
                  <Select
                    value={newRule.action_type}
                    onValueChange={(v) => {
                      const preset = ALL_ACTION_TYPES.find((a) => a.value === v);
                      setNewRule((p) => ({
                        ...p,
                        action_type: v,
                        description: preset?.description || p.description,
                      }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona un'azione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {ALL_ACTION_TYPES
                        .filter((a) => !pointsConfig.some((pc: any) => pc.action_type === a.value))
                        .map((a) => (
                          <SelectItem key={a.value} value={a.value}>
                            <span className="flex items-center gap-2">
                              <span className="font-mono text-xs text-muted-foreground">{a.value}</span>
                              <span className="text-xs">— {a.label}</span>
                            </span>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Descrizione</Label>
                  <Input
                    placeholder="es. Punti per check-in evento"
                    value={newRule.description}
                    onChange={(e) => setNewRule((p) => ({ ...p, description: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Punti</Label>
                  <Input
                    type="number"
                    value={newRule.points}
                    onChange={(e) => setNewRule((p) => ({ ...p, points: parseInt(e.target.value) || 0 }))}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => createRuleMutation.mutate()}
                  disabled={!newRule.action_type || createRuleMutation.isPending}
                >
                  Crea regola
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button
            size="sm"
            onClick={() => savePointsMutation.mutate()}
            disabled={Object.keys(editedPoints).length === 0 || savePointsMutation.isPending}
            className="gap-2"
          >
            <Save className="h-4 w-4" /> Salva
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Azione</TableHead>
              <TableHead>Descrizione</TableHead>
              <TableHead className="w-28">Punti</TableHead>
              <TableHead className="w-20">Attivo</TableHead>
              <TableHead className="w-12"></TableHead>
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
                    value={getEditedValue(pc.id, "points", pc.points)}
                    onChange={(e) =>
                      setEditedPoints((prev) => ({
                        ...prev,
                        [pc.id]: { ...prev[pc.id], points: parseInt(e.target.value) || 0 },
                      }))
                    }
                  />
                </TableCell>
                <TableCell>
                  <Switch
                    checked={getEditedValue(pc.id, "is_active", pc.is_active) as boolean}
                    onCheckedChange={(checked) =>
                      setEditedPoints((prev) => ({
                        ...prev,
                        [pc.id]: { ...prev[pc.id], is_active: checked },
                      }))
                    }
                  />
                </TableCell>
                <TableCell>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => deleteRuleMutation.mutate(pc.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
