import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function fetchDomain(resendApiKey: string) {
  const listResponse = await fetch("https://api.resend.com/domains", {
    headers: {
      "Authorization": `Bearer ${resendApiKey}`,
    },
  });

  if (!listResponse.ok) {
    const errorData = await listResponse.json();
    throw new Error(errorData.message || "Failed to fetch domains");
  }

  const { data: domains } = await listResponse.json();
  const domain = domains.find((item: any) => item.name === "scampagnate.com") || domains[0];

  if (!domain) return null;

  const detailResponse = await fetch(`https://api.resend.com/domains/${domain.id}`, {
    headers: {
      "Authorization": `Bearer ${resendApiKey}`,
    },
  });

  if (!detailResponse.ok) {
    const errorData = await detailResponse.json();
    throw new Error(errorData.message || "Failed to fetch domain details");
  }

  return await detailResponse.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY not configured");

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = body?.action || "status";

    let domainDetails = await fetchDomain(resendApiKey);
    if (!domainDetails) {
      return new Response(JSON.stringify({
        status: "not_found",
        message: "No domain found in Resend account.",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let message = "Stato dominio recuperato";

    if (action === "verify" && domainDetails.status !== "verified") {
      const verifyResponse = await fetch(`https://api.resend.com/domains/${domainDetails.id}/verify`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
        },
      });

      if (!verifyResponse.ok) {
        const verifyError = await verifyResponse.json();
        throw new Error(verifyError.message || "Failed to verify domain");
      }

      domainDetails = await fetchDomain(resendApiKey);
      message = domainDetails?.status === "verified"
        ? "Dominio verificato con successo"
        : "Verifica dominio avviata. Controlla i record DNS e aggiorna lo stato.";
    }

    return new Response(JSON.stringify({
      ...domainDetails,
      message,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error fetching domain status:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
