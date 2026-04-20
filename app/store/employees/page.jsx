// app/store/employees/page.jsx
'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  ShieldCheck,
  ShieldAlert,
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
  UserCheck,
  UserX,
  Receipt,
  Package,
  ClipboardList,
  BarChart2,
  Tag,
  ShoppingBag,
} from 'lucide-react';

const ALL_PERMISSIONS = [
  { key: 'billing',            label: 'Billing',             Icon: Receipt },
  { key: 'inventory',          label: 'Inventory',                         Icon: Package },
  { key: 'orders',             label: 'Orders',                   Icon: ClipboardList },
  { key: 'reports',            label: 'Reports',              Icon: BarChart2 },
  { key: 'product_categories', label: 'Categories',                  Icon: Tag },
  { key: 'manage_product',     label: 'Products',                   Icon: ShoppingBag },
];

const DEFAULT_PERMS = {
  billing: false,
  inventory: false,
  orders: false,
  reports: false,
  settings: false,
  product_categories: false,
  manage_product: false,
};

function PermissionBadge({ permissions }) {
  const granted = Object.entries(permissions || {})
    .filter(([, v]) => v)
    .map(([k]) => k);
  if (!granted.length)
    return <span className="text-xs text-slate-400 italic">No permissions</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {granted.map((p) => (
        <span
          key={p}
          className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs rounded-md font-medium capitalize"
        >
          {p.replace(/_/g, ' ')}
        </span>
      ))}
    </div>
  );
}

