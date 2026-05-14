import { LevelBadgeAvatar, useUserLevel } from "@/components/gamification/LevelBadgeAvatar";
import { cn } from "@/lib/utils";

interface ParticipantListItemProps {
  avatarUrl?: string | null;
  firstName: string;
  lastName?: string;
  totalPoints: number;
  className?: string;
}

export function ParticipantListItem({
  avatarUrl,
  firstName,
  lastName = "",
  totalPoints,
  className,
}: ParticipantListItemProps) {
  const { currentLevel } = useUserLevel(totalPoints);

  return (
    <div className={cn("flex items-center gap-3 py-2", className)}>
      <LevelBadgeAvatar
        avatarUrl={avatarUrl}
        firstName={firstName}
        lastName={lastName}
        totalPoints={totalPoints}
        size="sm"
        showLevel
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{firstName}</p>
        {currentLevel && (
          <p className="text-xs text-muted-foreground truncate">
            {currentLevel.icon} {currentLevel.name}
          </p>
        )}
      </div>
    </div>
  );
}
