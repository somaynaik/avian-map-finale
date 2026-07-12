import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getFeedPost, togglePostLike, type FeedPost } from "@/lib/social";
import { FeedCard, VideoCard } from "./FeedPage";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import AppLayout from "@/components/AppLayout";

const PostDetailPage = () => {
  const { postId } = useParams<{ postId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [videoMuted, setVideoMuted] = useState(false);
  const [showSignupPopup, setShowSignupPopup] = useState(false);

  const isVideoUrl = (url?: string) => {
    if (!url) return false;
    const lower = url.toLowerCase();
    return lower.includes(".mp4") || lower.includes(".mov") || lower.includes(".webm") || lower.includes("video");
  };

  const { data: post, isLoading, error } = useQuery({
    queryKey: ["post-detail", postId, user?.id],
    queryFn: () => getFeedPost(postId!, user?.id),
    enabled: !!postId,
  });

  const likeMutation = useMutation({
    mutationFn: () => {
      if (!user) {
        setShowSignupPopup(true);
        return Promise.resolve(null);
      }
      return togglePostLike(post!.id, user.id, post!.liked_by_me);
    },
    onSuccess: () => {
      if (user) {
        queryClient.invalidateQueries({ queryKey: ["post-detail", postId] });
        queryClient.invalidateQueries({ queryKey: ["feed"] });
      }
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

  const content = (
    <div className="min-h-screen bg-background pb-12">
      {/* Dynamic top banner for guest mode */}
      {!user && (
        <div className="bg-primary/10 border-b border-primary/20 px-4 py-3 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-primary">Avian Map - India's Community Atlas</p>
            <p className="text-[10px] text-muted-foreground truncate">Join thousands of bird watchers mapping sightings!</p>
          </div>
          <Button 
            size="sm" 
            onClick={() => navigate("/signup")} 
            className="text-xs font-semibold shrink-0"
          >
            Join Avian Map
          </Button>
        </div>
      )}

      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-xl px-4 py-4 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            if (user) {
              navigate(-1);
            } else {
              navigate("/feed");
            }
          }}
          className="rounded-full shrink-0"
        >
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
              onInteractionIntercept={!user ? () => setShowSignupPopup(true) : undefined}
            />
          </div>
        ) : (
          <div className="bg-card rounded-none sm:rounded-2xl border border-border overflow-hidden shadow-sm">
            <FeedCard
              post={post}
              index={0}
              onToggleLike={() => likeMutation.mutate()}
              isPending={likeMutation.isPending}
              onInteractionIntercept={!user ? () => setShowSignupPopup(true) : undefined}
            />
          </div>
        )}
      </div>

      {/* Guest Mode Call-to-action Modal */}
      <Dialog open={showSignupPopup} onOpenChange={setShowSignupPopup}>
        <DialogContent className="sm:max-w-md bg-background border-border text-center p-6">
          <DialogHeader className="flex flex-col items-center">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <Sparkles className="h-6 w-6 text-primary animate-pulse" />
            </div>
            <DialogTitle className="text-xl font-bold font-display text-foreground">Create an Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">
              Join Avian Map to like sightings, write comments, and share your own bird discoveries with the community!
            </p>
            <div className="flex flex-col gap-2.5 pt-2">
              <Button onClick={() => navigate("/signup")} className="font-semibold w-full">
                Sign up free
              </Button>
              <Button variant="outline" onClick={() => navigate("/login")} className="font-semibold w-full border-border">
                Log in to existing account
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );

  return user ? <AppLayout>{content}</AppLayout> : content;
};

export default PostDetailPage;
