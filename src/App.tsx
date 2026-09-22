
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import RequireAuth from "@/components/RequireAuth";
import RequireAdmin from "@/components/RequireAdmin";
import Index from "./pages/Index";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import CreateCompany from "./pages/CreateCompany";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";
import WebhookLogsPage from "./pages/WebhookLogsPage";
import WebhookTestPage from "./pages/WebhookTestPage";
import InvitePage from "./pages/InvitePage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/create-company" element={<CreateCompany />} />
            <Route path="/invite/:token" element={<InvitePage />} />
            <Route path="/app" element={<RequireAuth><Index /></RequireAuth>} />
            <Route path="/admin" element={<RequireAdmin><Admin /></RequireAdmin>} />
            <Route path="/webhook-logs/:integrationId" element={<RequireAuth><WebhookLogsPage /></RequireAuth>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;