'use client'
import { storesDummyData } from "@/assets/assets"
import StoreInfo from "@/components/admin/StoreInfo"
import Loading from "@/components/Loading"
import { useAuth, useUser } from "@clerk/nextjs"
import axios from "axios"
import { CheckCircleIcon, XCircleIcon, StoreIcon, AlertCircleIcon } from "lucide-react"
import { useEffect, useState } from "react"
import toast from "react-hot-toast"

export default function AdminApprove() {
    const {user} = useUser()
    const {getToken} = useAuth()
    const [stores, setStores] = useState([])
    const [loading, setLoading] = useState(true)

    const fetchStores = async () => {
        try {
            const token = await getToken()
            const { data } = await axios.get('/api/admin/approve-store', {
                 headers: { Authorization: `Bearer ${token}` }
            })
            setStores(data.stores)
        } catch (error) {
            toast.error(error?.response?.data?.error || error.message)
        }
        setLoading(false)
    }

    const handleApprove = async ({ storeId, status }) => {
        try {
            const token = await getToken()
            const { data } = await axios.post('/api/admin/approve-store', {storeId, status}, {
                 headers: { Authorization: `Bearer ${token}` }
            })
            toast.success(data.message)
            await fetchStores()
        } catch (error) {
            toast.error(error?.response?.data?.error || error.message)
        }
    }

    useEffect(() => {
        if(user){
            fetchStores()
        }
    }, [user])

    return !loading ? (
        <div className="text-slate-500 mb-28 pt-4 md:p-6">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl md:text-3xl flex items-center gap-2">
                    <span className="bg-amber-50 text-amber-600 p-2 rounded-md inline-flex">
                        <StoreIcon size={20} />
                    </span>
                    Approve <span className="text-slate-800 font-medium">Stores</span>
                </h1>
                <div className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-xs font-medium">
                    {stores.length} Pending
                </div>
            </div>

            {stores.length ? (
                <div className="flex flex-col gap-5 mt-6">
                    {stores.map((store) => (
                        <div 
                            key={store.id} 
                            className="bg-white border rounded-lg shadow-sm p-5 md:p-6 flex max-md:flex-col gap-5 md:items-end max-w-4xl hover:shadow-md transition-shadow duration-200" 
                        >
                            {/* Store Info */}
                            <StoreInfo store={store} />

                            {/* Actions */}
                            <div className="flex gap-3 pt-2 flex-wrap">
                                <button 
                                    onClick={() => toast.promise(handleApprove({ storeId: store.id, status: 'approved' }), { loading: "Approving store..." })} 
                                    className="px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium flex items-center gap-2 transition-colors duration-200" 
                                >
                                    <CheckCircleIcon size={16} />
                                    Approve
                                </button>
                                <button 
                                    onClick={() => toast.promise(handleApprove({ storeId: store.id, status: 'rejected' }), { loading: 'Rejecting store...' })} 
                                    className="px-4 py-2.5 bg-slate-600 text-white rounded-lg hover:bg-slate-700 text-sm font-medium flex items-center gap-2 transition-colors duration-200" 
                                >
                                    <XCircleIcon size={16} />
                                    Reject
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center h-80 bg-slate-50 rounded-xl border border-slate-200">
                    <AlertCircleIcon size={48} className="text-slate-300 mb-4" />
                    <h1 className="text-2xl md:text-3xl text-slate-400 font-medium">No Applications Pending</h1>
                    <p className="text-slate-400 mt-2">All store applications have been processed</p>
                </div>
            )}
        </div>
    ) : <Loading />
}
