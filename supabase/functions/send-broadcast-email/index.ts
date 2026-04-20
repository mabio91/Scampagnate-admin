import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function replaceVariables(text: string, vars: Record<string, string>): string {
  let result = text;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }

  const userName = vars.user_name || vars.full_name || vars.first_name || "";
  result = result.replace(/\{\{user_name\}\}/g, userName);
  result = result.replace(/\{\{first_name\}\}/g, vars.first_name || "");
  result = result.replace(/Ciao\s*,/g, "Ciao,");
  return result;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<li>/gi, "- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function getEventSuggestionsHtml(supabaseAdmin: ReturnType<typeof createClient>) {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabaseAdmin
    .from("events")
    .select("title, date, location")
    .in("status", ["available", "published"])
    .gte("date", today)
    .order("date", { ascending: true })
    .limit(3);

  if (!data?.length) {
    return "<p>Scopri le prossime attività in programma su Scampagnate.</p>";
  }

  const items = data
    .map((event) => `<li><strong>${event.title}</strong> - ${event.date}${event.location ? `, ${event.location}` : ""}</li>`)
    .join("");

  return `<p>Ecco alcuni suggerimenti per te:</p><ul>${items}</ul>`;
}

function buildEmailHtml(template: any, vars: Record<string, string>): string {
  const bodyHtml = replaceVariables(template.body_html, vars);
  const ctaUrl = vars.cta_url || template.cta_url || "/events";
  const siteUrl = Deno.env.get("SITE_URL") || "https://scampagnate.com";
  const fullCtaUrl = ctaUrl.startsWith("http") ? ctaUrl : `${siteUrl}${ctaUrl}`;

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${template.preview_text ? `<span style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${replaceVariables(template.preview_text, vars)}</span>` : ""}
</head>
<body style="margin:0;padding:0;background-color:#f5f3ef;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#f5f3ef;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);max-width:100%;">
        <tr>
          <td style="background-color:#1a3d2b;padding:28px 24px;text-align:center;">
            <h1 style="color:#f0ebe0;margin:0;font-size:22px;font-weight:700;font-family:Arial,Helvetica,sans-serif;">${template.sender_name || "Scampagnate"}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 28px;color:#1a3d2b;font-size:15px;line-height:1.7;font-family:Arial,Helvetica,sans-serif;">
            ${bodyHtml}
            ${template.cta_label ? `
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:28px;">
              <tr><td align="center">
                <a href="${fullCtaUrl}" style="display:inline-block;background-color:#c65d21;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;font-family:Arial,Helvetica,sans-serif;">${template.cta_label}</a>
              </td></tr>
            </table>` : ""}
          </td>
        </tr>
        <tr>
          <td style="background-color:#f5f3ef;padding:20px 24px;text-align:center;font-size:12px;color:#6b7a6e;border-top:1px solid #e5e0d5;font-family:Arial,Helvetica,sans-serif;">
            <p style="margin:0 0 8px 0;">Ricevi questa email per comunicazioni istituzionali di Scampagnate.</p>
            <p style="margin:0;">&copy; ${new Date().getFullYear()} Scampagnate. Tutti i diritti riservati.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    if (!resendApiKey) throw new Error("RESEND_API_KEY not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Not authenticated");

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user: caller },
    } = await callerClient.auth.getUser();

    if (!caller) throw new Error("Not authenticated");

    const { data: roleCheck } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin");

    if (!roleCheck?.length) throw new Error("Not authorized");

    const { templateId, userIds } = await req.json();
    if (!templateId || !Array.isArray(userIds) || userIds.length === 0) {
      throw new Error("templateId and a non-empty userIds array are required");
    }

    const { data: template, error: templateError } = await supabaseAdmin
      .from("email_templates")
      .select("*")
      .eq("id", templateId)
      .single();

    if (templateError || !template) throw new Error("Template not found");
    if (template.type !== "broadcast") throw new Error("Selected template is not a Broadcast Email template");

    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("id, first_name, last_name, email")
      .in("id", userIds);

    if (profilesError || !profiles) throw new Error("Error fetching users");

    const eventSuggestionsHtml = await getEventSuggestionsHtml(supabaseAdmin);
    const batchSize = 10;
    const results: Array<{ id: string; status: string; error?: string }> = [];

    for (let index = 0; index < profiles.length; index += batchSize) {
      const batch = profiles.slice(index, index + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (profile: any) => {
          if (!profile.email) {
            return { id: profile.id, status: "skipped", error: "missing_email" };
          }

          const vars = {
            first_name: profile.first_name || "",
            full_name: [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "",
            user_name: [profile.first_name, profile.last_name].filter(Boolean).join(" ") || profile.first_name || "",
            email: profile.email,
            cta_url: template.cta_url || "/events",
            event_suggestions: eventSuggestionsHtml,
          };

          const htmlBody = buildEmailHtml(template, vars);
          const subject = replaceVariables(template.subject, vars);
          const fromAddress = `${template.sender_name || "Scampagnate"} <noreply@scampagnate.com>`;

          const resendPayload: Record<string, unknown> = {
            from: fromAddress,
            to: [profile.email],
            subject,
            html: htmlBody,
            text: stripHtml(replaceVariables(template.body_html, vars)),
          };

          if (template.reply_to) {
            resendPayload.reply_to = template.reply_to;
          }

          try {
            const resendResponse = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${resendApiKey}`,
              },
              body: JSON.stringify(resendPayload),
            });

            const resendResult = await resendResponse.json();
            const status = resendResponse.ok ? "sent" : "failed";

            await supabaseAdmin.from("email_send_log").insert({
              user_id: profile.id,
              email_type: "broadcast",
              template_id: template.id,
              recipient_email: profile.email,
              status,
              provider_response: JSON.stringify(resendResult),
              sent_at: status === "sent" ? new Date().toISOString() : null,
            });

            if (!resendResponse.ok) {
              return { id: profile.id, status, error: resendResult?.message || "provider_error" };
            }

            return { id: profile.id, status };
          } catch (error: any) {
            console.error(`Failed to send to ${profile.email}:`, error);
            return { id: profile.id, status: "failed", error: error.message };
          }
        }),
      );

      results.push(...batchResults);
    }

    const summary = {
      total: results.length,
      sent: results.filter((result) => result.status === "sent").length,
      failed: results.filter((result) => result.status === "failed").length,
      skipped: results.filter((result) => result.status === "skipped").length,
    };

    return new Response(JSON.stringify({ success: true, summary, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error sending broadcast email:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
