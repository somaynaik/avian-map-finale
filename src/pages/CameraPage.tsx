import { ChangeEvent, useEffect, useRef, useState } from "react";
import { ArrowLeft, Camera, ImagePlus, Loader2, RefreshCcw, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraTimeoutRef = useRef<number | null>(null);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [speciesName, setSpeciesName] = useState("");
  const [locationName, setLocationName] = useState("");
  const [note, setNote] = useState("");
  const [predictedSpecies, setPredictedSpecies] = useState<string | null>(null);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

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
    return () => {
      if (cameraTimeoutRef.current) {
        window.clearTimeout(cameraTimeoutRef.current);
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  const startCamera = async () => {
    if (cameraStarting || cameraEnabled) return;

    setCameraStarting(true);
    setCameraError(null);
    setCameraEnabled(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });

      streamRef.current = stream;
      setCameraEnabled(true);
      setCameraStarting(false);

      if (cameraTimeoutRef.current) {
        window.clearTimeout(cameraTimeoutRef.current);
      }

      cameraTimeoutRef.current = window.setTimeout(() => {
        if (!videoRef.current?.videoWidth) {
          setCameraStarting(false);
          setCameraError("Camera startup is slow on this device. You can still upload a photo instantly.");
        }
      }, 4000);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch((error) => {
          console.error("Video playback did not start automatically", error);
        });
      }
    } catch (error) {
      console.error("Could not access camera", error);
      setCameraStarting(false);
      setCameraEnabled(false);
      setCameraError("Could not access the camera. Use Upload instead or allow camera permission.");
    }
  };

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
        throw new Error("Capture or upload an image before posting.");
      }

      const imageUrl = await uploadPostImage(user!.id, imageFile);
      return createPost({
        author_id: user!.id,
        species_name: speciesName,
        location_name: locationName,
        note,
        image_url: imageUrl,
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

  const handleCapture = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) {
      return;
    }

    const width = video.videoWidth;
    const height = video.videoHeight;

    if (!width || !height) {
      toast({
        title: "Camera not ready",
        description: "Wait for the live preview before capturing.",
        variant: "destructive",
      });
      return;
    }

    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.drawImage(video, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92),
    );

    if (!blob) {
      toast({
        title: "Capture failed",
        description: "The camera frame could not be converted into an image.",
        variant: "destructive",
      });
      return;
    }

    const file = new File([blob], `capture-${Date.now()}.jpg`, { type: "image/jpeg" });
    setImageFile(file);
    setPredictedSpecies(null);
    classifyMutation.mutate(file);
  };

  const handleRetake = () => {
    setImageFile(null);
    setPredictedSpecies(null);
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
              Capture a frame, run your local bird model, then publish the sighting
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-lg space-y-4 px-4 pt-4">
        <div className="overflow-hidden rounded-3xl border border-border bg-card">
          {imagePreview ? (
            <img src={imagePreview} alt="Captured bird" className="aspect-[4/5] w-full object-cover" />
          ) : cameraEnabled ? (
            <div className="relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                onLoadedMetadata={() => setCameraStarting(false)}
                onCanPlay={() => setCameraStarting(false)}
                onPlaying={() => setCameraStarting(false)}
                className="aspect-[4/5] w-full bg-black object-cover"
              />
              {cameraStarting && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-sm text-white">
                  Starting camera...
                </div>
              )}
            </div>
          ) : (
            <div className="flex aspect-[4/5] flex-col items-center justify-center gap-3 text-center">
              <Camera className="h-10 w-10 text-muted-foreground" />
              <div>
                <p className="font-medium">Camera optional</p>
                <p className="text-sm text-muted-foreground">
                  Start the live camera only if you need it. Upload works immediately.
                </p>
              </div>
            </div>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />

        {cameraError && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {cameraError}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Button
            type="button"
            variant={imagePreview ? "outline" : "default"}
            onClick={imagePreview ? handleRetake : cameraEnabled ? handleCapture : startCamera}
            disabled={classifyMutation.isPending || cameraStarting}
          >
            {imagePreview ? (
              <>
                <RefreshCcw className="h-4 w-4" />
                Retake
              </>
            ) : cameraEnabled ? (
              <>
                <Camera className="h-4 w-4" />
                Capture
              </>
            ) : (
              <>
                <Camera className="h-4 w-4" />
                {cameraError ? "Retry camera" : cameraStarting ? "Starting..." : "Start camera"}
              </>
            )}
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
                <ImagePlus className="h-4 w-4" />
                Upload
              </span>
            </Button>
          </label>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Model prediction</p>
              <p className="text-xs text-muted-foreground">{CLASSIFIER_URL}/classify-image</p>
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
                Capture or upload an image to classify it with your local model.
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
