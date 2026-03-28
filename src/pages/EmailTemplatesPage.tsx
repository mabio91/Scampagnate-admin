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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Mail, Eye, Send, Pencil, Check, Smartphone, Monitor, RefreshCw, Shield, ShieldCheck, ShieldAlert, Settings2, Plus, Trash2, Copy } from "lucide-react";
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
  created_at: string;
  updated_at: string;
}

function replaceVariables(html: string, vars: Record<string, string>) {
  let result = html;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  // Fallback: if {{first_name}} wasn't replaced, use generic
  if (result.includes("{{first_name}}")) {
    result = result.replace(/Ciao \{\{first_name\}\}/g, "Ciao");
  }
  return result;
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
    if (!testEmail || !testTemplateId) return;
    setSendingTest(true);
    try {
      const { error } = await supabase.functions.invoke("send-welcome-email", {
        body: { templateId: testTemplateId, recipientEmail: testEmail, isTest: true },
      });
      if (error) throw error;
      toast.success(`Email di test inviata a ${testEmail}`);
      setTestEmailDialog(false);
    } catch (e: any) {
      toast.error(e.message || "Errore nell'invio dell'email di test");
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
            <p className="text-sm text-muted-foreground">Gestisci i template delle email</p>
          </div>
        </div>
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
                <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                  <ShieldAlert className="h-3 w-3 mr-1" /> Da verificare su Resend
                </Badge>
              </p>
            </div>
          </div>
          <Separator />
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mr-2">DNS Records:</span>
            <Badge variant="outline" className="text-muted-foreground border-muted">
              <Shield className="h-3 w-3 mr-1" /> SPF: In attesa
            </Badge>
            <Badge variant="outline" className="text-muted-foreground border-muted">
              <Shield className="h-3 w-3 mr-1" /> DKIM: In attesa
            </Badge>
            <Badge variant="outline" className="text-muted-foreground border-muted">
              <Shield className="h-3 w-3 mr-1" /> DMARC: In attesa
            </Badge>
            <span className="text-xs text-muted-foreground ml-2">
              Verifica il dominio su <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer" className="underline text-primary hover:text-primary/80">resend.com/domains</a>
            </span>
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
              <div className="space-y-2">
                <Label>Oggetto email</Label>
                <Input value={editingTemplate.subject} onChange={(e) => setEditingTemplate({ ...editingTemplate, subject: e.target.value })} />
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
          </DialogHeader>
          {previewTemplate && <EmailPreview template={previewTemplate} viewport={previewViewport} />}
        </DialogContent>
      </Dialog>

      {/* Test Email Dialog */}
      <Dialog open={testEmailDialog} onOpenChange={setTestEmailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invia email di test</DialogTitle>
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
    </div>
  );
}
