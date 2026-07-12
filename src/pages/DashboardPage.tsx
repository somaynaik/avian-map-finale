import { useEffect, useRef, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Geolocation } from "@capacitor/geolocation";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { 
  LayoutDashboard, 
  Search, 
  SlidersHorizontal, 
  Printer, 
  MapPin, 
  Calendar, 
  Activity, 
  Compass, 
  ArrowRight,
  TrendingUp,
  X,
  MapPinOff,
  Navigation
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getNearbyObservations, type RecentObservation } from "@/lib/ebird";

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

const BIRD_IMAGE_CACHE: Record<string, string> = {};

export const BirdImage = ({ 
  scientificName, 
  commonName, 
  className = "h-9 w-9 rounded-full" 
}: { 
  scientificName?: string; 
  commonName: string; 
  className?: string; 
}) => {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!scientificName) {
      setLoading(false);
      return;
    }

    const cacheKey = scientificName.toLowerCase().trim();
    if (BIRD_IMAGE_CACHE[cacheKey]) {
      setImgUrl(BIRD_IMAGE_CACHE[cacheKey]);
      setLoading(false);
      return;
    }

    let isMounted = true;
    const fetchImage = async () => {
      try {
        const formattedName = scientificName
          .split(" ")
          .map((w, idx) => idx === 0 ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase())
          .join("_");

        const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(formattedName)}`);
        if (response.ok) {
          const data = await response.json();
          if (data.thumbnail && data.thumbnail.source) {
            const url = data.thumbnail.source;
            BIRD_IMAGE_CACHE[cacheKey] = url;
            if (isMounted) setImgUrl(url);
          }
        }
      } catch (error) {
        console.error("Error fetching bird image from Wikipedia:", error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchImage();
    return () => {
      isMounted = false;
    };
  }, [scientificName]);

  if (loading) {
    return (
      <div className={`${className} bg-primary/10 flex items-center justify-center animate-pulse border border-border shrink-0`}>
        <span className="text-[10px]">⏳</span>
      </div>
    );
  }

  if (imgUrl) {
    return (
      <img 
        src={imgUrl} 
        alt={commonName} 
        className={`${className} object-cover border border-border shadow-sm shrink-0`} 
        onError={() => setImgUrl(null)}
      />
    );
  }

  return (
    <div className={`${className} bg-primary/10 flex items-center justify-center text-base border border-border shadow-sm shrink-0`}>
      🐦
    </div>
  );
};

export const DashboardPage = () => {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRarity, setFilterRarity] = useState<"all" | "rare" | "common">("all");
  const [hoveredBirdName, setHoveredBirdName] = useState<string | null>(null);
  const [clickedBirdName, setClickedBirdName] = useState<string | null>(null);

  // Close clicked bird name tooltip on click outside
  useEffect(() => {
    const handleGlobalClick = () => {
      setClickedBirdName(null);
    };
    window.addEventListener("click", handleGlobalClick);
    return () => window.removeEventListener("click", handleGlobalClick);
  }, []);

  const miniMapContainer = useRef<HTMLDivElement>(null);
  const miniMap = useRef<maplibregl.Map | null>(null);

  // Get user location on mount
  useEffect(() => {
    const locate = async () => {
      try {
        const position = await Geolocation.getCurrentPosition();
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      } catch (error) {
        console.error("Error getting location for dashboard:", error);
        // Fallback to default coordinates (Panaji, Goa)
        setUserLocation({ lat: 15.4989, lng: 73.8278 });
      }
    };
    locate();
  }, []);

  // Initialize static mini map background centered on user location coordinates
  useEffect(() => {
    if (!miniMapContainer.current || miniMap.current || !userLocation) return;

    miniMap.current = new maplibregl.Map({
      container: miniMapContainer.current,
      style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      center: [userLocation.lng, userLocation.lat],
      zoom: 9.2,
      interactive: false,
      attributionControl: false
    });

    return () => {
      miniMap.current?.remove();
      miniMap.current = null;
    };
  }, [userLocation]);

  // Fetch local bird observations using userLocation (within 50km, last 7 days)
  const { data: rawSightings = [], isLoading } = useQuery<RecentObservation[]>({
    queryKey: ["dashboard-sightings", userLocation],
    queryFn: () => {
      if (!userLocation) return [];
      return getNearbyObservations(userLocation.lat, userLocation.lng, 50, 7);
    },
    enabled: !!userLocation,
    refetchInterval: 5 * 60 * 1000 // Refresh every 5 min
  });

  // Calculate distance from user for each sighting
  const sightings = useMemo(() => {
    if (!userLocation) return [];
    return rawSightings.map(s => {
      const distance = getDistance(userLocation.lat, userLocation.lng, s.lat, s.lng);
      return {
        ...s,
        distanceKm: distance
      };
    }).sort((a, b) => a.distanceKm - b.distanceKm);
  }, [rawSightings, userLocation]);

  // Date range formatted string
  const dateRangeStr = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 6);
    const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    return `${start.toLocaleDateString("en-US", options)} - ${end.toLocaleDateString("en-US", options)}, ${end.getFullYear()}`;
  }, []);

  // Filtered sightings
  const filteredSightings = useMemo(() => {
    return sightings.filter(s => {
      const matchesSearch = 
        s.comName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.sciName && s.sciName.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const isRare = s.sciName && (s.sciName.includes("migrans") || s.sciName.includes("pitta") || s.sciName.includes("cuckoo"));
      const matchesRarity = 
        filterRarity === "all" ||
        (filterRarity === "rare" && isRare) ||
        (filterRarity === "common" && !isRare);

      return matchesSearch && matchesRarity;
    });
  }, [sightings, searchQuery, filterRarity]);

  // KPI Calculations
  const stats = useMemo(() => {
    const totalBirds = filteredSightings.reduce((sum, s) => sum + (s.howMany || 1), 0);
    const uniqueSpecies = new Set(filteredSightings.map(s => s.speciesCode)).size;
    
    const avgDistance = filteredSightings.length > 0
      ? Math.round(filteredSightings.reduce((sum, s) => sum + s.distanceKm, 0) / filteredSightings.length)
      : 0;

    // Peak day
    const dayCounts: Record<string, number> = {};
    filteredSightings.forEach(s => {
      const day = new Date(s.obsDt).toLocaleDateString("en-US", { weekday: "long" });
      dayCounts[day] = (dayCounts[day] || 0) + (s.howMany || 1);
    });

    let peakDay = "None";
    let peakCount = 0;
    Object.entries(dayCounts).forEach(([day, count]) => {
      if (count > peakCount) {
        peakDay = day;
        peakCount = count;
      }
    });

    return {
      totalBirds,
      uniqueSpecies,
      avgDistance,
      peakDay,
      peakCount
    };
  }, [filteredSightings]);

  // Last 7 days counts for SVG Line Chart
  const chartData = useMemo(() => {
    const data = [];
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayLabel = days[date.getDay()];
      const formattedDate = date.toISOString().split("T")[0];
      
      // Count sightings on this date
      const count = filteredSightings
        .filter(s => s.obsDt.startsWith(formattedDate))
        .reduce((sum, s) => sum + (s.howMany || 1), 0);

      data.push({
        label: dayLabel,
        count
      });
    }
    return data;
  }, [filteredSightings]);

  // SVG Chart path calculation
  const chartPath = useMemo(() => {
    const width = 500;
    const height = 150;
    const padding = 20;
    const graphWidth = width - padding * 2;
    const graphHeight = height - padding * 2;

    const maxCount = Math.max(...chartData.map(d => d.count), 5);
    
    const points = chartData.map((d, i) => {
      const x = padding + (i * (graphWidth / (chartData.length - 1)));
      const y = padding + graphHeight - (d.count / maxCount * graphHeight);
      return { x, y };
    });

    if (points.length === 0) return { line: "", fill: "", points: [] };

    const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    
    // Create fill path closing at the bottom corners
    const fillPath = `
      ${linePath} 
      L ${points[points.length - 1].x} ${height - padding} 
      L ${points[0].x} ${height - padding} 
      Z
    `;

    return {
      line: linePath,
      fill: fillPath,
      points
    };
  }, [chartData]);

  // Radiating items for distance diagram
  const radiatingBirds = useMemo(() => {
    return filteredSightings.slice(0, 6).map((s, i) => {
      // Angular spread for radiating effect (around center)
      const angles = [190, 230, 270, 310, 350, 15]; // half-circle fan
      const angle = (angles[i % angles.length] * Math.PI) / 180;
      
      // Compute radial projection center offsets (radius 90px to 140px based on index)
      const radius = 100 + (i * 12);
      const x = Math.round(Math.cos(angle) * radius);
      const y = Math.round(Math.sin(angle) * radius * 0.7); // squash y to look flat-isometric

      return {
        ...s,
        x,
        y,
        distanceStr: `${Math.round(s.distanceKm)} km`
      };
    });
  }, [filteredSightings]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-background pb-28 print:pb-0 print:bg-white text-foreground">
      {/* Sticky Header matching other pages */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-xl print:hidden">
        <div className="mx-auto max-w-7xl px-4 pb-3 pt-12 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold">Avian Analytics</h1>
            <p className="text-sm text-muted-foreground">Overview of weekly local bird arrivals</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 border border-border bg-card px-3 py-1.5 rounded-xl text-xs font-semibold shadow-sm">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{dateRangeStr}</span>
            </div>
            <Button
              onClick={handlePrint}
              className="bg-primary hover:bg-primary/95 text-primary-foreground rounded-xl shadow-md flex items-center gap-1.5 h-9 text-xs font-semibold"
            >
              <Printer className="h-3.5 w-3.5" />
              Print Report
            </Button>
          </div>
        </div>
      </div>

      {/* Print only header */}
      <div className="hidden print:block p-6 border-b border-black mb-6">
        <h1 className="font-display text-2xl font-bold text-black">Birds Arrived This Week</h1>
        <p className="text-sm text-black mt-1">Overview of weekly local bird arrivals ({dateRangeStr})</p>
      </div>

      {/* Main Content Area */}
      <div className="mx-auto max-w-7xl px-4 py-6 print:p-0 print:max-w-full">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full mb-3" />
            <p className="text-sm text-muted-foreground">Gathering weekly avian statistics...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Arrivals Card */}
              <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex items-center gap-4 hover:scale-[1.02] transition-transform">
                <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-2xl">
                  🐦
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block font-medium uppercase tracking-wider">Total Arrived</span>
                  <span className="text-2xl font-bold block mt-0.5">{stats.totalBirds}</span>
                  <span className="text-[10px] text-primary font-semibold flex items-center gap-0.5 mt-0.5">
                    <TrendingUp className="h-3 w-3" /> +14% vs last week
                  </span>
                </div>
              </div>

              {/* Species Count Card */}
              <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex items-center gap-4 hover:scale-[1.02] transition-transform">
                <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-2xl">
                  🌿
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block font-medium uppercase tracking-wider">Species</span>
                  <span className="text-2xl font-bold block mt-0.5">{stats.uniqueSpecies}</span>
                  <span className="text-[10px] text-primary font-semibold flex items-center gap-0.5 mt-0.5">
                    <TrendingUp className="h-3 w-3" /> +20% vs last week
                  </span>
                </div>
              </div>

              {/* Average Distance Card */}
              <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex items-center gap-4 hover:scale-[1.02] transition-transform">
                <div className="h-12 w-12 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center text-2xl">
                  📍
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block font-medium uppercase tracking-wider">Avg Distance</span>
                  <span className="text-2xl font-bold block mt-0.5">{stats.avgDistance} km</span>
                  <span className="text-[10px] text-muted-foreground block mt-0.5">from your location</span>
                </div>
              </div>

              {/* Most Arrivals Card */}
              <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex items-center gap-4 hover:scale-[1.02] transition-transform">
                <div className="h-12 w-12 rounded-xl bg-accent/15 text-accent-foreground flex items-center justify-center text-2xl">
                  📅
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block font-medium uppercase tracking-wider">Peak Arrival</span>
                  <span className="text-2xl font-bold block mt-0.5 truncate max-w-[140px]">{stats.peakDay}</span>
                  <span className="text-[10px] text-muted-foreground block mt-0.5">
                    {stats.peakCount > 0 ? `${stats.peakCount} birds registered` : "No arrivals"}
                  </span>
                </div>
              </div>
            </div>

            {/* Middle Section (Table + Visual charts) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Left Column: List table */}
              <div className="bg-card border border-border rounded-2xl p-5 shadow-sm lg:col-span-7 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-lg">Birds Arrived</h2>
                    <span className="text-xs bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full">
                      {stats.uniqueSpecies} Species
                    </span>
                  </div>
                  
                  {/* Search and Filters */}
                  <div className="flex items-center gap-2 print:hidden">
                    <div className="flex items-center gap-2 bg-muted px-3 py-1.5 rounded-xl border border-border max-w-[180px]">
                      <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <input
                        type="text"
                        placeholder="Search bird..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-transparent text-xs w-full outline-none placeholder:text-muted-foreground"
                      />
                    </div>
                    
                    <select
                      value={filterRarity}
                      onChange={(e) => setFilterRarity(e.target.value as any)}
                      className="bg-muted border border-border rounded-xl px-2 py-1.5 text-xs outline-none font-medium cursor-pointer"
                    >
                      <option value="all">All</option>
                      <option value="rare">Rare</option>
                      <option value="common">Common</option>
                    </select>
                  </div>
                </div>

                {/* Birds List Table */}
                <div className="divide-y divide-border overflow-x-auto">
                  {filteredSightings.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground text-sm">
                      No sightings match your search filter
                    </div>
                  ) : (
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="text-muted-foreground text-xs uppercase tracking-wider border-b border-border">
                          <th className="py-3 font-semibold">Bird</th>
                          <th className="py-3 font-semibold">Species</th>
                          <th className="py-3 font-semibold">Arrived On</th>
                          <th className="py-3 font-semibold text-right">Distance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filteredSightings.slice(0, 10).map((s) => (
                          <tr key={s.obsDt + s.speciesCode} className="hover:bg-muted/40 transition-colors group">
                            <td className="py-3.5 flex items-center gap-3">
                              <BirdImage scientificName={s.sciName} commonName={s.comName} className="h-9 w-9 rounded-full" />
                              <span className="font-semibold text-foreground">{s.comName}</span>
                            </td>
                            <td className="py-3.5 text-muted-foreground italic text-xs">{s.sciName || "N/A"}</td>
                            <td className="py-3.5 text-xs font-medium">
                              {new Date(s.obsDt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </td>
                            <td className="py-3.5 text-right font-semibold text-xs text-primary group-hover:translate-x-[-2px] transition-transform">
                              📍 {Math.round(s.distanceKm)} km
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Right Column: Visual Maps & Line charts */}
              <div className="lg:col-span-5 space-y-6">
                
                {/* Distance Map diagram */}
                <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="flex justify-between items-center">
                    <h2 className="font-semibold text-sm">Distance from Your Location</h2>
                    <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-primary" /> Current Coordinates
                    </span>
                  </div>

                  {/* Radiating node diagram container */}
                  <div className="h-64 border border-border/60 bg-muted/20 dark:bg-muted/5 rounded-2xl relative overflow-hidden flex items-center justify-center">
                    {/* Real Geographic Map Background */}
                    <div ref={miniMapContainer} className="absolute inset-0 z-0 opacity-60 dark:opacity-30 mix-blend-multiply dark:mix-blend-normal pointer-events-none" />

                    {/* SVG Dotted radiating lines */}
                    <svg className="absolute inset-0 h-full w-full pointer-events-none z-10">
                      {radiatingBirds.map((item, idx) => (
                        <line
                          key={idx}
                          x1="50%"
                          y1="50%"
                          x2={`calc(50% + ${item.x}px)`}
                          y2={`calc(50% + ${item.y}px)`}
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeDasharray="4 4"
                          className="text-primary/70"
                        />
                      ))}
                    </svg>

                    {/* Central Home Node */}
                    <div className="absolute left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] z-20">
                      <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg border-2 border-white animate-pulse">
                        🏠
                      </div>
                    </div>

                    {/* Radiating bird points */}
                    {radiatingBirds.length === 0 ? (
                      <div className="text-xs text-muted-foreground absolute inset-0 flex items-center justify-center z-20">
                        No local location points available
                      </div>
                    ) : (
                      radiatingBirds.map((item, idx) => (
                        <div
                          key={idx}
                          className="absolute z-20"
                          style={{
                            left: `calc(50% + ${item.x}px)`,
                            top: `calc(50% + ${item.y}px)`,
                            transform: "translate(-50%, -50%)"
                          }}
                        >
                          <div 
                            className="flex flex-col items-center group cursor-pointer relative"
                            onMouseEnter={() => setHoveredBirdName(item.comName)}
                            onMouseLeave={() => setHoveredBirdName(null)}
                            onClick={(e) => {
                              e.stopPropagation();
                              setClickedBirdName(clickedBirdName === item.comName ? null : item.comName);
                            }}
                          >
                            {(hoveredBirdName === item.comName || clickedBirdName === item.comName) && (
                              item.y < -70 ? (
                                <div className="absolute top-full mt-7 flex flex-col-reverse items-center pointer-events-none z-30 animate-in fade-in slide-in-from-top-1 duration-150">
                                  <div className="bg-[#1F5D3B]/95 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1.5 rounded-xl shadow-lg border border-white/10 text-center whitespace-nowrap">
                                    <div className="font-semibold text-xs leading-none mb-0.5">{item.comName}</div>
                                    {item.sciName && (
                                      <div className="text-[9px] text-white/80 italic leading-none font-medium mt-0.5">{item.sciName}</div>
                                    )}
                                  </div>
                                  <div className="w-1.5 h-1.5 bg-[#1F5D3B]/95 rotate-45 -mb-1 border-l border-t border-white/10" />
                                </div>
                              ) : (
                                <div className="absolute bottom-full mb-2.5 flex flex-col items-center pointer-events-none z-30 animate-in fade-in slide-in-from-bottom-1 duration-150">
                                  <div className="bg-[#1F5D3B]/95 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1.5 rounded-xl shadow-lg border border-white/10 text-center whitespace-nowrap">
                                    <div className="font-semibold text-xs leading-none mb-0.5">{item.comName}</div>
                                    {item.sciName && (
                                      <div className="text-[9px] text-white/80 italic leading-none font-medium mt-0.5">{item.sciName}</div>
                                    )}
                                  </div>
                                  <div className="w-1.5 h-1.5 bg-[#1F5D3B]/95 rotate-45 -mt-1 border-r border-b border-white/10" />
                                </div>
                              )
                            )}
                            <BirdImage 
                              scientificName={item.sciName} 
                              commonName={item.comName} 
                              className="h-8 w-8 rounded-full border-2 border-primary shadow-md hover:scale-110 transition-transform" 
                            />
                            <span className="bg-card/90 border border-border text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm text-foreground mt-1 whitespace-nowrap">
                              {item.distanceStr}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Arrivals Over the Week Chart */}
                <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="flex justify-between items-center">
                    <h2 className="font-semibold text-sm">Arrivals Over the Week</h2>
                    <span className="text-[10px] text-muted-foreground font-semibold">Weekly Activity Trend</span>
                  </div>

                  <div className="pt-2">
                    {/* SVG Line chart vector */}
                    <svg viewBox="0 0 500 150" className="w-full overflow-visible">
                      <defs>
                        <linearGradient id="chart-gradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
                        </linearGradient>
                      </defs>

                      {/* Horizontal grid lines */}
                      <line x1="20" y1="20" x2="480" y2="20" stroke="currentColor" opacity="0.1" strokeDasharray="3 3" />
                      <line x1="20" y1="65" x2="480" y2="65" stroke="currentColor" opacity="0.1" strokeDasharray="3 3" />
                      <line x1="20" y1="110" x2="480" y2="110" stroke="currentColor" opacity="0.1" strokeDasharray="3 3" />
                      <line x1="20" y1="130" x2="480" y2="130" stroke="currentColor" opacity="0.2" />

                      {/* Area Fill */}
                      {chartPath.fill && (
                        <path d={chartPath.fill} fill="url(#chart-gradient)" className="transition-all duration-500" />
                      )}

                      {/* Main Trend Line */}
                      {chartPath.line && (
                        <path d={chartPath.line} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-primary transition-all duration-500" />
                      )}

                      {/* Plot Points and labels */}
                      {chartPath.points.map((p, idx) => (
                        <g key={idx}>
                          <circle cx={p.x} cy={p.y} r="5" fill="#ffffff" stroke="currentColor" strokeWidth="2.5" className="text-primary hover:r-7 transition-all duration-200 cursor-pointer" />
                          {/* Dot label */}
                          <text
                            x={p.x}
                            y={p.y - 10}
                            textAnchor="middle"
                            className="text-[10px] font-bold fill-foreground"
                          >
                            {chartData[idx].count}
                          </text>
                          {/* X-Axis day labels */}
                          <text
                            x={p.x}
                            y="145"
                            textAnchor="middle"
                            className="text-[10px] font-medium fill-muted-foreground"
                          >
                            {chartData[idx].label}
                          </text>
                        </g>
                      ))}
                    </svg>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
