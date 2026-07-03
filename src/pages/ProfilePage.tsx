import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { Camera, Loader2, LogOut, Save, Settings, X, ChevronDown, LayoutGrid, Play, Contact } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { FollowListDialog } from "@/components/FollowListDialog";
import { toast } from "@/hooks/use-toast";
import {
  formatRelativeTime,
  getInitials,
  getProfile,
  getProfileStats,
  getRecentPostsForUser,
  listUsers,
  followUser,
  updateProfile,
  uploadAvatar,
  getPostsTaggedUser,
  togglePostLike,
  type FeedPost,
} from "@/lib/social";
import { FeedCard, VideoCard } from "./FeedPage";

const ProfilePage = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [followListType, setFollowListType] = useState<"followers" | "following" | null>(null);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isDiscoverCollapsed, setIsDiscoverCollapsed] = useState(false);
  const [dismissedUserIds, setDismissedUserIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"posts" | "videos" | "contacts">("posts");

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => getProfile(user!.id),
    enabled: !!user?.id,
  });

  const { data: stats } = useQuery({
    queryKey: ["profile-stats", user?.id],
    queryFn: () => getProfileStats(user!.id),
    enabled: !!user?.id,
  });

  const { data: recentPosts = [] } = useQuery({
    queryKey: ["profile-posts", user?.id],
    queryFn: () => getRecentPostsForUser(user!.id),
    enabled: !!user?.id,
  });

  const { data: taggedPosts = [] } = useQuery({
    queryKey: ["profile-tagged-posts", user?.id],
    queryFn: () => getPostsTaggedUser(user!.id),
    enabled: !!user?.id,
  });

  const [selectedPost, setSelectedPost] = useState<FeedPost | null>(null);

  const likeMutation = useMutation({
    mutationFn: ({ postId, liked }: { postId: string; liked: boolean }) =>
      togglePostLike(postId, user!.id, liked),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile-posts", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["profile-tagged-posts", user?.id] });
      if (selectedPost) {
        setSelectedPost((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            liked_by_me: !prev.liked_by_me,
            likes_count: prev.liked_by_me ? prev.likes_count - 1 : prev.likes_count + 1,
          };
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Could not update like",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const isVideoUrl = (url?: string) => {
    if (!url) return false;
    const lower = url.toLowerCase();
    return lower.includes(".mp4") || lower.includes(".mov") || lower.includes(".webm") || lower.includes("video");
  };

  const userImagePosts = recentPosts.filter((post) => !isVideoUrl(post.image_url));
  const userVideoPosts = recentPosts.filter((post) => isVideoUrl(post.image_url));

  const { data: discoverUsersRaw = [] } = useQuery({
    queryKey: ["discover-users", user?.id],
    queryFn: () => listUsers(user!.id, ""),
    enabled: !!user?.id,
  });

  const followMutation = useMutation({
    mutationFn: (targetUserId: string) => followUser(user!.id, targetUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discover-users", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["profile-stats", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["users", user?.id] });
      toast({
        title: "Following user",
        description: "You are now following this user.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Could not follow user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDismissUser = (userId: string) => {
    setDismissedUserIds((prev) => [...prev, userId]);
  };

  const discoverUsers = useMemo(() => {
    return discoverUsersRaw.filter(
      (u) => !u.is_following && !dismissedUserIds.includes(u.id)
    );
  }, [discoverUsersRaw, dismissedUserIds]);

  useEffect(() => {
    if (!profile) return;
    setUsername(profile.username || "");
    setFullName(profile.full_name || "");
    setBio(profile.bio || "");
  }, [profile]);

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreview(null);
      return;
    }

    const objectUrl = URL.createObjectURL(avatarFile);
    setAvatarPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [avatarFile]);

  const activeAvatar = useMemo(
    () => avatarPreview || profile?.avatar_url || undefined,
    [avatarPreview, profile?.avatar_url],
  );

  const handleOpenChange = (open: boolean) => {
    setIsEditProfileOpen(open);
    if (!open) {
      if (profile) {
        setUsername(profile.username || "");
        setFullName(profile.full_name || "");
        setBio(profile.bio || "");
      }
      setAvatarFile(null);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      let avatarUrl = profile?.avatar_url || null;
      if (avatarFile) {
        avatarUrl = await uploadAvatar(user!.id, avatarFile);
      }

      return updateProfile(user!.id, {
        username,
        full_name: fullName,
        bio,
        avatar_url: avatarUrl,
      });
    },
    onSuccess: () => {
      setAvatarFile(null);
      queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["users", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["feed", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["conversations", user?.id] });
      toast({
        title: "Profile updated",
        description: "Your account details have been successfully saved.",
      });
      setIsEditProfileOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Could not save profile",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    setAvatarFile(event.target.files?.[0] || null);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="border-b border-border bg-gradient-to-b from-primary/10 to-background px-4 pb-8 pt-12">
        <div className="mx-auto max-w-lg">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
            </div>
          ) : (
            <div className="flex flex-col items-center text-center">
              <Avatar className="h-28 w-28 border-4 border-background shadow-sm">
                <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.username || "User"} />
                <AvatarFallback className="text-2xl font-semibold">
                  {getInitials(profile)}
                </AvatarFallback>
              </Avatar>

              <div className="mt-4 flex items-center justify-center gap-2">
                <h1 className="font-display text-2xl font-bold">
                  {profile?.full_name || profile?.username || "Your profile"}
                </h1>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground group"
                  onClick={() => setIsEditProfileOpen(true)}
                  aria-label="Edit Profile"
                >
                  <Settings className="h-5 w-5 transition-transform duration-500 group-hover:rotate-90" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">{user?.email}</p>

              {profile?.bio && (
                <p className="mt-3 max-w-sm text-sm text-muted-foreground italic">
                  "{profile.bio}"
                </p>
              )}

              <div className="mt-6 grid w-full grid-cols-3 gap-3">
                <ProfileStat label="Posts" value={stats?.post_count || 0} />
                <button type="button" onClick={() => setFollowListType("followers")} className="transition-opacity hover:opacity-70 text-left">
                  <ProfileStat label="Followers" value={stats?.follower_count || 0} />
                </button>
                <button type="button" onClick={() => setFollowListType("following")} className="transition-opacity hover:opacity-70 text-left">
                  <ProfileStat label="Following" value={stats?.following_count || 0} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-lg space-y-5 px-4 pt-4">
        {/* Discover People suggestions */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1">
              <h2 className="font-display text-sm font-semibold text-foreground">Discover people</h2>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground">
                    <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isDiscoverCollapsed ? "-rotate-90" : ""}`} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-44">
                  <DropdownMenuItem onClick={() => setIsDiscoverCollapsed(!isDiscoverCollapsed)}>
                    {isDiscoverCollapsed ? "Show suggestions" : "Collapse suggestions"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/dashboard")}>
                    Search directory
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <button
              onClick={() => navigate("/dashboard")}
              className="text-xs font-semibold text-primary hover:underline"
            >
              See all
            </button>
          </div>

          {!isDiscoverCollapsed && (
            discoverUsers.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border py-8 px-4 text-center text-sm text-muted-foreground bg-card">
                No new suggestions found.
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory">
                {discoverUsers.map((u) => (
                  <div
                    key={u.id}
                    className="snap-start flex-shrink-0 w-36 bg-card border border-border rounded-xl p-3.5 flex flex-col items-center relative text-center shadow-sm"
                  >
                    <button
                      onClick={() => handleDismissUser(u.id)}
                      className="absolute top-2 right-2 text-muted-foreground hover:text-foreground rounded-full p-0.5 hover:bg-muted transition-colors"
                      aria-label="Dismiss suggestion"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    
                    <button
                      onClick={() => navigate(`/users/${u.id}`)}
                      className="flex flex-col items-center w-full text-center focus:outline-none transition-opacity hover:opacity-85"
                    >
                      <Avatar className="h-16 w-16 mb-2 mt-1 border border-border">
                        <AvatarImage src={u.avatar_url || undefined} alt={u.username} />
                        <AvatarFallback className="text-sm font-semibold">
                          {getInitials(u)}
                        </AvatarFallback>
                      </Avatar>

                      <p className="font-semibold text-sm truncate w-full mb-0.5" title={u.full_name || u.username}>
                        {u.full_name || u.username}
                      </p>
                      <p className="text-xs text-muted-foreground truncate w-full mb-4">
                        @{u.username}
                      </p>
                    </button>

                    <Button
                      size="sm"
                      className="w-full text-xs h-7 mt-auto bg-primary text-primary-foreground font-semibold hover:bg-primary/95"
                      disabled={followMutation.isPending}
                      onClick={() => followMutation.mutate(u.id)}
                    >
                      Follow
                    </Button>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-t border-border mt-6">
          <button
            onClick={() => setActiveTab("posts")}
            className={`flex-1 flex justify-center py-3 border-t-2 -mt-[2px] transition-colors ${
              activeTab === "posts"
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutGrid className="h-5 w-5" />
          </button>
          <button
            onClick={() => setActiveTab("videos")}
            className={`flex-1 flex justify-center py-3 border-t-2 -mt-[2px] transition-colors ${
              activeTab === "videos"
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Play className="h-5 w-5" />
          </button>
          <button
            onClick={() => setActiveTab("contacts")}
            className={`flex-1 flex justify-center py-3 border-t-2 -mt-[2px] transition-colors ${
              activeTab === "contacts"
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Contact className="h-5 w-5" />
          </button>
        </div>

        {/* Posts 3-Column Grid */}
        <div className="mt-2 px-1">
          {activeTab === "posts" && (
            userImagePosts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border py-8 px-4 text-center text-sm text-muted-foreground bg-card">
                You have not posted a sighting yet.
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1 md:gap-2">
                {userImagePosts.map((post) => (
                  <div 
                    key={post.id} 
                    onClick={() => setSelectedPost(post as FeedPost)}
                    className="aspect-square relative group overflow-hidden bg-muted cursor-pointer rounded-sm"
                  >
                    <img
                      src={post.image_url}
                      alt={post.species_name}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    {/* Overlay on hover */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-2 text-white">
                      <p className="text-[10px] sm:text-xs font-semibold truncate">{post.species_name}</p>
                      {post.location_name && (
                        <p className="text-[8px] sm:text-[10px] opacity-90 truncate">{post.location_name}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {activeTab === "videos" && (
            userVideoPosts.length > 0 && (
              <div className="grid grid-cols-3 gap-1 md:gap-2">
                {userVideoPosts.map((post) => (
                  <div 
                    key={post.id} 
                    onClick={() => setSelectedPost(post as FeedPost)}
                    className="aspect-square relative group overflow-hidden bg-muted cursor-pointer rounded-sm"
                  >
                    <video
                      src={post.image_url}
                      preload="metadata"
                      muted
                      playsInline
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    {/* Overlay on hover */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-2 text-white">
                      <p className="text-[10px] sm:text-xs font-semibold truncate">{post.species_name}</p>
                      {post.location_name && (
                        <p className="text-[8px] sm:text-[10px] opacity-90 truncate">{post.location_name}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {activeTab === "contacts" && (
            taggedPosts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border py-8 px-4 text-center text-sm text-muted-foreground bg-card">
                no one tagged you yet broskii , find birding companions on the platform 😊
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1 md:gap-2">
                {taggedPosts.map((post) => (
                  <div 
                    key={post.id} 
                    onClick={() => setSelectedPost(post as FeedPost)}
                    className="aspect-square relative group overflow-hidden bg-muted cursor-pointer rounded-sm"
                  >
                    {post.image_url.toLowerCase().includes(".mp4") || post.image_url.toLowerCase().includes(".mov") || post.image_url.toLowerCase().includes(".webm") ? (
                      <video
                        src={post.image_url}
                        preload="metadata"
                        muted
                        playsInline
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <img
                        src={post.image_url}
                        alt={post.species_name}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    )}
                    {/* Overlay on hover */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-2 text-white">
                      <p className="text-[10px] sm:text-xs font-semibold truncate">{post.species_name}</p>
                      {post.location_name && (
                        <p className="text-[8px] sm:text-[10px] opacity-90 truncate">{post.location_name}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        <Button type="button" variant="outline" className="w-full" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>

      {/* Post Detail & Engagement Modal */}
      <Dialog open={!!selectedPost} onOpenChange={(open) => !open && setSelectedPost(null)}>
        <DialogContent className="max-w-lg p-0 overflow-y-auto max-h-[90vh] bg-background border-border">
          <DialogHeader className="p-4 border-b border-border flex flex-row items-center justify-between">
            <DialogTitle className="text-sm font-semibold">Post Details</DialogTitle>
          </DialogHeader>
          {selectedPost && (
            <div className="p-2">
              {selectedPost.image_url.toLowerCase().includes(".mp4") ||
              selectedPost.image_url.toLowerCase().includes(".mov") ||
              selectedPost.image_url.toLowerCase().includes(".webm") ? (
                <div className="h-[500px]">
                  <VideoCard
                    video={selectedPost}
                    onToggleLike={() =>
                      likeMutation.mutate({ postId: selectedPost.id, liked: selectedPost.liked_by_me })
                    }
                    isPending={likeMutation.isPending}
                  />
                </div>
              ) : (
                <FeedCard
                  post={selectedPost}
                  index={0}
                  onToggleLike={() =>
                    likeMutation.mutate({ postId: selectedPost.id, liked: selectedPost.liked_by_me })
                  }
                  isPending={likeMutation.isPending}
                />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isEditProfileOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="font-display">Edit profile</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-6 py-4">
            <div className="relative">
              <Avatar className="h-24 w-24 border-4 border-background shadow-sm">
                <AvatarImage src={activeAvatar} alt={profile?.username || "User"} />
                <AvatarFallback className="text-xl font-semibold">
                  {getInitials(profile)}
                </AvatarFallback>
              </Avatar>
              <label className="absolute bottom-0 right-0 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm hover:bg-primary/95 transition-colors">
                <Camera className="h-4 w-4" />
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </label>
            </div>

            <div className="w-full space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="username"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="full-name">Full name</Label>
                <Input
                  id="full-name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Your name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  placeholder="Tell other birdwatchers a bit about yourself"
                />
              </div>

              <Button
                type="button"
                className="w-full"
                disabled={saveMutation.isPending || !username.trim()}
                onClick={() => saveMutation.mutate()}
              >
                {saveMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save changes
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <FollowListDialog
        isOpen={!!followListType}
        onClose={() => setFollowListType(null)}
        userId={user!.id}
        type={followListType || "followers"}
      />
    </div>
  );
};

const ProfileStat = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded-2xl border border-border bg-card p-4 text-center">
    <p className="text-xl font-bold">{value}</p>
    <p className="text-xs text-muted-foreground">{label}</p>
  </div>
);

export default ProfilePage;
