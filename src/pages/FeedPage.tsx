import { useState } from "react";
import { Heart, Loader2, MapPin, MessageCircle, Share2, Send } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { formatRelativeTime, getInitials, listFeedPosts, togglePostLike, listPostComments, createPostComment, type FeedPost } from "@/lib/social";

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
  const { user } = useAuth();
  const authorName = post.author?.full_name || post.author?.username || "Unknown birder";
  const [showComments, setShowComments] = useState(false);

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
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowComments(!showComments)}
            className="px-0"
          >
            <MessageCircle className={`h-4 w-4 ${showComments ? "text-primary" : "text-muted-foreground"}`} />
            <span>Comment</span>
          </Button>
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

      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <CommentsSection postId={post.id} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
};

const CommentsSection = ({ postId }: { postId: string }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState("");

  const { data: comments, isLoading } = useQuery({
    queryKey: ["comments", postId],
    queryFn: () => listPostComments(postId),
  });

  const commentMutation = useMutation({
    mutationFn: (body: string) => createPostComment(postId, user!.id, body),
    onSuccess: () => {
      setNewComment("");
      queryClient.invalidateQueries({ queryKey: ["comments", postId] });
    },
    onError: (error: Error) => {
      toast({
        title: "Could not post comment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    commentMutation.mutate(newComment);
  };

  return (
    <div className="border-t border-border bg-muted/20 px-4 py-4">
      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : comments?.length === 0 ? (
        <p className="py-3 text-center text-sm text-muted-foreground">No comments yet. Be the first!</p>
      ) : (
        <div className="space-y-4">
          {comments?.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={comment.author?.avatar_url || undefined} />
                <AvatarFallback>{getInitials(comment.author)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 rounded-2xl rounded-tl-none bg-muted/50 px-4 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{comment.author?.username || "User"}</p>
                  <span className="text-xs text-muted-foreground">{formatRelativeTime(comment.created_at)}</span>
                </div>
                <p className="mt-1 text-sm">{comment.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-4 flex items-center gap-2">
        <Input
          placeholder="Add a comment..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          disabled={commentMutation.isPending}
          className="rounded-full bg-background"
        />
        <Button
          type="submit"
          size="icon"
          disabled={!newComment.trim() || commentMutation.isPending}
          className="shrink-0 rounded-full"
        >
          {commentMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
    </div>
  );
};

export default FeedPage;
