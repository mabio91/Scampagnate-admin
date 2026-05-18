import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ParticipantListItem } from "./ParticipantListItem";
import { AdminParticipantListItem } from "./AdminParticipantListItem";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Download, Users } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { exportToCsv } from "@/lib/exportUtils";

interface EventParticipantsListProps {
  eventId: string;
  isAdmin?: boolean;
}

interface ParticipantData {
  id: string;
  user_id: string | null;
  status: string;
  payment_status: string | null;
  checked_in: boolean;
  sport_level: string | null;
  meeting_point_id: string | null;
  price_option_id: string | null;
  amount_paid: number | null;
  total_price_amount: number | null;
  deposit_amount: number | null;
  balance_due_amount: number | null;
  balance_payment_mode: string | null;
  refund_amount: number | null;
  refund_status: string | null;
  price_option: {
    name: string;
    price: number;
    payment_type: string | null;
    deposit_amount: number | null;
    balance_amount: number | null;
    balance_payment_mode: string | null;
  } | null;
	  profiles: {
	    first_name: string;
	    last_name: string;
	    instagram_handle: string | null;
	    avatar_url: string | null;
	    total_points: number;
	    health_safety_status: string | null;
	    health_safety_notes: string | null;
	    emergency_medication_has: boolean | null;
	    emergency_medication_notes: string | null;
	    health_safety_help_notes: string | null;
	  } | null;
	}

type EventRegistrationUpdate = Database["public"]["Tables"]["event_registrations"]["Update"];
type UserRegistrationStatsRow = {
  user_id: string | null;
  status: string | null;
  checked_in: boolean | null;
  events: { date: string | null } | null;
};

const CONFIRMED_REGISTRATION_STATUSES = ["registered", "deposit_paid", "paid", "attended", "no_show"];

function manualParticipantName(sportLevel: string | null | undefined) {
  if (!sportLevel?.startsWith("manual:")) return null;
  return sportLevel.replace("manual:", "").split("|")[0]?.trim() || "Partecipante";
}

function isConfirmedParticipant(participant: ParticipantData) {
  return Boolean(
    participant.user_id &&
    !manualParticipantName(participant.sport_level) &&
    CONFIRMED_REGISTRATION_STATUSES.includes(participant.status) &&
    participant.payment_status !== "pending",
  );
}

