import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
};

const ICONS = ["🎯", "💪", "🏔️", "⭐", "🔥", "🏆", "🎪", "🌟", "🚀", "🎉", "🏅", "💎", "🌍", "🎭", "🎿"];

const typeLabels: Record<string, string> = {
  one_time: "Una tantum",
  weekly: "Settimanale",
  monthly: "Mensile",
  progressive: "Progressiva",
  streak: "Streak",
  category: "Per categoria",
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
  const showCategoryField = form.type === "category" || !!form.category;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{form.id ? "Modifica Missione" : "Nuova Missione"}</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">Generale</TabsTrigger>
            <TabsTrigger value="rules">Regole</TabsTrigger>
            <TabsTrigger value="rewards">Ricompense</TabsTrigger>
          </TabsList>

          {/* TAB: General */}
          <TabsContent value="general" className="space-y-4 mt-4">
            {/* Icon picker */}
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
                <Label>Tipo missione</Label>
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
                <Label>Categoria (opzionale)</Label>
                <Select value={form.category || "_none"} onValueChange={(v) => setForm({ ...form, category: v === "_none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Nessuna" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Nessuna</SelectItem>
                    {categories.map((c: any) => (
                      <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Scadenza (opzionale)</Label>
              <Input
                type="datetime-local"
                value={form.expires_at}
                onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <span className="text-sm">Attiva</span>
            </div>
          </TabsContent>

          {/* TAB: Rules */}
          <TabsContent value="rules" className="space-y-4 mt-4">
            <div>
              <Label>Azione target</Label>
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
                <Label>Obiettivo (numero)</Label>
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

            <div className="flex items-center gap-2">
              <Switch
                checked={form.reset_on_failure}
                onCheckedChange={(v) => setForm({ ...form, reset_on_failure: v })}
              />
              <div>
                <span className="text-sm font-medium">Reset su fallimento</span>
                <p className="text-xs text-muted-foreground">Il progresso si azzera in caso di no-show o cancellazione tardiva</p>
              </div>
            </div>
          </TabsContent>

          {/* TAB: Rewards */}
          <TabsContent value="rewards" className="space-y-4 mt-4">
            <div>
              <Label>Punti ricompensa</Label>
              <Input
                type="number"
                min={0}
                value={form.reward_points}
                onChange={(e) => setForm({ ...form, reward_points: parseInt(e.target.value) || 0 })}
              />
            </div>

            <div>
              <Label>Tipo ricompensa aggiuntiva</Label>
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
