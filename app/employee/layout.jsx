// app/employee/layout.jsx
'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Loading from '@/components/Loading';
import EmployeeNavbar from '@/components/employee/EmployeeNavbar';
import EmployeeSidebar from '@/components/employee/EmployeeSidebar';

export default function EmployeeLayout({ children }) {
  const router   = useRouter();
  const pathname = usePathname();

  const [employee, setEmployee]     = useState(null);
  const [storeInfo, setStoreInfo]   = useState(null);
  const [loading, setLoading]       = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    // Login page — no auth check needed
    if (pathname === '/employee/login') {
      setLoading(false);
      return;
    }

    const token   = localStorage.getItem('empToken');
const empData = localStorage.getItem('empData');

if (!token || !empData) {
  router.replace('/employee/login');
  return;
}

// Use cached session — skip API call if already verified this session
const cached = sessionStorage.getItem('empSession');
if (cached) {
  try {
    const { employee: emp, store } = JSON.parse(cached);
    setEmployee(emp);
    setStoreInfo(store);
    setLoading(false);
    return;
  } catch {
    sessionStorage.removeItem('empSession');
  }
}

// First load — verify token once, then cache result
fetch('/api/store/employee-auth', {
  method: 'GET',
  headers: { 'Authorization': `Bearer ${token}` },
})
  .then(async (res) => {
    const data = await res.json();
    if (!data.valid) {
      localStorage.removeItem('empToken');
      localStorage.removeItem('empData');
      router.replace('/employee/login');
      return;
    }
    sessionStorage.setItem('empSession', JSON.stringify({
      employee: data.employee,
      store: data.store,
    }));
    setEmployee(data.employee);
    setStoreInfo(data.store);
    setLoading(false);
  })
  .catch(() => router.replace('/employee/login'));
  }, [pathname]);

  // Login page — render without layout wrapper
  if (pathname === '/employee/login') {
    return <>{children}</>;
  }

if (loading) return (
  <div className="flex flex-col h-screen bg-slate-50 overflow-hidden animate-pulse">
    <div className="h-14 bg-white border-b border-slate-100 flex items-center px-6 gap-4">
      <div className="w-8 h-8 bg-slate-200 rounded-lg" />
      <div className="w-32 h-4 bg-slate-200 rounded" />
      <div className="ml-auto flex gap-3">
        <div className="w-8 h-8 bg-slate-200 rounded-full" />
      </div>
    </div>
    <div className="flex flex-1 overflow-hidden">
      <div className="hidden md:flex flex-col w-56 bg-white border-r border-slate-100 p-4 gap-3">
        <div className="w-full h-8 bg-slate-100 rounded-lg" />
        <div className="w-full h-8 bg-slate-100 rounded-lg" />
        <div className="w-3/4 h-8 bg-slate-100 rounded-lg" />
      </div>
      <div className="flex-1 p-8 space-y-4">
        <div className="w-48 h-6 bg-slate-200 rounded" />
        <div className="w-full h-32 bg-slate-100 rounded-xl" />
        <div className="grid grid-cols-3 gap-4">
          <div className="h-24 bg-slate-100 rounded-xl" />
          <div className="h-24 bg-slate-100 rounded-xl" />
          <div className="h-24 bg-slate-100 rounded-xl" />
        </div>
      </div>
    </div>
  </div>
);
  if (!employee) return null;

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
      <EmployeeNavbar
        storeInfo={storeInfo}
        employee={employee}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />
      <div className="flex flex-1 h-full overflow-hidden relative">
        {mobileOpen && (
          <div
            className="fixed inset-0 bg-slate-900/50 z-40 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
        <div
          className={`fixed md:relative md:flex h-full z-50 transition-transform duration-300 ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          }`}
        >
          <EmployeeSidebar
            storeInfo={storeInfo}
            employee={employee}
            closeMobileMenu={() => setMobileOpen(false)}
          />
        </div>
        <div className="flex-1 h-full overflow-y-auto bg-slate-50">
          <div className="p-5 lg:pl-12 lg:pt-12">{children}</div>
          {/* <div className="pb-4 text-center text-xs text-slate-400">
            <p>© {new Date().getFullYear()} {storeInfo?.name} • Employee Portal</p>
          </div> */}
        </div>
      </div>
    </div>
  );
}