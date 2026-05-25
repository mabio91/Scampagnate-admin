import { LevelBadgeAvatar, useUserLevel } from "@/components/gamification/LevelBadgeAvatar";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, CheckCircle2, CreditCard, Instagram, Pill, Shield, ShieldCheck, Target, UserCircle, XCircle } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { instagramProfileUrl } from "@/lib/instagram";
import { Link } from "react-router-dom";

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

const REGISTRATION_STATUS_LABELS: Record<string, string> = {
  registered: "Iscritto",
  deposit_paid: "Acconto pagato",
  paid: "Pagato",
  attended: "Presente",
  no_show: "No show",
  waitlist: "Lista d'attesa",
  pending_approval: "In approvazione",
  pending_payment: "Pagamento in attesa",
  cancelled: "Cancellata",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "In attesa",
  paid: "Pagato",
  deposit_paid: "Acconto pagato",
  pay_on_location: "Sul posto",
  not_required: "Non richiesto",
  failed: "Fallito",
};

const REFUND_STATUS_LABELS: Record<string, string> = {
  not_requested: "non richiesto",
  requested: "richiesto",
  pending: "in attesa",
  processing: "in elaborazione",
  completed: "completato",
  failed: "fallito",
  cancelled: "annullato",
};

type EventRegistrationUpdate = Database["public"]["Tables"]["event_registrations"]["Update"];

interface AdminParticipantListItemProps {
  avatarUrl?: string | null;
  userId?: string | null;
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
	  healthStatus?: string | null;
	  healthNotes?: string | null;
	  emergencyMedicationHas?: boolean | null;
	  emergencyMedicationNotes?: string | null;
	  healthHelpNotes?: string | null;
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

function getHealthSafetyLabel(status?: string | null) {
  if (status === "none") return "Nessuna da segnalare";
  if (status === "has_info") return "Informazioni da leggere";
  return "Non compilato";
}

function getReadableLabel(labels: Record<string, string>, value?: string | null) {
  if (!value) return "";
  return labels[value] || value.replace(/_/g, " ");
}

export function AdminParticipantListItem({
  avatarUrl,
  userId,
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
	  healthStatus,
	  healthNotes,
	  emergencyMedicationHas,
	  emergencyMedicationNotes,
	  healthHelpNotes,
	  showLevel = true,
  isUpdating = false,
  onUpdate,
  className,
}: AdminParticipantListItemProps) {
  const { currentLevel } = useUserLevel(totalPoints);
  const reliability = getReliabilityLabel(completedEventsCount, totalRegistrations, noShowCount);
  const isCancelled = status === "cancelled";
  const refundLabel = getReadableLabel(REFUND_STATUS_LABELS, refundStatus);
  const refundAmountValue = refundAmount == null ? null : Number(refundAmount);
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
        {userId ? (
          <Link
            to={`/users/${userId}`}
            className="block text-sm font-medium truncate text-foreground hover:text-primary hover:underline"
          >
            {[firstName, lastName].filter(Boolean).join(" ")}
          </Link>
        ) : (
          <p className="text-sm font-medium truncate">{[firstName, lastName].filter(Boolean).join(" ")}</p>
        )}
        {showLevel && currentLevel && (
          <p className="text-xs text-muted-foreground">
            {currentLevel.icon} {currentLevel.name}
          </p>
        )}
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 pt-1 text-[11px]">
          {userId && (
            <Link to={`/users/${userId}`} className="flex items-center gap-1 text-muted-foreground hover:text-primary hover:underline">
              <UserCircle className="h-3 w-3" />
              Profilo utente
            </Link>
          )}
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
            <span>Stato: <span className="font-medium text-foreground">{getReadableLabel(REGISTRATION_STATUS_LABELS, status)}</span></span>
          ) : null}
          {paymentStatus && (
            <span>Pagamento: <span className="font-medium text-foreground">{getReadableLabel(PAYMENT_STATUS_LABELS, paymentStatus)}</span></span>
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
              <span className={cn(
                "font-medium",
                refundStatus === "completed" ? "text-success" : refundStatus === "not_requested" ? "text-muted-foreground" : "text-warning",
              )}>
                Rimborso {refundAmountValue != null && refundAmountValue > 0 ? `€${refundAmountValue.toFixed(2)}` : ""} {refundLabel}
              </span>
            ) : null}
          </div>
	        )}
	        {healthStatus && (
	          <div className={cn(
	            "mt-2 rounded-md border p-2.5 text-xs",
	            healthStatus === "has_info"
	              ? "border-yellow-500/30 bg-yellow-500/5"
	              : "border-green-500/20 bg-green-500/5"
	          )}>
	            <div className="flex items-start gap-2">
	              {healthStatus === "has_info" ? (
	                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600" />
	              ) : (
	                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
	              )}
	              <div className="min-w-0 space-y-1">
	                <p className="font-semibold text-foreground">Salute e sicurezza: {getHealthSafetyLabel(healthStatus)}</p>
	                {healthStatus === "has_info" && healthNotes && <p className="text-muted-foreground whitespace-pre-wrap">{healthNotes}</p>}
	                {healthStatus === "has_info" && emergencyMedicationHas && emergencyMedicationNotes && (
	                  <p className="flex items-start gap-1 text-muted-foreground">
	                    <Pill className="mt-0.5 h-3.5 w-3.5 shrink-0" />
	                    <span>Farmaci/dispositivi: {emergencyMedicationNotes}</span>
	                  </p>
	                )}
	                {healthStatus === "has_info" && healthHelpNotes && (
	                  <p className="text-muted-foreground whitespace-pre-wrap">Indicazioni: {healthHelpNotes}</p>
	                )}
	              </div>
	            </div>
	          </div>
	        )}
	        {onUpdate && (
          <div className="grid grid-cols-2 gap-2 pt-2">
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
                  <SelectItem key={option} value={option}>{getReadableLabel(REGISTRATION_STATUS_LABELS, option)}</SelectItem>
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
                  <SelectItem key={option} value={option}>{getReadableLabel(PAYMENT_STATUS_LABELS, option)}</SelectItem>
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
