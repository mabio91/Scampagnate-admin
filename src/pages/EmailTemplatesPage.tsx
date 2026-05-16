import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Mail, Eye, Send, Pencil, Check, Smartphone, Monitor, RefreshCw, Shield, ShieldCheck, ShieldAlert, Settings2, Plus, Trash2, Copy, Users, AlertCircle } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { RichTextEditor } from "@/components/RichTextEditor";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface EmailTemplate {
  id: string;
  template_key: string;
  name: string;
  subject: string;
  preview_text: string;
  body_html: string;
  cta_label: string;
  cta_url: string;
  sender_name: string;
  reply_to: string;
  is_active: boolean;
  type: "transactional" | "broadcast";
  created_at: string;
  updated_at: string;
}

type BroadcastRecipientMode = "all" | "filtered";
type BroadcastRegistrationFilter = "all" | "active" | "inactive";
type BroadcastMembershipFilter = "all" | "active" | "expired" | "none" | "inactive";
type BroadcastBookingFilter = "all" | "upcoming" | "past" | "cancelled";
type BroadcastLastActivityFilter = "any" | "30" | "90" | "180";

interface BroadcastFilters {
  recipientMode: BroadcastRecipientMode;
  registrationStatus: BroadcastRegistrationFilter;
  membershipStatus: BroadcastMembershipFilter;
  minEventsJoined: number;
  minEventsAttended: number;
  bookingStatus: BroadcastBookingFilter;
  interests: string[];
  lastActivityWindow: BroadcastLastActivityFilter;
  onlyNoShowUsers: boolean;
  onlyFirstTimeUsers: boolean;
}

interface BroadcastProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  account_status: string | null;
  membership_status: string | null;
  interests: string[] | null;
  created_at: string;
  updated_at: string;
}

interface BroadcastUserStats {
  joined: number;
  attended: number;
  noShows: number;
  hasUpcoming: boolean;
  hasPast: boolean;
  hasCancelled: boolean;
  lastActivityAt: string | null;
}

const DEFAULT_BROADCAST_FILTERS: BroadcastFilters = {
  recipientMode: "all",
  registrationStatus: "all",
  membershipStatus: "all",
  minEventsJoined: 0,
  minEventsAttended: 0,
  bookingStatus: "all",
  interests: [],
  lastActivityWindow: "any",
  onlyNoShowUsers: false,
  onlyFirstTimeUsers: false,
};

const SAMPLE_EVENT_SUGGESTIONS = `
  <ul>
    <li>Trekking sul lago domenica prossima</li>
    <li>Workshop fotografia outdoor a maggio</li>
    <li>Esperienza enogastronomica tra le colline</li>
  </ul>
`;

function replaceVariables(html: string, vars: Record<string, string>) {
  let result = html;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  // Robust replacement for first_name
  if (result.includes("{{first_name}}")) {
    const firstName = vars.first_name || "";
    if (firstName) {
      result = result.replace(/\{\{first_name\}\}/g, firstName);
    } else {
      // If we don't have a first name, try to clean up the greeting
      result = result.replace(/Ciao \{\{first_name\}\}/g, "Ciao");
      result = result.replace(/Gentile \{\{first_name\}\}/g, "Gentile utente");
      result = result.replace(/\{\{first_name\}\}/g, "");
    }
  }

  if (result.includes("{{user_name}}")) {
    const userName = vars.user_name || vars.full_name || vars.first_name || "";
    result = result.replace(/\{\{user_name\}\}/g, userName);
  }

  return result;
}

async function getFunctionHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

async function getFunctionErrorMessage(error: any) {
  if (!error) return "Richiesta non riuscita";

  if (typeof error.message === "string" && !error.message.includes("non-2xx")) {
    return error.message;
  }

  if (error.context) {
    try {
      const payload = await error.context.json();
      if (typeof payload?.error === "string") return payload.error;
      if (typeof payload?.message === "string") return payload.message;
    } catch {
      // Fall back to the generic message below if the response body can't be parsed.
    }
  }

  return error.message || "Richiesta non riuscita";
}

function EmailPreview({ template, viewport }: { template: EmailTemplate; viewport: "desktop" | "mobile" }) {
  const sampleVars = {
    first_name: "Marco",
    full_name: "Marco Rossi",
    user_name: "Marco Rossi",
    email: "marco@example.com",
    cta_url: template.cta_url || "/events",
    event_suggestions: SAMPLE_EVENT_SUGGESTIONS,
  };
  const bodyHtml = replaceVariables(template.body_html, sampleVars);
  const width = viewport === "mobile" ? "375px" : "600px";

  return (
    <div className="flex justify-center p-4 bg-muted/50 rounded-lg">
      <div style={{ width, maxWidth: "100%" }} className="bg-white rounded-lg shadow-lg overflow-hidden border">
        {/* Email header */}
        <div className="bg-[hsl(150,40%,20%)] text-white p-6 text-center">
          <h1 className="text-xl font-bold">{template.sender_name || "Scampagnate"}</h1>
        </div>
        {/* Email body */}
        <div className="p-6">
          <div className="text-sm text-muted-foreground mb-2 italic">{template.preview_text}</div>
          <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
          {template.cta_label && (
            <div className="text-center mt-6">
              <span className="inline-block bg-[hsl(25,70%,50%)] text-white px-6 py-3 rounded-md font-semibold text-sm">
                {template.cta_label}
              </span>
            </div>
          )}
        </div>
        {/* Email footer */}
        <div className="bg-muted/30 p-4 text-center text-xs text-muted-foreground border-t space-y-1">
          <p>Hai ricevuto questa email perchÃ© hai creato un account su Scampagnate.</p>
          <p>Â© {new Date().getFullYear()} Scampagnate. Tutti i diritti riservati.</p>
        </div>
      </div>
    </div>
  );
}

