import { useEffect, useRef, useState, useMemo } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./MapPage.css";
import { Search, SlidersHorizontal, Locate, Loader2, X, MapPin, Clock, ChevronDown, Check, Users, ExternalLink, Volume2, VolumeX } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Geolocation } from "@capacitor/geolocation";
import { Capacitor } from "@capacitor/core";
import { TextToSpeech } from "@capacitor-community/text-to-speech";
import { useTheme } from "next-themes";
import { getRecentObservations, getNearbyObservations, type RecentObservation } from "@/lib/ebird";
import { getRecentGeoTaggedPosts, type GeoTaggedPost } from "@/lib/social";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { BirdImage } from "./DashboardPage";

const BIRD_IMAGE_CACHE: Record<string, string> = {};

// Indian states/regions for filtering
const INDIAN_REGIONS = [
  { code: 'NEARBY', name: 'Near Me' },
  { code: 'IN', name: 'All India' },
  { code: 'IN-AN', name: 'Andaman & Nicobar' },
  { code: 'IN-AP', name: 'Andhra Pradesh' },
  { code: 'IN-AR', name: 'Arunachal Pradesh' },
  { code: 'IN-AS', name: 'Assam' },
  { code: 'IN-BR', name: 'Bihar' },
  { code: 'IN-CH', name: 'Chandigarh' },
  { code: 'IN-CT', name: 'Chhattisgarh' },
  { code: 'IN-DL', name: 'Delhi' },
  { code: 'IN-GA', name: 'Goa' },
  { code: 'IN-GJ', name: 'Gujarat' },
  { code: 'IN-HR', name: 'Haryana' },
  { code: 'IN-HP', name: 'Himachal Pradesh' },
  { code: 'IN-JK', name: 'Jammu & Kashmir' },
  { code: 'IN-JH', name: 'Jharkhand' },
  { code: 'IN-KA', name: 'Karnataka' },
  { code: 'IN-KL', name: 'Kerala' },
  { code: 'IN-MP', name: 'Madhya Pradesh' },
  { code: 'IN-MH', name: 'Maharashtra' },
  { code: 'IN-MN', name: 'Manipur' },
  { code: 'IN-ML', name: 'Meghalaya' },
  { code: 'IN-MZ', name: 'Mizoram' },
  { code: 'IN-NL', name: 'Nagaland' },
  { code: 'IN-OR', name: 'Odisha' },
  { code: 'IN-PY', name: 'Puducherry' },
  { code: 'IN-PB', name: 'Punjab' },
  { code: 'IN-RJ', name: 'Rajasthan' },
  { code: 'IN-SK', name: 'Sikkim' },
  { code: 'IN-TN', name: 'Tamil Nadu' },
  { code: 'IN-TG', name: 'Telangana' },
  { code: 'IN-TR', name: 'Tripura' },
  { code: 'IN-UP', name: 'Uttar Pradesh' },
  { code: 'IN-UT', name: 'Uttarakhand' },
  { code: 'IN-WB', name: 'West Bengal' },
];

const RARITY_COLORS: Record<string, string> = {
  common: "#3a7d52",
  rare: "#d4913a",
};

// Helper to calculate time ago
function getTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  return 'Just now';
}

// Helper to calculate distance in km using Haversine formula
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const getSearchTerms = (query: string): string[] => {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const terms = [q];

  const synonymMap: Record<string, string[]> = {
    "peacock": ["peafowl", "pavo"],
    "peafowl": ["peacock", "pavo"],
    "pigeon": ["columba", "dove"],
    "dove": ["pigeon", "columba"],
    "sparrow": ["passer"],
    "crow": ["corvus"],
    "eagle": ["aquila", "haliaeetus"],
    "owl": ["bubo", "strigidae", "tyto"],
    "duck": ["anas", "anatidae"],
    "goose": ["anser"],
    "swan": ["cygnus"],
    "myna": ["acridotheres"],
    "koel": ["eudynamys"],
    "bulbul": ["pycnonotus"],
    "parakeet": ["psittacula", "parrot"],
    "parrot": ["parakeet", "psittaciformes"]
  };

  Object.entries(synonymMap).forEach(([key, values]) => {
    if (q.includes(key)) {
      terms.push(...values);
    }
    values.forEach(val => {
      if (q.includes(val)) {
        terms.push(key, ...values.filter(v => v !== val));
      }
    });
  });

  return Array.from(new Set(terms));
};

const matchSearch = (query: string, name: string, sciName?: string) => {
  if (!query) return true;
  const terms = getSearchTerms(query);
  const nameLower = name.toLowerCase();
  const sciLower = sciName ? sciName.toLowerCase() : "";
  return terms.some(term => nameLower.includes(term) || sciLower.includes(term));
};

