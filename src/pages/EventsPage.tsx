import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarDays, MapPin, Users, Plus, ChevronRight,
  Binoculars, GraduationCap, Zap, TreePine, FlaskConical, MoreHorizontal
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { listEvents, toggleInterested, getCategoryLabel, type BirdEventWithMeta, type EventCategory } from "@/lib/events";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "@/hooks/use-toast";

const CATEGORY_ICONS: Record<EventCategory, React.ElementType> = {
  bird_walk: Binoculars,
  seminar: GraduationCap,
  workshop: Zap,
  birdathon: TreePine,
  citizen_science: FlaskConical,
  other: MoreHorizontal,
};

const CATEGORY_COLORS: Record<EventCategory, string> = {
  bird_walk: "bg-emerald-100 text-emerald-700",
  seminar: "bg-blue-100 text-blue-700",
  workshop: "bg-amber-100 text-amber-700",
  birdathon: "bg-purple-100 text-purple-700",
  citizen_science: "bg-cyan-100 text-cyan-700",
  other: "bg-muted text-muted-foreground",
};

function formatEventDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", {
    weekday: "short", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function EventCard({ event, onInterested }: {
  event: BirdEventWithMeta;
  onInterested: (event: BirdEventWithMeta) => void;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const CatIcon = CATEGORY_ICONS[event.category as EventCategory] ?? MoreHorizontal;
  const catColor = CATEGORY_COLORS[event.category as EventCategory] ?? CATEGORY_COLORS.other;
  const isPast = new Date(event.event_date) < new Date();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-card overflow-hidden"
    >
      {/* Cover image or gradient header */}
      {event.cover_image_url ? (
        <div
          className="h-36 w-full bg-cover bg-center relative"
          style={{ backgroundImage: `url(${event.cover_image_url})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-3 left-3">
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${catColor}`}>
              <CatIcon className="w-3 h-3" />
              {getCategoryLabel(event.category as EventCategory)}
            </span>
          </div>
          {isPast && (
            <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-xs font-medium">
              Past
            </div>
          )}
        </div>
      ) : (
        <div className="h-20 w-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center relative">
          <CatIcon className="w-10 h-10 text-primary/30" />
          <div className="absolute bottom-2 left-3">
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${catColor}`}>
              <CatIcon className="w-3 h-3" />
              {getCategoryLabel(event.category as EventCategory)}
            </span>
          </div>
          {isPast && (
            <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-medium">
              Past
            </div>
          )}
        </div>
      )}

      <div className="p-4">
        {/* Title + date */}
        <button
          className="text-left w-full"
          onClick={() => navigate(`/events/${event.id}`)}
        >
          <h3 className="font-semibold text-base leading-tight mb-1 hover:text-primary transition-colors">
            {event.title}
          </h3>
        </button>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
          <CalendarDays className="w-3.5 h-3.5 shrink-0" />
          <span>{formatEventDate(event.event_date)}</span>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
          <MapPin className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{event.location_name || "Location TBD"}</span>
        </div>

        {/* Creator + attendees row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Avatar className="w-6 h-6">
              <AvatarImage src={event.creator_avatar_url ?? undefined} />
              <AvatarFallback className="text-[10px]">
                {event.creator_username.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground">by {event.creator_username}</span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="w-3.5 h-3.5" />
            <span>{event.attendee_count} interested</span>
          </div>
        </div>

        {/* Action row */}
        <div className="flex gap-2 mt-3">
          {user?.id === event.creator_id ? (
            <div className="flex-1 py-2 rounded-xl bg-muted text-center text-sm font-medium text-muted-foreground">
              Your event · {event.attendee_count} interested
            </div>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onInterested(event); }}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                event.is_interested
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground hover:bg-primary/10"
              }`}
            >
              {event.is_interested ? "✓ Interested" : "I'm Interested"}
            </button>
          )}
          <button
            onClick={() => navigate(`/events/${event.id}`)}
            className="px-3 py-2 rounded-xl bg-muted hover:bg-muted/80 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

const FILTERS: { label: string; value: string }[] = [
  { label: "All", value: "all" },
  { label: "Bird Walks", value: "bird_walk" },
  { label: "Seminars", value: "seminar" },
  { label: "Workshops", value: "workshop" },
  { label: "Birdathons", value: "birdathon" },
  { label: "Citizen Science", value: "citizen_science" },
];

const EventsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("all");

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["events", user?.id],
    queryFn: () => listEvents(user!.id),
    enabled: !!user?.id,
    refetchInterval: 60_000,
  });

  const toggleMutation = useMutation({
    mutationFn: (event: BirdEventWithMeta) =>
      toggleInterested(event.id, user!.id, event.is_interested),
    onMutate: async (event) => {
      await queryClient.cancelQueries({ queryKey: ["events", user?.id] });
      const prev = queryClient.getQueryData<BirdEventWithMeta[]>(["events", user?.id]);
      queryClient.setQueryData<BirdEventWithMeta[]>(["events", user?.id], (old) =>
        old?.map((e) =>
          e.id === event.id
            ? {
                ...e,
                is_interested: !e.is_interested,
                attendee_count: e.attendee_count + (e.is_interested ? -1 : 1),
              }
            : e
        )
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      queryClient.setQueryData(["events", user?.id], ctx?.prev);
      toast({ title: "Error", description: "Could not update interest.", variant: "destructive" });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["events", user?.id] }),
  });

  const filtered = filter === "all" ? events : events.filter((e) => e.category === filter);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border px-4 pt-12 pb-3">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="font-display text-2xl font-bold">Events</h1>
              <p className="text-xs text-muted-foreground">Bird walks, seminars & more</p>
            </div>
            <button
              onClick={() => navigate("/events/create")}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" />
              Create
            </button>
          </div>

          {/* Category filters */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  filter === f.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="rounded-2xl border border-border bg-card overflow-hidden animate-pulse">
                <div className="h-20 bg-muted" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-muted rounded w-2/3" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                  <div className="h-3 bg-muted rounded w-1/3" />
                  <div className="h-9 bg-muted rounded-xl mt-3" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
              <CalendarDays className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="font-medium">No events yet</p>
            <p className="text-sm text-muted-foreground">Be the first to create one!</p>
            <button
              onClick={() => navigate("/events/create")}
              className="mt-2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium"
            >
              Create Event
            </button>
          </div>
        ) : (
          <AnimatePresence>
            {filtered.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onInterested={(e) => toggleMutation.mutate(e)}
              />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};

export default EventsPage;
