import { Loader2, Users2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { followUser, getFollowersList, getFollowingList, getInitials, unfollowUser } from "@/lib/social";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  type: "followers" | "following";
};

export const FollowListDialog = ({ isOpen, onClose, userId, type }: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["follow-list", userId, type, user?.id],
    queryFn: () => type === "followers" ? getFollowersList(userId, user!.id) : getFollowingList(userId, user!.id),
    enabled: isOpen && !!user?.id,
  });

  const followMutation = useMutation({
    mutationFn: ({ targetUserId, isFollowing }: { targetUserId: string; isFollowing: boolean }) =>
      isFollowing ? unfollowUser(user!.id, targetUserId) : followUser(user!.id, targetUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["follow-list", userId] });
      queryClient.invalidateQueries({ queryKey: ["users", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["profile-stats", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["user-profile", user?.id] });
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
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] sm:max-w-[425px] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b border-border">
          <DialogTitle className="font-display">{type === "followers" ? "Followers" : "Following"}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 py-4">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <div className="py-10 text-center">
              <Users2 className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">No users found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {users.map((person) => (
                <div key={person.id} className="flex items-center gap-3">
                  <button
                    type="button"
                    className="flex flex-1 items-center gap-3 overflow-hidden text-left"
                    onClick={() => {
                      onClose();
                      navigate(`/users/${person.id}`);
                    }}
                  >
                    <Avatar className="h-10 w-10 border border-border">
                      <AvatarImage src={person.avatar_url || undefined} alt={person.username} />
                      <AvatarFallback>{getInitials(person)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {person.full_name || person.username}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">@{person.username}</p>
                    </div>
                  </button>

                  {person.id !== user?.id && (
                    <Button
                      type="button"
                      size="sm"
                      variant={person.is_following ? "outline" : "default"}
                      disabled={followMutation.isPending}
                      onClick={() =>
                        followMutation.mutate({
                          targetUserId: person.id,
                          isFollowing: person.is_following,
                        })
                      }
                    >
                      {person.is_following ? "Following" : person.follows_me ? "Follow Back" : "Follow"}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
