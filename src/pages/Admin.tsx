import React, { useState, useEffect, useCallback, useMemo, useTransition, memo } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Shield, RefreshCw, CheckCircle2, XCircle, Clock, Users as UsersIcon,
  DollarSign, Activity, LayoutDashboard, ShoppingCart, ListOrdered,
  Edit, Search, Settings, BarChart2, TrendingUp, Zap, Trash2,
  CheckSquare, Square, AlertTriangle, Package, ArrowUpRight, Layers,
  Star, Eye, EyeOff, Flame,
} from 'lucide-react';
import type { SmmService } from '@/lib/smmServiceFilters';
import { getServiceIcon } from '@/lib/serviceIcon';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) => `$${Number(n).toFixed(2)}`;

const STATUS_COLORS: Record<string, string> = {
  completed:  '#10b981',
  processing: '#3b82f6',
  pending:    '#f59e0b',
  canceled:   '#ef4444',
  failed:     '#f97316',
  paid:       '#06b6d4',
  refunded:   '#8b5cf6',
};

const PIE_COLORS = ['#10b981','#3b82f6','#f59e0b','#ef4444','#f97316','#06b6d4','#8b5cf6'];

// ─── Custom tooltip ───────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#111] border border-white/10 rounded-xl px-4 py-3 shadow-2xl text-xs font-black">
      <p className="text-muted-foreground mb-1 uppercase tracking-widest">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {typeof p.value === 'number' && p.name?.toLowerCase().includes('revenue') ? fmt(p.value) : p.value}</p>
      ))}
    </div>
  );
};

