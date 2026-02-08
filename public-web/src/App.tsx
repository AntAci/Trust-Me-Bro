import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import SupportConsole from "./pages/SupportConsole";
import Provenance from "./pages/Provenance";
import VersionHistory from "./pages/VersionHistory";
import Galaxy from "./pages/Galaxy";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppLayout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/plugin" element={<SupportConsole />} />
            <Route path="/flow" element={<Navigate to="/plugin" replace />} />
            <Route path="/galaxy" element={<Galaxy />} />
            <Route path="/provenance" element={<Provenance />} />
            <Route path="/versions" element={<VersionHistory />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
