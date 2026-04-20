'use client'
import { useEffect, useState } from "react"
import Loading from "../Loading"
import Link from "next/link"
import { ArrowRightIcon, ShieldAlertIcon } from "lucide-react"
import AdminNavbar from "./AdminNavbar"
import AdminSidebar from "./AdminSidebar"
import { useUser, useAuth } from "@clerk/nextjs"
import axios from "axios"

const AdminLayout = ({ children }) => {
    const {user} = useUser()
    const { getToken } = useAuth()
    const [isAdmin, setIsAdmin] = useState(false)
    const [loading, setLoading] = useState(true)
    const [sidebarOpen, setSidebarOpen] = useState(false)

    const fetchIsAdmin = async () => {
        try {
            const token = await getToken()
            const {data} = await axios.get('/api/admin/is-admin', {headers: { Authorization: `Bearer ${token}`}})
            setIsAdmin(data.isAdmin)
        } catch (error) {
            console.log(error)
        }finally{
            setLoading(false)
        }
    }

    // Close sidebar when clicking outside on mobile
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (window.innerWidth < 768 && sidebarOpen && !e.target.closest('.admin-sidebar')) {
                setSidebarOpen(false)
            }
        }
        
        document.addEventListener('click', handleClickOutside)
        return () => document.removeEventListener('click', handleClickOutside)
    }, [sidebarOpen])

    useEffect(() => {
        if(user){
            fetchIsAdmin()
        }
    }, [user])

    return loading ? (
        <Loading />
    ) : isAdmin ? (
        <div className="flex flex-col h-screen bg-slate-50">
            <AdminNavbar setSidebarOpen={setSidebarOpen} sidebarOpen={sidebarOpen} />
            <div className="flex flex-1 items-start h-full overflow-hidden">
                {/* Overlay for mobile when sidebar is open */}
                {sidebarOpen && (
                    <div 
                        className="md:hidden fixed inset-0 bg-slate-900/50 z-10 transition-opacity duration-300"
                        aria-hidden="true"
                    />
                )}
                
                {/* Sidebar - with transition for mobile */}
                <div 
                    className={`admin-sidebar fixed md:static h-full z-20 transition-transform duration-300 ease-in-out ${
                        sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
                    }`}
                >
                    <AdminSidebar setSidebarOpen={setSidebarOpen} />
                </div>
                
                {/* Main content */}
                <div className="flex-1 h-full p-4 md:p-6 lg:p-8 overflow-y-auto">
                    <div className="max-w-7xl mx-auto">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    ) : (
        <div className="min-h-screen flex flex-col items-center justify-center text-center px-6 bg-gradient-to-b from-slate-50 to-slate-100">
            <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg flex flex-col items-center">
                <div className="p-3 bg-red-50 rounded-full mb-4">
                    <ShieldAlertIcon size={40} className="text-red-500" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-semibold text-slate-800 mb-3">Access Denied</h1>
                <p className="text-slate-500 mb-6">You are not authorized to access this admin area</p>
                <Link href="/" className="bg-slate-800 hover:bg-slate-900 text-white flex items-center gap-2 py-3 px-8 rounded-lg font-medium transition-colors duration-200">
                    Go to Home <ArrowRightIcon size={18} />
                </Link>
            </div>
        </div>
    )
}

export default AdminLayout
