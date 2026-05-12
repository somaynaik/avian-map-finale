import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Camera, ImagePlus, Loader2, MapPin, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Geolocation } from "@capacitor/geolocation";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { createPost, uploadPostImage } from "@/lib/social";

const CLASSIFIER_URL = import.meta.env.VITE_BIRDSCANNER_URL || "http://localhost:5000";

const CameraPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [speciesName, setSpeciesName] = useState("");
  const [locationName, setLocationName] = useState("");
  const [note, setNote] = useState("");
  const [predictedSpecies, setPredictedSpecies] = useState<string | null>(null);

  // Location pin state
  const [pinLocation, setPinLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [locatingUser, setLocatingUser] = useState(false);
  const miniMapContainerRef = useRef<HTMLDivElement>(null);
  const miniMapRef = useRef<maplibregl.Map | null>(null);
  const pinMarkerRef = useRef<maplibregl.Marker | null>(null);

  useEffect(() => {
    if (!imageFile) {
      setImagePreview(null);
      return;
    }

    const objectUrl = URL.createObjectURL(imageFile);
    setImagePreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [imageFile]);

  // Initialize mini-map when showMap becomes true
  useEffect(() => {
    if (!showMap || !miniMapContainerRef.current || miniMapRef.current) return;

    const center: [number, number] = pinLocation
      ? [pinLocation.lng, pinLocation.lat]
      : [78.9629, 20.5937]; // Default: center of India

    const mapInstance = new maplibregl.Map({
      container: miniMapContainerRef.current,
      style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      center,
      zoom: pinLocation ? 14 : 4.5,
    });

    mapInstance.addControl(new maplibregl.NavigationControl(), "top-right");

    // Create draggable marker
    const markerEl = document.createElement("div");
    markerEl.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      cursor: grab;
    `;
    markerEl.innerHTML = `
      <div style="
        width: 36px; height: 36px;
        background: #1F5D3B;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        border: 3px solid white;
      ">
        <span style="transform: rotate(45deg); font-size: 16px;">🐦</span>
      </div>
      <div style="
        width: 8px; height: 8px;
        background: rgba(31,93,59,0.3);
        border-radius: 50%;
        margin-top: 2px;
      "></div>
    `;

    const marker = new maplibregl.Marker({
      element: markerEl,
      draggable: true,
      anchor: "bottom",
    })
      .setLngLat(center)
      .addTo(mapInstance);

    marker.on("dragend", () => {
      const lngLat = marker.getLngLat();
      setPinLocation({ lat: lngLat.lat, lng: lngLat.lng });
    });

    pinMarkerRef.current = marker;
    miniMapRef.current = mapInstance;

    return () => {
      mapInstance.remove();
      miniMapRef.current = null;
      pinMarkerRef.current = null;
    };
  }, [showMap]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-locate user when map is opened
  const locateAndCenter = useCallback(async () => {
    setLocatingUser(true);
    try {
      const position = await Geolocation.getCurrentPosition();
      const { latitude, longitude } = position.coords;
      const loc = { lat: latitude, lng: longitude };
      setPinLocation(loc);

      if (miniMapRef.current) {
        miniMapRef.current.flyTo({
          center: [longitude, latitude],
          zoom: 14,
          duration: 1500,
        });
      }

      if (pinMarkerRef.current) {
        pinMarkerRef.current.setLngLat([longitude, latitude]);
      }
    } catch (error) {
      console.error("Could not get location:", error);
      toast({
        title: "Location unavailable",
        description: "Could not get your location. Drag the pin manually.",
        variant: "destructive",
      });
    } finally {
      setLocatingUser(false);
    }
  }, []);

  // When the user opens the map, auto-locate
  useEffect(() => {
    if (showMap && !pinLocation) {
      locateAndCenter();
    }
  }, [showMap]); // eslint-disable-line react-hooks/exhaustive-deps

  const classifyMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file, file.name);

      const response = await fetch(`${CLASSIFIER_URL}/classify-image`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(
          data.error ||
            "The classifier server did not accept the image. Check that birdscanner is running and CORS is enabled.",
        );
      }

      return data as { species: string; type: string };
    },
    onSuccess: (data) => {
      setPredictedSpecies(data.species);
      setSpeciesName((current) => current || data.species);
      toast({
        title: "Model prediction ready",
        description: `Detected species: ${data.species}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Could not classify image",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createPostMutation = useMutation({
    mutationFn: async () => {
      if (!imageFile) {
        throw new Error("Upload an image before posting.");
      }

      const imageUrl = await uploadPostImage(user!.id, imageFile);
      return createPost({
        author_id: user!.id,
        species_name: speciesName,
        location_name: locationName,
        note,
        image_url: imageUrl,
        latitude: pinLocation?.lat ?? null,
        longitude: pinLocation?.lng ?? null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feed", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["profile-posts", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["profile-stats", user?.id] });
      toast({
        title: "Post created",
        description: "Your sighting is now in the live feed.",
      });
      navigate("/feed");
    },
    onError: (error: Error) => {
      toast({
        title: "Could not create post",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    if (!file) return;

    setImageFile(file);
    setPredictedSpecies(null);
    classifyMutation.mutate(file);
  };

  const handleClear = () => {
    setImageFile(null);
    setPredictedSpecies(null);
    setSpeciesName("");
  };

  return (
    <div className="min-h-screen bg-background pb-12">
      <div className="border-b border-border px-4 pb-4 pt-12">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <Button type="button" variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="font-display text-2xl font-bold">Scan and post</h1>
            <p className="text-sm text-muted-foreground">
              Upload a bird photo, identify the species via AI, then publish the sighting
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-lg space-y-4 px-4 pt-4">
        {/* Image preview / upload area */}
        <div className="overflow-hidden rounded-3xl border border-border bg-card">
          {imagePreview ? (
            <img src={imagePreview} alt="Captured bird" className="aspect-[4/5] w-full object-cover" />
          ) : (
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="flex aspect-[4/5] flex-col items-center justify-center gap-4 text-center transition-colors hover:bg-muted/50">
                <div className="rounded-full bg-primary/10 p-5">
                  <Camera className="h-10 w-10 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-lg">Tap to take or upload a photo</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your phone camera will open, or you can pick from gallery
                  </p>
                </div>
              </div>
            </label>
          )}
        </div>

        {/* Action buttons */}
        {imagePreview ? (
          <div className="grid grid-cols-2 gap-3">
            <Button type="button" variant="outline" onClick={handleClear}>
              <ImagePlus className="h-4 w-4" />
              Choose different photo
            </Button>
            <label>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button type="button" variant="outline" className="w-full" asChild>
                <span>
                  <Camera className="h-4 w-4" />
                  Take new photo
                </span>
              </Button>
            </label>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <label>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button type="button" variant="default" className="w-full" asChild>
                <span>
                  <Camera className="h-4 w-4" />
                  Take photo
                </span>
              </Button>
            </label>
            <label>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button type="button" variant="outline" className="w-full" asChild>
                <span>
                  <ImagePlus className="h-4 w-4" />
                  Upload from gallery
                </span>
              </Button>
            </label>
          </div>
        )}

        {/* Model prediction card */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">AI Model prediction</p>
            </div>
            {classifyMutation.isPending && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
          </div>

          <div className="mt-3 rounded-xl bg-muted px-3 py-2 text-sm">
            {predictedSpecies ? (
              <span className="inline-flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                {predictedSpecies}
              </span>
            ) : (
              <span className="text-muted-foreground">
                Upload a photo to classify it with the AI model.
              </span>
            )}
          </div>

          {imageFile && (
            <Button
              type="button"
              variant="outline"
              className="mt-3 w-full"
              disabled={classifyMutation.isPending}
              onClick={() => classifyMutation.mutate(imageFile)}
            >
              <Sparkles className="h-4 w-4" />
              Re-run model
            </Button>
          )}
        </div>

        {/* Pin on map card */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Pin observation on map</p>
              <p className="text-xs text-muted-foreground">
                {pinLocation
                  ? `📍 ${pinLocation.lat.toFixed(5)}, ${pinLocation.lng.toFixed(5)}`
                  : "Drag the pin to mark where you saw the bird"}
              </p>
            </div>
            <Button
              type="button"
              variant={showMap ? "outline" : "default"}
              size="sm"
              onClick={() => setShowMap(!showMap)}
            >
              <MapPin className="h-4 w-4" />
              {showMap ? "Hide map" : "Open map"}
            </Button>
          </div>

          {showMap && (
            <div className="mt-3 space-y-2">
              <div
                ref={miniMapContainerRef}
                className="h-64 w-full rounded-xl overflow-hidden border border-border"
                style={{ minHeight: 256 }}
              />
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  Drag the pin to adjust location
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={locatingUser}
                  onClick={locateAndCenter}
                >
                  {locatingUser ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <MapPin className="h-3 w-3" />
                  )}
                  My location
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Form fields */}
        <div className="space-y-2">
          <Label htmlFor="species-name">Species name</Label>
          <Input
            id="species-name"
            value={speciesName}
            onChange={(event) => setSpeciesName(event.target.value)}
            placeholder="Example: Indian Peafowl"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="location-name">Location</Label>
          <Input
            id="location-name"
            value={locationName}
            onChange={(event) => setLocationName(event.target.value)}
            placeholder="Where did you see it?"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="note">Notes</Label>
          <Textarea
            id="note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Add context about the sighting"
          />
        </div>

        <Button
          type="button"
          className="w-full"
          disabled={createPostMutation.isPending || !imageFile || !speciesName.trim()}
          onClick={() => createPostMutation.mutate()}
        >
          {createPostMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Posting...
            </>
          ) : (
            "Post sighting"
          )}
        </Button>
      </div>
    </div>
  );
};

export default CameraPage;
