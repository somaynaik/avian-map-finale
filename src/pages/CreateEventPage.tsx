import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, MapPin, Users, ImagePlus, Loader2, Locate, X } from "lucide-react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useAuth } from "@/contexts/AuthContext";
import { createEvent, uploadEventCover, EVENT_CATEGORIES, type EventCategory } from "@/lib/events";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

/** Debounce helper */
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const CreateEventPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<EventCategory>("bird_walk");
  const [locationName, setLocationName] = useState("");
  const [locationQuery, setLocationQuery] = useState(""); // what user is typing
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [searchingLocation, setSearchingLocation] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [eventDate, setEventDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [maxAttendees, setMaxAttendees] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [pinLocation, setPinLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showMap, setShowMap] = useState(true); // map open by default
  const [locating, setLocating] = useState(false);
  const locationInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const mapInitialised = useRef(false);

  const debouncedQuery = useDebounce(locationQuery, 400);

  // Fetch suggestions from Nominatim
  useEffect(() => {
    if (debouncedQuery.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    setSearchingLocation(true);
    fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(debouncedQuery)}&limit=6&addressdetails=0`,
      { headers: { "Accept-Language": "en" } }
    )
      .then((r) => r.json())
      .then((data: NominatimResult[]) => {
        setSuggestions(data);
        setShowSuggestions(data.length > 0);
      })
      .catch(() => setSuggestions([]))
      .finally(() => setSearchingLocation(false));
  }, [debouncedQuery]);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) &&
        locationInputRef.current && !locationInputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /** Move marker + fly map to coords */
  const flyToLocation = useCallback((lat: number, lng: number) => {
    setPinLocation({ lat, lng });
    if (mapRef.current) {
      mapRef.current.flyTo({ center: [lng, lat], zoom: 15, duration: 1000 });
    }
    if (markerRef.current) {
      markerRef.current.setLngLat([lng, lat]);
    }
  }, []);

  /** User picks a suggestion */
  const handleSelectSuggestion = (result: NominatimResult) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    setLocationName(result.display_name);
    setLocationQuery(result.display_name);
    setShowSuggestions(false);
    flyToLocation(lat, lng);
    if (!showMap) setShowMap(true);
  };

  // Init map — get GPS first, then build map at that location
  useEffect(() => {
    if (!mapContainerRef.current || mapInitialised.current) return;
    mapInitialised.current = true;

    const INDIA_FALLBACK: [number, number] = [78.9629, 20.5937];

    const buildMap = (center: [number, number], zoom: number) => {
      if (!mapContainerRef.current) return;

      const m = new maplibregl.Map({
        container: mapContainerRef.current,
        style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
        center,
        zoom,
      });

      m.addControl(new maplibregl.NavigationControl(), "top-right");

      // Draggable bird pin
      const el = document.createElement("div");
      el.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;cursor:grab;">
          <div style="width:36px;height:36px;background:#1F5D3B;border-radius:50% 50% 50% 0;
            transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;
            box-shadow:0 4px 12px rgba(0,0,0,0.3);border:3px solid white;">
            <span style="transform:rotate(45deg);font-size:16px;">🐦</span>
          </div>
          <div style="width:8px;height:8px;background:rgba(31,93,59,0.3);border-radius:50%;margin-top:2px;"></div>
        </div>`;

      const marker = new maplibregl.Marker({ element: el, draggable: true, anchor: "bottom" })
        .setLngLat(center)
        .addTo(m);

      marker.on("dragend", () => {
        const ll = marker.getLngLat();
        setPinLocation({ lat: ll.lat, lng: ll.lng });
      });

      m.on("click", (e) => {
        const { lng, lat } = e.lngLat;
        marker.setLngLat([lng, lat]);
        setPinLocation({ lat, lng });
      });

      markerRef.current = marker;
      mapRef.current = m;
      setPinLocation({ lat: center[1], lng: center[0] });
    };

    // Try GPS — build map at user location, fall back to India if denied/slow
    const geoTimeout = setTimeout(() => buildMap(INDIA_FALLBACK, 4.5), 4000);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(geoTimeout);
        if (mapInitialised.current && !mapRef.current) {
          buildMap([pos.coords.longitude, pos.coords.latitude], 14);
        }
      },
      () => {
        clearTimeout(geoTimeout);
        if (mapInitialised.current && !mapRef.current) {
          buildMap(INDIA_FALLBACK, 4.5);
        }
      },
      { timeout: 5000, maximumAge: 60000 }
    );

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
      mapInitialised.current = false;
    };
  }, []); // eslint-disable-line

  const handleLocate = async () => {
    setLocating(true);
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej)
      );
      const { latitude: lat, longitude: lng } = pos.coords;
      flyToLocation(lat, lng);
    } catch {
      toast({ title: "Could not get location", variant: "destructive" });
    } finally {
      setLocating(false);
    }
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Title is required");
      if (!eventDate) throw new Error("Event date is required");

      let cover_image_url: string | null = null;
      if (coverFile) {
        cover_image_url = await uploadEventCover(user!.id, coverFile);
      }

      return createEvent({
        creator_id: user!.id,
        title: title.trim(),
        description: description.trim(),
        category,
        location_name: locationName.trim(),
        latitude: pinLocation?.lat ?? null,
        longitude: pinLocation?.lng ?? null,
        event_date: new Date(eventDate).toISOString(),
        end_date: endDate ? new Date(endDate).toISOString() : null,
        max_attendees: maxAttendees ? parseInt(maxAttendees) : null,
        cover_image_url,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast({ title: "Event created!", description: "Your event is now live." });
      navigate("/events");
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="min-h-screen bg-background pb-10">
      {/* Header */}
      <div className="border-b border-border px-4 pb-4 pt-12">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-display text-2xl font-bold">Create Event</h1>
            <p className="text-sm text-muted-foreground">Host a bird walk, seminar, or more</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-4 space-y-5">
        {/* Cover image */}
        <div>
          <label className="block cursor-pointer">
            <input type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />
            {coverPreview ? (
              <div className="relative rounded-2xl overflow-hidden h-40">
                <img src={coverPreview} alt="cover" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <p className="text-white text-sm font-medium">Change photo</p>
                </div>
              </div>
            ) : (
              <div className="h-40 rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 hover:bg-muted/50 transition-colors">
                <ImagePlus className="w-8 h-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Add cover photo</p>
              </div>
            )}
          </label>
        </div>

        {/* Title */}
        <div className="space-y-1.5">
          <Label htmlFor="title">Event title *</Label>
          <Input
            id="title"
            placeholder="e.g. Morning Bird Walk at Sanjay Lake"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        {/* Category */}
        <div className="space-y-1.5">
          <Label htmlFor="category">Category</Label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value as EventCategory)}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {EVENT_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            placeholder="What can attendees expect? Any requirements, gear to bring, etc."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="eventDate">Start date & time *</Label>
            <Input
              id="eventDate"
              type="datetime-local"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="endDate">End (optional)</Label>
            <Input
              id="endDate"
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        {/* Location search with autocomplete */}
        <div className="space-y-1.5">
          <Label htmlFor="locationName">Location</Label>
          <div className="relative">
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
              <input
                ref={locationInputRef}
                id="locationName"
                autoComplete="off"
                placeholder="Search for a place…"
                className="w-full pl-9 pr-9 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={locationQuery}
                onChange={(e) => {
                  setLocationQuery(e.target.value);
                  setLocationName(e.target.value);
                  if (e.target.value === "") setSuggestions([]);
                }}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              />
              {/* Right side: spinner or clear */}
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {searchingLocation ? (
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                ) : locationQuery ? (
                  <button
                    type="button"
                    onClick={() => {
                      setLocationQuery("");
                      setLocationName("");
                      setSuggestions([]);
                      setShowSuggestions(false);
                      locationInputRef.current?.focus();
                    }}
                  >
                    <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                  </button>
                ) : null}
              </div>
            </div>

            {/* Suggestions dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div
                ref={suggestionsRef}
                className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border border-border rounded-xl shadow-xl overflow-hidden"
              >
                {suggestions.map((s) => (
                  <button
                    key={s.place_id}
                    type="button"
                    className="w-full flex items-start gap-2.5 px-3 py-2.5 hover:bg-muted text-left transition-colors"
                    onMouseDown={(e) => {
                      e.preventDefault(); // prevent input blur before click
                      handleSelectSuggestion(s);
                    }}
                  >
                    <MapPin className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                    <span className="text-sm leading-snug line-clamp-2">{s.display_name}</span>
                  </button>
                ))}
                <div className="px-3 py-1.5 border-t border-border">
                  <p className="text-[10px] text-muted-foreground">© OpenStreetMap contributors</p>
                </div>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Or drag the pin / click the map below</p>
        </div>

        {/* Map — always visible */}
        <div className="space-y-1.5">
          <Label>Pin location</Label>
          <div className="relative rounded-xl overflow-hidden border border-border" style={{ height: 260 }}>
            <div ref={mapContainerRef} className="absolute inset-0" />
            {/* Locate me */}
            <button
              type="button"
              onClick={handleLocate}
              disabled={locating}
              className="absolute bottom-3 right-3 z-10 w-9 h-9 rounded-full bg-card shadow-md flex items-center justify-center border border-border hover:bg-muted transition-colors"
            >
              {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Locate className="w-4 h-4" />}
            </button>
            <div className="absolute bottom-3 left-3 z-10 bg-card/90 backdrop-blur px-2 py-1 rounded-lg text-xs text-muted-foreground pointer-events-none">
              Drag pin or click map
            </div>
          </div>
          {pinLocation && (
            <p className="text-xs text-muted-foreground">
              📍 {pinLocation.lat.toFixed(5)}, {pinLocation.lng.toFixed(5)}
            </p>
          )}
        </div>

        {/* Max attendees */}
        <div className="space-y-1.5">
          <Label htmlFor="maxAttendees">Max attendees (optional)</Label>
          <div className="relative">
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="maxAttendees"
              type="number"
              placeholder="Leave blank for unlimited"
              className="pl-9"
              value={maxAttendees}
              onChange={(e) => setMaxAttendees(e.target.value)}
            />
          </div>
        </div>

        {/* Submit */}
        <Button
          className="w-full"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...</>
          ) : (
            <><CalendarDays className="w-4 h-4 mr-2" /> Publish Event</>
          )}
        </Button>
      </div>
    </div>
  );
};

export default CreateEventPage;
