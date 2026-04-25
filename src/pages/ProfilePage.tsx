import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { Camera, Loader2, LogOut, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FollowListDialog } from "@/components/FollowListDialog";
import { toast } from "@/hooks/use-toast";
import {
  formatRelativeTime,
  getInitials,
  getProfile,
  getProfileStats,
  getRecentPostsForUser,
  updateProfile,
  uploadAvatar,
} from "@/lib/social";

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
        description: "Your account details are now saved in Supabase.",
      });
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
              <div className="relative">
                <Avatar className="h-28 w-28 border-4 border-background shadow-sm">
                  <AvatarImage src={activeAvatar} alt={profile?.username || "User"} />
                  <AvatarFallback className="text-2xl font-semibold">
                    {getInitials(profile)}
                  </AvatarFallback>
                </Avatar>
                <label className="absolute bottom-1 right-1 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                  <Camera className="h-4 w-4" />
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                </label>
              </div>

              <h1 className="mt-4 font-display text-2xl font-bold">
                {profile?.full_name || profile?.username || "Your profile"}
              </h1>
              <p className="text-sm text-muted-foreground">{user?.email}</p>

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

      <div className="mx-auto max-w-lg space-y-4 px-4 pt-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Edit profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save changes
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent posts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentPosts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                You have not posted a sighting yet.
              </p>
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

        <Button type="button" variant="outline" className="w-full" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>

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
