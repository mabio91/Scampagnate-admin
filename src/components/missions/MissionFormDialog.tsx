import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { HelpCircle, Plus, Trash2, Wand2 } from "lucide-react";
import IconPicker from "@/components/IconPicker";
import DynamicIcon from "@/components/DynamicIcon";
import {
  CONDITIONS_LOGIC_OPTIONS,
  GOAL_METRIC_OPTIONS,
  GOAL_OPERATOR_OPTIONS,
  MISSION_STATUS_OPTIONS,
  MISSION_TYPE_OPTIONS,
  MISSION_VISIBILITY_OPTIONS,
  REWARD_KIND_OPTIONS,
  RESET_POLICY_OPTIONS,
  TOOLTIP_TEXT,
  TRACKED_ACTION_OPTIONS,
  actionLabel,
  createEmptyCondition,
  createEmptyPrerequisite,
  createEmptyReward,
  rewardSummary,
  type MissionBuilderForm,
} from "./missionBuilder";

function TipLabel({ label, tipKey }: { label: string; tipKey: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Label>{label}</Label>
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <HelpCircle className="h-3.5 w-3.5 cursor-help text-muted-foreground" />
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-xs whitespace-pre-line text-xs">
            {TOOLTIP_TEXT[tipKey]}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: MissionBuilderForm;
  setForm: (form: MissionBuilderForm) => void;
  onSave: (mode?: "draft" | "publish") => void;
  isPending: boolean;
  categories: any[];
  badges: any[];
  coupons: any[];
  organizers: any[];
  existingMissions: any[];
  campaigns: any[];
  secondaryCategories: string[];
}

export default function MissionFormDialog({
  open,
  onOpenChange,
  form,
  setForm,
  onSave,
  isPending,
  categories,
  badges,
  coupons,
  organizers,
  existingMissions,
  campaigns,
  secondaryCategories,
}: Props) {
  const validationErrors: string[] = [];
  if (form.starts_at && form.ends_at && new Date(form.ends_at) <= new Date(form.starts_at)) {
    validationErrors.push("La data di fine deve essere successiva alla data di inizio.");
  }
  if (form.campaign_reward_multiplier <= 0) {
    validationErrors.push("Il moltiplicatore della campagna deve essere maggiore di zero.");
  }
  if (!form.title.trim()) validationErrors.push("Il titolo è obbligatorio.");
  if (!form.description.trim()) validationErrors.push("La descrizione è obbligatoria.");
  if (form.conditions.length === 0) validationErrors.push("Aggiungi almeno una condizione.");
  if (form.rewards.length === 0) validationErrors.push("Aggiungi almeno una ricompensa.");

  const updateCondition = (index: number, patch: Partial<MissionBuilderForm["conditions"][number]>) => {
    const next = [...form.conditions];
    next[index] = { ...next[index], ...patch };
    setForm({ ...form, conditions: next });
  };

  const updateConditionSection = (
    index: number,
    section: "event_filters" | "user_filters" | "behavior_filters" | "failure_condition",
    patch: Record<string, unknown>,
  ) => {
    const next = [...form.conditions];
    next[index] = {
      ...next[index],
      [section]: {
        ...(next[index] as any)[section],
        ...patch,
      },
    };
    setForm({ ...form, conditions: next });
  };

  const updateReward = (index: number, patch: Partial<MissionBuilderForm["rewards"][number]>) => {
    const next = [...form.rewards];
    next[index] = { ...next[index], ...patch };
    setForm({ ...form, rewards: next });
  };

  const updateRewardSection = (
    index: number,
    section: "badge_config" | "coupon_config" | "physical_config",
    patch: Record<string, unknown>,
  ) => {
    const next = [...form.rewards];
    next[index] = {
      ...next[index],
      [section]: {
        ...(next[index] as any)[section],
        ...patch,
      },
    };
    setForm({ ...form, rewards: next });
  };

  const updatePrerequisite = (index: number, patch: Partial<MissionBuilderForm["prerequisites"][number]>) => {
    const next = [...form.prerequisites];
    next[index] = { ...next[index], ...patch };
    setForm({ ...form, prerequisites: next });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto" aria-describedby="mission-form-desc">
        <DialogHeader>
          <DialogTitle>{form.id ? "Modifica missione avanzata" : "Nuova missione avanzata"}</DialogTitle>
          <DialogDescription id="mission-form-desc">
            Builder completo per missioni semplici, ricorrenti, stagionali, progressive e multi-condizione.
          </DialogDescription>
        </DialogHeader>

        {validationErrors.length > 0 && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-600">
            {validationErrors.map((error) => (
              <div key={error}>{error}</div>
            ))}
          </div>
        )}

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="general">Generale</TabsTrigger>
            <TabsTrigger value="rules">Regole</TabsTrigger>
            <TabsTrigger value="rewards">Ricompense</TabsTrigger>
            <TabsTrigger value="progression">Progressione</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="mt-4 space-y-4">
            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Identità missione</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <TipLabel label="Icona" tipKey="icon" />
                      <IconPicker value={form.icon} onChange={(icon) => setForm({ ...form, icon })} />
                    </div>
                    <div className="space-y-2">
                      <TipLabel label="Titolo" tipKey="title" />
                      <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="es. First Step" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <TipLabel label="Nome interno" tipKey="internal_name" />
                    <Input
                      value={form.internal_name}
                      onChange={(e) => setForm({ ...form, internal_name: e.target.value })}
                      placeholder="es. onboarding_first_event"
                    />
                  </div>

                  <div className="space-y-2">
                    <TipLabel label="Descrizione" tipKey="description" />
                    <Textarea
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="Spiega cosa deve fare l’utente per completare la missione."
                      rows={4}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Pubblicazione</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <TipLabel label="Stato" tipKey="status" />
                      <Select value={form.status} onValueChange={(status) => setForm({ ...form, status: status as any })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {MISSION_STATUS_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <TipLabel label="Visibilità" tipKey="visibility" />
                      <Select value={form.visibility} onValueChange={(visibility) => setForm({ ...form, visibility: visibility as any })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {MISSION_VISIBILITY_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <TipLabel label="Tipo missione" tipKey="type" />
                      <Select value={form.type} onValueChange={(type) => setForm({ ...form, type: type as any })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {MISSION_TYPE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Timezone missione</Label>
                      <Input value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} placeholder="Europe/Rome" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Aspetto missione</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <TipLabel label="Colore icona" tipKey="icon_color" />
                    <Input value={form.icon_color} onChange={(e) => setForm({ ...form, icon_color: e.target.value })} placeholder="#16a34a" />
                  </div>
                  <div className="space-y-2">
                    <TipLabel label="Sfondo icona" tipKey="icon_background" />
                    <Input value={form.icon_background} onChange={(e) => setForm({ ...form, icon_background: e.target.value })} placeholder="#dcfce7" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <TipLabel label="Banner missione" tipKey="banner_url" />
                    <Input value={form.banner_url} onChange={(e) => setForm({ ...form, banner_url: e.target.value })} placeholder="https://..." />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Tema campagna</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <TipLabel label="Icona campagna" tipKey="campaign_icon" />
                    <IconPicker value={form.campaign_icon} onChange={(campaign_icon) => setForm({ ...form, campaign_icon })} />
                  </div>
                  <div className="space-y-2">
                    <TipLabel label="Colore campagna" tipKey="campaign_color" />
                    <Input value={form.campaign_color} onChange={(e) => setForm({ ...form, campaign_color: e.target.value })} placeholder="#0f766e" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <TipLabel label="Descrizione campagna" tipKey="campaign_description" />
                    <Textarea
                      value={form.campaign_description}
                      onChange={(e) => setForm({ ...form, campaign_description: e.target.value })}
                      placeholder="Descrizione opzionale della campagna o stagione."
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <TipLabel label="Banner campagna" tipKey="campaign_banner_url" />
                    <Input value={form.campaign_banner_url} onChange={(e) => setForm({ ...form, campaign_banner_url: e.target.value })} placeholder="https://..." />
                  </div>
                  <div className="space-y-2">
                    <TipLabel label="Moltiplicatore reward" tipKey="campaign_reward_multiplier" />
                    <Input
                      type="number"
                      min={0.1}
                      step={0.1}
                      value={form.campaign_reward_multiplier}
                      onChange={(e) => setForm({ ...form, campaign_reward_multiplier: Number(e.target.value) || 1 })}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Scheduling & priorità</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-2">
                  <TipLabel label="Data inizio" tipKey="starts_at" />
                  <Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <TipLabel label="Data fine" tipKey="ends_at" />
                  <Input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Sort order</Label>
                  <Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="space-y-2">
                  <TipLabel label="Campagna" tipKey="campaign" />
                  <Input value={form.campaign_tag} onChange={(e) => setForm({ ...form, campaign_tag: e.target.value })} placeholder="es. Spring Challenge" />
                </div>
                <div className="space-y-2">
                  <Label>Mission group</Label>
                  <Input value={form.mission_group} onChange={(e) => setForm({ ...form, mission_group: e.target.value })} placeholder="es. Explorer Chain" />
                </div>
                <div className="space-y-2">
                  <Label>Campagna esistente</Label>
                  <Select value={form.campaign_id || "_none"} onValueChange={(value) => setForm({ ...form, campaign_id: value === "_none" ? "" : value })}>
                    <SelectTrigger><SelectValue placeholder="Nessuna" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Nessuna</SelectItem>
                      {campaigns.map((campaign: any) => (
                        <SelectItem key={campaign.id} value={campaign.id}>{campaign.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <TipLabel label="Numero massimo completamenti" tipKey="max_completions" />
                  <Input
                    type="number"
                    min={1}
                    value={form.max_completions_per_user ?? ""}
                    onChange={(e) => setForm({ ...form, max_completions_per_user: e.target.value ? parseInt(e.target.value) || null : null })}
                    placeholder="Vuoto = senza limite"
                  />
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <TipLabel label="Missione in evidenza" tipKey="featured" />
                  <p className="text-xs text-muted-foreground">Mostrala in primo piano nell’app.</p>
                </div>
                <Switch checked={form.featured} onCheckedChange={(featured) => setForm({ ...form, featured })} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <TipLabel label="Ripetibile" tipKey="repeatable" />
                  <p className="text-xs text-muted-foreground">Consente più completamenti per utente.</p>
                </div>
                <Switch checked={form.repeatable} onCheckedChange={(repeatable) => setForm({ ...form, repeatable })} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label>Completamento manuale admin</Label>
                  <p className="text-xs text-muted-foreground">Abilita la chiusura manuale per missioni speciali.</p>
                </div>
                <Switch
                  checked={form.manual_completion_enabled}
                  onCheckedChange={(manual_completion_enabled) => setForm({ ...form, manual_completion_enabled })}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <TipLabel label="Campagna attiva" tipKey="campaign_is_active" />
                  <p className="text-xs text-muted-foreground">Puoi sospendere la campagna senza eliminare le missioni collegate.</p>
                </div>
                <Switch checked={form.campaign_is_active} onCheckedChange={(campaign_is_active) => setForm({ ...form, campaign_is_active })} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="rules" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Logica condizioni</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <TipLabel label="Logica condizioni" tipKey="conditions_logic" />
                  <Select value={form.conditions_logic} onValueChange={(value) => setForm({ ...form, conditions_logic: value as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CONDITIONS_LOGIC_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end justify-end">
                  <Button type="button" variant="outline" className="gap-2" onClick={() => setForm({ ...form, conditions: [...form.conditions, createEmptyCondition()] })}>
                    <Plus className="h-4 w-4" /> Aggiungi condizione
                  </Button>
                </div>
              </CardContent>
            </Card>

            {form.conditions.map((condition, index) => (
              <Card key={condition.id}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base">Condizione {index + 1}</CardTitle>
                  {form.conditions.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => setForm({ ...form, conditions: form.conditions.filter((item) => item.id !== condition.id) })}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="space-y-2 xl:col-span-2">
                      <Label>Nome condizione</Label>
                      <Input value={condition.title} onChange={(e) => updateCondition(index, { title: e.target.value })} placeholder="es. Trekking medi senza cancellazioni" />
                    </div>
                    <div className="space-y-2">
                      <TipLabel label="Azione target" tipKey="target_action" />
                      <Select value={condition.target_action} onValueChange={(value) => updateCondition(index, { target_action: value as any })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {TRACKED_ACTION_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <TipLabel label="Tipo di conteggio" tipKey="counting_type" />
                      <Select value={condition.goal_metric} onValueChange={(value) => updateCondition(index, { goal_metric: value as any })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {GOAL_METRIC_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-4">
                    <div className="space-y-2">
                      <TipLabel label="Goal" tipKey="goal" />
                      <Input type="number" min={1} value={condition.goal_value} onChange={(e) => updateCondition(index, { goal_value: parseInt(e.target.value) || 1 })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Operatore</Label>
                      <Select value={condition.goal_operator} onValueChange={(value) => updateCondition(index, { goal_operator: value as any })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {GOAL_OPERATOR_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Periodo</Label>
                      <Select value={condition.period_unit || "_none"} onValueChange={(value) => updateCondition(index, { period_unit: value === "_none" ? "" : value as any })}>
                        <SelectTrigger><SelectValue placeholder="Nessuno" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">Nessuno</SelectItem>
                          <SelectItem value="days">Giorni</SelectItem>
                          <SelectItem value="weeks">Settimane</SelectItem>
                          <SelectItem value="months">Mesi</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Valore periodo</Label>
                      <Input
                        type="number"
                        min={1}
                        value={condition.period_value ?? ""}
                        onChange={(e) => updateCondition(index, { period_value: e.target.value ? parseInt(e.target.value) || null : null })}
                        placeholder="es. 30"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-3">
                    <div className="rounded-lg border p-3">
                      <div className="mb-3 flex items-center justify-between">
                        <TipLabel label="Filtri evento" tipKey="event_filters" />
                        <Badge variant="outline">
                          {condition.event_filters.category_ids.length + condition.event_filters.secondary_category_names.length} categorie
                        </Badge>
                      </div>
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-2">
                            <Label className="text-xs">Difficoltà minima</Label>
                            <Input value={condition.event_filters.difficulty_min} onChange={(e) => updateConditionSection(index, "event_filters", { difficulty_min: e.target.value })} placeholder="es. 3" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Tipo prezzo</Label>
                            <Select value={condition.event_filters.price_type} onValueChange={(value) => updateConditionSection(index, "event_filters", { price_type: value })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="any">Qualsiasi</SelectItem>
                                <SelectItem value="free">Solo gratis</SelectItem>
                                <SelectItem value="paid">Solo a pagamento</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Input type="number" min={0} value={condition.event_filters.price_min ?? ""} onChange={(e) => updateConditionSection(index, "event_filters", { price_min: e.target.value ? Number(e.target.value) : null })} placeholder="Prezzo min" />
                          <Input type="number" min={0} value={condition.event_filters.price_max ?? ""} onChange={(e) => updateConditionSection(index, "event_filters", { price_max: e.target.value ? Number(e.target.value) : null })} placeholder="Prezzo max" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            value={condition.event_filters.event_type}
                            onChange={(e) => updateConditionSection(index, "event_filters", { event_type: e.target.value })}
                            placeholder="Tipo evento"
                          />
                          <div className="space-y-2">
                            <Label className="text-xs">Categoria principale</Label>
                            <div className="max-h-28 space-y-2 overflow-y-auto rounded-md border p-2">
                              {categories.map((category: any) => (
                                <label key={category.id} className="flex items-center gap-2 text-sm">
                                  <Checkbox
                                    checked={condition.event_filters.category_ids.includes(category.id)}
                                    onCheckedChange={(checked) => {
                                      const next = checked
                                        ? [...condition.event_filters.category_ids, category.id]
                                        : condition.event_filters.category_ids.filter((item) => item !== category.id);
                                      updateConditionSection(index, "event_filters", { category_ids: next });
                                    }}
                                  />
                                  {category.name}
                                </label>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <TipLabel label="Categoria secondaria" tipKey="secondary_category_filter" />
                          <div className="max-h-28 space-y-2 overflow-y-auto rounded-md border p-2">
                            {secondaryCategories.length === 0 && (
                              <p className="text-xs text-muted-foreground">Tutte le categorie secondarie</p>
                            )}
                            {secondaryCategories.map((category) => (
                              <label key={category} className="flex items-center gap-2 text-sm">
                                <Checkbox
                                  checked={condition.event_filters.secondary_category_names.includes(category)}
                                  onCheckedChange={(checked) => {
                                    const next = checked
                                      ? [...condition.event_filters.secondary_category_names, category]
                                      : condition.event_filters.secondary_category_names.filter((item) => item !== category);
                                    updateConditionSection(index, "event_filters", { secondary_category_names: next });
                                  }}
                                />
                                {category}
                              </label>
                            ))}
                          </div>
                          <p className="text-[11px] leading-relaxed text-muted-foreground">
                            Usa questo filtro per creare missioni su tipologie specifiche di evento, ad esempio trekking notturni, cammini o degustazioni.
                          </p>
                          {condition.event_filters.secondary_category_names.length === 0 && (
                            <p className="text-[11px] text-muted-foreground">Tutte le categorie secondarie</p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Organizzatori</Label>
                          <div className="max-h-24 space-y-2 overflow-y-auto rounded-md border p-2">
                            {organizers.map((organizer: any) => (
                              <label key={organizer.id} className="flex items-center gap-2 text-sm">
                                <Checkbox
                                  checked={condition.event_filters.organizer_ids.includes(organizer.id)}
                                  onCheckedChange={(checked) => {
                                    const next = checked
                                      ? [...condition.event_filters.organizer_ids, organizer.id]
                                      : condition.event_filters.organizer_ids.filter((item) => item !== organizer.id);
                                    updateConditionSection(index, "event_filters", { organizer_ids: next });
                                  }}
                                />
                                {organizer.name}
                              </label>
                            ))}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Input value={condition.event_filters.location_query} onChange={(e) => updateConditionSection(index, "event_filters", { location_query: e.target.value })} placeholder="Città / area" />
                          <Input value={condition.event_filters.campaign_tag} onChange={(e) => updateConditionSection(index, "event_filters", { campaign_tag: e.target.value })} placeholder="Campaign tag" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Input type="date" value={condition.event_filters.starts_at} onChange={(e) => updateConditionSection(index, "event_filters", { starts_at: e.target.value })} />
                          <Input type="date" value={condition.event_filters.ends_at} onChange={(e) => updateConditionSection(index, "event_filters", { ends_at: e.target.value })} />
                        </div>
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox checked={condition.event_filters.require_waitlist} onCheckedChange={(checked) => updateConditionSection(index, "event_filters", { require_waitlist: !!checked })} />
                          Evento con waitlist
                        </label>
                      </div>
                    </div>

                    <div className="rounded-lg border p-3">
                      <div className="mb-3 flex items-center justify-between">
                        <TipLabel label="Filtri utente" tipKey="user_filters" />
                        <Badge variant="outline">Audience</Badge>
                      </div>
                      <div className="space-y-3">
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox checked={condition.user_filters.new_users_only} onCheckedChange={(checked) => updateConditionSection(index, "user_filters", { new_users_only: !!checked })} />
                          Solo nuovi utenti
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox checked={condition.user_filters.members_only} onCheckedChange={(checked) => updateConditionSection(index, "user_filters", { members_only: !!checked, non_members_only: checked ? false : condition.user_filters.non_members_only })} />
                          Solo membri
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox checked={condition.user_filters.non_members_only} onCheckedChange={(checked) => updateConditionSection(index, "user_filters", { non_members_only: !!checked, members_only: checked ? false : condition.user_filters.members_only })} />
                          Solo non membri
                        </label>
                        <Input
                          type="number"
                          min={1}
                          value={condition.user_filters.min_level ?? ""}
                          onChange={(e) => updateConditionSection(index, "user_filters", { min_level: e.target.value ? parseInt(e.target.value) || null : null })}
                          placeholder="Livello utente minimo"
                        />
                        <Input
                          type="date"
                          value={condition.user_filters.joined_after}
                          onChange={(e) => updateConditionSection(index, "user_filters", { joined_after: e.target.value })}
                        />
                        <Input
                          type="number"
                          min={1}
                          value={condition.user_filters.joined_within_days_from_signup ?? ""}
                          onChange={(e) => updateConditionSection(index, "user_filters", { joined_within_days_from_signup: e.target.value ? parseInt(e.target.value) || null : null })}
                          placeholder="Entro X giorni dalla registrazione"
                        />
                        <div className="space-y-2">
                          <Label className="text-xs">Badge richiesti</Label>
                          <div className="max-h-24 space-y-2 overflow-y-auto rounded-md border p-2">
                            {badges.map((badge: any) => (
                              <label key={badge.id} className="flex items-center gap-2 text-sm">
                                <Checkbox
                                  checked={condition.user_filters.required_badge_ids.includes(badge.id)}
                                  onCheckedChange={(checked) => {
                                    const next = checked
                                      ? [...condition.user_filters.required_badge_ids, badge.id]
                                      : condition.user_filters.required_badge_ids.filter((item) => item !== badge.id);
                                    updateConditionSection(index, "user_filters", { required_badge_ids: next });
                                  }}
                                />
                                {badge.icon} {badge.name}
                              </label>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Missioni prerequisito utente</Label>
                          <div className="max-h-24 space-y-2 overflow-y-auto rounded-md border p-2">
                            {existingMissions.filter((mission) => mission.id !== form.id).map((mission) => (
                              <label key={mission.id} className="flex items-center gap-2 text-sm">
                                <Checkbox
                                  checked={condition.user_filters.required_mission_ids.includes(mission.id)}
                                  onCheckedChange={(checked) => {
                                    const next = checked
                                      ? [...condition.user_filters.required_mission_ids, mission.id]
                                      : condition.user_filters.required_mission_ids.filter((item) => item !== mission.id);
                                    updateConditionSection(index, "user_filters", { required_mission_ids: next });
                                  }}
                                />
                                {mission.title}
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border p-3">
                      <div className="mb-3 flex items-center justify-between">
                        <TipLabel label="Filtri comportamento" tipKey="behavior_filters" />
                        <Badge variant="outline">Comportamento</Badge>
                      </div>
                      <div className="space-y-3">
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox checked={condition.behavior_filters.no_cancellation} onCheckedChange={(checked) => updateConditionSection(index, "behavior_filters", { no_cancellation: !!checked })} />
                          Nessuna cancellazione
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox checked={condition.behavior_filters.no_late_cancellation} onCheckedChange={(checked) => updateConditionSection(index, "behavior_filters", { no_late_cancellation: !!checked })} />
                          Nessuna cancellazione tardiva
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox checked={condition.behavior_filters.no_no_show} onCheckedChange={(checked) => updateConditionSection(index, "behavior_filters", { no_no_show: !!checked })} />
                          Nessun no-show
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox checked={condition.behavior_filters.paid_successfully} onCheckedChange={(checked) => updateConditionSection(index, "behavior_filters", { paid_successfully: !!checked })} />
                          Pagamento riuscito
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox checked={condition.behavior_filters.checked_in} onCheckedChange={(checked) => updateConditionSection(index, "behavior_filters", { checked_in: !!checked })} />
                          Check-in richiesto
                        </label>
                        <Input
                          type="number"
                          min={1}
                          value={condition.behavior_filters.attended_within_days_from_signup ?? ""}
                          onChange={(e) => updateConditionSection(index, "behavior_filters", { attended_within_days_from_signup: e.target.value ? parseInt(e.target.value) || null : null })}
                          placeholder="Evento entro X giorni dal signup"
                        />
                        <Separator />
                        <div className="space-y-2">
                          <TipLabel label="Condizione fallimento" tipKey="failure_condition" />
                          <Select value={condition.failure_condition.type || "_none"} onValueChange={(value) => updateConditionSection(index, "failure_condition", { type: value === "_none" ? "" : value })}>
                            <SelectTrigger><SelectValue placeholder="Nessuna" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="_none">Nessuna</SelectItem>
                              <SelectItem value="late_cancellation">Late cancellation</SelectItem>
                              <SelectItem value="no_show">No-show</SelectItem>
                              <SelectItem value="refund_request">Richiesta rimborso</SelectItem>
                              <SelectItem value="cancellation_after_confirmation">Cancellazione dopo conferma</SelectItem>
                              <SelectItem value="inactivity_days">Inattività per X giorni</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {condition.failure_condition.type === "inactivity_days" && (
                          <Input
                            type="number"
                            min={1}
                            value={condition.failure_condition.inactivity_days ?? ""}
                            onChange={(e) => updateConditionSection(index, "failure_condition", { inactivity_days: e.target.value ? parseInt(e.target.value) || null : null })}
                            placeholder="Giorni di inattività"
                          />
                        )}
                        <div className="space-y-2">
                          <TipLabel label="Reset su fallimento" tipKey="reset_on_failure" />
                          <Select value={condition.reset_policy} onValueChange={(value) => updateCondition(index, { reset_policy: value as any })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {RESET_POLICY_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox checked={condition.push_notifications} onCheckedChange={(checked) => updateCondition(index, { push_notifications: !!checked })} />
                          Notifiche push per questa condizione
                        </label>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="rewards" className="mt-4 space-y-4">
            <div className="flex justify-end">
              <Button type="button" variant="outline" className="gap-2" onClick={() => setForm({ ...form, rewards: [...form.rewards, createEmptyReward()] })}>
                <Plus className="h-4 w-4" /> Aggiungi reward
              </Button>
            </div>

            {form.rewards.map((reward, index) => (
              <Card key={reward.id}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base">Reward {index + 1}</CardTitle>
                  {form.rewards.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => setForm({ ...form, rewards: form.rewards.filter((item) => item.id !== reward.id) })}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <TipLabel label="Tipo ricompensa" tipKey="reward_type" />
                      <Select value={reward.kind} onValueChange={(value) => updateReward(index, { kind: value as any })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {REWARD_KIND_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Titolo reward</Label>
                      <Input value={reward.title} onChange={(e) => updateReward(index, { title: e.target.value })} placeholder="es. Badge Explorer" />
                    </div>
                  </div>

                  {reward.kind === "points" && (
                    <div className="space-y-2">
                      <TipLabel label="Punti ricompensa" tipKey="reward_points" />
                      <Input type="number" min={0} value={reward.points_value ?? 0} onChange={(e) => updateReward(index, { points_value: parseInt(e.target.value) || 0 })} />
                    </div>
                  )}

                  {reward.kind === "badge" && (
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="space-y-3 rounded-lg border p-3">
                        <TipLabel label="Badge" tipKey="badge" />
                        <Select value={reward.badge_id || "_none"} onValueChange={(value) => updateReward(index, { badge_id: value === "_none" ? "" : value })}>
                          <SelectTrigger><SelectValue placeholder="Seleziona badge esistente" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">Nessun badge esistente</SelectItem>
                            {badges.map((badge: any) => (
                              <SelectItem key={badge.id} value={badge.id}>{badge.icon} {badge.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox checked={reward.badge_config.create_inline} onCheckedChange={(checked) => updateRewardSection(index, "badge_config", { create_inline: !!checked })} />
                          Crea badge inline
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox checked={reward.visible_on_profile} onCheckedChange={(checked) => updateReward(index, { visible_on_profile: !!checked })} />
                          Visibile sul profilo utente
                        </label>
                      </div>

                      {reward.badge_config.create_inline && (
                        <div className="space-y-3 rounded-lg border p-3">
                          <div className="grid gap-3 md:grid-cols-2">
                            <Input value={reward.badge_config.name} onChange={(e) => updateRewardSection(index, "badge_config", { name: e.target.value })} placeholder="Nome badge" />
                            <IconPicker value={reward.badge_config.icon} onChange={(icon) => updateRewardSection(index, "badge_config", { icon })} />
                            <Input value={reward.badge_config.rarity} onChange={(e) => updateRewardSection(index, "badge_config", { rarity: e.target.value })} placeholder="Rarity" />
                            <Input value={reward.badge_config.tier} onChange={(e) => updateRewardSection(index, "badge_config", { tier: e.target.value })} placeholder="Tier" />
                            <Input value={reward.badge_config.color} onChange={(e) => updateRewardSection(index, "badge_config", { color: e.target.value })} placeholder="#22c55e" />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {reward.kind === "coupon" && (
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="space-y-3 rounded-lg border p-3">
                        <TipLabel label="Coupon" tipKey="coupon" />
                        <Select value={reward.coupon_config.source_discount_code_id || "_none"} onValueChange={(value) => updateRewardSection(index, "coupon_config", { source_discount_code_id: value === "_none" ? "" : value })}>
                          <SelectTrigger><SelectValue placeholder="Coupon esistente" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">Nessun coupon esistente</SelectItem>
                            {coupons.map((coupon: any) => (
                              <SelectItem key={coupon.id} value={coupon.id}>{coupon.code}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox checked={reward.coupon_config.auto_generate} onCheckedChange={(checked) => updateRewardSection(index, "coupon_config", { auto_generate: !!checked })} />
                          Auto-genera coupon personale
                        </label>
                        <Input value={reward.coupon_config.code_prefix} onChange={(e) => updateRewardSection(index, "coupon_config", { code_prefix: e.target.value })} placeholder="Prefisso codice" />
                      </div>
                      <div className="space-y-3 rounded-lg border p-3">
                        <div className="grid gap-3 md:grid-cols-2">
                          <Select value={reward.coupon_config.discount_type} onValueChange={(value) => updateRewardSection(index, "coupon_config", { discount_type: value })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="percentage">Percentuale</SelectItem>
                              <SelectItem value="fixed_amount">Importo fisso</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input type="number" min={0} value={reward.coupon_config.discount_value ?? ""} onChange={(e) => updateRewardSection(index, "coupon_config", { discount_value: e.target.value ? Number(e.target.value) : null })} placeholder="Valore sconto" />
                          <Input type="number" min={1} value={reward.coupon_config.validity_days ?? ""} onChange={(e) => updateRewardSection(index, "coupon_config", { validity_days: e.target.value ? parseInt(e.target.value) || null : null })} placeholder="Validità giorni" />
                          <Input type="number" min={1} value={reward.coupon_config.usage_limit ?? ""} onChange={(e) => updateRewardSection(index, "coupon_config", { usage_limit: e.target.value ? parseInt(e.target.value) || null : null })} placeholder="Limite utilizzi" />
                        </div>
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox checked={reward.coupon_config.is_stackable} onCheckedChange={(checked) => updateRewardSection(index, "coupon_config", { is_stackable: !!checked })} />
                          Coupon cumulabile
                        </label>
                      </div>
                    </div>
                  )}

                  {reward.kind === "physical" && (
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="space-y-2">
                        <TipLabel label="Ricompensa fisica" tipKey="physical" />
                        <Input value={reward.physical_config.reward_name} onChange={(e) => updateRewardSection(index, "physical_config", { reward_name: e.target.value })} placeholder="es. T-shirt limited edition" />
                      </div>
                      <div className="space-y-2">
                        <Label>Stock disponibile</Label>
                        <Input type="number" min={0} value={reward.physical_config.stock_quantity ?? ""} onChange={(e) => updateRewardSection(index, "physical_config", { stock_quantity: e.target.value ? parseInt(e.target.value) || null : null })} />
                      </div>
                      <div className="space-y-2 lg:col-span-2">
                        <Label>Istruzioni di riscatto</Label>
                        <Textarea value={reward.physical_config.claim_instructions} onChange={(e) => updateRewardSection(index, "physical_config", { claim_instructions: e.target.value })} rows={3} />
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Checkbox checked={reward.physical_config.manual_validation_required} onCheckedChange={(checked) => updateRewardSection(index, "physical_config", { manual_validation_required: !!checked })} />
                        <TipLabel label="Approvazione manuale" tipKey="manual_approval" />
                      </div>
                    </div>
                  )}

                  {reward.kind !== "points" && (
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox checked={reward.approval_required} onCheckedChange={(checked) => updateReward(index, { approval_required: !!checked })} />
                      Reward richiede validazione admin
                    </label>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="progression" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Progressiva, streak e prerequisiti</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <TipLabel label="Livello" tipKey="level" />
                      <Input type="number" min={1} value={form.level ?? ""} onChange={(e) => setForm({ ...form, level: e.target.value ? parseInt(e.target.value) || null : null })} placeholder="es. 1" />
                    </div>
                    <div className="space-y-2">
                      <TipLabel label="Streak richiesta" tipKey="streak_requirement" />
                      <Input type="number" min={1} value={form.streak_requirement ?? ""} onChange={(e) => setForm({ ...form, streak_requirement: e.target.value ? parseInt(e.target.value) || null : null })} placeholder="es. 4" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <TipLabel label="Reset streak" tipKey="streak_reset" />
                    <Select value={form.streak_reset_rule} onValueChange={(value) => setForm({ ...form, streak_reset_rule: value as any })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {RESET_POLICY_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-4 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <TipLabel label="Missioni prerequisito" tipKey="prerequisite" />
                    <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => setForm({ ...form, prerequisites: [...form.prerequisites, createEmptyPrerequisite()] })}>
                      <Plus className="h-3.5 w-3.5" /> Aggiungi
                    </Button>
                  </div>
                  {form.prerequisites.length === 0 && <p className="text-sm text-muted-foreground">Nessun prerequisito configurato.</p>}
                  {form.prerequisites.map((prerequisite, index) => (
                    <div key={prerequisite.id} className="space-y-3 rounded-md border p-3">
                      <div className="flex justify-end">
                        <Button type="button" variant="ghost" size="icon" onClick={() => setForm({ ...form, prerequisites: form.prerequisites.filter((item) => item.id !== prerequisite.id) })}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                      <Select value={prerequisite.prerequisite_mission_id || "_none"} onValueChange={(value) => updatePrerequisite(index, { prerequisite_mission_id: value === "_none" ? "" : value })}>
                        <SelectTrigger><SelectValue placeholder="Seleziona missione" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">Nessuna</SelectItem>
                          {existingMissions.filter((mission) => mission.id !== form.id).map((mission) => (
                            <SelectItem key={mission.id} value={mission.id}>{mission.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="grid grid-cols-2 gap-3">
                        <Select value={prerequisite.requirement_type} onValueChange={(value) => updatePrerequisite(index, { requirement_type: value as any })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="completion">Richiede completamento</SelectItem>
                            <SelectItem value="unlock">Richiede sblocco</SelectItem>
                          </SelectContent>
                        </Select>
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox checked={prerequisite.auto_archive_previous} onCheckedChange={(checked) => updatePrerequisite(index, { auto_archive_previous: !!checked })} />
                          Archivia livello precedente
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="preview" className="mt-4">
            <Card className="border-primary/20 bg-gradient-to-br from-background via-background to-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-xl">
                  <div
                    className="rounded-2xl border border-primary/20 p-3"
                    style={{
                      background: form.icon_background || undefined,
                      color: form.icon_color || undefined,
                    }}
                  >
                    <DynamicIcon value={form.icon} size={24} className={form.icon_color ? "text-current" : ""} />
                  </div>
                  <div>
                    <div>{form.title || "Titolo missione"}</div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <Badge variant="outline">{form.status}</Badge>
                      <Badge variant="secondary">{form.visibility}</Badge>
                      <Badge>{form.type}</Badge>
                      {form.featured && <Badge variant="outline">Featured</Badge>}
                    </div>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
                <div className="space-y-4">
                  {form.banner_url && (
                    <div className="overflow-hidden rounded-lg border">
                      <img src={form.banner_url} alt="Mission banner preview" className="h-32 w-full object-cover" />
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">{form.description || "Descrizione missione in anteprima."}</p>
                  <div className="rounded-lg border p-4">
                    <div className="mb-2 text-sm font-medium">Come si completa</div>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      {form.conditions.map((condition) => (
                        <div key={condition.id} className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-primary" />
                          <span>
                            {actionLabel(condition.target_action)} · {condition.goal_value} · {condition.goal_metric}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="rounded-lg border p-4">
                    <div className="text-sm font-medium">Reward preview</div>
                    <div className="mt-2 text-sm text-muted-foreground">{rewardSummary(form.rewards.map((reward) => ({ reward_kind: reward.kind, points_value: reward.points_value })))}</div>
                  </div>
                  <div className="rounded-lg border p-4">
                    <div className="text-sm font-medium">Date</div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      <div>Inizio: {form.starts_at || "Subito"}</div>
                      <div>Fine: {form.ends_at || "Senza scadenza"}</div>
                      <div>Timezone: {form.timezone}</div>
                    </div>
                  </div>
                  <div className="rounded-lg border p-4">
                    <div className="text-sm font-medium">Locking & chain</div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      <div>{form.prerequisites.length} prerequisiti</div>
                      <div>{form.repeatable ? "Ripetibile" : "Completamento singolo"}</div>
                      <div>{form.campaign_tag || "Nessuna campagna"}</div>
                    </div>
                  </div>
                  {(form.campaign_tag || form.campaign_description || form.campaign_banner_url) && (
                    <div className="rounded-lg border p-4">
                      <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                        <DynamicIcon value={form.campaign_icon || "lucide:Sparkles"} size={16} />
                        <span>Campaign preview</span>
                      </div>
                      {form.campaign_banner_url && (
                        <img src={form.campaign_banner_url} alt="Campaign banner preview" className="mb-3 h-24 w-full rounded-md object-cover" />
                      )}
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <div>{form.campaign_tag || "Campagna senza nome"}</div>
                        <div>{form.campaign_description || "Nessuna descrizione campagna"}</div>
                        <div>Reward multiplier: {form.campaign_reward_multiplier}x</div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
            <Button variant="secondary" onClick={() => onSave("draft")} disabled={isPending} className="gap-2">
              <Wand2 className="h-4 w-4" /> Salva bozza
            </Button>
          </div>
          <Button onClick={() => onSave("publish")} disabled={isPending || validationErrors.length > 0}>
            {isPending ? "Salvataggio..." : "Salva missione"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
