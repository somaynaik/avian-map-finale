import { useState } from "react";
import { Loader2, MessageCircle, UserPlus, ArrowLeft, Bell, MoreVertical, LayoutGrid, Play, Contact } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FollowListDialog } from "@/components/FollowListDialog";
import { toast } from "@/hooks/use-toast";
import {
  followUser,
  formatRelativeTime,
  getInitials,
  getRecentPostsForUser,
  getUserDirectoryEntry,
  unfollowUser,
  getPostsTaggedUser,
} from "@/lib/social";

const UserProfilePage = () => {
  const { user } = useAuth();
  const { userId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [followListType, setFollowListType] = useState<"followers" | "following" | null>(null);
  const [activeTab, setActiveTab] = useState<"posts" | "videos" | "contacts">("posts");

  const { data: profile, isLoading } = useQuery({
    queryKey: ["user-profile", user?.id, userId],
    queryFn: () => getUserDirectoryEntry(user!.id, userId!),
    enabled: !!user?.id && !!userId,
  });

  const { data: recentPosts = [] } = useQuery({
    queryKey: ["user-profile-posts", userId],
    queryFn: () => getRecentPostsForUser(userId!),
    enabled: !!userId,
  });

  const { data: taggedPosts = [] } = useQuery({
    queryKey: ["user-profile-tagged-posts", userId],
    queryFn: () => getPostsTaggedUser(userId!),
    enabled: !!userId,
  });

  const isVideoUrl = (url?: string) => {
    if (!url) return false;
    const lower = url.toLowerCase();
    return lower.includes(".mp4") || lower.includes(".mov") || lower.includes(".webm") || lower.includes("video");
  };

  const userImagePosts = recentPosts.filter((post) => !isVideoUrl(post.image_url));
  const userVideoPosts = recentPosts.filter((post) => isVideoUrl(post.image_url));

  const followMutation = useMutation({
    mutationFn: () =>
      profile?.is_following
        ? unfollowUser(user!.id, profile.id)
        : followUser(user!.id, profile!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-profile", user?.id, userId] });
      queryClient.invalidateQueries({ queryKey: ["users", user?.id] });
    },
    onError: (error: Error) => {
      toast({
        title: "Could not update follow status",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="px-4 py-12 text-center text-sm text-muted-foreground">
        User not found.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Top sticky navigation bar */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/95 backdrop-blur px-4 py-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-9 w-9">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <span className="font-display font-bold text-base">@{profile.username}</span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground">
            <Bell className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground">
            <MoreVertical className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 pt-6">
        {/* Profile Info block */}
        <div className="flex items-center">
          <Avatar className="h-20 w-20 border border-border shadow-sm flex-shrink-0">
            <AvatarImage src={profile.avatar_url || undefined} alt={profile.username} />
            <AvatarFallback className="text-xl font-semibold">
              {getInitials(profile)}
            </AvatarFallback>
          </Avatar>

          {/* Stats on the right */}
          <div className="flex-1 flex justify-around items-center pl-4 text-center">
            <div className="flex flex-col items-center">
              <span className="text-base font-bold">{profile.post_count}</span>
              <span className="text-xs text-muted-foreground">posts</span>
            </div>
            <button type="button" onClick={() => setFollowListType("followers")} className="flex flex-col items-center hover:opacity-80 transition-opacity">
              <span className="text-base font-bold">{profile.follower_count}</span>
              <span className="text-xs text-muted-foreground">followers</span>
            </button>
            <button type="button" onClick={() => setFollowListType("following")} className="flex flex-col items-center hover:opacity-80 transition-opacity">
              <span className="text-base font-bold">{profile.following_count}</span>
              <span className="text-xs text-muted-foreground">following</span>
            </button>
          </div>
        </div>

        {/* Display Name and Bio */}
        <div className="mt-4 px-1 text-left space-y-1">
          <h2 className="font-display font-semibold text-sm">{profile.full_name || profile.username}</h2>
          {profile.bio && (
            <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">
              {profile.bio}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-5 flex gap-2 px-1">
          <Button
            type="button"
            variant={profile.is_following ? "secondary" : "default"}
            className="flex-1 text-xs font-semibold h-9"
            disabled={followMutation.isPending}
            onClick={() => followMutation.mutate()}
          >
            {profile.is_following ? "Following" : "Follow"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="flex-1 text-xs font-semibold h-9"
            onClick={() => navigate(`/messages/${profile.id}`)}
          >
            Message
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="h-9 w-9 text-muted-foreground"
          >
            <UserPlus className="h-4 w-4" />
          </Button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-t border-border mt-6">
          <button
            onClick={() => setActiveTab("posts")}
            className={`flex-1 flex justify-center py-3 border-t-2 -mt-[2px] transition-colors ${activeTab === "posts"
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
          >
            <LayoutGrid className="h-5 w-5" />
          </button>
          <button
            onClick={() => setActiveTab("videos")}
            className={`flex-1 flex justify-center py-3 border-t-2 -mt-[2px] transition-colors ${activeTab === "videos"
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
          >
            <Play className="h-5 w-5" />
          </button>
          <button
            onClick={() => setActiveTab("contacts")}
            className={`flex-1 flex justify-center py-3 border-t-2 -mt-[2px] transition-colors ${activeTab === "contacts"
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
              <div className="py-12 text-center text-sm text-muted-foreground">
                This user has not posted yet.
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1 md:gap-2">
                {userImagePosts.map((post) => (
                  <div
                    key={post.id}
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
              <div className="py-12 text-center text-sm text-muted-foreground">
                no one tagged you yet broskii , find birding companions on the platform 😊
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1 md:gap-2">
                {taggedPosts.map((post) => (
                  <div
                    key={post.id}
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
      </div>

      <FollowListDialog
        isOpen={!!followListType}
        onClose={() => setFollowListType(null)}
        userId={profile.id}
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

export default UserProfilePage;
