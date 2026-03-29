import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { EventParticipantsList } from "@/components/participants/EventParticipantsList";
import { EventBadgePills } from "@/components/EventBadges";
import { EventShareLinks } from "@/components/EventShareLinks";
import { useTrekkingDifficultyLevels, getDifficultyByValue } from "@/hooks/useTrekkingDifficultyLevels";
import {
  ArrowLeft, MapPin, Calendar, Clock, Users, DollarSign,
  Eye, Shield, Image as ImageIcon, ChevronRight,
} from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Event = Tables<"events">;
type EventWithCategory = Event & { event_categories: { name: string; icon: string } | null };

const statusColors: Record<string, string> = {
  available: "text-success border-success/30 bg-success/10",
  full: "text-warning border-warning/30 bg-warning/10",
  closed: "text-destructive border-destructive/30 bg-destructive/10",
  draft: "text-muted-foreground border-muted-foreground/30 bg-muted/50",
  published: "text-success border-success/30 bg-success/10",
  cancelled: "text-destructive border-destructive/30 bg-destructive/10",
  past: "text-muted-foreground border-muted-foreground/30 bg-muted/50",
};

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: event, isLoading } = useQuery({
    queryKey: ["event-detail", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*, event_categories(name, icon)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as EventWithCategory;
    },
  });

  const { data: registrations = [] } = useQuery({
    queryKey: ["event-registrations", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase
        .from("event_registrations")
        .select("id, status, checked_in")
        .eq("event_id", id!);
      return data || [];
    },
  });

  const { data: meetingPoints = [] } = useQuery({
    queryKey: ["event-meeting-points", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase
        .from("event_meeting_points")
        .select("*")
        .eq("event_id", id!)
        .order("sort_order");
      return data || [];
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate("/events")} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Torna agli eventi
        </Button>
        <p className="text-muted-foreground text-center py-12">Evento non trovato</p>
      </div>
    );
  }

  const checkedIn = registrations.filter((r) => r.checked_in).length;
  const registered = registrations.filter((r) => ["registered", "paid"].includes(r.status)).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/events")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold truncate">{event.title}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant="outline" className={statusColors[event.status] || ""}>{event.status}</Badge>
            {event.event_categories && (
              <Badge variant="secondary">{event.event_categories.icon} {event.event_categories.name}</Badge>
            )}
            <Badge variant="outline">{event.visibility}</Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Event info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Cover Image */}
          {event.image_url ? (
            <div className="relative">
              <img src={event.image_url} alt={event.title} className="w-full h-56 object-cover rounded-xl border" />
              <EventBadgePills event={event} className="absolute top-3 left-3" />
            </div>
          ) : (
            <div className="relative w-full h-56 bg-muted rounded-xl flex items-center justify-center border border-dashed">
              <ImageIcon className="h-10 w-10 text-muted-foreground" />
              <EventBadgePills event={event} className="absolute top-3 left-3" />
            </div>
          )}

          {/* Details Card */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Dettagli evento</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{event.date}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{event.time}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{event.location}</span>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span>{event.price > 0 ? `€${event.price}` : "Gratuito"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>{event.spots_taken}/{event.spots_total} posti</span>
                </div>
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  <span>Organizzatore: {event.organizer_name}</span>
                </div>
              </div>

              {event.difficulty && (() => {
                const dl = getDifficultyByValue(difficultyLevels, event.difficulty);
                return dl ? (
                  <div className="flex items-center gap-2 text-sm">
                    <strong>Difficoltà:</strong>
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-semibold"
                      style={{
                        backgroundColor: dl.color_background,
                        color: dl.color_primary,
                        border: `1px solid ${dl.color_border}`,
                      }}
                    >
                      <span style={{ color: dl.color_icon }}>{dl.icon}</span>
                      {dl.label}
                    </span>
                  </div>
                ) : (
                  <p className="text-sm"><strong>Difficoltà:</strong> {event.difficulty}</p>
                );
              })()}
              {event.duration && (
                <p className="text-sm"><strong>Durata:</strong> {event.duration}</p>
              )}
              {event.distance && (
                <p className="text-sm"><strong>Distanza:</strong> {event.distance}</p>
              )}
              {event.elevation && (
                <p className="text-sm"><strong>Dislivello:</strong> {event.elevation}</p>
              )}

              <Separator />
              <div>
                <p className="font-medium mb-1">Descrizione</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{event.description || "—"}</p>
              </div>
            </CardContent>
          </Card>

          {/* Meeting Points */}
          {meetingPoints.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-lg">Punti di ritrovo</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {meetingPoints.map((mp) => (
                    <div key={mp.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                      <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <div className="text-sm">
                        <p className="font-medium">{mp.name}</p>
                        <p className="text-muted-foreground">{mp.location} — {mp.time}</p>
                        {mp.notes && <p className="text-xs text-muted-foreground mt-1">{mp.notes}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Gallery */}
          {event.gallery_images && (event.gallery_images as string[]).length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-lg">Galleria</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {(event.gallery_images as string[]).map((img, idx) => (
                    <img key={idx} src={img} alt={`Gallery ${idx + 1}`} className="w-full h-32 object-cover rounded-lg border" />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column - Participants */}
        <div className="space-y-6">
          {/* Stats */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold">{registered}</p>
                  <p className="text-xs text-muted-foreground">Iscritti</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{checkedIn}</p>
                  <p className="text-xs text-muted-foreground">Check-in</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{event.spots_total - event.spots_taken}</p>
                  <p className="text-xs text-muted-foreground">Disponibili</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Share Links */}
          <EventShareLinks eventId={event.id} eventTitle={event.title} visibility={event.visibility} />

          {/* Participants List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Partecipanti ({registrations.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <EventParticipantsList eventId={event.id} isAdmin />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
