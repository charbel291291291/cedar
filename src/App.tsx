import { lazy, Suspense, useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { LanguageProvider } from "@/i18n/LanguageContext";
import AppLayout from "./components/AppLayout";
import AdminRoute from "./components/AdminRoute";
import { RouteErrorBoundary } from "./components/RouteErrorBoundary";
import { BrandLogo } from "./components/BrandLogo";
import { Loader2, ShieldCheck, Zap } from "lucide-react";

const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Admin = lazy(() => import("./pages/Admin"));
const NotFound = lazy(() => import("./pages/NotFound"));
const HomePage = lazy(() => import("./pages/HomePage"));
const SmmServices = lazy(() => import("./pages/SmmServices"));
const CharbelCard = lazy(() => import("./pages/CharbelCard"));
const Orders = lazy(() => import("./pages/Orders"));
const Profile = lazy(() => import("./pages/Profile"));
const Offline = lazy(() => import("./pages/Offline"));

const queryClient = new QueryClient();

function RouteLoading() {
  const [msgIndex, setMsgIndex] = useState(0);
  const messages = [
    "Initializing secure connection...",
    "Authentication handshake...",
    "Syncing global hubs...",
    "Ready to serve you."
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % messages.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#050505] relative overflow-hidden">
      {/* BACKGROUND EFFECTS */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-blue-500/5 rounded-full blur-[100px] animate-pulse delay-700" />
      
      {/* CENTRAL ANIMATION */}
      <div className="relative flex flex-col items-center">
         {/* ORBITAL RINGS */}
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border border-white/5 rounded-full animate-[spin_8s_linear_infinite]" />
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 border border-primary/10 rounded-full animate-[spin_6s_linear_infinite_reverse]" />
         
         <div className="relative p-8 bg-black/40 backdrop-blur-3xl rounded-[2.5rem] border border-white/5 shadow-2xl flex flex-col items-center gap-6 group">
            <div className="relative">
              <div className="absolute inset-0 bg-primary blur-2xl opacity-20 animate-pulse" />
              <BrandLogo size="splash" className="relative drop-shadow-2xl" />
            </div>
            
            <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-2 text-primary font-black uppercase tracking-[0.3em] text-[10px]">
                   <Zap className="w-3 h-3 animate-bounce" /> 
                   <span>Cedar Card</span>
                </div>
                <div className="h-4 flex items-center justify-center">
                   <p className="text-muted-foreground text-[11px] font-bold animate-pulse">{messages[msgIndex]}</p>
                </div>
            </div>

            <div className="flex items-center gap-3">
               <div className="flex gap-1">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: `${i*0.2}s` }} />
                  ))}
               </div>
               <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-500" /> SSL SECURE
               </span>
            </div>
         </div>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <RouteLoading />;
  if (!user) return <Navigate to="/auth" replace />;
  return <AppLayout>{children}</AppLayout>;
}

function AuthRoute() {
  const { user, loading, isDemo } = useAuth();
  if (loading) return <RouteLoading />;
  if (isDemo) return <Navigate to="/home" replace />;
  if (user) return <Navigate to="/dashboard" replace />;
  return (
    <Suspense fallback={<RouteLoading />}>
      <RouteErrorBoundary>
        <Auth />
      </RouteErrorBoundary>
    </Suspense>
  );
}

function RootRoute() {
  const { user, loading } = useAuth();
  if (loading) return <RouteLoading />;
  return <Navigate to={user ? "/home" : "/auth"} replace />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <LanguageProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<RootRoute />} />
              <Route path="/auth" element={<AuthRoute />} />
              <Route
                path="/home"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<RouteLoading />}>
                      <RouteErrorBoundary>
                        <HomePage />
                      </RouteErrorBoundary>
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/smm-engine"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<RouteLoading />}>
                      <RouteErrorBoundary>
                        <SmmServices />
                      </RouteErrorBoundary>
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/cedar-boost"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<RouteLoading />}>
                      <RouteErrorBoundary>
                        <CharbelCard />
                      </RouteErrorBoundary>
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<RouteLoading />}>
                      <RouteErrorBoundary>
                        <Dashboard />
                      </RouteErrorBoundary>
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/orders"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<RouteLoading />}>
                      <RouteErrorBoundary>
                        <Orders />
                      </RouteErrorBoundary>
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<RouteLoading />}>
                      <RouteErrorBoundary>
                        <Profile />
                      </RouteErrorBoundary>
                    </Suspense>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin"
                element={
                  <ProtectedRoute>
                    <AdminRoute>
                      <Suspense fallback={<RouteLoading />}>
                        <RouteErrorBoundary>
                          <Admin />
                        </RouteErrorBoundary>
                      </Suspense>
                    </AdminRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="*"
                element={
                  <Suspense fallback={<RouteLoading />}>
                    <RouteErrorBoundary>
                      <NotFound />
                    </RouteErrorBoundary>
                  </Suspense>
                }
              />
              <Route
                path="/offline"
                element={
                  <Suspense fallback={<RouteLoading />}>
                    <RouteErrorBoundary>
                      <Offline />
                    </RouteErrorBoundary>
                  </Suspense>
                }
              />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </LanguageProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