/* ─── Permission Toggle Card ─── */
function PermCard({ perm, checked, onToggle }) {
  const { Icon } = perm;
  return (
    <div
      onClick={onToggle}
      className={`
        relative flex items-start gap-3 p-3 rounded-xl border cursor-pointer select-none
        transition-all duration-150
        ${checked
          ? 'border-emerald-400 bg-emerald-50 shadow-sm shadow-emerald-100'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}
      `}
    >
      {/* icon */}
      <div
        className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors
          ${checked ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'}`}
      >
        <Icon size={15} />
      </div>

      {/* text */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold leading-tight ${checked ? 'text-emerald-800' : 'text-slate-700'}`}>
          {perm.label}
        </p>
        <p className="text-xs text-slate-400 mt-0.5 leading-tight">{perm.desc}</p>
      </div>

      {/* checkbox */}
      <div
        className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors
          ${checked ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300 bg-white'}`}
      >
        {checked && <Check size={11} className="text-white" strokeWidth={3} />}
      </div>
    </div>
  );
}

/* ─── Field wrapper ─── */
function Field({ label, children, hint }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</label>
        {hint && <span className="text-xs text-slate-400">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

const inputCls =
  'w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none ' +
  'focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 transition placeholder:text-slate-300';

export default function EmployeesPage() {
  const { getToken } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'EMPLOYEE',
    permissions: { ...DEFAULT_PERMS },
  });

  /* ── auth header ── */
  const getAuthHeader = async () => {
    const empToken = typeof window !== 'undefined' ? localStorage.getItem('employeeToken') : null;
    if (empToken) return { Authorization: `Bearer ${empToken}` };
    const token = await getToken();
    return { Authorization: `Bearer ${token}` };
  };

  /* ── fetch ── */
  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const headers = await getAuthHeader();
      const { data } = await axios.get('/api/employee/list', { headers });
      setEmployees(data.employees || []);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEmployees(); }, []);

  /* ── modal helpers ── */
  const openCreate = () => {
    setEditingEmployee(null);
    setForm({ name: '', email: '', password: '', role: 'EMPLOYEE', permissions: { ...DEFAULT_PERMS } });
    setShowPassword(false);
    setModalOpen(true);
  };

  const openEdit = (emp) => {
    setEditingEmployee(emp);
    setForm({
      name: emp.name,
      email: emp.email,
      password: '',
      role: emp.role,
      permissions: { ...DEFAULT_PERMS, ...(emp.permissions || {}) },
    });
    setShowPassword(false);
    setModalOpen(true);
  };

  /* ── save ── */
  const handleSave = async () => {
    if (!form.name || !form.email) { toast.error('Name and email are required'); return; }
    if (!editingEmployee && !form.password) { toast.error('Password is required'); return; }
    try {
      setSaving(true);
      const headers = await getAuthHeader();
      if (editingEmployee) {
        const payload = { id: editingEmployee.id, name: form.name, email: form.email, role: form.role, permissions: form.permissions };
        if (form.password) payload.password = form.password;
        const { data } = await axios.put('/api/employee/update', payload, { headers });
        setEmployees((prev) => prev.map((e) => (e.id === editingEmployee.id ? data.employee : e)));
        toast.success('Employee updated');
      } else {
        const { data } = await axios.post('/api/employee/create', { name: form.name, email: form.email, password: form.password, role: form.role, permissions: form.permissions }, { headers });
        setEmployees((prev) => [data.employee, ...prev]);
        toast.success('Employee created');
      }
      setModalOpen(false);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  /* ── toggle active ── */
  const handleToggleActive = async (emp) => {
    try {
      const headers = await getAuthHeader();
      const { data } = await axios.put('/api/employee/update', { id: emp.id, isActive: !emp.isActive }, { headers });
      setEmployees((prev) => prev.map((e) => (e.id === emp.id ? data.employee : e)));
      toast.success(data.employee.isActive ? 'Employee activated' : 'Employee deactivated');
    } catch { toast.error('Failed to update status'); }
  };

  /* ── delete ── */
  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const headers = await getAuthHeader();
      await axios.delete(`/api/employee/delete?id=${deleteId}`, { headers });
      setEmployees((prev) => prev.filter((e) => e.id !== deleteId));
      toast.success('Employee deleted');
      setDeleteId(null);
    } catch { toast.error('Failed to delete employee'); }
  };

  /* ── perm helpers ── */
  const togglePerm = (key) =>
    setForm((prev) => ({ ...prev, permissions: { ...prev.permissions, [key]: !prev.permissions[key] } }));

  const allGranted = ALL_PERMISSIONS.every((p) => form.permissions[p.key]);
  const grantAll = () => {
    const next = !allGranted;
    setForm((prev) => ({
      ...prev,
      permissions: { ...prev.permissions, ...Object.fromEntries(ALL_PERMISSIONS.map((p) => [p.key, next])) },
    }));
  };

  /* ════════════════════════════════════════════════════════ */
  return (
    <div className="pb-20">

      {/* ── Page Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8 mt-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <span className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center">
              <Users size={18} className="text-white" />
            </span>
            Employee Management
          </h1>
          <p className="text-slate-500 text-sm mt-1 ml-11">Manage staff access and permissions</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchEmployees}
            className="flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition"
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-sm shadow-emerald-200 transition"
          >
            <Plus size={16} /> Add Employee
          </button>
        </div>
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div className="flex items-center justify-center py-20 gap-2 text-slate-400">
          <Loader2 size={20} className="animate-spin" /> Loading employees…
        </div>
      ) : employees.length === 0 ? (
        <div className="text-center py-24 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Users size={28} className="text-slate-400" />
          </div>
          <p className="text-slate-700 font-semibold">No employees yet</p>
          <p className="text-slate-400 text-sm mt-1">Add your first team member to get started</p>
          <button
            onClick={openCreate}
            className="mt-5 inline-flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-emerald-700 transition shadow-sm shadow-emerald-100"
          >
            <Plus size={16} /> Add Employee
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Employee', 'Role', 'Permissions', 'Status', 'Joined', 'Actions'].map((h) => (
                    <th key={h} className="text-left px-5 py-3.5 font-semibold text-slate-400 text-xs uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-500 flex-shrink-0">
                          {emp.name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800 leading-tight">{emp.name}</p>
                          <p className="text-xs text-slate-400">{emp.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                          emp.role === 'STORE_OWNER'
                            ? 'bg-violet-100 text-violet-700'
                            : 'bg-sky-100 text-sky-700'
                        }`}
                      >
                        {emp.role === 'STORE_OWNER' ? <ShieldCheck size={11} /> : <ShieldAlert size={11} />}
                        {emp.role === 'STORE_OWNER' ? 'Store Owner' : 'Employee'}
                      </span>
                    </td>
                    <td className="px-5 py-4 max-w-[220px]">
                      <PermissionBadge permissions={emp.permissions} />
                    </td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => handleToggleActive(emp)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                          emp.isActive
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                        }`}
                      >
                        {emp.isActive ? <><UserCheck size={11} /> Active</> : <><UserX size={11} /> Inactive</>}
                      </button>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-400">
                      {new Date(emp.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(emp)}
                          className="p-2 bg-sky-50 text-sky-600 rounded-lg hover:bg-sky-100 border border-sky-200 transition"
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteId(emp.id)}
                          className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 border border-red-200 transition"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          Create / Edit Modal
      ════════════════════════════════════════════════════════ */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl my-8 flex flex-col">

            {/* ── Modal Header ── */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-0.5">
                  Employee management
                </p>
                <h2 className="text-lg font-bold text-slate-800">
                  {editingEmployee ? 'Edit Employee' : 'Add New Employee'}
                </h2>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 transition"
              >
                <X size={17} />
              </button>
            </div>

            {/* ── Modal Body ── */}
            <div className="p-6 flex flex-col gap-5 overflow-y-auto">

              {/* Row 1: Name + Role */}
              <div className="grid grid-cols-2 gap-4">
                <Field label="Full Name">
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Ravi Kumar"
                    className={inputCls}
                  />
                </Field>
                <Field label="Role">
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    className={inputCls + ' bg-slate-50'}
                  >
                    <option value="EMPLOYEE">Employee</option>
                    <option value="STORE_OWNER">Store Owner</option>
                  </select>
                </Field>
              </div>

              {/* Row 2: Email + Password */}
              <div className="grid grid-cols-2 gap-4">
                <Field label="Email">
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="ravi@store.com"
                    className={inputCls}
                  />
                </Field>
                <Field
                  label="Password"
                  hint={editingEmployee ? 'Leave blank to keep current' : undefined}
                >
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      placeholder="••••••••"
                      className={inputCls + ' pr-10'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </Field>
              </div>

              {/* Permissions — only for EMPLOYEE */}
              {form.role === 'EMPLOYEE' && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Permissions</span>
                    <button
                      onClick={grantAll}
                      className={`text-xs font-semibold px-3 py-1 rounded-lg border transition ${
                        allGranted
                          ? 'border-red-200 text-red-600 bg-red-50 hover:bg-red-100'
                          : 'border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                      }`}
                    >
                      {allGranted ? 'Revoke All' : 'Grant All'}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {ALL_PERMISSIONS.map((perm) => (
                      <PermCard
                        key={perm.key}
                        perm={perm}
                        checked={!!form.permissions[perm.key]}
                        onToggle={() => togglePerm(perm.key)}
                      />
                    ))}
                  </div>
                  {/* Summary pill */}
                  <p className="text-xs text-slate-400 mt-3 text-right">
                    {ALL_PERMISSIONS.filter((p) => form.permissions[p.key]).length} of {ALL_PERMISSIONS.length} permissions granted
                  </p>
                </div>
              )}
            </div>

            {/* ── Modal Footer ── */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/60 rounded-b-2xl">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2.5 text-sm font-medium border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2.5 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl disabled:opacity-60 flex items-center gap-2 transition shadow-sm shadow-emerald-200"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                {editingEmployee ? 'Save Changes' : 'Create Employee'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          Delete Confirm Modal
      ════════════════════════════════════════════════════════ */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center">
            <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Trash2 size={26} className="text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-1.5">Delete Employee?</h3>
            <p className="text-slate-500 text-sm mb-7 leading-relaxed">
              This will permanently remove the employee and revoke all their access. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition shadow-sm shadow-red-100"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}