export default function EmailTemplatesPage() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);
  const [previewViewport, setPreviewViewport] = useState<"desktop" | "mobile">("desktop");
  const [testEmailDialog, setTestEmailDialog] = useState(false);
  const [testTemplateId, setTestTemplateId] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<EmailTemplate | null>(null);

  // --- Domain Verification State ---
  const [refreshingDomain, setRefreshingDomain] = useState(false);
  const [verifyingDomain, setVerifyingDomain] = useState(false);
  const { data: domainStatus, refetch: refetchDomain } = useQuery({
    queryKey: ["resend-domain-status"],
    queryFn: async () => {
      try {
        const headers = await getFunctionHeaders();
        const { data, error } = await supabase.functions.invoke("resend-domain-status", {
          headers,
        });
        if (error) throw error;
        return data;
      } catch (e) {
        console.error("Error fetching domain status:", e);
        return null;
      }
    },
    refetchOnWindowFocus: false,
  });

  const handleRefreshDomain = async () => {
    setRefreshingDomain(true);
    await refetchDomain();
    setRefreshingDomain(false);
    toast.success("Stato dominio aggiornato");
  };

  const handleVerifyDomain = async () => {
    setVerifyingDomain(true);
    try {
      const headers = await getFunctionHeaders();
      const { data, error } = await supabase.functions.invoke("resend-domain-status", {
        headers,
        body: { action: "verify" },
      });
      if (error) throw error;
      await refetchDomain();
      toast.success(data?.message || "Verifica dominio avviata");
    } catch (e: any) {
      toast.error(await getFunctionErrorMessage(e));
    } finally {
      setVerifyingDomain(false);
    }
  };

  // --- Broadcast Logic States ---
  const [broadcastStep, setBroadcastStep] = useState<"template" | "filter" | "confirm" | "sending">("template");
  const [selectedBroadcastTemplateId, setSelectedBroadcastTemplateId] = useState<string>("");
  const [broadcastFilters, setBroadcastFilters] = useState<BroadcastFilters>(DEFAULT_BROADCAST_FILTERS);
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);

  // Fetch all user profiles for filtering
  const { data: allProfiles = [] } = useQuery<BroadcastProfile[]>({
    queryKey: ["all-profiles-for-broadcast"],
    enabled: isBroadcastModalOpen,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email, account_status, membership_status, interests, created_at, updated_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as BroadcastProfile[];
    },
  });

  // Fetch registration stats for all users
  const { data: userRegStats = {} } = useQuery<Record<string, BroadcastUserStats>>({
    queryKey: ["user-reg-stats-for-broadcast"],
    enabled: isBroadcastModalOpen,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_registrations")
        .select("user_id, status, checked_in, created_at, sport_level, events(date, status)");
      if (error) throw error;

      const stats: Record<string, BroadcastUserStats> = {};
      const today = new Date().toISOString().slice(0, 10);

      data?.forEach((reg: any) => {
        if (!reg.user_id || reg.sport_level?.startsWith("manual:")) return;

        if (!stats[reg.user_id]) {
          stats[reg.user_id] = {
            joined: 0,
            attended: 0,
            noShows: 0,
            hasUpcoming: false,
            hasPast: false,
            hasCancelled: false,
            lastActivityAt: null,
          };
        }

        const s = stats[reg.user_id];
        const eventDate = reg.events?.date || null;
        const registrationDate = reg.created_at || null;

        if (registrationDate && (!s.lastActivityAt || registrationDate > s.lastActivityAt)) {
          s.lastActivityAt = registrationDate;
        }

        if (["paid", "registered", "attended", "no_show"].includes(reg.status)) {
          s.joined++;
        }
        if (reg.checked_in || reg.status === "attended") {
          s.attended++;
        }
        if (reg.status === "no_show") {
          s.noShows++;
        }
        if (eventDate && eventDate >= today && ["registered", "paid", "waitlist", "pending_approval", "pending_payment"].includes(reg.status)) {
          s.hasUpcoming = true;
        }
        if (eventDate && eventDate < today && ["registered", "paid", "attended", "no_show"].includes(reg.status)) {
          s.hasPast = true;
        }
        if (reg.status === "cancelled") {
          s.hasCancelled = true;
        }
      });
      return stats;
    },
  });

  const allInterests = Array.from(
    new Set(allProfiles.flatMap((profile) => profile.interests || [])),
  ).sort((a, b) => a.localeCompare(b, "it"));

  const emailableProfiles = allProfiles.filter((profile) => Boolean(profile.email));

  const filteredRecipients = emailableProfiles.filter((profile) => {
    const stats = userRegStats[profile.id] || {
      joined: 0,
      attended: 0,
      noShows: 0,
      hasUpcoming: false,
      hasPast: false,
      hasCancelled: false,
      lastActivityAt: profile.updated_at || profile.created_at || null,
    };

    if (broadcastFilters.registrationStatus === "active" && profile.account_status !== "Active") return false;
    if (broadcastFilters.registrationStatus === "inactive" && profile.account_status === "Active") return false;

    if (broadcastFilters.membershipStatus === "active" && profile.membership_status !== "Active") return false;
    if (broadcastFilters.membershipStatus === "expired" && profile.membership_status !== "Expired") return false;
    if (broadcastFilters.membershipStatus === "none" && !!profile.membership_status && profile.membership_status !== "Inactive") return false;
    if (broadcastFilters.membershipStatus === "inactive" && profile.membership_status === "Active") return false;

    if (stats.joined < broadcastFilters.minEventsJoined) return false;
    if (stats.attended < broadcastFilters.minEventsAttended) return false;

    if (broadcastFilters.bookingStatus === "upcoming" && !stats.hasUpcoming) return false;
    if (broadcastFilters.bookingStatus === "past" && !stats.hasPast) return false;
    if (broadcastFilters.bookingStatus === "cancelled" && !stats.hasCancelled) return false;

    if (broadcastFilters.interests.length > 0) {
      const userInterests = profile.interests || [];
      if (!broadcastFilters.interests.some((interest) => userInterests.includes(interest))) return false;
    }

    if (broadcastFilters.onlyNoShowUsers && stats.noShows === 0) return false;
    if (broadcastFilters.onlyFirstTimeUsers && stats.joined > 1) return false;

    if (broadcastFilters.lastActivityWindow !== "any") {
      const lastActivityAt = stats.lastActivityAt || profile.updated_at || profile.created_at;
      const threshold = new Date();
      threshold.setDate(threshold.getDate() - Number(broadcastFilters.lastActivityWindow));
      if (!lastActivityAt || new Date(lastActivityAt) < threshold) return false;
    }

    return true;
  });

  const finalRecipients = broadcastFilters.recipientMode === "all" ? emailableProfiles : filteredRecipients;

  const [isSendingBroadcast, setIsSendingBroadcast] = useState(false);
  const handleSendBroadcast = async () => {
    if (!selectedBroadcastTemplateId || finalRecipients.length === 0) return;
    setIsSendingBroadcast(true);
    try {
      const headers = await getFunctionHeaders();
      const { data, error } = await supabase.functions.invoke("send-broadcast-email", {
        headers,
        body: { 
          templateId: selectedBroadcastTemplateId, 
          userIds: finalRecipients.map((recipient) => recipient.id),
        },
      });
      if (error) throw error;
      const summary = data?.summary;
      if (summary) {
        toast.success(`Broadcast inviato: ${summary.sent}/${summary.total} email consegnate, ${summary.failed} fallite, ${summary.skipped} saltate.`);
      } else {
        toast.success(`Broadcast inviato con successo a ${finalRecipients.length} utenti`);
      }
      setIsBroadcastModalOpen(false);
      setBroadcastStep("template");
      setBroadcastFilters(DEFAULT_BROADCAST_FILTERS);
      setSelectedBroadcastTemplateId("");
    } catch (e: any) {
      toast.error(await getFunctionErrorMessage(e));
    } finally {
      setIsSendingBroadcast(false);
    }
  };

  const { data: templates, isLoading } = useQuery({
    queryKey: ["email-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .order("created_at");
      if (error) throw error;
      return data as EmailTemplate[];
    },
  });

  const { data: users } = useQuery({
    queryKey: ["users-for-test-email"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .not("email", "is", null)
        .order("first_name")
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (template: Partial<EmailTemplate> & { id: string }) => {
      const { error } = await supabase
        .from("email_templates")
        .update({ ...template, updated_at: new Date().toISOString() })
        .eq("id", template.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-templates"] });
      toast.success("Template salvato");
      setEditingTemplate(null);
    },
    onError: () => toast.error("Errore nel salvataggio"),
  });

  const createMutation = useMutation({
    mutationFn: async (template: Omit<EmailTemplate, "id" | "created_at" | "updated_at">) => {
      const { error } = await supabase.from("email_templates").insert(template);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-templates"] });
      toast.success("Template creato");
      setEditingTemplate(null);
      setIsCreating(false);
    },
    onError: () => toast.error("Errore nella creazione"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("email_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-templates"] });
      toast.success("Template eliminato");
      setDeleteConfirm(null);
    },
    onError: () => toast.error("Errore nell'eliminazione"),
  });
  const activateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      // Deactivate all welcome templates, then activate the selected one
      const { error: deactError } = await supabase
        .from("email_templates")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .like("template_key", "welcome_email_%");
      if (deactError) throw deactError;
      const { error } = await supabase
        .from("email_templates")
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq("id", templateId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-templates"] });
      toast.success("Template attivato");
    },
  });

  const handleSendTest = async () => {
    const templateId = testTemplateId || selectedBroadcastTemplateId;
    if (!testEmail || !templateId) return;

    setSendingTest(true);
    try {
      const headers = await getFunctionHeaders();
      const selectedUser = users?.find((user) => user.email === testEmail);
      const { error } = await supabase.functions.invoke("send-welcome-email", {
        headers,
        body: {
          templateId,
          recipientEmail: testEmail,
          email: testEmail,
          userId: selectedUser?.id,
          firstName: selectedUser?.first_name || "",
          lastName: selectedUser?.last_name || "",
          isTest: true,
        },
      });
      if (error) throw error;
      toast.success(`Email di test inviata a ${testEmail}`);
      setTestEmailDialog(false);
    } catch (e: any) {
      toast.error(await getFunctionErrorMessage(e));
    } finally {
      setSendingTest(false);
    }
  };

  // Get last test sent from email_send_log
  const { data: lastTestSent } = useQuery({
    queryKey: ["last-test-email"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_send_log")
        .select("sent_at, status, recipient_email")
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return data?.[0] || null;
    },
  });

  if (isLoading) {
    return <div className="p-6 text-muted-foreground">{t("common.loading")}</div>;
  }

  // Get active template info for settings card
  const activeTemplate = templates?.find((t) => t.is_active);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Mail className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Email Templates</h1>
            <p className="text-sm text-muted-foreground">Gestisci i template delle email e invia broadcast</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setIsBroadcastModalOpen(true)}>
            <Send className="h-4 w-4" /> Invia Broadcast
          </Button>
        <Button onClick={() => {
          setIsCreating(true);
          setEditingTemplate({
            id: "",
            template_key: `email_template_${Date.now()}`,
            name: "",
            subject: "",
            preview_text: "",
            body_html: "<p>Ciao {{first_name}},</p><p></p>",
            cta_label: "",
            cta_url: "",
            sender_name: "Scampagnate",
            reply_to: "",
            is_active: false,
            type: "transactional",
            created_at: "",
            updated_at: "",
          });
        }}>
          <Plus className="h-4 w-4 mr-1" /> Nuovo Template
        </Button>
      </div>
      </div>

      {/* Deliverability Settings Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Impostazioni Email & Deliverability</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email mittente</span>
              <p className="text-sm font-semibold text-foreground">noreply@scampagnate.com</p>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Nome mittente</span>
              <p className="text-sm font-semibold text-foreground">{activeTemplate?.sender_name || "Scampagnate"}</p>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Reply-to</span>
              <p className="text-sm font-semibold text-foreground">{activeTemplate?.reply_to || "â€”"}</p>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Template attivo</span>
              <p className="text-sm font-semibold text-foreground">
                {activeTemplate ? (
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-green-500" />
                    {activeTemplate.name}
                  </span>
                ) : (
                  <span className="text-destructive">Nessun template attivo</span>
                )}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Ultimo invio test</span>
              <p className="text-sm font-semibold text-foreground">
                {lastTestSent?.sent_at
                  ? new Date(lastTestSent.sent_at).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })
                  : "Mai"}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Dominio autenticato</span>
              <p className="text-sm font-semibold text-foreground">
                {domainStatus?.status === "verified" ? (
                  <Badge className="bg-success text-white">
                    <ShieldCheck className="h-3 w-3 mr-1" /> Verificato
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                    <ShieldAlert className="h-3 w-3 mr-1" /> {domainStatus?.status === "pending" ? "In attesa" : "Da verificare"}
                  </Badge>
                )}
              </p>
            </div>
          </div>
          <Separator />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mr-2">DNS Records:</span>
              <Badge variant="outline" className={domainStatus?.records?.some((r: any) => r.type === "TXT" && r.status === "verified") ? "text-success border-success bg-success/10" : "text-muted-foreground border-muted"}>
                <Shield className="h-3 w-3 mr-1" /> SPF: {domainStatus?.records?.find((r: any) => r.type === "TXT" && r.name.includes("_spf"))?.status || "â€”"}
              </Badge>
              <Badge variant="outline" className={domainStatus?.records?.some((r: any) => r.type === "CNAME" && r.status === "verified") ? "text-success border-success bg-success/10" : "text-muted-foreground border-muted"}>
                <Shield className="h-3 w-3 mr-1" /> DKIM: {domainStatus?.records?.some((r: any) => r.type === "CNAME" && r.status === "verified") ? "Verificato" : "In attesa"}
              </Badge>
              <Badge variant="outline" className="text-muted-foreground border-muted">
                <Shield className="h-3 w-3 mr-1" /> DMARC: Info
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="h-8 gap-1.5" onClick={handleRefreshDomain} disabled={refreshingDomain}>
                <RefreshCw className={`h-3 w-3 ${refreshingDomain ? "animate-spin" : ""}`} /> Aggiorna stato
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                onClick={handleVerifyDomain}
                disabled={verifyingDomain || domainStatus?.status === "verified"}
              >
                <ShieldCheck className={`h-3 w-3 ${verifyingDomain ? "animate-pulse" : ""}`} />
                {domainStatus?.status === "verified" ? "Dominio verificato" : "Verifica dominio"}
              </Button>
              <span className="text-xs text-muted-foreground">
                Gestisci su <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer" className="underline text-primary hover:text-primary/80">resend.com</a>
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6">
        {templates?.map((tpl) => (
           <Card key={tpl.id} className={tpl.is_active ? "border-primary/50 shadow-md" : ""}>
            <CardHeader className="pb-3 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg">{tpl.name}</CardTitle>
                  {tpl.is_active ? (
                    <Badge className="bg-success text-success-foreground">Attivo</Badge>
                  ) : (
                    <Badge variant="secondary">Inattivo</Badge>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Button variant="outline" size="sm" onClick={() => { setPreviewTemplate(tpl); }}>
                    <Eye className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Anteprima</span>
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { setTestTemplateId(tpl.id); setTestEmailDialog(true); }}>
                    <Send className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Test</span>
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { setIsCreating(false); setEditingTemplate({ ...tpl }); }}>
                    <Pencil className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Modifica</span>
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => {
                    setIsCreating(true);
                    setEditingTemplate({
                      ...tpl,
                      id: "",
                      name: `${tpl.name} (copia)`,
                      template_key: `${tpl.template_key}_copy_${Date.now()}`,
                      is_active: false,
                      created_at: "",
                      updated_at: "",
                    });
                  }}>
                    <Copy className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Duplica</span>
                  </Button>
                  {!tpl.is_active && (
                    <Button size="sm" onClick={() => activateMutation.mutate(tpl.id)}>
                      <Check className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Attiva</span>
                    </Button>
                  )}
                  {!tpl.is_active && (
                    <Button variant="destructive" size="sm" onClick={() => setDeleteConfirm(tpl)}>
                      <Trash2 className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Elimina</span>
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Oggetto:</span>
                  <p className="font-medium truncate">{tpl.subject}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Mittente:</span>
                  <p className="font-medium">{tpl.sender_name || "â€”"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">CTA:</span>
                  <p className="font-medium">{tpl.cta_label || "â€”"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Reply-to:</span>
                  <p className="font-medium">{tpl.reply_to || "â€”"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit/Create Dialog */}
      <Dialog open={!!editingTemplate} onOpenChange={(open) => { if (!open) { setEditingTemplate(null); setIsCreating(false); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isCreating ? "Nuovo Template" : "Modifica Template"}</DialogTitle>
            <DialogDescription>
              Configura contenuto, mittente e impostazioni del template email.
            </DialogDescription>
          </DialogHeader>
          {editingTemplate && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome template</Label>
                  <Input value={editingTemplate.name} onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Chiave template</Label>
                  <Input value={editingTemplate.template_key} onChange={(e) => setEditingTemplate({ ...editingTemplate, template_key: e.target.value })} placeholder="es. welcome_email_v1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo template</Label>
                  <Select 
                    value={editingTemplate.type || "transactional"} 
                    onValueChange={(v: "transactional" | "broadcast") => setEditingTemplate({ ...editingTemplate, type: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="transactional">Transazionale (es. Benvenuto)</SelectItem>
                      <SelectItem value="broadcast">Broadcast (Invio di massa)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Oggetto email</Label>
                  <Input value={editingTemplate.subject} onChange={(e) => setEditingTemplate({ ...editingTemplate, subject: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Testo anteprima (opzionale)</Label>
                <Input value={editingTemplate.preview_text} onChange={(e) => setEditingTemplate({ ...editingTemplate, preview_text: e.target.value })} placeholder="Testo visibile nell'anteprima email client" />
              </div>
              <div className="space-y-2">
                <Label>Corpo email</Label>
                <p className="text-xs text-muted-foreground">Variabili disponibili: {"{{first_name}}"}, {"{{full_name}}"}, {"{{user_name}}"}, {"{{email}}"}, {"{{event_suggestions}}"}, {"{{cta_url}}"}</p>
                <RichTextEditor content={editingTemplate.body_html} onChange={(html) => setEditingTemplate({ ...editingTemplate, body_html: html })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Etichetta CTA (opzionale)</Label>
                  <Input value={editingTemplate.cta_label} onChange={(e) => setEditingTemplate({ ...editingTemplate, cta_label: e.target.value })} placeholder="es. Scopri gli eventi" />
                </div>
                <div className="space-y-2">
                  <Label>Link CTA (opzionale)</Label>
                  <Input value={editingTemplate.cta_url} onChange={(e) => setEditingTemplate({ ...editingTemplate, cta_url: e.target.value })} placeholder="es. /events" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome mittente</Label>
                  <Input value={editingTemplate.sender_name} onChange={(e) => setEditingTemplate({ ...editingTemplate, sender_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Reply-to (opzionale)</Label>
                  <Input value={editingTemplate.reply_to} onChange={(e) => setEditingTemplate({ ...editingTemplate, reply_to: e.target.value })} placeholder="es. info@scampagnate.it" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => { setEditingTemplate(null); setIsCreating(false); }}>Annulla</Button>
                <Button
                  onClick={() => {
                    if (isCreating) {
                      const { id, created_at, updated_at, ...rest } = editingTemplate;
                      createMutation.mutate(rest);
                    } else {
                      updateMutation.mutate(editingTemplate);
                    }
                  }}
                  disabled={createMutation.isPending || updateMutation.isPending || !editingTemplate.name || !editingTemplate.template_key}
                >
                  {(createMutation.isPending || updateMutation.isPending) ? "Salvataggio..." : isCreating ? "Crea template" : "Salva modifiche"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewTemplate} onOpenChange={(open) => { if (!open) setPreviewTemplate(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Anteprima: {previewTemplate?.name}</span>
              <div className="flex items-center gap-2">
                <Button variant={previewViewport === "desktop" ? "default" : "outline"} size="sm" onClick={() => setPreviewViewport("desktop")}>
                  <Monitor className="h-4 w-4 mr-1" /> Desktop
                </Button>
                <Button variant={previewViewport === "mobile" ? "default" : "outline"} size="sm" onClick={() => setPreviewViewport("mobile")}>
                  <Smartphone className="h-4 w-4 mr-1" /> Mobile
                </Button>
              </div>
            </DialogTitle>
            <DialogDescription>
              Anteprima del template email nel layout desktop o mobile.
            </DialogDescription>
          </DialogHeader>
          {previewTemplate && <EmailPreview template={previewTemplate} viewport={previewViewport} />}
        </DialogContent>
      </Dialog>

      {/* Test Email Dialog */}
      <Dialog open={testEmailDialog} onOpenChange={setTestEmailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invia email di test</DialogTitle>
            <DialogDescription>
              Scegli un destinatario o inserisci manualmente un indirizzo email per il test.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Seleziona destinatario</Label>
              <Select value={testEmail} onValueChange={setTestEmail}>
                <SelectTrigger>
                  <SelectValue placeholder="Scegli un utente..." />
                </SelectTrigger>
                <SelectContent>
                  {users?.map((u) => (
                    <SelectItem key={u.id} value={u.email || ""}>
                      {u.first_name} {u.last_name} ({u.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Oppure inserisci email</Label>
              <Input type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="test@example.com" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setTestEmailDialog(false)}>Annulla</Button>
              <Button onClick={handleSendTest} disabled={!testEmail || sendingTest}>
                {sendingTest ? <><RefreshCw className="h-4 w-4 mr-1 animate-spin" /> Invio...</> : <><Send className="h-4 w-4 mr-1" /> Invia test</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Elimina template</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare il template "{deleteConfirm?.name}"? Questa azione non puÃ² essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Broadcast Modal */}
      <Dialog open={isBroadcastModalOpen} onOpenChange={(o) => {
        if (!o) {
          setIsBroadcastModalOpen(false);
          setBroadcastStep("template");
          setBroadcastFilters(DEFAULT_BROADCAST_FILTERS);
          setSelectedBroadcastTemplateId("");
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              Invia Broadcast Email
            </DialogTitle>
            <DialogDescription>
              Seleziona un template, filtra i destinatari e conferma l'invio della campagna email.
            </DialogDescription>
          </DialogHeader>

          {/* Stepper */}
          <div className="flex items-center justify-between mb-8 px-4">
            {[
              { id: "template", label: "Template" },
              { id: "filter", label: "Filtri utenti" },
              { id: "confirm", label: "Conferma invio" },
            ].map((s, idx) => (
              <div key={s.id} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-2">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    broadcastStep === s.id ? "bg-primary text-white shadow-md ring-2 ring-primary/20" : 
                    idx < ["template", "filter", "confirm"].indexOf(broadcastStep) ? "bg-success text-white" : "bg-muted text-muted-foreground"
                  }`}>
                    {idx < ["template", "filter", "confirm"].indexOf(broadcastStep) ? <Check className="h-4 w-4" /> : idx + 1}
                  </div>
                  <span className={`text-[10px] uppercase tracking-wider font-bold ${broadcastStep === s.id ? "text-primary" : "text-muted-foreground"}`}>{s.label}</span>
                </div>
                {idx < 2 && (
                  <div className={`h-[2px] mx-2 flex-1 transition-colors ${
                    idx < ["template", "filter", "confirm"].indexOf(broadcastStep) ? "bg-success" : "bg-muted"
                  }`} />
                )}
              </div>
            ))}
          </div>

          <div className="min-h-[300px] py-4">
            {broadcastStep === "template" && (
              <div className="space-y-6">
                <div>
                  <Label className="text-lg font-bold mb-4 block">Seleziona il template broadcast</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {templates?.filter((template) => template.type === "broadcast").map((template) => (
                      <Card
                        key={template.id}
                        className={`cursor-pointer transition-all hover:shadow-md ${selectedBroadcastTemplateId === template.id ? "ring-2 ring-primary border-primary bg-primary/5" : "border-muted"}`}
                        onClick={() => setSelectedBroadcastTemplateId(template.id)}
                      >
                        <CardContent className="p-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-muted rounded-full">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="font-semibold text-sm">{template.name}</p>
                              <p className="text-xs text-muted-foreground truncate max-w-[220px]">{template.subject}</p>
                            </div>
                          </div>
                          {selectedBroadcastTemplateId === template.id && <Check className="h-4 w-4 text-primary" />}
                        </CardContent>
                      </Card>
                    ))}
                    {templates?.filter((template) => template.type === "broadcast").length === 0 && (
                      <div className="col-span-2 py-8 text-center bg-muted/30 rounded-lg border border-dashed">
                        <p className="text-sm text-muted-foreground">Nessun template di tipo Broadcast trovato.</p>
                        <p className="text-xs text-muted-foreground mt-1">Crea un template con tipo "Broadcast" per inviare email massive.</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-between">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsCreating(true);
                      setEditingTemplate({
                        id: "",
                        template_key: `broadcast_email_${Date.now()}`,
                        name: "Broadcast Email",
                        subject: "",
                        preview_text: "",
                        body_html: "<p>Ciao {{first_name}},</p><p>{{event_suggestions}}</p>",
                        cta_label: "",
                        cta_url: "",
                        sender_name: "Scampagnate",
                        reply_to: "",
                        is_active: false,
                        type: "broadcast",
                        created_at: "",
                        updated_at: "",
                      });
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" /> Nuovo template Broadcast
                  </Button>
                  <Button onClick={() => setBroadcastStep("filter")} disabled={!selectedBroadcastTemplateId}>
                    Filtri utenti <Pencil className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {broadcastStep === "filter" && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card className={broadcastFilters.recipientMode === "all" ? "border-primary ring-2 ring-primary/10" : ""}>
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold">Invia a tutti</p>
                          <p className="text-sm text-muted-foreground">Invia il template a tutti gli utenti con email disponibile.</p>
                        </div>
                        <Button
                          variant={broadcastFilters.recipientMode === "all" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setBroadcastFilters({ ...broadcastFilters, recipientMode: "all" })}
                        >
                          Seleziona
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">Totale indirizzi disponibili: {emailableProfiles.length}</p>
                    </CardContent>
                  </Card>

                  <Card className={broadcastFilters.recipientMode === "filtered" ? "border-primary ring-2 ring-primary/10" : ""}>
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold">Invia a utenti selezionati</p>
                          <p className="text-sm text-muted-foreground">Applica i filtri obbligatori e consigliati per definire un sottoinsieme mirato.</p>
                        </div>
                        <Button
                          variant={broadcastFilters.recipientMode === "filtered" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setBroadcastFilters({ ...broadcastFilters, recipientMode: "filtered" })}
                        >
                          Seleziona
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">Numero destinatari con filtri correnti: {filteredRecipients.length}</p>
                    </CardContent>
                  </Card>
                </div>

                <div className={`space-y-8 ${broadcastFilters.recipientMode === "all" ? "opacity-60" : ""}`}>
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <Label className="text-sm font-bold uppercase tracking-widest text-primary/70">Filtri utenti</Label>
                        <div className="space-y-2">
                          <Label className="text-xs">Stato registrazione</Label>
                          <Select
                            value={broadcastFilters.registrationStatus}
                            onValueChange={(value: BroadcastRegistrationFilter) => setBroadcastFilters({ ...broadcastFilters, registrationStatus: value })}
                            disabled={broadcastFilters.recipientMode === "all"}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Tutti</SelectItem>
                              <SelectItem value="active">Solo attivi</SelectItem>
                              <SelectItem value="inactive">Solo inattivi</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs">Stato membership</Label>
                          <Select
                            value={broadcastFilters.membershipStatus}
                            onValueChange={(value: BroadcastMembershipFilter) => setBroadcastFilters({ ...broadcastFilters, membershipStatus: value })}
                            disabled={broadcastFilters.recipientMode === "all"}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Tutti</SelectItem>
                              <SelectItem value="active">Solo membership attive</SelectItem>
                              <SelectItem value="expired">Solo membership scadute</SelectItem>
                              <SelectItem value="inactive">Inattive o non presenti</SelectItem>
                              <SelectItem value="none">Solo non soci</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs">Ultima attività</Label>
                          <Select
                            value={broadcastFilters.lastActivityWindow}
                            onValueChange={(value: BroadcastLastActivityFilter) => setBroadcastFilters({ ...broadcastFilters, lastActivityWindow: value })}
                            disabled={broadcastFilters.recipientMode === "all"}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="any">Qualsiasi data</SelectItem>
                              <SelectItem value="30">Ultimi 30 giorni</SelectItem>
                              <SelectItem value="90">Ultimi 90 giorni</SelectItem>
                              <SelectItem value="180">Ultimi 180 giorni</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <Label className="text-sm font-bold uppercase tracking-widest text-primary/70">Partecipazione eventi</Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-xs">Numero eventi prenotati</Label>
                            <Input
                              type="number"
                              min={0}
                              value={broadcastFilters.minEventsJoined}
                              disabled={broadcastFilters.recipientMode === "all"}
                              onChange={(e) => setBroadcastFilters({ ...broadcastFilters, minEventsJoined: parseInt(e.target.value, 10) || 0 })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Numero eventi partecipati</Label>
                            <Input
                              type="number"
                              min={0}
                              value={broadcastFilters.minEventsAttended}
                              disabled={broadcastFilters.recipientMode === "all"}
                              onChange={(e) => setBroadcastFilters({ ...broadcastFilters, minEventsAttended: parseInt(e.target.value, 10) || 0 })}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs">Stato prenotazioni</Label>
                          <Select
                            value={broadcastFilters.bookingStatus}
                            onValueChange={(value: BroadcastBookingFilter) => setBroadcastFilters({ ...broadcastFilters, bookingStatus: value })}
                            disabled={broadcastFilters.recipientMode === "all"}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Tutte</SelectItem>
                              <SelectItem value="upcoming">Eventi futuri</SelectItem>
                              <SelectItem value="past">Eventi passati</SelectItem>
                              <SelectItem value="cancelled">Eventi cancellati</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="space-y-4">
                        <Label className="text-sm font-bold uppercase tracking-widest text-primary/70">Filtri consigliati</Label>
                        <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                          <div className="flex items-center space-x-3">
                            <Checkbox
                              checked={broadcastFilters.onlyNoShowUsers}
                              disabled={broadcastFilters.recipientMode === "all"}
                              onCheckedChange={(checked) => setBroadcastFilters({ ...broadcastFilters, onlyNoShowUsers: Boolean(checked) })}
                            />
                            <Label className="text-sm font-medium">Solo utenti con almeno un no-show</Label>
                          </div>
                          <div className="flex items-center space-x-3">
                            <Checkbox
                              checked={broadcastFilters.onlyFirstTimeUsers}
                              disabled={broadcastFilters.recipientMode === "all"}
                              onCheckedChange={(checked) => setBroadcastFilters({ ...broadcastFilters, onlyFirstTimeUsers: Boolean(checked) })}
                            />
                            <Label className="text-sm font-medium">Solo utenti alla prima esperienza</Label>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <Label className="text-sm font-bold uppercase tracking-widest text-primary/70">Interessi</Label>
                        <div className="flex flex-wrap gap-2">
                          {allInterests.length === 0 && (
                            <p className="text-sm text-muted-foreground">Nessun interesse disponibile.</p>
                          )}
                          {allInterests.map((interest) => (
                            <Badge
                              key={interest}
                              variant={broadcastFilters.interests.includes(interest) ? "default" : "outline"}
                              className={`cursor-pointer px-3 py-1 ${broadcastFilters.recipientMode === "all" ? "pointer-events-none" : ""}`}
                              onClick={() => {
                                if (broadcastFilters.recipientMode === "all") return;
                                const nextInterests = broadcastFilters.interests.includes(interest)
                                  ? broadcastFilters.interests.filter((item) => item !== interest)
                                  : [...broadcastFilters.interests, interest];
                                setBroadcastFilters({ ...broadcastFilters, interests: nextInterests });
                              }}
                            >
                              {interest}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <Card className="bg-primary/5 border-primary/10">
                        <CardContent className="p-5 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="bg-primary p-2 rounded-md">
                              <Users className="h-5 w-5 text-white" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-primary">
                                {broadcastFilters.recipientMode === "all" ? "Invia a tutti" : "Invia a utenti selezionati"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {broadcastFilters.recipientMode === "all" ? "Tutti gli utenti con un indirizzo email valido." : "Numero destinatari basato sui filtri impostati."}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-black text-primary">{finalRecipients.length}</p>
                            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Numero destinatari</p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between pt-4">
                  <Button variant="outline" onClick={() => setBroadcastStep("template")}>Indietro</Button>
                  <div className="flex gap-3">
                    <Button variant="ghost" onClick={() => setBroadcastFilters(DEFAULT_BROADCAST_FILTERS)}>Reset filtri</Button>
                    <Button onClick={() => setBroadcastStep("confirm")} disabled={finalRecipients.length === 0}>
                      Conferma invio <Check className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {broadcastStep === "confirm" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <Label className="text-lg font-bold">Riepilogo invio</Label>
                    <Card className="bg-muted/30">
                      <CardContent className="p-6 space-y-4">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Template:</span>
                          <span className="font-bold">{templates?.find((template) => template.id === selectedBroadcastTemplateId)?.name}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Oggetto:</span>
                          <span className="font-bold text-right ml-4">{templates?.find((template) => template.id === selectedBroadcastTemplateId)?.subject}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Modalità:</span>
                          <span className="font-bold">{broadcastFilters.recipientMode === "all" ? "Invia a tutti" : "Invia a utenti selezionati"}</span>
                        </div>
                        <div className="flex justify-between text-sm border-t pt-4">
                          <span className="text-muted-foreground">Numero destinatari:</span>
                          <span className="text-lg font-black text-primary">{finalRecipients.length}</span>
                        </div>
                        <div className="bg-amber-50 border border-amber-200 p-3 rounded text-amber-800 text-xs flex gap-2">
                          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                          <p>Stai per inviare questa email a {finalRecipients.length} utenti. Controlla l'anteprima e usa un test prima della conferma finale.</p>
                        </div>
                      </CardContent>
                    </Card>

                    <div className="space-y-2">
                      <Label>Invia test</Label>
                      <div className="flex gap-2">
                        <Input placeholder="email@test.it" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} className="bg-white" />
                        <Button variant="outline" size="sm" onClick={handleSendTest} disabled={sendingTest || !testEmail}>
                          {sendingTest ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    <div className="rounded-lg border p-4 space-y-2">
                      <p className="text-sm font-semibold">Destinatari campione</p>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        {finalRecipients.slice(0, 5).map((recipient) => (
                          <p key={recipient.id}>
                            {recipient.first_name} {recipient.last_name} ({recipient.email})
                          </p>
                        ))}
                        {finalRecipients.length > 5 && (
                          <p>+ altri {finalRecipients.length - 5} destinatari</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 lg:border-l lg:pl-8">
                    <Label className="text-lg font-bold">Anteprima</Label>
                    <div className="scale-[0.85] origin-top border rounded-lg shadow-sm">
                      {templates?.find((template) => template.id === selectedBroadcastTemplateId) && (
                        <EmailPreview
                          template={templates.find((template) => template.id === selectedBroadcastTemplateId)!}
                          viewport="desktop"
                        />
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-8 border-t">
                  <Button variant="outline" onClick={() => setBroadcastStep("filter")} disabled={isSendingBroadcast}>
                    Modifica filtri
                  </Button>
                  <div className="flex gap-3">
                    <Button variant="ghost" onClick={() => setIsBroadcastModalOpen(false)} disabled={isSendingBroadcast}>
                      Annulla
                    </Button>
                    <Button
                      className="bg-primary text-white hover:bg-primary/90 px-8 h-12 text-md font-bold shadow-lg"
                      onClick={handleSendBroadcast}
                      disabled={isSendingBroadcast || finalRecipients.length === 0}
                    >
                      {isSendingBroadcast ? (
                        <>
                          <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                          Invio in corso...
                        </>
                      ) : (
                        <>
                          <Send className="h-5 w-5 mr-2" />
                          Conferma invio
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
