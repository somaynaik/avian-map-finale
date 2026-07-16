import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Camera, ImagePlus, Loader2, MapPin, Sparkles, Mic, Square, Upload, Music, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Geolocation } from "@capacitor/geolocation";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createPost, uploadPostImage, listUsers, getInitials } from "@/lib/social";

const CLASSIFIER_URL = import.meta.env.VITE_BIRDSCANNER_URL || "http://localhost:5000";

const loadScript = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = (err) => reject(err);
    document.head.appendChild(script);
  });
};

let loadedModel: any = null;
let modelPromise: Promise<any> | null = null;

const preloadModel = async () => {
  if (loadedModel) return loadedModel;
  if (modelPromise) return modelPromise;

  modelPromise = (async () => {
    try {
      await loadScript("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.20.0/dist/tf.min.js");
      await loadScript("https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.0/dist/mobilenet.min.js");
      // @ts-ignore
      const model = await window.mobilenet.load({ version: 2, alpha: 1.0 });
      loadedModel = model;
      return model;
    } catch (err) {
      console.error("Failed to load MobileNet model:", err);
      modelPromise = null;
      throw err;
    }
  })();

  return modelPromise;
};

const verifyBirdImage = async (imgElement: HTMLImageElement): Promise<boolean> => {
  try {
    const model = await preloadModel();
    const predictions = await model.classify(imgElement);
    console.log("MobileNet Predictions:", predictions);
    
    const birdKeywords = [
      "bird", "peacock", "peafowl", "pavo", "finch", "sparrow", "albatross", "macaw", "parrot", "owl", "swan", "duck", 
      "goose", "crane", "flamingo", "cock", "hen", "vulture", "falcon", "eagle", "hawk", "hummingbird", "toucan", 
      "pelican", "woodpecker", "robin", "bluejay", "canary", "lorikeet", "jay", "magpie", "cuckoo", "kingfisher", 
      "hornbill", "heron", "gull", "puffin", "kite", "partridge", "quail", "pheasant", "grouse", "swallow", "warbler", 
      "thrush", "lark", "nightingale", "starling", "crow", "raven", "ostrich", "emu", "cassowary", "kiwi", "penguin",
      "bunting", "stork", "spoonbill", "egret", "bittern", "coot", "white stork", "black stork", "stork", "egret",
      "heron", "bittern", "ibis", "spoonbill", "flamingo", "crane", "limpkin"
    ];
    
    const topPrediction = predictions[0];
    if (!topPrediction) return false;

    const isTopNonBird = [
      "web site", "website", "screen", "monitor", "cellular telephone", "handheld computer", "notebook",
      "laptop", "envelope", "packet", "carton", "menu", "slide rule", "comic book", "book jacket",
      "photocopy", "modem", "jersey", "t-shirt", "face", "man", "woman", "person", "groom"
    ].some(term => topPrediction.className.toLowerCase().includes(term));
    
    if (isTopNonBird && topPrediction.probability > 0.35) {
      return false;
    }
    
    const hasBird = predictions.some((pred: any) => 
      birdKeywords.some(keyword => pred.className.toLowerCase().includes(keyword))
    );
    
    return hasBird;
  } catch (error) {
    console.error("Error during MobileNet bird verification:", error);
    return true;
  }
};

