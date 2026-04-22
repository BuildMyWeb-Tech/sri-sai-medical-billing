'use client';
/**
 * components/store/SyncStatusBadge.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Visual indicator for the POS sync engine state.
 *
 * VARIANTS
 * ────────
 * compact   — icon + label only (topbar usage)
 * detailed  — expandable panel with queue depth, last sync time, error
 * dot       — single colored dot (minimal)
 *
 * STATES
 * ──────
 * online    — green  — all synced
 * syncing   — blue   — actively sending bills
 * pending   — amber  — queue has unsent bills
 * offline   — slate  — no network
 * error     — red    — sync failed, retrying
 *
 * USAGE
 * ─────
 * <SyncStatusBadge status={pos.syncStatus} />
 * <SyncStatusBadge status={pos.syncStatus} variant="detailed" onSyncNow={pos.syncNow} />
 * <SyncStatusBadge status={pos.syncStatus} variant="dot" />
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useRef } from 'react';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock,
  CloudOff,
  Cloud,
  CloudLightning,
  ChevronDown,
  ChevronUp,
  Zap,
} from 'lucide-react';

// ─── Time helpers ─────────────────────────────────────────────────────────────

function timeAgo(ts) {
  if (!ts) return 'Never';
  const diff = Date.now() - ts;
  if (diff < 10_000) return 'Just now';
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

// ─── State → visual config ────────────────────────────────────────────────────

function getConfig(status) {
  const { state, queueDepth, online } = status;

  if (!online) {
    return {
      key:       'offline',
      dot:       'bg-slate-400',
      ring:      'ring-slate-200',
      bg:        'bg-slate-50',
      border:    'border-slate-200',
      text:      'text-slate-600',
      label:     'Offline',
      sublabel:  queueDepth > 0 ? `${queueDepth} queued` : 'No network',
      Icon:      WifiOff,
      iconCls:   'text-slate-500',
      animate:   false,
    };
  }

  if (state === 'syncing') {
    return {
      key:       'syncing',
      dot:       'bg-blue-500',
      ring:      'ring-blue-200',
      bg:        'bg-blue-50',
      border:    'border-blue-200',
      text:      'text-blue-700',
      label:     'Syncing',
      sublabel:  queueDepth > 0 ? `${queueDepth} bill${queueDepth > 1 ? 's' : ''}` : '',
      Icon:      RefreshCw,
      iconCls:   'text-blue-600 animate-spin',
      animate:   true,
    };
  }

  if (state === 'error') {
    return {
      key:       'error',
      dot:       'bg-red-500',
      ring:      'ring-red-200',
      bg:        'bg-red-50',
      border:    'border-red-200',
      text:      'text-red-700',
      label:     'Sync error',
      sublabel:  queueDepth > 0 ? `${queueDepth} pending` : 'Retrying…',
      Icon:      AlertCircle,
      iconCls:   'text-red-600',
      animate:   false,
    };
  }

  if (queueDepth > 0) {
    return {
      key:       'pending',
      dot:       'bg-amber-400',
      ring:      'ring-amber-200',
      bg:        'bg-amber-50',
      border:    'border-amber-200',
      text:      'text-amber-800',
      label:     `${queueDepth} unsynced`,
      sublabel:  'Queued',
      Icon:      CloudLightning,
      iconCls:   'text-amber-600',
      animate:   false,
    };
  }

  // Idle + online + empty queue
  return {
    key:       'synced',
    dot:       'bg-emerald-400',
    ring:      'ring-emerald-100',
    bg:        'bg-emerald-50',
    border:    'border-emerald-200',
    text:      'text-emerald-700',
    label:     'Synced',
    sublabel:  status.lastSyncAt ? `Last: ${timeAgo(status.lastSyncAt)}` : 'Online',
    Icon:      CheckCircle,
    iconCls:   'text-emerald-600',
    animate:   false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ── DOT VARIANT ──────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

function DotBadge({ status }) {
  const cfg = getConfig(status);
  return (
    <span
      title={`${cfg.label}${cfg.sublabel ? ` · ${cfg.sublabel}` : ''}`}
      className={`
        inline-block w-2.5 h-2.5 rounded-full flex-shrink-0
        ${cfg.dot}
        ${cfg.animate ? 'animate-pulse' : ''}
        ring-2 ${cfg.ring}
      `}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── COMPACT VARIANT ──────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

function CompactBadge({ status, onSyncNow, showSyncButton = true }) {
  const cfg = getConfig(status);
  const { Icon } = cfg;

  return (
    <div
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border
        text-xs font-medium select-none transition-all duration-300
        ${cfg.bg} ${cfg.border} ${cfg.text}
      `}
    >
      {/* Animated dot */}
      <span
        className={`
          w-1.5 h-1.5 rounded-full flex-shrink-0
          ${cfg.dot}
          ${cfg.animate ? 'animate-pulse' : ''}
        `}
      />

      {/* Icon */}
      <Icon size={12} className={cfg.iconCls} strokeWidth={2.5} />

      {/* Label */}
      <span className="leading-none">{cfg.label}</span>

      {/* Sublabel */}
      {cfg.sublabel && (
        <span className="opacity-60 text-[10px] leading-none hidden sm:inline">
          · {cfg.sublabel}
        </span>
      )}

      {/* Manual sync button — only shows when there's something to sync */}
      {showSyncButton && onSyncNow && status.queueDepth > 0 && status.online && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSyncNow();
          }}
          title="Sync now"
          className="ml-0.5 p-0.5 rounded hover:bg-black/10 transition-colors"
        >
          <Zap size={10} className="text-current" />
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── DETAILED VARIANT ─────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

