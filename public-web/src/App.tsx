import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import Landing from "./pages/Landing";
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
        <Routes>
          {/* Landing page - no AppLayout */}
          <Route path="/" element={<Landing />} />
          
          {/* App routes - with AppLayout */}
          <Route element={<AppLayout><Dashboard /></AppLayout>} path="/dashboard" />
          <Route element={<AppLayout><SupportConsole /></AppLayout>} path="/plugin" />
          <Route path="/flow" element={<Navigate to="/plugin" replace />} />
          <Route element={<AppLayout><Galaxy /></AppLayout>} path="/galaxy" />
          <Route element={<AppLayout><Provenance /></AppLayout>} path="/provenance" />
          <Route element={<AppLayout><VersionHistory /></AppLayout>} path="/versions" />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
