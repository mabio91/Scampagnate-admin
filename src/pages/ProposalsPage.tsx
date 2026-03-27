import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, MoreHorizontal, Eye, CalendarPlus, Archive, Trash2, Mail, Lightbulb, CheckCircle } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import RefreshButton from "@/components/RefreshButton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { useLanguage } from "@/i18n/LanguageContext";
import { useNavigate } from "react-router-dom";

type Proposal = Tables<"activity_proposals">;

const statusColors: Record<string, string> = {
  pending: "text-warning border-warning/30 bg-warning/10",
  approved: "text-success border-success/30 bg-success/10",
  converted: "text-primary border-primary/30 bg-primary/10",
  archived: "text-muted-foreground border-muted-foreground/30 bg-muted",
};

export default function ProposalsPage() {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [viewProposal, setViewProposal] = useState<Proposal | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ proposal: Proposal; action: "archive" } | null>(null);
  const [deleteProposal, setDeleteProposal] = useState<Proposal | null>(null);
  const [showDeleteAll, setShowDeleteAll] = useState(false);
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

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("activity_proposals")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-proposals"] });
      toast.success("Proposal deleted permanently");
      setDeleteProposal(null);
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

  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("activity_proposals")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000"); // delete all rows
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-proposals"] });
      toast.success("Tutte le proposte sono state eliminate");
      setShowDeleteAll(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleContactProposer = async (proposal: Proposal) => {
    if (!proposal.proposer_id) {
      toast.warning("Nessuna informazione di contatto disponibile");
      return;
    }
    // Fetch the proposer's phone from profiles
    const { data: profile } = await supabase
      .from("profiles")
      .select("phone")
      .eq("id", proposal.proposer_id)
      .single();

    if (profile?.phone) {
      const phone = profile.phone.replace(/[^0-9+]/g, "");
      const message = encodeURIComponent(`Ciao ${proposal.proposer_name}, riguardo la tua proposta "${proposal.activity_title}"...`);
      window.open(`https://wa.me/${phone}?text=${message}`, "_blank");
    } else {
      toast.warning("Nessun numero di telefono disponibile per questo utente");
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
          <h1 className="text-2xl md:text-3xl font-bold text-foreground font-display">{t("proposals.title")}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t("proposals.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton queryKeys={[["admin-proposals"]]} />
          {proposals.length > 0 && (
            <Button variant="destructive" size="sm" onClick={() => setShowDeleteAll(true)}>
              <Trash2 className="mr-2 h-4 w-4" /> Elimina tutte
            </Button>
          )}
          <Badge variant="outline" className="text-primary border-primary/30">
            {proposals.length} {t("common.total")}
          </Badge>
        </div>
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
                              <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: proposal.id, status: "approved" })}>
                                <CheckCircle className="mr-2 h-4 w-4" /> Approve
                              </DropdownMenuItem>
                            )}
                            {(proposal.status === "pending" || proposal.status === "approved") && (
                              <>
                                <DropdownMenuItem onClick={() => handleConvertToEvent(proposal)}>
                                  <CalendarPlus className="mr-2 h-4 w-4" /> Convert to Event
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setConfirmAction({ proposal, action: "archive" })}>
                                  <Archive className="mr-2 h-4 w-4" /> Archive
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuItem
                              onClick={() => setDeleteProposal(proposal)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Elimina
                            </DropdownMenuItem>
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

              <Separator />
              <div className="flex flex-wrap gap-2">
                {viewProposal.status === "pending" && (
                  <Button size="sm" variant="default" onClick={() => updateStatusMutation.mutate({ id: viewProposal.id, status: "approved" })}>
                    <CheckCircle className="mr-2 h-4 w-4" /> Approva
                  </Button>
                )}
                {(viewProposal.status === "pending" || viewProposal.status === "approved") && (
                  <>
                    <Button size="sm" onClick={() => handleConvertToEvent(viewProposal)}>
                      <CalendarPlus className="mr-2 h-4 w-4" /> Converti in Evento
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setConfirmAction({ proposal: viewProposal, action: "archive" })}>
                      <Archive className="mr-2 h-4 w-4" /> Archivia
                    </Button>
                  </>
                )}
                <Button size="sm" variant="outline" onClick={() => handleContactProposer(viewProposal)}>
                  <Mail className="mr-2 h-4 w-4" /> Contatta
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setDeleteProposal(viewProposal)}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Elimina
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm Archive Dialog */}
      <Dialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Archivia Proposta</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Sei sicuro di voler archiviare "{confirmAction?.proposal.activity_title}"?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>
              Annulla
            </Button>
            <Button
              onClick={() => {
                if (confirmAction) {
                  updateStatusMutation.mutate({
                    id: confirmAction.proposal.id,
                    status: "archived",
                  });
                }
              }}
              disabled={updateStatusMutation.isPending}
            >
              Archivia
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Dialog */}
      <AlertDialog open={!!deleteProposal} onOpenChange={() => setDeleteProposal(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Elimina Proposta</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione eliminerà permanentemente "{deleteProposal?.activity_title}". Non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteProposal) {
                  deleteMutation.mutate(deleteProposal.id);
                }
              }}
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Delete All Dialog */}
      <AlertDialog open={showDeleteAll} onOpenChange={setShowDeleteAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Elimina tutte le proposte</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione eliminerà permanentemente tutte le {proposals.length} proposte (incluse quelle convertite, approvate e archiviate). Non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteAllMutation.mutate()}
              disabled={deleteAllMutation.isPending}
            >
              {deleteAllMutation.isPending ? "Eliminazione..." : "Elimina tutte"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
