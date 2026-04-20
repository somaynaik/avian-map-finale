import { Heart, Loader2, MapPin, MessageCircle, Share2 } from "lucide-react";
import { motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { formatRelativeTime, getInitials, listFeedPosts, togglePostLike, type FeedPost } from "@/lib/social";

const FeedPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["feed", user?.id],
    queryFn: () => listFeedPosts(user!.id),
    enabled: !!user?.id,
  });

  const likeMutation = useMutation({
    mutationFn: ({ postId, liked }: { postId: string; liked: boolean }) =>
      togglePostLike(postId, user!.id, liked),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feed", user?.id] });
    },
    onError: (error: Error) => {
      toast({
        title: "Could not update like",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 border-b border-border bg-background/80 px-4 pb-3 pt-12 backdrop-blur-xl">
        <h1 className="font-display text-2xl font-bold">Feed</h1>
        <p className="text-sm text-muted-foreground">Recent posts from actual platform users</p>
      </div>

      {isLoading ? (
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      ) : posts.length === 0 ? (
        <div className="mx-auto max-w-lg px-4 py-12 text-center">
          <p className="text-lg font-semibold">No posts yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Create the first sighting from the Camera tab to populate the live feed.
          </p>
        </div>
      ) : (
        <div className="mx-auto max-w-lg">
          {posts.map((post, index) => (
            <FeedCard
              key={post.id}
              post={post}
              index={index}
              onToggleLike={() =>
                likeMutation.mutate({ postId: post.id, liked: post.liked_by_me })
              }
              isPending={likeMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const FeedCard = ({
  post,
  index,
  onToggleLike,
  isPending,
}: {
  post: FeedPost;
  index: number;
  onToggleLike: () => void;
  isPending: boolean;
}) => {
  const authorName = post.author?.full_name || post.author?.username || "Unknown birder";

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="border-b border-border"
    >
      <div className="flex items-center gap-3 px-4 pb-3 pt-4">
        <Avatar className="h-11 w-11 border border-border">
          <AvatarImage src={post.author?.avatar_url || undefined} alt={authorName} />
          <AvatarFallback>{getInitials(post.author)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{authorName}</p>
          <p className="truncate text-xs text-muted-foreground">@{post.author?.username || "user"}</p>
        </div>
        <span className="text-xs text-muted-foreground">{formatRelativeTime(post.created_at)}</span>
      </div>

      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <img src={post.image_url} alt={post.species_name} className="h-full w-full object-cover" />
        <div className="absolute left-3 top-3 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
          {post.species_name}
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isPending}
            onClick={onToggleLike}
            className="px-0"
          >
            <Heart
              className={post.liked_by_me ? "fill-destructive text-destructive" : ""}
            />
            <span>{post.likes_count}</span>
          </Button>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MessageCircle className="h-4 w-4" />
            <span>Direct messages live in the Messages tab</span>
          </div>
          <Share2 className="ml-auto h-4 w-4 text-muted-foreground" />
        </div>

        {post.note && <p className="text-sm leading-6">{post.note}</p>}

        {post.location_name && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            <span>{post.location_name}</span>
          </div>
        )}
      </div>
    </motion.article>
  );
};

export default FeedPage;
