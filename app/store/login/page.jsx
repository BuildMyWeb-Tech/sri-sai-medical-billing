// app/store/login/page.jsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import toast from 'react-hot-toast';
import { LogIn, Mail, Lock, Eye, EyeOff, Store, Users } from 'lucide-react';
import Link from 'next/link';

export default function StoreLoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      toast.error('Please fill all fields');
      return;
    }
    try {
      setLoading(true);
      const { data } = await axios.post('/api/auth/store-login', form);

      // Store JWT + session data
      localStorage.setItem('employeeToken', data.token);
      localStorage.setItem('employeeData', JSON.stringify(data.user));

      toast.success(`Welcome back, ${data.user.name}!`);
      router.push('/store');
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-green-50/30 to-slate-100 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center text-4xl font-bold text-slate-800">
            <span className="text-green-600">King</span>cart
            <span className="text-green-600 text-5xl leading-none">.</span>
          </Link>
          <p className="text-slate-500 text-sm mt-2">Store Management Portal</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-green-100 rounded-2xl mb-3">
              <Store size={26} className="text-green-600" />
            </div>
            <h1 className="text-xl font-bold text-slate-800">Store Login</h1>
            <p className="text-slate-400 text-sm mt-1">Sign in as Store Owner or Employee</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="you@store.com"
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-100 focus:border-green-400 transition"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-10 py-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-100 focus:border-green-400 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white py-2.5 rounded-lg font-medium text-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <LogIn size={16} />
              )}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Info box */}
          <div className="mt-5 p-3 bg-slate-50 rounded-xl border border-slate-100">
            <div className="flex items-start gap-2.5">
              <Users size={15} className="text-slate-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-slate-500 space-y-1">
                <p>
                  <span className="font-medium text-slate-600">Store Owner:</span> Use your
                  registered store email & password
                </p>
                <p>
                  <span className="font-medium text-slate-600">Employee:</span> Use credentials
                  given by your store owner
                </p>
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-5">
          Want to register a store?{' '}
          <Link href="/create-store" className="text-green-600 hover:underline font-medium">
            Apply here
          </Link>{' '}
          •{' '}
          <Link href="/" className="text-green-600 hover:underline font-medium">
            Back to Homepage
          </Link>
        </p>
      </div>
    </div>
  );
}
