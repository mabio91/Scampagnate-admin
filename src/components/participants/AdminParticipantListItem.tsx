import { LevelBadgeAvatar, useUserLevel } from "@/components/gamification/LevelBadgeAvatar";
import { cn } from "@/lib/utils";
import { CheckCircle2, Shield, Target } from "lucide-react";

interface AdminParticipantListItemProps {
  avatarUrl?: string | null;
  firstName: string;
  lastName?: string;
  totalPoints: number;
  fitScore?: number | null;
  completedEventsCount: number;
  totalRegistrations: number;
  noShowCount: number;
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
  fitScore,
  completedEventsCount,
  totalRegistrations,
  noShowCount,
  className,
}: AdminParticipantListItemProps) {
  const { currentLevel } = useUserLevel(totalPoints);
  const reliability = getReliabilityLabel(completedEventsCount, totalRegistrations, noShowCount);

  return (
    <div className={cn("flex items-start gap-3 py-2.5", className)}>
      <LevelBadgeAvatar
        avatarUrl={avatarUrl}
        firstName={firstName}
        lastName={lastName}
        totalPoints={totalPoints}
        size="md"
        showLevel
      />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-sm font-medium truncate">{firstName}</p>
        {currentLevel && (
          <p className="text-xs text-muted-foreground">
            {currentLevel.icon} {currentLevel.name}
          </p>
        )}
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 pt-1 text-[11px]">
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
      </div>
    </div>
  );
}
