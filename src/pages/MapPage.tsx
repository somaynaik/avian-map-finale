import { useEffect, useRef, useState, useMemo } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./MapPage.css";
import { Search, SlidersHorizontal, Locate, Loader2, X, MapPin, Clock, ChevronDown, Check, Users } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Geolocation } from "@capacitor/geolocation";
import { getRecentObservations, getNearbyObservations, type RecentObservation } from "@/lib/ebird";
import { getRecentGeoTaggedPosts, type GeoTaggedPost } from "@/lib/social";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

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
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c;
}

const MapPage = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const communityMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const routePopupRef = useRef<maplibregl.Popup | null>(null);
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
  const [selectedSighting, setSelectedSighting] = useState<RecentObservation | null>(null);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [showWeatherDetails, setShowWeatherDetails] = useState(false);

  // Active Navigation Guidance States
  const [isNavigating, setIsNavigating] = useState(false);
  const [hasArrived, setHasArrived] = useState(false);
  const [navigationSteps, setNavigationSteps] = useState<{instruction: string; distance: number; duration: number}[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [remainingDistance, setRemainingDistance] = useState<number | null>(null);
  const [remainingDuration, setRemainingDuration] = useState<number | null>(null);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    handleResize(); // set initially
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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
    refetchInterval: 5 * 60 * 1000,
  });

  // Fetch community geo-tagged posts (< 48 hrs old)
  const { data: communityPosts = [] } = useQuery({
    queryKey: ['community-map-posts'],
    queryFn: () => getRecentGeoTaggedPosts(48),
    refetchInterval: 2 * 60 * 1000, // refresh every 2 min
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

    let desc = "Clear Sky";
    let icon = "☀️";
    
    if (code === 0) { desc = "Clear Sky"; icon = "☀️"; }
    else if (code >= 1 && code <= 3) { desc = "Partly Cloudy"; icon = "⛅"; }
    else if (code === 45 || code === 48) { desc = "Foggy"; icon = "🌫️"; }
    else if (code >= 51 && code <= 55) { desc = "Drizzle"; icon = "🌧️"; }
    else if (code >= 61 && code <= 65) { desc = "Rainy"; icon = "🌧️"; }
    else if (code >= 71 && code <= 77) { desc = "Snowy"; icon = "❄️"; }
    else if (code >= 80 && code <= 82) { desc = "Showers"; icon = "🌦️"; }
    else if (code >= 95 && code <= 99) { desc = "Thunderstorm"; icon = "⛈️"; }

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

    const hour = new Date().getHours();
    const isMorning = hour >= 6 && hour <= 10;
    const isEvening = hour >= 16 && hour <= 19;
    if (!isMorning && !isEvening) {
      score -= 15;
      reasons.push("Mid-day low activity");
    }

    score = Math.max(0, score);

    let rating = "Fair";
    let color = "text-yellow-600 bg-yellow-50 dark:bg-yellow-950/30";
    let barColor = "bg-yellow-500";
    if (score >= 80) {
      rating = "Optimum";
      color = "text-green-600 bg-green-50 dark:bg-green-950/30";
      barColor = "bg-green-500";
    } else if (score < 50) {
      rating = "Not Recommended";
      color = "text-destructive bg-destructive/10";
      barColor = "bg-destructive";
    }

    let tip = "Perfect weather to spot local birds. Grab your binoculars!";
    if (score < 50) {
      tip = "Birds seek shelter during harsh weather. Better to wait it out.";
    } else if (score < 80) {
      tip = "Activity might be slower. Look near water bodies or sheltered trees.";
    }

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
      tip
    };
  }, [weatherData]);

  // Group sightings by species for the sidebar
  const groupedSightings = useMemo(() => {
    const groups = new Map<string, RecentObservation[]>();
    sightings.forEach(sighting => {
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
  }, [sightings]);

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

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      center: [78.9629, 20.5937], // Center of India
      zoom: 4.5,
    });

    map.current.addControl(new maplibregl.NavigationControl(), "top-right");

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

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

    const fetchRoute = async () => {
      try {
        const { lng: startLng, lat: startLat } = userLocation;
        const { lng: endLng, lat: endLat } = selectedSighting;
        const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&steps=true`;
        
        const res = await fetch(url);
        const data = await res.json();
        
        if (data.routes && data.routes[0]) {
          const route = data.routes[0];
          const coords = route.geometry.coordinates;
          
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

  // Add markers for bird sightings - SIMPLE AND VISIBLE
  useEffect(() => {
    if (!map.current) return;

    // Remove old markers when region changes
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current.clear();

    if (!sightings.length) return;

    console.log(`Creating ${sightings.length} markers`);

    // Add new markers
    sightings.forEach((sighting) => {
      const key = `${sighting.locId}-${sighting.speciesCode}-${sighting.obsDt}`;

      // Create simple, visible marker
      const el = document.createElement("div");
      el.style.cssText = `
        width: 30px; 
        height: 30px; 
        border-radius: 50%;
        background: #3a7d52;
        border: 3px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        cursor: pointer;
        display: flex; 
        align-items: center; 
        justify-content: center;
        font-size: 14px;
      `;
      el.textContent = "🐦";
      
      el.addEventListener('click', () => setSelectedSighting(sighting));

      // Create popup
      const popup = new maplibregl.Popup({
        offset: 25,
        closeButton: true,
        closeOnClick: false,
        maxWidth: '280px',
      }).setHTML(`
        <div style="padding: 12px; font-family: system-ui, sans-serif;">
          <h3 style="margin: 0 0 4px 0; font-size: 16px; font-weight: 600;">
            ${sighting.comName}
          </h3>
          <p style="margin: 0 0 8px 0; font-size: 12px; font-style: italic; color: #666;">
            ${sighting.sciName}
          </p>
          <div style="padding-top: 8px; border-top: 1px solid #e5e5e5;">
            <p style="margin: 0 0 4px 0; font-size: 12px;">
              📍 ${sighting.locName}
            </p>
            <p style="margin: 0; font-size: 11px; color: #666;">
              🕒 ${getTimeAgo(sighting.obsDt)}${sighting.howMany > 0 ? ` · ${sighting.howMany} bird${sighting.howMany > 1 ? 's' : ''}` : ''}
            </p>
          </div>
        </div>
      `);
      
      popup.on('close', () => {
        setSelectedSighting(current => current?.locId === sighting.locId ? null : current);
      });

      // Create marker
      const marker = new maplibregl.Marker({ 
        element: el,
        anchor: 'center',
      })
        .setLngLat([sighting.lng, sighting.lat])
        .setPopup(popup)
        .addTo(map.current!);
      
      markersRef.current.set(key, marker);
    });

    console.log(`Added ${markersRef.current.size} markers to map`);
  }, [sightings]);

  // Add community post markers (orange, distinct from eBird green)
  useEffect(() => {
    if (!map.current) return;

    // Remove old community markers
    communityMarkersRef.current.forEach(marker => marker.remove());
    communityMarkersRef.current.clear();

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
      el.textContent = "📸";

      const timeAgo = getTimeAgo(post.created_at);
      const username = post.author?.username || 'Unknown';

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
            ${post.note ? `<p style="margin: 6px 0 0 0; font-size: 12px; color: #444;">${post.note}</p>` : ''}
          </div>
        </div>
      `);

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

  // Filter markers visibility based on search
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
    
    sightings.forEach((sighting) => {
      const key = `${sighting.locId}-${sighting.speciesCode}-${sighting.obsDt}`;
      const marker = markersRef.current.get(key);
      
      if (marker) {
        const matches = 
          sighting.comName.toLowerCase().includes(searchLower) ||
          sighting.sciName.toLowerCase().includes(searchLower);
        
        const el = marker.getElement();
        el.style.display = matches ? 'flex' : 'none';
      }
    });

    communityPosts.forEach((post) => {
      const key = `community-${post.id}`;
      const marker = communityMarkersRef.current.get(key);
      if (marker) {
        const matches = post.species_name.toLowerCase().includes(searchLower);
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
            className="absolute bottom-[75px] left-0 right-0 md:right-auto md:top-0 md:bottom-0 w-full md:w-80 h-[45vh] md:h-auto bg-card/95 backdrop-blur-lg border-t md:border-t-0 md:border-r border-border z-30 flex flex-col rounded-t-3xl md:rounded-none shadow-[0_-8px_30px_rgba(0,0,0,0.12)] md:shadow-none"
          >
            {/* Sidebar Header */}
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display text-lg font-semibold">Recent Sightings</h2>
                <button
                  onClick={() => setShowSidebar(false)}
                  className="p-1 hover:bg-muted rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
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
            </div>

            {/* Sightings List */}
            <div className="flex-1 overflow-y-auto">
              {/* Community Sightings Section */}
              {communityPosts.length > 0 && (
                <div className="p-2 pb-0">
                  <div className="flex items-center gap-2 px-1 py-2">
                    <div className="w-5 h-5 rounded-full bg-[#e67e22] flex items-center justify-center text-[10px]">📸</div>
                    <span className="text-xs font-semibold text-[#e67e22] uppercase tracking-wide">Community Sightings</span>
                    <span className="ml-auto text-[10px] text-muted-foreground">Last 6 hrs</span>
                  </div>
                  {communityPosts.map((post) => (
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
              {communityPosts.length > 0 && groupedSightings.length > 0 && (
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
                        const key = `${latestObservation.locId}-${latestObservation.speciesCode}-${latestObservation.obsDt}`;
                        const marker = markersRef.current.get(key);
                        if (marker && map.current) {
                          marker.getPopup().addTo(map.current);
                        }
                      }}
                      className="w-full p-3 mb-2 bg-background hover:bg-muted rounded-xl text-left transition-colors border border-border"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm truncate">{species}</h3>
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
                        <span className="px-2 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium shrink-0">
                          {count}
                        </span>
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
        className="absolute bottom-24 right-4 z-10 w-12 h-12 rounded-full bg-primary shadow-lg flex items-center justify-center hover:scale-110 transition-transform"
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
                className="w-72 bg-card/95 backdrop-blur-md rounded-2xl shadow-xl border border-border p-4 text-left space-y-3"
              >
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <span className="font-bold text-sm">Weather Info</span>
                  <button
                    onClick={() => setShowWeatherDetails(false)}
                    className="p-1 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
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
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Selected Sighting Detail & Navigation Card */}
      {selectedSighting && !isNavigating && (
        <div className="absolute bottom-24 left-4 right-4 md:left-auto md:w-96 z-20 bg-card/95 backdrop-blur-lg rounded-3xl shadow-2xl border border-border p-4 animate-in slide-in-from-bottom duration-200">
          <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0">
              <span className="inline-block bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider mb-2">
                Selected Destination
              </span>
              <h3 className="font-semibold text-lg text-foreground truncate">{selectedSighting.comName}</h3>
              <p className="text-xs text-muted-foreground italic truncate mt-0.5">{selectedSighting.sciName}</p>
              
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
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" className="rotate-45"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              Start Guidance
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
          <div className="absolute bottom-24 left-4 right-4 max-w-md mx-auto z-30 animate-in slide-in-from-bottom duration-300">
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

                <div className="flex gap-2">
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
                  End Guidance
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
              🐦 Keep your binoculars ready! Look out for the <span className="font-bold">{selectedSighting?.comName}</span> ({selectedSighting?.sciName}) nearby.
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
