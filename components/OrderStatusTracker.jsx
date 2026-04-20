// components/OrderStatusTracker.jsx
'use client';

import {
  ClipboardList,
  CheckCircle2,
  Settings,
  Truck,
  PackageCheck,
  XCircle,
  RotateCcw,
  RefreshCcw,
  DollarSign,
} from 'lucide-react';

// Full lifecycle order (happy path + return path)
const MAIN_STEPS = [
  { key: 'ORDER_PLACED', label: 'Order Placed', Icon: ClipboardList },
  { key: 'CONFIRMED', label: 'Confirmed', Icon: CheckCircle2 },
  { key: 'PROCESSING', label: 'Processing', Icon: Settings },
  { key: 'SHIPPED', label: 'Shipped', Icon: Truck },
  { key: 'DELIVERED', label: 'Delivered', Icon: PackageCheck },
];

const RETURN_STEPS = [
  { key: 'RETURN_REQUESTED', label: 'Return Requested', Icon: RotateCcw },
  { key: 'RETURNED', label: 'Returned', Icon: RefreshCcw },
  { key: 'REFUNDED', label: 'Refunded', Icon: DollarSign },
];

const STATUS_COLORS = {
  ORDER_PLACED: { active: '#3b82f6', bg: 'bg-blue-100', text: 'text-blue-700' },
  CONFIRMED: { active: '#8b5cf6', bg: 'bg-violet-100', text: 'text-violet-700' },
  PROCESSING: { active: '#f59e0b', bg: 'bg-amber-100', text: 'text-amber-700' },
  SHIPPED: { active: '#06b6d4', bg: 'bg-cyan-100', text: 'text-cyan-700' },
  DELIVERED: { active: '#10b981', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  CANCELLED: { active: '#ef4444', bg: 'bg-red-100', text: 'text-red-700' },
  RETURN_REQUESTED: { active: '#f97316', bg: 'bg-orange-100', text: 'text-orange-700' },
  RETURNED: { active: '#a855f7', bg: 'bg-purple-100', text: 'text-purple-700' },
  REFUNDED: { active: '#14b8a6', bg: 'bg-teal-100', text: 'text-teal-700' },
};

export default function OrderStatusTracker({ status }) {
  if (!status) return null;

  const isCancelled = status === 'CANCELLED';
  const isReturnFlow = ['RETURN_REQUESTED', 'RETURNED', 'REFUNDED'].includes(status);
  const steps = isReturnFlow ? [...MAIN_STEPS, ...RETURN_STEPS] : MAIN_STEPS;
  const currentColor = STATUS_COLORS[status] || STATUS_COLORS.ORDER_PLACED;
  const currentStepIdx = steps.findIndex((s) => s.key === status);

  if (isCancelled) {
    return (
      <div className="flex flex-col items-center justify-center py-6 px-4">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-3">
          <XCircle className="w-8 h-8 text-red-500" />
        </div>
        <p className="text-base font-semibold text-red-600">Order Cancelled</p>
        <p className="text-xs text-slate-500 mt-1">This order has been cancelled</p>
      </div>
    );
  }

  return (
    <div className="w-full py-4 px-2">
      {/* Steps row */}
      <div className="relative flex items-start justify-between">
        {/* Progress line background */}
        <div className="absolute top-5 left-0 right-0 h-1 bg-slate-100 z-0 mx-5" />

        {/* Progress line fill */}
        {currentStepIdx > 0 && (
          <div
            className="absolute top-5 left-0 h-1 z-0 mx-5 transition-all duration-700"
            style={{
              width: `calc(${(currentStepIdx / (steps.length - 1)) * 100}% - 2.5rem)`,
              backgroundColor: currentColor.active,
            }}
          />
        )}

        {steps.map((step, idx) => {
          const isCompleted = idx < currentStepIdx;
          const isActive = idx === currentStepIdx;
          const isPending = idx > currentStepIdx;
          const { Icon } = step;

          return (
            <div key={step.key} className="relative z-10 flex flex-col items-center flex-1">
              {/* Circle */}
              <div
                className={`
                  flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300
                  ${
                    isCompleted
                      ? 'border-transparent text-white'
                      : isActive
                        ? 'border-transparent text-white ring-4 ring-opacity-20'
                        : 'border-slate-200 bg-white text-slate-300'
                  }
                `}
                style={{
                  backgroundColor: isCompleted
                    ? currentColor.active
                    : isActive
                      ? currentColor.active
                      : undefined,
                  boxShadow: isActive ? `0 0 0 4px ${currentColor.active}30` : undefined,
                }}
              >
                {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-4 h-4" />}
              </div>

              {/* Label */}
              <p
                className={`mt-2 text-center text-xs font-medium leading-tight max-w-[72px] ${
                  isActive ? currentColor.text : isCompleted ? 'text-slate-600' : 'text-slate-400'
                }`}
              >
                {step.label}
              </p>

              {/* Active pulse dot */}
              {isActive && (
                <span
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full animate-ping opacity-20"
                  style={{ backgroundColor: currentColor.active }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Current status badge */}
      <div className="flex justify-center mt-5">
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${currentColor.bg} ${currentColor.text}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
          {status.replace(/_/g, ' ')}
        </span>
      </div>
    </div>
  );
}
