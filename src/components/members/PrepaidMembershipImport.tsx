import { ChangeEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Clock, FileSpreadsheet, Link2, Search, Upload, UserCheck, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";
import { parsePrepaidMembershipCsv, type PrepaidMembershipImportError, type PrepaidMembershipImportRow } from "@/lib/prepaidMembershipImport";
import { formatMembershipId } from "@/lib/membership";
import { toast } from "sonner";

type Profile = Tables<"profiles">;

type PrepaidMembershipStatus = "pending_user" | "activated" | "needs_review" | "duplicate" | "error";

type PrepaidMembership = Omit<Tables<"prepaid_memberships">, "status"> & {
  status: PrepaidMembershipStatus;
};

type ImportSummary = {
  batch_id: string;
  total: number;
  inserted: number;
  updated: number;
  activated: number;
  pending: number;
  needs_review: number;
  invalid: number;
  already_activated: number;
  errors: number;
};

const statusConfig: Record<PrepaidMembershipStatus, { label: string; className: string; icon: typeof Clock }> = {
  pending_user: { label: "In attesa utente", className: "bg-amber-500/10 text-amber-700 border-amber-500/30", icon: Clock },
  activated: { label: "Attivata", className: "bg-green-500/10 text-green-700 border-green-500/30", icon: CheckCircle2 },
  needs_review: { label: "Da verificare", className: "bg-orange-500/10 text-orange-700 border-orange-500/30", icon: AlertTriangle },
  duplicate: { label: "Duplicata", className: "bg-muted text-muted-foreground border-border", icon: XCircle },
  error: { label: "Errore", className: "bg-destructive/10 text-destructive border-destructive/30", icon: XCircle },
};

const formatDate = (value: string | null) => {
  if (!value) return "-";
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
};

const compactName = (firstName?: string | null, lastName?: string | null) =>
  [firstName, lastName].filter(Boolean).join(" ").trim() || "-";

export function PrepaidMembershipImport({ members }: { members: Profile[] }) {
  const queryClient = useQueryClient();
  const [batchLabel, setBatchLabel] = useState("");
  const [csvPreview, setCsvPreview] = useState<PrepaidMembershipImportRow[]>([]);
  const [csvErrors, setCsvErrors] = useState<PrepaidMembershipImportError[]>([]);
  const [csvFileName, setCsvFileName] = useState("");
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [search, setSearch] = useState("");
  const [selectedPrepaid, setSelectedPrepaid] = useState<PrepaidMembership | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");

  const membersById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);

  const { data: prepaidMemberships = [], isLoading } = useQuery({
    queryKey: ["prepaid-memberships"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prepaid_memberships")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as PrepaidMembership[];
    },
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("admin_import_prepaid_memberships", {
        p_rows: csvPreview as unknown as Json,
        p_batch_label: batchLabel.trim() || csvFileName || null,
      });
      if (error) throw error;
      return data as unknown as ImportSummary;
    },
    onSuccess: (summary) => {
      setImportSummary(summary);
      queryClient.invalidateQueries({ queryKey: ["prepaid-memberships"] });
      queryClient.invalidateQueries({ queryKey: ["admin-members"] });
      queryClient.invalidateQueries({ queryKey: ["all-user-badges"] });
      toast.success(`Import completato: ${summary.activated} attivate, ${summary.pending} in attesa.`);
    },
    onError: (error: Error) => toast.error(error.message || "Import non riuscito"),
  });

  const activateMutation = useMutation({
    mutationFn: async ({ prepaidId, userId }: { prepaidId: string; userId: string }) => {
      const { data, error } = await supabase.rpc("admin_activate_prepaid_membership", {
        p_prepaid_id: prepaidId,
        p_user_id: userId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Membership prepagata associata e attivata");
      setSelectedPrepaid(null);
      setSelectedUserId("");
      setUserSearch("");
      queryClient.invalidateQueries({ queryKey: ["prepaid-memberships"] });
      queryClient.invalidateQueries({ queryKey: ["admin-members"] });
      queryClient.invalidateQueries({ queryKey: ["all-user-badges"] });
    },
    onError: (error: Error) => toast.error(error.message || "Associazione non riuscita"),
  });

  const handleCsvUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const result = parsePrepaidMembershipCsv(text);
    setCsvFileName(file.name);
    setBatchLabel(file.name.replace(/\.csv$/i, ""));
    setCsvPreview(result.rows);
    setCsvErrors(result.errors);
    setImportSummary(null);
    event.target.value = "";
  };

  const filteredPrepaid = prepaidMemberships.filter((row) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    const matchedProfile = row.matched_user_id ? membersById.get(row.matched_user_id) : null;
    return [
      row.email,
      row.first_name,
      row.last_name,
      row.status,
      row.error_message || "",
      matchedProfile?.first_name || "",
      matchedProfile?.last_name || "",
      matchedProfile?.email || "",
    ].some((value) => value.toLowerCase().includes(term));
  });

  const userCandidates = useMemo(() => {
    const term = userSearch.trim().toLowerCase();
    if (!term) return members.slice(0, 8);
    return members
      .filter((member) =>
        [
          member.first_name,
          member.last_name,
          member.email || "",
          member.phone || "",
          member.membership_id ? String(member.membership_id) : "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(term)
      )
      .slice(0, 10);
  }, [members, userSearch]);

  const pendingCount = prepaidMemberships.filter((row) => row.status === "pending_user").length;
  const reviewCount = prepaidMemberships.filter((row) => row.status === "needs_review" || row.status === "error").length;
  const activatedCount = prepaidMemberships.filter((row) => row.status === "activated").length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Import membership prepagate
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Carica il CSV dei pagamenti offline: le email gia registrate vengono attivate, le altre restano in attesa.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-md border px-3 py-2">
              <div className="text-base font-bold text-green-600">{activatedCount}</div>
              <div className="text-muted-foreground">attivate</div>
            </div>
            <div className="rounded-md border px-3 py-2">
              <div className="text-base font-bold text-amber-600">{pendingCount}</div>
              <div className="text-muted-foreground">pending</div>
            </div>
            <div className="rounded-md border px-3 py-2">
              <div className="text-base font-bold text-orange-600">{reviewCount}</div>
              <div className="text-muted-foreground">review</div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div className="space-y-2">
            <Label htmlFor="prepaid-csv">CSV membership prepagate</Label>
            <Input id="prepaid-csv" type="file" accept=".csv,text/csv" onChange={handleCsvUpload} />
            <p className="text-xs text-muted-foreground">
              Header riconosciuti: email, nome, cognome, telefono, data nascita, luogo nascita, provincia nascita,
              indirizzo residenza, citta residenza, provincia residenza, data pagamento, anno tessera, note.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="prepaid-batch">Nome batch</Label>
            <Input
              id="prepaid-batch"
              value={batchLabel}
              onChange={(event) => setBatchLabel(event.target.value)}
              placeholder="es. Soci offline maggio"
            />
          </div>
        </div>

        {csvPreview.length > 0 && (
          <div className="rounded-md border bg-muted/20 p-4 space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">{csvPreview.length} righe pronte per l'import</p>
                <p className="text-xs text-muted-foreground">
                  {csvFileName ? `${csvFileName} - ` : ""}
                  {csvErrors.length > 0 ? `${csvErrors.length} avvisi da controllare` : "Nessun errore rilevato nella lettura CSV"}
                </p>
              </div>
              <Button onClick={() => importMutation.mutate()} disabled={importMutation.isPending || csvPreview.length === 0} className="gap-2">
                <Upload className="h-4 w-4" />
                {importMutation.isPending ? "Import in corso..." : "Importa CSV"}
              </Button>
            </div>
            {csvErrors.length > 0 && (
              <div className="rounded-md border border-orange-500/30 bg-orange-500/10 p-3 text-xs text-orange-700 space-y-1">
                {csvErrors.slice(0, 5).map((error) => (
                  <p key={`${error.row}-${error.message}`}>Riga {error.row}: {error.message}</p>
                ))}
                {csvErrors.length > 5 && <p>Altri {csvErrors.length - 5} avvisi non mostrati.</p>}
              </div>
            )}
            <Textarea
              readOnly
              className="h-24 font-mono text-xs"
              value={csvPreview
                .slice(0, 4)
                .map((row) => `${row.email}; ${compactName(row.first_name, row.last_name)}; ${row.birth_date || "-"}; ${row.city_of_residence || "-"}`)
                .join("\n")}
            />
          </div>
        )}

        {importSummary && (
          <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-7">
            {[
              ["Totale", importSummary.total],
              ["Inserite", importSummary.inserted],
              ["Aggiornate", importSummary.updated],
              ["Attivate", importSummary.activated],
              ["Pending", importSummary.pending],
              ["Review", importSummary.needs_review],
              ["Errori", importSummary.errors + importSummary.invalid],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md border px-3 py-2">
                <div className="text-base font-bold">{value}</div>
                <div className="text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cerca import per email, nome o stato..."
              className="pl-9"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["prepaid-memberships"] })}
          >
            Aggiorna import
          </Button>
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-12" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email pagante</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Anno</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Utente associato</TableHead>
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPrepaid.map((row) => {
                  const config = statusConfig[row.status] || statusConfig.error;
                  const Icon = config.icon;
                  const matchedProfile = row.matched_user_id ? membersById.get(row.matched_user_id) : null;
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs">{row.email}</TableCell>
                      <TableCell>{compactName(row.first_name, row.last_name)}</TableCell>
                      <TableCell>{row.membership_year}</TableCell>
                      <TableCell>{formatDate(row.payment_date)}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge variant="outline" className={`gap-1 ${config.className}`}>
                            <Icon className="h-3 w-3" />
                            {config.label}
                          </Badge>
                          {row.error_message && <p className="max-w-[260px] text-xs text-muted-foreground">{row.error_message}</p>}
                        </div>
                      </TableCell>
                      <TableCell>
                        {matchedProfile ? (
                          <div className="text-sm">
                            <div className="font-medium">{compactName(matchedProfile.first_name, matchedProfile.last_name)}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatMembershipId(matchedProfile.membership_id)} · {matchedProfile.email}
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.status !== "activated" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            onClick={() => {
                              setSelectedPrepaid(row);
                              setUserSearch(row.email);
                              setSelectedUserId("");
                            }}
                          >
                            <Link2 className="h-3.5 w-3.5" />
                            Associa
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredPrepaid.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      Nessuna membership prepagata trovata.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </CardContent>

      <Dialog open={!!selectedPrepaid} onOpenChange={(open) => !open && setSelectedPrepaid(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Associa membership prepagata
            </DialogTitle>
          </DialogHeader>
          {selectedPrepaid && (
            <div className="space-y-4">
              <div className="rounded-md border bg-muted/20 p-3 text-sm">
                <div className="font-medium">{compactName(selectedPrepaid.first_name, selectedPrepaid.last_name)}</div>
                <div className="text-muted-foreground">{selectedPrepaid.email}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Tessera {selectedPrepaid.membership_year} · pagamento {formatDate(selectedPrepaid.payment_date)}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="prepaid-user-search">Cerca utente registrato</Label>
                <Input
                  id="prepaid-user-search"
                  value={userSearch}
                  onChange={(event) => setUserSearch(event.target.value)}
                  placeholder="Nome, email, telefono o ID tessera"
                />
              </div>

              <div className="max-h-72 overflow-y-auto rounded-md border">
                <Table>
                  <TableBody>
                    {userCandidates.map((member) => (
                      <TableRow
                        key={member.id}
                        className={selectedUserId === member.id ? "bg-primary/10" : ""}
                        onClick={() => setSelectedUserId(member.id)}
                      >
                        <TableCell>
                          <div className="font-medium">{compactName(member.first_name, member.last_name)}</div>
                          <div className="text-xs text-muted-foreground">{member.email || "-"} · {member.phone || "-"}</div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={member.membership_status === "Active" ? "default" : "secondary"}>
                            {member.membership_status || "Inactive"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {userCandidates.length === 0 && (
                      <TableRow>
                        <TableCell className="py-6 text-center text-muted-foreground">Nessun utente trovato.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedPrepaid(null)}>
              Annulla
            </Button>
            <Button
              disabled={!selectedPrepaid || !selectedUserId || activateMutation.isPending}
              onClick={() => selectedPrepaid && activateMutation.mutate({ prepaidId: selectedPrepaid.id, userId: selectedUserId })}
            >
              {activateMutation.isPending ? "Associazione..." : "Attiva e associa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
