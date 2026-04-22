// components/store/StoreLayout.jsx
'use client';
import { useEffect, useState } from 'react';
import Loading from '../Loading';
import Link from 'next/link';
import { ArrowRightIcon, ShieldAlert, LogIn } from 'lucide-react';
import SellerNavbar from './StoreNavbar';
import SellerSidebar from './StoreSidebar';
import { useAuth, SignIn } from '@clerk/nextjs';
import axios from 'axios';

const StoreLayout = ({ children }) => {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  const [isSeller, setIsSeller]             = useState(false);
  const [loading, setLoading]               = useState(true);
  const [storeInfo, setStoreInfo]           = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [employeeSession, setEmployeeSession] = useState(null);

  // NEW: tracks whether we have an employee token in localStorage
  const [hasEmployeeToken, setHasEmployeeToken] = useState(false);

  const fetchAccess = async () => {
    try {
      // ── PRIORITY 1: Employee JWT ALWAYS wins over Clerk ────────
      const empToken =
        typeof window !== 'undefined'
          ? localStorage.getItem('employeeToken')
          : null;

      if (empToken) {
        setHasEmployeeToken(true);
        try {
          const { data } = await axios.get('/api/store/employee-auth', {
            headers: { Authorization: `Bearer ${empToken}` },
          });

          if (data?.valid && data?.store) {
            setStoreInfo(data.store);
            setEmployeeSession(data.employee);
            setIsSeller(true);
            setLoading(false);
            return;
          }
        } catch {
          // invalid token — fall through
        }
        // Token failed — clear and fall through to Clerk
        localStorage.removeItem('employeeToken');
        localStorage.removeItem('employeeData');
        setHasEmployeeToken(false);
      }

      // ── PRIORITY 2: Clerk store owner (only if no emp token) ───
      if (!isSignedIn) {
        // Don't set isSeller — let the render logic show <SignIn> modal
        setLoading(false);
        return;
      }

      const token = await getToken();
      if (!token) {
        setLoading(false);
        return;
      }

      const { data } = await axios.get('/api/store/is-seller', {
        headers: { Authorization: `Bearer ${token}` },
      });

      setIsSeller(data.isSeller || false);
      setStoreInfo(data.storeInfo || data.store || null);
      setEmployeeSession(null);
    } catch (error) {
      console.error('StoreLayout auth error:', error);
      setIsSeller(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoaded) return;
    fetchAccess();
  }, [isLoaded]);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (
        mobileMenuOpen &&
        !e.target.closest('.mobile-menu-content') &&
        !e.target.closest('.mobile-menu-toggle')
      ) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [mobileMenuOpen]);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : 'auto';
    return () => { document.body.style.overflow = 'auto'; };
  }, [mobileMenuOpen]);

  // ── 1. Clerk/employee SDK not ready yet ──────────────────────
  if (!isLoaded || loading) return <Loading />;

  // ── 2. Fully authenticated seller or employee ─────────────────
  if (isSeller) {
    return (
      <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
        <SellerNavbar
          storeInfo={storeInfo}
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
          employee={employeeSession}
        />
        <div className="flex flex-1 h-full overflow-hidden relative">
          {mobileMenuOpen && (
            <div
              className="fixed inset-0 bg-slate-900/50 z-40 md:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
          )}
          <div
            className={`fixed md:relative md:flex h-full z-50 transition-transform duration-300 ease-in-out transform ${
              mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
            } mobile-menu-content`}
          >
            <SellerSidebar
              storeInfo={storeInfo}
              closeMobileMenu={() => setMobileMenuOpen(false)}
              employee={employeeSession}
            />
          </div>
          <div className="flex-1 h-full overflow-y-auto hide-scrollbar bg-slate-50 relative">
            <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-green-100/20 to-transparent rounded-full -translate-y-1/2 translate-x-1/2 z-0 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-slate-100/30 to-transparent rounded-full translate-y-1/2 -translate-x-1/2 z-0 pointer-events-none" />
            <div className="relative z-10 p-5 lg:pl-12 lg:pt-12">{children}</div>
            <div className="pb-4 text-center text-xs text-slate-400 relative z-10">
              {/* <p>
                © {new Date().getFullYear()}{' '}
                {storeInfo?.name || 'Store Dashboard'} • All Rights Reserved
              </p> */}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── 3. No Clerk session AND no employee token
  //       → Show Clerk <SignIn> modal (same as /admin behaviour) ─
  if (!isSignedIn && !hasEmployeeToken) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <SignIn fallbackRedirectUrl="/store" routing="hash" />
      </div>
    );
  }

  // ── 4. Signed in via Clerk BUT not a seller
  //       → Show "Access Denied" (they need to create/join a store) 
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-6 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-md bg-white p-8 rounded-2xl shadow-lg border border-slate-200">
        <div className="bg-red-50 w-20 h-20 flex items-center justify-center rounded-full mx-auto mb-6">
          <ShieldAlert size={36} className="text-red-500" />
        </div>
        <h1 className="text-2xl font-semibold text-slate-800 mb-3">Access Denied</h1>
        <p className="text-slate-500 mb-6 text-sm">
          You need to be a store owner or employee to access this dashboard.
        </p>
        <div className="flex flex-col gap-3">
          <Link
            href="/create-store"
            className="bg-gradient-to-r from-green-600 to-green-700 text-white flex items-center justify-center gap-2 py-3 px-6 rounded-lg text-sm font-medium shadow-md hover:from-green-700 hover:to-green-800 transition"
          >
            <LogIn size={16} /> Store / Employee Login
          </Link>
          {/* <Link
            href="/"
            className="bg-gradient-to-r from-slate-700 to-slate-800 text-white flex items-center justify-center gap-2 py-3 px-6 rounded-lg text-sm font-medium shadow-md hover:from-slate-800 hover:to-slate-900 transition"
          >
            Back to Homepage <ArrowRightIcon size={18} />
          </Link> */}
        </div>
      </div>
    </div>
  );
};

export default StoreLayout;