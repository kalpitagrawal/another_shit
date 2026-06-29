import { create } from 'zustand'
import { getCurrentUserAPI, loginAPI, logoutAPI, registerAPI } from '../api/auth.api'

const useAuthStore = create((set) => ({
    user: null,
    channel: null,
    isAuthenticated: false,
    isLoading: true,

    // ── Actions ──────────────────────────────────────────────

    login: async (credentials) => {
        const { data } = await loginAPI(credentials)
        const { user, channel } = data.data
        set({ user, channel, isAuthenticated: true })
        return { user, channel }
    },

    register: async (payload) => {
        const { data } = await registerAPI(payload)
        const { user, channel } = data.data
        set({ user, channel, isAuthenticated: true })
        return { user, channel }
    },

    logout: async () => {
        try {
            await logoutAPI()
        } catch (_) {
            // always clear local state even if request fails
        }
        set({ user: null, channel: null, isAuthenticated: false })
    },

    checkAuth: async () => {
        set({ isLoading: true })
        try {
            const { data } = await getCurrentUserAPI()
            const { user, channel } = data.data
            set({ user, channel, isAuthenticated: true })
        } catch (_) {
            set({ user: null, channel: null, isAuthenticated: false })
        } finally {
            set({ isLoading: false })
        }
    },
}))

export default useAuthStore