'use client'
import { storesDummyData } from "@/assets/assets"
import StoreInfo from "@/components/admin/StoreInfo"
import Loading from "@/components/Loading"
import { useAuth, useUser } from "@clerk/nextjs"
import axios from "axios"
import { StoreIcon, BuildingIcon, AlertCircleIcon } from "lucide-react"
import { useEffect, useState } from "react"
import toast from "react-hot-toast"

export default function AdminStores() {
    const { user } = useUser()
    const { getToken } = useAuth()
    const [stores, setStores] = useState([])
    const [loading, setLoading] = useState(true)

    const fetchStores = async () => {
        try {
            const token = await getToken()
            const { data } = await axios.get('/api/admin/stores', {headers: { Authorization: `Bearer ${token}` }})
            setStores(data.stores)
        } catch (error) {
            toast.error(error?.response?.data?.error || error.message)
        }
        setLoading(false)
    }

    const toggleIsActive = async (storeId) => {
        try {
            const token = await getToken()
            const { data } = await axios.post('/api/admin/toggle-store', {storeId}, {headers: { Authorization: `Bearer ${token}` }})
            await fetchStores()
            toast.success(data.message)
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
                    <span className="bg-green-50 text-green-600 p-2 rounded-md inline-flex">
                        <BuildingIcon size={20} />
                    </span>
                    Live <span className="text-slate-800 font-medium">Stores</span>
                </h1>
                <div className="bg-green-50 text-green-600 px-3 py-1 rounded-full text-xs font-medium">
                    {stores.length} Active
                </div>
            </div>

            {stores.length ? (
                <div className="grid grid-cols-1 gap-5 mt-6">
                    {stores.map((store) => (
                        <div 
                            key={store.id} 
                            className="bg-white border border-slate-200 rounded-lg shadow-sm p-5 md:p-6 flex max-md:flex-col gap-5 md:items-end max-w-4xl hover:shadow-md transition-shadow duration-200" 
                        >
                            {/* Store Info */}
                            <StoreInfo store={store} />

                            {/* Actions */}
                            <div className="flex items-center gap-3 pt-2 flex-wrap">
                                <p className="font-medium text-slate-600">Status:</p>
                                <div className={`flex items-center gap-3 p-1.5 px-3 rounded-full ${store.isActive ? 'bg-green-50' : 'bg-slate-100'}`}>
                                    <label className="relative inline-flex items-center cursor-pointer text-gray-900">
                                        <input 
                                            type="checkbox" 
                                            className="sr-only peer" 
                                            onChange={() => toast.promise(toggleIsActive(store.id), { loading: "Updating status..." })} 
                                            checked={store.isActive} 
                                        />
                                        <div className="w-9 h-5 bg-slate-300 rounded-full peer peer-checked:bg-green-600 transition-colors duration-200"></div>
                                        <span className="dot absolute left-1 top-1 w-3 h-3 bg-white rounded-full transition-transform duration-200 ease-in-out peer-checked:translate-x-4"></span>
                                    </label>
                                    <span className="text-sm font-medium">{store.isActive ? 'Active' : 'Inactive'}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center h-80 bg-slate-50 rounded-xl border border-slate-200">
                    <StoreIcon size={48} className="text-slate-300 mb-4" />
                    <h1 className="text-2xl md:text-3xl text-slate-400 font-medium">No Stores Available</h1>
                    <p className="text-slate-400 mt-2">No active stores have been found</p>
                </div>
            )}
        </div>
    ) : <Loading />
}
