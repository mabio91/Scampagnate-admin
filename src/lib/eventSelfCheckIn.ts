import { supabase } from "@/integrations/supabase/client";

type EventSelfCheckInAction = "generate" | "checkin";

type InvokeParams = {
  action: EventSelfCheckInAction;
  eventId: string;
  token?: string;
  origin?: string;
};

export type EventSelfCheckInResult = {
  success?: boolean;
  error?: string;
  checkInUrl?: string;
  expiresAt?: string;
  eventTitle?: string;
  alreadyCheckedIn?: boolean;
  registrationId?: string;
};

type FunctionErrorWithContext = Error & {
  context?: {
    json?: () => Promise<unknown>;
  };
};

const readFunctionErrorMessage = async (error: unknown) => {
  const context = (error as FunctionErrorWithContext | null)?.context;
  if (context?.json) {
    try {
      const payload = await context.json();
      if (payload && typeof payload === "object" && "error" in payload) {
        const payloadError = (payload as { error?: unknown }).error;
        if (typeof payloadError === "string") return payloadError;
      }
    } catch {
      // Use the SDK error message below.
    }
  }

  return error instanceof Error ? error.message : "SELF_CHECKIN_FAILED";
};

export const getSelfCheckInErrorMessage = (error?: string | null) => {
  switch (error) {
    case "AUTH_REQUIRED":
      return "Accedi come admin per generare il QR.";
    case "FORBIDDEN":
      return "Non hai i permessi per generare il QR di questo evento.";
    case "EVENT_NOT_FOUND":
      return "Evento non trovato.";
    case "INVALID_TOKEN":
      return "QR non valido. Genera un nuovo codice.";
    case "EXPIRED_TOKEN":
      return "QR scaduto. Genera un nuovo codice.";
    case "CHECKIN_WINDOW_CLOSED":
      return "Il check-in via QR non e attivo in questo momento.";
    case "EVENT_NOT_CHECKINABLE":
      return "Questo evento non accetta check-in via QR.";
    default:
      return error || "Non siamo riusciti a completare l'operazione.";
  }
};

export const invokeEventSelfCheckIn = async ({
  action,
  eventId,
  token,
  origin,
}: InvokeParams): Promise<EventSelfCheckInResult> => {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (sessionError || !accessToken) {
    throw new Error("AUTH_REQUIRED");
  }

  const { data, error } = await supabase.functions.invoke("event-self-checkin", {
    body: { action, eventId, token, origin },
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (error) {
    throw new Error(await readFunctionErrorMessage(error));
  }

  const result = (data || {}) as EventSelfCheckInResult;
  if (result.success === false) {
    throw new Error(result.error || "SELF_CHECKIN_FAILED");
  }

  return result;
};
