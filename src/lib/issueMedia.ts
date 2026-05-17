import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const ISSUE_MEDIA_BUCKET = "issue-media";

export type IssueMediaAttachment = {
  path: string;
  type: "image" | "video";
  content_type: string;
  name: string;
  size: number;
};

export const formatIssueMediaSize = (size: number) => {
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
};

export const getIssueMediaAttachments = (value: unknown): IssueMediaAttachment[] => {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const attachment = item as Partial<IssueMediaAttachment>;
    if (typeof attachment.path !== "string" || !attachment.path) return [];

    const type = attachment.type === "video" ? "video" : "image";
    return [{
      path: attachment.path,
      type,
      content_type: typeof attachment.content_type === "string" ? attachment.content_type : type === "video" ? "video/mp4" : "image/jpeg",
      name: typeof attachment.name === "string" && attachment.name ? attachment.name : type === "video" ? "video" : "immagine",
      size: typeof attachment.size === "number" ? attachment.size : 0,
    }];
  });
};

export const signIssueMediaAttachments = async (
  supabase: SupabaseClient<Database>,
  attachments: IssueMediaAttachment[],
) => {
  const entries = await Promise.all(
    attachments.map(async (attachment) => {
      const { data, error } = await supabase.storage
        .from(ISSUE_MEDIA_BUCKET)
        .createSignedUrl(attachment.path, 60 * 60);

      if (error || !data?.signedUrl) return null;
      return [attachment.path, data.signedUrl] as const;
    }),
  );

  return Object.fromEntries(entries.filter(Boolean) as Array<readonly [string, string]>);
};
