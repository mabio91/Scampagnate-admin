import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { HelpCircle } from "lucide-react";

export interface MissionForm {
  id?: string;
  title: string;
  description: string;
  icon: string;
  type: string;
  target_action: string;
  target_value: number;
  streak_count: number | null;
  reset_on_failure: boolean;
  reward_points: number;
  reward_type: string;
  reward_value: string;
  reward_badge_id: string;
  is_active: boolean;
  category: string;
  expires_at: string;
  starts_at: string;
  max_completions_per_user: number | null;
  notify_on_progress: boolean;
  auto_generate_coupon: boolean;
  category_filter: string[];
}

export const emptyForm: MissionForm = {
  title: "",
  description: "",
  icon: "🎯",
  type: "one_time",
  target_action: "event_attended",
  target_value: 1,
  streak_count: null,
  reset_on_failure: false,
  reward_points: 10,
  reward_type: "points",
  reward_value: "",
  reward_badge_id: "",
  is_active: true,
  category: "",
  expires_at: "",
  starts_at: "",
  max_completions_per_user: null,
  notify_on_progress: false,
  auto_generate_coupon: false,
  category_filter: [],
};

const ICONS = ["🎯", "💪", "🏔️", "⭐", "🔥", "🏆", "🎪", "🌟", "🚀", "🎉", "🏅", "💎", "🌍", "🎭", "🎿"];

const typeLabels: Record<string, string> = {
  one_time: "Una tantum",
  weekly: "Settimanale",
  monthly: "Mensile",
  progressive: "Progressiva",
  streak: "Streak",
};

const targetActionLabels: Record<string, string> = {
  event_attended: "Evento partecipato",
  event_registered: "Iscrizione evento",
  category_attended: "Categoria partecipata",
  streak: "Streak partecipazione",
};

const rewardTypeLabels: Record<string, string> = {
  points: "Solo punti",
  coupon: "Coupon sconto",
  badge: "Badge",
  physical: "Ricompensa fisica",
};

const tooltips: Record<string, string> = {
  type: "Definisce come funziona la missione nel tempo e quando si resetta:\n\n• Una tantum → si completa una sola volta, senza reset\n• Settimanale → si azzera ogni settimana (lunedì)\n• Mensile → si azzera ogni mese\n• Progressiva → accumuli progresso nel tempo fino al completamento\n• Streak → devi completarla per più periodi consecutivi (es. 3 settimane di fila)",
  target_action: "Definisce quale azione dell'utente viene conteggiata per la missione:\n\n• Evento partecipato → conta quando l'utente è presente (check-in)\n• Iscrizione evento → conta quando l'utente si iscrive\n• Categoria partecipata → conta eventi in una o più categorie specifiche\n• Streak partecipazione → conta la continuità di partecipazione nel tempo",
  target_value: "Numero di azioni che l'utente deve completare per terminare la missione.",
  category_filter: "Limita la missione a una o più categorie di eventi (es. Trekking, Sport).\nSe non selezioni nulla, tutti gli eventi saranno considerati validi.",
  reset_on_failure: "Se attivo, il progresso si azzera in caso di assenza all'evento o cancellazione tardiva.\nPer le missioni streak, interrompe la sequenza.",
  starts_at: "La missione sarà disponibile solo a partire da questa data.",
  expires_at: "Dopo questa data la missione non sarà più disponibile.",
  reward_points: "Punti assegnati all'utente al completamento della missione.",
  reward_type: "Premio extra oltre ai punti (es. badge, sconto o premio fisico).",
  max_completions: "Limita quante volte un utente può completare questa missione.\nSe impostato → la missione è completabile solo un numero limitato di volte.\nSe vuoto → la missione è ripetibile senza limiti.",
  notify: "Invia notifiche push quando l'utente è vicino al completamento e quando completa la missione.",
  auto_coupon: "Genera automaticamente un coupon al completamento della missione.\nIl coupon sarà personale, può avere scadenza e limite di utilizzo, e sarà visibile nel profilo utente.",
};

