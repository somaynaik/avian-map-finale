import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, Send } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import {
  formatRelativeTime,
  getConversationMessages,
  getInitials,
  getOrCreateDirectConversation,
  listConversations,
  markConversationRead,
  sendMessage,
} from "@/lib/social";

const MessagesPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const targetUserId = searchParams.get("user");

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ["conversations", user?.id],
    queryFn: () => listConversations(user!.id),
    enabled: !!user?.id,
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (!selectedConversationId && conversations[0]?.id) {
      setSelectedConversationId(conversations[0].id);
    }
  }, [conversations, selectedConversationId]);

  useEffect(() => {
    if (!user?.id || !targetUserId || targetUserId === user.id) return;

    let isMounted = true;
    getOrCreateDirectConversation(user.id, targetUserId)
      .then((conversationId) => {
        if (!isMounted) return;
        setSelectedConversationId(conversationId);
        queryClient.invalidateQueries({ queryKey: ["conversations", user.id] });
        setSearchParams({}, { replace: true });
      })
      .catch((error: Error) => {
        toast({
          title: "Could not open conversation",
          description: error.message,
          variant: "destructive",
        });
      });

    return () => {
      isMounted = false;
    };
  }, [queryClient, setSearchParams, targetUserId, user?.id]);

  const filteredConversations = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return conversations;
    return conversations.filter((conversation) => {
      const label = conversation.other_user?.full_name || conversation.other_user?.username || "";
      return label.toLowerCase().includes(term) || conversation.last_message.toLowerCase().includes(term);
    });
  }, [conversations, search]);

  const activeConversation =
    filteredConversations.find((conversation) => conversation.id === selectedConversationId) ||
    conversations.find((conversation) => conversation.id === selectedConversationId) ||
    null;

  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ["messages", selectedConversationId],
    queryFn: () => getConversationMessages(selectedConversationId!),
    enabled: !!selectedConversationId,
    refetchInterval: 3000,
  });

  useEffect(() => {
    if (!selectedConversationId || !user?.id || !messages.length) return;

    markConversationRead(selectedConversationId, user.id)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["conversations", user.id] });
      })
      .catch(() => undefined);
  }, [messages.length, queryClient, selectedConversationId, user?.id]);

  const sendMutation = useMutation({
    mutationFn: () => sendMessage(selectedConversationId!, user!.id, draft),
    onSuccess: () => {
      setDraft("");
      queryClient.invalidateQueries({ queryKey: ["messages", selectedConversationId] });
      queryClient.invalidateQueries({ queryKey: ["conversations", user?.id] });
    },
    onError: (error: Error) => {
      toast({
        title: "Could not send message",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 border-b border-border bg-background/80 px-4 pb-3 pt-12 backdrop-blur-xl">
        <h1 className="font-display text-2xl font-bold">Messages</h1>
        <p className="text-sm text-muted-foreground">Direct chat between real platform users</p>
      </div>

      <div className="mx-auto grid min-h-[calc(100vh-96px)] max-w-6xl gap-0 md:grid-cols-[360px_1fr]">
        <aside className="border-r border-border">
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
                No conversations yet. Open a user from the Users tab to start one.
              </div>
            ) : (
              filteredConversations.map((conversation) => {
                const active = conversation.id === activeConversation?.id;
                const label =
                  conversation.other_user?.full_name || conversation.other_user?.username || "User";

                return (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => setSelectedConversationId(conversation.id)}
                    className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors ${
                      active ? "bg-muted" : "hover:bg-muted/50"
                    }`}
                  >
                    <Avatar className="h-11 w-11 border border-border">
                      <AvatarImage
                        src={conversation.other_user?.avatar_url || undefined}
                        alt={label}
                      />
                      <AvatarFallback>{getInitials(conversation.other_user)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-semibold">{label}</p>
                        <span className="text-xs text-muted-foreground">
                          {conversation.last_message_at === "1970-01-01T00:00:00.000Z"
                            ? ""
                            : formatRelativeTime(conversation.last_message_at)}
                        </span>
                      </div>
                      <p className="truncate text-sm text-muted-foreground">
                        {conversation.last_message || "Conversation created"}
                      </p>
                    </div>
                    {conversation.unread_count > 0 && (
                      <div className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                        {conversation.unread_count}
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <section className="flex min-h-[60vh] flex-col">
          {activeConversation ? (
            <>
              <div className="flex items-center gap-3 border-b border-border px-4 py-4">
                <Avatar className="h-10 w-10 border border-border">
                  <AvatarImage
                    src={activeConversation.other_user?.avatar_url || undefined}
                    alt={activeConversation.other_user?.username || "User"}
                  />
                  <AvatarFallback>{getInitials(activeConversation.other_user)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-semibold">
                    {activeConversation.other_user?.full_name ||
                      activeConversation.other_user?.username ||
                      "User"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    @{activeConversation.other_user?.username || "user"}
                  </p>
                </div>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 pb-28">
                {messagesLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    No messages yet. Send the first one below.
                  </div>
                ) : (
                  messages.map((message) => {
                    const mine = message.sender_id === user?.id;
                    return (
                      <div
                        key={message.id}
                        className={`flex ${mine ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                            mine
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-foreground"
                          }`}
                        >
                          <p>{message.body}</p>
                          <p
                            className={`mt-2 text-[10px] ${
                              mine ? "text-primary-foreground/70" : "text-muted-foreground"
                            }`}
                          >
                            {formatRelativeTime(message.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!draft.trim() || !selectedConversationId) return;
                  sendMutation.mutate();
                }}
                className="sticky bottom-0 border-t border-border bg-background px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <Input
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Write a message..."
                  />
                  <Button type="submit" disabled={sendMutation.isPending || !draft.trim()}>
                    <Send className="h-4 w-4" />
                    Send
                  </Button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex min-h-[50vh] items-center justify-center px-6 text-center text-sm text-muted-foreground">
              Select a conversation or start one from the Users tab.
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default MessagesPage;
