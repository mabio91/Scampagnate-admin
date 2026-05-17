import { LevelBadgeAvatar, useUserLevel } from "@/components/gamification/LevelBadgeAvatar";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, CreditCard, Instagram, Shield, Target, XCircle } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { instagramProfileUrl } from "@/lib/instagram";

const NO_MEETING_POINT = "__no_meeting_point__";

const REGISTRATION_STATUS_OPTIONS = [
  "registered",
  "deposit_paid",
  "paid",
  "attended",
  "no_show",
  "waitlist",
  "pending_approval",
  "pending_payment",
  "cancelled",
];

const PAYMENT_STATUS_OPTIONS = [
  "pending",
  "paid",
  "deposit_paid",
  "pay_on_location",
  "not_required",
  "failed",
];

type EventRegistrationUpdate = Database["public"]["Tables"]["event_registrations"]["Update"];

interface AdminParticipantListItemProps {
  avatarUrl?: string | null;
  firstName: string;
  lastName?: string;
  totalPoints: number;
  instagramHandle?: string | null;
  fitScore?: number | null;
  completedEventsCount: number;
  totalRegistrations: number;
  noShowCount: number;
  status?: string | null;
  paymentStatus?: string | null;
  checkedIn?: boolean | null;
  meetingPointId?: string | null;
  meetingPoints?: { id: string; name: string }[];
  priceOptionName?: string | null;
  amountPaid?: number | null;
  totalPriceAmount?: number | null;
  depositAmount?: number | null;
  balanceDueAmount?: number | null;
  balancePaymentMode?: string | null;
  refundStatus?: string | null;
  refundAmount?: number | null;
  showLevel?: boolean;
  isUpdating?: boolean;
  onUpdate?: (updates: EventRegistrationUpdate) => void;
  className?: string;
}

function getReliabilityLabel(attended: number, total: number, noShows: number): { label: string; color: string } {
  if (total === 0) return { label: "—", color: "text-muted-foreground" };
  const score = (attended / total) * 70 + ((total - noShows) / total) * 30;
  if (score >= 80) return { label: "Ottima", color: "text-success" };
  if (score >= 50) return { label: "Buona", color: "text-warning" };
  return { label: "Da migliorare", color: "text-destructive" };
}

export function AdminParticipantListItem({
  avatarUrl,
  firstName,
  lastName = "",
  totalPoints,
  instagramHandle,
  fitScore,
  completedEventsCount,
  totalRegistrations,
  noShowCount,
  status,
  paymentStatus,
  checkedIn,
  meetingPointId,
  meetingPoints = [],
  priceOptionName,
  amountPaid,
  totalPriceAmount,
  depositAmount,
  balanceDueAmount,
  balancePaymentMode,
  refundStatus,
  refundAmount,
  showLevel = true,
  isUpdating = false,
  onUpdate,
  className,
}: AdminParticipantListItemProps) {
  const { currentLevel } = useUserLevel(totalPoints);
  const reliability = getReliabilityLabel(completedEventsCount, totalRegistrations, noShowCount);
  const isCancelled = status === "cancelled";
  const hasPaymentDetails =
    amountPaid != null ||
    totalPriceAmount != null ||
    depositAmount != null ||
    balanceDueAmount != null ||
    refundAmount != null ||
    !!refundStatus;

  return (
    <div className={cn("flex items-start gap-3 py-2.5", className)}>
      <LevelBadgeAvatar
        avatarUrl={avatarUrl}
        firstName={firstName}
        lastName={lastName}
        totalPoints={totalPoints}
        size="md"
        showLevel={showLevel}
      />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-sm font-medium truncate">{firstName}</p>
        {showLevel && currentLevel && (
          <p className="text-xs text-muted-foreground">
            {currentLevel.icon} {currentLevel.name}
          </p>
        )}
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 pt-1 text-[11px]">
          {instagramHandle && (
            <a
              href={instagramProfileUrl(instagramHandle)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-primary hover:underline"
            >
              <Instagram className="h-3 w-3" />
              @{instagramHandle}
            </a>
          )}
          {fitScore != null && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Target className="h-3 w-3" />
              Compatibilità: <span className="font-medium text-foreground">{fitScore}%</span>
            </span>
          )}
          <span className={cn("flex items-center gap-1", reliability.color)}>
            <Shield className="h-3 w-3" />
            Affidabilità: <span className="font-medium">{reliability.label}</span>
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <CheckCircle2 className="h-3 w-3" />
            <span className="font-medium text-foreground">{completedEventsCount}</span> eventi completati
          </span>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
          {isCancelled ? (
            <span className="flex items-center gap-1 font-medium text-destructive">
              <XCircle className="h-3 w-3" />
              Iscrizione cancellata
            </span>
          ) : status ? (
            <span>Stato: <span className="font-medium text-foreground">{status}</span></span>
          ) : null}
          {paymentStatus && (
            <span>Pagamento: <span className="font-medium text-foreground">{paymentStatus}</span></span>
          )}
          {priceOptionName && (
            <span>Opzione: <span className="font-medium text-foreground">{priceOptionName}</span></span>
          )}
        </div>
        {hasPaymentDetails && (
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
            {amountPaid != null ? (
              <span className="flex items-center gap-1">
                <CreditCard className="h-3 w-3" />
                Pagato €{Number(amountPaid).toFixed(2)}
              </span>
            ) : null}
            {totalPriceAmount != null ? <span>Totale €{Number(totalPriceAmount).toFixed(2)}</span> : null}
            {depositAmount != null ? <span>Acconto €{Number(depositAmount).toFixed(2)}</span> : null}
            {balanceDueAmount != null ? (
              <span>Saldo €{Number(balanceDueAmount).toFixed(2)} {balancePaymentMode === "on_site" ? "sul posto" : "online"}</span>
            ) : null}
            {refundStatus || refundAmount != null ? (
              <span className={cn("font-medium", refundStatus === "completed" ? "text-success" : "text-warning")}>
                Rimborso {refundAmount != null ? `€${Number(refundAmount).toFixed(2)}` : ""} {refundStatus || ""}
              </span>
            ) : null}
          </div>
        )}
        {onUpdate && (
          <div className="grid gap-2 pt-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
            <Select
              value={status || "registered"}
              onValueChange={(value) => onUpdate({
                status: value,
                cancelled_at: value === "cancelled" ? new Date().toISOString() : null,
              })}
              disabled={isUpdating}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REGISTRATION_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>{option}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={paymentStatus || "pending"}
              onValueChange={(value) => onUpdate({ payment_status: value })}
              disabled={isUpdating}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>{option}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={meetingPointId || NO_MEETING_POINT}
              onValueChange={(value) => onUpdate({ meeting_point_id: value === NO_MEETING_POINT ? null : value })}
              disabled={isUpdating || meetingPoints.length === 0}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Punto ritrovo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_MEETING_POINT}>Nessun punto</SelectItem>
                {meetingPoints.map((point) => (
                  <SelectItem key={point.id} value={point.id}>{point.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              type="button"
              variant={checkedIn ? "secondary" : "outline"}
              size="sm"
              className="h-8 whitespace-nowrap text-xs"
              disabled={isUpdating}
              onClick={() => onUpdate({
                checked_in: !checkedIn,
                status: !checkedIn ? "attended" : status === "attended" ? "registered" : status || "registered",
              })}
            >
              {checkedIn ? "Check-in fatto" : "Check-in"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
