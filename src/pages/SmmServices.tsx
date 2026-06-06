import React, { useState, useEffect, useMemo, memo, useCallback, useTransition } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Search, Loader2, CheckCircle2, AlertCircle, ShoppingCart, Layers, ChevronDown, Flame, SearchX, Rocket } from 'lucide-react';
import { DashboardSkeletonGrid } from '../components/Skeletons';
import { getFilteredServices, type SmmService } from '@/lib/smmServiceFilters';
import { getServiceIcon } from '@/lib/serviceIcon';
import { applyVipDiscount, getVipTier } from '@/lib/vip';
import { VipBadge } from '@/components/VipCard';
import { useAuth } from '@/hooks/useAuth';

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

const ServiceCard = memo(({ service, onOrderSuccess, vipLevel = 1 }: any) => {
  const { isDemo } = useAuth();
  const [link, setLink] = useState('');
  const [qty, setQty] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const finalRate = Number(service.rate);
  const vipPricing = applyVipDiscount(finalRate, vipLevel);
  const displayRate = vipPricing.discounted;
  const previewCost = (typeof qty === 'number' && qty > 0) ? (displayRate / 1000) * qty : 0;

  // Sahl game top-up products store rate as per-1000 internally,
  // but display should show per-item price (rate / 1000) since qty is 1-few.
  const isSahl = String(service.service_id).startsWith('sahl_');
  const shownPrice  = isSahl ? (displayRate / 1000) : displayRate;
  const shownOriginal = isSahl ? (finalRate / 1000) : finalRate;
  const priceLabel  = isSahl ? 'Per Item' : 'Per 1,000';

  const handleOrder = async () => {
    if (!link.trim()) return setError("Target URL is required.");
    const numQty = Number(qty);
    if (!numQty || numQty < Number(service.min) || numQty > Number(service.max)) {
      return setError(`Quantity must be between ${service.min} and ${service.max}`);
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
      if (!userData?.user) {
        throw new Error("User not authenticated. Please log in first.");
      }

      const { data, error: invokeError } = await supabase.functions.invoke('secure-order-placement', {
        body: { service_id: service.service_id, link: link.trim(), quantity: numQty, request_id: requestId },
      });

      if (invokeError) throw new Error(invokeError.message || "Network Error.");
      if (data?.error || !data?.success) throw new Error(data?.error || "Transaction Failed.");

      setSuccess(`Order #${data.order_id?.substring(0,6)} Placed Successfully!`);
      setLink(''); setQty('');
      onOrderSuccess(); 
      setTimeout(() => setSuccess(null), 6000);
    } catch (err: any) {
      console.error("Function error:", err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const icon = getServiceIcon(service.name, service.category, service.image_url);

  return (
    <div className="group flex flex-col bg-card border border-border rounded-xl overflow-hidden hover:shadow-2xl hover:shadow-primary/5 hover:-translate-y-1 transition-all duration-300">
      <div className="p-4 border-b border-border relative overflow-hidden">
        {/* Icon + rate row */}
        <div className="flex justify-between items-start mb-3 gap-2">
          {/* Brand icon */}
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 overflow-hidden border border-white/10"
            style={{ backgroundColor: `#${icon.bgColor}` }}
          >
            {icon.type === 'url' ? (
              <img
                src={icon.src}
                alt=""
                className="w-5 h-5 object-contain"
                loading="lazy"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <span className="text-base leading-none">{icon.letter}</span>
            )}
          </div>
          {/* Rate */}
          <div className="text-right">
            {vipPricing.hasDiscount && (
              <span className="text-[10px] line-through text-muted-foreground/60 block leading-none mb-0.5">
                ${shownOriginal.toFixed(3)}
              </span>
            )}
            <span className="text-xl font-extrabold tracking-tight leading-none"
              style={{ color: vipPricing.hasDiscount ? getVipTier(vipLevel).color : 'hsl(var(--primary))' }}>
              ${shownPrice.toFixed(3)}
            </span>
            <p className="text-[10px] uppercase font-bold text-muted-foreground">{priceLabel}</p>
            {vipPricing.hasDiscount && (
              <span className="text-[8px] font-black uppercase tracking-widest"
                style={{ color: getVipTier(vipLevel).color }}>
                -{vipPricing.discountPct}% VIP
              </span>
            )}
          </div>
        </div>
        <h3 className="font-bold text-sm text-foreground leading-snug line-clamp-2 h-10">{service.name}</h3>
      </div>
      <div className="p-4 flex-1 flex flex-col gap-3">
        <div className="flex items-center justify-between text-[11px] font-bold px-3 py-1.5 bg-muted rounded-md text-muted-foreground uppercase tracking-widest">
          <span>Min: {service.min}</span>
          <div className="w-px h-3 bg-border"></div>
          <span>Max: {service.max}</span>
        </div>
        <div className="space-y-2">
          <input type="url" placeholder="Target URL..." value={link} onChange={(e) => { setLink(e.target.value); setError(null); }} className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:ring-1 focus:ring-primary" />
          <input type="number" placeholder={`Qty: e.g. ${service.min}`} value={qty} min={service.min} max={service.max} onChange={(e) => { setQty(e.target.value ? Number(e.target.value) : ''); setError(null); }} className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm font-mono focus:ring-1 focus:ring-primary" />
          {previewCost > 0 && <p className="text-xs font-bold text-emerald-500 text-right">Cost: ${previewCost.toFixed(3)}{isSahl && qty && Number(qty) > 1 ? ` (${qty}× items)` : ''}</p>}
        </div>
        {error && <div className="text-[11px] font-bold text-destructive bg-destructive/10 px-2 py-1 rounded flex gap-1"><AlertCircle className="w-3 h-3"/> {error}</div>}
        {success && <div className="text-[11px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded flex gap-1"><CheckCircle2 className="w-3 h-3"/> {success}</div>}
      </div>
      <div className="p-4 pt-0">
        <button onClick={handleOrder} disabled={loading} className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-bold shadow-md hover:opacity-90 transition-all disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : success ? <><CheckCircle2 className="w-4 h-4" /> Preview Ready</> : <><ShoppingCart className="w-4 h-4" /> Place Order</>}
        </button>
      </div>
    </div>
  );
});

const ITEMS_PER_PAGE = 30;
const DEMO_SMM_SERVICES: SmmService[] = [
  {
    service_id: 'demo_instagram_followers',
    name: 'Instagram Followers - High Quality',
    category: 'Instagram',
    rate: 4.2,
    min: 100,
    max: 10000,
    is_active: true,
    show_in_popular: true,
    is_featured: true,
    image_url: null,
  },
  {
    service_id: 'demo_tiktok_views',
    name: 'TikTok Views - Fast Delivery',
    category: 'TikTok',
    rate: 1.1,
    min: 1000,
    max: 100000,
    is_active: true,
    show_in_popular: true,
    is_featured: false,
    image_url: null,
  },
  {
    service_id: 'demo_youtube_watchtime',
    name: 'YouTube Watch Time - Stable Retention',
    category: 'YouTube',
    rate: 18,
    min: 100,
    max: 5000,
    is_active: true,
    show_in_popular: true,
    is_featured: true,
    image_url: null,
  },
  {
    service_id: 'demo_telegram_members',
    name: 'Telegram Members - Public Channels',
    category: 'Telegram',
    rate: 6.5,
    min: 100,
    max: 20000,
    is_active: true,
    show_in_popular: false,
    is_featured: false,
    image_url: null,
  },
];

export default function SmmServicesPage() {
  const { isDemo } = useAuth();
  const [services, setServices] = useState<SmmService[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [vipLevel, setVipLevel] = useState(1);
  const [, startTransition] = useTransition();

  const handleCategoryChange = useCallback((cat: string) => {
    startTransition(() => { setActiveCategory(cat); setSearchQuery(''); });
  }, [startTransition]);

  // Fetch user VIP level
  useEffect(() => {
    if (isDemo) return;
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) return;
      // @ts-ignore
      supabase.from('users').select('vip_level').eq('id', data.user.id).single()
        .then(({ data: u }: any) => { if (u?.vip_level) setVipLevel(u.vip_level); });
    });
  }, [isDemo]);

  useEffect(() => {
    if (isDemo) {
      setServices(DEMO_SMM_SERVICES);
      setActiveCategory('Popular Services');
      setLoading(false);
      return;
    }

    const chatAppKeywords = ['YoHo', 'Xena', 'SoulStar'];
    // @ts-ignore
    supabase
      .from('smm_services')
      .select('service_id, name, category, rate, min, max, is_active, show_in_popular, is_featured, image_url')
      .limit(2000)
      .order('rate', { ascending: true })
      // @ts-ignore
      .then(({ data }: { data: SmmService[] | null }) => {
        if (data) {
          const others = data.filter(s =>
            !chatAppKeywords.some(k => s.name.toLowerCase().includes(k.toLowerCase()))
          );
          setServices(others);
          if (others.length > 0) setActiveCategory('Popular Services');
        }
        setLoading(false);
      });
  }, [isDemo]);

  const categories = useMemo(() => {
    const cats = Array.from(new Set(services.map(s => s.category))).sort();
    return ['Popular Services', ...cats];
  }, [services]);

  const filteredServices = useMemo(() => {
    setVisibleCount(ITEMS_PER_PAGE);
    return getFilteredServices(services, activeCategory, debouncedSearch);
  }, [services, activeCategory, debouncedSearch]);

  const currentlyVisible = filteredServices.slice(0, visibleCount);

  return (
    <div className="animate-in fade-in duration-500 pb-20">
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 bg-primary/10 text-primary rounded-xl">
          <Rocket className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-black">SMM Engine</h1>
          <p className="text-muted-foreground font-bold uppercase tracking-widest text-xs mt-1">Growth Services</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <aside className="w-full lg:w-64 flex-shrink-0">
          <div className="bg-card border border-border rounded-xl p-4 sticky top-20 max-h-[75vh] overflow-y-auto no-scrollbar shadow-sm">
            <h3 className="font-bold text-xs uppercase tracking-widest text-muted-foreground mb-4 ml-1">Categories</h3>
            <div className="space-y-1">
              {categories.map((cat: any) => (
                <button key={cat} onClick={() => handleCategoryChange(cat)} className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${activeCategory === cat ? 'bg-primary text-primary-foreground font-black' : 'text-muted-foreground hover:bg-muted font-bold'}`}>
                  {cat === 'Popular Services' ? `🔥 ${cat}` : cat}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <div className="flex-1">
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input type="text" placeholder="Search growth services..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all shadow-sm" />
            </div>
          </div>

          {loading ? (
            <DashboardSkeletonGrid />
          ) : filteredServices.length === 0 ? (
            <div className="py-20 text-center"><SearchX className="w-10 h-10 text-muted-foreground mx-auto mb-4" /><p className="font-bold">No growth services found.</p></div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {currentlyVisible.map(service => <ServiceCard key={service.service_id} service={service} vipLevel={vipLevel} onOrderSuccess={() => window.dispatchEvent(new CustomEvent('balance-refresh-needed'))} />)}
              </div>
              {visibleCount < filteredServices.length && (
                <div className="mt-8 text-center">
                  <button onClick={() => setVisibleCount(v => v + ITEMS_PER_PAGE)} className="px-8 py-2.5 bg-muted hover:bg-primary hover:text-white text-foreground rounded-full text-xs font-black shadow-sm inline-flex items-center gap-2 transition-all uppercase tracking-widest"><ChevronDown className="w-4 h-4"/> Load More Services</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
