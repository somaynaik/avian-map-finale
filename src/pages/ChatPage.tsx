import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Loader2, Send } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
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
  getUserDirectoryEntry,
  markConversationRead,
  sendMessage,
} from "@/lib/social";
import { supabase } from "@/lib/supabase";

const ChatPage = () => {
  const { user } = useAuth();
  const { userId: targetUserId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [draft, setDraft] = useState("");
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: targetUser } = useQuery({
    queryKey: ["user-profile", user?.id, targetUserId],
    queryFn: () => getUserDirectoryEntry(user!.id, targetUserId!),
    enabled: !!user?.id && !!targetUserId,
  });

  useEffect(() => {
    if (!user?.id || !targetUserId) return;

    let isMounted = true;
    getOrCreateDirectConversation(user.id, targetUserId)
      .then((conversationId) => {
        if (!isMounted) return;
        setSelectedConversationId(conversationId);
      })
      .catch((error: Error) => {
        toast({
          title: "Could not open conversation",
          description: error.message,
          variant: "destructive",
        });
        navigate("/messages");
      });

    return () => {
      isMounted = false;
    };
  }, [targetUserId, user?.id, navigate]);

  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ["messages", selectedConversationId],
    queryFn: () => getConversationMessages(selectedConversationId!),
    enabled: !!selectedConversationId,
  });

  // Calculate the other user's last read based on the full conversation summary.
  // Note: we can map this similarly or we could just rely on 'isReadByOther' directly if we queried last_read_at,
  // but to keep it perfectly snappy we will query last_read_at of the participant.
  const { data: participants } = useQuery({
    queryKey: ["conversation-participant", selectedConversationId, targetUserId],
    queryFn: async () => {
      const { data } = await supabase.from("conversation_participants")
          .select("last_read_at")
          .eq("conversation_id", selectedConversationId)
          .eq("user_id", targetUserId)
          .single();
      return data;
    },
    enabled: !!selectedConversationId && !!targetUserId,
  });

  useEffect(() => {
    if (!selectedConversationId || !user?.id || !messages.length) return;

    markConversationRead(selectedConversationId, user.id)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["conversations", user.id] });
      })
      .catch(() => undefined);
  }, [messages.length, queryClient, selectedConversationId, user?.id]);

  useEffect(() => {
    if (!selectedConversationId || !user?.id) return;

    const channel = supabase.channel(`chat:${selectedConversationId}`);
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "typing" }, (payload) => {
        if (payload.payload.user_id && payload.payload.user_id !== user.id) {
          setTypingUsers((prev) => {
            const next = new Set(prev);
            next.add(payload.payload.user_id);
            return next;
          });
          
          setTimeout(() => {
            setTypingUsers((prev) => {
              const next = new Set(prev);
              next.delete(payload.payload.user_id);
              return next;
            });
          }, 3000);
        }
      })
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${selectedConversationId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["messages", selectedConversationId] });
          queryClient.invalidateQueries({ queryKey: ["conversations", user.id] });
          queryClient.invalidateQueries({ queryKey: ["messages-unread-count", user.id] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversation_participants",
          filter: `conversation_id=eq.${selectedConversationId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["conversation-participant", selectedConversationId, targetUserId] });
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
      setTypingUsers(new Set());
    };
  }, [selectedConversationId, user?.id, targetUserId, queryClient]);

  const latestMyMessage = useMemo(() => {
    return [...messages].reverse().find(m => m.sender_id === user?.id);
  }, [messages, user?.id]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

  const handleDraftChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setDraft(event.target.value);
    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "typing",
        payload: { user_id: user?.id },
      }).catch(() => {});
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border bg-background px-4 py-3 shrink-0">
        <button type="button" onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-muted transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        {targetUser ? (
          <>
            <Avatar className="h-10 w-10 border border-border">
              <AvatarImage
                src={targetUser?.avatar_url || undefined}
                alt={targetUser?.username || "User"}
              />
              <AvatarFallback>{getInitials(targetUser)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">
                {targetUser?.full_name || targetUser?.username || "User"}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                @{targetUser?.username || "user"}
              </p>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-3">
             <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
             <div className="space-y-2">
                <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                <div className="h-3 w-16 bg-muted animate-pulse rounded" />
             </div>
          </div>
        )}
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messagesLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : messages.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            No messages yet. Say hello!
          </div>
        ) : (
          messages.map((message) => {
            const mine = message.sender_id === user?.id;
            const isLatestMine = mine && message.id === latestMyMessage?.id;
            const isReadByOther = participants?.last_read_at && 
              new Date(message.created_at).getTime() <= new Date(participants.last_read_at).getTime();

            return (
              <div key={message.id} className="mb-2">
                <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${mine
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                      }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{message.body}</p>
                    <p
                      className={`mt-2 text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"
                        }`}
                    >
                      {formatRelativeTime(message.created_at)}
                    </p>
                  </div>
                </div>
                {isLatestMine && isReadByOther && (
                  <div className="flex justify-end mt-1 mr-2">
                    <span className="text-[10px] text-muted-foreground">Seen</span>
                  </div>
                )}
              </div>
            );
          })
        )}
        
        {typingUsers.size > 0 && targetUser && (
          <div className="flex justify-start mb-2">
            <div className="max-w-[80%] rounded-2xl px-4 py-3 text-sm bg-muted text-muted-foreground italic flex items-center gap-1">
              <span className="animate-bounce inline-block">.</span>
              <span className="animate-bounce inline-block" style={{ animationDelay: '100ms' }}>.</span>
              <span className="animate-bounce inline-block" style={{ animationDelay: '200ms' }}>.</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!draft.trim() || !selectedConversationId) return;
          sendMutation.mutate();
        }}
        className="shrink-0 border-t border-border bg-background px-4 py-3 pb-8 sm:pb-3" 
      >
        <div className="flex items-center gap-2 max-w-lg mx-auto">
          <Input
            value={draft}
            onChange={handleDraftChange}
            placeholder="Write a message..."
            className="rounded-full"
          />
          <Button type="submit" size="icon" className="rounded-full shrink-0" disabled={sendMutation.isPending || !draft.trim() || !selectedConversationId}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ChatPage;
