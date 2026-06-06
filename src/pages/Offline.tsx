import { useEffect, useState } from 'react';
import { BrandLogo } from '@/components/BrandLogo';
import { WifiOff, RefreshCw, Home } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="text-center space-y-6 animate-in fade-in zoom-in duration-500">
          <RefreshCw className="w-16 h-16 text-emerald-500 mx-auto animate-spin" />
          <h1 className="text-2xl font-black">Reconnected!</h1>
          <p className="text-muted-foreground">You're back online. Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-72 h-72 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute bottom-1/4 -right-20 w-80 h-80 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative z-10 max-w-md w-full space-y-8 text-center animate-in fade-in slide-in-from-bottom-8 duration-700">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <BrandLogo size="xl" className="drop-shadow-2xl opacity-80" />
        </div>

        {/* Icon */}
        <div className="flex justify-center">
          <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20">
            <WifiOff className="w-12 h-12 text-primary" />
          </div>
        </div>

        {/* Content */}
        <div className="space-y-4">
          <h1 className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            You're Offline
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
            No internet connection detected. Some features may not be available until you reconnect.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
          <Button
            onClick={() => window.location.reload()}
            className="h-12 px-6 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/20 hover:opacity-90 active:scale-[0.98] transition-all text-xs uppercase tracking-widest"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
          <Link to="/home">
            <Button
              variant="outline"
              className="h-12 px-6 bg-white/5 border-white/10 font-black rounded-2xl hover:bg-white/10 transition-all text-xs uppercase tracking-widest"
            >
              <Home className="w-4 h-4 mr-2" />
              Go Home
            </Button>
          </Link>
        </div>

        {/* Info card */}
        <div className="glass rounded-[2rem] border border-white/5 p-6 mt-8 text-left space-y-3">
          <h3 className="font-black text-sm uppercase tracking-widest text-white/60">What you can still do:</h3>
          <ul className="space-y-2 text-xs text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 mt-1">✓</span>
              View cached pages and content
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 mt-1">✓</span>
              Access previously loaded data
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-500 mt-1">⚠</span>
              Real-time features require connection
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
