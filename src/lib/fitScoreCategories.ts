export interface InterestCategoryOption {
  id: string;
  label: string;
}

export const INTEREST_CATEGORY_OPTIONS: InterestCategoryOption[] = [
  { id: "trekking_giornalieri", label: "Trekking giornalieri" },
  { id: "cammini_plurigiornalieri", label: "Cammini plurigiornalieri" },
  { id: "notti_tenda", label: "Notti in tenda" },
  { id: "trekking_notturni", label: "Trekking notturni" },
  { id: "aperitivi_cene", label: "Aperitivi e cene" },
  { id: "sport_movimento", label: "Sport e movimento" },
  { id: "giochi_sfide", label: "Giochi e sfide" },
  { id: "weekend_fuori_porta", label: "Weekend fuori porta" },
  { id: "degustazioni_cantine", label: "Degustazioni e cantine" },
  { id: "mare_spiaggia", label: "Mare e spiaggia" },
];

export const FIT_SCORE_EVENT_SECONDARY_MAX = 2;

export const normalizeFitScoreCategoryName = (value: unknown) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
};

export const sortFitScoreCategoryNames = (a: string, b: string) => a.localeCompare(b, "it");

export const extractFitScoreCategoryNames = (events: Array<{ additional_fields: unknown }>) => {
  const names = new Set<string>();

  events.forEach((event) => {
    const additionalFields = (event.additional_fields || {}) as {
      fit_score_main_category?: unknown;
      fit_score_secondary_categories?: unknown;
    };

    const mainCategory = normalizeFitScoreCategoryName(additionalFields.fit_score_main_category);
    if (mainCategory) names.add(mainCategory);

    if (Array.isArray(additionalFields.fit_score_secondary_categories)) {
      additionalFields.fit_score_secondary_categories.forEach((category) => {
        const secondaryCategory = normalizeFitScoreCategoryName(category);
        if (secondaryCategory) names.add(secondaryCategory);
      });
    }
  });

  return [...names].sort(sortFitScoreCategoryNames);
};
