/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from 'axios'
import type { AxiosInstance, AxiosResponse } from 'axios'

// Create axios instance
const service: AxiosInstance = axios.create({
  baseURL: '/api', // Proxy will handle /api -> http://localhost:8080 (or appropriate backend)
  timeout: 10000,
})

// Request interceptor
service.interceptors.request.use(
  (config) => {
    // You can add headers here, e.g., token
    // const token = localStorage.getItem('token')
    // if (token) {
    //   config.headers['Authorization'] = `Bearer ${token}`
    // }
    return config
  },
  (error: any) => {
    return Promise.reject(error)
  },
)

// Response interceptor
service.interceptors.response.use(
  (response: AxiosResponse) => {
    const res = response.data
    // You can handle custom error codes here if your backend returns { code: ..., data: ... }
    // For now, we return the data directly or the full response depending on convention
    // Based on swagger RObject, we might want to check res.code
    if (res.code && res.code !== '0' && res.code !== 0) {
      // Handle business error
       console.error('API Error:', res.msg)
       return Promise.reject(new Error(res.msg || 'Error'))
    }
    return res
  },
  (error: any) => {
    const backendMsg =
      error?.response?.data?.msg ||
      error?.response?.data?.message ||
      error?.response?.data?.error
    const status = error?.response?.status
    const statusText = error?.response?.statusText
    const finalMsg =
      backendMsg ||
      error?.message ||
      (status ? `请求失败(${status}${statusText ? ` ${statusText}` : ''})` : '请求失败')

    console.error('Request Error:', finalMsg, error)
    return Promise.reject(new Error(finalMsg))
  },
)

export default service
