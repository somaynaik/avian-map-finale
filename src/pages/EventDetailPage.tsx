import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, CalendarDays, MapPin, Users, Share2,
  Loader2, Trash2, ChevronDown, ChevronUp, Navigation
} from "lucide-react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useAuth } from "@/contexts/AuthContext";
import {
  getEvent, getEventAttendees, toggleInterested, deleteEvent,
  getCategoryLabel, type EventCategory
} from "@/lib/events";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

function formatEventDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    weekday: "long", month: "long", day: "numeric",
    year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

const EventDetailPage = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showAttendees, setShowAttendees] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  const { data: event, isLoading } = useQuery({
    queryKey: ["event", eventId, user?.id],
    queryFn: () => getEvent(eventId!, user!.id),
    enabled: !!eventId && !!user?.id,
  });

  const { data: attendees = [], isLoading: loadingAttendees } = useQuery({
    queryKey: ["event-attendees", eventId],
    queryFn: () => getEventAttendees(eventId!),
    enabled: showAttendees && !!eventId,
  });

  // Build map when event loads and has coords
  useEffect(() => {
    if (!event?.latitude || !event?.longitude || !mapContainerRef.current || mapRef.current) return;

    const m = new maplibregl.Map({
      container: mapContainerRef.current,
      style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      center: [event.longitude, event.latitude],
      zoom: 13,
      interactive: false,
    });

    const el = document.createElement("div");
    el.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;">
        <div style="width:36px;height:36px;background:#1F5D3B;border-radius:50% 50% 50% 0;
          transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;
          box-shadow:0 4px 12px rgba(0,0,0,0.3);border:3px solid white;">
          <span style="transform:rotate(45deg);font-size:16px;">🐦</span>
        </div>
        <div style="width:8px;height:8px;background:rgba(31,93,59,0.3);border-radius:50%;margin-top:2px;"></div>
      </div>`;

    new maplibregl.Marker({ element: el, anchor: "bottom" })
      .setLngLat([event.longitude, event.latitude])
      .addTo(m);

    mapRef.current = m;
    return () => { m.remove(); mapRef.current = null; };
  }, [event?.latitude, event?.longitude]);

  const toggleMutation = useMutation({
    mutationFn: () => toggleInterested(eventId!, user!.id, event!.is_interested),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["event", eventId, user?.id] });
      const prev = queryClient.getQueryData(["event", eventId, user?.id]);
      queryClient.setQueryData(["event", eventId, user?.id], (old: any) =>
        old
          ? {
              ...old,
              is_interested: !old.is_interested,
              attendee_count: old.attendee_count + (old.is_interested ? -1 : 1),
            }
          : old
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      queryClient.setQueryData(["event", eventId, user?.id], ctx?.prev);
      toast({ title: "Error", variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["event", eventId, user?.id] });
      queryClient.invalidateQueries({ queryKey: ["events", user?.id] });
      if (showAttendees)
        queryClient.invalidateQueries({ queryKey: ["event-attendees", eventId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteEvent(eventId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast({ title: "Event deleted" });
      navigate("/events");
    },
    onError: () => toast({ title: "Error deleting event", variant: "destructive" }),
  });

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: event?.title, url });
    } else {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied!" });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <p className="text-muted-foreground">Event not found</p>
        <Button onClick={() => navigate("/events")}>Back to Events</Button>
      </div>
    );
  }

  const isOwner = user?.id === event.creator_id;
  const isPast = new Date(event.event_date) < new Date();

  return (
    <div className="min-h-screen bg-background pb-10">
      {/* Cover */}
      <div className="relative">
        {event.cover_image_url ? (
          <div
            className="h-56 w-full bg-cover bg-center"
            style={{ backgroundImage: `url(${event.cover_image_url})` }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-black/10" />
          </div>
        ) : (
          <div className="h-40 w-full bg-gradient-to-br from-primary/20 to-primary/5" />
        )}

        {/* Back + actions */}
        <div className="absolute top-12 left-0 right-0 flex items-center justify-between px-4">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex gap-2">
            <button
              onClick={handleShare}
              className="w-10 h-10 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-white"
            >
              <Share2 className="w-4 h-4" />
            </button>
            {isOwner && (
              <button
                onClick={() => {
                  if (confirm("Delete this event?")) deleteMutation.mutate();
                }}
                className="w-10 h-10 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-red-400"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-6 relative z-10">
        {/* Category pill */}
        <span className="inline-block px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-medium mb-3">
          {getCategoryLabel(event.category as EventCategory)}
        </span>

        {/* Title */}
        <h1 className="font-display text-2xl font-bold leading-tight mb-4">{event.title}</h1>

        {/* Key details card */}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3 mb-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <CalendarDays className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">{formatEventDate(event.event_date)}</p>
              {event.end_date && (
                <p className="text-xs text-muted-foreground">
                  Until {formatEventDate(event.end_date)}
                </p>
              )}
              {isPast && (
                <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  Past event
                </span>
              )}
            </div>
          </div>

          {event.location_name && (
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{event.location_name}</p>
                {event.latitude && event.longitude && (
                  <p className="text-xs text-muted-foreground">
                    {event.latitude.toFixed(4)}, {event.longitude.toFixed(4)}
                  </p>
                )}
              </div>
              {event.latitude && event.longitude && (
                <button
                  onClick={() =>
                    navigate("/", {
                      state: {
                        eventDestination: {
                          lat: event.latitude,
                          lng: event.longitude,
                          title: event.title,
                          locationName: event.location_name,
                          category: event.category,
                          eventDate: event.event_date,
                        },
                      },
                    })
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors shrink-0"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  Navigate
                </button>
              )}
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">{event.attendee_count} interested</p>
              {event.max_attendees && (
                <p className="text-xs text-muted-foreground">
                  {Math.max(0, event.max_attendees - event.attendee_count)} spots left of {event.max_attendees}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Map — tappable: goes to MapPage with event as navigation target */}
        {event.latitude && event.longitude && (
          <div className="mb-4 space-y-1.5">
            <button
              onClick={() =>
                navigate("/", {
                  state: {
                    eventDestination: {
                      lat: event.latitude,
                      lng: event.longitude,
                      title: event.title,
                      locationName: event.location_name,
                      category: event.category,
                      eventDate: event.event_date,
                    },
                  },
                })
              }
              className="w-full relative rounded-2xl overflow-hidden border border-border group"
              style={{ height: 200 }}
            >
              <div ref={mapContainerRef} className="w-full h-full pointer-events-none" />
              {/* Overlay that appears on hover/tap */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 bg-white text-gray-900 rounded-full px-4 py-2 shadow-lg font-medium text-sm">
                  <Navigation className="w-4 h-4" />
                  Get Directions
                </div>
              </div>
            </button>
            <p className="text-xs text-muted-foreground text-center">
              Tap the map to open navigation
            </p>
          </div>
        )}

        {/* Description */}
        {event.description && (
          <div className="mb-4">
            <h2 className="font-semibold mb-2">About this event</h2>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {event.description}
            </p>
          </div>
        )}

        {/* Organiser */}
        <div className="rounded-2xl border border-border bg-card p-4 mb-4">
          <h2 className="font-semibold text-sm mb-3">Organised by</h2>
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10">
              <AvatarImage src={event.creator_avatar_url ?? undefined} />
              <AvatarFallback>{event.creator_username.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-sm">{event.creator_username}</p>
              <p className="text-xs text-muted-foreground">Event organiser</p>
            </div>
          </div>
        </div>

        {/* Attendees accordion */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden mb-6">
          <button
            className="w-full flex items-center justify-between p-4"
            onClick={() => setShowAttendees((v) => !v)}
          >
            <h2 className="font-semibold text-sm">
              People interested ({event.attendee_count})
            </h2>
            {showAttendees ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </button>

          <AnimatePresence>
            {showAttendees && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 space-y-3">
                  {loadingAttendees ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    </div>
                  ) : attendees.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No one yet — be the first!
                    </p>
                  ) : (
                    attendees.map((a) => (
                      <div key={a.user_id} className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={a.avatar_url ?? undefined} />
                          <AvatarFallback className="text-xs">
                            {a.username.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{a.username}</p>
                          {a.full_name && (
                            <p className="text-xs text-muted-foreground">{a.full_name}</p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom CTA — different for owner vs other users */}
        {!isPast && (
          isOwner ? (
            <div className="rounded-2xl border border-border bg-card p-4 text-center space-y-1">
              <p className="text-sm font-medium">🎉 You published this event</p>
              <p className="text-xs text-muted-foreground">
                {event.attendee_count} {event.attendee_count === 1 ? "person is" : "people are"} interested
              </p>
            </div>
          ) : (
            <Button
              className="w-full text-base py-6"
              variant={event.is_interested ? "outline" : "default"}
              onClick={() => toggleMutation.mutate()}
              disabled={toggleMutation.isPending}
            >
              {toggleMutation.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : event.is_interested ? (
                "✓ Interested — tap to remove"
              ) : (
                "I'm Interested"
              )}
            </Button>
          )
        )}
      </div>
    </div>
  );
};

export default EventDetailPage;
