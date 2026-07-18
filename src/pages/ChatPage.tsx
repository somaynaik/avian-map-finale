import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Loader2, Send, Bird, AlertCircle, Key } from "lucide-react";
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

  const isBot = targetUserId === "peregrine-bot";

  const [draft, setDraft] = useState("");
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [apiKey, setApiKey] = useState(() => import.meta.env.VITE_GEMINI_API_KEY || localStorage.getItem("peregrine_gemini_api_key") || "");
  const [newKeyInput, setNewKeyInput] = useState("");
  const [isBotTyping, setIsBotTyping] = useState(false);

  const [localMessages, setLocalMessages] = useState<any[]>(() => {
    if (isBot) {
      try {
        const stored = localStorage.getItem("peregrine_messages");
        if (stored) {
          return JSON.parse(stored);
        }
      } catch (e) {
        console.error(e);
      }
      const initial = [
        {
          id: "peregrine-welcome",
          sender_id: "peregrine-bot",
          body: "Hello birdwatcher! 🐦 I am Peregrine, your falcon AI assistant. Ask me anything about birds, coordinates, nesting habits, or other birding stuff in general!",
          created_at: new Date().toISOString(),
        }
      ];
      localStorage.setItem("peregrine_messages", JSON.stringify(initial));
      return initial;
    }
    return [];
  });

  const { data: dbTargetUser } = useQuery({
    queryKey: ["user-profile", user?.id, targetUserId],
    queryFn: () => getUserDirectoryEntry(user!.id, targetUserId!),
    enabled: !!user?.id && !!targetUserId && !isBot,
  });

  const targetUser = isBot ? {
    id: "peregrine-bot",
    username: "peregrine",
    full_name: "Peregrine",
    avatar_url: null,
  } : dbTargetUser;

  useEffect(() => {
    if (!user?.id || !targetUserId) return;
    if (isBot) {
      setSelectedConversationId("peregrine-bot");
      return;
    }

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
  }, [targetUserId, user?.id, navigate, isBot]);

  const { data: dbMessages = [], isLoading: dbMessagesLoading } = useQuery({
    queryKey: ["messages", selectedConversationId],
    queryFn: () => getConversationMessages(selectedConversationId!),
    enabled: !!selectedConversationId && !isBot,
  });

  const messages = isBot ? localMessages : dbMessages;
  const messagesLoading = isBot ? false : dbMessagesLoading;

  // Calculate the other user's last read based on the full conversation summary.
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
    enabled: !!selectedConversationId && !!targetUserId && !isBot,
  });

  useEffect(() => {
    if (!selectedConversationId || !user?.id || !messages.length || isBot) return;

    markConversationRead(selectedConversationId, user.id)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["conversations", user.id] });
      })
      .catch(() => undefined);
  }, [messages.length, queryClient, selectedConversationId, user?.id, isBot]);

  useEffect(() => {
    if (!selectedConversationId || !user?.id || isBot) return;

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
    mutationFn: async () => {
      if (isBot) {
        const userMsg = {
          id: `msg-${Date.now()}`,
          sender_id: user!.id,
          body: draft.trim(),
          created_at: new Date().toISOString()
        };
        const updatedMsgs = [...localMessages, userMsg];
        setLocalMessages(updatedMsgs);
        localStorage.setItem("peregrine_messages", JSON.stringify(updatedMsgs));
        setDraft("");
        
        setIsBotTyping(true);
        try {
          if (!apiKey) {
            throw new Error("Gemini API Key is missing. Please save your API Key first.");
          }

          const formattedHistory = updatedMsgs.slice(-15).map(m => ({
            role: m.sender_id === user!.id ? "user" : "model",
            parts: [{ text: m.body }]
          }));

          let response = null;
          let lastError = null;
          const modelsToTry = [
            "gemini-3.5-flash",
            "gemini-3-flash-preview",
            "gemini-2.5-flash",
            "gemini-1.5-flash"
          ];

          for (const model of modelsToTry) {
            try {
              const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json"
                },
                body: JSON.stringify({
                  contents: formattedHistory,
                  systemInstruction: {
                    parts: [{ text: "You are Peregrine, a helpful birdwatching chatbot assistant. Help the user identify birds, give facts about species, explain nesting habits, and suggest birding spots in India. Keep answers engaging, highly informative, and concise." }]
                  }
                })
              });

              if (res.ok) {
                response = res;
                break;
              } else {
                const errData = await res.json().catch(() => ({}));
                const errMsg = errData?.error?.message || "";
                if (res.status === 404 || errMsg.toLowerCase().includes("not found") || errMsg.toLowerCase().includes("no longer available") || errMsg.toLowerCase().includes("deprecated")) {
                  console.warn(`Model ${model} failed, trying next. Error: ${errMsg}`);
                  lastError = new Error(errMsg);
                  continue;
                } else {
                  throw new Error(errMsg || `API error (${res.status})`);
                }
              }
            } catch (e: any) {
              lastError = e;
              const msg = e.message || "";
              if (msg.toLowerCase().includes("not found") || msg.toLowerCase().includes("no longer available") || msg.toLowerCase().includes("deprecated")) {
                continue;
              }
              throw e;
            }
          }

          if (!response) {
            throw lastError || new Error("All attempted Gemini models failed to generate content.");
          }

          const resData = await response.json();
          const replyText = resData?.candidates?.[0]?.content?.parts?.[0]?.text || "I'm sorry, I couldn't process that. Try asking again!";
          
          const botMsg = {
            id: `msg-${Date.now() + 1}`,
            sender_id: "peregrine-bot",
            body: replyText,
            created_at: new Date().toISOString()
          };
          
          const finalMsgs = [...updatedMsgs, botMsg];
          setLocalMessages(finalMsgs);
          localStorage.setItem("peregrine_messages", JSON.stringify(finalMsgs));
        } catch (error: any) {
          const errBotMsg = {
            id: `msg-${Date.now() + 2}`,
            sender_id: "peregrine-bot",
            body: `⚠️ Error: ${error.message || "Something went wrong. Please check your internet connection or Gemini API key."}`,
            created_at: new Date().toISOString()
          };
          const finalMsgs = [...updatedMsgs, errBotMsg];
          setLocalMessages(finalMsgs);
          localStorage.setItem("peregrine_messages", JSON.stringify(finalMsgs));
        } finally {
          setIsBotTyping(false);
        }
        return;
      }
      return sendMessage(selectedConversationId!, user!.id, draft);
    },
    onSuccess: () => {
      if (!isBot) {
        setDraft("");
        queryClient.invalidateQueries({ queryKey: ["messages", selectedConversationId] });
        queryClient.invalidateQueries({ queryKey: ["conversations", user?.id] });
      }
    },
    onError: (error: Error) => {
      if (!isBot) {
        toast({
          title: "Could not send message",
          description: error.message,
          variant: "destructive",
        });
      }
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
              {isBot ? (
                <div className="flex h-full w-full items-center justify-center bg-primary/10 text-primary">
                  <Bird className="h-5 w-5" />
                </div>
              ) : (
                <>
                  <AvatarImage
                    src={targetUser?.avatar_url || undefined}
                    alt={targetUser?.username || "User"}
                  />
                  <AvatarFallback>{getInitials(targetUser)}</AvatarFallback>
                </>
              )}
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <p className="text-sm font-semibold truncate">
                  {targetUser?.full_name || targetUser?.username || "User"}
                </p>
                {isBot && (
                  <span className="bg-primary/15 text-primary text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                    AI Bot
                  </span>
                )}
              </div>
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
        
        {(typingUsers.size > 0 || isBotTyping) && targetUser && (
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

      {isBot && !apiKey && (
        <div className="mx-4 my-2 p-4 bg-muted/60 border border-border rounded-2xl flex flex-col gap-3 shrink-0">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold">Gemini API Key Required</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Peregrine needs a Gemini API Key to chat. Get a free key from <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline font-medium">Google AI Studio</a>.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Input
              type="password"
              placeholder="Paste API Key here..."
              value={newKeyInput}
              onChange={(e) => setNewKeyInput(e.target.value)}
              className="h-9 text-xs rounded-lg"
            />
            <Button
              onClick={() => {
                const cleaned = newKeyInput.trim();
                if (cleaned) {
                  localStorage.setItem("peregrine_gemini_api_key", cleaned);
                  setApiKey(cleaned);
                  toast({
                    title: "API Key Saved",
                    description: "You can now start chatting with Peregrine!",
                  });
                }
              }}
              disabled={!newKeyInput.trim()}
              size="sm"
              className="h-9 text-xs rounded-lg shrink-0 px-3"
            >
              Save
            </Button>
          </div>
        </div>
      )}

      {isBot && apiKey && (
        <div className="mx-4 my-1 flex justify-end shrink-0">
          <button
            onClick={() => {
              localStorage.removeItem("peregrine_gemini_api_key");
              setApiKey("");
              setNewKeyInput("");
              toast({
                title: "API Key Cleared",
                description: "Enter a new key if you want to resume chatting.",
              });
            }}
            className="text-[10px] text-muted-foreground hover:text-foreground underline transition-colors"
          >
            Change API Key
          </button>
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!draft.trim() || !selectedConversationId) return;
          if (isBot && !apiKey) return;
          sendMutation.mutate();
        }}
        className="shrink-0 border-t border-border bg-background px-4 py-3 pb-8 sm:pb-3" 
      >
        <div className="flex items-center gap-2 max-w-lg mx-auto">
          <Input
            value={draft}
            onChange={handleDraftChange}
            placeholder={isBot && !apiKey ? "Please save an API key first..." : "Write a message..."}
            className="rounded-full"
            disabled={isBot && !apiKey}
          />
          <Button type="submit" size="icon" className="rounded-full shrink-0" disabled={sendMutation.isPending || !draft.trim() || !selectedConversationId || (isBot && !apiKey)}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ChatPage;
