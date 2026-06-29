import { useEffect } from 'react'
import useAuthStore from '../store/authSlice'

const useAuth = () => {
    const { user, channel, isAuthenticated, isLoading, checkAuth, login, register, logout } =
        useAuthStore()

    useEffect(() => {
        checkAuth()

        // Listen for forced logout from axios interceptor
        const handler = () => logout()
        window.addEventListener('auth:logout', handler)
        return () => window.removeEventListener('auth:logout', handler)
    }, [])

    return { user, channel, isAuthenticated, isLoading, login, register, logout, checkAuth }
}

export default useAuth