import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export function useNetworkStatus() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleOnline = () => {
      console.log('[Network] Connection restored');
      toast.success('Back online!');
    };

    const handleOffline = () => {
      console.log('[Network] Connection lost');
      toast.error('You\'re offline. Some features may not work.');
      // Navigate to offline page but keep history so user can go back
      if (window.location.pathname !== '/offline') {
        navigate('/offline', { replace: false });
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [navigate]);
}