const MapPage = () => {
  const { theme } = useTheme();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const activeRouteCoordsRef = useRef<any[] | null>(null);
  const currentStyleRef = useRef<string>("");
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const communityMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const routePopupRef = useRef<maplibregl.Popup | null>(null);
  const activePopupRef = useRef<maplibregl.Popup | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRegion, setSelectedRegion] = useState('NEARBY');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [regionSearch, setRegionSearch] = useState("");

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const isClearingMarkersRef = useRef(false);
  const isClearingCommunityMarkersRef = useRef(false);
  const lastRouteFetchCoords = useRef<{ lat: number, lng: number } | null>(null);
  const lastSelectedSightingId = useRef<string | null>(null);

  const [selectedSighting, setSelectedSighting] = useState<(RecentObservation & {
    id?: string;
    isCommunity?: boolean;
    imageUrl?: string;
    authorName?: string;
  }) | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [showWeatherDetails, setShowWeatherDetails] = useState(false);

  // Active Navigation Guidance States
  const [isNavigating, setIsNavigating] = useState(false);
  const [hasArrived, setHasArrived] = useState(false);
  const [navigationSteps, setNavigationSteps] = useState<{ instruction: string; distance: number; duration: number }[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [remainingDistance, setRemainingDistance] = useState<number | null>(null);
  const [remainingDuration, setRemainingDuration] = useState<number | null>(null);
  const [isVoiceMuted, setIsVoiceMuted] = useState(false);

  const speakInstruction = (text: string) => {
    if (Capacitor.isNativePlatform()) {
      TextToSpeech.stop().catch(() => { });
      TextToSpeech.speak({
        text: text,
        lang: 'en-US',
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0,
        category: 'ambient'
      }).catch((err) => console.error("Native TTS failed:", err));
    } else {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
      }
    }
  };

  // Voice Navigation Guidance Speaker
  useEffect(() => {
    if (isNavigating && !isVoiceMuted && navigationSteps[currentStepIndex]) {
      const step = navigationSteps[currentStepIndex];
      let spokenText = step.instruction;
      if (step.distance > 5) {
        spokenText = `In ${Math.round(step.distance)} meters, ${spokenText}`;
      }
      speakInstruction(spokenText);
    }
  }, [isNavigating, currentStepIndex, navigationSteps, isVoiceMuted]);

  useEffect(() => {
    if (hasArrived && !isVoiceMuted) {
      speakInstruction("You have arrived at your destination. Happy birding!");
    }
  }, [hasArrived, isVoiceMuted]);

  // Cancel speech when navigation ends
  useEffect(() => {
    if (!isNavigating) {
      if (Capacitor.isNativePlatform()) {
        TextToSpeech.stop().catch(() => { });
      } else {
        if (typeof window !== "undefined" && window.speechSynthesis) {
          window.speechSynthesis.cancel();
        }
      }
    }
  }, [isNavigating]);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    handleResize(); // set initially
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const [isSidebarMinimized, setIsSidebarMinimized] = useState(true);

  // Continuous watchPosition location tracking when active navigation is enabled
  useEffect(() => {
    if (!isNavigating) return;

    let watchId: string;
    const startWatching = async () => {
      try {
        watchId = await Geolocation.watchPosition({
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }, (position, err) => {
          if (err) {
            console.error("WatchPosition error:", err);
            return;
          }
          if (position) {
            const { latitude, longitude } = position.coords;
            setUserLocation({ lat: latitude, lng: longitude });

            // If navigating, we auto-follow user location on map
            if (map.current) {
              map.current.easeTo({
                center: [longitude, latitude],
                zoom: 17,
                pitch: 50,
                duration: 1000
              });
            }
          }
        });
      } catch (error) {
        console.error("Error setting up watchPosition:", error);
      }
    };

    startWatching();

    return () => {
      if (watchId) {
        Geolocation.clearWatch({ id: watchId });
      }
    };
  }, [isNavigating]);

  // Handle auto-arrival threshold check
  useEffect(() => {
    if (!isNavigating || !userLocation || !selectedSighting) return;

    const distance = getDistance(
      userLocation.lat,
      userLocation.lng,
      selectedSighting.lat,
      selectedSighting.lng
    );
    setRemainingDistance(distance);
    setRemainingDuration(Math.round(distance * 1.8));

    if (distance <= 0.05) { // 50 meters
      setHasArrived(true);
    }
  }, [userLocation, selectedSighting, isNavigating]);

  // Fetch bird sightings from eBird API
  const { data: sightings = [], isLoading } = useQuery({
    queryKey: ['bird-sightings', selectedRegion, userLocation],
    queryFn: async () => {
      if (selectedRegion === 'NEARBY' && userLocation) {
        return getNearbyObservations(userLocation.lat, userLocation.lng, 25, 7);
      } else if (selectedRegion !== 'NEARBY') {
        return getRecentObservations(selectedRegion, 7);
      }
      return [];
    },
    enabled: selectedRegion !== 'NEARBY' || !!userLocation,
    refetchInterval: isNavigating ? false : 5 * 60 * 1000,
  });

  // Fetch community geo-tagged posts (< 48 hrs old)
  const { data: communityPosts = [] } = useQuery({
    queryKey: ['community-map-posts'],
    queryFn: () => getRecentGeoTaggedPosts(48),
    refetchInterval: isNavigating ? false : 2 * 60 * 1000, // refresh every 2 min
  });

  // Fetch current weather updates via Open-Meteo
  const { data: weatherData } = useQuery({
    queryKey: ['weather', userLocation],
    queryFn: async () => {
      if (!userLocation) return null;
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${userLocation.lat}&longitude=${userLocation.lng}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m`
      );
      if (!res.ok) throw new Error("Weather fetch failed");
      const data = await res.json();
      return data.current;
    },
    enabled: !!userLocation,
    refetchInterval: 15 * 60 * 1000, // Refresh weather every 15 minutes
  });

  const weatherAnalysis = useMemo(() => {
    if (!weatherData) return null;

    const temp = weatherData.temperature_2m;
    const humidity = weatherData.relative_humidity_2m;
    const wind = weatherData.wind_speed_10m;
    const code = weatherData.weather_code;

    const hour = new Date().getHours();
    const isDeepNight = hour >= 22 || hour < 4;   // 10pm – 4am
    const isDawn = hour >= 4 && hour < 6;   // 4am – 6am  🌅 PEAK
    const isMorning = hour >= 6 && hour <= 10; // 6am – 10am ✅ Prime
    const isMidday = hour >= 11 && hour <= 15; // 11am – 3pm ⚡ Slower
    const isEarlyEvening = hour >= 16 && hour <= 18; // 4pm – 6pm  🌇 Roosting
    const isLateEvening = hour >= 19 && hour <= 21; // 7pm – 9pm  ❌ Not optimal

    let desc = "Clear Sky";
    let icon = "☀️";

    if (code === 0) { desc = "Clear Sky"; icon = isDeepNight || isDawn ? "🌙" : "☀️"; }
    else if (code >= 1 && code <= 3) { desc = "Partly Cloudy"; icon = isDeepNight || isDawn ? "🌙" : "⛅"; }
    else if (code === 45 || code === 48) { desc = "Foggy"; icon = "🌫️"; }
    else if (code >= 51 && code <= 55) { desc = "Drizzle"; icon = "🌧️"; }
    else if (code >= 61 && code <= 65) { desc = "Rainy"; icon = "🌧️"; }
    else if (code >= 71 && code <= 77) { desc = "Snowy"; icon = "❄️"; }
    else if (code >= 80 && code <= 82) { desc = "Showers"; icon = "🌦️"; }
    else if (code >= 95 && code <= 99) { desc = "Thunderstorm"; icon = "⛈️"; }

    // Night override for clear/cloudy icons
    if ((isDeepNight || isDawn) && (code === 0 || (code >= 1 && code <= 3))) {
      icon = "🌙";
    }

    let score = 100;
    let reasons: string[] = [];

    if (code >= 95) { score -= 60; reasons.push("Thunderstorm active"); }
    else if (code >= 80 && code <= 82) { score -= 40; reasons.push("Rain showers active"); }
    else if (code >= 61 && code <= 65) { score -= 45; reasons.push("Rain active"); }
    else if (code === 45 || code === 48) { score -= 20; reasons.push("Low visibility (fog)"); }

    if (temp > 33) { score -= 30; reasons.push("Extreme heat"); }
    else if (temp > 28) { score -= 10; reasons.push("Warm temperature"); }
    else if (temp < 10) { score -= 25; reasons.push("Cold temperature"); }

    if (wind > 25) { score -= 25; reasons.push("High winds"); }
    else if (wind > 15) { score -= 10; reasons.push("Breezy winds"); }

    if (isDeepNight) {
      score = 0;
      reasons.push("Deep night – birds are roosting");
    } else if (isDawn) {
      score = Math.min(score, 95);
    } else if (isLateEvening) {
      score = Math.min(score, 30);
      reasons.push("Past roosting window");
    } else if (isMidday) {
      score -= 15;
      reasons.push("Mid-day – lower bird activity");
    }

    score = Math.max(0, score);

    let rating = "Fair";
    let color = "text-yellow-600 bg-yellow-50 dark:bg-yellow-950/30";
    let barColor = "bg-yellow-500";
    if (isDeepNight || (isLateEvening && score < 30)) {
      rating = "Not Optimal";
      color = "text-destructive bg-destructive/10";
      barColor = "bg-destructive";
    } else if (score >= 80) {
      rating = "Optimum";
      color = "text-green-600 bg-green-50 dark:bg-green-950/30";
      barColor = "bg-green-500";
    } else if (score < 50) {
      rating = "Not Recommended";
      color = "text-destructive bg-destructive/10";
      barColor = "bg-destructive";
    }

    let tip = "Perfect weather to spot local birds. Grab your binoculars!";
    if (isDeepNight) {
      tip = "🌙 Birds are roosting and asleep. Night time is not optimal for birdwatching.";
    } else if (isDawn) {
      tip = "🌅 Dawn chorus is at its peak! This is the single best window — birds are most vocal and active right now.";
    } else if (isMorning) {
      tip = "☀️ Prime birdwatching time. Birds are actively foraging and singing. Head out now!";
    } else if (isMidday) {
      tip = "🌤️ Mid-day lull — bird activity slows as temperatures rise. Look near water bodies or shaded trees.";
    } else if (isEarlyEvening) {
      tip = "🌇 Evening roosting window — you can observe birds returning to their roosting sites. Great for watching flocking behaviour.";
    } else if (isLateEvening) {
      tip = "🌆 Getting late — most birds have settled in for the night. Not the best window anymore.";
    } else if (score < 50) {
      tip = "Birds seek shelter during harsh weather. Better to wait it out.";
    } else if (score < 80) {
      tip = "Activity might be slower. Look near water bodies or sheltered trees.";
    }

    // 24-hour birdwatching schedule
    const hourlySchedule = Array.from({ length: 24 }, (_, h) => {
      let label = "";
      let schedRating = "";
      let schedColor = "";
      let note = "";
      if (h >= 4 && h < 6) { label = "Peak dawn chorus"; schedRating = "🟢 Peak"; schedColor = "text-green-500"; note = "Low light — photography may be difficult"; }
      else if (h === 6) { label = "Prime foraging"; schedRating = "🟢 Prime"; schedColor = "text-green-500"; note = "Low light — photography may be difficult"; }
      else if (h >= 7 && h <= 10) { label = "Prime foraging"; schedRating = "🟢 Prime"; schedColor = "text-green-500"; }
      else if (h >= 11 && h <= 12) { label = "Moderate activity"; schedRating = "🟡 Moderate"; schedColor = "text-yellow-500"; }
      else if (h >= 13 && h <= 15) { label = "Mid-day slow"; schedRating = "🟡 Slow"; schedColor = "text-yellow-500"; }
      else if (h >= 16 && h <= 17) { label = "Roosting return"; schedRating = "🟢 Good"; schedColor = "text-green-500"; }
      else if (h === 18) { label = "Roosting return"; schedRating = "🟢 Good"; schedColor = "text-green-500"; note = "Poor light for photography"; }
      else if (h >= 19 && h <= 21) { label = "Winding down"; schedRating = "🔴 Low"; schedColor = "text-red-500"; }
      else { label = "Birds roosting"; schedRating = "🔴 None"; schedColor = "text-red-500"; note = "Poor light for photography"; }
      return { h, label, schedRating, schedColor, note };
    });

    return {
      temp,
      humidity,
      wind,
      desc,
      icon,
      score,
      rating,
      color,
      barColor,
      reasons,
      tip,
      hour,
      hourlySchedule,
    };
  }, [weatherData]);

  // Group sightings by species for the sidebar
  const groupedSightings = useMemo(() => {
    const filtered = searchQuery
      ? sightings.filter(s => matchSearch(searchQuery, s.comName, s.sciName))
      : sightings;

    const groups = new Map<string, RecentObservation[]>();
    filtered.forEach(sighting => {
      const existing = groups.get(sighting.comName) || [];
      existing.push(sighting);
      groups.set(sighting.comName, existing);
    });
    return Array.from(groups.entries()).map(([name, observations]) => ({
      species: name,
      count: observations.length,
      latestObservation: observations[0],
      observations,
    })).sort((a, b) => b.count - a.count);
  }, [sightings, searchQuery]);

  // Autolocate on mount
  useEffect(() => {
    const locate = async () => {
      try {
        const position = await Geolocation.getCurrentPosition();
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        if (map.current) {
          map.current.flyTo({
            center: [longitude, latitude],
            zoom: 11,
            duration: 2000,
          });
        }
      } catch (error) {
        console.error('Error getting location automatically:', error);
        if (selectedRegion === 'NEARBY') {
          setSelectedRegion('IN');
        }
      }
    };
    locate();
  }, []);

  // Initialize map centered on India
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const initialStyle = (theme === "dark" || document.documentElement.classList.contains("dark"))
      ? "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
      : "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

    currentStyleRef.current = initialStyle;
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: initialStyle,
      center: [78.9629, 20.5937], // Center of India
      zoom: 4.5,
    });

    map.current.addControl(new maplibregl.NavigationControl(), "top-right");

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Dynamic Map Theme Switching
  useEffect(() => {
    if (!map.current) return;
    const targetStyle = theme === "dark"
      ? "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
      : "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

    if (currentStyleRef.current === targetStyle) return;
    currentStyleRef.current = targetStyle;

    const handleStyleLoad = () => {
      const coords = activeRouteCoordsRef.current;
      if (coords && map.current) {
        if (!map.current.getSource('route')) {
          map.current.addSource('route', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: coords }
            }
          });
          map.current.addLayer({
            id: 'route',
            type: 'line',
            source: 'route',
            layout: {
              'line-join': 'round',
              'line-cap': 'round'
            },
            paint: {
              'line-color': '#3b82f6',
              'line-width': 5,
              'line-opacity': 0.8
            }
          });
        }
      }
    };

    map.current.once('style.load', handleStyleLoad);
    map.current.setStyle(targetStyle);
  }, [theme]);

  // Sync user location marker
  useEffect(() => {
    if (!map.current || !userLocation) return;

    if (!userMarkerRef.current) {
      const el = document.createElement('div');
      el.style.cssText = `
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background-color: #3b82f6;
        border: 3px solid white;
        box-shadow: 0 0 10px rgba(59, 130, 246, 0.8), 0 0 0 4px rgba(59, 130, 246, 0.2);
      `;
      userMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([userLocation.lng, userLocation.lat])
        .addTo(map.current);
    } else {
      userMarkerRef.current.setLngLat([userLocation.lng, userLocation.lat]);
    }
  }, [userLocation]);

  // Handle routing when a sighting is selected
  useEffect(() => {
    if (!map.current) return;

    const clearRoute = () => {
      activeRouteCoordsRef.current = null;
      lastRouteFetchCoords.current = null;
      lastSelectedSightingId.current = null;
      if (map.current?.getSource('route')) {
        (map.current.getSource('route') as maplibregl.GeoJSONSource).setData({
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: [] }
        });
      }
      if (routePopupRef.current) {
        routePopupRef.current.remove();
        routePopupRef.current = null;
      }
    };

    if (!selectedSighting || !userLocation) {
      clearRoute();
      return;
    }

    const sightingId = selectedSighting.id || `ebird-${selectedSighting.speciesCode}-${selectedSighting.locId}`;
    if (sightingId !== lastSelectedSightingId.current) {
      lastSelectedSightingId.current = sightingId;
      lastRouteFetchCoords.current = null;
    }

    if (lastRouteFetchCoords.current && userLocation) {
      const movedDistance = getDistance(
        userLocation.lat,
        userLocation.lng,
        lastRouteFetchCoords.current.lat,
        lastRouteFetchCoords.current.lng
      );
      if (movedDistance < 0.05 && navigationSteps.length > 0) {
        return;
      }
    }

    const fetchRoute = async () => {
      try {
        const { lng: startLng, lat: startLat } = userLocation;
        const { lng: endLng, lat: endLat } = selectedSighting;
        const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&steps=true`;

        const res = await fetch(url);
        const data = await res.json();

        if (data.routes && data.routes[0]) {
          lastRouteFetchCoords.current = { lat: startLat, lng: startLng };
          const route = data.routes[0];
          const coords = route.geometry.coordinates;
          activeRouteCoordsRef.current = coords;

          if (map.current!.getSource('route')) {
            (map.current!.getSource('route') as maplibregl.GeoJSONSource).setData({
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: coords }
            });
          } else {
            map.current!.addSource('route', {
              type: 'geojson',
              data: {
                type: 'Feature',
                properties: {},
                geometry: { type: 'LineString', coordinates: coords }
              }
            });
            map.current!.addLayer({
              id: 'route',
              type: 'line',
              source: 'route',
              layout: {
                'line-join': 'round',
                'line-cap': 'round'
              },
              paint: {
                'line-color': '#3b82f6',
                'line-width': 5,
                'line-opacity': 0.8
              }
            });
          }

          // Generate Route Info Label
          const distanceKm = Number((route.distance / 1000).toFixed(1));
          const durationMin = Math.round(route.duration / 60);
          setRemainingDistance(distanceKm);
          setRemainingDuration(durationMin);

          const steps = route.legs?.[0]?.steps?.map((s: any) => ({
            instruction: s.maneuver?.instruction || "Continue straight",
            distance: s.distance,
            duration: s.duration,
          })) || [];
          setNavigationSteps(steps);
          setCurrentStepIndex(0);

          const timeString = durationMin > 60
            ? `${Math.floor(durationMin / 60)} hr ${durationMin % 60} min`
            : `${durationMin} min`;

          const midPointIndex = Math.floor(coords.length / 2);
          const midPoint = coords[midPointIndex];

          if (routePopupRef.current) {
            routePopupRef.current.remove();
          }

          routePopupRef.current = new maplibregl.Popup({
            closeButton: false,
            closeOnClick: false,
            anchor: 'bottom',
            offset: [0, -5],
          })
            .setLngLat(midPoint)
            .setHTML(`
            <div style="padding: 2px 6px; font-family: system-ui, sans-serif; text-align: center; min-width: 80px;">
              <div style="font-weight: 700; font-size: 15px; color: #1f2937; display: flex; align-items: center; justify-content: center; gap: 6px;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #4b5563;"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
                ${timeString}
              </div>
              <div style="font-size: 13px; color: #6b7280; font-weight: 500; margin-top: 2px;">
                ${distanceKm} km
              </div>
            </div>
          `)
            .addTo(map.current!);
        }
      } catch (error) {
        console.error('Error fetching route:', error);
      }
    };

    fetchRoute();
  }, [selectedSighting, userLocation]);

  // Add markers for bird sightings - Grouped by location to prevent mobile clutter
  useEffect(() => {
    if (!map.current) return;

    // Remove old markers when region changes
    isClearingMarkersRef.current = true;
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current.clear();
    isClearingMarkersRef.current = false;

    if (!sightings.length) return;

    console.log(`Creating markers for ${sightings.length} sightings`);

    // Group sightings by location coordinates to avoid piling multiple markers on the exact same coordinate
    const groupedByLocation: Record<string, RecentObservation[]> = {};
    sightings.forEach(sighting => {
      const groupKey = sighting.locId || `${sighting.lat.toFixed(4)},${sighting.lng.toFixed(4)}`;
      if (!groupedByLocation[groupKey]) {
        groupedByLocation[groupKey] = [];
      }
      groupedByLocation[groupKey].push(sighting);
    });

    // Add grouped markers
    Object.entries(groupedByLocation).forEach(([locId, locSightings]) => {
      const firstSighting = locSightings[0];
      const count = locSightings.length;
      const key = `loc-${locId}`;

      const el = document.createElement("div");

      // Style marker. If multiple species are recorded here, show the count of species.
      el.style.cssText = `
        width: 32px; 
        height: 32px; 
        border-radius: 50%;
        background: #1F5D3B;
        border: 2px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.35);
        cursor: pointer;
        display: flex; 
        align-items: center; 
        justify-content: center;
        font-size: ${count > 1 ? '11px' : '14px'};
        font-weight: bold;
        color: white;
      `;
      if (count > 1) {
        el.textContent = `${count}`;
      } else {
        el.innerHTML = `
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            style="color: white;"
          >
            <path d="M16 7h.01" />
            <path d="M3.4 18H12a8 8 0 0 0 8-8V7a4 4 0 0 0-7.28-2.3L2 20" />
            <path d="m20 7 2 .5-2 .5" />
            <path d="M10 18v3" />
            <path d="M14 18v3" />
            <path d="M7 21h10" />
          </svg>
        `;
      }

      el.addEventListener('click', () => {
        setSelectedSighting(firstSighting);
        if (isMobile) {
          setIsSidebarMinimized(true); // collapse list when interacting with a marker
        }
      });

      // Build scrollable list of species observed at this specific coordinate
      const speciesListHtml = locSightings.map((s, idx) => {
        const isSelected = selectedSighting && selectedSighting.locId === s.locId && selectedSighting.speciesCode === s.speciesCode;
        return `
        <div class="bird-popup-row cursor-pointer" data-index="${idx}" style="display: flex; gap: 8px; align-items: center; margin-bottom: 8px; padding: 6px; border-bottom: 1px solid #f3f4f6; text-align: left; cursor: pointer; transition: all 0.2s; border-radius: 6px; ${isSelected ? 'background-color: rgba(31, 93, 59, 0.08); border-left: 3px solid #1F5D3B; padding-left: 4px;' : 'border-left: 3px solid transparent;'}">
          <img class="bird-popup-img-${s.speciesCode}" src="" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover; display: none; border: 1px solid #e5e7eb; box-shadow: 0 1px 2px rgba(0,0,0,0.05); flex-shrink: 0;" />
          <div class="bird-popup-placeholder-${s.speciesCode}" style="width: 36px; height: 36px; border-radius: 50%; background-color: rgba(31, 93, 59, 0.1); display: flex; align-items: center; justify-content: center; flex-shrink: 0; border: 1px solid #e5e7eb; box-shadow: 0 1px 2px rgba(0,0,0,0.05); color: #1F5D3B;">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M16 7h.01" />
              <path d="M3.4 18H12a8 8 0 0 0 8-8V7a4 4 0 0 0-7.28-2.3L2 20" />
              <path d="m20 7 2 .5-2 .5" />
              <path d="M10 18v3" />
              <path d="M14 18v3" />
              <path d="M7 21h10" />
            </svg>
          </div>
          <div style="min-width: 0; flex: 1;">
            <strong style="font-size: 13px; color: #111827; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 190px;">
              ${s.comName}
            </strong>
            <span style="font-size: 11px; font-style: italic; color: #6b7280; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 190px;">
              ${s.sciName}
            </span>
            <span style="font-size: 10px; color: #9ca3af; display: block; margin-top: 1px;">
              🕒 ${getTimeAgo(s.obsDt)}${s.howMany > 0 ? ` · ${s.howMany} spotted` : ''}
            </span>
          </div>
        </div>
      `}).join('');

      const popup = new maplibregl.Popup({
        offset: 25,
        closeButton: true,
        closeOnClick: false,
        maxWidth: '280px',
      }).setHTML(`
        <style>
          .bird-popup-row:hover {
            background-color: rgba(31, 93, 59, 0.04);
          }
        </style>
        <div style="padding: 10px; font-family: system-ui, -apple-system, sans-serif; max-height: 300px; overflow-y: auto;">
          <h3 style="margin: 0 0 8px 0; font-size: 10px; font-weight: 700; text-transform: uppercase; color: #6b7280; letter-spacing: 0.05em; text-align: left; border-bottom: 2px solid #1F5D3B; padding-bottom: 3px;">
            📍 ${firstSighting.locName.split(',')[0]}
          </h3>
          <div style="display: flex; flex-direction: column;">
            ${speciesListHtml}
          </div>
        </div>
      `);

      popup.on('open', () => {
        if (activePopupRef.current && activePopupRef.current !== popup) {
          activePopupRef.current.remove();
        }
        activePopupRef.current = popup;

        // Add click listener to bird cards inside the popup
        const popupNode = popup.getElement();
        if (popupNode) {
          const rows = popupNode.querySelectorAll('.bird-popup-row');
          rows.forEach((row) => {
            row.addEventListener('click', () => {
              const idxAttr = row.getAttribute('data-index');
              if (idxAttr !== null) {
                const idx = parseInt(idxAttr, 10);
                const sighting = locSightings[idx];
                if (sighting) {
                  setSelectedSighting(sighting);

                  // Update visual selection styles in popup dynamically
                  rows.forEach((r) => {
                    const el = r as HTMLElement;
                    el.style.backgroundColor = 'transparent';
                    el.style.borderLeft = '3px solid transparent';
                    el.style.paddingLeft = '6px';
                  });
                  const clickedEl = row as HTMLElement;
                  clickedEl.style.backgroundColor = 'rgba(31, 93, 59, 0.08)';
                  clickedEl.style.borderLeft = '3px solid #1F5D3B';
                  clickedEl.style.paddingLeft = '4px';
                }
              }
            });
          });
        }

        locSightings.forEach(async (s) => {
          if (!s.sciName) return;
          const cacheKey = s.sciName.toLowerCase().trim();

          const setImg = (url: string) => {
            const imgEls = document.querySelectorAll(`.bird-popup-img-${s.speciesCode}`);
            const placeholderEls = document.querySelectorAll(`.bird-popup-placeholder-${s.speciesCode}`);
            imgEls.forEach((el) => {
              (el as HTMLImageElement).src = url;
              (el as HTMLElement).style.display = 'block';
            });
            placeholderEls.forEach((el) => {
              (el as HTMLElement).style.display = 'none';
            });
          };

          if (BIRD_IMAGE_CACHE[cacheKey]) {
            setImg(BIRD_IMAGE_CACHE[cacheKey]);
            return;
          }

          try {
            const formattedName = s.sciName
              .split(" ")
              .map((w, idx) => idx === 0 ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase())
              .join("_");

            const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(formattedName)}`);
            if (response.ok) {
              const data = await response.json();
              if (data.thumbnail && data.thumbnail.source) {
                const url = data.thumbnail.source;
                BIRD_IMAGE_CACHE[cacheKey] = url;
                setImg(url);
              }
            }
          } catch (error) {
            console.error("Error fetching bird image for popup:", error);
          }
        });
      });

      popup.on('close', () => {
        if (activePopupRef.current === popup) {
          activePopupRef.current = null;
        }
        if (isClearingMarkersRef.current || isNavigating) {
          return;
        }
        setSelectedSighting(current => {
          if (!current) return null;
          if (current.isCommunity) return current;
          const isSameLoc = locSightings.some(ls => ls.locId === current.locId);
          return isSameLoc ? null : current;
        });
      });

      const marker = new maplibregl.Marker({
        element: el,
        anchor: 'center',
      })
        .setLngLat([firstSighting.lng, firstSighting.lat])
        .setPopup(popup)
        .addTo(map.current!);

      markersRef.current.set(key, marker);
    });

    console.log(`Added ${markersRef.current.size} markers to map`);
  }, [sightings, isMobile]);

  // Add community post markers (orange, distinct from eBird green)
  useEffect(() => {
    if (!map.current) return;

    // Remove old community markers
    isClearingCommunityMarkersRef.current = true;
    communityMarkersRef.current.forEach(marker => marker.remove());
    communityMarkersRef.current.clear();
    isClearingCommunityMarkersRef.current = false;

    if (!communityPosts.length) return;

    communityPosts.forEach((post) => {
      if (post.latitude == null || post.longitude == null) return;

      const key = `community-${post.id}`;

      const el = document.createElement("div");
      el.style.cssText = `
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: #e67e22;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(230,126,34,0.5);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
      `;
      el.innerHTML = `
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          style="color: white;"
        >
          <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
          <circle cx="12" cy="13" r="3" />
        </svg>
      `;

      el.addEventListener('click', () => {
        setSelectedSighting({
          id: `community-${post.id}`,
          lat: post.latitude,
          lng: post.longitude,
          comName: post.species_name,
          sciName: '',
          locName: post.location_name || "Community Sighting",
          speciesCode: `community-${post.id}`,
          isCommunity: true,
          imageUrl: post.image_url,
          authorName: post.author?.username
        } as any);
        if (isMobile) {
          setIsSidebarMinimized(true);
        }
      });

      const timeAgo = getTimeAgo(post.created_at);
      const username = post.author?.username || 'Unknown';

      let parsedNote = post.note || '';
      if (post.note && post.note.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(post.note);
          if (parsed && typeof parsed === 'object') {
            parsedNote = parsed.body || '';
          }
        } catch (e) {
          console.error("Error parsing post note", e);
        }
      }

      const popup = new maplibregl.Popup({
        offset: 25,
        closeButton: true,
        closeOnClick: false,
        maxWidth: '300px',
      }).setHTML(`
        <div style="font-family: system-ui, sans-serif;">
          ${post.image_url ? (
          post.image_url.toLowerCase().includes('.mp4') || post.image_url.toLowerCase().includes('.mov') || post.image_url.toLowerCase().includes('.webm')
            ? `<video src="${post.image_url}" style="width: 100%; height: 140px; object-fit: cover; border-radius: 8px 8px 0 0;" autoplay muted loop playsinline></video>`
            : `<img src="${post.image_url}" alt="${post.species_name}" style="width: 100%; height: 140px; object-fit: cover; border-radius: 8px 8px 0 0;" />`
        ) : ''}
          <div style="padding: 12px;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
              <span style="background: #e67e22; color: white; font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 99px;">Community</span>
              <span style="font-size: 11px; color: #888;">by @${username}</span>
            </div>
            <h3 style="margin: 0 0 4px 0; font-size: 16px; font-weight: 600;">
              ${post.species_name}
            </h3>
            ${post.location_name ? `<p style="margin: 0 0 4px 0; font-size: 12px;">📍 ${post.location_name}</p>` : ''}
            <p style="margin: 0; font-size: 11px; color: #666;">🕒 ${timeAgo}</p>
            ${parsedNote ? `<p style="margin: 6px 0 0 0; font-size: 12px; color: #444;">${parsedNote}</p>` : ''}
          </div>
        </div>
      `);

      popup.on('open', () => {
        if (activePopupRef.current && activePopupRef.current !== popup) {
          activePopupRef.current.remove();
        }
        activePopupRef.current = popup;
      });

      popup.on('close', () => {
        if (activePopupRef.current === popup) {
          activePopupRef.current = null;
        }
        if (isClearingCommunityMarkersRef.current || isNavigating) {
          return;
        }
        setSelectedSighting(current => {
          if (!current) return null;
          if (!current.isCommunity) return current;
          return current.id === `community-${post.id}` ? null : current;
        });
      });

      const marker = new maplibregl.Marker({
        element: el,
        anchor: 'center',
      })
        .setLngLat([post.longitude, post.latitude])
        .setPopup(popup)
        .addTo(map.current!);

      communityMarkersRef.current.set(key, marker);
    });
  }, [communityPosts]);

  // Filter markers visibility based on search queries
  useEffect(() => {
    if (!searchQuery) {
      markersRef.current.forEach(marker => {
        const el = marker.getElement();
        el.style.display = 'flex';
      });
      communityMarkersRef.current.forEach(marker => {
        const el = marker.getElement();
        el.style.display = 'flex';
      });
      return;
    }

    const searchLower = searchQuery.toLowerCase();

    // Group the same way to match our compound coordinates keys
    const groupedByLocation: Record<string, RecentObservation[]> = {};
    sightings.forEach(sighting => {
      const groupKey = sighting.locId || `${sighting.lat.toFixed(4)},${sighting.lng.toFixed(4)}`;
      if (!groupedByLocation[groupKey]) {
        groupedByLocation[groupKey] = [];
      }
      groupedByLocation[groupKey].push(sighting);
    });

    Object.entries(groupedByLocation).forEach(([locId, locSightings]) => {
      const key = `loc-${locId}`;
      const marker = markersRef.current.get(key);

      if (marker) {
        const matches = locSightings.some(s => matchSearch(searchQuery, s.comName, s.sciName));
        const el = marker.getElement();
        el.style.display = matches ? 'flex' : 'none';
      }
    });

    communityPosts.forEach((post) => {
      const key = `community-${post.id}`;
      const marker = communityMarkersRef.current.get(key);
      if (marker) {
        const matches = matchSearch(searchQuery, post.species_name);
        const el = marker.getElement();
        el.style.display = matches ? 'flex' : 'none';
      }
    });
  }, [searchQuery, sightings, communityPosts]);

  // Center map on user location
  const handleLocate = async () => {
    try {
      const position = await Geolocation.getCurrentPosition();
      const { latitude, longitude } = position.coords;
      setUserLocation({ lat: latitude, lng: longitude });
      setSelectedRegion('NEARBY');
      map.current?.flyTo({
        center: [longitude, latitude],
        zoom: 12,
        duration: 2000,
      });
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  return (
    <div className="relative h-screen flex">
      {/* Sidebar */}
      <AnimatePresence>
        {showSidebar && (
          <motion.div
            initial={isMobile ? { y: "100%", x: 0 } : { x: -320, y: 0 }}
            animate={{ x: 0, y: 0 }}
            exit={isMobile ? { y: "100%", x: 0 } : { x: -320, y: 0 }}
            transition={{ type: "spring", damping: 25 }}
            className={`absolute bottom-[var(--nav-height)] left-0 right-0 md:right-auto md:top-0 md:bottom-0 w-full md:w-80 bg-card/95 backdrop-blur-lg border-t md:border-t-0 md:border-r border-border z-30 flex flex-col rounded-t-3xl md:rounded-none shadow-[0_-8px_30px_rgba(0,0,0,0.12)] md:shadow-none transition-all duration-300 ${isMobile && isSidebarMinimized ? "h-[70px] overflow-hidden" : "h-[45vh]"
              }`}
          >
            {/* Pull / drag handle bar for mobile */}
            {isMobile && (
              <div
                onClick={() => setIsSidebarMinimized(!isSidebarMinimized)}
                className="w-12 h-1 bg-muted-foreground/30 hover:bg-muted-foreground/50 rounded-full mx-auto mt-2.5 cursor-pointer shrink-0"
              />
            )}

            {/* Sidebar Header */}
            <div
              className="p-4 pt-2 md:pt-4 border-b border-border flex flex-col cursor-pointer md:cursor-default shrink-0"
              onClick={() => {
                if (isMobile) {
                  setIsSidebarMinimized(!isSidebarMinimized);
                }
              }}
            >
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold flex items-center gap-1">
                  Recent Sightings
                  {isMobile && (
                    <span className="text-[10px] font-normal text-muted-foreground ml-1">
                      {isSidebarMinimized ? "(Tap to expand)" : "(Tap to collapse)"}
                    </span>
                  )}
                </h2>
                <div className="flex items-center gap-1">
                  {/* Min/Max Chevron for Mobile */}
                  {isMobile && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsSidebarMinimized(!isSidebarMinimized);
                      }}
                      className="p-1.5 hover:bg-muted rounded-lg transition-colors mr-0.5"
                    >
                      <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-300 ${isSidebarMinimized ? 'rotate-180' : ''}`} />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSidebar(false);
                    }}
                    className="p-1.5 hover:bg-muted rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Region Filter - Custom Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm flex items-center justify-between hover:border-primary/50 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <div className="flex items-center gap-2">
                  {selectedRegion === 'NEARBY' ? (
                    <MapPin className="w-4 h-4 transition-colors" style={{ color: '#1F5D3B' }} />
                  ) : null}
                  <span className="font-medium text-[rgba(45,58,51,0.9)] dark:text-slate-200">
                    {INDIAN_REGIONS.find((r) => r.code === selectedRegion)?.name || 'Select Region'}
                  </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {isDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="absolute top-[calc(100%+8px)] left-0 right-0 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden flex flex-col max-h-[320px]"
                  >
                    <div className="p-2 border-b border-border/50 sticky top-0 bg-card/95 backdrop-blur z-10">
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/70" />
                        <input
                          type="text"
                          placeholder="Search state..."
                          value={regionSearch}
                          onChange={(e) => setRegionSearch(e.target.value)}
                          className="w-full bg-muted/30 border border-transparent focus:border-primary/30 focus:bg-background rounded-lg pl-9 pr-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground/70"
                        />
                      </div>
                    </div>

                    <div className="overflow-y-auto p-1 custom-scrollbar">
                      {/* Near Me Option */}
                      {('near me'.includes(regionSearch.toLowerCase()) || regionSearch === "") && (
                        <>
                          <button
                            onClick={() => {
                              setSelectedRegion('NEARBY');
                              setIsDropdownOpen(false);
                              setRegionSearch("");
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${selectedRegion === 'NEARBY' ? 'bg-[#1F5D3B]/10 text-[#1F5D3B] font-medium' : 'hover:bg-muted text-[rgba(45,58,51,0.8)] dark:text-slate-300'}`}
                          >
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4" style={{ color: selectedRegion !== 'NEARBY' ? 'currentColor' : '#1F5D3B' }} />
                              <span>Near Me</span>
                            </div>
                            {selectedRegion === 'NEARBY' && <Check className="w-4 h-4" />}
                          </button>
                          <div className="h-px bg-border/50 mx-2 my-1" />
                        </>
                      )}

                      {/* Other Regions */}
                      {INDIAN_REGIONS.filter(r => r.code !== 'NEARBY' && r.name.toLowerCase().includes(regionSearch.toLowerCase())).map((region) => (
                        <button
                          key={region.code}
                          onClick={() => {
                            setSelectedRegion(region.code);
                            setIsDropdownOpen(false);
                            setRegionSearch("");
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${selectedRegion === region.code ? 'bg-[#1F5D3B]/10 text-[#1F5D3B] font-medium' : 'hover:bg-muted text-[rgba(45,58,51,0.8)] dark:text-slate-300'}`}
                        >
                          <span>{region.name}</span>
                          {selectedRegion === region.code && <Check className="w-4 h-4 text-[#1F5D3B]" />}
                        </button>
                      ))}

                      {INDIAN_REGIONS.filter(r => r.code !== 'NEARBY' && r.name.toLowerCase().includes(regionSearch.toLowerCase())).length === 0 && !('near me'.includes(regionSearch.toLowerCase())) && (
                        <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                          No regions found
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Sightings List */}
            <div className="flex-1 overflow-y-auto">
              {/* Community Sightings Section */}
              {communityPosts.filter(post => matchSearch(searchQuery, post.species_name)).length > 0 && (
                <div className="p-2 pb-0">
                  <div className="flex items-center gap-2 px-1 py-2">
                    <div className="w-5 h-5 rounded-full bg-[#e67e22] flex items-center justify-center text-[10px]">📸</div>
                    <span className="text-xs font-semibold text-[#e67e22] uppercase tracking-wide">Community Sightings</span>
                    <span className="ml-auto text-[10px] text-muted-foreground">Last 6 hrs</span>
                  </div>
                  {communityPosts.filter(post => matchSearch(searchQuery, post.species_name)).map((post) => (
                    <button
                      key={post.id}
                      onClick={() => {
                        if (post.latitude != null && post.longitude != null) {
                          map.current?.flyTo({
                            center: [post.longitude, post.latitude],
                            zoom: 14,
                            duration: 1500,
                          });
                          const key = `community-${post.id}`;
                          const marker = communityMarkersRef.current.get(key);
                          if (marker && map.current) {
                            marker.getPopup().addTo(map.current);
                          }
                          setSelectedSighting({
                            id: `community-${post.id}`,
                            lat: post.latitude,
                            lng: post.longitude,
                            comName: post.species_name,
                            sciName: '',
                            locName: post.location_name || "Community Sighting",
                            speciesCode: `community-${post.id}`,
                            isCommunity: true,
                            imageUrl: post.image_url,
                            authorName: post.author?.username
                          } as any);
                        }
                      }}
                      className="w-full p-3 mb-2 bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/30 dark:hover:bg-orange-950/50 rounded-xl text-left transition-colors border border-orange-200 dark:border-orange-900/50"
                    >
                      <div className="flex items-start gap-3">
                        {post.image_url && (
                          post.image_url.toLowerCase().includes('.mp4') || post.image_url.toLowerCase().includes('.mov') || post.image_url.toLowerCase().includes('.webm') ? (
                            <video
                              src={post.image_url}
                              className="w-10 h-10 rounded-lg object-cover shrink-0"
                              preload="metadata"
                              muted
                            />
                          ) : (
                            <img
                              src={post.image_url}
                              alt={post.species_name}
                              className="w-10 h-10 rounded-lg object-cover shrink-0"
                            />
                          )
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm truncate">{post.species_name}</h3>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            by @{post.author?.username || 'unknown'}
                          </p>
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                            {post.location_name && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {post.location_name.split(',')[0]}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {getTimeAgo(post.created_at)}
                            </span>
                            {userLocation && post.latitude != null && post.longitude != null && (
                              <span className="flex items-center gap-1">
                                • {getDistance(userLocation.lat, userLocation.lng, post.latitude, post.longitude).toFixed(1)} km
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* eBird Sightings Section */}
              {communityPosts.filter(post => matchSearch(searchQuery, post.species_name)).length > 0 && groupedSightings.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-2">
                  <div className="w-5 h-5 rounded-full bg-[#3a7d52] flex items-center justify-center text-[10px]">🐦</div>
                  <span className="text-xs font-semibold text-[#3a7d52] uppercase tracking-wide">eBird Sightings</span>
                </div>
              )}

              {isLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : groupedSightings.length === 0 && communityPosts.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  No sightings found in this region
                </div>
              ) : (
                <div className="p-2">
                  {groupedSightings.map(({ species, count, latestObservation }) => (
                    <button
                      key={species}
                      onClick={() => {
                        setSelectedSighting(latestObservation);
                        map.current?.flyTo({
                          center: [latestObservation.lng, latestObservation.lat],
                          zoom: 12,
                          duration: 1500,
                        });
                        const locKey = latestObservation.locId || `${latestObservation.lat.toFixed(4)},${latestObservation.lng.toFixed(4)}`;
                        const key = `loc-${locKey}`;
                        const marker = markersRef.current.get(key);
                        if (marker && map.current) {
                          marker.getPopup().addTo(map.current);
                        }
                      }}
                      className="w-full p-3 mb-2 bg-background hover:bg-muted rounded-xl text-left transition-colors border border-border"
                    >
                      <div className="flex items-start gap-3">
                        <BirdImage
                          scientificName={latestObservation.sciName}
                          commonName={species}
                          className="h-10 w-10 rounded-lg"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-medium text-sm truncate">{species}</h3>
                            <span className="px-2 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-medium shrink-0">
                              {count}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground italic truncate mt-0.5">
                            {latestObservation.sciName}
                          </p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {latestObservation.locName.split(',')[0]}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {getTimeAgo(latestObservation.obsDt)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Sidebar Footer */}
            <div className="p-3 border-t border-border">
              <div className="text-xs text-muted-foreground text-center">
                {sightings.length} eBird + {communityPosts.length} community observations
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle Sidebar Button */}
      {!showSidebar && (
        <button
          onClick={() => setShowSidebar(true)}
          className="absolute left-4 top-20 z-20 w-12 h-12 rounded-full bg-card/90 backdrop-blur-lg shadow-lg border border-border flex items-center justify-center hover:scale-110 transition-transform"
        >
          <SlidersHorizontal className="w-5 h-5" />
        </button>
      )}

      {/* Map Container */}
      <div className="flex-1 relative">
        <div ref={mapContainer} className="absolute inset-0" />

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-20 bg-background/50 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-card p-6 rounded-2xl shadow-xl flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading bird sightings...</p>
            </div>
          </div>
        )}

        {/* Top Search Bar */}
        {!isNavigating && (
          <div className="absolute top-0 left-0 right-0 z-10 p-4 pt-12">
            <div className="max-w-md mx-auto">
              <div className="flex items-center gap-2 bg-card/90 backdrop-blur-lg rounded-full px-4 py-3 shadow-lg border border-border">
                <Search className="w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search species..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent text-sm flex-1 outline-none placeholder:text-muted-foreground"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="p-1 hover:bg-muted rounded-full transition-colors"
                  >
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Locate button */}
        <button
          onClick={handleLocate}
          className="absolute bottom-[calc(var(--nav-height)+16px)] right-4 z-10 w-12 h-12 rounded-full bg-primary shadow-lg flex items-center justify-center hover:scale-110 transition-transform"
        >
          <Locate className="w-5 h-5 text-primary-foreground" />
        </button>

        {/* Floating Weather Suitability Widget */}
        {weatherAnalysis && !isNavigating && (
          <div className="absolute top-24 right-4 z-10 flex flex-col items-end gap-2">
            {/* Weather Toggle Button */}
            <button
              onClick={() => setShowWeatherDetails(!showWeatherDetails)}
              className="flex items-center gap-2 px-3 py-2 bg-card/90 backdrop-blur-lg rounded-full shadow-lg border border-border hover:bg-muted transition-colors text-sm font-semibold"
            >
              <span className="text-lg">{weatherAnalysis.icon}</span>
              <span>{weatherAnalysis.temp}°C</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${weatherAnalysis.color}`}>
                {weatherAnalysis.rating}
              </span>
            </button>

            {/* Expanded Weather details */}
            <AnimatePresence>
              {showWeatherDetails && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="w-72 bg-card/95 backdrop-blur-md rounded-2xl shadow-xl border border-border p-4 text-left space-y-3 max-h-[80vh] overflow-y-auto"
                >
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <span className="font-bold text-sm">Birdwatching Conditions</span>
                    <button
                      onClick={() => setShowWeatherDetails(false)}
                      className="p-1 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Current time + status */}
                  <div className="bg-primary/8 border border-primary/15 rounded-xl px-3 py-2.5 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Right now</p>
                      <p className="text-sm font-bold">
                        {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${weatherAnalysis.color}`}>
                      {weatherAnalysis.rating}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="bg-muted/40 p-2 rounded-xl">
                      <span className="text-muted-foreground block text-[10px]">Conditions</span>
                      <span className="font-semibold flex items-center gap-1 mt-0.5">
                        <span>{weatherAnalysis.icon}</span>
                        {weatherAnalysis.desc}
                      </span>
                    </div>
                    <div className="bg-muted/40 p-2 rounded-xl">
                      <span className="text-muted-foreground block text-[10px]">Temperature</span>
                      <span className="font-semibold block mt-0.5">{weatherAnalysis.temp}°C</span>
                    </div>
                    <div className="bg-muted/40 p-2 rounded-xl">
                      <span className="text-muted-foreground block text-[10px]">Wind Speed</span>
                      <span className="font-semibold block mt-0.5">{weatherAnalysis.wind} km/h</span>
                    </div>
                    <div className="bg-muted/40 p-2 rounded-xl">
                      <span className="text-muted-foreground block text-[10px]">Humidity</span>
                      <span className="font-semibold block mt-0.5">{weatherAnalysis.humidity}%</span>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">Birdwatching rating</span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${weatherAnalysis.color}`}>
                        {weatherAnalysis.rating}
                      </span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full ${weatherAnalysis.barColor} transition-all duration-500`}
                        style={{ width: `${weatherAnalysis.score}%` }}
                      />
                    </div>
                  </div>

                  <div className="bg-primary/5 border border-primary/10 rounded-xl p-3 text-xs leading-relaxed text-foreground">
                    <p className="font-bold text-primary flex items-center gap-1 mb-1">
                      <span>💡 Recommendation</span>
                    </p>
                    <p>{weatherAnalysis.tip}</p>
                    {weatherAnalysis.reasons.length > 0 && (
                      <ul className="mt-1.5 space-y-0.5 text-muted-foreground pl-3.5 list-disc text-[10px]">
                        {weatherAnalysis.reasons.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* 24-hour timetable */}
                  <div className="border-t border-border pt-3">
                    <p className="text-[11px] font-bold mb-2 text-foreground">24-Hour Schedule</p>
                    <div className="space-y-0.5 max-h-52 overflow-y-auto pr-1">
                      {weatherAnalysis.hourlySchedule.map(({ h, label, schedRating, schedColor, note }) => {
                        const isCurrent = h === weatherAnalysis.hour;
                        const fmt = (hr: number) =>
                          `${String(hr).padStart(2, "0")}:00 – ${String(hr + 1).padStart(2, "0")}:00`;
                        return (
                          <div
                            key={h}
                            className={`flex items-center justify-between rounded-lg px-2 py-1.5 text-[10px] ${isCurrent
                              ? "bg-primary/15 border border-primary/30 font-bold"
                              : "hover:bg-muted/40"
                              }`}
                          >
                            <span className={`font-mono ${isCurrent ? "text-primary" : "text-muted-foreground"}`}>
                              {fmt(h)}{isCurrent ? " ← now" : ""}
                            </span>
                            <div className="flex flex-col items-end gap-0">
                              <span className={`${schedColor} font-semibold`}>{schedRating}</span>
                              <span className="text-muted-foreground text-[9px]">{label}</span>
                              {note && <span className="text-orange-400 text-[9px] italic">{note}</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Selected Sighting Detail & Navigation Card */}
        {selectedSighting && !isNavigating && (
          <div className="absolute bottom-[calc(var(--nav-height)+16px)] left-4 right-4 md:left-auto md:w-96 z-20 bg-card/95 backdrop-blur-lg rounded-3xl shadow-2xl border border-border p-4 animate-in slide-in-from-bottom duration-200">
            <div className="flex justify-between items-start gap-3">
              {selectedSighting.isCommunity && selectedSighting.imageUrl ? (
                selectedSighting.imageUrl.toLowerCase().includes('.mp4') || selectedSighting.imageUrl.toLowerCase().includes('.mov') || selectedSighting.imageUrl.toLowerCase().includes('.webm') ? (
                  <video
                    src={selectedSighting.imageUrl}
                    className="h-16 w-16 rounded-xl object-cover shrink-0"
                    preload="metadata"
                    muted
                  />
                ) : (
                  <img
                    src={selectedSighting.imageUrl}
                    alt={selectedSighting.comName}
                    className="h-16 w-16 rounded-xl object-cover shrink-0"
                  />
                )
              ) : (
                <BirdImage
                  scientificName={selectedSighting.sciName}
                  commonName={selectedSighting.comName}
                  className="h-16 w-16 rounded-xl"
                />
              )}
              <div className="flex-1 min-w-0">
                <span className="inline-block bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider mb-2">
                  Selected Destination
                </span>
                <h3 className="font-semibold text-base text-foreground truncate">{selectedSighting.comName}</h3>
                {selectedSighting.isCommunity && selectedSighting.authorName ? (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    by @{selectedSighting.authorName}
                  </p>
                ) : selectedSighting.sciName ? (
                  <p className="text-xs text-muted-foreground italic truncate mt-0.5 flex items-center gap-1.5">
                    {selectedSighting.sciName}
                    <a
                      href={`https://en.wikipedia.org/wiki/${encodeURIComponent(
                        selectedSighting.sciName
                          .split(" ")
                          .map((w, idx) => idx === 0 ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase())
                          .join("_")
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 text-primary hover:underline font-semibold ml-1 shrink-0"
                    >
                      (Know More <ExternalLink className="w-3 h-3" />)
                    </a>
                  </p>
                ) : null}

                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                  <MapPin className="w-3.5 h-3.5" />
                  <span className="truncate">{selectedSighting.locName}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedSighting(null)}
                className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0 ml-2"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                {routePopupRef.current ? "Route calculated" : "Calculating route..."}
              </div>
              <Button
                onClick={() => {
                  setIsNavigating(true);
                  setHasArrived(false);
                  // Center and pitch map
                  if (map.current && userLocation) {
                    map.current.easeTo({
                      center: [userLocation.lng, userLocation.lat],
                      zoom: 17,
                      pitch: 50,
                      bearing: 0,
                      duration: 1500
                    });
                  }
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-5 flex items-center gap-1.5 shadow-md hover:scale-105 transition-transform"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" className="rotate-45"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                Start Navigation
              </Button>
            </div>
          </div>
        )}

        {/* Active Navigation Guidance UI */}
        {isNavigating && selectedSighting && (
          <>
            {/* Top Green Banner */}
            <div className="absolute top-12 left-4 right-4 max-w-md mx-auto z-30 animate-in slide-in-from-top duration-300">
              <div className="bg-green-600 dark:bg-green-700 text-white rounded-2xl p-4 shadow-xl border border-green-500/20 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center text-xl shrink-0 font-bold">
                  {navigationSteps[currentStepIndex]?.instruction.toLowerCase().includes("left") ? "⬅️" :
                    navigationSteps[currentStepIndex]?.instruction.toLowerCase().includes("right") ? "➡️" : "⬆️"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-base leading-tight">
                    {navigationSteps[currentStepIndex]?.instruction || "Continue to target destination"}
                  </p>
                  {navigationSteps[currentStepIndex] && (
                    <p className="text-xs text-white/80 mt-0.5">
                      In {Math.round(navigationSteps[currentStepIndex].distance)} meters
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Panel */}
            <div className="absolute bottom-[calc(var(--nav-height)+16px)] left-4 right-4 max-w-md mx-auto z-30 animate-in slide-in-from-bottom duration-300">
              <div className="bg-card/95 backdrop-blur-lg border border-border rounded-3xl p-4 shadow-2xl space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-bold text-blue-600">
                        {remainingDuration !== null
                          ? (remainingDuration > 60 ? `${Math.floor(remainingDuration / 60)} hr ${remainingDuration % 60} min` : `${remainingDuration} min`)
                          : routePopupRef.current ? "Calculating..." : "Calculated"}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        ({remainingDistance !== null ? remainingDistance.toFixed(1) : "..."} km)
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Target: {selectedSighting.comName}
                    </p>
                  </div>

                  <div className="flex gap-2 items-center">
                    <Button
                      onClick={() => setIsVoiceMuted(prev => !prev)}
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground shrink-0"
                      title={isVoiceMuted ? "Unmute Voice Guidance" : "Mute Voice Guidance"}
                    >
                      {isVoiceMuted ? (
                        <VolumeX className="h-4 w-4 text-destructive" />
                      ) : (
                        <Volume2 className="h-4 w-4 text-green-600" />
                      )}
                    </Button>
                    <Button
                      onClick={() => {
                        if (currentStepIndex < navigationSteps.length - 1) {
                          setCurrentStepIndex(prev => prev + 1);
                        } else {
                          setHasArrived(true);
                        }
                      }}
                      variant="outline"
                      size="sm"
                      className="rounded-full text-xs"
                    >
                      Next Step
                    </Button>
                    <Button
                      onClick={() => setHasArrived(true)}
                      className="bg-green-600 hover:bg-green-700 text-white rounded-full text-xs shadow-md"
                    >
                      Arrived
                    </Button>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={() => {
                      setIsNavigating(false);
                      setHasArrived(false);
                      setCurrentStepIndex(0);
                      // Reset map pitch
                      if (map.current) {
                        map.current.easeTo({
                          pitch: 0,
                          zoom: 12,
                          duration: 1000
                        });
                      }
                    }}
                    variant="destructive"
                    className="w-full rounded-full font-bold shadow-md"
                  >
                    End Navigation
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Arrival Celebratory Dialog */}
        <Dialog open={hasArrived} onOpenChange={(open) => !open && setHasArrived(false)}>
          <DialogContent className="max-w-md bg-background border-border text-center p-6 space-y-4">
            <div className="mx-auto h-16 w-16 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center text-4xl animate-bounce">
              🎉
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-foreground">You have arrived!</h2>
              <p className="text-sm text-muted-foreground">
                You are at <span className="font-semibold text-foreground">{selectedSighting?.locName}</span>.
              </p>
              <p className="text-xs text-primary bg-primary/10 border border-primary/20 rounded-xl p-3 mt-2 leading-relaxed">
                🐦 Keep your binoculars ready! Look out for the <span className="font-bold">{selectedSighting?.comName}</span>{selectedSighting?.sciName ? ` (${selectedSighting.sciName})` : ''} nearby.
              </p>
            </div>
            <Button
              onClick={() => {
                setIsNavigating(false);
                setHasArrived(false);
                setSelectedSighting(null);
                setCurrentStepIndex(0);
                // Reset map pitch
                if (map.current) {
                  map.current.easeTo({
                    pitch: 0,
                    zoom: 12,
                    duration: 1000
                  });
                }
              }}
              className="w-full bg-green-600 hover:bg-green-700 text-white rounded-full font-bold shadow-md"
            >
              Finish Navigation
            </Button>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default MapPage;
