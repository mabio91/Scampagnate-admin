import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowDown, ArrowUp, Pencil, Plus, Quote, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface EventClosingSentence {
  id: string;
  sentence: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface SentenceFormState {
  sentence: string;
  is_active: boolean;
  sort_order: number;
}

const emptyForm: SentenceFormState = {
  sentence: "",
  is_active: true,
  sort_order: 10,
};

const cleanSentence = (value: string) => value.replace(/^(?:✨\s*)+/u, "").trim();

export default function EventClosingSentencesPage() {
  const queryClient = useQueryClient();
  const [editingSentence, setEditingSentence] = useState<EventClosingSentence | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState<SentenceFormState>(emptyForm);

  const { data: sentences = [], isLoading } = useQuery({
    queryKey: ["event-closing-sentences-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_closing_sentences" as any)
        .select("id,sentence,is_active,sort_order,created_at,updated_at")
        .order("sort_order", { ascending: true })
        .order("sentence", { ascending: true });

      if (error) throw error;
      return (data || []) as EventClosingSentence[];
    },
  });

  const nextSortOrder = useMemo(() => {
    const maxOrder = sentences.reduce((max, item) => Math.max(max, item.sort_order ?? 0), 0);
    return maxOrder + 10;
  }, [sentences]);

  const activeCount = sentences.filter((item) => item.is_active).length;

  const saveMutation = useMutation({
    mutationFn: async (payload: SentenceFormState & { id?: string }) => {
      const sentence = cleanSentence(payload.sentence);
      if (!sentence) throw new Error("Inserisci una frase.");

      const values = {
        sentence,
        is_active: payload.is_active,
        sort_order: Number(payload.sort_order) || 0,
      };

      if (payload.id) {
        const { error } = await supabase
          .from("event_closing_sentences" as any)
          .update(values)
          .eq("id", payload.id);
        if (error) throw error;
        return "Frase aggiornata";
      }

      const { error } = await supabase.from("event_closing_sentences" as any).insert(values);
      if (error) throw error;
      return "Frase creata";
    },
    onSuccess: (message) => {
      queryClient.invalidateQueries({ queryKey: ["event-closing-sentences-admin"] });
      queryClient.invalidateQueries({ queryKey: ["event-closing-sentences"] });
      toast.success(message);
      closeDialog();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("event_closing_sentences" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-closing-sentences-admin"] });
      queryClient.invalidateQueries({ queryKey: ["event-closing-sentences"] });
      toast.success("Frase eliminata");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const quickUpdateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Partial<SentenceFormState> }) => {
      const { error } = await supabase.from("event_closing_sentences" as any).update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-closing-sentences-admin"] });
      queryClient.invalidateQueries({ queryKey: ["event-closing-sentences"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const openCreate = () => {
    setEditingSentence(null);
    setFormData({ ...emptyForm, sort_order: nextSortOrder });
    setDialogOpen(true);
  };

  const openEdit = (sentence: EventClosingSentence) => {
    setEditingSentence(sentence);
    setFormData({
      sentence: sentence.sentence,
      is_active: sentence.is_active,
      sort_order: sentence.sort_order ?? nextSortOrder,
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingSentence(null);
    setFormData(emptyForm);
  };

  const handleSave = () => {
    saveMutation.mutate({ ...formData, id: editingSentence?.id });
  };

  const moveSentence = (index: number, direction: -1 | 1) => {
    const current = sentences[index];
    const target = sentences[index + direction];
    if (!current || !target) return;

    quickUpdateMutation.mutate({ id: current.id, values: { sort_order: target.sort_order } });
    quickUpdateMutation.mutate({ id: target.id, values: { sort_order: current.sort_order } });
  };

  const toggleActive = (sentence: EventClosingSentence, isActive: boolean) => {
    quickUpdateMutation.mutate({ id: sentence.id, values: { is_active: isActive } });
  };

  const handleDelete = (sentence: EventClosingSentence) => {
    if (window.confirm(`Eliminare questa frase?\n\n${sentence.sentence}`)) {
      deleteMutation.mutate(sentence.id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Frasi evento</h1>
          <p className="text-muted-foreground">
            Gestisci le frasi conclusive usate dal valore Random nella creazione evento.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Nuova frase
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Frasi totali</p>
            <p className="text-2xl font-bold">{sentences.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Attive nel random</p>
            <p className="text-2xl font-bold">{activeCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Ordine</p>
            <p className="text-2xl font-bold">Manuale</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Quote className="h-5 w-5 text-primary" />
            Database frasi conclusive
          </CardTitle>
          <CardDescription>
            Le frasi attive sono visibili in app iOS e web. Se un evento usa Random, il sistema sceglie da questo elenco.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Ordine</TableHead>
                <TableHead>Frase</TableHead>
                <TableHead className="w-28">Stato</TableHead>
                <TableHead className="w-24">Attiva</TableHead>
                <TableHead className="w-32 text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell><Skeleton className="h-5 w-10" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-96 max-w-full" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-10" /></TableCell>
                    <TableCell><Skeleton className="ml-auto h-8 w-24" /></TableCell>
                  </TableRow>
                ))
              ) : sentences.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    Nessuna frase inserita.
                  </TableCell>
                </TableRow>
              ) : (
                sentences.map((sentence, index) => (
                  <TableRow key={sentence.id}>
                    <TableCell className="font-mono text-sm">{sentence.sort_order}</TableCell>
                    <TableCell className="max-w-xl">
                      <p className="font-medium leading-relaxed">{sentence.sentence}</p>
                    </TableCell>
                    <TableCell>
                      {sentence.is_active ? (
                        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Attiva</Badge>
                      ) : (
                        <Badge variant="secondary">Disattiva</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={sentence.is_active}
                        onCheckedChange={(checked) => toggleActive(sentence, checked)}
                        disabled={quickUpdateMutation.isPending}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" disabled={index === 0} onClick={() => moveSentence(index, -1)}>
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" disabled={index === sentences.length - 1} onClick={() => moveSentence(index, 1)}>
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(sentence)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDelete(sentence)}
                        >
                          <Trash2 className="h-4 w-4" />
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

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingSentence ? "Modifica frase" : "Nuova frase"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Frase</Label>
              <Textarea
                value={formData.sentence}
                onChange={(event) => setFormData((prev) => ({ ...prev, sentence: event.target.value }))}
                placeholder="es. Porta leggerezza, al resto pensiamo noi"
                rows={4}
                maxLength={280}
              />
              <p className="text-xs text-muted-foreground">{cleanSentence(formData.sentence).length}/280 caratteri</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Ordine</Label>
                <Input
                  type="number"
                  value={formData.sort_order}
                  onChange={(event) => setFormData((prev) => ({ ...prev, sort_order: Number(event.target.value) }))}
                />
              </div>
              <div className="flex items-center gap-3 pt-7">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, is_active: checked }))}
                />
                <Label>Attiva nel random</Label>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeDialog}>Annulla</Button>
              <Button onClick={handleSave} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Salvataggio..." : "Salva"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