// ─── Metric card ─────────────────────────────────────────────────────────────
function MetricCard({ label, value, icon: Icon, color, bg, delta }: any) {
  return (
    <div className="bg-card border border-border p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] flex items-center justify-between hover:scale-[1.01] transition-transform hover:shadow-xl shadow-sm card-lift">
      <div className="min-w-0 pr-2">
        <p className="text-muted-foreground font-bold text-[9px] sm:text-[11px] uppercase tracking-widest mb-1 sm:mb-2 opacity-80">{label}</p>
        <h3 className="text-xl sm:text-3xl lg:text-4xl font-black truncate">{value}</h3>
        {delta !== undefined && (
          <p className={`text-[9px] font-black mt-1 flex items-center gap-1 ${delta >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
            <ArrowUpRight className="w-2.5 h-2.5" /> {delta >= 0 ? '+' : ''}{delta}
          </p>
        )}
      </div>
      <div className={`p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border shrink-0 ${bg}`}>
        <Icon className={`w-5 h-5 sm:w-7 sm:h-7 ${color}`} />
      </div>
    </div>
  );
}

// ─── Status pill ─────────────────────────────────────────────────────────────
function StatusPill({ status }: { status: string }) {
  const color = STATUS_COLORS[status] || '#888';
  return (
    <span
      className="inline-flex px-2.5 py-1 rounded-lg text-[9px] uppercase font-black tracking-wider border whitespace-nowrap"
      style={{ backgroundColor: color + '18', color, borderColor: color + '40' }}
    >
      {status || 'pending'}
    </span>
  );
}

// ─── Mobile deposit card ──────────────────────────────────────────────────────
function DepositCard({ dep, userEmail, onApprove, onDeny }: any) {
  const isPending = dep.status === 'pending';
  return (
    <div className="p-4 space-y-3 border-b border-border/40 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-black text-sm truncate">{userEmail || 'Unknown'}</p>
          <p className="font-mono text-[9px] text-muted-foreground opacity-50 mt-0.5">{dep.user_id?.substring(0, 12)}…</p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-black text-emerald-500 text-lg">+${Number(dep.amount).toFixed(2)}</p>
          <p className="text-[9px] text-muted-foreground uppercase font-black">{dep.method}</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <StatusPill status={dep.status} />
          {dep.proof && (
            <a href={dep.proof} target="_blank" rel="noreferrer"
              className="text-[9px] font-black text-blue-400 underline"
            >View Proof ↗</a>
          )}
        </div>
        {isPending && (
          <div className="flex gap-2">
            <button onClick={onApprove}
              className="h-9 px-4 bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500 hover:text-white rounded-xl text-[10px] font-black flex items-center gap-1.5 transition-all tap-feedback"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> OK
            </button>
            <button onClick={onDeny}
              className="h-9 px-4 bg-red-500/10 text-red-400 border border-red-500/25 hover:bg-red-500 hover:text-white rounded-xl text-[10px] font-black flex items-center gap-1.5 transition-all tap-feedback"
            >
              <XCircle className="w-3.5 h-3.5" /> Deny
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Mobile order card ────────────────────────────────────────────────────────
function OrderCard({ order, user, selected, onToggle }: any) {
  return (
    <div className={`p-4 border-b border-border/40 last:border-b-0 ${selected ? 'bg-primary/5' : ''}`}>
      <div className="flex items-start gap-3">
        <button type="button" onClick={onToggle} className="mt-0.5 tap-feedback">
          {selected ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4 text-muted-foreground" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="font-mono text-[9px] text-muted-foreground opacity-50">#{order.id.substring(0, 8)}</span>
            <StatusPill status={order.status} />
          </div>
          <p className="font-bold text-sm truncate">{user?.email || order.user_id?.substring(0, 12)}</p>
          <div className="flex items-center justify-between mt-1">
            <p className="text-[10px] text-muted-foreground">Svc #{order.service_id} · qty {order.quantity || '—'}</p>
            <p className="font-black text-destructive text-sm">{order.cost ? `$${Number(order.cost).toFixed(2)}` : '—'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Mobile user card ────────────────────────────────────────────────────────
function UserCard({ u, onEdit }: any) {
  return (
    <div className="p-4 border-b border-border/40 last:border-b-0 flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center shrink-0">
        <span className="text-primary font-black text-sm">{(u.email || '?').charAt(0).toUpperCase()}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm truncate">{u.email || 'No email'}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-black tracking-wider ${
            u.role === 'admin' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
          }`}>{u.role || 'user'}</span>
          {u.referral_code && (
            <span className="font-mono text-[9px] text-amber-400">{u.referral_code}</span>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="font-black text-emerald-400 text-base">${Number(u.balance || 0).toFixed(2)}</p>
        <button onClick={onEdit}
          className="mt-1 h-7 px-3 bg-white/5 border border-white/10 rounded-lg text-[9px] font-black text-white/60 hover:text-white hover:bg-white/10 transition-all flex items-center gap-1 tap-feedback"
        >
          <Edit className="w-3 h-3" /> Edit
        </button>
      </div>
    </div>
  );
}

// ─── Toggle switch ────────────────────────────────────────────────────────────
function Toggle({
  checked,
  onChange,
  loading = false,
  label,
  colorClass = 'bg-emerald-500',
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  loading?: boolean;
  label?: string;
  colorClass?: string;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none group">
      <div
        className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${
          checked ? colorClass : 'bg-white/10'
        } ${loading ? 'opacity-50 pointer-events-none' : ''}`}
        onClick={() => !loading && onChange(!checked)}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
        {loading && (
          <span className="absolute inset-0 flex items-center justify-center">
            <RefreshCw className="w-2.5 h-2.5 text-white animate-spin" />
          </span>
        )}
      </div>
      {label && (
        <span className={`text-[10px] font-black uppercase tracking-widest ${checked ? 'text-white/80' : 'text-white/30'}`}>
          {label}
        </span>
      )}
    </label>
  );
}

// ─── Service visibility row ───────────────────────────────────────────────────
const ServiceRow = memo(function ServiceRow({
  service,
  onToggle,
  onImageSave,
}: {
  service: SmmService & { _saving?: Set<string> };
  onToggle: (serviceId: string, field: 'is_active' | 'show_in_popular' | 'is_featured', value: boolean) => void;
  onImageSave: (serviceId: string, url: string) => Promise<void>;
}) {
  const saving = (service as any)._saving as Set<string> | undefined;
  const [editingImg, setEditingImg] = useState(false);
  const [imgInput, setImgInput] = useState(service.image_url ?? '');
  const [imgSaving, setImgSaving] = useState(false);
  const icon = getServiceIcon(service.name, service.category, service.image_url);

  return (
    <div className={`border-b border-white/[0.04] last:border-0 transition-colors ${!service.is_active ? 'opacity-40' : ''}`}>
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Brand icon */}
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 overflow-hidden border border-white/10 cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
          style={{ backgroundColor: `#${icon.bgColor}` }}
          onClick={() => setEditingImg(e => !e)}
          title="Click to set custom image URL"
        >
          {icon.type === 'url' ? (
            <img src={icon.src} alt="" className="w-4 h-4 object-contain" loading="lazy"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
          ) : (
            <span className="text-sm leading-none">{icon.letter}</span>
          )}
        </div>

        {/* Service info */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-white/90 truncate leading-snug">{service.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest truncate">{service.category}</span>
            <span className="text-[9px] font-mono text-primary/50">${Number(service.rate).toFixed(3)}/1k</span>
          </div>
        </div>

        {/* Toggles */}
        <div className="flex items-center gap-4 shrink-0">
          {(['is_active', 'show_in_popular', 'is_featured'] as const).map((field) => {
            const labels: Record<string, string> = { is_active: 'Active', show_in_popular: 'Popular', is_featured: 'Featured' };
            const colors: Record<string, string> = { is_active: 'bg-emerald-500', show_in_popular: 'bg-blue-500', is_featured: 'bg-amber-500' };
            return (
              <div key={field} className="flex flex-col items-center gap-1">
                <Toggle
                  checked={service[field] as boolean}
                  onChange={v => onToggle(service.service_id, field, v)}
                  loading={saving?.has(field)}
                  colorClass={colors[field]}
                />
                <span className="text-[8px] font-black uppercase tracking-widest text-white/25">{labels[field]}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Inline image URL editor */}
      {editingImg && (
        <div className="px-4 pb-3 flex items-center gap-2">
          <input
            type="url"
            placeholder="Paste image URL (or leave empty to use auto-detect)…"
            value={imgInput}
            onChange={e => setImgInput(e.target.value)}
            className="flex-1 px-3 py-2 bg-white/[0.04] border border-white/[0.1] rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            disabled={imgSaving}
            onClick={async () => {
              setImgSaving(true);
              await onImageSave(service.service_id, imgInput.trim());
              setImgSaving(false);
              setEditingImg(false);
            }}
            className="px-3 py-2 bg-primary/10 border border-primary/20 text-primary rounded-lg text-[10px] font-black hover:bg-primary hover:text-white transition-all disabled:opacity-50 flex items-center gap-1.5"
          >
            {imgSaving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
            Save
          </button>
          <button onClick={() => setEditingImg(false)} className="px-3 py-2 bg-white/5 rounded-lg text-[10px] font-black text-white/40 hover:text-white transition-all">
            Cancel
          </button>
        </div>
      )}
    </div>
  );
});

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Admin() {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  // Core data
  const [metrics, setMetrics]   = useState({ users: 0, balance: 0, pendingDeposits: 0, failedOrders: 0 });
  const [deposits, setDeposits] = useState<any[]>([]);
  const [users, setUsers]       = useState<any[]>([]);
  const [orders, setOrders]     = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Settings
  const [japMarkup, setJapMarkup]           = useState(50);
  const [sahlMarkup, setSahlMarkup]         = useState(30);
  const [autoThreshold, setAutoThreshold]   = useState(0);
  const [savingThreshold, setSavingThreshold] = useState(false);

  // Analytics
  const [analytics, setAnalytics]     = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsDays, setAnalyticsDays]   = useState(30);

  // Bulk order management
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading]       = useState(false);

  // Services visibility management
  type ManagedService = SmmService & { _saving: Set<string> };
  const [smmServices, setSmmServices]         = useState<ManagedService[]>([]);
  const [smmServicesLoading, setSmmServicesLoading] = useState(false);
  const [smmSearchInput, setSmmSearchInput]   = useState('');  // raw input (not debounced)
  const [smmSearch, setSmmSearch]             = useState('');  // debounced value used for filtering
  const [smmCategoryFilter, setSmmCategoryFilter] = useState<string>('all');
  const [smmPage, setSmmPage]                 = useState(0);
  const [, startTransition]                   = useTransition();
  const SMM_PAGE_SIZE = 50;

  // Debounce smmSearch — avoids filtering 3000 services on every keystroke
  useEffect(() => {
    const t = setTimeout(() => { setSmmSearch(smmSearchInput); setSmmPage(0); }, 280);
    return () => clearTimeout(t);
  }, [smmSearchInput]);

  // ── Fetch main data ────────────────────────────────────────────────────────
  const fetchAdminData = useCallback(async () => {
    setLoading(true);
    try {
      const [userRes, pendingRes, balanceRes, depRes, usersList, ordersRes, settingsRes] = await Promise.all([
        // @ts-ignore
        supabase.from('users').select('*', { count: 'exact', head: true }),
        // @ts-ignore
        supabase.from('deposit_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        // @ts-ignore
        supabase.from('users').select('balance'),
        // @ts-ignore
        supabase.from('deposit_requests').select('*').order('created_at', { ascending: false }).limit(50),
        // @ts-ignore
        supabase.from('users').select('*').order('created_at', { ascending: false }).limit(200),
        // @ts-ignore
        supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(300),
        // @ts-ignore
        supabase.from('app_settings').select('*'),
      ]);

      const totalBalance = balanceRes.data?.reduce((acc: number, u: any) => acc + Number(u.balance || 0), 0) || 0;
      setMetrics({ users: userRes.count || 0, balance: totalBalance, pendingDeposits: pendingRes.count || 0, failedOrders: 0 });
      setDeposits(depRes.data || []);
      setUsers(usersList.data || []);
      setOrders(ordersRes.data || []);

      if (settingsRes.data) {
        const jm  = settingsRes.data.find((s: any) => s.key === 'jap_markup');
        const sm  = settingsRes.data.find((s: any) => s.key === 'sahl_markup');
        const at  = settingsRes.data.find((s: any) => s.key === 'auto_approve_threshold');
        if (jm) setJapMarkup(Number(jm.value));
        if (sm) setSahlMarkup(Number(sm.value));
        if (at) setAutoThreshold(Number(at.value));
      }
    } catch (err) {
      console.error('Admin fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Fetch analytics ────────────────────────────────────────────────────────
  const fetchAnalytics = useCallback(async (days = analyticsDays) => {
    setAnalyticsLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_admin_analytics', { p_days: days });
      if (error) throw error;
      setAnalytics(data);
    } catch (err) {
      console.error('Analytics error:', err);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [analyticsDays]);

  useEffect(() => { fetchAdminData(); }, [fetchAdminData]);
  useEffect(() => {
    if (activeTab === 'analytics') fetchAnalytics(analyticsDays);
  }, [activeTab, analyticsDays]);

  // ── Deposit actions ────────────────────────────────────────────────────────
  const handleDeposit = async (id: string, action: 'approve' | 'reject') => {
    try {
      if (action === 'approve') {
        // @ts-ignore
        const { error } = await supabase.rpc('approve_deposit_request', { p_request_id: id });
        if (error) throw error;
      } else {
        // @ts-ignore
        await supabase.from('deposit_requests').update({ status: 'rejected' }).eq('id', id);
      }
      fetchAdminData();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  // ── Balance edit ───────────────────────────────────────────────────────────
  const updateBalance = async (userId: string, currentBalance: number) => {
    const newBal = prompt('Enter new absolute wallet balance (USD):', String(currentBalance));
    if (newBal !== null && !isNaN(Number(newBal))) {
      // @ts-ignore
      const { error } = await supabase.from('users').update({ balance: Number(newBal) }).eq('id', userId);
      if (error) alert('Error: ' + error.message);
      else fetchAdminData();
    }
  };

  // ── Save setting ───────────────────────────────────────────────────────────
  const saveSetting = async (key: string, value: any) => {
    setLoading(true);
    try {
      // @ts-ignore
      const { error } = await supabase.from('app_settings').upsert({ key, value: String(value), updated_at: new Date().toISOString() }, { onConflict: 'key' });
      if (error) throw error;
      alert(`Saved ${key}!`);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Bulk order operations ──────────────────────────────────────────────────
  const toggleOrder = (id: string) => {
    setSelectedOrders(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedOrders.size === filteredOrders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(filteredOrders.map((o: any) => o.id)));
    }
  };

  const bulkAction = async (action: 'complete' | 'cancel' | 'refund') => {
    if (selectedOrders.size === 0) return;
    const ids = Array.from(selectedOrders);
    if (!confirm(`${action.toUpperCase()} ${ids.length} orders?`)) return;

    setBulkLoading(true);
    try {
      if (action === 'refund') {
        const { data, error } = await supabase.rpc('bulk_refund_orders', { p_order_ids: ids });
        if (error) throw error;
        alert(`Refunded ${data} orders.`);
      } else {
        const status = action === 'complete' ? 'completed' : 'canceled';
        const { data, error } = await supabase.rpc('bulk_update_order_status', {
          p_order_ids: ids,
          p_status:    status,
        });
        if (error) throw error;
        alert(`Updated ${data} orders to ${status}.`);
      }
      setSelectedOrders(new Set());
      fetchAdminData();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setBulkLoading(false);
    }
  };

  // ── SMM service fetch ──────────────────────────────────────────────────────
  const fetchSmmServices = useCallback(async () => {
    setSmmServicesLoading(true);
    try {
      // @ts-ignore
      const { data, error } = await supabase
        .from('smm_services')
        .select('service_id, name, category, rate, min, max, is_active, show_in_popular, is_featured, image_url')
        .order('category', { ascending: true })
        .order('rate', { ascending: true })
        .limit(3000);
      if (error) throw error;
      setSmmServices((data ?? []).map((s: any) => ({ ...s, _saving: new Set() })));
    } catch (err) {
      console.error('SMM services fetch error:', err);
    } finally {
      setSmmServicesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'services') fetchSmmServices();
  }, [activeTab]);

  // ── SMM visibility toggle (optimistic) ────────────────────────────────────
  const toggleServiceField = useCallback(
    async (serviceId: string, field: 'is_active' | 'show_in_popular' | 'is_featured', value: boolean) => {
      // Optimistic update + mark saving
      setSmmServices(prev =>
        prev.map(s => {
          if (s.service_id !== serviceId) return s;
          const saving = new Set(s._saving);
          saving.add(field);
          return { ...s, [field]: value, _saving: saving };
        })
      );

      try {
        // @ts-ignore
        const { error } = await supabase
          .from('smm_services')
          .update({ [field]: value })
          .eq('service_id', serviceId);
        if (error) throw error;
      } catch (err: any) {
        // Revert on failure
        setSmmServices(prev =>
          prev.map(s => {
            if (s.service_id !== serviceId) return s;
            const saving = new Set(s._saving);
            saving.delete(field);
            return { ...s, [field]: !value, _saving: saving };
          })
        );
        alert(`Failed to update ${field}: ${err.message}`);
        return;
      }

      // Clear saving flag
      setSmmServices(prev =>
        prev.map(s => {
          if (s.service_id !== serviceId) return s;
          const saving = new Set(s._saving);
          saving.delete(field);
          return { ...s, _saving: saving };
        })
      );
    },
    []
  );

  // ── Save custom image URL for a service ───────────────────────────────────
  const saveServiceImage = useCallback(async (serviceId: string, url: string) => {
    const imageUrl = url || null;
    setSmmServices(prev =>
      prev.map(s => s.service_id === serviceId ? { ...s, image_url: imageUrl } : s)
    );
    try {
      // @ts-ignore
      const { error } = await supabase
        .from('smm_services')
        .update({ image_url: imageUrl })
        .eq('service_id', serviceId);
      if (error) throw error;
    } catch (err: any) {
      alert(`Failed to save image: ${err.message}`);
      // revert
      setSmmServices(prev =>
        prev.map(s => s.service_id === serviceId ? { ...s, image_url: s.image_url } : s)
      );
    }
  }, []);

  // Memoized filters — only recompute when data or query actually changes
  const filteredUsers = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return users.filter(u => !q || (u.email || '').toLowerCase().includes(q) || u.id.includes(q));
  }, [users, searchQuery]);

  const filteredOrders = useMemo(() => {
    if (!searchQuery) return orders;
    const q = searchQuery.toLowerCase();
    return orders.filter(o =>
      o.id.includes(q) || users.find((u: any) => u.id === o.user_id)?.email?.toLowerCase().includes(q)
    );
  }, [orders, users, searchQuery]);

  // Memoized services-tab computations — avoids re-filtering 3000 rows on every render
  const smmCategories = useMemo(() =>
    ['all', ...Array.from(new Set(smmServices.map(s => s.category))).sort()],
  [smmServices]);

  const smmDisplayedServices = useMemo(() => {
    const q = smmSearch.toLowerCase();
    return smmServices.filter(s => {
      const matchCat    = smmCategoryFilter === 'all' || s.category === smmCategoryFilter;
      const matchSearch = !q || s.name.toLowerCase().includes(q) || String(s.service_id).toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [smmServices, smmCategoryFilter, smmSearch]);

  const smmPaginated  = useMemo(() =>
    smmDisplayedServices.slice(smmPage * SMM_PAGE_SIZE, (smmPage + 1) * SMM_PAGE_SIZE),
  [smmDisplayedServices, smmPage, SMM_PAGE_SIZE]);

  const smmTotalPages = useMemo(() =>
    Math.ceil(smmDisplayedServices.length / SMM_PAGE_SIZE),
  [smmDisplayedServices.length, SMM_PAGE_SIZE]);

  const smmStatCounts = useMemo(() => {
    let active = 0, popular = 0, featured = 0;
    for (const s of smmServices) {
      if (s.is_active) { active++; if (s.show_in_popular) popular++; if (s.is_featured) featured++; }
    }
    return { active, popular, featured };
  }, [smmServices]);

  const TABS = [
    { id: 'overview',  label: 'Overview',  icon: LayoutDashboard },
    { id: 'analytics', label: 'Analytics', icon: BarChart2 },
    { id: 'orders',    label: 'Orders',    icon: ShoppingCart },
    { id: 'users',     label: 'Users',     icon: UsersIcon },
    { id: 'deposits',  label: 'Deposits',  icon: DollarSign },
    { id: 'services',  label: 'Services',  icon: Layers },
    { id: 'settings',  label: 'Settings',  icon: Settings },
  ];

  return (
    <div className="animate-in fade-in duration-500 pb-28 lg:pb-20 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-5 sm:mb-7">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="p-2 sm:p-3 bg-gradient-to-br from-red-500/20 to-purple-500/20 rounded-xl border border-red-500/20 shrink-0">
            <Shield className="w-4 h-4 sm:w-6 sm:h-6 text-red-400" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black bg-gradient-to-r from-red-400 to-purple-400 bg-clip-text text-transparent tracking-tight">Admin Engine</h1>
            <p className="text-white/30 text-[8px] sm:text-[10px] uppercase tracking-[0.25em] font-black">System Control</p>
          </div>
        </div>
        <button
          type="button"
          onClick={fetchAdminData}
          disabled={loading}
          className="h-9 px-3.5 sm:px-5 bg-white/[0.05] border border-white/[0.09] rounded-xl font-black text-[10px] text-white/60 hover:text-white hover:bg-white/[0.09] transition-all flex items-center gap-2 disabled:opacity-40 tap-feedback shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-primary' : ''}`} />
          <span className="hidden sm:inline">Sync</span>
        </button>
      </div>

      {/* Tabs — icon-only on tiny screens, label on sm+ */}
      <div className="flex overflow-x-auto gap-1 mb-5 sm:mb-7 bg-white/[0.03] p-1 rounded-2xl border border-white/[0.07] no-scrollbar scrollbar-hide">
        {TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex-shrink-0 px-3 sm:px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 text-[9px] sm:text-[11px] font-black transition-all whitespace-nowrap tap-feedback ${
              activeTab === tab.id
                ? 'bg-primary text-white shadow-lg shadow-primary/25'
                : 'text-white/35 hover:text-white/70 hover:bg-white/[0.05]'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ───────────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-4 sm:space-y-6 animate-in slide-in-from-left-4 duration-500">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <MetricCard label="Total Users"      value={metrics.users}            icon={UsersIcon}   color="text-blue-500"    bg="bg-blue-500/10 border-blue-500/20" />
            <MetricCard label="System Liability" value={fmt(metrics.balance)}     icon={DollarSign}  color="text-amber-500"   bg="bg-amber-500/10 border-amber-500/20" />
            <MetricCard label="Pending Deposits" value={metrics.pendingDeposits}  icon={Clock}       color="text-purple-500"  bg="bg-purple-500/10 border-purple-500/20" />
            <MetricCard label="System Health"    value="Operational"              icon={Activity}    color="text-emerald-500" bg="bg-emerald-500/10 border-emerald-500/20" />
          </div>
          <div className="bg-card border border-border rounded-[2rem] p-6 sm:p-8 text-center">
            <Activity className="w-10 h-10 sm:w-12 sm:h-12 text-primary/20 mx-auto mb-3 sm:mb-4" />
            <h3 className="text-lg sm:text-xl font-bold mb-2">System is running normally</h3>
            <p className="text-muted-foreground max-w-sm mx-auto text-xs sm:text-sm px-4">All databases, proxy edges, and CRON logic are properly routed. SMM APIs are live.</p>
          </div>
        </div>
      )}

      {/* ── ANALYTICS ──────────────────────────────────────────────────────── */}
      {activeTab === 'analytics' && (
        <div className="space-y-6 animate-in slide-in-from-left-4 duration-500">
          {/* Period selector */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground shrink-0">Period:</span>
            {[7, 14, 30, 90].map(d => (
              <button
                key={d}
                onClick={() => { setAnalyticsDays(d); fetchAnalytics(d); }}
                className={`px-3 sm:px-4 py-2 rounded-xl text-[10px] sm:text-[11px] font-black transition-all tap-feedback ${
                  analyticsDays === d ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white/5 text-muted-foreground hover:bg-white/10'
                }`}
              >
                {d}D
              </button>
            ))}
            <button onClick={() => fetchAnalytics(analyticsDays)} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all tap-feedback ml-auto sm:ml-0">
              <RefreshCw className={`w-4 h-4 ${analyticsLoading ? 'animate-spin text-primary' : 'text-muted-foreground'}`} />
            </button>
          </div>

          {analyticsLoading && !analytics ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-32 bg-card border border-border rounded-[2rem] animate-pulse" />
              ))}
            </div>
          ) : analytics ? (
            <>
              {/* KPI row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard label="Total Revenue"    value={fmt(analytics.total_revenue)}   icon={TrendingUp}  color="text-emerald-500" bg="bg-emerald-500/10 border-emerald-500/20" />
                <MetricCard label="Total Orders"     value={analytics.total_orders}         icon={Package}     color="text-blue-500"    bg="bg-blue-500/10 border-blue-500/20" />
                <MetricCard label="New Users"        value={analytics.new_users}            icon={UsersIcon}   color="text-violet-500"  bg="bg-violet-500/10 border-violet-500/20" />
                <MetricCard label="Avg Order Value"  value={fmt(analytics.avg_order_value)} icon={DollarSign}  color="text-amber-500"   bg="bg-amber-500/10 border-amber-500/20" />
              </div>

              {/* Revenue area chart */}
              <div className="bg-card border border-border rounded-[2rem] p-6">
                <h3 className="font-black text-base mb-6 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-500" /> Daily Revenue
                </h3>
                {analytics.daily_revenue?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={analytics.daily_revenue}>
                      <defs>
                        <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#888' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#888' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                      <Tooltip content={<ChartTooltip />} />
                      <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#10b981" strokeWidth={2} fill="url(#revGrad)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center text-muted-foreground text-sm py-10 opacity-40">No revenue data in this period.</p>
                )}
              </div>

              {/* Orders bar + status pie */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Daily orders bar */}
                <div className="bg-card border border-border rounded-[2rem] p-6">
                  <h3 className="font-black text-base mb-6 flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-blue-500" /> Daily Orders
                  </h3>
                  {analytics.daily_orders?.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={analytics.daily_orders}>
                        <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#888' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: '#888' }} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="orders" name="Orders" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-muted-foreground text-sm py-10 opacity-40">No order data.</p>
                  )}
                </div>

                {/* Status breakdown pie */}
                <div className="bg-card border border-border rounded-[2rem] p-6">
                  <h3 className="font-black text-base mb-6 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-violet-500" /> Order Status
                  </h3>
                  {analytics.status_breakdown?.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={analytics.status_breakdown}
                          dataKey="count"
                          nameKey="status"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          innerRadius={50}
                          label={({ status, percent }) => `${status} ${(percent * 100).toFixed(0)}%`}
                          labelLine={false}
                        >
                          {analytics.status_breakdown.map((_: any, i: number) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v, n) => [v, n]} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-muted-foreground text-sm py-10 opacity-40">No data.</p>
                  )}
                </div>
              </div>

              {/* Top services */}
              {analytics.top_services?.length > 0 && (
                <div className="bg-card border border-border rounded-[2rem] p-6">
                  <h3 className="font-black text-base mb-4 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-500" /> Top Services by Volume
                  </h3>
                  <div className="space-y-3">
                    {analytics.top_services.map((s: any, i: number) => (
                      <div key={i} className="flex items-center gap-4">
                        <span className="text-[10px] font-black text-muted-foreground w-4">{i + 1}</span>
                        <div className="flex-1">
                          <div className="flex justify-between mb-1">
                            <span className="text-xs font-black">Service #{s.service_id}</span>
                            <span className="text-xs font-black text-emerald-500">{fmt(s.revenue)}</span>
                          </div>
                          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full"
                              style={{ width: `${(s.count / analytics.top_services[0].count) * 100}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-[10px] font-black text-muted-foreground w-12 text-right">{s.count} orders</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-card border border-border rounded-[2rem] p-20 text-center">
              <BarChart2 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground text-sm font-black uppercase tracking-widest opacity-30">No analytics data yet.</p>
            </div>
          )}
        </div>
      )}

      {/* ── ORDERS ─────────────────────────────────────────────────────────── */}
      {activeTab === 'orders' && (
        <div className="space-y-3 sm:space-y-4 animate-in slide-in-from-left-4 duration-500">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              placeholder="Search email or order ID…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 text-sm bg-white/[0.04] border border-white/[0.09] rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/40 font-bold placeholder:text-white/25 text-white"
            />
          </div>

          {/* Bulk toolbar — shows when items selected */}
          {selectedOrders.size > 0 && (
            <div className="flex items-center gap-2 p-3 bg-primary/8 border border-primary/20 rounded-2xl overflow-x-auto no-scrollbar animate-in slide-in-from-top-2 duration-200">
              <span className="text-[10px] font-black text-primary uppercase tracking-widest shrink-0">
                {selectedOrders.size} sel.
              </span>
              <button onClick={() => bulkAction('complete')} disabled={bulkLoading}
                className="h-8 px-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 rounded-xl text-[10px] font-black hover:bg-emerald-500 hover:text-white transition-all flex items-center gap-1.5 shrink-0 tap-feedback"
              ><CheckCircle2 className="w-3 h-3" /> Done</button>
              <button onClick={() => bulkAction('cancel')} disabled={bulkLoading}
                className="h-8 px-3 bg-amber-500/10 text-amber-400 border border-amber-500/25 rounded-xl text-[10px] font-black hover:bg-amber-500 hover:text-white transition-all flex items-center gap-1.5 shrink-0 tap-feedback"
              ><XCircle className="w-3 h-3" /> Cancel</button>
              <button onClick={() => bulkAction('refund')} disabled={bulkLoading}
                className="h-8 px-3 bg-red-500/10 text-red-400 border border-red-500/25 rounded-xl text-[10px] font-black hover:bg-red-500 hover:text-white transition-all flex items-center gap-1.5 shrink-0 tap-feedback"
              ><Trash2 className="w-3 h-3" /> Refund</button>
              <button onClick={() => setSelectedOrders(new Set())}
                className="h-8 w-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center shrink-0 tap-feedback ml-auto"
              ><XCircle className="w-3.5 h-3.5 text-white/40" /></button>
            </div>
          )}

          {/* Orders card */}
          <div className="bg-card border border-border rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden shadow-lg">
            <div className="px-4 sm:px-6 py-4 border-b border-border/50 bg-muted/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button type="button" onClick={toggleSelectAll} className="tap-feedback">
                  {selectedOrders.size === filteredOrders.length && filteredOrders.length > 0
                    ? <CheckSquare className="w-4 h-4 text-primary" />
                    : <Square className="w-4 h-4 text-muted-foreground" />
                  }
                </button>
                <h2 className="font-black text-sm sm:text-base flex items-center gap-2">
                  <ListOrdered className="w-4 h-4 text-primary" /> Orders
                  <span className="text-white/30">({filteredOrders.length})</span>
                </h2>
              </div>
              {bulkLoading && <RefreshCw className="w-4 h-4 animate-spin text-primary" />}
            </div>

            {/* Mobile card list */}
            <div className="md:hidden divide-y divide-border/40 max-h-[60vh] overflow-y-auto scrollbar-hide">
              {filteredOrders.map((o: any) => (
                <OrderCard
                  key={o.id}
                  order={o}
                  user={users.find((u: any) => u.id === o.user_id)}
                  selected={selectedOrders.has(o.id)}
                  onToggle={() => toggleOrder(o.id)}
                />
              ))}
              {filteredOrders.length === 0 && (
                <p className="py-16 text-center text-white/20 text-xs font-black uppercase tracking-widest">No orders found.</p>
              )}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block table-responsive">
              <table className="w-full text-sm text-left min-w-[700px]">
                <thead className="text-[10px] uppercase bg-muted/40 text-muted-foreground font-black tracking-widest">
                  <tr>
                    <th className="px-4 py-4">
                      <button type="button" onClick={toggleSelectAll} className="p-1 hover:text-primary transition-colors">
                        {selectedOrders.size === filteredOrders.length && filteredOrders.length > 0
                          ? <CheckSquare className="w-4 h-4 text-primary" />
                          : <Square className="w-4 h-4" />
                        }
                      </button>
                    </th>
                    <th className="px-4 py-4">Order</th>
                    <th className="px-4 py-4">User</th>
                    <th className="px-4 py-4">Service</th>
                    <th className="px-4 py-4">Cost</th>
                    <th className="px-4 py-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filteredOrders.map((o: any) => (
                    <tr key={o.id} className={`hover:bg-muted/30 transition-colors ${selectedOrders.has(o.id) ? 'bg-primary/5' : ''}`}>
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => toggleOrder(o.id)} className="p-1 hover:text-primary transition-colors tap-feedback">
                          {selectedOrders.has(o.id) ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4 text-muted-foreground" />}
                        </button>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs opacity-50">#{o.id.substring(0, 8)}</td>
                      <td className="px-4 py-3 text-xs font-bold max-w-[160px] truncate">{users.find((u: any) => u.id === o.user_id)?.email || o.user_id?.substring(0, 8)}</td>
                      <td className="px-4 py-3 text-xs"><span className="font-black">#{o.service_id}</span> <span className="text-muted-foreground">·{o.quantity || '—'}</span></td>
                      <td className="px-4 py-3 font-black text-destructive text-sm">{o.cost ? `$${Number(o.cost).toFixed(2)}` : '—'}</td>
                      <td className="px-4 py-3 text-right"><StatusPill status={o.status} /></td>
                    </tr>
                  ))}
                  {filteredOrders.length === 0 && (
                    <tr><td colSpan={6} className="py-16 text-center text-muted-foreground font-bold">No orders found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── USERS ──────────────────────────────────────────────────────────── */}
      {activeTab === 'users' && (
        <div className="space-y-3 animate-in slide-in-from-left-4 duration-500">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              placeholder="Search by email…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 text-sm bg-white/[0.04] border border-white/[0.09] rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/40 font-bold placeholder:text-white/25 text-white"
            />
          </div>

          <div className="bg-card border border-border rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden shadow-lg">
            <div className="px-4 sm:px-6 py-4 border-b border-border/50 bg-muted/20 flex items-center justify-between">
              <h2 className="font-black text-sm sm:text-base flex items-center gap-2">
                <UsersIcon className="w-4 h-4 text-primary" /> Users
                <span className="text-white/30">({filteredUsers.length})</span>
              </h2>
            </div>

            {/* Mobile card list */}
            <div className="md:hidden divide-y divide-border/40 max-h-[65vh] overflow-y-auto scrollbar-hide">
              {filteredUsers.map((u: any) => (
                <UserCard key={u.id} u={u} onEdit={() => updateBalance(u.id, Number(u.balance || 0))} />
              ))}
              {filteredUsers.length === 0 && (
                <p className="py-16 text-center text-white/20 text-xs font-black uppercase tracking-widest">No users found.</p>
              )}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block table-responsive">
              <table className="w-full text-sm text-left min-w-[700px]">
                <thead className="text-[10px] uppercase bg-muted/40 text-muted-foreground font-black tracking-widest">
                  <tr>
                    <th className="px-4 py-4">User</th>
                    <th className="px-4 py-4">Role</th>
                    <th className="px-4 py-4">Referral</th>
                    <th className="px-4 py-4">Balance</th>
                    <th className="px-4 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filteredUsers.map((u: any) => (
                    <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-4">
                        <p className="font-bold text-sm">{u.email || 'No email'}</p>
                        <p className="font-mono text-[9px] text-muted-foreground opacity-40">{u.id.substring(0, 12)}</p>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-2.5 py-1 rounded-lg text-[9px] uppercase font-black tracking-wider ${
                          u.role === 'admin' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        }`}>{u.role || 'user'}</span>
                      </td>
                      <td className="px-4 py-4 font-mono text-[10px] text-amber-400 font-black">{u.referral_code || '—'}</td>
                      <td className="px-4 py-4 font-black text-emerald-400 text-base">${Number(u.balance || 0).toFixed(2)}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-black px-2 py-1 rounded-lg border"
                            style={{ color: ['#9CA3AF','#6B7280','#93C5FD','#60A5FA','#A78BFA','#8B5CF6','#FCD34D','#F59E0B','#F97316','#EC4899'][(u.vip_level||1)-1], borderColor: ['#9CA3AF','#6B7280','#93C5FD','#60A5FA','#A78BFA','#8B5CF6','#FCD34D','#F59E0B','#F97316','#EC4899'][(u.vip_level||1)-1] + '40', backgroundColor: ['#9CA3AF','#6B7280','#93C5FD','#60A5FA','#A78BFA','#8B5CF6','#FCD34D','#F59E0B','#F97316','#EC4899'][(u.vip_level||1)-1] + '15' }}>
                            VIP {u.vip_level || 1}
                          </span>
                          <select
                            defaultValue={u.vip_level || 1}
                            onChange={async (e) => {
                              const lvl = Number(e.target.value);
                              // @ts-ignore
                              const { error } = await supabase.rpc('admin_set_vip', { p_user_id: u.id, p_level: lvl });
                              if (error) alert('Error: ' + error.message);
                              else { u.vip_level = lvl; fetchAdminData(); }
                            }}
                            className="h-7 px-2 bg-white/5 border border-white/10 rounded-lg text-[9px] font-black text-white/60 focus:outline-none focus:ring-1 focus:ring-primary"
                          >
                            {[1,2,3,4,5,6,7,8,9,10].map(l => <option key={l} value={l}>Set VIP {l}</option>)}
                          </select>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button onClick={() => updateBalance(u.id, Number(u.balance || 0))}
                          className="h-8 px-3 bg-white/5 border border-white/10 hover:border-primary hover:text-primary rounded-xl transition-all text-xs font-black flex items-center gap-1.5 ml-auto tap-feedback"
                        ><Edit className="w-3 h-3" /> Adjust</button>
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && <tr><td colSpan={6} className="py-16 text-center text-muted-foreground">No users found.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── DEPOSITS ───────────────────────────────────────────────────────── */}
      {activeTab === 'deposits' && (
        <div className="space-y-3 sm:space-y-4 animate-in slide-in-from-left-4 duration-500">
          {autoThreshold > 0 && (
            <div className="flex items-center gap-2.5 bg-emerald-500/8 border border-emerald-500/20 rounded-2xl px-4 py-3">
              <Zap className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <p className="text-[10px] font-black text-emerald-400">
                Auto-approve ON — deposits ≤ ${autoThreshold} instant.
              </p>
            </div>
          )}

          <div className="bg-card border border-border rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden shadow-lg">
            <div className="px-4 sm:px-6 py-4 border-b border-border/50 bg-muted/20 flex items-center justify-between">
              <h2 className="font-black text-sm sm:text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" /> Deposits
                <span className="text-white/30">({deposits.length})</span>
              </h2>
              {deposits.filter((d: any) => d.status === 'pending').length > 0 && (
                <span className="text-[9px] font-black bg-amber-500/15 text-amber-400 border border-amber-500/25 px-2.5 py-1 rounded-full">
                  {deposits.filter((d: any) => d.status === 'pending').length} pending
                </span>
              )}
            </div>

            {/* Mobile card list (primary view) */}
            <div className="md:hidden divide-y divide-border/40 max-h-[70vh] overflow-y-auto scrollbar-hide">
              {deposits.map((dep: any) => (
                <DepositCard
                  key={dep.id}
                  dep={dep}
                  userEmail={users.find((u: any) => u.id === dep.user_id)?.email}
                  onApprove={() => handleDeposit(dep.id, 'approve')}
                  onDeny={() => handleDeposit(dep.id, 'reject')}
                />
              ))}
              {deposits.length === 0 && (
                <p className="py-16 text-center text-white/20 text-xs font-black uppercase tracking-widest">No deposit requests.</p>
              )}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block table-responsive">
              <table className="w-full text-sm text-left min-w-[700px]">
                <thead className="text-[10px] uppercase bg-muted/40 text-muted-foreground font-black tracking-widest">
                  <tr>
                    <th className="px-4 py-4">User</th>
                    <th className="px-4 py-4">Amount</th>
                    <th className="px-4 py-4">Method / Proof</th>
                    <th className="px-4 py-4">Status</th>
                    <th className="px-4 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {deposits.map((dep: any) => (
                    <tr key={dep.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-4">
                        <p className="font-bold text-sm">{users.find((u: any) => u.id === dep.user_id)?.email || 'N/A'}</p>
                        <p className="font-mono text-[9px] text-muted-foreground opacity-40">{dep.user_id?.substring(0, 12)}</p>
                      </td>
                      <td className="px-4 py-4 font-black text-emerald-400 text-base">+${Number(dep.amount).toFixed(2)}</td>
                      <td className="px-4 py-4 text-xs">
                        <p className="font-black uppercase tracking-wider">{dep.method}</p>
                        {dep.proof && <a href={dep.proof} target="_blank" rel="noreferrer" className="text-blue-400 underline text-[10px]">View Proof ↗</a>}
                      </td>
                      <td className="px-4 py-4"><StatusPill status={dep.status} /></td>
                      <td className="px-4 py-4 text-right">
                        {dep.status === 'pending' ? (
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => handleDeposit(dep.id, 'approve')}
                              className="h-8 px-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white rounded-xl transition-all text-[10px] font-black flex items-center gap-1.5 tap-feedback"
                            ><CheckCircle2 className="w-3 h-3" /> Approve</button>
                            <button onClick={() => handleDeposit(dep.id, 'reject')}
                              className="h-8 px-3 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-white rounded-xl transition-all text-[10px] font-black flex items-center gap-1.5 tap-feedback"
                            ><XCircle className="w-3 h-3" /> Deny</button>
                          </div>
                        ) : (
                          <span className="text-white/25 text-[9px] font-black uppercase">Done</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {deposits.length === 0 && <tr><td colSpan={5} className="py-16 text-center text-muted-foreground">No deposits.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── SERVICES ───────────────────────────────────────────────────────── */}
      {activeTab === 'services' && (
        <div className="space-y-4 sm:space-y-5 animate-in slide-in-from-left-4 duration-500">
            {/* Header row */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-0">
                <h2 className="font-black text-lg sm:text-xl flex items-center gap-2">
                  <Layers className="w-5 h-5 text-primary" /> Service Visibility
                </h2>
                <p className="text-muted-foreground text-xs mt-0.5">Control which services are visible and where they appear.</p>
              </div>
              <button
                onClick={() => { setSmmPage(0); fetchSmmServices(); }}
                disabled={smmServicesLoading}
                className="h-9 px-4 bg-white/[0.05] border border-white/[0.09] rounded-xl font-black text-[10px] text-white/60 hover:text-white hover:bg-white/[0.09] transition-all flex items-center gap-2 disabled:opacity-40 tap-feedback shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${smmServicesLoading ? 'animate-spin text-primary' : ''}`} />
                Refresh
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Active', value: smmStatCounts.active, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', icon: Eye },
                { label: 'In Popular', value: smmStatCounts.popular, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', icon: Flame },
                { label: 'Featured', value: smmStatCounts.featured, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', icon: Star },
              ].map(({ label, value, color, bg, icon: Icon }) => (
                <div key={label} className={`border rounded-2xl p-4 flex items-center gap-3 ${bg}`}>
                  <Icon className={`w-5 h-5 shrink-0 ${color}`} />
                  <div>
                    <p className={`text-xl font-black ${color}`}>{value}</p>
                    <p className="text-[9px] font-black uppercase tracking-widest text-white/30">{label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-3 text-[9px] font-black uppercase tracking-widest text-white/40">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Active — visible in all tabs</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" /> Popular — shown in 🔥 Popular tab</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> Featured — highlighted hero section</span>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search services..."
                  value={smmSearchInput}
                  onChange={e => setSmmSearchInput(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                />
              </div>
              <select
                value={smmCategoryFilter}
                onChange={e => { startTransition(() => { setSmmCategoryFilter(e.target.value); setSmmPage(0); }); }}
                className="px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary sm:w-56"
              >
                {smmCategories.map(c => (
                  <option key={c} value={c}>{c === 'all' ? 'All Categories' : c}</option>
                ))}
              </select>
            </div>

            {/* Table */}
            <div className="bg-card border border-border rounded-[1.5rem] overflow-hidden">
              {/* Column headers */}
              <div className="flex items-center gap-3 px-4 py-2.5 bg-white/[0.03] border-b border-white/[0.06]">
                <span className="flex-1 text-[9px] font-black uppercase tracking-widest text-white/30">Service</span>
                <div className="flex items-center gap-4 shrink-0 pr-1">
                  <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500/60 w-14 text-center">Active</span>
                  <span className="text-[9px] font-black uppercase tracking-widest text-blue-500/60 w-14 text-center">Popular</span>
                  <span className="text-[9px] font-black uppercase tracking-widest text-amber-500/60 w-14 text-center">Featured</span>
                </div>
              </div>

              {smmServicesLoading ? (
                <div className="py-16 flex flex-col items-center gap-3 text-muted-foreground">
                  <RefreshCw className="w-6 h-6 animate-spin" />
                  <p className="text-xs font-bold">Loading services…</p>
                </div>
              ) : smmPaginated.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground">
                  <EyeOff className="w-8 h-8 mx-auto mb-3 opacity-30" />
                  <p className="text-xs font-bold">No services match your filters.</p>
                </div>
              ) : (
                smmPaginated.map(service => (
                  <ServiceRow key={service.service_id} service={service as any} onToggle={toggleServiceField} onImageSave={saveServiceImage} />
                ))
              )}
            </div>

            {/* Pagination */}
            {smmTotalPages > 1 && (
              <div className="flex items-center justify-between text-[10px] font-black text-white/40">
                <span>{smmDisplayedServices.length} services · page {smmPage + 1}/{smmTotalPages}</span>
                <div className="flex gap-2">
                  <button
                    disabled={smmPage === 0}
                    onClick={() => setSmmPage(p => p - 1)}
                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-all"
                  >← Prev</button>
                  <button
                    disabled={smmPage >= smmTotalPages - 1}
                    onClick={() => setSmmPage(p => p + 1)}
                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-all"
                  >Next →</button>
                </div>
              </div>
            )}
          </div>
      )}

      {/* ── SETTINGS ───────────────────────────────────────────────────────── */}
      {activeTab === 'settings' && (
        <div className="space-y-4 sm:space-y-6 animate-in slide-in-from-left-4 duration-500">

          {/* ── AUTO-APPROVE ── */}
          <div className="bg-card border border-border rounded-[1.5rem] sm:rounded-[2rem] p-5 sm:p-8">
            <h2 className="font-black text-lg sm:text-xl flex items-center gap-2 sm:gap-3 mb-2">
              <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-500" /> Auto-Approve Deposits
            </h2>
            <p className="text-muted-foreground text-sm mb-5 sm:mb-6">Any deposit ≤ threshold is approved instantly with no manual review.</p>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-muted-foreground">$</span>
                <input
                  type="number"
                  value={autoThreshold}
                  min={0}
                  step={5}
                  onChange={e => setAutoThreshold(Number(e.target.value))}
                  className="px-4 py-3 border border-border rounded-xl bg-background w-28 font-mono text-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <button
                onClick={async () => {
                  setSavingThreshold(true);
                  await saveSetting('auto_approve_threshold', autoThreshold);
                  setSavingThreshold(false);
                }}
                disabled={savingThreshold}
                className="px-5 sm:px-6 py-3 bg-emerald-600 text-white font-black rounded-2xl hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50 tap-feedback"
              >
                {savingThreshold ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Save
              </button>
            </div>

            <div className="mt-4 flex items-start gap-2 text-[11px] font-black text-amber-400/70 bg-amber-500/5 border border-amber-500/10 rounded-xl px-4 py-3">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              Set to $0 to disable. Only raise this for trusted payment methods with verified proofs.
            </div>
          </div>

          {/* ── JAP SYNC ── */}
          <div className="bg-card border border-border rounded-[1.5rem] sm:rounded-[2rem] p-5 sm:p-8 flex flex-col gap-5">
            <div>
              <h3 className="font-black text-base sm:text-lg mb-3">JAP — Profit Margin (%)</h3>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xl font-bold">+</span>
                <input type="number" value={japMarkup} onChange={e => setJapMarkup(Number(e.target.value))} className="px-4 py-3 border border-border rounded-xl bg-background w-28 font-mono text-lg focus:ring-2 focus:ring-primary" />
                <span className="text-xl font-bold">%</span>
                <button onClick={() => saveSetting('jap_markup', japMarkup)} className="ms-2 px-4 py-2 bg-primary/10 text-primary border border-primary/20 rounded-lg text-xs font-bold hover:bg-primary hover:text-white transition-all tap-feedback">Save</button>
              </div>
            </div>
            <button
              onClick={async () => {
                setLoading(true);
                try {
                  const markup = 1 + (japMarkup / 100);
                  const { data: userData } = await supabase.auth.getUser();
                  if (!userData?.user) throw new Error('Not authenticated.');
                  const { data, error } = await supabase.functions.invoke('supplier-proxy', { body: { action: 'services' } });
                  if (error) throw error;
                  if (!Array.isArray(data)) throw new Error('Invalid API response.');
                  // @ts-ignore
                  const batch = data.map(s => ({ service_id: String(s.service), name: s.name, category: s.category, rate: Number(s.rate) * markup, min: Number(s.min), max: Number(s.max) }));
                  for (let i = 0; i < batch.length; i += 500) {
                    // @ts-ignore
                    const { error: e } = await supabase.from('smm_services').upsert(batch.slice(i, i + 500), { onConflict: 'service_id' });
                    if (e) throw e;
                  }
                  alert(`Synced ${batch.length} JAP services!`);
                } catch (err: any) { alert(err.message); }
                setLoading(false);
              }}
              disabled={loading}
              className="w-full sm:w-auto sm:self-start px-6 sm:px-8 py-3.5 sm:py-4 bg-primary text-primary-foreground font-black rounded-2xl hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-xl shadow-primary/20 tap-feedback"
            >
              <RefreshCw className={`w-5 h-5 sm:w-6 sm:h-6 ${loading ? 'animate-spin' : ''}`} /> Sync JAP Services
            </button>
          </div>

          {/* ── SAHL CASH SYNC ── */}
          <div className="bg-gradient-to-br from-emerald-500/5 to-blue-500/5 border border-emerald-500/20 rounded-[1.5rem] sm:rounded-[2rem] p-5 sm:p-8 flex flex-col gap-5">
            <div>
              <h3 className="font-black text-base sm:text-lg mb-3">🎮 Sahl Cash — Markup (%)</h3>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xl font-bold">+</span>
                <input type="number" value={sahlMarkup} onChange={e => setSahlMarkup(Number(e.target.value))} className="px-4 py-3 border border-border rounded-xl bg-background w-28 font-mono text-lg focus:ring-2 focus:ring-emerald-500" />
                <span className="text-xl font-bold">%</span>
                <button onClick={() => saveSetting('sahl_markup', sahlMarkup)} className="ms-2 px-4 py-2 bg-emerald-600/10 text-emerald-600 border border-emerald-500/20 rounded-lg text-xs font-bold hover:bg-emerald-600 hover:text-white transition-all tap-feedback">Save</button>
              </div>
            </div>
            <button
              onClick={async () => {
                setLoading(true);
                try {
                  const markup = 1 + (sahlMarkup / 100);
                  const { data: userData } = await supabase.auth.getUser();
                  if (!userData?.user) throw new Error('Not authenticated.');
                  const { data, error } = await supabase.functions.invoke('sahl-cash-proxy', { body: { action: 'products' } });
                  if (error) throw error;
                  if (!Array.isArray(data)) throw new Error('Invalid response from sahl-cash-proxy.');
                  // @ts-ignore
                  const batch = data.filter((p: any) => p.available).map((p: any) => ({ service_id: `sahl_${p.id}`, name: p.name, category: `🎮 ${p.category_name || 'Game Recharge'}`, rate: Number(p.price) * markup * 1000, min: p.qty_values?.min ? Number(p.qty_values.min) : 1, max: p.qty_values?.max ? Number(p.qty_values.max) : 1 }));
                  for (let i = 0; i < batch.length; i += 500) {
                    // @ts-ignore
                    const { error: e } = await supabase.from('smm_services').upsert(batch.slice(i, i + 500), { onConflict: 'service_id' });
                    if (e) throw e;
                  }
                  alert(`Synced ${batch.length} Sahl Cash products!`);
                } catch (err: any) { alert(err.message); }
                setLoading(false);
              }}
              disabled={loading}
              className="w-full sm:w-auto sm:self-start px-6 sm:px-8 py-3.5 sm:py-4 bg-gradient-to-r from-emerald-500 to-blue-500 text-white font-black rounded-2xl hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-xl shadow-emerald-500/20 tap-feedback"
            >
              <RefreshCw className={`w-5 h-5 sm:w-6 sm:h-6 ${loading ? 'animate-spin' : ''}`} /> Sync Sahl Cash
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
