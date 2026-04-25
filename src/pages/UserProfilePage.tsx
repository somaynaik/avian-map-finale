import { useState } from "react";
import { Loader2, MessageCircle, UserPlus } from "lucide-react";
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
} from "@/lib/social";

const UserProfilePage = () => {
  const { user } = useAuth();
  const { userId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [followListType, setFollowListType] = useState<"followers" | "following" | null>(null);

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
      <div className="border-b border-border bg-gradient-to-b from-primary/10 to-background px-4 pb-8 pt-12">
        <div className="mx-auto max-w-lg text-center">
          <Avatar className="mx-auto h-28 w-28 border-4 border-background shadow-sm">
            <AvatarImage src={profile.avatar_url || undefined} alt={profile.username} />
            <AvatarFallback className="text-2xl font-semibold">
              {getInitials(profile)}
            </AvatarFallback>
          </Avatar>

          <h1 className="mt-4 font-display text-2xl font-bold">
            {profile.full_name || profile.username}
          </h1>
          <p className="text-sm text-muted-foreground">@{profile.username}</p>
          {profile.bio && <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">{profile.bio}</p>}

          <div className="mt-6 grid grid-cols-3 gap-3">
            <ProfileStat label="Posts" value={profile.post_count} />
            <button type="button" onClick={() => setFollowListType("followers")} className="transition-opacity hover:opacity-70 text-left">
              <ProfileStat label="Followers" value={profile.follower_count} />
            </button>
            <button type="button" onClick={() => setFollowListType("following")} className="transition-opacity hover:opacity-70 text-left">
              <ProfileStat label="Following" value={profile.following_count} />
            </button>
          </div>

          <div className="mt-6 flex gap-2">
            <Button
              type="button"
              variant={profile.is_following ? "outline" : "default"}
              className="flex-1"
              disabled={followMutation.isPending}
              onClick={() => followMutation.mutate()}
            >
              {profile.is_following ? (
                "Following"
              ) : profile.follows_me ? (
                <>
                  <UserPlus className="h-4 w-4" />
                  Follow Back
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  Follow
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => navigate(`/messages?user=${profile.id}`)}
            >
              <MessageCircle className="h-4 w-4" />
              Message
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 pt-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent posts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentPosts.length === 0 ? (
              <p className="text-sm text-muted-foreground">This user has not posted yet.</p>
            ) : (
              recentPosts.map((post) => (
                <div key={post.id} className="flex gap-3 rounded-xl border border-border p-3">
                  <img
                    src={post.image_url}
                    alt={post.species_name}
                    className="h-16 w-16 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{post.species_name}</p>
                    {post.location_name && (
                      <p className="truncate text-xs text-muted-foreground">{post.location_name}</p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatRelativeTime(post.created_at)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
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
