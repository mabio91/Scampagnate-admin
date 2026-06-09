const WHATSAPP_GROUP_URL_PREFIX = "https://chat.whatsapp.com/";

export const normalizeWhatsappGroupUrl = (value: unknown): string | null => {
  if (typeof value !== "string") return null;

  const url = value.trim();
  if (!url.toLowerCase().startsWith(WHATSAPP_GROUP_URL_PREFIX)) return null;

  return url;
};
