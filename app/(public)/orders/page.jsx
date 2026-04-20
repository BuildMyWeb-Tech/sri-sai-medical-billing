'use client'
import PageTitle from "@/components/PageTitle"
import { useEffect, useState } from "react";
import OrderItem from "@/components/OrderItem";
import { useAuth, useUser } from "@clerk/nextjs";
import axios from "axios";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import Loading from "@/components/Loading";
import { ShoppingBagIcon, ChevronRightIcon, CheckCircleIcon, ClipboardListIcon, PackageIcon, TruckIcon, FilterIcon } from "lucide-react";
import Link from "next/link";

export default function Orders() {
    const {getToken} = useAuth()
    const {user, isLoaded} = useUser()
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true)
    const [activeFilter, setActiveFilter] = useState('all')

    const router = useRouter()

    useEffect(() => {
       const fetchOrders = async () => {
        try {
            const token = await getToken()
            const { data } = await axios.get('/api/orders', { headers: { Authorization: `Bearer ${token}` } })
            setOrders(data.orders)
            setLoading(false)
        } catch (error) {
            toast.error(error?.response?.data?.error || error.message)
        }
       }
       if(isLoaded){
        if(user){
            fetchOrders()
        }else{
            router.push('/')
        }
       }
    }, [isLoaded, user, getToken, router]);
    
    // Filter orders based on status
    const getFilteredOrders = () => {
        if (activeFilter === 'all') return orders;
        return orders.filter(order => {
            switch (activeFilter) {
                case 'processing':
                    return ['ORDER_PLACED', 'PROCESSING'].includes(order.status);
                case 'shipped':
                    return order.status === 'SHIPPED';
                case 'delivered':
                    return order.status === 'DELIVERED';
                default:
                    return true;
            }
        });
    }
    
    const filteredOrders = getFilteredOrders();
    
    // Status badge and icon
    const getStatusBadge = (status) => {
        switch(status) {
            case 'ORDER_PLACED':
                return {
                    color: 'bg-blue-100 text-blue-700',
                    icon: <ClipboardListIcon size={14} className="mr-1" />,
                    text: 'Order Placed'
                };
            case 'PROCESSING':
                return {
                    color: 'bg-yellow-100 text-yellow-700',
                    icon: <PackageIcon size={14} className="mr-1" />,
                    text: 'Processing'
                };
            case 'SHIPPED':
                return {
                    color: 'bg-indigo-100 text-indigo-700',
                    icon: <TruckIcon size={14} className="mr-1" />,
                    text: 'Shipped'
                };
            case 'DELIVERED':
                return {
                    color: 'bg-green-100 text-green-700',
                    icon: <CheckCircleIcon size={14} className="mr-1" />,
                    text: 'Delivered'
                };
            default:
                return {
                    color: 'bg-slate-100 text-slate-700',
                    icon: <ClipboardListIcon size={14} className="mr-1" />,
                    text: status
                };
        }
    }

    if(!isLoaded || loading){
        return <Loading />
    }

    return (
        <div className="min-h-[70vh] mx-6">
            {orders.length > 0 ? (
                (
                    <div className="my-10 max-w-7xl mx-auto">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
                            <PageTitle heading="My Orders" text={`Showing ${filteredOrders.length} of ${orders.length} orders`} linkText={'Continue shopping'} />
                            
                            {/* Filter tabs for desktop */}
                            <div className="hidden md:flex bg-white shadow-sm rounded-lg overflow-hidden">
                                <button 
                                    className={`px-4 py-2 text-sm font-medium ${activeFilter === 'all' ? 'bg-slate-800 text-white' : 'hover:bg-slate-50'}`}
                                    onClick={() => setActiveFilter('all')}
                                >
                                    All Orders
                                </button>
                                <button 
                                    className={`px-4 py-2 text-sm font-medium ${activeFilter === 'processing' ? 'bg-slate-800 text-white' : 'hover:bg-slate-50'}`}
                                    onClick={() => setActiveFilter('processing')}
                                >
                                    Processing
                                </button>
                                <button 
                                    className={`px-4 py-2 text-sm font-medium ${activeFilter === 'shipped' ? 'bg-slate-800 text-white' : 'hover:bg-slate-50'}`}
                                    onClick={() => setActiveFilter('shipped')}
                                >
                                    Shipped
                                </button>
                                <button 
                                    className={`px-4 py-2 text-sm font-medium ${activeFilter === 'delivered' ? 'bg-slate-800 text-white' : 'hover:bg-slate-50'}`}
                                    onClick={() => setActiveFilter('delivered')}
                                >
                                    Delivered
                                </button>
                            </div>
                            
                            {/* Mobile filter dropdown */}
                            <div className="md:hidden">
                                <div className="flex items-center gap-2 bg-white p-2 rounded-lg shadow-sm">
                                    <FilterIcon size={16} className="text-slate-500" />
                                    <select 
                                        value={activeFilter}
                                        onChange={(e) => setActiveFilter(e.target.value)}
                                        className="text-sm border-none bg-transparent focus:outline-none w-full"
                                    >
                                        <option value="all">All Orders</option>
                                        <option value="processing">Processing</option>
                                        <option value="shipped">Shipped</option>
                                        <option value="delivered">Delivered</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Desktop View */}
                        <div className="hidden md:block overflow-hidden bg-white rounded-xl shadow-sm border border-slate-200">
                            <table className="w-full max-w-5xl text-slate-500 table-auto">
                                <thead className="bg-slate-50 text-slate-700 text-xs uppercase">
                                    <tr>
                                        <th className="text-left px-6 py-4 font-semibold">Order Id & Date</th>
                                        <th className="text-left px-6 py-4 font-semibold">Product</th>
                                        <th className="text-left px-6 py-4 font-semibold">Total</th>
                                        <th className="text-left px-6 py-4 font-semibold">Status</th>
                                        <th className="text-left px-6 py-4 font-semibold">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredOrders.map((order) => {
                                        const status = getStatusBadge(order.status);
                                        return (
                                            <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <p className="font-medium text-slate-800">#{order.id.slice(0, 8)}</p>
                                                    <p className="text-xs text-slate-500">
                                                        {new Date(order.createdAt).toLocaleDateString('en-US', {
                                                            day: 'numeric',
                                                            month: 'short',
                                                            year: 'numeric'
                                                        })}
                                                    </p>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        {order.orderItems && order.orderItems[0] && (
                                                            <div className="h-10 w-10 bg-slate-100 rounded-md overflow-hidden flex items-center justify-center">
                                                                                                                                <img 
                                                                    src={order.orderItems[0].product?.images?.[0]} 
                                                                    alt={order.orderItems[0].product?.name} 
                                                                    className="h-full w-full object-contain"
                                                                />
                                                            </div>
                                                        )}
                                                        <div>
                                                            <p className="text-sm font-medium text-slate-700 line-clamp-1">
                                                                {order.orderItems && order.orderItems[0]?.product?.name}
                                                            </p>
                                                            <p className="text-xs text-slate-500">
                                                                {order.orderItems?.length > 1 ? `+${order.orderItems.length - 1} more items` : ''}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 font-medium">₹ {order.total}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${status.color}`}>
                                                        {status.icon} {status.text}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <Link 
                                                        href={`/orders/${order.id}`} 
                                                        className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 font-medium"
                                                    >
                                                        View Details
                                                        <ChevronRightIcon size={16} className="ml-1" />
                                                    </Link>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile View */}
                        <div className="md:hidden space-y-4">
                            {filteredOrders.map((order) => {
                                const status = getStatusBadge(order.status);
                                return (
                                    <div key={order.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <p className="text-sm font-medium text-slate-800">Order #{order.id.slice(0, 8)}</p>
                                                <p className="text-xs text-slate-500">
                                                    {new Date(order.createdAt).toLocaleDateString('en-US', {
                                                        day: 'numeric',
                                                        month: 'short',
                                                        year: 'numeric'
                                                    })}
                                                </p>
                                            </div>
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${status.color}`}>
                                                {status.icon} {status.text}
                                            </span>
                                        </div>
                                        
                                        <div className="flex items-center gap-3 py-3 border-t border-b border-slate-100">
                                            {order.orderItems && order.orderItems[0] && (
                                                <div className="h-14 w-14 bg-slate-100 rounded-md overflow-hidden flex-shrink-0 flex items-center justify-center">
                                                    <img 
                                                        src={order.orderItems[0].product?.images?.[0]} 
                                                        alt={order.orderItems[0].product?.name} 
                                                        className="h-full w-full object-contain"
                                                    />
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-slate-800 truncate">
                                                    {order.orderItems && order.orderItems[0]?.product?.name}
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    {order.orderItems?.length > 1 ? `+${order.orderItems.length - 1} more items` : '1 item'}
                                                </p>
                                            </div>
                                            <p className="font-medium text-slate-800">${order.total}</p>
                                        </div>
                                        
                                        <div className="flex justify-between items-center pt-3">
                                            <div className="text-xs text-slate-500">
                                                Payment: <span className="font-medium">{order.paymentMethod}</span>
                                            </div>
                                            <Link 
                                                href={`/orders/${order.id}`} 
                                                className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 font-medium"
                                            >
                                                Details
                                                <ChevronRightIcon size={16} className="ml-1" />
                                            </Link>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )
            ) : (
                <div className="min-h-[80vh] mx-6 flex flex-col items-center justify-center text-slate-400">
                    <div className="bg-slate-100 p-5 rounded-full mb-6">
                        <ShoppingBagIcon size={48} className="text-slate-300" />
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-semibold mb-3 text-slate-700">You have no orders yet</h1>
                    <p className="text-slate-500 mb-8 text-center max-w-md">Your order history will appear here once you make your first purchase.</p>
                    <Link 
                        href="/shop" 
                        className="flex items-center gap-2 bg-slate-800 text-white px-6 py-3 rounded-lg hover:bg-slate-700 transition-colors"
                    >
                        Start Shopping
                    </Link>
                </div>
            )}
        </div>
    )
}
