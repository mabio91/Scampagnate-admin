import { useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, MoreHorizontal, Eye, Edit2, Trash2, Plus, Upload, X, ArrowUp, ArrowDown, Image as ImageIcon, Loader2, Shield, Lock, Star, Users, Award, Crown, CheckCircle2, DollarSign, Tag, Sparkles, Copy, MessageCircle, CalendarX } from "lucide-react";
import { MANUAL_BADGE_OPTIONS, EventBadgePills, computeAutoBadgesForStorage } from "@/components/EventBadges";
import RefreshButton from "@/components/RefreshButton";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { useLanguage } from "@/i18n/LanguageContext";

type Event = Tables<"events">;
type EventWithCategory = Event & { event_categories: { name: string; icon: string } | null };

const statusColors: Record<string, string> = {
  available: "text-success border-success/30 bg-success/10",
  published: "text-success border-success/30 bg-success/10",
  full: "text-warning border-warning/30 bg-warning/10",
  closed: "text-destructive border-destructive/30 bg-destructive/10",
  cancelled: "text-destructive border-destructive/30 bg-destructive/10",
  draft: "text-muted-foreground border-muted-foreground/30 bg-muted/50",
  past: "text-muted-foreground border-muted-foreground/30 bg-muted/50",
};

const visibilityColors: Record<string, string> = {
  public: "text-success border-success/30",
  private: "text-primary border-primary/30",
  hidden: "text-muted-foreground border-muted-foreground/30",
};

type PricingRule = {
  id: string;
  name: string;
  price: number;
  condition: "everyone" | "active_members" | "new_users" | "experienced_users" | "loyal_participants" | "specific_badge";
  condition_value?: string[] | null; // array of badge/level IDs for specific_badge
};

type AccessRules = {
  min_trekking_events?: number | null;
  min_activities?: number | null;
  required_badge_id?: string | null;
  require_active_membership?: boolean;
  require_manual_approval?: boolean;
  restriction_message?: string;
  exclusivity_tags?: string[];
  pricing_rules?: PricingRule[];
  detail_visibility?: "everyone" | "registered_only" | "eligible_only";
  registration_rule?: "open" | "eligible_only" | "invite_only";
  allowed_user_groups?: string[];
};

const emptyEvent = {
  title: "", description: "", location: "", date: "", time: "09:00",
  spots_total: 20, price: 0, payment_type: "free" as const,
  status: "draft" as const, visibility: "public" as const,
  organizer_name: "", organizer_id: null as string | null,
  category_id: null as string | null,
  image_url: "" as string,
  gallery_images: [] as string[],
  access_rules: null as AccessRules | null,
};
const PRICING_CONDITIONS = [
  { value: "everyone", label: "Tutti", description: "Visibile a tutti gli utenti" },
  { value: "active_members", label: "Soci attivi", description: "Utenti con tessera attiva" },
  { value: "new_users", label: "Nuovi utenti (0 eventi)", description: "Utenti che non hanno mai partecipato" },
  { value: "experienced_users", label: "Utenti esperti (1+ eventi)", description: "Utenti con almeno 1 evento" },
  { value: "loyal_participants", label: "Partecipanti fedeli (5+ eventi)", description: "Utenti con 5 o più eventi" },
  { value: "specific_badge", label: "Badge / Livello specifico", description: "Seleziona uno o più badge o livelli" },
];

const EXCLUSIVITY_TAGS = [
  { value: "limited_spots", label: "Limited spots available", icon: Users },
  { value: "exclusive", label: "Exclusive event", icon: Crown },
  { value: "members_only", label: "Members-only experience", icon: Lock },
  { value: "community_priority", label: "Community priority access", icon: Star },
];

const DETAIL_VISIBILITY_OPTIONS = [
  { value: "everyone", label: "Everyone can see details" },
  { value: "registered_only", label: "Only registered users" },
  { value: "eligible_only", label: "Only eligible users" },
];

const REGISTRATION_RULE_OPTIONS = [
  { value: "open", label: "Open to all" },
  { value: "eligible_only", label: "Only eligible users" },
  { value: "invite_only", label: "Invite only" },
];

const USER_GROUP_OPTIONS = [
  { value: "early_supporters", label: "Early Supporters" },
  { value: "active_members", label: "Active Members" },
  { value: "veteran_hikers", label: "Veteran Hikers" },
  { value: "organizers", label: "Organizers" },
];

