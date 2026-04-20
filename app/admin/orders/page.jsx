// app/admin/orders/page.jsx
'use client';
import { useEffect, useState, useCallback } from 'react';
import Loading from '@/components/Loading';
import OrderStatusTracker from '@/components/OrderStatusTracker';
import OrderTimeline from '@/components/OrderTimeline';
import { useAuth } from '@clerk/nextjs';
import axios from 'axios';
import toast from 'react-hot-toast';
import Image from 'next/image';
import {
  Package,
  Eye,
  RefreshCw,
  FileText,
  X,
  MapPin,
  User,
  CreditCard,
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  History,
  Filter,
  ShieldCheck,
  Ban,
  Truck,
  CheckCircle2,
  Settings,
  PackageCheck,
  DollarSign,
  RotateCcw,
  ClipboardList,
  Download,
  FileSpreadsheet,
  File,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const STATUS_CONFIG = {
  ORDER_PLACED: {
    label: 'Order Placed',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    Icon: ClipboardList,
  },
  CONFIRMED: {
    label: 'Confirmed',
    color: 'bg-violet-100 text-violet-700 border-violet-200',
    Icon: CheckCircle2,
  },
  PROCESSING: {
    label: 'Processing',
    color: 'bg-amber-100 text-amber-700 border-amber-200',
    Icon: Settings,
  },
  SHIPPED: { label: 'Shipped', color: 'bg-cyan-100 text-cyan-700 border-cyan-200', Icon: Truck },
  DELIVERED: {
    label: 'Delivered',
    color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    Icon: PackageCheck,
  },
  CANCELLED: { label: 'Cancelled', color: 'bg-red-100 text-red-700 border-red-200', Icon: Ban },
  RETURN_REQUESTED: {
    label: 'Return Requested',
    color: 'bg-orange-100 text-orange-700 border-orange-200',
    Icon: RotateCcw,
  },
  RETURNED: {
    label: 'Returned',
    color: 'bg-purple-100 text-purple-700 border-purple-200',
    Icon: RefreshCw,
  },
  REFUNDED: {
    label: 'Refunded',
    color: 'bg-teal-100 text-teal-700 border-teal-200',
    Icon: DollarSign,
  },
};

// Admin can transition to any reasonable next state
const ADMIN_TRANSITIONS = {
  ORDER_PLACED: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'DELIVERED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'CANCELLED'],
  DELIVERED: ['RETURN_REQUESTED', 'RETURNED', 'REFUNDED'],
  RETURN_REQUESTED: ['RETURNED', 'REFUNDED', 'DELIVERED'],
  RETURNED: ['REFUNDED'],
  CANCELLED: ['ORDER_PLACED'],
  REFUNDED: [],
};

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const [statusFilter, setStatusFilter] = useState('all');
  const [storeFilter, setStoreFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [statusUpdateLoading, setStatusUpdateLoading] = useState(false);
  const [noteInput, setNoteInput] = useState('');

  const { getToken } = useAuth();

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const params = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (storeFilter !== 'all') params.storeId = storeFilter;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;

      // Use admin endpoint — fetches all orders across all stores
      const { data } = await axios.get('/api/admin/orders', {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
      setOrders(data.orders || []);
    } catch (error) {
      toast.error(error?.response?.data?.error || error.message);
    } finally {
      setLoading(false);
    }
  }, [getToken, statusFilter, storeFilter, dateFrom, dateTo]);

  const fetchStores = useCallback(async () => {
    try {
      const token = await getToken();
      const { data } = await axios.get('/api/admin/stores', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStores(data.stores || []);
    } catch (_) {}
  }, [getToken]);

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      setStatusUpdateLoading(true);
      const token = await getToken();
      const { data } = await axios.put(
        '/api/orders/status',
        { orderId, newStatus, note: noteInput || undefined },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)));
      if (selectedOrder?.id === orderId) {
        setSelectedOrder((prev) => ({
          ...prev,
          status: newStatus,
          timeline: [
            ...(prev.timeline || []),
            {
              id: Date.now().toString(),
              orderId,
              status: newStatus,
              changedBy: 'ADMIN',
              note: noteInput || null,
              createdAt: new Date().toISOString(),
            },
          ],
        }));
      }
      setNoteInput('');

      if (data.inventoryRestored) {
        toast.success(`Status → ${newStatus} | Inventory restored`);
      } else {
        toast.success(`Status updated → ${newStatus}`);
      }
    } catch (error) {
      toast.error(error?.response?.data?.error || error.message);
    } finally {
      setStatusUpdateLoading(false);
    }
  };

  const openModal = (order) => {
    setSelectedOrder(order);
    setActiveTab('details');
    setIsModalOpen(true);
  };
  const closeModal = () => {
    setSelectedOrder(null);
    setIsModalOpen(false);
    setNoteInput('');
  };

  const getStatusBadge = (status) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.ORDER_PLACED;
    const { Icon } = cfg;
    return (
      <span
        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.color}`}
      >
        <Icon size={12} className="mr-1" />
        {cfg.label}
      </span>
    );
  };

  const exportToExcel = () => {
    const rows = orders.map((o) => ({
      'Order ID': o.id,
      Date: new Date(o.createdAt).toLocaleDateString(),
      Store: o.store?.name || 'N/A',
      Customer: o.user?.name || 'Unknown',
      Total: o.total,
      Status: o.status,
      Payment: o.paymentMethod,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Orders');
    XLSX.writeFile(wb, 'Admin_Orders.xlsx');
    toast.success('Excel downloaded!');
    setExportMenuOpen(false);
  };

  const exportToPDF = () => {
    const doc = new jsPDF('landscape');
    doc.setFontSize(18);
    doc.text('Admin Orders Report', 14, 15);
    const rows = orders.map((o) => [
      o.id.slice(0, 8),
      new Date(o.createdAt).toLocaleDateString(),
      o.store?.name || 'N/A',
      o.user?.name || 'Unknown',
      `₹${o.total}`,
      o.status,
    ]);
    autoTable(doc, {
      head: [['Order ID', 'Date', 'Store', 'Customer', 'Total', 'Status']],
      body: rows,
      startY: 25,
      theme: 'grid',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [139, 92, 246] },
    });
    doc.save('Admin_Orders_Report.pdf');
    toast.success('PDF downloaded!');
    setExportMenuOpen(false);
  };

  useEffect(() => {
    fetchOrders();
  }, [statusFilter, storeFilter, dateFrom, dateTo]);
  useEffect(() => {
    fetchStores();
  }, []);

  if (loading) return <Loading />;

  const totalPages = Math.ceil(orders.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, orders.length);
  const currentOrders = orders.slice(startIndex, endIndex);
  const allowedNextStatuses = selectedOrder ? ADMIN_TRANSITIONS[selectedOrder.status] || [] : [];

  return (
    <>
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <h1 className="text-2xl md:text-3xl text-slate-800 font-bold flex items-center">
          <ShieldCheck className="mr-3 h-7 w-7 text-violet-600" />
          All Orders
          <span className="ml-3 text-sm font-normal text-slate-500 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-full">
            Admin
          </span>
        </h1>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchOrders}
            className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-700 bg-violet-50 border border-violet-200 px-3 py-2 rounded-lg transition"
          >
            <RefreshCw size={13} /> Refresh
          </button>
          <div className="relative">
            <button
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
              className="bg-gradient-to-r from-violet-600 to-violet-700 text-white px-4 py-2 rounded-lg text-sm hover:from-violet-700 hover:to-violet-800 transition shadow-sm flex items-center"
            >
              <Download size={16} className="mr-2" /> Export
            </button>
            {exportMenuOpen && (
              <div className="absolute right-0 mt-2 w-36 bg-white rounded-lg shadow-lg z-10 border border-gray-200 py-1">
                <button
                  onClick={exportToPDF}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                >
                  <File size={16} className="mr-2 text-red-500" /> PDF
                </button>
                <button
                  onClick={exportToExcel}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                >
                  <FileSpreadsheet size={16} className="mr-2 text-green-500" /> Excel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Filters ───────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
            <Filter size={15} /> Filters:
          </div>
          <select
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:ring-2 focus:ring-violet-200 outline-none"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="all">All Statuses</option>
            {Object.entries(STATUS_CONFIG).map(([key, { label }]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          {/* Store filter (admin only) */}
          <select
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:ring-2 focus:ring-violet-200 outline-none"
            value={storeFilter}
            onChange={(e) => {
              setStoreFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="all">All Stores</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setCurrentPage(1);
              }}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-violet-200"
            />
            <span className="text-slate-400 text-xs">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setCurrentPage(1);
              }}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-violet-200"
            />
          </div>
          {(statusFilter !== 'all' || storeFilter !== 'all' || dateFrom || dateTo) && (
            <button
              onClick={() => {
                setStatusFilter('all');
                setStoreFilter('all');
                setDateFrom('');
                setDateTo('');
              }}
              className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1"
            >
              <X size={12} /> Clear
            </button>
          )}
          <span className="ml-auto text-xs text-slate-400">{orders.length} orders</span>
        </div>
      </div>

      {/* ── Empty State ───────────────────────────────────────── */}
      {orders.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-10 text-center border border-gray-100">
          <Package size={48} className="text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-800 mb-2">No orders found</h3>
          <p className="text-slate-500 text-sm">Try adjusting your filters.</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-500 mb-3 ml-1">
            Showing {orders.length > 0 ? startIndex + 1 : 0}–{endIndex} of {orders.length} orders
          </p>
          <div className="overflow-hidden bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-gray-600">
                <thead className="bg-gradient-to-r from-violet-50 to-gray-50 text-gray-700 text-xs uppercase tracking-wider border-b border-gray-200">
                  <tr>
                    {[
                      'Order',
                      'Store',
                      'Customer',
                      'Date',
                      'Total',
                      'Payment',
                      'Status',
                      'Actions',
                    ].map((h, i) => (
                      <th key={i} className="px-4 py-3">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {currentOrders.map((order) => (
                    <tr
                      key={order.id}
                      className="hover:bg-violet-50/20 transition-colors cursor-pointer"
                      onClick={() => openModal(order)}
                    >
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                          #{order.id.slice(0, 8)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium text-violet-700 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-full">
                          {order.store?.name || 'N/A'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-700">
                        {order.user?.name || 'Unknown'}
                      </td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">
                        {new Date(order.createdAt).toLocaleDateString('en-US', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        ₹{order.total.toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${order.paymentMethod === 'STRIPE' ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-orange-100 text-orange-700 border-orange-200'}`}
                        >
                          {order.paymentMethod}
                        </span>
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        {getStatusBadge(order.status)}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => openModal(order)}
                          className="p-2 bg-violet-50 rounded-lg text-violet-600 hover:bg-violet-100 transition border border-violet-200"
                          title="View & Manage"
                        >
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div className="flex flex-wrap items-center justify-between gap-4 mt-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Rows per page:</span>
              <select
                value={rowsPerPage}
                onChange={(e) => {
                  setRowsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
              >
                {[5, 10, 25, 50].map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="p-1 border border-gray-300 rounded-lg bg-white disabled:opacity-50"
              >
                <ChevronsLeft size={18} />
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="p-1 border border-gray-300 rounded-lg bg-white disabled:opacity-50"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="px-4 py-2 bg-violet-600 text-white font-medium rounded-lg">
                {currentPage}
              </div>
              <button
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-1 border border-gray-300 rounded-lg bg-white disabled:opacity-50"
              >
                <ChevronRight size={18} />
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="p-1 border border-gray-300 rounded-lg bg-white disabled:opacity-50"
              >
                <ChevronsRight size={18} />
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Admin Order Detail Modal ──────────────────────────── */}
      {isModalOpen && selectedOrder && (
        <div
          onClick={closeModal}
          className="fixed inset-0 flex items-center justify-center bg-black/50 text-slate-700 text-sm backdrop-blur-sm z-50 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl shadow-xl max-w-3xl w-full relative overflow-y-auto max-h-[90vh]"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-violet-600 to-violet-700 text-white px-6 pt-6 pb-4 rounded-t-xl">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold flex items-center">
                  <ShieldCheck className="h-5 w-5 mr-2" />
                  Order #{selectedOrder.id.slice(0, 8)}
                  <span className="ml-3 text-xs font-normal bg-white/20 px-2 py-0.5 rounded-full">
                    {selectedOrder.store?.name}
                  </span>
                </h2>
                <button
                  onClick={closeModal}
                  className="bg-white/20 p-1.5 rounded-full hover:bg-white/30 transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-2 flex items-center gap-3">
                {getStatusBadge(selectedOrder.status)}
                <span className="text-xs text-white/70">
                  {new Date(selectedOrder.createdAt).toLocaleDateString('en-US', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </div>
            </div>

            {/* Status Tracker */}
            <div className="px-6 pt-4 pb-2 border-b border-slate-100">
              <OrderStatusTracker status={selectedOrder.status} />
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 px-6">
              {[
                { key: 'details', label: 'Details', icon: <FileText size={14} /> },
                { key: 'timeline', label: 'Timeline', icon: <History size={14} /> },
                { key: 'actions', label: 'Override Status', icon: <ShieldCheck size={14} /> },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition -mb-px ${
                    activeTab === tab.key
                      ? 'border-violet-600 text-violet-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            <div className="p-6">
              {/* Details Tab */}
              {activeTab === 'details' && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <h3 className="font-semibold text-slate-800 mb-3 flex items-center text-sm">
                        <User className="h-4 w-4 mr-2 text-violet-600" /> Customer
                      </h3>
                      <div className="space-y-1.5 text-sm">
                        {[
                          ['Name', selectedOrder.user?.name],
                          ['Email', selectedOrder.user?.email],
                          ['Phone', selectedOrder.address?.phone],
                        ].map(([k, v]) => (
                          <div key={k} className="flex gap-2">
                            <span className="text-slate-500 w-14 flex-shrink-0">{k}:</span>
                            <span className="font-medium text-slate-800">{v || 'N/A'}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4">
                        <h3 className="font-semibold text-slate-800 mb-2 flex items-center text-sm">
                          <MapPin className="h-4 w-4 mr-2 text-violet-600" /> Address
                        </h3>
                        <p className="text-sm text-slate-600 bg-white rounded-lg border border-slate-200 p-2.5">
                          {selectedOrder.address
                            ? `${selectedOrder.address.street}, ${selectedOrder.address.city}, ${selectedOrder.address.state}, ${selectedOrder.address.zip}`
                            : 'N/A'}
                        </p>
                      </div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <h3 className="font-semibold text-slate-800 mb-3 flex items-center text-sm">
                        <CreditCard className="h-4 w-4 mr-2 text-violet-600" /> Payment
                      </h3>
                      <div className="space-y-1.5 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 w-16 flex-shrink-0">Method:</span>
                          <span
                            className={`font-medium px-2 py-0.5 rounded text-xs ${selectedOrder.paymentMethod === 'STRIPE' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'}`}
                          >
                            {selectedOrder.paymentMethod}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 w-16 flex-shrink-0">Total:</span>
                          <span className="font-bold text-slate-800 text-base">
                            ₹{selectedOrder.total}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Items */}
                  <h3 className="font-semibold text-slate-800 mb-3 flex items-center text-sm">
                    <Package className="h-4 w-4 mr-2 text-violet-600" /> Items (
                    {selectedOrder.orderItems?.length})
                  </h3>
                  <div className="bg-white rounded-xl overflow-hidden border border-slate-200">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                          <tr>
                            {['Product', 'Qty', 'Price', 'Subtotal'].map((h, i) => (
                              <th
                                key={i}
                                className={`px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider ${i === 0 ? 'text-left' : i < 2 ? 'text-center' : 'text-right'}`}
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {selectedOrder.orderItems?.map((item, i) => (
                            <tr key={i}>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  {item.product?.images?.[0] && (
                                    <div className="h-9 w-9 bg-white rounded border border-slate-200 overflow-hidden flex-shrink-0">
                                      <img
                                        src={item.product.images[0]}
                                        alt={item.product.name}
                                        className="h-full w-full object-contain"
                                      />
                                    </div>
                                  )}
                                  <span className="text-sm font-medium text-slate-800">
                                    {item.product?.name}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className="px-2 py-0.5 text-xs bg-violet-50 text-violet-700 rounded-full">
                                  {item.quantity}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right text-sm">₹{item.price}</td>
                              <td className="px-4 py-3 text-right font-medium text-sm">
                                ₹{(item.price * item.quantity).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {/* Timeline Tab */}
              {activeTab === 'timeline' && (
                <div>
                  <h3 className="font-semibold text-slate-800 mb-4 flex items-center text-sm">
                    <History className="h-4 w-4 mr-2 text-violet-600" /> Order History
                  </h3>
                  <OrderTimeline timeline={selectedOrder.timeline || []} />
                </div>
              )}

              {/* Admin Override Tab */}
              {activeTab === 'actions' && (
                <div>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 flex gap-3">
                    <ShieldCheck className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-amber-800">Admin Override</p>
                      <p className="text-xs text-amber-700 mt-0.5">
                        As an admin, you can override order status. All changes are logged in the
                        timeline. Cancelling or returning an order will automatically restore
                        inventory.
                      </p>
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="text-sm font-medium text-slate-700 block mb-1.5">
                      Optional note (logged in timeline):
                    </label>
                    <input
                      type="text"
                      value={noteInput}
                      onChange={(e) => setNoteInput(e.target.value)}
                      placeholder="e.g. Customer requested cancellation"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-200"
                    />
                  </div>

                  <label className="text-sm font-medium text-slate-700 block mb-3">
                    Current: {getStatusBadge(selectedOrder.status)}
                  </label>

                  {allowedNextStatuses.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {allowedNextStatuses.map((s) => {
                        const cfg = STATUS_CONFIG[s];
                        const { Icon } = cfg;
                        return (
                          <button
                            key={s}
                            onClick={() => updateOrderStatus(selectedOrder.id, s)}
                            disabled={statusUpdateLoading}
                            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition hover:opacity-80 disabled:opacity-50 ${cfg.color}`}
                          >
                            <Icon size={14} /> {cfg.label}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400 italic">
                      No further transitions available for this status.
                    </p>
                  )}
                </div>
              )}

              {/* Footer */}
              <div className="flex justify-end mt-6 pt-5 border-t border-gray-200">
                <button
                  onClick={closeModal}
                  className="px-5 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition font-medium text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
