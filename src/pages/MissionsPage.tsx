import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Target } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";
import RefreshButton from "@/components/RefreshButton";

interface MissionForm {
  id?: string;
  title: string;
  description: string;
  type: string;
  target_value: number;
  reward_points: number;
  is_active: boolean;
  category: string;
}

const emptyForm: MissionForm = {
  title: "",
  description: "",
  type: "one_time",
  target_value: 1,
  reward_points: 10,
  is_active: true,
  category: "",
};

export default function MissionsPage() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState<MissionForm>(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: missions = [], isLoading } = useQuery({
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
      const { data } = await supabase
        .from("event_categories")
        .select("id, name")
        .order("sort_order");
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (m: MissionForm) => {
      const payload = {
        title: m.title,
        description: m.description,
        type: m.type,
        target_value: m.target_value,
        reward_points: m.reward_points,
        is_active: m.is_active,
        category: m.category || null,
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

  const typeLabels: Record<string, string> = {
    weekly: "Settimanale",
    monthly: "Mensile",
    one_time: "Una tantum",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
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

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-primary">{missions.length}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Totale</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">
              {missions.filter((m: any) => m.is_active).length}
            </div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Attive</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-muted-foreground">
              {missions.filter((m: any) => !m.is_active).length}
            </div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Disattive</div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Missione</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Obiettivo</TableHead>
                <TableHead>Ricompensa</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead className="w-20">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {missions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    Nessuna missione. Creane una per iniziare.
                  </TableCell>
                </TableRow>
              ) : (
                missions.map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{m.title}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">{m.description}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{typeLabels[m.type] || m.type}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{m.target_value}</TableCell>
                    <TableCell>
                      <span className="text-primary font-medium">+{m.reward_points} pt</span>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={m.is_active}
                        onCheckedChange={(checked) => toggleMutation.mutate({ id: m.id, active: checked })}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setForm({
                              id: m.id,
                              title: m.title,
                              description: m.description,
                              type: m.type,
                              target_value: m.target_value,
                              reward_points: m.reward_points,
                              is_active: m.is_active,
                              category: m.category || "",
                            });
                            setDialog(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(m.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Modifica Missione" : "Nuova Missione"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Titolo</label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">Descrizione</label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Tipo</label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Settimanale</SelectItem>
                    <SelectItem value="monthly">Mensile</SelectItem>
                    <SelectItem value="one_time">Una tantum</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Categoria</label>
                <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="es. partecipazione" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Obiettivo (numero)</label>
                <Input type="number" min={1} value={form.target_value} onChange={(e) => setForm({ ...form, target_value: parseInt(e.target.value) || 1 })} />
              </div>
              <div>
                <label className="text-sm font-medium">Ricompensa (punti)</label>
                <Input type="number" min={0} value={form.reward_points} onChange={(e) => setForm({ ...form, reward_points: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <span className="text-sm">Attiva</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>Annulla</Button>
            <Button
              onClick={() => saveMutation.mutate(form)}
              disabled={!form.title || saveMutation.isPending}
            >
              {saveMutation.isPending ? "Salvataggio..." : "Salva"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Eliminare questa missione?</DialogTitle></DialogHeader>
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
