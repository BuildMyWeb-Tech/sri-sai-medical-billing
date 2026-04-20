// app/employee/add-product/page.jsx
'use client';
import { useEffect, useState } from 'react';
import { ShieldAlert, PackageOpen, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

// Employees cannot add products — this page shows a clear "no access" message
// with guidance to go to manage products (view) instead.
// If the store owner ever grants "add_product" permission this can be extended.

export default function EmployeeAddProductPage() {
  const [employee, setEmployee] = useState(null);
  const [allowed, setAllowed] = useState(false);
  const [pageReady, setPageReady] = useState(false);

  useEffect(() => {
    const empData = localStorage.getItem('empData');
    if (!empData) return;
    const parsed = JSON.parse(empData);
    setEmployee(parsed);
    const hasAccess =
      parsed.role === 'STORE_OWNER' ||
      parsed.permissions?.add_product === true ||
      parsed.permissions?.add_products === true;
    setAllowed(hasAccess);
    setPageReady(true);
  }, []);

  if (!pageReady) return null;

  if (!allowed) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-4">
          <ShieldAlert size={36} className="text-red-400" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Access Denied</h2>
        <p className="text-slate-500 text-sm max-w-sm">
          Adding products requires store owner permission. Contact your store owner if you need access.
        </p>
        <Link
          href="/employee/manage-product"
          className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <ArrowLeft size={16} /> View Products Instead
        </Link>
      </div>
    );
  }

  // If the employee somehow has add_product permission (store owner role),
  // show a redirect notice — full form is only available in the store panel.
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mb-4">
        <PackageOpen size={36} className="text-amber-500" />
      </div>
      <h2 className="text-xl font-bold text-slate-800 mb-2">Add Product</h2>
      <p className="text-slate-500 text-sm max-w-sm">
        To add new products, please use the <strong>Store Panel</strong>. The employee portal currently supports viewing products only.
      </p>
      <Link
        href="/employee/manage-product"
        className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
      >
        <ArrowLeft size={16} /> View Products
      </Link>
    </div>
  );
}