export function EventParticipantsList({ eventId, isAdmin = false }: EventParticipantsListProps) {
  const queryClient = useQueryClient();

  // Fetch registrations with profile data
  const { data: participants = [], isLoading } = useQuery({
    queryKey: ["event-participants", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_registrations")
        .select(`
          id,
          user_id,
          status,
          payment_status,
          checked_in,
          sport_level,
          meeting_point_id,
          price_option_id,
          amount_paid,
          total_price_amount,
          deposit_amount,
          balance_due_amount,
          balance_payment_mode,
          refund_amount,
          refund_status,
          price_option:event_price_options (
            name,
            price,
            payment_type,
            deposit_amount,
            balance_amount,
            balance_payment_mode
          ),
          profiles:user_id (
            first_name,
            last_name,
	            instagram_handle,
	            avatar_url,
	            total_points,
	            health_safety_status,
	            health_safety_notes,
	            emergency_medication_has,
	            emergency_medication_notes,
	            health_safety_help_notes
	          )
        `)
        .eq("event_id", eventId)
        .in("status", ["registered", "paid", "deposit_paid", "attended", "no_show", "waitlist", "pending_approval", "pending_payment", "cancelled"]);

      if (error) throw error;
      return (data || []) as unknown as ParticipantData[];
    },
  });

  // For admin view: fetch all registrations per user to compute reliability
  const userIds = participants.map((p) => p.user_id).filter(Boolean) as string[];
  const { data: allUserRegs = [] } = useQuery({
    queryKey: ["user-all-regs", userIds],
    enabled: isAdmin && userIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("event_registrations")
        .select("user_id, status, checked_in, events:event_id(date)")
        .in("user_id", userIds);
      return (data || []) as UserRegistrationStatsRow[];
    },
  });

  const { data: meetingPoints = [] } = useQuery({
    queryKey: ["event-meeting-points", eventId],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_meeting_points")
        .select("id, name")
        .eq("event_id", eventId)
        .order("sort_order");
      if (error) throw error;
      return data || [];
    },
  });

  const updateRegistrationMutation = useMutation({
    mutationFn: async ({ registrationId, updates }: { registrationId: string; updates: EventRegistrationUpdate }) => {
      const { error } = await supabase
        .from("event_registrations")
        .update(updates)
        .eq("id", registrationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-participants", eventId] });
      queryClient.invalidateQueries({ queryKey: ["event", eventId] });
      queryClient.invalidateQueries({ queryKey: ["admin-events"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (participants.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
        <Users className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm">Nessun partecipante</p>
      </div>
    );
  }

  // Compute per-user stats for admin view
  const userStats: Record<string, { completed: number; total: number; noShows: number }> = {};
  if (isAdmin) {
    allUserRegs.forEach((r) => {
      if (!r.user_id) return;
      if (!userStats[r.user_id]) userStats[r.user_id] = { completed: 0, total: 0, noShows: 0 };
      const isPast = r.events?.date ? new Date(r.events.date) < new Date() : false;
      if (["registered", "paid", "deposit_paid", "attended", "no_show"].includes(r.status)) {
        userStats[r.user_id].total++;
        if (r.checked_in) userStats[r.user_id].completed++;
        else if (isPast) userStats[r.user_id].noShows++;
      }
    });
  }

  const handleExportConfirmedParticipants = () => {
    const rows = participants
      .filter(isConfirmedParticipant)
      .map((p) => [
        p.profiles?.first_name || "",
        p.profiles?.last_name || "",
        p.profiles?.instagram_handle ? `@${p.profiles.instagram_handle}` : "",
        p.status,
        p.payment_status || "",
        p.checked_in ? "Si" : "No",
        p.price_option?.name || "",
        p.amount_paid != null ? String(p.amount_paid) : "",
        p.total_price_amount != null ? String(p.total_price_amount) : "",
      ]);

    exportToCsv(
      `event-${eventId}-partecipanti-confermati`,
      ["Nome", "Cognome", "Instagram", "Stato", "Pagamento", "Check-in", "Formula", "Pagato", "Totale"],
      rows,
    );
    toast.success("Partecipanti confermati esportati");
  };

  return (
    <div className="space-y-0.5 divide-y divide-border/50">
      {isAdmin && (
        <div className="flex justify-end pb-2">
          <Button type="button" variant="outline" size="sm" className="gap-2" onClick={handleExportConfirmedParticipants}>
            <Download className="h-4 w-4" />
            Esporta CSV confermati
          </Button>
        </div>
      )}
      {participants.map((p) => {
        const profile = p.profiles;
        const manualName = manualParticipantName(p.sport_level);
        const firstName = manualName || profile?.first_name || "Partecipante";
        const lastName = manualName ? "(manuale)" : profile?.last_name || "";
        const avatarUrl = manualName ? null : profile?.avatar_url || null;
        const totalPoints = manualName ? 0 : profile?.total_points || 0;
        const showLevel = !manualName && !!profile;

        if (isAdmin) {
          const stats = p.user_id ? userStats[p.user_id] || { completed: 0, total: 0, noShows: 0 } : { completed: 0, total: 0, noShows: 0 };
          return (
            <AdminParticipantListItem
              key={p.id}
              avatarUrl={avatarUrl}
              userId={p.user_id}
              firstName={firstName}
              lastName={lastName}
              totalPoints={totalPoints}
	              instagramHandle={isConfirmedParticipant(p) ? profile?.instagram_handle || null : null}
	              healthStatus={manualName ? null : profile?.health_safety_status || null}
	              healthNotes={manualName ? null : profile?.health_safety_notes || null}
	              emergencyMedicationHas={manualName ? null : (profile?.emergency_medication_has ?? null)}
	              emergencyMedicationNotes={manualName ? null : profile?.emergency_medication_notes || null}
	              healthHelpNotes={manualName ? null : profile?.health_safety_help_notes || null}
	              showLevel={showLevel}
              completedEventsCount={stats.completed}
              totalRegistrations={stats.total}
              noShowCount={stats.noShows}
              status={p.status}
              paymentStatus={p.payment_status}
              checkedIn={p.checked_in}
              meetingPointId={p.meeting_point_id}
              meetingPoints={meetingPoints}
              priceOptionName={p.price_option?.name || null}
              amountPaid={p.amount_paid}
              totalPriceAmount={p.total_price_amount}
              depositAmount={p.deposit_amount}
              balanceDueAmount={p.balance_due_amount}
              balancePaymentMode={p.balance_payment_mode}
              refundStatus={p.refund_status}
              refundAmount={p.refund_amount}
              isUpdating={updateRegistrationMutation.isPending}
              onUpdate={(updates) => updateRegistrationMutation.mutate({ registrationId: p.id, updates })}
            />
          );
        }

        return (
          <ParticipantListItem
            key={p.id}
            avatarUrl={avatarUrl}
            firstName={firstName}
            lastName={lastName}
            totalPoints={totalPoints}
            showLevel={showLevel}
          />
        );
      })}
    </div>
  );
}
