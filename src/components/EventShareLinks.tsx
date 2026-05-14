import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Copy, Check, Share2, MessageCircle, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";

interface EventShareLinksProps {
  eventId: string;
  eventTitle: string;
  visibility: string;
  compact?: boolean;
}

export function EventShareLinks({ eventId, eventTitle, visibility, compact = false }: EventShareLinksProps) {
  const [copied, setCopied] = useState(false);

  const eventUrl = `${window.location.origin}/events/${eventId}`;
  const whatsappText = encodeURIComponent(`Sei invitato all'evento "${eventTitle}"!\n\n${eventUrl}`);
  const whatsappUrl = `https://wa.me/?text=${whatsappText}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(eventUrl);
      setCopied(true);
      toast.success("Link copiato negli appunti!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Impossibile copiare il link");
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copiato" : "Copia link"}
        </Button>
        <Button variant="outline" size="sm" asChild className="gap-1.5">
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="h-3.5 w-3.5" />
            WhatsApp
          </a>
        </Button>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Share2 className="h-5 w-5 text-primary" />
          Condividi evento
          {(visibility === "private" || visibility === "hidden") && (
            <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {visibility === "private" ? "Privato" : "Nascosto"}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {(visibility === "private" || visibility === "hidden") && (
          <p className="text-xs text-muted-foreground">
            Questo evento è {visibility === "private" ? "privato" : "nascosto"}. Solo chi ha il link può accedere.
          </p>
        )}

        <div className="flex gap-2">
          <div className="relative flex-1">
            <LinkIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              readOnly
              value={eventUrl}
              className="pl-9 text-sm font-mono bg-muted/50"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
          </div>
          <Button variant="outline" size="icon" onClick={handleCopy}>
            {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>

        <Button variant="outline" className="w-full gap-2" asChild>
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="h-4 w-4" />
            Condividi su WhatsApp
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
