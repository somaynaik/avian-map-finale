import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import AppLayout from "./components/AppLayout";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import UpdatePasswordPage from "./pages/UpdatePasswordPage";
import MapPage from "./pages/MapPage";
import FeedPage from "./pages/FeedPage";
import CameraPage from "./pages/CameraPage";
import MessagesPage from "./pages/MessagesPage";
import ChatPage from "./pages/ChatPage";
import { DashboardPage } from "./pages/DashboardPage";
import ProfilePage from "./pages/ProfilePage";
import UserProfilePage from "./pages/UserProfilePage";
import PostDetailPage from "./pages/PostDetailPage";
import NotFound from "./pages/NotFound";

import { ThemeProvider } from "next-themes";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light">
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            
            {/* Protected routes */}
            <Route path="/update-password" element={<ProtectedRoute><UpdatePasswordPage /></ProtectedRoute>} />
            <Route path="/" element={<ProtectedRoute><AppLayout><MapPage /></AppLayout></ProtectedRoute>} />
            <Route path="/feed" element={<ProtectedRoute><AppLayout><FeedPage /></AppLayout></ProtectedRoute>} />
            <Route path="/camera" element={<ProtectedRoute><CameraPage /></ProtectedRoute>} />
            <Route path="/messages" element={<ProtectedRoute><AppLayout><MessagesPage /></AppLayout></ProtectedRoute>} />
            <Route path="/messages/:userId" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><AppLayout><DashboardPage /></AppLayout></ProtectedRoute>} />
            <Route path="/users/:userId" element={<ProtectedRoute><AppLayout><UserProfilePage /></AppLayout></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><AppLayout><ProfilePage /></AppLayout></ProtectedRoute>} />
            <Route path="/posts/:postId" element={<PostDetailPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </ThemeProvider>
</QueryClientProvider>
);

export default App;
