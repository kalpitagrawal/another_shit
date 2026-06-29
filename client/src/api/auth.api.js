import axiosInstance from './axiosInstance'

export const registerAPI = (data) =>
    axiosInstance.post('/auth/register', data)

export const loginAPI = (data) =>
    axiosInstance.post('/auth/login', data)

export const logoutAPI = () =>
    axiosInstance.post('/auth/logout')

export const getCurrentUserAPI = () =>
    axiosInstance.get('/auth/me')

export const getGoogleOAuthURL = () =>
    `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/auth/google`