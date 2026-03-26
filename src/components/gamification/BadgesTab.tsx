import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, UserPlus } from "lucide-react";

interface BadgeForm {
  name: string;
  description: string;
  icon: string;
  category: string;
  requirement_type: string;
  requirement_value: number;
  required_events: number;
}

const emptyBadge: BadgeForm = {
  name: "",
  description: "",
  icon: "🏆",
  category: "",
  requirement_type: "events_attended",
  requirement_value: 1,
  required_events: 1,
};

export default function BadgesTab() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BadgeForm>(emptyBadge);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignBadgeId, setAssignBadgeId] = useState<string | null>(null);
  const [assignSearch, setAssignSearch] = useState("");
  const [assignUserId, setAssignUserId] = useState<string | null>(null);

  const { data: badges = [] } = useQuery({
    queryKey: ["badges-admin"],
    queryFn: async () => {
      const { data } = await supabase.from("badges").select("*").order("category", { ascending: true, nullsFirst: false }).order("required_events");
      return data || [];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["event-categories"],
    queryFn: async () => {
      const { data } = await supabase.from("event_categories").select("name").order("name");
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        description: form.description,
        icon: form.icon,
        category: form.category || null,
        requirement_type: form.requirement_type || null,
        requirement_value: form.requirement_value,
        required_events: form.required_events,
      };
      if (editingId) {
        const { error } = await supabase.from("badges").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("badges").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["badges-admin"] });
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyBadge);
      toast.success(editingId ? "Badge aggiornato" : "Badge creato");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("badges").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["badges-admin"] });
      toast.success("Badge eliminato");
    },
  });

  // Search users for manual assignment
  const { data: searchResults = [] } = useQuery({
    queryKey: ["users-search-badge", assignSearch],
    queryFn: async () => {
      if (assignSearch.length < 2) return [];
      const { data } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .or(`first_name.ilike.%${assignSearch}%,last_name.ilike.%${assignSearch}%,email.ilike.%${assignSearch}%`)
        .limit(10);
      return data || [];
    },
    enabled: assignSearch.length >= 2,
  });

  const assignBadgeMutation = useMutation({
    mutationFn: async () => {
      if (!assignBadgeId || !assignUserId) return;
      const { error } = await supabase.from("user_badges").insert({
        user_id: assignUserId,
        badge_id: assignBadgeId,
      });
      if (error) {
        if (error.code === "23505") throw new Error("Questo utente ha già questo badge");
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("Badge assegnato manualmente");
      setAssignOpen(false);
      setAssignBadgeId(null);
      setAssignUserId(null);
      setAssignSearch("");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const openAssign = (badgeId: string) => {
    setAssignBadgeId(badgeId);
    setAssignUserId(null);
    setAssignSearch("");
    setAssignOpen(true);
  };

  const openEdit = (badge: any) => {
    setEditingId(badge.id);
    setForm({
      name: badge.name,
      description: badge.description,
      icon: badge.icon,
      category: badge.category || "",
      requirement_type: badge.requirement_type || "events_attended",
      requirement_value: badge.requirement_value,
      required_events: badge.required_events,
    });
    setDialogOpen(true);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyBadge);
    setDialogOpen(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Gestione Badge</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="gap-2" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Nuovo badge
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingId ? "Modifica Badge" : "Nuovo Badge"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nome</Label>
                <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="es. Primo Trekking" />
              </div>
              <div>
                <Label>Descrizione</Label>
                <Textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Descrizione del badge" rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Icona (emoji)</Label>
                  <Input value={form.icon} onChange={(e) => setForm((p) => ({ ...p, icon: e.target.value }))} placeholder="🏆" />
                </div>
                <div>
                  <Label>Categoria</Label>
                  <Select value={form.category} onValueChange={(v) => setForm((p) => ({ ...p, category: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Generale" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">Generale</SelectItem>
                      <SelectItem value="special">Speciale</SelectItem>
                      {categories.map((c: any) => (
                        <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Tipo requisito</Label>
                  <Select value={form.requirement_type} onValueChange={(v) => setForm((p) => ({ ...p, requirement_type: v }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="events_attended">Eventi partecipati</SelectItem>
                      <SelectItem value="points_earned">Punti guadagnati</SelectItem>
                      <SelectItem value="category_events">Eventi per categoria</SelectItem>
                      <SelectItem value="manual">Assegnazione manuale</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Valore requisito</Label>
                  <Input
                    type="number"
                    value={form.requirement_value}
                    onChange={(e) => setForm((p) => ({ ...p, requirement_value: parseInt(e.target.value) || 1 }))}
                  />
                </div>
              </div>
              <div>
                <Label>Eventi richiesti</Label>
                <Input
                  type="number"
                  value={form.required_events}
                  onChange={(e) => setForm((p) => ({ ...p, required_events: parseInt(e.target.value) || 1 }))}
                />
              </div>
              <Button className="w-full" onClick={() => saveMutation.mutate()} disabled={!form.name || saveMutation.isPending}>
                {editingId ? "Aggiorna" : "Crea"} badge
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Icona</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Requisito</TableHead>
              <TableHead className="w-20">Eventi</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {badges.map((b: any) => (
              <TableRow key={b.id}>
                <TableCell className="text-xl">{b.icon}</TableCell>
                <TableCell>
                  <div>
                    <span className="font-medium">{b.name}</span>
                    <p className="text-xs text-muted-foreground line-clamp-1">{b.description}</p>
                  </div>
                </TableCell>
                <TableCell>
                  {b.category ? (
                    <Badge variant="secondary" className="text-xs">{b.category}</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {b.requirement_type === "events_attended" && "Eventi partecipati"}
                  {b.requirement_type === "points_earned" && "Punti guadagnati"}
                  {b.requirement_type === "category_events" && "Eventi categoria"}
                  {b.requirement_type === "manual" && "Manuale"}
                  {!b.requirement_type && "—"}
                  {b.requirement_type && b.requirement_type !== "manual" && ` ≥ ${b.requirement_value}`}
                </TableCell>
                <TableCell className="text-center">{b.required_events}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(b)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Elimina badge</AlertDialogTitle>
                          <AlertDialogDescription>
                            Sei sicuro di voler eliminare il badge "{b.name}"? I badge già assegnati agli utenti verranno rimossi.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annulla</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(b.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Elimina
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {badges.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Nessun badge configurato. Crea il primo badge!
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
