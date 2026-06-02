export const DEFAULT_PRICE_OPTION_DISPLAY_NAME = "Partecipazione evento";

export const isGeneratedPriceOptionName = (name: string | null | undefined) => {
  const cleanName = String(name ?? "").trim();
  return /^formula(?:\s+\d+)?$/i.test(cleanName);
};

export const getPriceOptionDisplayName = (
  option: { name?: string | null } | null | undefined,
  fallback = DEFAULT_PRICE_OPTION_DISPLAY_NAME,
) => {
  const cleanName = option?.name?.trim();
  return cleanName && !isGeneratedPriceOptionName(cleanName) ? cleanName : fallback;
};
