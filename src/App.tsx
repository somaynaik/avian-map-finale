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
import MapPage from "./pages/MapPage";
import FeedPage from "./pages/FeedPage";
import CameraPage from "./pages/CameraPage";
import MessagesPage from "./pages/MessagesPage";
import UsersPage from "./pages/UsersPage";
import ProfilePage from "./pages/ProfilePage";
import UserProfilePage from "./pages/UserProfilePage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
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
            <Route path="/" element={<ProtectedRoute><AppLayout><MapPage /></AppLayout></ProtectedRoute>} />
            <Route path="/feed" element={<ProtectedRoute><AppLayout><FeedPage /></AppLayout></ProtectedRoute>} />
            <Route path="/camera" element={<ProtectedRoute><CameraPage /></ProtectedRoute>} />
            <Route path="/messages" element={<ProtectedRoute><AppLayout><MessagesPage /></AppLayout></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute><AppLayout><UsersPage /></AppLayout></ProtectedRoute>} />
            <Route path="/users/:userId" element={<ProtectedRoute><AppLayout><UserProfilePage /></AppLayout></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><AppLayout><ProfilePage /></AppLayout></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
