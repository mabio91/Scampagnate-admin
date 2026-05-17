import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, CheckCircle2, Clock, ExternalLink, ImageIcon, Plus, Video } from "lucide-react";
import RefreshButton from "@/components/RefreshButton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { useLanguage } from "@/i18n/LanguageContext";
import { formatIssueMediaSize, getIssueMediaAttachments, signIssueMediaAttachments, type IssueMediaAttachment } from "@/lib/issueMedia";

type Issue = Tables<"issues">;

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

const priorityStyles: Record<string, string> = {
  high: "bg-destructive/10 text-destructive border-destructive/20",
  medium: "bg-warning/10 text-warning border-warning/20",
  low: "bg-muted text-muted-foreground",
};

const statusIcon: Record<string, typeof AlertTriangle> = {
  open: AlertTriangle,
  in_progress: Clock,
  resolved: CheckCircle2,
};

const statusBg: Record<string, string> = {
  open: "bg-destructive/10",
  in_progress: "bg-warning/10",
  resolved: "bg-success/10",
};

const statusText: Record<string, string> = {
  open: "text-destructive",
  in_progress: "text-warning",
  resolved: "text-success",
};

export default function IssuesPage() {
  const { t } = useLanguage();
  const [createOpen, setCreateOpen] = useState(false);
  const [resolveIssue, setResolveIssue] = useState<Issue | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [newIssue, setNewIssue] = useState({ title: "", description: "", priority: "medium" });
  const queryClient = useQueryClient();

  const { data: issues = [], isLoading } = useQuery({
    queryKey: ["admin-issues"],
    queryFn: async () => {
      const { data, error } = await supabase.from("issues").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const allAttachments = useMemo(
    () => issues.flatMap((issue) => getIssueMediaAttachments(issue.media_attachments)),
    [issues],
  );
  const mediaPaths = useMemo(() => allAttachments.map((attachment) => attachment.path), [allAttachments]);

  const { data: signedMediaUrls = {} } = useQuery({
    queryKey: ["admin-issue-media", mediaPaths],
    enabled: mediaPaths.length > 0,
    queryFn: () => signIssueMediaAttachments(supabase, allAttachments),
    staleTime: 45 * 60 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("issues").insert({
        title: newIssue.title,
        description: newIssue.description,
        priority: newIssue.priority,
        reporter_id: user.id,
        reporter_name: "Admin",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Issue created");
      queryClient.invalidateQueries({ queryKey: ["admin-issues"] });
      setCreateOpen(false);
      setNewIssue({ title: "", description: "", priority: "medium" });
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const update: Partial<Pick<Issue, "status" | "updated_at" | "resolved_at" | "resolved_by" | "resolution_notes">> = {
        status,
        updated_at: new Date().toISOString(),
      };
      if (status === "resolved") {
        update.resolved_at = new Date().toISOString();
        update.resolved_by = user?.id;
        update.resolution_notes = notes || "";
      }
      const { error } = await supabase.from("issues").update(update).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Issue updated");
      queryClient.invalidateQueries({ queryKey: ["admin-issues"] });
      setResolveIssue(null);
      setResolutionNotes("");
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("issues").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Issue deleted");
      queryClient.invalidateQueries({ queryKey: ["admin-issues"] });
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">{t("issues.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("issues.subtitle")} ({issues.length} {t("common.total").toLowerCase()})</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <RefreshButton queryKeys={[["admin-issues"]]} />
          <Button className="gap-2 flex-1 sm:flex-initial" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> {t("issues.reportIssue")}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : (
        <div className="space-y-3">
          {issues.map((issue) => {
            const StatusIcon = statusIcon[issue.status] || AlertTriangle;
            return (
              <Card key={issue.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className={`p-2 rounded-lg mt-0.5 ${statusBg[issue.status] || "bg-muted"}`}>
                        <StatusIcon className={`h-4 w-4 ${statusText[issue.status] || "text-muted-foreground"}`} />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold font-sans">{issue.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {t("issues.reportedBy")} <span className="font-medium text-foreground">{issue.reporter_name}</span>
                        </p>
                        {issue.description && <p className="text-sm text-muted-foreground mt-1">{issue.description}</p>}
                        <IssueMediaGrid
                          attachments={getIssueMediaAttachments(issue.media_attachments)}
                          signedUrls={signedMediaUrls}
                        />
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className={priorityStyles[issue.priority] || ""}>{issue.priority}</Badge>
                          <Badge variant="outline">{issue.status}</Badge>
                          <span className="text-xs text-muted-foreground">{new Date(issue.created_at).toLocaleDateString()}</span>
                        </div>
                        {issue.resolution_notes && (
                          <p className="text-xs mt-2 p-2 bg-success/5 rounded text-success border border-success/20">
                            {t("issues.resolution")}: {issue.resolution_notes}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0 flex-wrap">
                      {issue.status === "open" && (
                        <Button variant="outline" size="sm" onClick={() => updateStatus.mutate({ id: issue.id, status: "in_progress" })}>
                          <Clock className="h-3.5 w-3.5 mr-1" /> {t("issues.inProgress")}
                        </Button>
                      )}
                      {issue.status !== "resolved" && (
                        <Button size="sm" onClick={() => { setResolveIssue(issue); setResolutionNotes(""); }}>
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> {t("issues.resolve")}
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { if (confirm(t("issues.deleteConfirm"))) deleteMutation.mutate(issue.id); }}>
                        {t("common.delete")}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {issues.length === 0 && (
            <p className="text-muted-foreground text-center py-8">{t("issues.noIssues")}</p>
          )}
        </div>
      )}

      {/* Create Issue */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("issues.reportIssue")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>{t("issues.issueTitle")}</Label><Input value={newIssue.title} onChange={(e) => setNewIssue({ ...newIssue, title: e.target.value })} /></div>
            <div><Label>{t("common.description")}</Label><Textarea value={newIssue.description} onChange={(e) => setNewIssue({ ...newIssue, description: e.target.value })} rows={3} /></div>
            <div>
              <Label>{t("issues.priority")}</Label>
              <Select value={newIssue.priority} onValueChange={(v) => setNewIssue({ ...newIssue, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">{t("issues.low")}</SelectItem>
                  <SelectItem value="medium">{t("issues.medium")}</SelectItem>
                  <SelectItem value="high">{t("issues.high")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !newIssue.title}>
              {createMutation.isPending ? t("common.creating") : t("common.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resolve Issue */}
      <Dialog open={!!resolveIssue} onOpenChange={(o) => !o && setResolveIssue(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("issues.resolve")}: {resolveIssue?.title}</DialogTitle></DialogHeader>
          <div><Label>{t("issues.resolutionNotes")}</Label><Textarea value={resolutionNotes} onChange={(e) => setResolutionNotes(e.target.value)} rows={3} placeholder={t("issues.resolutionPlaceholder")} /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveIssue(null)}>{t("common.cancel")}</Button>
            <Button onClick={() => resolveIssue && updateStatus.mutate({ id: resolveIssue.id, status: "resolved", notes: resolutionNotes })} disabled={updateStatus.isPending}>
              {updateStatus.isPending ? t("issues.resolving") : t("issues.markResolved")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function IssueMediaGrid({
  attachments,
  signedUrls,
}: {
  attachments: IssueMediaAttachment[];
  signedUrls: Record<string, string>;
}) {
  if (attachments.length === 0) return null;

  return (
    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-w-4xl">
      {attachments.map((attachment) => {
        const signedUrl = signedUrls[attachment.path];
        const isVideo = attachment.type === "video";
        const MediaIcon = isVideo ? Video : ImageIcon;

        return (
          <div key={attachment.path} className="overflow-hidden rounded-lg border bg-muted/30">
            {signedUrl && isVideo ? (
              <video src={signedUrl} controls className="h-36 w-full bg-black object-cover" />
            ) : signedUrl ? (
              <a href={signedUrl} target="_blank" rel="noreferrer" className="block">
                <img src={signedUrl} alt={attachment.name} className="h-36 w-full object-cover" />
              </a>
            ) : (
              <div className="flex h-36 items-center justify-center bg-muted">
                <MediaIcon className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
            <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
              <MediaIcon className="h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{attachment.name}</span>
              <span className="shrink-0">{formatIssueMediaSize(attachment.size)}</span>
              {signedUrl && (
                <a href={signedUrl} target="_blank" rel="noreferrer" className="shrink-0 text-primary">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
