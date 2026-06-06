import { useLanguage } from '@/i18n/LanguageContext';
import { ShieldCheck, Zap, Lock, Headphones } from 'lucide-react';

export default function TrustLayer() {
  const { t } = useLanguage();

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
      <div className="glass rounded-3xl p-6 border-white/5 flex flex-col items-center text-center group hover:bg-white/[0.03] transition-all">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
          <ShieldCheck className="w-6 h-6 text-emerald-500" />
        </div>
        <h4 className="text-[10px] font-black uppercase tracking-widest text-white mb-2">{t('securePayment')}</h4>
        <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest leading-loose opacity-60">Verified Gateways</p>
      </div>

      <div className="glass rounded-3xl p-6 border-white/5 flex flex-col items-center text-center group hover:bg-white/[0.03] transition-all">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
          <Zap className="w-6 h-6 text-primary" />
        </div>
        <h4 className="text-[10px] font-black uppercase tracking-widest text-white mb-2">{t('instantDelivery')}</h4>
        <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest leading-loose opacity-60">Automated Processing</p>
      </div>

      <div className="glass rounded-3xl p-6 border-white/5 flex flex-col items-center text-center group hover:bg-white/[0.03] transition-all">
        <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
          <Lock className="w-6 h-6 text-blue-500" />
        </div>
        <h4 className="text-[10px] font-black uppercase tracking-widest text-white mb-2">{t('privacyPolicy')}</h4>
        <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest leading-loose opacity-60">Encrypted Data</p>
      </div>

      <div className="glass rounded-3xl p-6 border-white/5 flex flex-col items-center text-center group hover:bg-white/[0.03] transition-all">
        <div className="w-12 h-12 rounded-2xl bg-neutral-500/10 border border-neutral-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
          <Headphones className="w-6 h-6 text-neutral-400" />
        </div>
        <h4 className="text-[10px] font-black uppercase tracking-widest text-white mb-2">{t('fastSupport')}</h4>
        <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest leading-loose opacity-60">24/7 Professional Assistance</p>
      </div>
    </div>
  );
}
