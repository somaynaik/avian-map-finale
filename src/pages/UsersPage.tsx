import { useDeferredValue, useState } from "react";
import { MessageCircle, Search, UserPlus, Users2 } from "lucide-react";
import { motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { followUser, getInitials, listUsers, unfollowUser } from "@/lib/social";

const UsersPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users", user?.id, deferredSearch],
    queryFn: () => listUsers(user!.id, deferredSearch),
    enabled: !!user?.id,
  });

  const followMutation = useMutation({
    mutationFn: ({ targetUserId, isFollowing }: { targetUserId: string; isFollowing: boolean }) =>
      isFollowing ? unfollowUser(user!.id, targetUserId) : followUser(user!.id, targetUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["profile-stats", user?.id] });
    },
    onError: (error: Error) => {
      toast({
        title: "Could not update follow status",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 border-b border-border bg-background/80 px-4 pb-3 pt-12 backdrop-blur-xl">
        <h1 className="font-display text-2xl font-bold">Birdwatchers</h1>
        <p className="text-sm text-muted-foreground">Search real accounts and start conversations</p>
      </div>

      <div className="mx-auto max-w-lg px-4 py-3">
        <div className="flex items-center gap-2 rounded-xl bg-muted px-4 py-2.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search users..."
            className="h-auto border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0"
          />
        </div>
      </div>

      <div className="mx-auto max-w-lg space-y-3 px-4 pb-24">
        {isLoading ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Loading users...
          </div>
        ) : users.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-center">
            <Users2 className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">No matching users found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Accounts appear here once users sign up and create their profiles.
            </p>
          </div>
        ) : (
          users.map((person, index) => (
            <motion.div
              key={person.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className="rounded-2xl border border-border bg-card p-4"
            >
              <button
                type="button"
                onClick={() => navigate(`/users/${person.id}`)}
                className="flex w-full items-start gap-3 text-left"
              >
                <Avatar className="h-12 w-12 border border-border">
                  <AvatarImage src={person.avatar_url || undefined} alt={person.username} />
                  <AvatarFallback>{getInitials(person)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {person.full_name || person.username}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">@{person.username}</p>
                  {person.bio && <p className="mt-1 text-sm text-muted-foreground">{person.bio}</p>}
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>{person.post_count} posts</span>
                    <span>{person.follower_count} followers</span>
                    <span>{person.following_count} following</span>
                  </div>
                </div>
              </button>

              <div className="mt-4 flex gap-2">
                <Button
                  type="button"
                  variant={person.is_following ? "outline" : "default"}
                  className="flex-1"
                  disabled={followMutation.isPending}
                  onClick={(event) => {
                    event.stopPropagation();
                    followMutation.mutate({
                      targetUserId: person.id,
                      isFollowing: person.is_following,
                    });
                  }}
                >
                  {person.is_following ? (
                    "Following"
                  ) : person.follows_me ? (
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
                  onClick={(event) => {
                    event.stopPropagation();
                    navigate(`/messages/${person.id}`);
                  }}
                >
                  <MessageCircle className="h-4 w-4" />
                  Message
                </Button>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};

export default UsersPage;
