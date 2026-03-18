import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Clock, CheckCircle2, MessageSquare, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { useLanguage } from "@/i18n/LanguageContext";

type Issue = Tables<"issues">;

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
    onError: (e: any) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const update: any = { status, updated_at: new Date().toISOString() };
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
    onError: (e: any) => toast.error(e.message),
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
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">{t("issues.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("issues.subtitle")} ({issues.length} {t("common.total").toLowerCase()})</p>
        </div>
        <Button className="gap-2 w-full sm:w-auto" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> {t("issues.reportIssue")}
        </Button>
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
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className={priorityStyles[issue.priority] || ""}>{issue.priority}</Badge>
                          <Badge variant="outline">{issue.status}</Badge>
                          <span className="text-xs text-muted-foreground">{new Date(issue.created_at).toLocaleDateString()}</span>
                        </div>
                        {issue.resolution_notes && (
                          <p className="text-xs mt-2 p-2 bg-success/5 rounded text-success border border-success/20">
                            Resolution: {issue.resolution_notes}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0 flex-wrap">
                      {issue.status === "open" && (
                        <Button variant="outline" size="sm" onClick={() => updateStatus.mutate({ id: issue.id, status: "in_progress" })}>
                          <Clock className="h-3.5 w-3.5 mr-1" /> In Progress
                        </Button>
                      )}
                      {issue.status !== "resolved" && (
                        <Button size="sm" onClick={() => { setResolveIssue(issue); setResolutionNotes(""); }}>
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Resolve
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { if (confirm("Delete this issue?")) deleteMutation.mutate(issue.id); }}>
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {issues.length === 0 && (
            <p className="text-muted-foreground text-center py-8">No issues reported</p>
          )}
        </div>
      )}

      {/* Create Issue */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Report Issue</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Title</Label><Input value={newIssue.title} onChange={(e) => setNewIssue({ ...newIssue, title: e.target.value })} /></div>
            <div><Label>Description</Label><Textarea value={newIssue.description} onChange={(e) => setNewIssue({ ...newIssue, description: e.target.value })} rows={3} /></div>
            <div>
              <Label>Priority</Label>
              <Select value={newIssue.priority} onValueChange={(v) => setNewIssue({ ...newIssue, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !newIssue.title}>
              {createMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resolve Issue */}
      <Dialog open={!!resolveIssue} onOpenChange={(o) => !o && setResolveIssue(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Resolve: {resolveIssue?.title}</DialogTitle></DialogHeader>
          <div><Label>Resolution Notes</Label><Textarea value={resolutionNotes} onChange={(e) => setResolutionNotes(e.target.value)} rows={3} placeholder="Describe how the issue was resolved..." /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveIssue(null)}>Cancel</Button>
            <Button onClick={() => resolveIssue && updateStatus.mutate({ id: resolveIssue.id, status: "resolved", notes: resolutionNotes })} disabled={updateStatus.isPending}>
              {updateStatus.isPending ? "Resolving..." : "Mark Resolved"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
