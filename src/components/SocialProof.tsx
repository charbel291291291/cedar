import { useState, useEffect } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { Users, ShoppingBag, ShieldCheck, Zap } from 'lucide-react';

export default function SocialProof() {
  const { t, lang } = useLanguage();
  const [activeUsers, setActiveUsers] = useState(142);
  const [showPurchase, setShowPurchase] = useState(false);
  const [randomName, setRandomName] = useState('User***');

  const names = ['Ali***', 'Sarah***', 'Hassan***', 'Omar***', 'Lina***', 'Rami***', 'Jana***', 'Mark***', 'Fadi***'];

  useEffect(() => {
    // Randomize active users
    const userInterval = setInterval(() => {
      setActiveUsers(prev => prev + Math.floor(Math.random() * 5) - 2);
    }, 5000);

    // Random purchase notification
    const purchaseInterval = setInterval(() => {
      setRandomName(names[Math.floor(Math.random() * names.length)]);
      setShowPurchase(true);
      setTimeout(() => setShowPurchase(false), 5000);
    }, 15000);

    return () => {
      clearInterval(userInterval);
      clearInterval(purchaseInterval);
    };
  }, []);

  return (
    <>
      {/* ACTIVE USERS INDICATOR - TOP LEFT */}
      <div className="fixed top-20 left-4 z-50 animate-fade-in pointer-events-none">
        <div className="glass rounded-full px-4 py-2 border-white/5 flex items-center gap-2 shadow-2xl">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-black text-white/80 uppercase tracking-widest flex items-center gap-1">
             <Users className="w-3 h-3" /> {activeUsers} {t('activeUsersNow')}
          </span>
        </div>
      </div>

      {/* RECENT PURCHASE NOTIFICATION - BOTTOM LEFT */}
      {showPurchase && (
        <div className="fixed bottom-24 left-4 z-[60] animate-in slide-in-from-left duration-500">
           <div className="glass rounded-2xl p-4 border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] flex items-center gap-4 bg-black/60 backdrop-blur-3xl max-w-[280px]">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/20 shrink-0">
                 <ShoppingBag className="w-5 h-5 text-primary" />
              </div>
              <div className="overflow-hidden">
                 <p className="text-[10px] font-black text-white uppercase tracking-tighter truncate">{randomName} {t('justPurchased')}</p>
                 <div className="flex items-center gap-2 mt-1">
                    <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1">
                       <ShieldCheck className="w-2.5 h-2.5" /> SECURE
                    </span>
                    <span className="text-[8px] font-black text-primary/60 uppercase tracking-widest flex items-center gap-1">
                       <Zap className="w-2.5 h-2.5" /> INSTANT
                    </span>
                 </div>
              </div>
           </div>
        </div>
      )}
    </>
  );
}
