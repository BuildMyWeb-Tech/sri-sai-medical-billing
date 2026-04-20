// app/employee/orders/page.jsx
'use client';
import { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import Loading from '@/components/Loading';
import { ShoppingBag, ShieldAlert } from 'lucide-react';

export default function EmployeeOrdersPage() {
  const [employee, setEmployee] = useState(null);
  const [orders, setOrders]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [allowed, setAllowed]   = useState(false);

  useEffect(() => {
    const empData = localStorage.getItem('empData');
    const token   = localStorage.getItem('empToken');
    if (!empData || !token) return;

    const parsed = JSON.parse(empData);
    setEmployee(parsed);

    const hasAccess = parsed.role === 'STORE_OWNER' || parsed.permissions?.orders === true;
    setAllowed(hasAccess);

    if (!hasAccess) { setLoading(false); return; }

    axios.get('/api/store/orders', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(({ data }) => setOrders(data.orders || []))
      .catch((err) => toast.error(err?.response?.data?.error || 'Failed to load orders'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;

  if (!allowed) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-4">
          <ShieldAlert size={36} className="text-red-400" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Access Denied</h2>
        <p className="text-slate-500 text-sm">You don't have permission to view orders.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-20">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <ShoppingBag size={22} className="text-blue-600" /> Orders
        </h1>
        <p className="text-slate-500 text-sm mt-1">{orders.length} orders found</p>
      </div>

      {orders.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
          <ShoppingBag size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500">No orders yet</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Order ID', 'Customer', 'Total', 'Status', 'Date'].map((h) => (
                    <th key={h} className="text-left px-5 py-3 font-medium text-slate-500 text-xs uppercase">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 text-xs text-slate-400 font-mono">
                      #{order.id.slice(0, 8)}
                    </td>
                    <td className="px-5 py-3 font-medium text-slate-700">
                      {order.user?.name || 'Unknown'}
                    </td>
                    <td className="px-5 py-3 text-green-700 font-semibold">
                      ₹{order.total.toLocaleString('en-IN')}
                    </td>
                    <td className="px-5 py-3">
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                        {order.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-400 text-xs">
                      {new Date(order.createdAt).toLocaleDateString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}