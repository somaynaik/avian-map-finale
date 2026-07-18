import { useMemo, useState } from "react";
import { Bird, Loader2, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { formatRelativeTime, getInitials, listConversations, type ConversationSummary } from "@/lib/social";

const MessagesPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ["conversations", user?.id],
    queryFn: () => listConversations(user!.id),
    enabled: !!user?.id,
  });

  const filteredConversations = useMemo(() => {
    const hasBotConv = conversations.some(
      (c) => c.other_user?.id === "00000000-0000-0000-0000-000000000000"
    );

    let result = [...conversations];

    if (!hasBotConv) {
      const peregrineBotPreview = {
        id: "peregrine-bot-preview",
        other_user: {
          id: "00000000-0000-0000-0000-000000000000",
          username: "peregrine",
          full_name: "Peregrine",
          avatar_url: "/peregrine-avatar.jpg",
          bio: "System Chatbot",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        last_message: "Ask me anything about birds!",
        last_message_at: new Date().toISOString(),
        unread_count: 0,
        other_user_last_read_at: null,
      } as ConversationSummary;

      result = [peregrineBotPreview, ...conversations];
    }

    // Always pin Peregrine to position 0
    result.sort((a, b) => {
      const aIsBot = a.other_user?.id === "00000000-0000-0000-0000-000000000000";
      const bIsBot = b.other_user?.id === "00000000-0000-0000-0000-000000000000";
      if (aIsBot) return -1;
      if (bIsBot) return 1;
      return 0;
    });

    const term = search.trim().toLowerCase();
    if (!term) {
      return result;
    }

    return result.filter((conversation) => {
      const label =
        conversation.other_user?.full_name || conversation.other_user?.username || "";
      return (
        label.toLowerCase().includes(term) ||
        conversation.last_message.toLowerCase().includes(term)
      );
    });
  }, [conversations, search]);

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 border-b border-border bg-background/80 px-4 pb-3 pt-12 backdrop-blur-xl">
        <h1 className="font-display text-2xl font-bold">Messages</h1>
        <p className="text-sm text-muted-foreground">Message fellow birdwatchers</p>
      </div>

      <div className="mx-auto max-w-lg">
        <div className="p-4">
          <div className="flex items-center gap-2 rounded-xl bg-muted px-4 py-2.5">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search conversations..."
              className="h-auto border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0"
            />
          </div>
        </div>

        <div className="space-y-1 px-2 pb-24">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No conversations yet. Search for users to start one.
            </div>
          ) : (
            filteredConversations.map((conversation) => {
              const label =
                conversation.other_user?.full_name || conversation.other_user?.username || "User";

              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => navigate(`/messages/${conversation.other_user?.id}`)}
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-muted/50"
                >
                  <Avatar className="h-11 w-11 border border-border">
                    {conversation.other_user?.id === "00000000-0000-0000-0000-000000000000" ? (
                      <>
                        <AvatarImage
                          src="/peregrine-avatar.jpg"
                          alt={label}
                        />
                        <AvatarFallback>
                          <Bird className="h-5 w-5" />
                        </AvatarFallback>
                      </>
                    ) : (
                      <>
                        <AvatarImage
                          src={conversation.other_user?.avatar_url || undefined}
                          alt={label}
                        />
                        <AvatarFallback>{getInitials(conversation.other_user)}</AvatarFallback>
                      </>
                    )}
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className="truncate text-sm font-semibold">{label}</p>
                        {conversation.other_user?.id === "00000000-0000-0000-0000-000000000000" && (
                          <span className="bg-primary/15 text-primary text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                            AI Bot
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {conversation.last_message_at === "1970-01-01T00:00:00.000Z"
                          ? ""
                          : formatRelativeTime(conversation.last_message_at)}
                      </span>
                    </div>
                    <p className="truncate text-sm text-muted-foreground">
                      {conversation.last_message || "Conversation created"}
                    </p>
                  </div>
                  {conversation.unread_count > 0 &&
                    conversation.other_user?.id !== "00000000-0000-0000-0000-000000000000" && (
                    <div className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                      {conversation.unread_count}
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default MessagesPage;
