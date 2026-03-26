import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface CommunityLevel {
  level_number: number;
  name: string;
  icon: string;
  color: string;
  min_points: number;
}

interface LevelBadgeAvatarProps {
  avatarUrl?: string | null;
  firstName?: string;
  lastName?: string;
  totalPoints?: number;
  size?: "sm" | "md" | "lg";
  showLevel?: boolean;
  className?: string;
}

const sizeMap = {
  sm: { avatar: "h-8 w-8", ring: "ring-2", badge: "text-xs -bottom-0.5 -right-0.5 h-4 w-4", glow: "" },
  md: { avatar: "h-10 w-10", ring: "ring-2", badge: "text-sm -bottom-0.5 -right-0.5 h-5 w-5", glow: "" },
  lg: { avatar: "h-16 w-16", ring: "ring-[3px]", badge: "text-base -bottom-1 -right-1 h-7 w-7", glow: "shadow-lg" },
};

export function useUserLevel(totalPoints: number = 0) {
  const { data: levels = [] } = useQuery({
    queryKey: ["community-levels"],
    queryFn: async () => {
      const { data } = await supabase
        .from("community_levels")
        .select("*")
        .order("min_points", { ascending: true });
      return (data || []) as CommunityLevel[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const currentLevel = levels.reduce<CommunityLevel | null>((acc, lvl) => {
    if (totalPoints >= lvl.min_points) return lvl;
    return acc;
  }, null);

  const nextLevel = levels.find((l) => l.min_points > totalPoints) || null;

  return { currentLevel, nextLevel, levels };
}

export function LevelBadgeAvatar({
  avatarUrl,
  firstName = "",
  lastName = "",
  totalPoints = 0,
  size = "md",
  showLevel = true,
  className,
}: LevelBadgeAvatarProps) {
  const { currentLevel } = useUserLevel(totalPoints);
  const s = sizeMap[size];
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

  const ringColor = currentLevel?.color || "hsl(var(--border))";
  const isHighLevel = currentLevel && currentLevel.level_number >= 5;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn("relative inline-flex", className)}>
          <Avatar
            className={cn(
              s.avatar,
              s.ring,
              s.glow,
              isHighLevel && "shadow-[0_0_12px_rgba(245,158,11,0.4)]"
            )}
            style={{ 
              borderColor: ringColor,
              borderWidth: size === "lg" ? 3 : 2,
              borderStyle: "solid",
            }}
          >
            <AvatarImage src={avatarUrl || undefined} alt={`${firstName} ${lastName}`} />
            <AvatarFallback className="text-xs font-semibold">{initials}</AvatarFallback>
          </Avatar>
          {showLevel && currentLevel && (
            <span
              className={cn(
                "absolute flex items-center justify-center rounded-full bg-background border",
                s.badge
              )}
              style={{ borderColor: ringColor }}
            >
              {currentLevel.icon}
            </span>
          )}
        </div>
      </TooltipTrigger>
      {currentLevel && (
        <TooltipContent>
          <p className="font-medium">{currentLevel.icon} {currentLevel.name}</p>
          <p className="text-xs text-muted-foreground">{totalPoints} punti</p>
        </TooltipContent>
      )}
    </Tooltip>
  );
}
