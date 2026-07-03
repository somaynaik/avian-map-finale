import { useState } from "react";
import { Heart, Loader2, MapPin, MessageCircle, Share2, Send, Play, X, Bell, MoreVertical } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import {
  formatRelativeTime,
  getInitials,
  listFeedPosts,
  togglePostLike,
  listPostComments,
  createPostComment,
  listNotifications,
  listUsers,
  deletePost,
  updatePost,
  type FeedPost,
} from "@/lib/social";



const isVideoUrl = (url?: string) => {
  if (!url) return false;
  const lower = url.toLowerCase();
  return lower.includes(".mp4") || lower.includes(".mov") || lower.includes(".webm") || lower.includes("video");
};

const FeedPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"posts" | "videos">("posts");
  const [showNotifications, setShowNotifications] = useState(false);
  const [lastViewed, setLastViewed] = useState<string | null>(() =>
    localStorage.getItem(`last_viewed_notifications_${user?.id}`)
  );

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: () => listNotifications(user!.id),
    enabled: !!user?.id,
    refetchInterval: 15000,
  });

  const unreadCount = lastViewed
    ? notifications.filter((n) => new Date(n.created_at).getTime() > new Date(lastViewed).getTime()).length
    : notifications.length;

  const handleOpenNotifications = () => {
    setShowNotifications(true);
    const now = new Date().toISOString();
    localStorage.setItem(`last_viewed_notifications_${user?.id}`, now);
    setLastViewed(now);
  };

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["feed", user?.id],
    queryFn: () => listFeedPosts(user!.id),
    enabled: !!user?.id,
  });

  const imagePosts = posts.filter(post => !isVideoUrl(post.image_url));
  const videoPosts = posts.filter(post => isVideoUrl(post.image_url));

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
    <div className="min-h-screen bg-background pb-24">
      {/* Sticky Header and Tab Selector */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-xl">
        <div className="px-4 pb-3 pt-12 flex items-start justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">Avian Map</h1>
            <p className="text-sm text-muted-foreground">Unleash The Birdwatcher Within You...</p>
          </div>
          <button
            onClick={handleOpenNotifications}
            className="relative p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-full transition-colors mt-1"
          >
            <Bell className="h-6 w-6" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* Swipe Navigation Header */}
        <div className="flex border-t border-border">
          <button
            onClick={() => setActiveTab("posts")}
            className={`flex-1 py-3 text-center text-sm font-semibold border-b-2 transition-all ${
              activeTab === "posts"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Posts
          </button>
          <button
            onClick={() => setActiveTab("videos")}
            className={`flex-1 py-3 text-center text-sm font-semibold border-b-2 transition-all ${
              activeTab === "videos"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Videos
          </button>
        </div>
      </div>

      <div className="relative overflow-hidden w-full mt-2">
        <AnimatePresence mode="wait">
          {activeTab === "posts" ? (
            <motion.div
              key="posts"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.15 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.4}
              onDragEnd={(event, info) => {
                if (info.offset.x < -80) {
                  setActiveTab("videos");
                }
              }}
              className="w-full touch-pan-y"
            >
              {isLoading ? (
                <div className="flex min-h-[50vh] items-center justify-center">
                  <Loader2 className="h-7 w-7 animate-spin text-primary" />
                </div>
              ) : imagePosts.length === 0 ? (
                <div className="mx-auto max-w-lg px-4 py-12 text-center">
                  <p className="text-lg font-semibold">No posts yet</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Create the first sighting from the Camera tab to populate the live feed.
                  </p>
                </div>
              ) : (
                <div className="mx-auto max-w-lg">
                  {imagePosts.map((post, index) => (
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
            </motion.div>
          ) : (
            <motion.div
              key="videos"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.15 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.4}
              onDragEnd={(event, info) => {
                if (info.offset.x > 80) {
                  setActiveTab("posts");
                }
              }}
              className="w-full"
            >
              <div className="mx-auto max-w-md px-2">
                {videoPosts.length === 0 ? (
                  <div className="px-4 py-12 text-center">
                    <p className="text-lg font-semibold">No videos yet</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Upload video sightings from the Camera tab to populate this feed.
                    </p>
                  </div>
                ) : (
                  <div className="h-[calc(100vh-220px)] overflow-y-scroll snap-y snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] flex flex-col gap-4 rounded-2xl pb-6">
                    {videoPosts.map((video) => (
                      <VideoCard
                        key={video.id}
                        video={video}
                        onToggleLike={() =>
                          likeMutation.mutate({ postId: video.id, liked: video.liked_by_me })
                        }
                        isPending={likeMutation.isPending}
                      />
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Notifications Drawer */}
      <AnimatePresence>
        {showNotifications && (
          <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNotifications(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            
            {/* Drawer Content */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 250 }}
              className="relative w-full max-w-md h-full bg-background border-l border-border flex flex-col z-10 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-border p-4">
                <div className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-primary" />
                  <h2 className="font-display text-lg font-bold">Notifications</h2>
                </div>
                <button
                  onClick={() => setShowNotifications(false)}
                  className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-border [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full p-8 text-center text-muted-foreground">
                    <Bell className="h-12 w-12 opacity-25 mb-3" />
                    <p className="text-sm font-semibold">All quiet here</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      We'll let you know when someone interacts with your posts or profile.
                    </p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div 
                      key={n.id} 
                      className="p-4 flex gap-3 hover:bg-muted/40 transition-colors text-left animate-in fade-in duration-200"
                    >
                      <Avatar 
                        className="h-10 w-10 border border-border cursor-pointer shrink-0"
                        onClick={() => {
                          setShowNotifications(false);
                          navigate(`/users/${n.actor_id}`);
                        }}
                      >
                        <AvatarImage src={n.actor_avatar_url || undefined} />
                        <AvatarFallback>{n.actor_username ? n.actor_username[0].toUpperCase() : "U"}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0 text-sm">
                        <p className="leading-snug text-foreground">
                          <span 
                            onClick={() => {
                              setShowNotifications(false);
                              navigate(`/users/${n.actor_id}`);
                            }}
                            className="font-bold hover:underline cursor-pointer"
                          >
                            @{n.actor_username}
                          </span>{" "}
                          {n.type === "follow" && "started following you"}
                          {n.type === "like" && (
                            <>
                              liked your observation{" "}
                              <span className="font-semibold text-primary">
                                {n.post_species_name || "sighting"}
                              </span>
                            </>
                          )}
                          {n.type === "comment" && (
                            <>
                              commented on your sighting{" "}
                              <span className="font-semibold text-primary">
                                {n.post_species_name || "sighting"}
                              </span>
                              : <span className="text-muted-foreground italic">"{n.body}"</span>
                            </>
                          )}
                        </p>
                        <span className="text-[10px] text-muted-foreground block mt-1">
                          {formatRelativeTime(n.created_at)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
export const FeedCard = ({
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isAuthor = user?.id === post.author_id;
  const authorName = post.author?.full_name || post.author?.username || "Unknown birder";
  const [showComments, setShowComments] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [editSpecies, setEditSpecies] = useState(post.species_name);
  const [editLocation, setEditLocation] = useState(post.location_name || "");
  const [editNote, setEditNote] = useState(post.note || "");
  const [editTaggedUserIds, setEditTaggedUserIds] = useState<string[]>(
    post.tagged_profiles?.map(p => p.id) || []
  );

  const { data: allUsers = [] } = useQuery({
    queryKey: ["all-users-to-tag-edit", user?.id],
    queryFn: () => listUsers(user!.id, ""),
    enabled: !!user?.id && isEditing,
  });

  const deleteMutation = useMutation({
    mutationFn: () => deletePost(post.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      queryClient.invalidateQueries({ queryKey: ["profile-posts"] });
      queryClient.invalidateQueries({ queryKey: ["profile-tagged-posts"] });
      toast({
        title: "Post deleted",
        description: "Your sighting has been removed successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Could not delete post",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const editMutation = useMutation({
    mutationFn: () => {
      const notePayload = JSON.stringify({ body: editNote, tags: editTaggedUserIds });
      return updatePost(post.id, {
        species_name: editSpecies,
        location_name: editLocation,
        note: notePayload,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      queryClient.invalidateQueries({ queryKey: ["profile-posts"] });
      queryClient.invalidateQueries({ queryKey: ["profile-tagged-posts"] });
      setIsEditing(false);
      toast({
        title: "Post updated",
        description: "Your sighting details have been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Could not update post",
        description: error.message,
        variant: "destructive",
      });
    },
  });

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
          {post.location_name && (
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
              <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="truncate">{post.location_name}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">{formatRelativeTime(post.created_at)}</span>
          {isAuthor && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full shrink-0">
                  <MoreVertical className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-background border border-border">
                <DropdownMenuItem onClick={() => setIsEditing(true)} className="cursor-pointer">
                  Edit post
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending} className="cursor-pointer text-destructive focus:text-destructive font-medium">
                  Delete post
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <div className="relative aspect-[4/3] overflow-hidden bg-muted flex items-center justify-center">
        {isVideoUrl(post.image_url) ? (
          <video src={post.image_url} controls playsInline className="h-full w-full object-cover" />
        ) : (
          <img src={post.image_url} alt={post.species_name} className="h-full w-full object-cover" />
        )}
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

        {post.tagged_profiles && post.tagged_profiles.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground mt-1">
            <span className="font-semibold text-muted-foreground/80">Tagged:</span>
            {post.tagged_profiles.map((p, idx) => (
              <span
                key={p.id}
                onClick={() => navigate(`/users/${p.id}`)}
                className="text-primary hover:underline cursor-pointer font-medium"
              >
                @{p.username}
                {idx < post.tagged_profiles.length - 1 ? ", " : ""}
              </span>
            ))}
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

      {/* Edit Post Sighting Modal */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="max-w-md bg-background border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit sighting details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 text-left">
            <div className="space-y-2">
              <Label htmlFor="edit-species-name">Species name</Label>
              <Input
                id="edit-species-name"
                value={editSpecies}
                onChange={(event) => setEditSpecies(event.target.value)}
                placeholder="Example: Indian Peafowl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-location-name">Location</Label>
              <Input
                id="edit-location-name"
                value={editLocation}
                onChange={(event) => setEditLocation(event.target.value)}
                placeholder="Where did you see it?"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-note">Notes</Label>
              <Textarea
                id="edit-note"
                value={editNote}
                onChange={(event) => setEditNote(event.target.value)}
                placeholder="Add context about the sighting"
              />
            </div>

            {/* Tag companions */}
            <div className="space-y-2">
              <Label>Tag companions</Label>
              <div className="flex flex-wrap gap-1.5 min-h-[38px] p-2 rounded-xl border border-border bg-card">
                {editTaggedUserIds.length === 0 ? (
                  <span className="text-xs text-muted-foreground self-center px-1">No companions tagged</span>
                ) : (
                  editTaggedUserIds.map(id => {
                    const taggedUser = allUsers.find(u => u.id === id);
                    if (!taggedUser) return null;
                    return (
                      <span key={id} className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs font-semibold px-2.5 py-1 rounded-full">
                        @{taggedUser.username}
                        <button
                          type="button"
                          onClick={() => setEditTaggedUserIds(prev => prev.filter(tid => tid !== id))}
                          className="hover:text-destructive shrink-0 font-bold ml-0.5"
                        >
                          ×
                        </button>
                      </span>
                    );
                  })
                )}
              </div>
              
              <div className="rounded-2xl border border-border bg-card p-3 max-h-48 overflow-y-auto space-y-2">
                <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground px-1">Select users to tag</p>
                {allUsers.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-1">No other users found</p>
                ) : (
                  <div className="space-y-1">
                    {allUsers.map((u) => {
                      const isTagged = editTaggedUserIds.includes(u.id);
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => {
                            if (isTagged) {
                              setEditTaggedUserIds(prev => prev.filter(id => id !== u.id));
                            } else {
                              setEditTaggedUserIds(prev => [...prev, u.id]);
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
                    })}
                  </div>
                )}
              </div>
            </div>

            <Button
              type="button"
              className="w-full mt-4"
              disabled={editMutation.isPending || !editSpecies.trim()}
              onClick={() => editMutation.mutate()}
            >
              {editMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving changes...
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.article>
  );
};

export const VideoCard = ({
  video,
  onToggleLike,
  isPending,
}: {
  video: any;
  onToggleLike: () => void;
  isPending: boolean;
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isAuthor = user?.id === video.author_id;
  const authorName = video.author?.full_name || video.author?.username || "Unknown birder";
  const [showComments, setShowComments] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [editSpecies, setEditSpecies] = useState(video.species_name);
  const [editLocation, setEditLocation] = useState(video.location_name || "");
  const [editNote, setEditNote] = useState(video.note || "");
  const [editTaggedUserIds, setEditTaggedUserIds] = useState<string[]>(
    video.tagged_profiles?.map((p: any) => p.id) || []
  );

  const { data: allUsers = [] } = useQuery({
    queryKey: ["all-users-to-tag-edit-video", user?.id],
    queryFn: () => listUsers(user!.id, ""),
    enabled: !!user?.id && isEditing,
  });

  const deleteMutation = useMutation({
    mutationFn: () => deletePost(video.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      queryClient.invalidateQueries({ queryKey: ["profile-posts"] });
      queryClient.invalidateQueries({ queryKey: ["profile-tagged-posts"] });
      toast({
        title: "Video deleted",
        description: "Your video sighting has been removed successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Could not delete video",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const editMutation = useMutation({
    mutationFn: () => {
      const notePayload = JSON.stringify({ body: editNote, tags: editTaggedUserIds });
      return updatePost(video.id, {
        species_name: editSpecies,
        location_name: editLocation,
        note: notePayload,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      queryClient.invalidateQueries({ queryKey: ["profile-posts"] });
      queryClient.invalidateQueries({ queryKey: ["profile-tagged-posts"] });
      setIsEditing(false);
      toast({
        title: "Video updated",
        description: "Your video details have been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Could not update video",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="snap-start shrink-0 h-full w-full relative flex items-center justify-center bg-black overflow-hidden rounded-2xl border border-border">
      {/* Video Player */}
      <video
        src={video.video_url || video.image_url}
        controls
        playsInline
        loop
        className="h-full w-full object-contain bg-black"
      />

      {/* Gradient Overlay for Readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none z-10" />

      {/* Right Sidebar Actions */}
      <div className="absolute right-4 bottom-20 flex flex-col items-center gap-6 z-20 text-white">
        {/* Profile Avatar */}
        <div
          className="cursor-pointer group flex flex-col items-center"
          onClick={() => navigate(`/users/${video.author_id}`)}
        >
          <Avatar className="h-10 w-10 border-2 border-white shadow-lg transition-transform group-hover:scale-105">
            <AvatarImage src={video.author?.avatar_url || undefined} alt={authorName} />
            <AvatarFallback className="text-black bg-white">{getInitials(video.author)}</AvatarFallback>
          </Avatar>
        </div>

        {/* Like Button */}
        <div className="flex flex-col items-center">
          <button
            onClick={onToggleLike}
            disabled={isPending}
            className={`p-3 rounded-full bg-black/40 hover:bg-black/60 transition-colors shadow-md backdrop-blur-sm ${
              video.liked_by_me ? "text-destructive" : "text-white"
            }`}
          >
            <Heart className={`h-6 w-6 ${video.liked_by_me ? "fill-current" : ""}`} />
          </button>
          <span className="text-[11px] font-bold mt-1 drop-shadow-md">{video.likes_count}</span>
        </div>

        {/* Comment Button */}
        <div className="flex flex-col items-center">
          <button
            onClick={() => setShowComments(!showComments)}
            className={`p-3 rounded-full bg-black/40 hover:bg-black/60 transition-colors shadow-md backdrop-blur-sm ${
              showComments ? "text-primary" : "text-white"
            }`}
          >
            <MessageCircle className="h-6 w-6" />
          </button>
          <span className="text-[11px] font-bold mt-1 drop-shadow-md">Comment</span>
        </div>

        {/* Share Button */}
        <div className="flex flex-col items-center">
          <button
            onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}/posts/${video.id}`);
              toast({
                title: "Link copied!",
                description: "Sighting link copied to clipboard.",
              });
            }}
            className="p-3 rounded-full bg-black/40 hover:bg-black/60 transition-colors shadow-md backdrop-blur-sm text-white"
          >
            <Share2 className="h-6 w-6" />
          </button>
          <span className="text-[11px] font-bold mt-1 drop-shadow-md">Share</span>
        </div>

        {/* Three dot options for author in VideoCard */}
        {isAuthor && (
          <div className="flex flex-col items-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-3 rounded-full bg-black/40 hover:bg-black/60 transition-colors shadow-md backdrop-blur-sm text-white">
                  <MoreVertical className="h-6 w-6" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-background border border-border">
                <DropdownMenuItem onClick={() => setIsEditing(true)} className="cursor-pointer">
                  Edit post
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending} className="cursor-pointer text-destructive focus:text-destructive font-medium">
                  Delete post
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <span className="text-[11px] font-bold mt-1 drop-shadow-md">More</span>
          </div>
        )}
      </div>

      {/* Bottom Info Overlay */}
      <div className="absolute left-4 bottom-4 right-16 flex flex-col gap-1.5 z-20 text-white text-left drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] pointer-events-auto">
        {/* Author Details */}
        <div className="flex items-center gap-2">
          <span
            onClick={() => navigate(`/users/${video.author_id}`)}
            className="font-bold hover:underline cursor-pointer text-sm sm:text-base"
          >
            @{video.author?.username || "user"}
          </span>
          <span className="text-xs opacity-75">•</span>
          <span className="text-xs opacity-75">{formatRelativeTime(video.created_at)}</span>
        </div>

        {/* Location Pin */}
        {video.location_name && (
          <div className="flex items-center gap-1 text-xs opacity-90">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-primary fill-current" />
            <span className="truncate">{video.location_name}</span>
          </div>
        )}

        {/* Species Name Badge */}
        <div className="inline-flex items-center gap-1.5 bg-primary/90 text-primary-foreground text-xs font-bold px-2.5 py-1 rounded-full w-fit">
          <Play className="h-3 w-3 fill-current" />
          {video.species_name}
        </div>

        {/* Note */}
        {video.note && (
          <p className="text-xs sm:text-sm line-clamp-2 leading-relaxed opacity-95">
            {video.note}
          </p>
        )}

        {/* Tagged companions */}
        {video.tagged_profiles && video.tagged_profiles.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 text-[11px] opacity-90 font-semibold">
            <span>Tagged:</span>
            {video.tagged_profiles.map((p, idx) => (
              <span
                key={p.id}
                onClick={() => navigate(`/users/${p.id}`)}
                className="text-primary hover:underline cursor-pointer font-medium ml-0.5"
              >
                @{p.username}
                {idx < video.tagged_profiles.length - 1 ? ", " : ""}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Slide-up Comments Drawer */}
      <AnimatePresence>
        {showComments && (
          <div className="absolute inset-0 bg-background/95 backdrop-blur-md z-30 flex flex-col rounded-2xl animate-in slide-in-from-bottom duration-300 text-foreground">
            <div className="flex items-center justify-between border-b border-border p-3">
              <h3 className="font-bold text-sm">Comments</h3>
              <button
                onClick={() => setShowComments(false)}
                className="p-1 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <CommentsSection postId={video.id} />
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Video Sighting Modal */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="max-w-md bg-background border-border max-h-[90vh] overflow-y-auto text-foreground">
          <DialogHeader>
            <DialogTitle>Edit video details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 text-left">
            <div className="space-y-2">
              <Label htmlFor="edit-video-species-name">Species name</Label>
              <Input
                id="edit-video-species-name"
                value={editSpecies}
                onChange={(event) => setEditSpecies(event.target.value)}
                placeholder="Example: Indian Peafowl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-video-location-name">Location</Label>
              <Input
                id="edit-video-location-name"
                value={editLocation}
                onChange={(event) => setEditLocation(event.target.value)}
                placeholder="Where did you see it?"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-video-note">Notes</Label>
              <Textarea
                id="edit-video-note"
                value={editNote}
                onChange={(event) => setEditNote(event.target.value)}
                placeholder="Add context about the sighting"
              />
            </div>

            {/* Tag companions */}
            <div className="space-y-2">
              <Label>Tag companions</Label>
              <div className="flex flex-wrap gap-1.5 min-h-[38px] p-2 rounded-xl border border-border bg-card">
                {editTaggedUserIds.length === 0 ? (
                  <span className="text-xs text-muted-foreground self-center px-1">No companions tagged</span>
                ) : (
                  editTaggedUserIds.map(id => {
                    const taggedUser = allUsers.find(u => u.id === id);
                    if (!taggedUser) return null;
                    return (
                      <span key={id} className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs font-semibold px-2.5 py-1 rounded-full">
                        @{taggedUser.username}
                        <button
                          type="button"
                          onClick={() => setEditTaggedUserIds(prev => prev.filter(tid => tid !== id))}
                          className="hover:text-destructive shrink-0 font-bold ml-0.5"
                        >
                          ×
                        </button>
                      </span>
                    );
                  })
                )}
              </div>
              
              <div className="rounded-2xl border border-border bg-card p-3 max-h-48 overflow-y-auto space-y-2">
                <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground px-1">Select users to tag</p>
                {allUsers.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-1">No other users found</p>
                ) : (
                  <div className="space-y-1">
                    {allUsers.map((u) => {
                      const isTagged = editTaggedUserIds.includes(u.id);
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => {
                            if (isTagged) {
                              setEditTaggedUserIds(prev => prev.filter(id => id !== u.id));
                            } else {
                              setEditTaggedUserIds(prev => [...prev, u.id]);
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
                    })}
                  </div>
                )}
              </div>
            </div>

            <Button
              type="button"
              className="w-full mt-4"
              disabled={editMutation.isPending || !editSpecies.trim()}
              onClick={() => editMutation.mutate()}
            >
              {editMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving changes...
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const CommentsSection = ({ postId }: { postId: string }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState("");
  const isMock = postId.startsWith("video-");

  const [mockComments, setMockComments] = useState<any[]>(() => {
    if (isMock) {
      return [
        {
          id: `comment-mock-1`,
          author: { username: "birding_pro" },
          body: "Wow, magnificent video! The resolution is stellar.",
          created_at: new Date(Date.now() - 1800000).toISOString(),
        },
      ];
    }
    return [];
  });

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["comments", postId],
    queryFn: () => listPostComments(postId),
    enabled: !isMock,
  });

  const activeComments = isMock ? mockComments : comments;

  const commentMutation = useMutation({
    mutationFn: async (body: string) => {
      if (isMock) {
        setMockComments((prev) => [
          ...prev,
          {
            id: `comment-mock-${Date.now()}`,
            author: { username: user?.email?.split("@")[0] || "me" },
            body: body,
            created_at: new Date().toISOString(),
          },
        ]);
        return;
      }
      return createPostComment(postId, user!.id, body);
    },
    onSuccess: () => {
      setNewComment("");
      if (!isMock) {
        queryClient.invalidateQueries({ queryKey: ["comments", postId] });
      }
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
      {isLoading && !isMock ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : activeComments.length === 0 ? (
        <p className="py-3 text-center text-sm text-muted-foreground">No comments yet. Be the first!</p>
      ) : (
        <div className="space-y-4">
          {activeComments.map((comment) => (
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
