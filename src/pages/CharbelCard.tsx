import React, { useState, useEffect, useMemo, memo, useCallback, useTransition } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Search, Loader2, CheckCircle2, AlertCircle, ShoppingCart,
  ChevronDown, SearchX, Zap, MessageCircle, Sparkles, Star,
} from 'lucide-react';
import { DashboardSkeletonGrid } from '../components/Skeletons';
import { useLanguage } from '@/i18n/LanguageContext';
import { useAuth } from '@/hooks/useAuth';

// ─── Debounce hook ─────────────────────────────────────────────────────────────
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

// ─── Service Card ─────────────────────────────────────────────────────────────
const ServiceCard = memo(({ service, onOrderSuccess }: any) => {
  const { t } = useLanguage();
  const { isDemo } = useAuth();
  const [link, setLink] = useState('');
  const [qty, setQty] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [focused, setFocused] = useState<'link' | 'qty' | null>(null);

  const finalRate = Number(service.rate);
  const previewCost = (typeof qty === 'number' && qty > 0) ? (finalRate / 1000) * qty : 0;

  const handleOrder = async () => {
    if (!link.trim()) return setError(t('enterTargetId'));
    const numQty = Number(qty);
    if (!numQty || numQty < Number(service.min) || numQty > Number(service.max)) {
      return setError(`${t('amount')} must be between ${service.min}–${service.max}`);
    }

    setLoading(true); setError(null); setSuccess(null);
    const requestId = crypto.randomUUID();

    try {
      if (isDemo) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        setSuccess('Demo order preview created.');
        setLink(''); setQty('');
        setTimeout(() => setSuccess(null), 5000);
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) throw new Error('User not authenticated. Please log in first.');

      const { data, error: invokeError } = await supabase.functions.invoke('secure-order-placement', {
        body: { service_id: service.service_id, link: link.trim(), quantity: numQty, request_id: requestId },
      });

      if (invokeError) throw new Error(invokeError.message || 'Network Error.');
      if (data?.error || !data?.success) throw new Error(data?.error || 'Transaction Failed.');

      setSuccess(`${t('orderSubmitted')} #${data.order_id?.substring(0, 6)}`);
      setLink(''); setQty('');
      onOrderSuccess();
      setTimeout(() => setSuccess(null), 6000);
    } catch (err: any) {
      setError(err.message || t('somethingWentWrong'));
    } finally {
      setLoading(false);
    }
  };

  const categoryLabel = service.category.replace('🎮 ', '').substring(0, 20);
  const isReady = link.trim() && qty && Number(qty) >= Number(service.min);

  return (
    <div className="group relative flex flex-col rounded-[1.75rem] border border-white/[0.07] bg-[#0d0d0d] overflow-hidden transition-all duration-500 hover:border-emerald-500/30 hover:shadow-[0_0_40px_-8px_rgba(16,185,129,0.2)] hover:-translate-y-1">

      {/* Glow orb — visible on hover */}
      <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-emerald-500/10 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

      {/* ── CARD HEADER ── */}
      <div className="relative p-4 sm:p-5 border-b border-white/[0.06]"
        style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.06) 0%, rgba(13,13,13,0) 60%)' }}
      >
        {/* Category pill */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/[0.1] border border-emerald-500/25 text-emerald-400 text-[9px] font-black tracking-widest uppercase">
            <Zap className="w-2.5 h-2.5" />
            {categoryLabel}
          </span>

          {/* Price */}
          <div className="text-right shrink-0">
            <p className="text-xl font-black tracking-tighter leading-none" style={{ color: 'rgb(52,211,153)' }}>
              ${finalRate.toFixed(3)}
            </p>
            <p className="text-[8px] font-black uppercase tracking-widest text-white/25 mt-0.5">{t('per1000')}</p>
          </div>
        </div>

        {/* Service name */}
        <h3 className="font-black text-[13px] text-white/90 leading-snug line-clamp-2 min-h-[2.4rem] group-hover:text-white transition-colors">
          {service.name}
        </h3>
      </div>

      {/* ── FORM ── */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col gap-3">

        {/* Min/Max pill */}
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-[10px] font-black text-white/30 uppercase tracking-widest">
          <span>{t('min')}: <span className="text-white/50">{Number(service.min).toLocaleString()}</span></span>
          <div className="w-px h-3 bg-white/10" />
          <span>{t('max')}: <span className="text-white/50">{Number(service.max).toLocaleString()}</span></span>
        </div>

        {/* Link input */}
        <div className={`relative rounded-2xl border transition-all duration-200 overflow-hidden ${
          focused === 'link'
            ? 'border-emerald-500/50 shadow-[0_0_0_3px_rgba(16,185,129,0.1)]'
            : 'border-white/[0.08] hover:border-white/[0.15]'
        }`}>
          <input
            type="url"
            placeholder={t('targetUrl')}
            value={link}
            onFocus={() => setFocused('link')}
            onBlur={() => setFocused(null)}
            onChange={(e) => { setLink(e.target.value); setError(null); }}
            className="w-full px-4 py-3 bg-white/[0.03] text-sm font-bold text-white placeholder:text-white/20 outline-none"
          />
        </div>

        {/* Qty input + cost preview */}
        <div className={`relative rounded-2xl border transition-all duration-200 overflow-hidden ${
          focused === 'qty'
            ? 'border-emerald-500/50 shadow-[0_0_0_3px_rgba(16,185,129,0.1)]'
            : 'border-white/[0.08] hover:border-white/[0.15]'
        }`}>
          <input
            type="number"
            placeholder={`${t('qtyPlaceholder')} ${service.min}`}
            value={qty}
            min={service.min}
            max={service.max}
            onFocus={() => setFocused('qty')}
            onBlur={() => setFocused(null)}
            onChange={(e) => { setQty(e.target.value ? Number(e.target.value) : ''); setError(null); }}
            className="w-full px-4 py-3 bg-white/[0.03] text-sm font-black font-mono text-white placeholder:text-white/20 outline-none"
          />
          {previewCost > 0 && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none animate-in fade-in duration-200">
              <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-lg">
                ${previewCost.toFixed(3)}
              </span>
            </div>
          )}
        </div>

        {/* Error / success */}
        {error && (
          <div className="flex items-center gap-2 text-[11px] font-black text-red-400 bg-red-500/[0.08] border border-red-500/20 px-3 py-2 rounded-xl animate-in slide-in-from-top-1 duration-200">
            <AlertCircle className="w-3 h-3 shrink-0" /> {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 text-[11px] font-black text-emerald-400 bg-emerald-500/[0.08] border border-emerald-500/20 px-3 py-2 rounded-xl animate-in slide-in-from-top-1 duration-200">
            <CheckCircle2 className="w-3 h-3 shrink-0" /> {success}
          </div>
        )}
      </div>

      {/* ── CTA BUTTON ── */}
      <div className="px-4 sm:px-5 pb-4 sm:pb-5">
        <button
          type="button"
          onClick={handleOrder}
          disabled={loading}
          className={`w-full h-12 rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all duration-200 tap-feedback disabled:opacity-50 disabled:pointer-events-none ${
            success
              ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
              : isReady
              ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:brightness-110'
              : 'bg-white/[0.05] border border-white/[0.08] text-white/35 hover:bg-white/[0.08] hover:text-white/60'
          }`}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : success ? (
            <><CheckCircle2 className="w-4 h-4" /> {isDemo ? 'Preview Ready' : 'Order Placed!'}</>
          ) : (
            <><ShoppingCart className="w-4 h-4" strokeWidth={2.5} /> {t('buyNow')}</>
          )}
        </button>
      </div>
    </div>
  );
});

