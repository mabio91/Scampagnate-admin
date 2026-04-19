import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  const sampleVars = { first_name: "Marco", full_name: "Marco Rossi", email: "marco@example.com", cta_url: template.cta_url || "/events" };
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
          <p>Hai ricevuto questa email perché hai creato un account su Scampagnate.</p>
          <p>© {new Date().getFullYear()} Scampagnate. Tutti i diritti riservati.</p>
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

  // --- Broadcast Logic States ---
  const [broadcastStep, setBroadcastStep] = useState<"template" | "filter" | "confirm" | "sending">("template");
  const [selectedBroadcastTemplateId, setSelectedBroadcastTemplateId] = useState<string>("");
  const [broadcastFilters, setBroadcastFilters] = useState({
    registrationStatus: "All",
    membershipStatus: "All",
    minEventsJoined: 0,
    minEventsAttended: 0,
    bookingStatus: "All", // Upcoming, Past, Cancelled
    interests: [] as string[],
  });
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);

  // Fetch all user profiles for filtering
  const { data: allProfiles = [] } = useQuery({
    queryKey: ["all-profiles-for-broadcast"],
    enabled: isBroadcastModalOpen,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email, account_status, membership_status, interests, created_at");
      if (error) throw error;
      return data;
    },
  });

  // Fetch registration stats for all users
  const { data: userRegStats = {} } = useQuery({
    queryKey: ["user-reg-stats-for-broadcast"],
    enabled: isBroadcastModalOpen,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_registrations")
        .select("user_id, status, checked_in, events(date, status)");
      if (error) throw error;

      const stats: Record<string, { joined: number; attended: number; hasUpcoming: boolean; hasCancelled: boolean }> = {};
      const now = new Date().toISOString();

      data?.forEach((reg: any) => {
        if (!stats[reg.user_id]) {
          stats[reg.user_id] = { joined: 0, attended: 0, hasUpcoming: false, hasCancelled: false };
        }
        
        const s = stats[reg.user_id];
        if (reg.status === "paid" || reg.status === "registered") {
          s.joined++;
          if (reg.events?.date && reg.events.date > now) s.hasUpcoming = true;
        }
        if (reg.checked_in || reg.status === "attended") {
          s.attended++;
        }
        if (reg.status === "cancelled") {
          s.hasCancelled = true;
        }
      });
      return stats;
    },
  });

  const filteredRecipients = allProfiles.filter((p) => {
    const stats = userRegStats[p.id] || { joined: 0, attended: 0, hasUpcoming: false, hasCancelled: false };

    if (broadcastFilters.registrationStatus !== "All" && p.account_status !== broadcastFilters.registrationStatus) return false;
    if (broadcastFilters.membershipStatus !== "All" && p.membership_status !== broadcastFilters.membershipStatus) return false;
    if (stats.joined < broadcastFilters.minEventsJoined) return false;
    if (stats.attended < broadcastFilters.minEventsAttended) return false;

    if (broadcastFilters.bookingStatus === "Upcoming" && !stats.hasUpcoming) return false;
    if (broadcastFilters.bookingStatus === "Cancelled" && !stats.hasCancelled) return false;
    // ... add more filter logic as needed

    if (broadcastFilters.interests.length > 0) {
      const userInterests = p.interests || [];
      if (!broadcastFilters.interests.some(interest => userInterests.includes(interest))) return false;
    }

    return true;
  });

  const [isSendingBroadcast, setIsSendingBroadcast] = useState(false);
  const handleSendBroadcast = async () => {
    if (!selectedBroadcastTemplateId || filteredRecipients.length === 0) return;
    setIsSendingBroadcast(true);
    try {
      const headers = await getFunctionHeaders();
      const { data, error } = await supabase.functions.invoke("send-broadcast-email", {
        headers,
        body: { 
          templateId: selectedBroadcastTemplateId, 
          userIds: filteredRecipients.map(r => r.id) 
        },
      });
      if (error) throw error;
      toast.success(`Broadcast inviato con successo a ${filteredRecipients.length} utenti`);
      setIsBroadcastModalOpen(false);
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
              <p className="text-sm font-semibold text-foreground">{activeTemplate?.reply_to || "—"}</p>
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
                <Shield className="h-3 w-3 mr-1" /> SPF: {domainStatus?.records?.find((r: any) => r.type === "TXT" && r.name.includes("_spf"))?.status || "—"}
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
                  <p className="font-medium">{tpl.sender_name || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">CTA:</span>
                  <p className="font-medium">{tpl.cta_label || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Reply-to:</span>
                  <p className="font-medium">{tpl.reply_to || "—"}</p>
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
                <p className="text-xs text-muted-foreground">Variabili disponibili: {"{{first_name}}"}, {"{{full_name}}"}, {"{{email}}"}, {"{{cta_url}}"}</p>
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
              Sei sicuro di voler eliminare il template "{deleteConfirm?.name}"? Questa azione non può essere annullata.
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
      <Dialog open={isBroadcastModalOpen} onOpenChange={(o) => { if (!o) { setIsBroadcastModalOpen(false); setBroadcastStep("template"); } }}>
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
              { id: "filter", label: "Filtri Destinatari" },
              { id: "confirm", label: "Anteprima & Conferma" },
            ].map((s, idx) => (
              <div key={s.id} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-2 relative">
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
                  <Label className="text-lg font-bold mb-4 block">1. Seleziona il template per l'invio</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {templates?.filter(t => t.type === "broadcast").map((t) => (
                      <Card 
                        key={t.id} 
                        className={`cursor-pointer transition-all hover:shadow-md ${selectedBroadcastTemplateId === t.id ? "ring-2 ring-primary border-primary bg-primary/5" : "border-muted"}`}
                        onClick={() => setSelectedBroadcastTemplateId(t.id)}
                      >
                        <CardContent className="p-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-muted rounded-full">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="font-semibold text-sm">{t.name}</p>
                              <p className="text-xs text-muted-foreground truncate max-w-[200px]">{t.subject}</p>
                            </div>
                          </div>
                          {selectedBroadcastTemplateId === t.id && <Check className="h-4 w-4 text-primary" />}
                        </CardContent>
                      </Card>
                    ))}
                    {templates?.filter(t => t.type === "broadcast").length === 0 && (
                      <div className="col-span-2 py-8 text-center bg-muted/30 rounded-lg border border-dashed">
                        <p className="text-sm text-muted-foreground">Nessun template di tipo "Broadcast" trovato.</p>
                        <p className="text-xs text-muted-foreground mt-1">Crea o modifica un template impostando il tipo su "Broadcast".</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={() => setBroadcastStep("filter")} disabled={!selectedBroadcastTemplateId}>
                    Continua ai filtri <Pencil className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {broadcastStep === "filter" && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Filter Section 1: Membership & Status */}
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <Label className="text-sm font-bold uppercase tracking-widest text-primary/70">Stato & Membership</Label>
                      <div className="space-y-2">
                        <Label className="text-xs">Stato Account</Label>
                        <Select value={broadcastFilters.registrationStatus} onValueChange={(v) => setBroadcastFilters({...broadcastFilters, registrationStatus: v})}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="All">Tutti gli stati</SelectItem>
                            <SelectItem value="Active">Solo Attivi</SelectItem>
                            <SelectItem value="Suspended">Solo Sospesi</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Stato Membership</Label>
                        <Select value={broadcastFilters.membershipStatus} onValueChange={(v) => setBroadcastFilters({...broadcastFilters, membershipStatus: v})}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="All">Tutti (Soci e non)</SelectItem>
                            <SelectItem value="Active">Solo Soci Attivi</SelectItem>
                            <SelectItem value="Expired">Solo Membership Scadute</SelectItem>
                            <SelectItem value="None">Solo Non Soci</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-4 pt-2">
                      <Label className="text-sm font-bold uppercase tracking-widest text-primary/70">Interessi</Label>
                      <div className="flex flex-wrap gap-2">
                        {["Trekking", "Cultura", "Enogastronomia", "Workshop", "Famiglie"].map((interest) => (
                          <Badge 
                            key={interest}
                            variant={broadcastFilters.interests.includes(interest) ? "default" : "outline"}
                            className="cursor-pointer px-3 py-1"
                            onClick={() => {
                              const news = broadcastFilters.interests.includes(interest) 
                                ? broadcastFilters.interests.filter(i => i !== interest)
                                : [...broadcastFilters.interests, interest];
                              setBroadcastFilters({...broadcastFilters, interests: news});
                            }}
                          >
                            {interest}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Filter Section 2: Activity & Participation */}
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <Label className="text-sm font-bold uppercase tracking-widest text-primary/70">Attività & Partecipazione</Label>
                      <div className="space-y-2">
                        <Label className="text-xs">Eventi a cui si è unito (Minimo: {broadcastFilters.minEventsJoined})</Label>
                        <Input 
                          type="number" 
                          min={0} 
                          value={broadcastFilters.minEventsJoined} 
                          onChange={(e) => setBroadcastFilters({...broadcastFilters, minEventsJoined: parseInt(e.target.value) || 0})} 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Eventi effettivamente partecipati (Minimo: {broadcastFilters.minEventsAttended})</Label>
                        <Input 
                          type="number" 
                          min={0} 
                          value={broadcastFilters.minEventsAttended} 
                          onChange={(e) => setBroadcastFilters({...broadcastFilters, minEventsAttended: parseInt(e.target.value) || 0})} 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Stato Prenotazioni</Label>
                        <Select value={broadcastFilters.bookingStatus} onValueChange={(v) => setBroadcastFilters({...broadcastFilters, bookingStatus: v})}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="All">Tutti</SelectItem>
                            <SelectItem value="Upcoming">Ha eventi in programma</SelectItem>
                            <SelectItem value="Cancelled">Ha cancellato recentemente</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="bg-primary/5 p-4 rounded-lg flex items-center justify-between border border-primary/10">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary p-2 rounded-md">
                      <Users className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-primary">Destinatari selezionati</p>
                      <p className="text-xs text-muted-foreground">Basato sui filtri impostati</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-primary">{filteredRecipients.length}</p>
                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Utenti totali</p>
                  </div>
                </div>

                <div className="flex justify-between pt-4">
                  <Button variant="outline" onClick={() => setBroadcastStep("template")}>Indietro</Button>
                  <Button onClick={() => setBroadcastStep("confirm")} disabled={filteredRecipients.length === 0}>
                    Continua alla conferma <Check className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {broadcastStep === "confirm" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Summary card */}
                  <div className="space-y-4">
                    <Label className="text-lg font-bold">Riepilogo Invio</Label>
                    <Card className="bg-muted/30">
                      <CardContent className="p-6 space-y-4">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Template:</span>
                          <span className="font-bold">{templates?.find(t => t.id === selectedBroadcastTemplateId)?.name}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Oggetto:</span>
                          <span className="font-bold text-right ml-4">{templates?.find(t => t.id === selectedBroadcastTemplateId)?.subject}</span>
                        </div>
                        <div className="flex justify-between text-sm border-t pt-4">
                          <span className="text-muted-foreground">Destinatari:</span>
                          <span className="text-lg font-black text-primary">{filteredRecipients.length} utenti</span>
                        </div>
                        <div className="bg-amber-50 border border-amber-200 p-3 rounded text-amber-800 text-xs flex gap-2">
                          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                          <p>Questa email verrà inviata immediatamente a tutti gli utenti selezionati. Assicurati che il contenuto sia corretto tramite l'anteprima a destra.</p>
                        </div>
                      </CardContent>
                    </Card>

                    <div className="space-y-2">
                      <Label>Invia un test rapido</Label>
                      <div className="flex gap-2">
                        <Input placeholder="email@test.it" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} className="bg-white" />
                        <Button variant="outline" size="sm" onClick={handleSendTest} disabled={sendingTest || !testEmail}>
                          {sendingTest ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Mini Preview */}
                  <div className="space-y-4 lg:border-l lg:pl-8">
                    <Label className="text-lg font-bold">Anteprima Contenuto</Label>
                    <div className="scale-[0.85] origin-top border rounded-lg shadow-sm">
                      {templates?.find(t => t.id === selectedBroadcastTemplateId) && (
                        <EmailPreview 
                          template={templates.find(t => t.id === selectedBroadcastTemplateId)!} 
                          viewport="desktop" 
                        />
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-8 border-t">
                  <Button variant="outline" onClick={() => setBroadcastStep("filter")} disabled={isSendingBroadcast}>Modifica Filtri</Button>
                  <div className="flex gap-3">
                    <Button variant="ghost" onClick={() => setIsBroadcastModalOpen(false)} disabled={isSendingBroadcast}>Annulla</Button>
                    <Button 
                      className="bg-primary text-white hover:bg-primary/90 px-8 h-12 text-md font-bold shadow-lg"
                      onClick={handleSendBroadcast}
                      disabled={isSendingBroadcast}
                    >
                      {isSendingBroadcast ? (
                        <>
                          <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                          Invio in corso...
                        </>
                      ) : (
                        <>
                          <Send className="h-5 w-5 mr-2" />
                          CONFERMA E INVIA ORA
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
