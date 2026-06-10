import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Copy, Download, Loader2, Printer, QrCode, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { getSelfCheckInErrorMessage, invokeEventSelfCheckIn } from "@/lib/eventSelfCheckIn";

type EventCheckInQrDialogProps = {
  eventId: string;
  eventTitle: string;
  eventDate?: string | null;
  eventTime?: string | null;
  eventLocation?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const PUBLIC_APP_ORIGIN = import.meta.env.VITE_PUBLIC_APP_ORIGIN || "https://www.scampagnate.com";

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const slugify = (value: string) =>
  value.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "evento";

const formatEventDate = (value?: string | null) => {
  if (!value) return null;
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
};

const toWebOnlyCheckInUrl = (value: string, eventId: string) => {
  const url = new URL(value);
  url.pathname = `/check-in/event/${eventId}`;
  return url.toString();
};

export function EventCheckInQrDialog({
  eventId,
  eventTitle,
  eventDate,
  eventTime,
  eventLocation,
  open,
  onOpenChange,
}: EventCheckInQrDialogProps) {
  const [checkInUrl, setCheckInUrl] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const eventMeta = useMemo(
    () => [formatEventDate(eventDate), eventTime, eventLocation].filter(Boolean).join(" · "),
    [eventDate, eventLocation, eventTime],
  );

  const generateQr = useCallback(async () => {
    setLoading(true);
    try {
      const result = await invokeEventSelfCheckIn({
        action: "generate",
        eventId,
        origin: PUBLIC_APP_ORIGIN,
      });
      if (!result.checkInUrl) throw new Error("SELF_CHECKIN_LINK_MISSING");
      const webOnlyCheckInUrl = toWebOnlyCheckInUrl(result.checkInUrl, eventId);

      const qr = await QRCode.toDataURL(webOnlyCheckInUrl, {
        width: 640,
        margin: 2,
        errorCorrectionLevel: "M",
        color: {
          dark: "#24452d",
          light: "#ffffff",
        },
      });

      setCheckInUrl(webOnlyCheckInUrl);
      setQrDataUrl(qr);
      setExpiresAt(result.expiresAt || null);
    } catch (error) {
      const message = error instanceof Error ? error.message : null;
      toast({
        title: "QR non generato",
        description: getSelfCheckInErrorMessage(message),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [eventId, toast]);

  useEffect(() => {
    if (open && !checkInUrl && !loading) void generateQr();
  }, [checkInUrl, generateQr, loading, open]);

  const copyLink = async () => {
    if (!checkInUrl) return;
    await navigator.clipboard.writeText(checkInUrl);
    toast({ title: "Link check-in copiato" });
  };

  const downloadQr = () => {
    if (!qrDataUrl) return;
    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = `${slugify(eventTitle)}-checkin-qr.png`;
    link.click();
  };

  const printQr = () => {
    if (!qrDataUrl || !checkInUrl) return;

    const printWindow = window.open("", "_blank", "width=760,height=980");
    if (!printWindow) {
      toast({
        title: "Stampa bloccata",
        description: "Consenti i popup per aprire il foglio di stampa.",
        variant: "destructive",
      });
      return;
    }

    const escapedTitle = escapeHtml(eventTitle);
    const escapedMeta = escapeHtml(eventMeta);
    const escapedUrl = escapeHtml(checkInUrl);
    printWindow.document.write(`
      <!doctype html>
      <html lang="it">
        <head>
          <meta charset="utf-8" />
          <title>QR check-in - ${escapedTitle}</title>
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              background: #f7f4ef;
              color: #183326;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            }
            main {
              width: min(92vw, 680px);
              padding: 48px;
              border: 1px solid #d9d3ca;
              border-radius: 24px;
              background: #fffdf9;
              text-align: center;
            }
            .eyebrow {
              margin: 0 0 16px;
              color: #c6822f;
              font-size: 15px;
              font-weight: 800;
              letter-spacing: 0.14em;
              text-transform: uppercase;
            }
            h1 {
              margin: 0;
              font-size: 38px;
              line-height: 1.08;
            }
            .meta {
              margin: 18px 0 30px;
              color: #64796d;
              font-size: 18px;
              line-height: 1.4;
            }
            img {
              width: min(78vw, 430px);
              height: min(78vw, 430px);
              object-fit: contain;
            }
            .instructions {
              margin: 28px auto 0;
              max-width: 500px;
              font-size: 22px;
              font-weight: 800;
              line-height: 1.25;
            }
            .url {
              margin-top: 24px;
              color: #7b897f;
              font-size: 12px;
              overflow-wrap: anywhere;
            }
            @media print {
              body { background: white; }
              main {
                width: 100%;
                min-height: 100vh;
                border: 0;
                border-radius: 0;
                padding: 36px;
              }
            }
          </style>
        </head>
        <body>
          <main>
            <p class="eyebrow">Scampagnate</p>
            <h1>${escapedTitle}</h1>
            ${escapedMeta ? `<p class="meta">${escapedMeta}</p>` : ""}
            <img src="${qrDataUrl}" alt="QR check-in evento" />
            <p class="instructions">Scansiona il QR e accedi con il tuo account per confermare la presenza.</p>
            <p class="url">${escapedUrl}</p>
          </main>
          <script>
            window.addEventListener("load", () => {
              window.print();
            });
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            QR check-in evento
          </DialogTitle>
          <DialogDescription>
            Genera il QR da stampare e mettere sui tavoli o all'ingresso dell'evento.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 md:grid-cols-[220px_1fr]">
          <div className="flex aspect-square items-center justify-center rounded-lg border bg-white p-3">
            {loading ? (
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            ) : qrDataUrl ? (
              <img src={qrDataUrl} alt="QR check-in evento" className="h-full w-full object-contain" />
            ) : (
              <QrCode className="h-12 w-12 text-muted-foreground" />
            )}
          </div>

          <div className="min-w-0 space-y-4">
            <div>
              <p className="text-sm font-semibold leading-tight">{eventTitle}</p>
              {eventMeta && <p className="mt-1 text-xs text-muted-foreground">{eventMeta}</p>}
              {expiresAt && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Valido fino al{" "}
                  {new Date(expiresAt).toLocaleDateString("it-IT", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
                </p>
              )}
            </div>

            {checkInUrl && (
              <p className="max-h-20 overflow-y-auto rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground break-all">
                {checkInUrl}
              </p>
            )}

            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" size="sm" onClick={copyLink} disabled={!checkInUrl}>
                <Copy className="h-4 w-4" />
                Copia
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={downloadQr} disabled={!qrDataUrl}>
                <Download className="h-4 w-4" />
                PNG
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={generateQr} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Rigenera
              </Button>
              <Button type="button" size="sm" onClick={printQr} disabled={!qrDataUrl}>
                <Printer className="h-4 w-4" />
                Stampa
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
