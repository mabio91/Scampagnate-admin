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
  // Fallback for missing first_name
  result = result.replace(/\{\{first_name\}\}/g, "");
  result = result.replace(/Ciao\s*,/g, "Ciao,");
  result = result.replace(/Ciao\s*!/g, "Ciao!");
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
        <!-- Header -->
        <tr>
          <td style="background-color:#1a3d2b;padding:28px 24px;text-align:center;">
            <h1 style="color:#f0ebe0;margin:0;font-size:22px;font-weight:700;font-family:Arial,Helvetica,sans-serif;">${template.sender_name || "Scampagnate"}</h1>
          </td>
        </tr>
        <!-- Body -->
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
        <!-- Footer -->
        <tr>
          <td style="background-color:#f5f3ef;padding:20px 24px;text-align:center;font-size:12px;color:#6b7a6e;border-top:1px solid #e5e0d5;font-family:Arial,Helvetica,sans-serif;">
            <p style="margin:0 0 8px 0;">Hai ricevuto questa email perch&eacute; hai creato un account su Scampagnate.</p>
            <p style="margin:0;">&copy; ${new Date().getFullYear()} Scampagnate. Tutti i diritti riservati.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildPlainText(template: any, vars: Record<string, string>): string {
  const body = stripHtml(replaceVariables(template.body_html, vars));
  const ctaUrl = vars.cta_url || template.cta_url || "/events";
  const siteUrl = Deno.env.get("SITE_URL") || "https://scampagnate.com";
  const fullCtaUrl = ctaUrl.startsWith("http") ? ctaUrl : `${siteUrl}${ctaUrl}`;

  let text = body;
  if (template.cta_label) {
    text += `\n\n${template.cta_label}: ${fullCtaUrl}`;
  }
  text += "\n\n---\nHai ricevuto questa email perché hai creato un account su Scampagnate.";
  text += `\n© ${new Date().getFullYear()} Scampagnate. Tutti i diritti riservati.`;
  return text;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { templateId, recipientEmail, userId, firstName, lastName, isTest } = body;

    if (!recipientEmail) {
      throw new Error("recipientEmail is required");
    }

    // Idempotency check: don't send welcome email twice for the same user (skip for test sends)
    if (userId && !isTest) {
      const { data: existingSend } = await supabaseAdmin
        .from("email_send_log")
        .select("id")
        .eq("user_id", userId)
        .eq("email_type", "welcome")
        .eq("status", "sent")
        .limit(1);
      
      if (existingSend && existingSend.length > 0) {
        console.log(`Welcome email already sent for user ${userId}, skipping.`);
        return new Response(JSON.stringify({ success: true, status: "already_sent" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Determine which template to use
    let template;
    if (templateId) {
      const { data, error } = await supabaseAdmin
        .from("email_templates")
        .select("*")
        .eq("id", templateId)
        .single();
      if (error || !data) throw new Error("Template not found");
      template = data;
    } else {
      // Get the active welcome template
      const { data, error } = await supabaseAdmin
        .from("email_templates")
        .select("*")
        .eq("is_active", true)
        .like("template_key", "welcome_email_%")
        .single();
      if (error || !data) throw new Error("No active welcome template found");
      template = data;
    }

    const vars: Record<string, string> = {
      first_name: firstName || "",
      full_name: [firstName, lastName].filter(Boolean).join(" ") || "",
      email: recipientEmail || "",
      cta_url: template.cta_url || "/events",
    };

    const htmlBody = buildEmailHtml(template, vars);
    const textBody = buildPlainText(template, vars);
    const subject = replaceVariables(template.subject, vars);

    // Send via Resend
    if (!resendApiKey) throw new Error("RESEND_API_KEY not configured");

    const fromAddress = `${template.sender_name || "Scampagnate"} <noreply@scampagnate.com>`;

    const resendPayload: Record<string, any> = {
      from: fromAddress,
      to: [recipientEmail],
      subject,
      html: htmlBody,
      text: textBody,
    };
    if (template.reply_to) {
      resendPayload.reply_to = template.reply_to;
    }

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

    // Log the send
    try {
      await supabaseAdmin.from("email_send_log").insert({
        user_id: userId || "00000000-0000-0000-0000-000000000000",
        email_type: "welcome",
        template_id: template.id,
        recipient_email: recipientEmail,
        status,
        provider_response: JSON.stringify(resendResult),
        sent_at: status === "sent" ? new Date().toISOString() : null,
      });
    } catch (logErr) {
      console.error("Failed to log email send:", logErr);
    }

    if (!resendResponse.ok) {
      throw new Error(resendResult.message || "Failed to send email");
    }

    return new Response(JSON.stringify({ success: true, status }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error sending welcome email:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