function TipLabel({ label, tipKey }: { label: string; tipKey: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Label>{label}</Label>
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-xs whitespace-pre-line text-xs">
            {tooltips[tipKey]}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: MissionForm;
  setForm: (form: MissionForm) => void;
  onSave: () => void;
  isPending: boolean;
  categories: any[];
  badges: any[];
}

export default function MissionFormDialog({ open, onOpenChange, form, setForm, onSave, isPending, categories, badges }: Props) {
  const showStreakFields = form.type === "streak";

  const toggleCategory = (catName: string) => {
    const current = form.category_filter || [];
    if (current.includes(catName)) {
      setForm({ ...form, category_filter: current.filter(c => c !== catName) });
    } else {
      setForm({ ...form, category_filter: [...current, catName] });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby="mission-form-desc">
        <DialogHeader>
          <DialogTitle>{form.id ? "Modifica Missione" : "Nuova Missione"}</DialogTitle>
          <DialogDescription id="mission-form-desc">
            Configura i dettagli, le regole e le ricompense della missione.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">Generale</TabsTrigger>
            <TabsTrigger value="rules">Regole</TabsTrigger>
            <TabsTrigger value="rewards">Ricompense</TabsTrigger>
          </TabsList>

          {/* TAB: General */}
          <TabsContent value="general" className="space-y-4 mt-4">
            <div>
              <Label>Icona</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {ICONS.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    className={`text-2xl p-1.5 rounded-lg border-2 transition-all ${
                      form.icon === icon ? "border-primary bg-primary/10 scale-110" : "border-transparent hover:border-muted-foreground/30"
                    }`}
                    onClick={() => setForm({ ...form, icon })}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label>Titolo</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="es. Partecipa al tuo primo evento" />
            </div>

            <div>
              <Label>Descrizione</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descrivi la missione..." />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <TipLabel label="Tipo missione" tipKey="type" />
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(typeLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <TipLabel label="Categoria eventi" tipKey="category_filter" />
                <div className="mt-1 border rounded-md p-2 max-h-32 overflow-y-auto space-y-1.5">
                  {categories.length === 0 ? (
                    <span className="text-xs text-muted-foreground">Nessuna categoria disponibile</span>
                  ) : categories.map((c: any) => (
                    <div key={c.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`cat-${c.id}`}
                        checked={(form.category_filter || []).includes(c.name)}
                        onCheckedChange={() => toggleCategory(c.name)}
                      />
                      <label htmlFor={`cat-${c.id}`} className="text-sm cursor-pointer">{c.name}</label>
                    </div>
                  ))}
                </div>
                {(form.category_filter || []).length === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">Tutti gli eventi sono validi</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <TipLabel label="Data inizio" tipKey="starts_at" />
                <Input
                  type="datetime-local"
                  value={form.starts_at}
                  onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                />
              </div>
              <div>
                <TipLabel label="Data fine" tipKey="expires_at" />
                <Input
                  type="datetime-local"
                  value={form.expires_at}
                  onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <span className="text-sm">Attiva</span>
            </div>
          </TabsContent>

          {/* TAB: Rules */}
          <TabsContent value="rules" className="space-y-4 mt-4">
            <div>
              <TipLabel label="Azione target" tipKey="target_action" />
              <Select value={form.target_action} onValueChange={(v) => setForm({ ...form, target_action: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(targetActionLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <TipLabel label="Obiettivo" tipKey="target_value" />
                <Input
                  type="number"
                  min={1}
                  value={form.target_value}
                  onChange={(e) => setForm({ ...form, target_value: parseInt(e.target.value) || 1 })}
                />
              </div>
              {showStreakFields && (
                <div>
                  <Label>Durata streak (settimane)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.streak_count || ""}
                    onChange={(e) => setForm({ ...form, streak_count: parseInt(e.target.value) || null })}
                    placeholder="es. 3"
                  />
                </div>
              )}
            </div>

            <div>
              <TipLabel label="Limite completamenti per utente" tipKey="max_completions" />
              <Input
                type="number"
                min={1}
                value={form.max_completions_per_user ?? ""}
                onChange={(e) => setForm({ ...form, max_completions_per_user: e.target.value === "" ? null : parseInt(e.target.value) || null })}
                placeholder="Vuoto = illimitato"
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={form.reset_on_failure}
                onCheckedChange={(v) => setForm({ ...form, reset_on_failure: v })}
              />
              <div>
                <TipLabel label="Reset su fallimento" tipKey="reset_on_failure" />
                <p className="text-xs text-muted-foreground">Il progresso si azzera in caso di no-show o cancellazione tardiva</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={form.notify_on_progress}
                onCheckedChange={(v) => setForm({ ...form, notify_on_progress: v })}
              />
              <div>
                <TipLabel label="Notifiche push" tipKey="notify" />
                <p className="text-xs text-muted-foreground">Notifica vicino al completamento e al completamento</p>
              </div>
            </div>
          </TabsContent>

          {/* TAB: Rewards */}
          <TabsContent value="rewards" className="space-y-4 mt-4">
            <div>
              <TipLabel label="Punti ricompensa" tipKey="reward_points" />
              <Input
                type="number"
                min={0}
                value={form.reward_points}
                onChange={(e) => setForm({ ...form, reward_points: parseInt(e.target.value) || 0 })}
              />
            </div>

            <div>
              <TipLabel label="Ricompensa aggiuntiva" tipKey="reward_type" />
              <Select value={form.reward_type} onValueChange={(v) => setForm({ ...form, reward_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(rewardTypeLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.reward_type === "coupon" && (
              <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Configurazione Coupon</Label>
                <div>
                  <Label>Codice/Valore sconto</Label>
                  <Input
                    value={form.reward_value}
                    onChange={(e) => setForm({ ...form, reward_value: e.target.value })}
                    placeholder="es. SCONTO10 o -10%"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.auto_generate_coupon}
                    onCheckedChange={(v) => setForm({ ...form, auto_generate_coupon: v })}
                  />
                  <div>
                    <TipLabel label="Genera coupon automatico" tipKey="auto_coupon" />
                    <p className="text-xs text-muted-foreground">Crea un coupon personale al completamento</p>
                  </div>
                </div>
              </div>
            )}

            {form.reward_type === "badge" && (
              <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Configurazione Badge</Label>
                <div>
                  <Label>Badge da assegnare</Label>
                  <Select value={form.reward_badge_id || "_none"} onValueChange={(v) => setForm({ ...form, reward_badge_id: v === "_none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Seleziona badge" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Nessuno</SelectItem>
                      {badges.map((b: any) => (
                        <SelectItem key={b.id} value={b.id}>{b.icon} {b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {form.reward_type === "physical" && (
              <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Ricompensa Fisica</Label>
                <div>
                  <Label>Descrizione ricompensa</Label>
                  <Input
                    value={form.reward_value}
                    onChange={(e) => setForm({ ...form, reward_value: e.target.value })}
                    placeholder="es. Drink gratuito al prossimo evento"
                  />
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={onSave} disabled={!form.title || isPending}>
            {isPending ? "Salvataggio..." : "Salva"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
