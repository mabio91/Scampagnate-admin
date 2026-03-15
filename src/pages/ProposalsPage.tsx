import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, MoreHorizontal, Eye, CalendarPlus, Archive, Trash2, Mail, Lightbulb } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { useNavigate } from "react-router-dom";

type Proposal = Tables<"activity_proposals">;

const statusColors: Record<string, string> = {
  pending: "text-warning border-warning/30 bg-warning/10",
  approved: "text-success border-success/30 bg-success/10",
  converted: "text-primary border-primary/30 bg-primary/10",
  archived: "text-muted-foreground border-muted-foreground/30 bg-muted",
  discarded: "text-destructive border-destructive/30 bg-destructive/10",
};

export default function ProposalsPage() {
  const [search, setSearch] = useState("");
  const [viewProposal, setViewProposal] = useState<Proposal | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ proposal: Proposal; action: "archive" | "discard" } | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: proposals = [], isLoading } = useQuery({
    queryKey: ["admin-proposals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_proposals")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Proposal[];
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("activity_proposals")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-proposals"] });
      toast.success("Proposal updated successfully");
      setConfirmAction(null);
      setViewProposal(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleConvertToEvent = (proposal: Proposal) => {
    // Navigate to events page with proposal data as state
    navigate("/events", {
      state: {
        convertProposal: {
          title: proposal.activity_title,
          description: proposal.description,
          location: proposal.location,
          date: proposal.suggested_date || "",
          time: proposal.suggested_time || "09:00",
          spots_total: proposal.max_participants || 20,
        },
        proposalId: proposal.id,
      },
    });
  };

  const handleContactProposer = (proposal: Proposal) => {
    if (proposal.proposer_id) {
      // Open mailto or navigate to a contact method
      toast.info(`Contact proposer: ${proposal.proposer_name}`);
    } else {
      toast.warning("No contact information available for this proposer");
    }
  };

  const filtered = proposals.filter(
    (p) =>
      p.activity_title.toLowerCase().includes(search.toLowerCase()) ||
      p.proposer_name.toLowerCase().includes(search.toLowerCase()) ||
      p.location.toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("it-IT", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-display">Activity Proposals</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Review and manage activity proposals submitted by members
          </p>
        </div>
        <Badge variant="outline" className="text-primary border-primary/30">
          {proposals.length} Total
        </Badge>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search proposals by title, proposer, or location..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Lightbulb className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No proposals found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Activity Title</TableHead>
                    <TableHead>Proposer</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Suggested Date</TableHead>
                    <TableHead>Participants</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((proposal) => (
                    <TableRow key={proposal.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setViewProposal(proposal)}>
                      <TableCell className="font-medium">{proposal.activity_title}</TableCell>
                      <TableCell>{proposal.proposer_name}</TableCell>
                      <TableCell className="text-muted-foreground">{proposal.location || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {proposal.suggested_date || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {proposal.max_participants ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusColors[proposal.status] || ""}>
                          {proposal.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {formatDate(proposal.created_at)}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setViewProposal(proposal)}>
                              <Eye className="mr-2 h-4 w-4" /> View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleContactProposer(proposal)}>
                              <Mail className="mr-2 h-4 w-4" /> Contact Proposer
                            </DropdownMenuItem>
                            {proposal.status === "pending" && (
                              <>
                                <DropdownMenuItem onClick={() => handleConvertToEvent(proposal)}>
                                  <CalendarPlus className="mr-2 h-4 w-4" /> Convert to Event
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setConfirmAction({ proposal, action: "archive" })}>
                                  <Archive className="mr-2 h-4 w-4" /> Archive
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setConfirmAction({ proposal, action: "discard" })}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" /> Discard
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Proposal Dialog */}
      <Dialog open={!!viewProposal} onOpenChange={() => setViewProposal(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-display">{viewProposal?.activity_title}</DialogTitle>
          </DialogHeader>
          {viewProposal && (
            <div className="space-y-4 overflow-y-auto pr-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={statusColors[viewProposal.status] || ""}>
                  {viewProposal.status}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Submitted {formatDate(viewProposal.created_at)}
                </span>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Proposer</p>
                  <p className="font-medium">{viewProposal.proposer_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Location</p>
                  <p className="font-medium">{viewProposal.location || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Suggested Date</p>
                  <p className="font-medium">{viewProposal.suggested_date || "Not specified"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Suggested Time</p>
                  <p className="font-medium">{viewProposal.suggested_time || "Not specified"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Max Participants</p>
                  <p className="font-medium">{viewProposal.max_participants ?? "Not specified"}</p>
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-muted-foreground text-xs mb-1">Description</p>
                <p className="text-sm leading-relaxed">{viewProposal.description || "No description provided."}</p>
              </div>

              {viewProposal.status === "pending" && (
                <>
                  <Separator />
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => handleConvertToEvent(viewProposal)}>
                      <CalendarPlus className="mr-2 h-4 w-4" /> Convert to Event
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleContactProposer(viewProposal)}>
                      <Mail className="mr-2 h-4 w-4" /> Contact Proposer
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setConfirmAction({ proposal: viewProposal, action: "archive" })}
                    >
                      <Archive className="mr-2 h-4 w-4" /> Archive
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setConfirmAction({ proposal: viewProposal, action: "discard" })}
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Discard
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm Archive/Discard Dialog */}
      <Dialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {confirmAction?.action === "archive" ? "Archive Proposal" : "Discard Proposal"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {confirmAction?.action === "archive"
              ? `Are you sure you want to archive "${confirmAction?.proposal.activity_title}"? You can still view it later.`
              : `Are you sure you want to discard "${confirmAction?.proposal.activity_title}"? This marks it as rejected.`}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>
              Cancel
            </Button>
            <Button
              variant={confirmAction?.action === "discard" ? "destructive" : "default"}
              onClick={() => {
                if (confirmAction) {
                  updateStatusMutation.mutate({
                    id: confirmAction.proposal.id,
                    status: confirmAction.action === "archive" ? "archived" : "discarded",
                  });
                }
              }}
              disabled={updateStatusMutation.isPending}
            >
              {confirmAction?.action === "archive" ? "Archive" : "Discard"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
