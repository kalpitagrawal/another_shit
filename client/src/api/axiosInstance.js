import axios from 'axios'

const axiosInstance = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1',
    withCredentials: true,
    headers: { 'Content-Type': 'application/json' },
})

let isRefreshing = false
let pendingQueue = []

const processQueue = (error) => {
    pendingQueue.forEach((p) => (error ? p.reject(error) : p.resolve()))
    pendingQueue = []
}

axiosInstance.interceptors.response.use(
    (res) => res,
    async (error) => {
        const original = error.config

        if (error.response?.status === 401 && !original._retry) {
            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    pendingQueue.push({ resolve, reject })
                })
                    .then(() => axiosInstance(original))
                    .catch((e) => Promise.reject(e))
            }

            original._retry = true
            isRefreshing = true

            try {
                await axiosInstance.post('/auth/refresh')
                processQueue(null)
                return axiosInstance(original)
            } catch (refreshError) {
                processQueue(refreshError)
                // Clear auth state on hard logout
                window.dispatchEvent(new Event('auth:logout'))
                return Promise.reject(refreshError)
            } finally {
                isRefreshing = false
            }
        }

        return Promise.reject(error)
    }
)

export default axiosInstance