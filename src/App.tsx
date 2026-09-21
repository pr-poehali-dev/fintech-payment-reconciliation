
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import RequireAuth from "@/components/RequireAuth";
import Index from "./pages/Index";
import Login from "./pages/Login";
import CreateCompany from "./pages/CreateCompany";
import NotFound from "./pages/NotFound";
import WebhookLogsPage from "./pages/WebhookLogsPage";
import WebhookTestPage from "./pages/WebhookTestPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/create-company" element={<CreateCompany />} />
            <Route path="/" element={<RequireAuth><Index /></RequireAuth>} />
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