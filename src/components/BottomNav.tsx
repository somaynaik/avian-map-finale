import { useLocation, useNavigate } from "react-router-dom";
import { Map, Newspaper, Camera, MessageCircle, LayoutDashboard, User, CalendarDays } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { getUnreadConversationCount } from "@/lib/social";

const tabs = [
  { path: "/", icon: Map, label: "Map" },
  { path: "/feed", icon: Newspaper, label: "Feed" },
  { path: "/camera", icon: Camera, label: "Camera", isCenter: true },
  { path: "/events", icon: CalendarDays, label: "Events" },
  { path: "/messages", icon: MessageCircle, label: "Messages" },
  { path: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/profile", icon: User, label: "Profile" },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: unreadConversationCount = 0 } = useQuery({
    queryKey: ["messages-unread-count", user?.id],
    queryFn: () => getUnreadConversationCount(user!.id),
    enabled: !!user?.id,
  });

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-xl border-t border-border safe-bottom h-[var(--nav-height)] print:hidden">
      <div className="flex items-end justify-around px-1 pb-2 pt-1 max-w-2xl mx-auto h-full">
        {tabs.map((tab) => {
          const isActive =
            tab.path === "/events"
              ? location.pathname.startsWith("/events")
              : location.pathname === tab.path;
          const Icon = tab.icon;
          const showMessageBadge = tab.path === "/messages" && unreadConversationCount > 0;

          if (tab.isCenter) {
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className="relative -mt-6"
              >
                <motion.div
                  whileTap={{ scale: 0.9 }}
                  className="w-14 h-14 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/30"
                >
                  <Icon className="w-6 h-6 text-primary-foreground" />
                </motion.div>
              </button>
            );
          }

          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className="flex flex-col items-center gap-0.5 py-2 px-2 relative"
            >
              <Icon
                className={`w-5 h-5 transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              />
              {showMessageBadge && (
                <span className="absolute right-0 top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground">
                  {unreadConversationCount > 9 ? "9+" : unreadConversationCount}
                </span>
              )}
              <span
                className={`text-[10px] font-medium transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {tab.label}
              </span>
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary"
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
