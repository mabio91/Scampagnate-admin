import { useTrekkingDifficultyLevels } from "@/hooks/useTrekkingDifficultyLevels";
import { Skeleton } from "@/components/ui/skeleton";

export function TrekkingDifficultyGuide() {
  const { data: levels, isLoading } = useTrekkingDifficultyLevels();

  if (isLoading) {
    return (
      <div className="space-y-3 mt-6">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (!levels?.length) return null;

  return (
    <div className="mt-8 space-y-4">
      <h2 className="text-xl font-bold text-foreground">I 5 livelli di difficoltà</h2>
      <div className="grid gap-3">
        {levels.map((level) => (
          <div
            key={level.id}
            className="flex items-center gap-4 rounded-xl p-4 border transition-colors"
            style={{
              backgroundColor: level.color_background,
              borderColor: level.color_border,
            }}
          >
            <span
              className="text-3xl flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-lg"
              style={{ color: level.color_icon }}
            >
              {level.icon}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-bold"
                  style={{
                    backgroundColor: level.color_background,
                    color: level.color_primary,
                    border: `1.5px solid ${level.color_border}`,
                  }}
                >
                  Livello {level.level_number}
                </span>
                <span className="font-semibold text-base" style={{ color: level.color_primary }}>
                  {level.label}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
