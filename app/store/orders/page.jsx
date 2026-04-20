// app/store/orders/page.jsx
'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import Loading from '@/components/Loading';
import OrderStatusTracker from '@/components/OrderStatusTracker';
import OrderTimeline from '@/components/OrderTimeline';
import { useAuth } from '@clerk/nextjs';
import axios from 'axios';
import toast from 'react-hot-toast';
import Image from 'next/image';
import {
  Eye,
  Trash2,
  AlertCircle,
  Package,
  Truck,
  CheckCircle,
  IndianRupee,
  ClipboardList,
  Download,
  RefreshCw,
  FileText,
  FileSpreadsheet,
  File,
  Printer,
  X,
  MapPin,
  User,
  CreditCard,
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Ban,
  History,
  Filter,
  ChevronDown,
  RotateCcw,
  CheckCircle2,
  Settings,
  PackageCheck,
  DollarSign,
} from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

// ── Status config ─────────────────────────────────────────────────
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

// Allowed transitions for store users
const STORE_TRANSITIONS = {
  ORDER_PLACED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: ['RETURN_REQUESTED'],
  RETURN_REQUESTED: ['RETURNED'],
  RETURNED: ['REFUNDED'],
  CANCELLED: [],
  REFUNDED: [],
};

export default function StoreOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('details'); // 'details' | 'timeline'
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [statusUpdateLoading, setStatusUpdateLoading] = useState(false);

  const invoiceRef = useRef(null);
  const { getToken } = useAuth();

  const handlePrint = useReactToPrint({
    content: () => invoiceRef.current,
    documentTitle: `Invoice-${selectedOrder?.id?.slice(0, 8) || 'order'}`,
    onAfterPrint: () => toast.success('Invoice printed!'),
  });

  const generatePDF = (order) => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(`INVOICE #${order.id.slice(0, 8)}`, 20, 20);
    doc.setFontSize(12);
    doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`, 20, 35);
    doc.text(`Customer: ${order.user?.name || 'N/A'}`, 20, 45);
    doc.text(`Email: ${order.user?.email || 'N/A'}`, 20, 55);
    const rows = order.orderItems.map((item) => [
      item.product?.name || 'Unknown',
      item.quantity,
      `₹${item.price}`,
      `₹${(item.price * item.quantity).toFixed(2)}`,
    ]);
    autoTable(doc, {
      head: [['Product', 'Qty', 'Price', 'Subtotal']],
      body: rows,
      startY: 70,
      theme: 'grid',
    });
    const y = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(14);
    doc.text(`Total: ₹${order.total}`, 20, y);
    doc.save(`Invoice-${order.id.slice(0, 8)}.pdf`);
    toast.success('Invoice downloaded!');
  };

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const params = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;

      const { data } = await axios.get('/api/store/orders', {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
      setOrders(data.orders);
    } catch (error) {
      toast.error(error?.response?.data?.error || error.message);
    } finally {
      setLoading(false);
    }
  }, [getToken, statusFilter, dateFrom, dateTo]);

  const updateOrderStatus = async (orderId, newStatus, note = '') => {
    try {
      setStatusUpdateLoading(true);
      const token = await getToken();
      const { data } = await axios.post(
        '/api/store/orders',
        { orderId, status: newStatus, note },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)));
      if (selectedOrder?.id === orderId) {
        setSelectedOrder((prev) =>
          prev === null
            ? null
            : {
                ...prev,
                status: newStatus,
                timeline: [
                  ...(prev.timeline || []),
                  {
                    id: Date.now().toString(),
                    orderId,
                    status: newStatus,
                    changedBy: 'STORE',
                    note: note || null,
                    createdAt: new Date().toISOString(),
                  },
                ],
              }
        );
      }

      if (data.inventoryRestored) {
        toast.success(`Status updated to ${newStatus} — inventory restored`);
      } else {
        toast.success(`Order status updated to ${newStatus}`);
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
  };

  const openDeleteConfirm = (e, order) => {
    e.stopPropagation();
    setOrderToDelete(order);
    setIsDeleteConfirmOpen(true);
  };
  const closeDeleteConfirm = () => {
    setOrderToDelete(null);
    setIsDeleteConfirmOpen(false);
  };

  const handleDeleteOrder = async () => {
    setOrders((prev) => prev.filter((o) => o.id !== orderToDelete.id));
    toast.success('Order removed from view');
    closeDeleteConfirm();
  };

  const exportToExcel = () => {
    const rows = orders.map((order) => ({
      'Order ID': order.id,
      Date: new Date(order.createdAt).toLocaleDateString(),
      Customer: order.user?.name || 'Unknown',
      Email: order.user?.email || 'N/A',
      Items: order.orderItems?.length || 0,
      'Total Amount': order.total,
      'Payment Method': order.paymentMethod || 'N/A',
      Status: order.status,
      'Coupon Used': order.isCouponUsed ? order.coupon?.code : 'No',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Orders');
    XLSX.writeFile(wb, 'Store_Orders.xlsx');
    toast.success('Excel downloaded!');
    setExportMenuOpen(false);
  };

  const exportToPDF = () => {
    const doc = new jsPDF('landscape');
    doc.setFontSize(18);
    doc.text('Store Orders Report', 14, 15);
    const rows = orders.map((order) => [
      order.id.slice(0, 8),
      new Date(order.createdAt).toLocaleDateString(),
      order.user?.name || 'Unknown',
      order.orderItems?.length || 0,
      `₹${order.total}`,
      order.status,
    ]);
    autoTable(doc, {
      head: [['Order ID', 'Date', 'Customer', 'Items', 'Total', 'Status']],
      body: rows,
      startY: 25,
      theme: 'grid',
      styles: { fontSize: 10 },
      headStyles: { fillColor: [59, 130, 246] },
    });
    doc.save('Store_Orders_Report.pdf');
    toast.success('PDF downloaded!');
    setExportMenuOpen(false);
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

  useEffect(() => {
    fetchOrders();
  }, [statusFilter, dateFrom, dateTo]);

  if (loading) return <Loading />;

  // ── Client-side pagination (server already filtered) ─────────────
  const totalPages = Math.ceil(orders.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, orders.length);
  const currentOrders = orders.slice(startIndex, endIndex);

  // Allowed next statuses for selected order
  const allowedNextStatuses = selectedOrder ? STORE_TRANSITIONS[selectedOrder.status] || [] : [];

  return (
    <>
      {/* ── Page Header ───────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <h1 className="text-2xl md:text-3xl text-slate-800 font-bold flex items-center">
          <Package className="mr-3 h-7 w-7 text-blue-600" />
          Order Management
        </h1>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchOrders}
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 bg-blue-50 border border-blue-200 px-3 py-2 rounded-lg transition"
          >
            <RefreshCw size={13} /> Refresh
          </button>
          <div className="relative">
            <button
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
              className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 rounded-lg text-sm hover:from-blue-700 hover:to-blue-800 transition shadow-sm flex items-center"
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
          {/* Status filter */}
          <select
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:ring-2 focus:ring-blue-200 outline-none"
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
          {/* Date range */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setCurrentPage(1);
              }}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="From"
            />
            <span className="text-slate-400 text-xs">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setCurrentPage(1);
              }}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="To"
            />
          </div>
          {(statusFilter !== 'all' || dateFrom || dateTo) && (
            <button
              onClick={() => {
                setStatusFilter('all');
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
          <div className="flex justify-center mb-6">
            <div className="bg-slate-100 p-6 rounded-full">
              <Package size={50} className="text-slate-400" />
            </div>
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-3">No orders found</h3>
          <p className="text-slate-500 max-w-md mx-auto mb-6">
            Try adjusting your filters or check back later.
          </p>
          <button
            onClick={fetchOrders}
            className="inline-flex items-center px-5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg font-medium transition"
          >
            <RefreshCw size={16} className="mr-2" /> Refresh
          </button>
        </div>
      ) : (
        <>
          {/* ── Showing count ──────────────────────────────────── */}
          <p className="text-xs text-gray-500 mb-3 ml-1">
            Showing {orders.length > 0 ? startIndex + 1 : 0}–{endIndex} of {orders.length} orders
          </p>

          {/* ── Orders Table ───────────────────────────────────── */}
          <div className="overflow-hidden bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-gray-600">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100 text-gray-700 text-xs uppercase tracking-wider border-b border-gray-200">
                  <tr>
                    {[
                      'Product',
                      'Customer',
                      'Date',
                      'Total',
                      'Payment',
                      'Coupon',
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
                      className="hover:bg-blue-50/30 transition-colors cursor-pointer"
                      onClick={() => openModal(order)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {order.orderItems?.[0]?.product?.images?.[0] && (
                            <div className="h-10 w-10 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-200">
                              <Image
                                src={order.orderItems[0].product.images[0]}
                                alt={order.orderItems[0].product.name || 'Product'}
                                width={40}
                                height={40}
                                className="object-cover h-full w-full"
                              />
                            </div>
                          )}
                          <span className="text-xs font-medium bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                            {order.orderItems?.length || 0} item
                            {order.orderItems?.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-700">
                        {order.user?.name || 'Unknown'}
                      </td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
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
                      <td className="px-4 py-3">
                        {order.isCouponUsed ? (
                          <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full border border-green-200">
                            {order.coupon?.code}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        {getStatusBadge(order.status)}
                      </td>
                      <td className="px-4 py-3">
                        <div
                          className="flex items-center gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => openModal(order)}
                            className="p-2 bg-blue-50 rounded-lg text-blue-600 hover:bg-blue-100 transition border border-blue-200"
                            title="View"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => generatePDF(order)}
                            className="p-2 bg-green-50 rounded-lg text-green-600 hover:bg-green-100 transition border border-green-200"
                            title="Invoice"
                          >
                            <FileText size={16} />
                          </button>
                          <button
                            onClick={(e) => openDeleteConfirm(e, order)}
                            className="p-2 bg-red-50 rounded-lg text-red-600 hover:bg-red-100 transition border border-red-200"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Pagination ─────────────────────────────────────── */}
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
              <div className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg">
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

      {/* ── Order Detail Modal ────────────────────────────────── */}
      {isModalOpen && selectedOrder && (
        <div
          onClick={closeModal}
          className="fixed inset-0 flex items-center justify-center bg-black/50 text-slate-700 text-sm backdrop-blur-sm z-50 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl shadow-xl max-w-3xl w-full relative overflow-y-auto max-h-[90vh]"
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 pt-6 pb-4 rounded-t-xl">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold flex items-center">
                  <FileText className="h-5 w-5 mr-2" />
                  Order #{selectedOrder.id.slice(0, 8)}
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
                { key: 'details', label: 'Order Details', icon: <FileText size={14} /> },
                { key: 'timeline', label: 'Timeline', icon: <History size={14} /> },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition -mb-px ${
                    activeTab === tab.key
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            <div className="p-6">
              {/* ── DETAILS TAB ─────────────────────────────────── */}
              {activeTab === 'details' && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                    {/* Customer */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <h3 className="font-semibold text-slate-800 mb-3 flex items-center text-sm">
                        <User className="h-4 w-4 mr-2 text-blue-600" /> Customer Details
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
                          <MapPin className="h-4 w-4 mr-2 text-blue-600" /> Address
                        </h3>
                        <p className="text-sm text-slate-600 bg-white rounded-lg border border-slate-200 p-2.5">
                          {selectedOrder.address
                            ? `${selectedOrder.address.street}, ${selectedOrder.address.city}, ${selectedOrder.address.state}, ${selectedOrder.address.zip}, ${selectedOrder.address.country}`
                            : 'N/A'}
                        </p>
                      </div>
                    </div>

                    {/* Payment */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <h3 className="font-semibold text-slate-800 mb-3 flex items-center text-sm">
                        <CreditCard className="h-4 w-4 mr-2 text-blue-600" /> Payment Details
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
                          <span className="text-slate-500 w-16 flex-shrink-0">Paid:</span>
                          <span
                            className={`font-medium px-2 py-0.5 rounded text-xs ${selectedOrder.isPaid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                          >
                            {selectedOrder.isPaid ? 'Paid' : 'Unpaid'}
                          </span>
                        </div>
                        {selectedOrder.isCouponUsed && (
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500 w-16 flex-shrink-0">Coupon:</span>
                            <span className="font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded text-xs">
                              {selectedOrder.coupon?.code} ({selectedOrder.coupon?.discount}% off)
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Update Status */}
                      <div className="mt-4">
                        <h3 className="font-semibold text-slate-800 mb-2 flex items-center text-sm">
                          <Clock className="h-4 w-4 mr-2 text-blue-600" /> Update Status
                        </h3>
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
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition hover:opacity-80 disabled:opacity-50 ${cfg.color}`}
                                >
                                  <Icon size={12} />
                                  {cfg.label}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 italic">
                            No further status updates available.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Order Items */}
                  <h3 className="font-semibold text-slate-800 mb-3 flex items-center text-sm">
                    <Package className="h-4 w-4 mr-2 text-blue-600" /> Order Items
                  </h3>
                  <div className="bg-white rounded-xl overflow-hidden border border-slate-200">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                          <tr>
                            {['Product', 'Quantity', 'Price', 'Subtotal'].map((h, i) => (
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
                          {selectedOrder.orderItems.map((item, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                              <td className="px-4 py-3">
                                <div className="flex items-center">
                                  <div className="h-10 w-10 bg-white rounded-lg overflow-hidden mr-3 flex-shrink-0 border border-slate-200">
                                    <img
                                      src={item.product?.images?.[0]}
                                      alt={item.product?.name}
                                      className="h-full w-full object-contain"
                                    />
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-slate-800">
                                      {item.product?.name}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                      ID: {item.product?.id?.slice(0, 8)}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className="px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-full">
                                  {item.quantity}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right text-sm text-slate-800">
                                ₹{item.price}
                              </td>
                              <td className="px-4 py-3 text-right font-medium text-slate-800">
                                ₹{(item.price * item.quantity).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                          <tr>
                            <td
                              colSpan="3"
                              className="px-4 py-3 text-right text-sm font-medium text-slate-500"
                            >
                              Total:
                            </td>
                            <td className="px-4 py-3 text-right text-base font-bold text-blue-600">
                              ₹{selectedOrder.total}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {/* ── TIMELINE TAB ────────────────────────────────── */}
              {activeTab === 'timeline' && (
                <div>
                  <h3 className="font-semibold text-slate-800 mb-4 flex items-center text-sm">
                    <History className="h-4 w-4 mr-2 text-blue-600" /> Order History
                  </h3>
                  <OrderTimeline timeline={selectedOrder.timeline || []} />
                </div>
              )}

              {/* Modal Footer */}
              <div className="flex flex-col sm:flex-row sm:justify-end gap-3 mt-6 pt-5 border-t border-gray-200">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition font-medium text-sm"
                >
                  Close
                </button>
                <button
                  onClick={handlePrint}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition font-medium flex items-center text-sm"
                >
                  <Printer size={15} className="mr-2" /> Print
                </button>
                <button
                  onClick={() => generatePDF(selectedOrder)}
                  className="px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition font-medium flex items-center text-sm"
                >
                  <Download size={15} className="mr-2" /> Invoice PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Hidden Invoice for Print ──────────────────────────── */}
      <div className="hidden">
        <div ref={invoiceRef} className="p-8 bg-white max-w-3xl mx-auto text-slate-800">
          {selectedOrder && (
            <div>
              <div className="flex justify-between items-start border-b border-gray-200 pb-6 mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-blue-700 mb-1">INVOICE</h1>
                  <p className="text-xs text-gray-500">Order #{selectedOrder.id.slice(0, 8)}</p>
                </div>
                <h2 className="text-xl font-bold">GoCart Store</h2>
              </div>
              <table className="min-w-full mb-8">
                <thead>
                  <tr className="border-b border-gray-200">
                    {['Item Description', 'Qty', 'Unit Price', 'Amount'].map((h, i) => (
                      <th
                        key={i}
                        className={`py-3 px-2 text-sm font-semibold text-gray-600 ${i === 0 ? 'text-left' : 'text-right'}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {selectedOrder.orderItems.map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-100">
                      <td className="py-3 px-2 text-sm font-medium">{item.product?.name}</td>
                      <td className="py-3 px-2 text-right text-sm">{item.quantity}</td>
                      <td className="py-3 px-2 text-right text-sm">₹{item.price}</td>
                      <td className="py-3 px-2 text-right text-sm">
                        ₹{(item.price * item.quantity).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-end">
                <div className="w-64 border-t border-gray-200 pt-3">
                  <div className="flex justify-between text-base font-bold">
                    <p>Total:</p>
                    <p>₹{selectedOrder.total}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Delete Confirm Modal ──────────────────────────────── */}
      {isDeleteConfirmOpen && orderToDelete && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6 text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-5">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-3">Remove Order</h3>
            <p className="text-slate-600 mb-6">Remove this order from your view?</p>
            <div className="flex justify-center gap-3">
              <button
                onClick={closeDeleteConfirm}
                className="px-5 py-2.5 bg-slate-100 text-slate-800 rounded-lg hover:bg-slate-200 transition font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteOrder}
                className="px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