const CameraPage = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);

  const [speciesName, setSpeciesName] = useState("");
  const [locationName, setLocationName] = useState("");
  const [note, setNote] = useState("");
  const [predictedSpecies, setPredictedSpecies] = useState<string | null>(null);
  const [taggedUserIds, setTaggedUserIds] = useState<string[]>([]);
  const [tagSearchQuery, setTagSearchQuery] = useState("");

  // Location pin state
  const [pinLocation, setPinLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [locatingUser, setLocatingUser] = useState(false);

  const { data: allUsers = [] } = useQuery({
    queryKey: ["all-users-to-tag", user?.id],
    queryFn: () => listUsers(user!.id, ""),
    enabled: !!user?.id,
  });

  const filteredUsers = allUsers.filter(u => {
    const search = tagSearchQuery.toLowerCase();
    const fullName = (u.full_name || "").toLowerCase();
    const username = (u.username || "").toLowerCase();
    return fullName.includes(search) || username.includes(search);
  });
  const miniMapContainerRef = useRef<HTMLDivElement>(null);
  const miniMapRef = useRef<maplibregl.Map | null>(null);
  const pinMarkerRef = useRef<maplibregl.Marker | null>(null);
  const currentStyleRef = useRef<string>("");

  useEffect(() => {
    if (!imageFile) {
      setImagePreview(null);
      return;
    }

    const objectUrl = URL.createObjectURL(imageFile);
    setImagePreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [imageFile]);

  useEffect(() => {
    if (!videoFile) {
      setVideoPreview(null);
      return;
    }

    const objectUrl = URL.createObjectURL(videoFile);
    setVideoPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [videoFile]);

  useEffect(() => {
    preloadModel().catch((err) => console.error("Error preloading MobileNet model:", err));

    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  // Initialize mini-map when showMap becomes true
  useEffect(() => {
    if (!showMap || !miniMapContainerRef.current || miniMapRef.current) return;

    const center: [number, number] = pinLocation
      ? [pinLocation.lng, pinLocation.lat]
      : [78.9629, 20.5937]; // Default: center of India

    const initialStyle = (theme === "dark" || document.documentElement.classList.contains("dark"))
      ? "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
      : "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

    currentStyleRef.current = initialStyle;
    const mapInstance = new maplibregl.Map({
      container: miniMapContainerRef.current,
      style: initialStyle,
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
        <div style="transform: rotate(45deg); display: flex; align-items: center; justify-content: center; color: white;">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M16 7h.01" />
            <path d="M3.4 18H12a8 8 0 0 0 8-8V7a4 4 0 0 0-7.28-2.3L2 20" />
            <path d="m20 7 2 .5-2 .5" />
            <path d="M10 18v3" />
            <path d="M14 18v3" />
            <path d="M7 21h10" />
          </svg>
        </div>
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

  // Dynamic Mini Map Theme Switching
  useEffect(() => {
    if (!miniMapRef.current) return;
    const targetStyle = theme === "dark"
      ? "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
      : "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

    if (currentStyleRef.current === targetStyle) return;
    currentStyleRef.current = targetStyle;

    miniMapRef.current.setStyle(targetStyle);
  }, [theme]);

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
    mutationFn: async (file: File | Blob) => {
      const formData = new FormData();
      const isAudio = file.type.startsWith("audio");
      
      if (isAudio) {
        formData.append("file", file, "audio_recording.wav");
      } else {
        formData.append("file", file, (file as File).name || "image.jpg");
      }

      const endpoint = isAudio ? "/classify-audio" : "/classify-image";
      const response = await fetch(`${CLASSIFIER_URL}${endpoint}`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(
          data.error ||
            "The classifier server did not accept the file. Check that birdscanner is running and CORS is enabled.",
        );
      }

      if (data.rejected) {
        throw new Error(data.message || "No confident bird calls were detected.");
      }

      // Verification for images: check if the returned classification matches a bird
      if (!isAudio) {
        const isValidBird = await new Promise<boolean>((resolve) => {
          const img = new Image();
          img.src = URL.createObjectURL(file as File);
          img.onload = async () => {
            const result = await verifyBirdImage(img);
            URL.revokeObjectURL(img.src);
            resolve(result);
          };
          img.onerror = () => {
            resolve(true); // Fallback on image loading error
          };
        });

        if (!isValidBird) {
          throw new Error("The uploaded image does not appear to contain a bird. (Detected non-bird content)");
        }

        if (
          data.is_bird === false ||
          (data.confidence !== undefined && data.confidence < 0.45) ||
          (data.species && data.species.toLowerCase().trim() === "not a bird")
        ) {
          throw new Error(
            data.message || "The uploaded image does not appear to contain a recognized bird species."
          );
        }
      }

      // The audio API returns { candidates: [{ species: "..." }] } instead of { species: "..." }
      if (isAudio && data.candidates && data.candidates.length > 0) {
        data.species = data.candidates[0].species;
      } else if (isAudio) {
        throw new Error("Could not determine species from the audio recording.");
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
      setImageFile(null);
      setImagePreview(null);
      setAudioBlob(null);
      setPredictedSpecies(null);
      setSpeciesName("");
      toast({
        title: "Media Rejected",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createPostMutation = useMutation({
    mutationFn: async () => {
      if (!imageFile && !audioBlob && !videoFile) {
        throw new Error("Upload an image, video, or record audio before posting.");
      }

      // If only audio is provided, use a default image since image_url is required by the DB
      let imageUrl = "/avian-map-final-logo.jpeg";
      if (imageFile) {
        imageUrl = await uploadPostImage(user!.id, imageFile);
      } else if (videoFile) {
        imageUrl = await uploadPostImage(user!.id, videoFile);
      }

      const notePayload = JSON.stringify({ body: note, tags: taggedUserIds });
      
      return createPost({
        author_id: user!.id,
        species_name: speciesName,
        location_name: locationName,
        note: notePayload,
        image_url: imageUrl,
        latitude: pinLocation?.lat ?? null,
        longitude: pinLocation?.lng ?? null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feed", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["profile-posts", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["profile-stats", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["community-map-posts"] });
      toast({
        title: "Post created",
        description: "Your sighting is now in the live feed and on the map.",
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

    setAudioBlob(null);
    setVideoFile(null);
    setImageFile(file);
    setPredictedSpecies(null);
    classifyMutation.mutate(file);
  };

  const handleVideoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    if (!file) return;

    setImageFile(null);
    setAudioBlob(null);
    setVideoFile(file);
    setPredictedSpecies(null);
    toast({
      title: "Video selected",
      description: "Please manually enter the species name below.",
    });
  };

  const handleAudioUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    if (!file) return;

    setImageFile(null);
    setVideoFile(null);
    setAudioBlob(file);
    setPredictedSpecies(null);
    classifyMutation.mutate(file);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        setAudioBlob(audioBlob);
        setImageFile(null);
        setPredictedSpecies(null);
        classifyMutation.mutate(audioBlob);
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err: any) {
      toast({
        title: "Microphone Error",
        description: "Could not access your microphone. Please allow permissions.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleClear = () => {
    setImageFile(null);
    setAudioBlob(null);
    setVideoFile(null);
    setPredictedSpecies(null);
    setSpeciesName("");
    setTaggedUserIds([]);
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
        <div className="overflow-hidden rounded-3xl border border-border bg-card">
          {imagePreview ? (
            <img src={imagePreview} alt="Captured bird" className="aspect-[4/5] w-full object-cover" />
          ) : videoPreview ? (
            <video src={videoPreview} controls playsInline className="aspect-[4/5] w-full object-cover" />
          ) : audioBlob ? (
            <div className="flex aspect-[4/5] flex-col items-center justify-center gap-4 bg-muted/30">
              <div className="rounded-full bg-primary/20 p-6 animate-pulse">
                <Music className="h-16 w-16 text-primary" />
              </div>
              <p className="font-semibold text-lg">Audio Recorded</p>
              <audio controls src={URL.createObjectURL(audioBlob)} className="mt-4" />
            </div>
          ) : (
            <div className="flex aspect-[4/5] flex-col items-center justify-center gap-4 text-center">
              
              {/* Image Input */}
              <label className="cursor-pointer group flex flex-col items-center gap-2">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <div className="rounded-full bg-primary/10 p-5 group-hover:bg-primary/20 transition-colors">
                  <Camera className="h-10 w-10 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">Tap to take a photo</p>
                </div>
              </label>

              <div className="flex items-center gap-4 w-full px-12 opacity-50">
                <div className="h-px bg-border flex-1"></div>
                <span className="text-xs font-medium uppercase">or</span>
                <div className="h-px bg-border flex-1"></div>
              </div>

              {/* Media Upload Buttons */}
              <div className="grid grid-cols-3 gap-4 px-6 w-full">
                <div className="flex flex-col items-center gap-2">
                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`rounded-full p-4 transition-colors ${
                      isRecording 
                        ? 'bg-destructive/20 text-destructive hover:bg-destructive/30 animate-pulse' 
                        : 'bg-primary/10 text-primary hover:bg-primary/20'
                    }`}
                  >
                    {isRecording ? <Square className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                  </button>
                  <p className="text-[11px] font-medium truncate">{isRecording ? "Stop" : "Record Call"}</p>
                </div>
 
                <label className="cursor-pointer flex flex-col items-center gap-2">
                  <input
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={handleAudioUpload}
                  />
                  <div className="rounded-full bg-primary/10 p-4 hover:bg-primary/20 transition-colors">
                    <Upload className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-[11px] font-medium truncate">Upload Audio</p>
                </label>

                <label className="cursor-pointer flex flex-col items-center gap-2">
                  <input
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={handleVideoChange}
                  />
                  <div className="rounded-full bg-primary/10 p-4 hover:bg-primary/20 transition-colors">
                    <Upload className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-[11px] font-medium truncate">Upload Video</p>
                </label>
              </div>

            </div>
          )}
        </div>

        {/* Action buttons */}
        {(imagePreview || videoPreview || audioBlob) ? (
          <div className="grid grid-cols-2 gap-3">
            <Button type="button" variant="outline" onClick={handleClear}>
              <ImagePlus className="h-4 w-4 mr-2" />
              Clear Media
            </Button>
            {videoPreview ? (
              <label>
                <input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={handleVideoChange}
                />
                <Button type="button" variant="outline" className="w-full" asChild>
                  <span>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload new video
                  </span>
                </Button>
              </label>
            ) : (
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
                    <Camera className="h-4 w-4 mr-2" />
                    Take new photo
                  </span>
                </Button>
              </label>
            )}
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
        {!videoFile && (
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
        )}

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

        {/* Tag companions */}
        <div className="space-y-2">
          <Label>Tag companions</Label>
          <div className="flex flex-wrap gap-1.5 min-h-[38px] p-2 rounded-xl border border-border bg-card">
            {taggedUserIds.length === 0 ? (
              <span className="text-xs text-muted-foreground self-center px-1">No companions tagged</span>
            ) : (
              taggedUserIds.map(id => {
                const taggedUser = allUsers.find(u => u.id === id);
                if (!taggedUser) return null;
                return (
                  <span key={id} className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs font-semibold px-2.5 py-1 rounded-full">
                    @{taggedUser.username}
                    <button
                      type="button"
                      onClick={() => setTaggedUserIds(prev => prev.filter(tid => tid !== id))}
                      className="hover:text-destructive shrink-0 font-bold ml-0.5"
                    >
                      ×
                    </button>
                  </span>
                );
              })
            )}
          </div>
          
          <div className="rounded-2xl border border-border bg-card p-3 space-y-2">
            <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground px-1">Select users to tag</p>
            <Input
              type="text"
              value={tagSearchQuery}
              onChange={(e) => setTagSearchQuery(e.target.value)}
              placeholder="Search usernames..."
              className="h-8 text-xs rounded-lg px-2.5 py-1 bg-muted/40 border-border focus-visible:ring-1 focus-visible:ring-primary"
            />
            <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
              {allUsers.length === 0 ? (
                <p className="text-xs text-muted-foreground px-1 py-1">No other users found</p>
              ) : filteredUsers.length === 0 ? (
                <p className="text-xs text-muted-foreground px-1 py-1">No users match "{tagSearchQuery}"</p>
              ) : (
                filteredUsers.map((u) => {
                  const isTagged = taggedUserIds.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        if (isTagged) {
                          setTaggedUserIds(prev => prev.filter(id => id !== u.id));
                        } else {
                          setTaggedUserIds(prev => [...prev, u.id]);
                        }
                      }}
                      className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-colors ${
                        isTagged ? "bg-primary/10 text-primary" : "hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={u.avatar_url || undefined} />
                          <AvatarFallback>{getInitials(u)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-xs font-semibold">{u.full_name || u.username}</p>
                          <p className="text-[10px] text-muted-foreground">@{u.username}</p>
                        </div>
                      </div>
                      <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                        isTagged ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30"
                      }`}>
                        {isTagged && <span className="text-[9px] font-bold">✓</span>}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <Button
          type="button"
          className="w-full"
          disabled={createPostMutation.isPending || (!imageFile && !audioBlob && !videoFile) || !speciesName.trim()}
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