function DetailedBadge({ status, onSyncNow }) {
  const [expanded, setExpanded] = useState(false);
  const [tick, setTick] = useState(0); // re-render every 15s for timeAgo updates
  const cfg = getConfig(status);
  const { Icon } = cfg;

  // Re-render to keep "X ago" label fresh
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className={`rounded-xl border overflow-hidden transition-all duration-300 ${cfg.border}`}>
      {/* ── Header row ── */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className={`
          w-full flex items-center gap-2 px-3 py-2 text-xs font-medium
          transition-colors duration-200
          ${cfg.bg} ${cfg.text}
          hover:brightness-95
        `}
      >
        <span
          className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot} ${cfg.animate ? 'animate-pulse' : ''}`}
        />
        <Icon size={13} className={cfg.iconCls} />
        <span className="flex-1 text-left">{cfg.label}</span>
        {cfg.sublabel && (
          <span className="opacity-60 text-[10px] mr-1">{cfg.sublabel}</span>
        )}
        {expanded ? <ChevronUp size={11} className="opacity-50" /> : <ChevronDown size={11} className="opacity-50" />}
      </button>

      {/* ── Expanded details ── */}
      {expanded && (
        <div className={`px-3 py-2.5 border-t ${cfg.border} bg-white space-y-2`}>
          {/* Queue depth */}
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Pending bills</span>
            <span className={`font-bold ${status.queueDepth > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
              {status.queueDepth}
            </span>
          </div>

          {/* Last sync */}
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Last sync</span>
            <span className="text-slate-600 font-medium">
              {status.lastSyncAt ? timeAgo(status.lastSyncAt) : 'Never'}
            </span>
          </div>

          {/* Network */}
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Network</span>
            <span className={`font-medium flex items-center gap-1 ${status.online ? 'text-emerald-600' : 'text-slate-400'}`}>
              {status.online ? <Wifi size={10} /> : <WifiOff size={10} />}
              {status.online ? 'Online' : 'Offline'}
            </span>
          </div>

          {/* Error message */}
          {status.lastError && (
            <div className="bg-red-50 rounded-lg px-2.5 py-2 text-[10px] text-red-600 font-medium leading-snug border border-red-100">
              {status.lastError}
            </div>
          )}

          {/* Sync now button */}
          {onSyncNow && status.online && (
            <button
              onClick={() => {
                onSyncNow();
                setExpanded(false);
              }}
              disabled={status.state === 'syncing' || status.queueDepth === 0}
              className={`
                w-full py-2 rounded-lg text-[11px] font-semibold transition-all
                flex items-center justify-center gap-1.5
                ${status.queueDepth > 0 && status.state !== 'syncing'
                  ? 'bg-blue-500 text-white hover:bg-blue-600 shadow-sm'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }
              `}
            >
              <RefreshCw size={11} className={status.state === 'syncing' ? 'animate-spin' : ''} />
              {status.state === 'syncing' ? 'Syncing…' : status.queueDepth === 0 ? 'All synced' : 'Sync now'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── NETWORK STATUS BAR ───────────────────────────────────────────────────────
// A thin full-width bar shown at top/bottom of screen when offline.
// ─────────────────────────────────────────────────────────────────────────────

export function OfflineBanner({ status, queueDepth }) {
  const [visible, setVisible] = useState(!status.online);
  const prevOnline = useRef(status.online);

  useEffect(() => {
    if (!status.online) {
      setVisible(true);
    } else if (prevOnline.current === false && status.online) {
      // Just came back online — show "back online" briefly
      setVisible(true);
      const t = setTimeout(() => setVisible(false), 3000);
      return () => clearTimeout(t);
    }
    prevOnline.current = status.online;
  }, [status.online]);

  if (!visible) return null;

  return (
    <div
      className={`
        w-full flex items-center justify-center gap-2 px-4 py-2
        text-xs font-semibold tracking-wide
        transition-all duration-500
        ${status.online
          ? 'bg-emerald-500 text-white'
          : 'bg-slate-800 text-white'
        }
      `}
    >
      {status.online ? (
        <>
          <Wifi size={13} />
          Back online
          {queueDepth > 0 && <span className="opacity-80">· Syncing {queueDepth} bill{queueDepth > 1 ? 's' : ''}…</span>}
        </>
      ) : (
        <>
          <WifiOff size={13} />
          Offline mode
          {queueDepth > 0 && <span className="opacity-70">· {queueDepth} bill{queueDepth > 1 ? 's' : ''} queued</span>}
          <span className="opacity-60">· Bills save locally</span>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── MAIN EXPORT ──────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SyncStatusBadge
 *
 * @param {object} props
 * @param {object}   props.status          — from usePOS().syncStatus or syncEngine
 * @param {'compact'|'detailed'|'dot'} [props.variant='compact']
 * @param {function} [props.onSyncNow]     — trigger manual sync
 * @param {boolean}  [props.showSyncButton=true] — compact only
 * @param {string}   [props.className]     — extra wrapper classes
 */
export default function SyncStatusBadge({
  status,
  variant = 'compact',
  onSyncNow,
  showSyncButton = true,
  className = '',
}) {
  // Defensive default — never crash if status is undefined
  const safeStatus = {
    state:      'idle',
    queueDepth: 0,
    lastSyncAt: 0,
    lastError:  null,
    online:     true,
    ...status,
  };

  return (
    <div className={className}>
      {variant === 'dot' && (
        <DotBadge status={safeStatus} />
      )}
      {variant === 'compact' && (
        <CompactBadge
          status={safeStatus}
          onSyncNow={onSyncNow}
          showSyncButton={showSyncButton}
        />
      )}
      {variant === 'detailed' && (
        <DetailedBadge status={safeStatus} onSyncNow={onSyncNow} />
      )}
    </div>
  );
}