// ─── Page ─────────────────────────────────────────────────────────────────────
const ITEMS_PER_PAGE = 30;
const DEMO_CEDAR_SERVICES = [
  {
    service_id: 'demo_yoho_diamonds',
    name: 'YoHo Diamonds Recharge',
    category: 'Cedar Card',
    rate: 12.5,
    min: 100,
    max: 10000,
  },
  {
    service_id: 'demo_xena_coins',
    name: 'Xena Coins Instant Top-Up',
    category: 'Cedar Card',
    rate: 9.75,
    min: 50,
    max: 5000,
  },
  {
    service_id: 'demo_soulstar_points',
    name: 'SoulStar Points Package',
    category: 'Cedar Card',
    rate: 14.2,
    min: 100,
    max: 12000,
  },
  {
    service_id: 'demo_yoho_star',
    name: 'YoHo Star Premium Recharge',
    category: 'Cedar Card',
    rate: 21,
    min: 10,
    max: 1000,
  },
];

export default function CharbelCardPage() {
  const { t } = useLanguage();
  const { isDemo } = useAuth();
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (isDemo) {
      setServices(DEMO_CEDAR_SERVICES);
      setActiveCategory('Cedar Card');
      setLoading(false);
      return;
    }

    const chatAppKeywords = ['YoHo', 'Xena', 'SoulStar'];
    // @ts-ignore
    let query = supabase.from('smm_services').select('*').limit(2000).order('rate', { ascending: true });
    const filterString = chatAppKeywords.map(k => `name.ilike.%${k}%`).join(',');
    query = query.or(filterString);
    // @ts-ignore
    query.then(({ data }) => {
      if (data) {
        setServices(data);
        setActiveCategory('Cedar Card');
      }
      setLoading(false);
    });
  }, [isDemo]);

  const categories = useMemo(() => ['Cedar Card'], []);

  const filteredServices = useMemo(() => {
    setVisibleCount(ITEMS_PER_PAGE);
    let filtered = services;
    if (activeCategory === 'Cedar Card') filtered = [...services].sort((a, b) => Number(a.rate) - Number(b.rate));
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      filtered = filtered.filter(s =>
        s.name.toLowerCase().includes(q) ||
        String(s.service_id).includes(q) ||
        s.category.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [services, activeCategory, debouncedSearch]);

  const currentlyVisible = filteredServices.slice(0, visibleCount);

  return (
    <div className="animate-in fade-in duration-500 pb-24 sm:pb-20 space-y-6 sm:space-y-8">

      {/* ── HERO HEADER ─────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] border border-white/[0.07] p-6 sm:p-8 lg:p-10"
        style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(5,5,5,0) 50%, rgba(52,211,153,0.04) 100%)' }}
      >
        {/* Glow blobs */}
        <div className="absolute -top-16 -left-16 w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-56 h-56 rounded-full bg-emerald-400/6 blur-3xl pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
          {/* Icon badge */}
          <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl sm:rounded-[1.25rem] border border-emerald-500/30 flex items-center justify-center shrink-0 overflow-hidden"
            style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(16,185,129,0.05) 100%)' }}
          >
            <div className="absolute inset-0 opacity-30"
              style={{ background: 'radial-gradient(circle at 30% 30%, rgba(52,211,153,0.4) 0%, transparent 70%)' }}
            />
            <MessageCircle className="w-7 h-7 sm:w-8 sm:h-8 text-emerald-400 relative z-10" strokeWidth={2} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[8px] font-black tracking-[0.2em] uppercase">
                <div className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" /> Live
              </span>
              <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/25">
                {services.length} services available
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tighter text-white italic leading-none">
              {t('cedarCard')}
            </h1>
            <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.3em] text-white/30 mt-1.5">
              {t('premiumRecharge')} · YoHo · Xena · SoulStar
            </p>
          </div>

          {/* Stats pill — desktop */}
          <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/[0.04] border border-white/[0.07]">
              <Star className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-black text-white/70">Premium Service</span>
            </div>
            <p className="text-[8px] font-black text-white/20 uppercase tracking-widest">Instant delivery</p>
          </div>
        </div>
      </div>

      {/* ── SEARCH ──────────────────────────────────────────────────────────── */}
      <div className="relative group">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-emerald-400 transition-colors duration-300 pointer-events-none" />
        <input
          type="text"
          placeholder={t('searchChatServices')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-5 py-4 sm:py-[18px] bg-white/[0.04] border border-white/[0.08] hover:border-white/[0.14] focus:border-emerald-500/50 rounded-2xl sm:rounded-[1.5rem] text-sm font-bold text-white placeholder:text-white/25 outline-none transition-all duration-300 focus:shadow-[0_0_0_3px_rgba(16,185,129,0.1)] focus:bg-white/[0.06]"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/[0.08] hover:bg-white/[0.15] flex items-center justify-center transition-all tap-feedback"
          >
            <span className="text-white/50 text-xs font-black">✕</span>
          </button>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-5 sm:gap-6 lg:gap-8">

        {/* ── SIDEBAR CATEGORIES ──────────────────────────────────────────── */}
        <aside className="w-full lg:w-64 xl:w-72 shrink-0">
          <div className="glass border border-white/[0.07] rounded-[1.75rem] p-5 sticky top-24"
            style={{ backdropFilter: 'blur(20px)' }}
          >
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-white/25 mb-4 flex items-center gap-2">
              <Sparkles className="w-3 h-3 text-emerald-500/60" /> {t('categories')}
            </p>
            <div className="space-y-1.5">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => startTransition(() => { setActiveCategory(cat); setSearchQuery(''); })}
                  className={`w-full text-left px-4 py-3 rounded-2xl text-[12px] font-black transition-all duration-200 tap-feedback ${
                    activeCategory === cat
                      ? 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 shadow-sm translate-x-1'
                      : 'border border-transparent text-white/40 hover:bg-white/[0.05] hover:text-white/70'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {activeCategory === cat && (
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    )}
                    <span>{cat === 'Cedar Card' ? t('cedarCard') : cat}</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Mini info card */}
            <div className="mt-5 p-3.5 rounded-2xl bg-emerald-500/[0.06] border border-emerald-500/15 space-y-1.5">
              <p className="text-[9px] font-black text-emerald-400/80 uppercase tracking-widest flex items-center gap-1.5">
                <Zap className="w-2.5 h-2.5" /> Instant Orders
              </p>
              <p className="text-[10px] font-bold text-white/30 leading-relaxed">
                All services are processed automatically with no manual steps.
              </p>
            </div>
          </div>
        </aside>

        {/* ── PRODUCTS GRID ───────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          {/* Result count */}
          {!loading && (
            <div className="flex items-center justify-between mb-4 sm:mb-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/25">
                {debouncedSearch
                  ? `${filteredServices.length} result${filteredServices.length !== 1 ? 's' : ''} for "${debouncedSearch}"`
                  : `${filteredServices.length} services`
                }
              </p>
              {visibleCount < filteredServices.length && (
                <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">
                  Showing {Math.min(visibleCount, filteredServices.length)} of {filteredServices.length}
                </p>
              )}
            </div>
          )}

          {loading ? (
            <DashboardSkeletonGrid />
          ) : currentlyVisible.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center">
                <SearchX className="w-7 h-7 text-white/20" />
              </div>
              <div className="space-y-1">
                <p className="font-black text-white/40 text-base">{t('noChatServices')}</p>
                <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">Try a different search term</p>
              </div>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="px-5 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white/50 text-xs font-black hover:bg-white/[0.09] hover:text-white transition-all tap-feedback"
                >
                  Clear Search
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
                {currentlyVisible.map(service => (
                  <ServiceCard
                    key={service.service_id}
                    service={service}
                    onOrderSuccess={() => window.dispatchEvent(new CustomEvent('balance-refresh-needed'))}
                  />
                ))}
              </div>

              {visibleCount < filteredServices.length && (
                <div className="mt-10 sm:mt-12 text-center">
                  <button
                    type="button"
                    onClick={() => setVisibleCount(v => v + ITEMS_PER_PAGE)}
                    className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.09] hover:bg-emerald-500/10 hover:border-emerald-500/25 hover:text-emerald-300 text-white/40 text-[10px] font-black uppercase tracking-widest transition-all duration-300 tap-feedback"
                  >
                    <ChevronDown className="w-4 h-4" />
                    {t('loadMoreApps')}
                    <span className="px-2 py-0.5 rounded-full bg-white/[0.07] text-white/30 text-[9px]">
                      +{Math.min(ITEMS_PER_PAGE, filteredServices.length - visibleCount)}
                    </span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
