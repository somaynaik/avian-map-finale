import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getFeedPost, togglePostLike, type FeedPost } from "@/lib/social";
import { FeedCard, VideoCard } from "./FeedPage";
import { Button } from "@/components/ui/button";

const PostDetailPage = () => {
  const { postId } = useParams<{ postId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [videoMuted, setVideoMuted] = useState(false);

  const isVideoUrl = (url?: string) => {
    if (!url) return false;
    const lower = url.toLowerCase();
    return lower.includes(".mp4") || lower.includes(".mov") || lower.includes(".webm") || lower.includes("video");
  };

  const { data: post, isLoading, error } = useQuery({
    queryKey: ["post-detail", postId, user?.id],
    queryFn: () => getFeedPost(postId!, user!.id),
    enabled: !!postId && !!user?.id,
  });

  const likeMutation = useMutation({
    mutationFn: () => togglePostLike(post!.id, user!.id, post!.liked_by_me),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["post-detail", postId] });
      queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-2 bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Loading sighting...</span>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 p-4 text-center bg-background">
        <h2 className="text-xl font-bold font-display text-foreground">Sighting Not Found</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          This post could not be found or may have been deleted by the author.
        </p>
        <Button onClick={() => navigate("/feed")} className="font-semibold">
          Go to Feed
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-12">
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-xl px-4 py-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-display text-lg font-bold">Bird Sighting</h1>
      </div>
      <div className="max-w-lg mx-auto mt-4 px-0 sm:px-4">
        {isVideoUrl(post.image_url) ? (
          <div className="aspect-[9/16] h-[75vh] w-full max-w-md mx-auto relative rounded-2xl overflow-hidden shadow-lg border border-border">
            <VideoCard
              video={post}
              onToggleLike={() => likeMutation.mutate()}
              isPending={likeMutation.isPending}
              isMuted={videoMuted}
              onToggleMute={() => setVideoMuted(!videoMuted)}
            />
          </div>
        ) : (
          <div className="bg-card rounded-none sm:rounded-2xl border border-border overflow-hidden shadow-sm">
            <FeedCard
              post={post}
              index={0}
              onToggleLike={() => likeMutation.mutate()}
              isPending={likeMutation.isPending}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default PostDetailPage;
