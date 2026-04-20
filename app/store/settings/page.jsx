'use client';
// app/store/settings/page.jsx

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { invalidateSettingsCache } from '@/lib/storeSettings';
import { Home, CreditCard, FileText, Package, Save, Check, Info, ChevronRight } from 'lucide-react';

const SECTIONS = ['Store Info', 'Billing', 'Invoice', 'Inventory'];

const SECTION_META = {
  'Store Info': {
    icon: Home,
    label: 'Store info',
    desc: 'Basic details shown on invoices and storefront',
  },
  Billing: {
    icon: CreditCard,
    label: 'Billing & tax',
    desc: 'Configure tax calculation for orders and POS',
  },
  Invoice: { icon: FileText, label: 'Invoice', desc: 'Control what appears on printed invoices' },
  Inventory: { icon: Package, label: 'Inventory', desc: 'Default values for new products' },
};

const defaultSettings = {
  storeName: '',
  gstNumber: '',
  address: '',
  taxType: 'SINGLE',
  taxPercent: 18,
  cgst: 9,
  sgst: 9,
  currency: 'INR',
  showStoreName: true,
  showGST: true,
  footerMessage: 'Thank you for shopping with us!',
  defaultLowStock: 10,
};

export default function StoreSettingsPage() {
  const [activeSection, setActiveSection] = useState('Store Info');
  const [form, setForm] = useState(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
            const token = typeof window !== 'undefined'
        ? (localStorage.getItem('storeToken') ||
           localStorage.getItem('token') ||
           localStorage.getItem('employeeToken') || '')
        : '';
      const res = await fetch('/api/store/settings', {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Failed to load settings');
      const data = await res.json();
      if (data.settings) setForm((prev) => ({ ...prev, ...data.settings }));
    } catch {
      toast.error('Could not load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const token = typeof window !== 'undefined'
        ? (localStorage.getItem('storeToken') ||
           localStorage.getItem('token') ||
           localStorage.getItem('employeeToken') || '')
        : '';
      const res = await fetch('/api/store/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      invalidateSettingsCache();
      setSaved(true);
      toast.success('Settings saved!');
    } catch (err) {
      toast.error(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f6f3]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#2d2a26] border-t-transparent rounded-full animate-spin" />
          <p className="text-[#2d2a26] font-medium text-sm">Loading settings…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f6f3] font-sans">
      {/* ── Header ── */}
      <div className="bg-white border-b border-[#e8e5e0] px-4 sm:px-8 py-4 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold text-[#1a1814] tracking-tight">
            Store Settings
          </h1>
          <p className="text-xs sm:text-sm text-[#7a756e] mt-0.5 hidden sm:block">
            Manage your store configuration and billing preferences
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`flex items-center gap-2 px-4 sm:px-5 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
            saved
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-[#1a1814] text-white hover:bg-[#2d2a26] active:scale-95'
          } ${saving ? 'opacity-60 cursor-not-allowed' : ''}`}
        >
          {saving ? (
            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : saved ? (
            <Check size={14} />
          ) : (
            <Save size={14} />
          )}
          <span>{saving ? 'Saving…' : saved ? 'Saved' : 'Save settings'}</span>
        </button>
      </div>

      {/* ── Mobile tab strip ── */}
      <div className="flex sm:hidden overflow-x-auto gap-2 px-4 py-3 bg-white border-b border-[#e8e5e0] scrollbar-hide">
        {SECTIONS.map((section) => {
          const Icon = SECTION_META[section].icon;
          const active = activeSection === section;
          return (
            <button
              key={section}
              onClick={() => setActiveSection(section)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-all flex-shrink-0 ${
                active
                  ? 'bg-[#1a1814] text-white border-[#1a1814]'
                  : 'bg-white text-[#5a5550] border-[#e0ddd8] hover:border-[#1a1814]'
              }`}
            >
              <Icon size={12} />
              {SECTION_META[section].label}
            </button>
          );
        })}
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex gap-6">
        {/* ── Desktop sidebar ── */}
        <aside className="w-48 shrink-0 hidden sm:block">
          <nav className="flex flex-col gap-1 sticky top-20">
            {SECTIONS.map((section) => {
              const Icon = SECTION_META[section].icon;
              const active = activeSection === section;
              return (
                <button
                  key={section}
                  onClick={() => setActiveSection(section)}
                  className={`flex items-center gap-2.5 text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                    active
                      ? 'bg-[#1a1814] text-white'
                      : 'text-[#5a5550] hover:bg-[#edeae5] hover:text-[#1a1814]'
                  }`}
                >
                  <Icon size={14} className="flex-shrink-0" />
                  {SECTION_META[section].label}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* ── Main content ── */}
        <main className="flex-1 min-w-0">
          {activeSection === 'Store Info' && (
            <SettingsCard section="Store Info">
              <Field label="Store name" required>
                <TextInput
                  value={form.storeName}
                  onChange={(v) => handleChange('storeName', v)}
                  placeholder="e.g. A1 Super Mart"
                />
              </Field>
              <Field label="GST number" hint="Optional — appears on tax invoices">
                <TextInput
                  value={form.gstNumber || ''}
                  onChange={(v) => handleChange('gstNumber', v)}
                  placeholder="e.g. 33ABCDE1234F1Z5"
                />
              </Field>
              <Field label="Store address" required>
                <TextArea
                  value={form.address}
                  onChange={(v) => handleChange('address', v)}
                  placeholder="Full store address"
                />
              </Field>
            </SettingsCard>
          )}

          {activeSection === 'Billing' && (
            <SettingsCard section="Billing">
              <Field label="Tax type" required>
                <div className="flex gap-2">
                  {['SINGLE', 'GST_SPLIT'].map((type) => (
                    <button
                      key={type}
                      onClick={() => handleChange('taxType', type)}
                      className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all ${
                        form.taxType === type
                          ? 'bg-[#1a1814] text-white border-[#1a1814]'
                          : 'bg-white text-[#5a5550] border-[#e0ddd8] hover:border-[#1a1814]'
                      }`}
                    >
                      {type === 'SINGLE' ? 'Single tax' : 'GST split (CGST + SGST)'}
                    </button>
                  ))}
                </div>
              </Field>

              {form.taxType === 'SINGLE' && (
                <Field label="Tax percent (%)" required>
                  <NumberInput
                    value={form.taxPercent}
                    onChange={(v) => handleChange('taxPercent', v)}
                    placeholder="18"
                    min={0}
                    max={100}
                  />
                </Field>
              )}

              {form.taxType === 'GST_SPLIT' && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="CGST (%)" required>
                    <NumberInput
                      value={form.cgst}
                      onChange={(v) => handleChange('cgst', v)}
                      placeholder="9"
                      min={0}
                      max={50}
                    />
                  </Field>
                  <Field label="SGST (%)" required>
                    <NumberInput
                      value={form.sgst}
                      onChange={(v) => handleChange('sgst', v)}
                      placeholder="9"
                      min={0}
                      max={50}
                    />
                  </Field>
                </div>
              )}

              <Field label="Currency">
                <select
                  value={form.currency}
                  onChange={(e) => handleChange('currency', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#e0ddd8] bg-white text-[#1a1814] text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1814] transition"
                >
                  <option value="INR">INR — Indian Rupee</option>
                  <option value="USD">USD — US Dollar</option>
                  <option value="EUR">EUR — Euro</option>
                  <option value="GBP">GBP — British Pound</option>
                </select>
              </Field>

              <div className="bg-[#f7f6f3] border border-[#e8e5e0] rounded-lg p-3.5">
                <p className="text-xs font-medium text-[#7a756e] mb-2 uppercase tracking-wide">
                  Tax preview on ₹1,000
                </p>
                <TaxPreview form={form} amount={1000} />
              </div>
            </SettingsCard>
          )}

          {activeSection === 'Invoice' && (
            <SettingsCard section="Invoice">
              <Field label="Show store name on invoice">
                <Toggle
                  checked={form.showStoreName}
                  onChange={(v) => handleChange('showStoreName', v)}
                  label={form.showStoreName ? 'Visible' : 'Hidden'}
                />
              </Field>
              <Field label="Show GST number on invoice">
                <Toggle
                  checked={form.showGST}
                  onChange={(v) => handleChange('showGST', v)}
                  label={form.showGST ? 'Visible' : 'Hidden'}
                />
              </Field>
              <Field label="Footer message" hint="Appears at the bottom of every invoice">
                <TextArea
                  value={form.footerMessage || ''}
                  onChange={(v) => handleChange('footerMessage', v)}
                  placeholder="e.g. Thank you! Visit again."
                  rows={2}
                />
              </Field>
              <div>
                <p className="text-xs font-medium text-[#7a756e] mb-2 uppercase tracking-wide">
                  Invoice preview
                </p>
                <InvoicePreview form={form} />
              </div>
            </SettingsCard>
          )}

          {activeSection === 'Inventory' && (
            <SettingsCard section="Inventory">
              <Field
                label="Default low stock threshold"
                hint="Products below this quantity will be flagged as low stock"
                required
              >
                <NumberInput
                  value={form.defaultLowStock}
                  onChange={(v) => handleChange('defaultLowStock', v)}
                  placeholder="10"
                  min={1}
                  max={9999}
                />
              </Field>
              <div className="flex gap-2.5 bg-blue-50 border border-blue-100 rounded-lg p-3.5 text-sm text-blue-700">
                <Info size={14} className="flex-shrink-0 mt-0.5" />
                <span>
                  This sets the default{' '}
                  <code className="bg-blue-100 px-1 rounded text-xs">lowStock</code> when adding a
                  new product. You can override it per product.
                </span>
              </div>
            </SettingsCard>
          )}
        </main>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function SettingsCard({ section, children }) {
  const Icon = SECTION_META[section].icon;
  const { label, desc } = SECTION_META[section];
  return (
    <div className="bg-white border border-[#e8e5e0] rounded-xl overflow-hidden shadow-sm">
      <div className="px-5 py-4 border-b border-[#f0ede8] flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#f7f6f3] flex items-center justify-center flex-shrink-0">
          <Icon size={15} className="text-[#2d2a26]" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-[#1a1814]">{label}</h2>
          <p className="text-xs text-[#7a756e] mt-0.5">{desc}</p>
        </div>
      </div>
      <div className="p-5 flex flex-col gap-4">{children}</div>
    </div>
  );
}

function Field({ label, hint, required, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#5a5550] mb-1.5 uppercase tracking-wide">
        {label}
        {required && <span className="text-red-500 ml-1 normal-case">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-[#9a9590] mt-1">{hint}</p>}
    </div>
  );
}

function TextInput({ value, onChange, placeholder }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 rounded-lg border border-[#e0ddd8] bg-white text-[#1a1814] text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1814] transition placeholder:text-[#c0bdb8]"
    />
  );
}

function TextArea({ value, onChange, placeholder, rows = 3 }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full px-3 py-2 rounded-lg border border-[#e0ddd8] bg-white text-[#1a1814] text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1814] transition placeholder:text-[#c0bdb8] resize-none"
    />
  );
}

function NumberInput({ value, onChange, placeholder, min, max }) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      placeholder={placeholder}
      min={min}
      max={max}
      className="w-full px-3 py-2 rounded-lg border border-[#e0ddd8] bg-white text-[#1a1814] text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1814] transition placeholder:text-[#c0bdb8]"
    />
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none ${
          checked ? 'bg-[#1a1814]' : 'bg-[#d0cdc8]'
        }`}
      >
        <span
          className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${
            checked ? 'translate-x-5 left-0.5' : 'left-0.5'
          }`}
        />
      </button>
      <span className={`text-sm ${checked ? 'text-[#1a1814] font-medium' : 'text-[#9a9590]'}`}>
        {label}
      </span>
    </div>
  );
}

function TaxPreview({ form, amount }) {
  const symbol = { INR: '₹', USD: '$', EUR: '€', GBP: '£' }[form.currency] || '₹';
  let lines = [];
  if (form.taxType === 'GST_SPLIT') {
    const cgst = +((amount * (form.cgst || 0)) / 100).toFixed(2);
    const sgst = +((amount * (form.sgst || 0)) / 100).toFixed(2);
    lines = [
      { label: 'Subtotal', value: amount },
      { label: `CGST (${form.cgst}%)`, value: cgst },
      { label: `SGST (${form.sgst}%)`, value: sgst },
      { label: 'Total', value: amount + cgst + sgst, bold: true },
    ];
  } else {
    const tax = +((amount * (form.taxPercent || 0)) / 100).toFixed(2);
    lines = [
      { label: 'Subtotal', value: amount },
      { label: `Tax (${form.taxPercent}%)`, value: tax },
      { label: 'Total', value: amount + tax, bold: true },
    ];
  }
  return (
    <div className="flex flex-col gap-1 text-sm text-[#5a5550]">
      {lines.map((l) => (
        <div
          key={l.label}
          className={`flex justify-between ${
            l.bold ? 'font-semibold text-[#1a1814] border-t border-[#e8e5e0] pt-1.5 mt-0.5' : ''
          }`}
        >
          <span>{l.label}</span>
          <span>
            {symbol}
            {l.value.toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  );
}

function InvoicePreview({ form }) {
  return (
    <div className="border border-dashed border-[#c8c5c0] rounded-lg p-4 bg-[#fafaf8] font-mono text-xs text-[#3a3733] space-y-1">
      {form.showStoreName && (
        <p className="text-sm font-bold text-center">{form.storeName || 'Store Name'}</p>
      )}
      {form.showGST && form.gstNumber && (
        <p className="text-center text-[#7a756e]">GST: {form.gstNumber}</p>
      )}
      {form.address && <p className="text-center text-[#7a756e]">{form.address}</p>}
      <div className="border-t border-dashed border-[#c8c5c0] my-2" />
      <div className="flex justify-between">
        <span>Sample Item x1</span>
        <span>₹500.00</span>
      </div>
      <div className="border-t border-dashed border-[#c8c5c0] my-2" />
      <div className="flex justify-between font-bold">
        <span>TOTAL</span>
        <span>₹500.00</span>
      </div>
      {form.footerMessage && (
        <>
          <div className="border-t border-dashed border-[#c8c5c0] my-2" />
          <p className="text-center text-[#7a756e] italic">{form.footerMessage}</p>
        </>
      )}
    </div>
  );
}
