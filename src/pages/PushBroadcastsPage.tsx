import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, Loader2, RadioTower, Send, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

const CONFIRM_PHRASE = "INVIA PUSH";

type IOSPushBroadcast = Tables<"ios_push_broadcasts">;
type BroadcastResponse = {
  success?: boolean;
  dry_run?: boolean;
  environment?: string;
  target_count?: number;
  unique_user_count?: number;
  sent_count?: number;
  failed_count?: number;
  expired_count?: number;
  ios_target_count?: number;
  ios_user_count?: number;
  onesignal_target_count?: number;
  onesignal_user_count?: number;
  error?: string | null;
  campaign?: IOSPushBroadcast;
};

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

const statusVariant = (status: string): BadgeVariant => {
  if (status === "completed") return "default";
  if (status === "partial_failed" || status === "sending") return "secondary";
  if (status === "failed") return "destructive";
  return "outline";
};

const PushBroadcastsPage = () => {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [estimate, setEstimate] = useState<BroadcastResponse | null>(null);

  const canEstimate = title.trim().length > 0 && message.trim().length > 0;
  const canSend = canEstimate && confirmation === CONFIRM_PHRASE;

  const { data: broadcasts = [], isLoading } = useQuery({
    queryKey: ["ios-push-broadcasts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ios_push_broadcasts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  const invokeBroadcast = async (dryRun: boolean) => {
    const { data, error } = await supabase.functions.invoke<BroadcastResponse>("send-ios-broadcast", {
      body: {
        title: title.trim(),
        message: message.trim(),
        dry_run: dryRun,
      },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data || {};
  };

  const estimateMutation = useMutation({
    mutationFn: () => invokeBroadcast(true),
    onSuccess: (data) => {
      setEstimate(data);
      toast.success("Stima destinatari aggiornata");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const sendMutation = useMutation({
    mutationFn: () => {
      if (confirmation !== CONFIRM_PHRASE) throw new Error("Conferma non valida");
      return invokeBroadcast(false);
    },
    onSuccess: (data) => {
      setEstimate(data);
      setConfirmation("");
      queryClient.invalidateQueries({ queryKey: ["ios-push-broadcasts"] });
      toast.success("Broadcast inviato");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const previewCount = useMemo(() => {
    if (!estimate) return null;
    return {
      targets: Number(estimate.target_count || 0),
      users: Number(estimate.unique_user_count || 0),
      iosTargets: Number(estimate.ios_target_count || 0),
      iosUsers: Number(estimate.ios_user_count || 0),
      webTargets: Number(estimate.onesignal_target_count || 0),
      webUsers: Number(estimate.onesignal_user_count || 0),
    };
  }, [estimate]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Broadcast Push</h1>
        <p className="text-sm text-muted-foreground mt-1">Invio notifiche iOS e Web/PWA tramite funzione Edge deployata sul target EU.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BellRing className="h-5 w-5 text-primary" />
              Nuovo broadcast
            </CardTitle>
            <CardDescription>Usa prima la stima destinatari. L'invio reale richiede conferma testuale.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="push-title">Titolo</Label>
              <Input
                id="push-title"
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setEstimate(null);
                }}
                maxLength={120}
                placeholder="Titolo della notifica"
              />
              <p className="text-xs text-muted-foreground">{title.length}/120 caratteri</p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="push-message">Messaggio</Label>
              <Textarea
                id="push-message"
                value={message}
                onChange={(event) => {
                  setMessage(event.target.value);
                  setEstimate(null);
                }}
                maxLength={800}
                rows={6}
                placeholder="Testo del broadcast"
              />
              <p className="text-xs text-muted-foreground">{message.length}/800 caratteri</p>
            </div>

            <div className="flex flex-col gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <ShieldAlert className="h-4 w-4 text-warning" />
                Invio reale protetto
              </div>
              <p className="text-muted-foreground">Per abilitare il pulsante invio scrivi esattamente {CONFIRM_PHRASE}.</p>
              <Input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder={CONFIRM_PHRASE} />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => estimateMutation.mutate()}
                disabled={!canEstimate || estimateMutation.isPending || sendMutation.isPending}
                className="gap-2"
              >
                {estimateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RadioTower className="h-4 w-4" />}
                Stima destinatari
              </Button>
              <Button
                onClick={() => sendMutation.mutate()}
                disabled={!canSend || estimateMutation.isPending || sendMutation.isPending}
                className="gap-2"
              >
                {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Invia push
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Stima</CardTitle>
            <CardDescription>Risultato dry-run del broadcast push multi-canale.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {previewCount ? (
              <>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Utenti unici</p>
                  <p className="text-2xl font-bold">{previewCount.users}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Device target</p>
                  <p className="text-2xl font-bold">{previewCount.targets}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">iOS</p>
                    <p className="text-lg font-semibold">{previewCount.iosUsers}</p>
                    <p className="text-xs text-muted-foreground">{previewCount.iosTargets} device</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">Web/PWA</p>
                    <p className="text-lg font-semibold">{previewCount.webUsers}</p>
                    <p className="text-xs text-muted-foreground">{previewCount.webTargets} subscription</p>
                  </div>
                </div>
                <Badge variant="outline">{estimate?.environment || "production"}</Badge>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Nessuna stima eseguita per il testo corrente.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Storico broadcast push</CardTitle>
          <CardDescription>Ultimi broadcast accodati dal backend EU.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Titolo</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Utenti</TableHead>
                  <TableHead>Accodate</TableHead>
                  <TableHead>Fallite</TableHead>
                  <TableHead>Scadute</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {broadcasts.map((broadcast) => (
                  <TableRow key={broadcast.id}>
                    <TableCell>
                      <div className="max-w-sm">
                        <p className="font-medium truncate">{broadcast.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{broadcast.message}</p>
                        {broadcast.error_message && <p className="text-xs text-destructive truncate">{broadcast.error_message}</p>}
                      </div>
                    </TableCell>
                    <TableCell><Badge variant={statusVariant(broadcast.status)}>{broadcast.status}</Badge></TableCell>
                    <TableCell>{broadcast.unique_user_count}</TableCell>
                    <TableCell>{broadcast.sent_count}</TableCell>
                    <TableCell>{broadcast.failed_count}</TableCell>
                    <TableCell>{broadcast.expired_count}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(broadcast.created_at).toLocaleString("it-IT")}</TableCell>
                  </TableRow>
                ))}
                {broadcasts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Nessun broadcast trovato.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PushBroadcastsPage;
