import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TrekkingDifficultyLevel {
  id: string;
  level_number: number;
  label: string;
  icon: string;
  color_primary: string;
  color_background: string;
  color_border: string;
  color_icon: string;
}

export function useTrekkingDifficultyLevels() {
  return useQuery({
    queryKey: ["trekking-difficulty-levels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trekking_difficulty_levels")
        .select("*")
        .order("level_number");
      if (error) throw error;
      return data as TrekkingDifficultyLevel[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function getDifficultyByValue(
  levels: TrekkingDifficultyLevel[] | undefined,
  difficulty: string | null | undefined
): TrekkingDifficultyLevel | undefined {
  if (!levels || !difficulty) return undefined;
  // Match by label (case-insensitive) or by level_number
  const num = parseInt(difficulty);
  if (!isNaN(num)) return levels.find((l) => l.level_number === num);
  return levels.find((l) => l.label.toLowerCase() === difficulty.toLowerCase());
}
