// C:\Users\Siddharathan\Desktop\gocart-ecommerce-full-stack\app\admin\page.jsx
'use client'
import { dummyAdminDashboardData } from "@/assets/assets"
import Loading from "@/components/Loading"
import OrdersAreaChart from "@/components/OrdersAreaChart"
import { useAuth } from "@clerk/nextjs"
import axios from "axios"
import { 
  IndianRupee , 
  ShoppingBasketIcon, 
  StoreIcon, 
  TagsIcon, 
  TrendingUpIcon, 
  UsersIcon, 
  BarChart3Icon, 
  ShoppingCartIcon
} from "lucide-react"
import { useEffect, useState } from "react"
import toast from "react-hot-toast"

export default function AdminDashboard() {
    const { getToken } = useAuth()
    const currency = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || '₹'
    const [loading, setLoading] = useState(true)
    const [dashboardData, setDashboardData] = useState({
        products: 0,
        revenue: 0,
        orders: 0,
        stores: 0,
        allOrders: [],
    })

    const dashboardCardsData = [
        { title: 'Total Products', value: dashboardData.products, icon: ShoppingBasketIcon, color: 'bg-blue-50 text-blue-500' },
        { title: 'Total Revenue', value: '₹' + dashboardData.revenue, icon: IndianRupee , color: 'bg-green-50 text-green-500' },
        { title: 'Total Orders', value: dashboardData.orders, icon: TagsIcon, color: 'bg-purple-50 text-purple-500' },
        { title: 'Total Stores', value: dashboardData.stores, icon: StoreIcon, color: 'bg-amber-50 text-amber-500' },
    ]

    const fetchDashboardData = async () => {
        try {
            const token = await getToken()
            const { data } = await axios.get('/api/admin/dashboard', {
                headers: { Authorization: `Bearer ${token}` }
            })
            setDashboardData(data.dashboardData)
        } catch (error) {
           toast.error(error?.response?.data?.error || error.message) 
        }
        setLoading(false)
    }

    useEffect(() => {
        fetchDashboardData()
    }, [])

    if (loading) return <Loading />

    return (
        <div className="text-slate-500 pt-4 md:p-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-2xl md:text-3xl">
                    Admin <span className="text-slate-800 font-semibold">Dashboard</span>
                </h1>
                <div className="hidden md:flex items-center gap-2 text-sm">
                    <ShoppingCartIcon size={16} className="text-slate-400" />
                    <span className="text-slate-600 font-medium">E-commerce Overview</span>
                </div>
            </div>

            {/* Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 my-6">
                {
                    dashboardCardsData.map((card, index) => (
                        <div 
                            key={index} 
                            className="flex items-center justify-between border border-slate-200 pt-4 md:p-5 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 bg-white"
                        >
                            <div className="flex flex-col gap-2">
                                <p className="text-xs md:text-sm text-slate-500">{card.title}</p>
                                <b className="text-xl md:text-2xl font-semibold text-slate-800">{card.value}</b>
                            </div>
                            <card.icon className={`w-12 h-12 p-3 ${card.color} rounded-lg`} />
                        </div>
                    ))
                }
            </div>

            {/* Recent Activity */}
            {/* <div className="mb-8 bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-slate-800 text-lg">Recent Activity</h2>
                    <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-full font-medium">Today</span>
                </div>
                <div className="space-y-3">
                    {[1, 2, 3].map((item) => (
                        <div key={item} className="flex items-center gap-3 py-2 border-b border-slate-100">
                            <div className="bg-slate-100 p-2 rounded-full">
                                {item % 3 === 0 ? (
                                    <UsersIcon size={16} className="text-blue-500" />
                                ) : item % 3 === 1 ? (
                                    <TrendingUpIcon size={16} className="text-green-500" />
                                ) : (
                                    <BarChart3Icon size={16} className="text-purple-500" />
                                )}
                            </div>
                            <div className="text-sm">
                                <p className="text-slate-800 font-medium">
                                    {item % 3 === 0 ? 'New customer registered' : 
                                     item % 3 === 1 ? 'New order placed #3652' : 
                                     'Product stock updated'}
                                </p>
                                <p className="text-xs text-slate-500">{item * 10} minutes ago</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div> */}

            {/* Area Chart */}
            <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
                <h2 className="font-semibold text-slate-800 text-lg mb-4">Sales Analytics</h2>
                <OrdersAreaChart allOrders={dashboardData.allOrders} />
            </div>
        </div>
    )
}