export default function EventsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const dashboardFilter = searchParams.get("filter"); // "empty" | "pending" | null
  const [editEvent, setEditEvent] = useState<(Partial<Event> & { isNew?: boolean }) | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const queryClient = useQueryClient();

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["admin-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*, event_categories(name, icon)")
        .order("date", { ascending: false });
      if (error) throw error;
      return (data || []) as EventWithCategory[];
    },
  });

  // Fetch event IDs with pending approval registrations (for dashboard filter)
  const { data: pendingEventIds = [] } = useQuery({
    queryKey: ["admin-events-pending-approvals"],
    queryFn: async () => {
      const { data } = await supabase
        .from("event_registrations")
        .select("event_id")
        .eq("status", "pending_approval");
      if (!data) return [];
      return [...new Set(data.map(r => r.event_id))];
    },
    enabled: dashboardFilter === "pending",
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["admin-categories-list"],
    queryFn: async () => {
      const { data } = await supabase.from("event_categories").select("id, name");
      return data || [];
    },
  });

  const { data: badges = [] } = useQuery({
    queryKey: ["admin-badges-list"],
    queryFn: async () => {
      const { data } = await supabase.from("badges").select("id, name, icon");
      return data || [];
    },
  });

  const { data: communityLevels = [] } = useQuery({
    queryKey: ["admin-community-levels"],
    queryFn: async () => {
      const { data } = await supabase.from("community_levels").select("id, name, icon, level_number").order("level_number");
      return data || [];
    },
  });

  const { data: organizers = [] } = useQuery({
    queryKey: ["admin-organizers-list"],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["organizer", "admin"]);
      if (!roles || roles.length === 0) return [];
      const userIds = [...new Set(roles.map((r) => r.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", userIds);
      return (profiles || []).map((p) => ({
        id: p.id,
        name: `${p.first_name} ${p.last_name}`.trim(),
      }));
    },
  });

  const getAccessRules = (event: Partial<Event> | null): AccessRules => {
    if (!event?.access_rules) return {};
    return event.access_rules as AccessRules;
  };

  const updateAccessRules = (patch: Partial<AccessRules>) => {
    if (!editEvent) return;
    const current = getAccessRules(editEvent);
    setEditEvent({ ...editEvent, access_rules: { ...current, ...patch } });
  };

  const toggleExclusivityTag = (tag: string) => {
    const current = getAccessRules(editEvent);
    const tags = current.exclusivity_tags || [];
    const updated = tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag];
    updateAccessRules({ exclusivity_tags: updated });
  };

  const getPricingRules = (event: Partial<Event> | null): PricingRule[] => {
    const rules = getAccessRules(event);
    return rules.pricing_rules || [];
  };

  const addPricingRule = () => {
    const rules = getPricingRules(editEvent);
    const newRule: PricingRule = {
      id: crypto.randomUUID(),
      name: "",
      price: 0,
      condition: "everyone",
    };
    updateAccessRules({ pricing_rules: [...rules, newRule] });
  };

  const updatePricingRule = (id: string, patch: Partial<PricingRule>) => {
    const rules = getPricingRules(editEvent);
    updateAccessRules({ pricing_rules: rules.map(r => r.id === id ? { ...r, ...patch } : r) });
  };

  const removePricingRule = (id: string) => {
    const rules = getPricingRules(editEvent);
    updateAccessRules({ pricing_rules: rules.filter(r => r.id !== id) });
  };

  const hasAnyAccessRule = (event: Partial<Event> | null): boolean => {
    const rules = getAccessRules(event);
    return !!(
      rules.min_trekking_events ||
      rules.min_activities ||
      rules.required_badge_id ||
      rules.require_active_membership ||
      rules.require_manual_approval ||
      (rules.exclusivity_tags && rules.exclusivity_tags.length > 0)
    );
  };


  const saveMutation = useMutation({
    mutationFn: async (evt: any) => {
      const { isNew, event_categories, ...data } = evt;

      // Auto-compute founding_event badge
      const foundingBadge = badges.find((b) => b.name === "Founding Member");
      const autoBadges = computeAutoBadgesForStorage(data, foundingBadge?.id);
      const manualBadges = ((data.event_badges as any[]) || []).filter(
        (b: any) => b !== "founding_event"
      );
      data.event_badges = [...new Set([...autoBadges, ...manualBadges])];

      let savedId = data.id;

      if (isNew) {
        const { data: inserted, error } = await supabase.from("events").insert(data).select("id").single();
        if (error) throw error;
        savedId = inserted.id;
      } else {
        const { error } = await supabase.from("events").update({ ...data, updated_at: new Date().toISOString() }).eq("id", data.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Event saved");
      queryClient.invalidateQueries({ queryKey: ["admin-events"] });
      setEditEvent(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Event deleted");
      queryClient.invalidateQueries({ queryKey: ["admin-events"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = events.filter((e) => {
    const matchesSearch = e.title.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (dashboardFilter === "empty") {
      const today = new Date().toISOString().slice(0, 10);
      return e.date >= today && ["published", "available"].includes(e.status) && e.spots_taken === 0;
    }
    return true;
  });

  const getCategoryName = (id: string | null) => categories.find((c) => c.id === id)?.name || "—";

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: "cover" | "gallery") => {
    const files = e.target.files;
    if (!files || files.length === 0 || !editEvent) return;

    const file = files[0];
    const fileExt = file.name.split(".").pop();
    const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `${fileName}`;

    setIsUploading(true);
    try {
      const { error: uploadError } = await supabase.storage
        .from("event-images")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("event-images")
        .getPublicUrl(filePath);

      if (type === "cover") {
        setEditEvent({ ...editEvent, image_url: publicUrl });
      } else {
        const currentGallery = (editEvent.gallery_images as any[]) || [];
        if (currentGallery.length >= 5) {
          toast.error("Maximum 5 gallery images allowed");
        } else {
          setEditEvent({ ...editEvent, gallery_images: [...currentGallery, publicUrl] });
        }
      }
      toast.success("Image uploaded");
    } catch (error: any) {
      toast.error("Error uploading image: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const removeGalleryImage = (index: number) => {
    if (!editEvent) return;
    const currentGallery = [...((editEvent.gallery_images as any[]) || [])];
    currentGallery.splice(index, 1);
    setEditEvent({ ...editEvent, gallery_images: currentGallery });
  };

  const moveGalleryImage = (index: number, direction: "up" | "down") => {
    if (!editEvent) return;
    const currentGallery = [...((editEvent.gallery_images as any[]) || [])];
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= currentGallery.length) return;
    [currentGallery[index], currentGallery[newIndex]] = [currentGallery[newIndex], currentGallery[index]];
    setEditEvent({ ...editEvent, gallery_images: currentGallery });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">{t("events.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("events.subtitle")} ({events.length} {t("common.total").toLowerCase()})</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <RefreshButton queryKeys={[["admin-events"], ["admin-categories-list"]]} />
          <Button className="gap-2 flex-1 sm:flex-initial" onClick={() => setEditEvent({ ...emptyEvent, isNew: true })}>
            <Plus className="h-4 w-4" /> {t("events.addEvent")}
          </Button>
        </div>
      </div>

      {dashboardFilter && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-warning/30 bg-warning/5">
          <CalendarX className="h-4 w-4 text-warning shrink-0" />
          <p className="text-sm text-foreground flex-1">
            {dashboardFilter === "empty" ? "Filtro attivo: eventi senza iscritti" : dashboardFilter === "pending" ? "Filtro attivo: iscrizioni in attesa" : `Filtro: ${dashboardFilter}`}
          </p>
          <Button variant="ghost" size="sm" onClick={() => navigate("/events")}>Rimuovi filtro</Button>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder={t("events.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("events.event")}</TableHead>
                  <TableHead>{t("events.organizer")}</TableHead>
                  <TableHead>{t("events.category")}</TableHead>
                  <TableHead>{t("common.date")}</TableHead>
                  <TableHead>{t("events.spots")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead>{t("events.visibility")}</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((event) => (
                  <TableRow key={event.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/events/${event.id}`)}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-1.5">
                        {hasAnyAccessRule(event) && <Shield className="h-3.5 w-3.5 text-primary shrink-0" />}
                        {getPricingRules(event).length > 0 && <Tag className="h-3.5 w-3.5 text-accent-foreground shrink-0" />}
                        <span className="truncate">{event.title}</span>
                        <EventBadgePills event={event} className="ml-1" />
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{event.organizer_name}</TableCell>
                    <TableCell><Badge variant="secondary">{getCategoryName(event.category_id)}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{event.date}</TableCell>
                    <TableCell>{event.spots_taken}/{event.spots_total}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColors[event.status] || ""}>{event.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={visibilityColors[event.visibility] || ""}>{event.visibility}</Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/events/${event.id}`)}><Eye className="h-4 w-4 mr-2" /> View</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setEditEvent(event)}><Edit2 className="h-4 w-4 mr-2" /> Edit</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/events/${event.id}`); toast.success("Link copiato!"); }}>
                            <Copy className="h-4 w-4 mr-2" /> Copia link
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <a href={`https://wa.me/?text=${encodeURIComponent(`Sei invitato a "${event.title}"!\n${window.location.origin}/events/${event.id}`)}`} target="_blank" rel="noopener noreferrer">
                              <MessageCircle className="h-4 w-4 mr-2" /> Condividi WhatsApp
                            </a>
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => { if (confirm("Delete this event?")) deleteMutation.mutate(event.id); }}>
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">{t("events.noEventsFound")}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>



      {/* Edit/Create Dialog - All Fields */}
      <Dialog open={!!editEvent} onOpenChange={(o) => { if (!o) setEditEvent(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editEvent?.isNew ? "Create Event" : "Edit Event"}</DialogTitle></DialogHeader>
          {editEvent && (
            <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
              {/* Title */}
              <div>
                <Label>Title</Label>
                <Input value={editEvent.title || ""} onChange={(e) => setEditEvent({ ...editEvent, title: e.target.value })} />
              </div>

              {/* Location */}
              <div>
                <Label>Location</Label>
                <Input value={editEvent.location || ""} onChange={(e) => setEditEvent({ ...editEvent, location: e.target.value })} />
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Date</Label><Input type="date" value={editEvent.date || ""} onChange={(e) => setEditEvent({ ...editEvent, date: e.target.value })} /></div>
                <div><Label>Time</Label><Input type="time" value={editEvent.time || ""} onChange={(e) => setEditEvent({ ...editEvent, time: e.target.value })} /></div>
              </div>

              {/* Organizer */}
              <div>
                <Label>Organizzatore</Label>
                <Select
                  value={editEvent.organizer_id || "none"}
                  onValueChange={(v) => {
                    if (v === "none") {
                      setEditEvent({ ...editEvent, organizer_id: null, organizer_name: "" });
                    } else {
                      const org = organizers.find((o) => o.id === v);
                      setEditEvent({ ...editEvent, organizer_id: v, organizer_name: org?.name || "" });
                    }
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Seleziona organizzatore" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nessuno</SelectItem>
                    {organizers.map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Spots & Price */}
              <div className="grid grid-cols-3 gap-4">
                <div><Label>Total Spots</Label><Input type="number" value={editEvent.spots_total ?? ""} onChange={(e) => setEditEvent({ ...editEvent, spots_total: e.target.value === "" ? undefined : parseInt(e.target.value, 10) })} /></div>
                <div><Label>Price (€)</Label><Input type="number" step="0.01" value={editEvent.price ?? ""} onChange={(e) => setEditEvent({ ...editEvent, price: e.target.value === "" ? undefined : parseFloat(e.target.value) })} /></div>
                <div><Label>Deposit (€)</Label><Input type="number" step="0.01" value={editEvent.deposit ?? ""} onChange={(e) => setEditEvent({ ...editEvent, deposit: e.target.value ? parseFloat(e.target.value) : null })} placeholder="Optional" /></div>
              </div>

              {/* Status, Category, Payment */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Status</Label>
                  <Select value={editEvent.status || "available"} onValueChange={(v) => setEditEvent({ ...editEvent, status: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="full">Full</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Category</Label>
                  <Select value={editEvent.category_id || "none"} onValueChange={(v) => setEditEvent({ ...editEvent, category_id: v === "none" ? null : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Payment Type</Label>
                  <Select value={editEvent.payment_type || "free"} onValueChange={(v) => setEditEvent({ ...editEvent, payment_type: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="deposit">Deposit</SelectItem>
                      <SelectItem value="location">Pay at location</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Description */}
              <div>
                <Label>Description</Label>
                <Textarea value={editEvent.description || ""} onChange={(e) => setEditEvent({ ...editEvent, description: e.target.value })} rows={3} />
              </div>

              {/* Trail Details */}
              <Separator />
              <h4 className="text-sm font-semibold">Trail Details (optional)</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Difficulty</Label>
                  <Select value={editEvent.difficulty || "none"} onValueChange={(v) => setEditEvent({ ...editEvent, difficulty: v === "none" ? null : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="facile">Facile</SelectItem>
                      <SelectItem value="moderato">Moderato</SelectItem>
                      <SelectItem value="impegnativo">Impegnativo</SelectItem>
                      <SelectItem value="esperto">Esperto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Duration</Label><Input value={editEvent.duration || ""} onChange={(e) => setEditEvent({ ...editEvent, duration: e.target.value || null })} placeholder="e.g. 3h" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Distance</Label><Input value={editEvent.distance || ""} onChange={(e) => setEditEvent({ ...editEvent, distance: e.target.value || null })} placeholder="e.g. 12 km" /></div>
                <div><Label>Elevation</Label><Input value={editEvent.elevation || ""} onChange={(e) => setEditEvent({ ...editEvent, elevation: e.target.value || null })} placeholder="e.g. 500 m" /></div>
              </div>

              {/* Featured */}
              <div className="flex items-center justify-between">
                <Label>Featured Event</Label>
                <Switch checked={editEvent.featured || false} onCheckedChange={(v) => setEditEvent({ ...editEvent, featured: v })} />
              </div>

              {/* Cancellation Policy */}
              <div>
                <Label>Cancellation Policy</Label>
                <Textarea value={editEvent.cancellation_policy || ""} onChange={(e) => setEditEvent({ ...editEvent, cancellation_policy: e.target.value || null })} rows={2} placeholder="Optional" />
              </div>

              {/* ═══ Access & Pricing Rules ═══ */}
              <Separator />
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <h4 className="text-sm font-semibold">Access & Pricing Rules</h4>
                </div>
                <p className="text-xs text-muted-foreground">
                  Configure who can see the event, who can access details, who can register, and which price they see.
                </p>

                {/* ── Visibility ── */}
                <div className="space-y-2 p-3 rounded-lg border bg-card">
                  <Label className="text-xs font-semibold flex items-center gap-1.5"><Eye className="h-3.5 w-3.5 text-primary" /> Event Visibility</Label>
                  <Select value={editEvent.visibility || "public"} onValueChange={(v) => setEditEvent({ ...editEvent, visibility: v as any })}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Public — visible to everyone</SelectItem>
                      <SelectItem value="private">Private — visible only to eligible users</SelectItem>
                      <SelectItem value="hidden">Hidden — accessible only via direct link</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* ── Detail Visibility ── */}
                <div className="space-y-2 p-3 rounded-lg border bg-card">
                  <Label className="text-xs font-semibold">Who can see event details?</Label>
                  <Select value={getAccessRules(editEvent).detail_visibility || "everyone"} onValueChange={(v) => updateAccessRules({ detail_visibility: v as any })}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DETAIL_VISIBILITY_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">Controls whether non-eligible users can view the full event page or just a teaser.</p>
                </div>

                {/* ── Registration Rule ── */}
                <div className="space-y-2 p-3 rounded-lg border bg-card">
                  <Label className="text-xs font-semibold">Who can register?</Label>
                  <Select value={getAccessRules(editEvent).registration_rule || "open"} onValueChange={(v) => updateAccessRules({ registration_rule: v as any })}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {REGISTRATION_RULE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* ── Eligibility Requirements ── */}
                <div className="space-y-3 p-3 rounded-lg border border-dashed border-primary/20">
                  <Label className="text-xs font-semibold flex items-center gap-1.5"><Lock className="h-3.5 w-3.5 text-primary" /> Eligibility Requirements</Label>
                  <p className="text-[10px] text-muted-foreground">Leave all unchecked for open access.</p>

                  <div className="flex items-center gap-3 p-2.5 rounded-md border bg-card">
                    <Checkbox
                      id="require-membership"
                      checked={getAccessRules(editEvent).require_active_membership || false}
                      onCheckedChange={(v) => updateAccessRules({ require_active_membership: !!v })}
                    />
                    <div className="flex-1">
                      <label htmlFor="require-membership" className="text-xs font-medium cursor-pointer flex items-center gap-1.5">
                        <Award className="h-3.5 w-3.5 text-primary" /> Require active membership
                      </label>
                      <p className="text-[10px] text-muted-foreground">Only users with an active membership can register.</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-2.5 rounded-md border bg-card">
                    <Checkbox
                      id="require-approval"
                      checked={getAccessRules(editEvent).require_manual_approval || false}
                      onCheckedChange={(v) => updateAccessRules({ require_manual_approval: !!v })}
                    />
                    <div className="flex-1">
                      <label htmlFor="require-approval" className="text-xs font-medium cursor-pointer flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Require manual approval
                      </label>
                      <p className="text-[10px] text-muted-foreground">Registrations need admin/organizer approval.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-[10px]">Min. trekking events</Label>
                      <Input
                        type="number"
                        min={0}
                        className="h-8 text-sm"
                        placeholder="No minimum"
                        value={getAccessRules(editEvent).min_trekking_events ?? ""}
                        onChange={(e) => updateAccessRules({ min_trekking_events: e.target.value ? parseInt(e.target.value) : null })}
                      />
                    </div>
                    <div>
                      <Label className="text-[10px]">Min. total activities</Label>
                      <Input
                        type="number"
                        min={0}
                        className="h-8 text-sm"
                        placeholder="No minimum"
                        value={getAccessRules(editEvent).min_activities ?? ""}
                        onChange={(e) => updateAccessRules({ min_activities: e.target.value ? parseInt(e.target.value) : null })}
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-[10px]">Required badge</Label>
                    <Select
                      value={getAccessRules(editEvent).required_badge_id || "none"}
                      onValueChange={(v) => updateAccessRules({ required_badge_id: v === "none" ? null : v })}
                    >
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="No badge required" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No badge required</SelectItem>
                        {badges.map((b) => (
                          <SelectItem key={b.id} value={b.id}>{b.icon} {b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Allowed user groups */}
                  <div>
                    <Label className="text-[10px] mb-1.5 block">Restrict to specific user groups</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {USER_GROUP_OPTIONS.map((group) => {
                        const selected = (getAccessRules(editEvent).allowed_user_groups || []).includes(group.value);
                        return (
                          <div key={group.value} className="flex items-center gap-2">
                            <Checkbox
                              checked={selected}
                              onCheckedChange={(v) => {
                                const current = getAccessRules(editEvent).allowed_user_groups || [];
                                const updated = v ? [...current, group.value] : current.filter(g => g !== group.value);
                                updateAccessRules({ allowed_user_groups: updated.length > 0 ? updated : undefined });
                              }}
                            />
                            <span className="text-xs">{group.label}</span>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">Leave unchecked for no group restriction.</p>
                  </div>
                </div>

                {/* ── Dynamic Pricing ── */}
                {(editEvent.payment_type === "paid" || editEvent.payment_type === "deposit") && (
                  <div className="space-y-3 p-3 rounded-lg border border-dashed border-primary/30 bg-primary/5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold flex items-center gap-1.5">
                        <Tag className="h-3.5 w-3.5 text-primary" /> Fasce di prezzo
                      </Label>
                      <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={addPricingRule}>
                        <Plus className="h-3 w-3 mr-1" /> Aggiungi fascia
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Prezzo standard: <strong>€{editEvent.price ?? 0}</strong>. Le fasce vengono valutate dall'alto verso il basso. L'utente vede la <strong>prima fascia corrispondente</strong>.
                    </p>

                    {getPricingRules(editEvent).length === 0 && (
                      <p className="text-xs text-muted-foreground italic text-center py-2">Nessuna fascia di prezzo. Tutti gli utenti vedono il prezzo standard.</p>
                    )}

                    {getPricingRules(editEvent).map((rule, ruleIndex) => (
                      <div key={rule.id} className="space-y-2 p-3 rounded-md border bg-card">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-muted-foreground bg-muted rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                            {ruleIndex + 1}
                          </span>
                          <DollarSign className="h-3.5 w-3.5 text-primary shrink-0" />
                          <Input
                            className="h-8 text-sm"
                            placeholder="Nome fascia (es. Prezzo Soci)"
                            value={rule.name}
                            onChange={(e) => updatePricingRule(rule.id, { name: e.target.value })}
                          />
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive" onClick={() => removePricingRule(rule.id)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-[10px]">Prezzo riservato (€)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min={0}
                              className="h-8 text-sm"
                              value={rule.price ?? ""}
                              onChange={(e) => updatePricingRule(rule.id, { price: parseFloat(e.target.value) || 0 })}
                            />
                          </div>
                          <div>
                            <Label className="text-[10px]">Chi vede questo prezzo</Label>
                            <Select value={rule.condition} onValueChange={(v) => updatePricingRule(rule.id, { condition: v as any, condition_value: null })}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {PRICING_CONDITIONS.map((c) => (
                                  <SelectItem key={c.value} value={c.value} className="text-xs">
                                    {c.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {PRICING_CONDITIONS.find(c => c.value === rule.condition)?.description}
                            </p>
                          </div>
                        </div>
                        {rule.condition === "specific_badge" && (
                          <div className="space-y-1.5">
                            <Label className="text-[10px]">Seleziona badge o livelli (l'utente deve averne almeno uno)</Label>
                            <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto p-2 rounded border bg-muted/30">
                              {badges.length > 0 && (
                                <>
                                  <p className="col-span-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Badge</p>
                                  {badges.map((b) => {
                                    const selected = (rule.condition_value || []).includes(b.id);
                                    return (
                                      <div key={b.id} className="flex items-center gap-1.5">
                                        <Checkbox
                                          checked={selected}
                                          onCheckedChange={(v) => {
                                            const current = rule.condition_value || [];
                                            const updated = v ? [...current, b.id] : current.filter(id => id !== b.id);
                                            updatePricingRule(rule.id, { condition_value: updated.length > 0 ? updated : null });
                                          }}
                                        />
                                        <span className="text-xs">{b.icon} {b.name}</span>
                                      </div>
                                    );
                                  })}
                                </>
                              )}
                              {communityLevels.length > 0 && (
                                <>
                                  <p className="col-span-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-1">Livelli</p>
                                  {communityLevels.map((l) => {
                                    const levelKey = `level_${l.id}`;
                                    const selected = (rule.condition_value || []).includes(levelKey);
                                    return (
                                      <div key={l.id} className="flex items-center gap-1.5">
                                        <Checkbox
                                          checked={selected}
                                          onCheckedChange={(v) => {
                                            const current = rule.condition_value || [];
                                            const updated = v ? [...current, levelKey] : current.filter(id => id !== levelKey);
                                            updatePricingRule(rule.id, { condition_value: updated.length > 0 ? updated : null });
                                          }}
                                        />
                                        <span className="text-xs">{l.icon} {l.name}</span>
                                      </div>
                                    );
                                  })}
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                    {getPricingRules(editEvent).length > 1 && (
                      <div className="flex items-center gap-2 p-2 rounded bg-accent/50 border border-accent">
                        <ArrowDown className="h-3.5 w-3.5 text-primary shrink-0" />
                        <p className="text-[10px] text-accent-foreground">
                          Le fasce vengono valutate in ordine (dall'alto verso il basso). La prima condizione corrispondente viene applicata.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Custom restriction message ── */}
                <div>
                  <Label className="text-xs">Custom restriction message</Label>
                  <Textarea
                    value={getAccessRules(editEvent).restriction_message || ""}
                    onChange={(e) => updateAccessRules({ restriction_message: e.target.value || undefined })}
                    rows={2}
                    placeholder='e.g. "This event is reserved for users who have participated in at least two trekking activities."'
                  />
                </div>

                {/* ── Exclusivity / scarcity tags ── */}
                <div>
                  <Label className="text-xs mb-2 block">Exclusivity & scarcity indicators</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {EXCLUSIVITY_TAGS.map((tag) => {
                      const TagIcon = tag.icon;
                      const selected = (getAccessRules(editEvent).exclusivity_tags || []).includes(tag.value);
                      return (
                        <button
                          key={tag.value}
                          type="button"
                          onClick={() => toggleExclusivityTag(tag.value)}
                          className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs text-left transition-colors ${selected
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-card text-muted-foreground hover:border-primary/50"
                            }`}
                        >
                          <TagIcon className="h-3.5 w-3.5 shrink-0" />
                          {tag.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {hasAnyAccessRule(editEvent) && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-accent/50 border border-accent">
                    <Shield className="h-4 w-4 text-primary shrink-0" />
                    <p className="text-xs text-accent-foreground">
                      This event has access restrictions. Users who don't meet the requirements will see a restriction message.
                    </p>
                  </div>
                )}
              </div>

              {/* ═══ Event Badges ═══ */}
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h4 className="text-sm font-semibold">Badge Evento</h4>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Massimo 2 badge visibili. I badge automatici (ULTIMI POSTI, GRATUITO, FOUNDING EVENT) hanno priorità sui manuali.
                </p>

                <div className="space-y-2">
                  <Label className="text-xs">Badge manuali</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {MANUAL_BADGE_OPTIONS.map((badge) => {
                      const storedBadges = ((editEvent.event_badges as any[]) || []).filter((b: any) => typeof b === "string");
                      const selected = storedBadges.includes(badge.value);
                      return (
                        <button
                          key={badge.value}
                          type="button"
                          onClick={() => {
                            const current = ((editEvent.event_badges as any[]) || []);
                            const updated = selected
                              ? current.filter((b: any) => b !== badge.value)
                              : [...current, badge.value];
                            setEditEvent({ ...editEvent, event_badges: updated });
                          }}
                          className={`flex items-center gap-2 p-2 rounded-lg border text-xs text-left transition-colors ${selected
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-card text-muted-foreground hover:border-primary/50"
                            }`}
                        >
                          <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${badge.color}`}>
                            {badge.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Badge personalizzato (testo libero)</Label>
                  <Input
                    className="h-8 text-sm"
                    placeholder="es. NUOVO, SPECIALE..."
                    value={
                      (() => {
                        const custom = ((editEvent.event_badges as any[]) || []).find(
                          (b: any) => typeof b === "object" && b?.type === "custom"
                        );
                        return custom?.label || "";
                      })()
                    }
                    onChange={(e) => {
                      const current = ((editEvent.event_badges as any[]) || []).filter(
                        (b: any) => !(typeof b === "object" && b?.type === "custom")
                      );
                      const val = e.target.value.trim();
                      const updated = val ? [...current, { type: "custom", label: val }] : current;
                      setEditEvent({ ...editEvent, event_badges: updated });
                    }}
                  />
                  <p className="text-[10px] text-muted-foreground mt-0.5">Opzionale. Verrà mostrato solo se ci sono meno di 2 badge con priorità più alta.</p>
                </div>

                {/* Preview */}
                <div className="p-2 rounded border bg-muted/30">
                  <p className="text-[10px] text-muted-foreground mb-1">Anteprima badge:</p>
                  <EventBadgePills event={editEvent as any} />
                </div>
              </div>

              <div className="space-y-4 pt-2 border-t mt-4">
                <h3 className="font-semibold text-sm">Media Settings</h3>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    Cover Image <span className="text-destructive font-bold">*</span>
                  </Label>
                  <div className="flex items-start gap-4">
                    <div className="relative w-32 h-24 bg-muted rounded-md border border-dashed overflow-hidden flex items-center justify-center">
                      {editEvent.image_url ? (
                        <>
                          <img src={editEvent.image_url} alt="Preview" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setEditEvent({ ...editEvent, image_url: "" })}
                            className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </>
                      ) : (
                        <ImageIcon className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex flex-col gap-2 pt-1">
                      <Button variant="outline" size="sm" asChild disabled={isUploading}>
                        <label className="cursor-pointer">
                          {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                          Upload Cover
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, "cover")} />
                        </label>
                      </Button>
                      <p className="text-[10px] text-muted-foreground">Mandatory cover image for cards and featured sections.</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center justify-between">
                    <span>Gallery Images ({((editEvent.gallery_images as any[]) || []).length}/5)</span>
                    {((editEvent.gallery_images as any[]) || []).length < 5 && (
                      <Button variant="ghost" size="sm" asChild disabled={isUploading} className="h-7 text-xs">
                        <label className="cursor-pointer">
                          <Plus className="h-3 w-3 mr-1" /> Add Image
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, "gallery")} />
                        </label>
                      </Button>
                    )}
                  </Label>
                  <div className="space-y-2">
                    {((editEvent.gallery_images as any[]) || []).length === 0 && (
                      <p className="text-xs text-muted-foreground italic">No gallery images added yet.</p>
                    )}
                    {((editEvent.gallery_images as any[]) || []).map((img, idx) => (
                      <div key={idx} className="flex items-center gap-3 bg-muted/30 p-2 rounded-md border">
                        <img src={typeof img === 'string' ? img : ''} alt={`Gallery ${idx}`} className="w-12 h-10 object-cover rounded border" />
                        <div className="flex-1 text-[10px] truncate max-w-[200px] font-mono text-muted-foreground">
                          {typeof img === 'string' ? img.split("/").pop() : ''}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={idx === 0} onClick={() => moveGalleryImage(idx, "up")}>
                            <ArrowUp className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={idx === ((editEvent.gallery_images as any[]) || []).length - 1} onClick={() => moveGalleryImage(idx, "down")}>
                            <ArrowDown className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeGalleryImage(idx)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEvent(null)}>Cancel</Button>
            <Button
              onClick={() => saveMutation.mutate(editEvent)}
              disabled={saveMutation.isPending || !editEvent?.image_url}
            >
              {saveMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
