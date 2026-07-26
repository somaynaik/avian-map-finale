import { supabase } from "./supabase";

export type EventCategory = "bird_walk" | "seminar" | "workshop" | "birdathon" | "citizen_science" | "other";

export interface BirdEvent {
  id: string;
  creator_id: string;
  title: string;
  description: string;
  category: EventCategory;
  location_name: string;
  latitude: number | null;
  longitude: number | null;
  event_date: string;
  end_date: string | null;
  max_attendees: number | null;
  cover_image_url: string | null;
  created_at: string;
}

export interface BirdEventWithMeta extends BirdEvent {
  creator_username: string;
  creator_avatar_url: string | null;
  attendee_count: number;
  is_interested: boolean;
}

export interface EventAttendee {
  user_id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  joined_at: string;
}

const CATEGORY_LABELS: Record<EventCategory, string> = {
  bird_walk: "Bird Walk",
  seminar: "Seminar",
  workshop: "Workshop",
  birdathon: "Birdathon",
  citizen_science: "Citizen Science",
  other: "Other",
};

export function getCategoryLabel(cat: EventCategory): string {
  return CATEGORY_LABELS[cat] ?? "Other";
}

export const EVENT_CATEGORIES: { value: EventCategory; label: string }[] = Object.entries(
  CATEGORY_LABELS
).map(([value, label]) => ({ value: value as EventCategory, label }));

// ── SQL to run once in Supabase SQL editor ───────────────────────────────────
// create table if not exists bird_events (
//   id uuid primary key default gen_random_uuid(),
//   creator_id uuid references profiles(id) on delete cascade not null,
//   title text not null,
//   description text not null default '',
//   category text not null default 'other',
//   location_name text not null default '',
//   latitude double precision,
//   longitude double precision,
//   event_date timestamptz not null,
//   end_date timestamptz,
//   max_attendees int,
//   cover_image_url text,
//   created_at timestamptz default now()
// );
//
// create table if not exists event_attendees (
//   event_id uuid references bird_events(id) on delete cascade,
//   user_id uuid references profiles(id) on delete cascade,
//   joined_at timestamptz default now(),
//   primary key (event_id, user_id)
// );
//
// alter table bird_events enable row level security;
// alter table event_attendees enable row level security;
// create policy "public read events" on bird_events for select using (true);
// create policy "auth create events" on bird_events for insert with check (auth.uid() = creator_id);
// create policy "auth delete own events" on bird_events for delete using (auth.uid() = creator_id);
// create policy "auth update own events" on bird_events for update using (auth.uid() = creator_id);
// create policy "public read attendees" on event_attendees for select using (true);
// create policy "auth join event" on event_attendees for insert with check (auth.uid() = user_id);
// create policy "auth leave event" on event_attendees for delete using (auth.uid() = user_id);
// ─────────────────────────────────────────────────────────────────────────────

export async function listEvents(currentUserId: string): Promise<BirdEventWithMeta[]> {
  const { data: events, error } = await supabase
    .from("bird_events")
    .select("*")
    .gte("event_date", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // include events from last 24h
    .order("event_date", { ascending: true });

  if (error) throw error;
  if (!events?.length) return [];

  const creatorIds = [...new Set(events.map((e) => e.creator_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, avatar_url")
    .in("id", creatorIds);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const eventIds = events.map((e) => e.id);
  const { data: attendees } = await supabase
    .from("event_attendees")
    .select("event_id, user_id")
    .in("event_id", eventIds);

  const countMap = new Map<string, number>();
  const interestedSet = new Set<string>();
  (attendees ?? []).forEach((a) => {
    countMap.set(a.event_id, (countMap.get(a.event_id) ?? 0) + 1);
    if (a.user_id === currentUserId) interestedSet.add(a.event_id);
  });

  return events.map((e) => {
    const profile = profileMap.get(e.creator_id);
    return {
      ...e,
      creator_username: profile?.username ?? "unknown",
      creator_avatar_url: profile?.avatar_url ?? null,
      attendee_count: countMap.get(e.id) ?? 0,
      is_interested: interestedSet.has(e.id),
    };
  });
}

export async function getEvent(
  eventId: string,
  currentUserId: string
): Promise<BirdEventWithMeta | null> {
  const { data: event, error } = await supabase
    .from("bird_events")
    .select("*")
    .eq("id", eventId)
    .single();

  if (error || !event) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, avatar_url")
    .eq("id", event.creator_id)
    .single();

  const { count: attendee_count } = await supabase
    .from("event_attendees")
    .select("*", { count: "exact", head: true })
    .eq("event_id", eventId);

  const { data: myRow } = await supabase
    .from("event_attendees")
    .select("user_id")
    .eq("event_id", eventId)
    .eq("user_id", currentUserId)
    .maybeSingle();

  return {
    ...event,
    creator_username: profile?.username ?? "unknown",
    creator_avatar_url: profile?.avatar_url ?? null,
    attendee_count: attendee_count ?? 0,
    is_interested: !!myRow,
  };
}

export async function getEventAttendees(eventId: string): Promise<EventAttendee[]> {
  const { data: rows, error } = await supabase
    .from("event_attendees")
    .select("user_id, joined_at")
    .eq("event_id", eventId)
    .order("joined_at", { ascending: true });

  if (error || !rows?.length) return [];

  const ids = rows.map((r) => r.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_url")
    .in("id", ids);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  return rows.map((r) => {
    const p = profileMap.get(r.user_id);
    return {
      user_id: r.user_id,
      username: p?.username ?? "unknown",
      full_name: p?.full_name ?? null,
      avatar_url: p?.avatar_url ?? null,
      joined_at: r.joined_at,
    };
  });
}

export async function toggleInterested(
  eventId: string,
  userId: string,
  currentlyInterested: boolean
): Promise<void> {
  if (currentlyInterested) {
    await supabase
      .from("event_attendees")
      .delete()
      .eq("event_id", eventId)
      .eq("user_id", userId);
  } else {
    await supabase
      .from("event_attendees")
      .insert({ event_id: eventId, user_id: userId });
  }
}

export async function createEvent(input: {
  creator_id: string;
  title: string;
  description: string;
  category: EventCategory;
  location_name: string;
  latitude: number | null;
  longitude: number | null;
  event_date: string;
  end_date: string | null;
  max_attendees: number | null;
  cover_image_url: string | null;
}): Promise<BirdEvent> {
  const { data, error } = await supabase
    .from("bird_events")
    .insert(input)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteEvent(eventId: string): Promise<void> {
  const { error } = await supabase.from("bird_events").delete().eq("id", eventId);
  if (error) throw error;
}

export async function uploadEventCover(userId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop();
  const path = `events/${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("post-images").upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from("post-images").getPublicUrl(path);
  return data.publicUrl;
}
