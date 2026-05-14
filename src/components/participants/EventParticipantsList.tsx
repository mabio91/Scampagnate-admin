import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ParticipantListItem } from "./ParticipantListItem";
import { AdminParticipantListItem } from "./AdminParticipantListItem";
import { Skeleton } from "@/components/ui/skeleton";
import { Users } from "lucide-react";

interface EventParticipantsListProps {
  eventId: string;
  isAdmin?: boolean;
}

interface ParticipantData {
  id: string;
  user_id: string;
  status: string;
  payment_status: string | null;
  checked_in: boolean;
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
    avatar_url: string | null;
    total_points: number;
  } | null;
}

export function EventParticipantsList({ eventId, isAdmin = false }: EventParticipantsListProps) {
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
            avatar_url,
            total_points
          )
        `)
        .eq("event_id", eventId)
        .in("status", ["registered", "paid", "deposit_paid", "attended", "no_show", "waitlist", "pending_approval", "pending_payment"]);

      if (error) throw error;
      return (data || []) as unknown as ParticipantData[];
    },
  });

  // For admin view: fetch all registrations per user to compute reliability
  const userIds = participants.map((p) => p.user_id);
  const { data: allUserRegs = [] } = useQuery({
    queryKey: ["user-all-regs", userIds],
    enabled: isAdmin && userIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("event_registrations")
        .select("user_id, status, checked_in, events:event_id(date)")
        .in("user_id", userIds);
      return data || [];
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
    allUserRegs.forEach((r: any) => {
      if (!userStats[r.user_id]) userStats[r.user_id] = { completed: 0, total: 0, noShows: 0 };
      const isPast = r.events?.date ? new Date(r.events.date) < new Date() : false;
      if (["registered", "paid", "deposit_paid", "attended", "no_show"].includes(r.status)) {
        userStats[r.user_id].total++;
        if (r.checked_in) userStats[r.user_id].completed++;
        else if (isPast) userStats[r.user_id].noShows++;
      }
    });
  }

  return (
    <div className="space-y-0.5 divide-y divide-border/50">
      {participants.map((p) => {
        const profile = p.profiles as any;
        if (!profile) return null;

        if (isAdmin) {
          const stats = userStats[p.user_id] || { completed: 0, total: 0, noShows: 0 };
          return (
            <AdminParticipantListItem
              key={p.user_id}
              avatarUrl={profile.avatar_url}
              firstName={profile.first_name}
              lastName={profile.last_name}
              totalPoints={profile.total_points || 0}
              completedEventsCount={stats.completed}
              totalRegistrations={stats.total}
              noShowCount={stats.noShows}
              status={p.status}
              paymentStatus={p.payment_status}
              priceOptionName={p.price_option?.name || null}
              amountPaid={p.amount_paid}
              totalPriceAmount={p.total_price_amount}
              depositAmount={p.deposit_amount}
              balanceDueAmount={p.balance_due_amount}
              balancePaymentMode={p.balance_payment_mode}
              refundStatus={p.refund_status}
              refundAmount={p.refund_amount}
            />
          );
        }

        return (
          <ParticipantListItem
            key={p.user_id}
            avatarUrl={profile.avatar_url}
            firstName={profile.first_name}
            lastName={profile.last_name}
            totalPoints={profile.total_points || 0}
          />
        );
      })}
    </div>
  );
}
