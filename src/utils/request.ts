/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from 'axios'
import type {
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
  AxiosRequestHeaders,
} from 'axios'

const ACCESS_TOKEN_KEY = 'access_token'
const ID_FIELD_PATTERN =
  /"((?:id|Id|ID)|(?:[A-Za-z_][A-Za-z0-9_]*?(?:Id|ID|_id|_ID|Cid|CID|cid)))"\s*:\s*(-?\d+)/g

interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
  _skipAuthRefresh?: boolean
}

const getAccessToken = () => localStorage.getItem(ACCESS_TOKEN_KEY)

const stringifyNumericIdFields = (jsonText: string) => {
  return jsonText.replace(ID_FIELD_PATTERN, (_, key: string, value: string) => {
    return `"${key}":"${value}"`
  })
}

const parseJsonResponse = (data: unknown) => {
  if (typeof data !== 'string') {
    return data
  }

  const text = data.trim()
  if (!text) {
    return data
  }

  const isJsonLike =
    (text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']'))
  if (!isJsonLike) {
    return data
  }

  try {
    return JSON.parse(stringifyNumericIdFields(text))
  } catch {
    try {
      return JSON.parse(text)
    } catch {
      return data
    }
  }
}

const saveAccessTokenFromHeaders = (headers?: AxiosResponse['headers']) => {
  const authorization = headers?.authorization || headers?.Authorization
  if (!authorization || typeof authorization !== 'string') {
    return
  }

  const [type, token] = authorization.split(' ')
  if (type?.toLowerCase() === 'bearer' && token) {
    localStorage.setItem(ACCESS_TOKEN_KEY, token)
  }
}

// Create axios instance
const service: AxiosInstance = axios.create({
  baseURL: '/api', // Proxy will handle /api -> http://localhost:8080 (or appropriate backend)
  timeout: 10000,
  withCredentials: true,
  transformResponse: [
    (data: unknown) => {
      return parseJsonResponse(data)
    },
  ],
})

// Request interceptor
service.interceptors.request.use(
  (config: CustomAxiosRequestConfig) => {
    const token = getAccessToken()
    if (token) {
      config.headers = (config.headers || {}) as AxiosRequestHeaders
      config.headers.Authorization = `Bearer ${token}`
    }

    return config
  },
  (error: any) => {
    return Promise.reject(error)
  },
)

let refreshTokenPromise: Promise<void> | null = null

const refreshAccessToken = async () => {
  if (!refreshTokenPromise) {
    refreshTokenPromise = service
      .get('/auth/public/refresh', { _skipAuthRefresh: true } as CustomAxiosRequestConfig)
      .then(() => undefined)
      .finally(() => {
        refreshTokenPromise = null
      })
  }

  return refreshTokenPromise
}

// Response interceptor
service.interceptors.response.use(
  (response: AxiosResponse) => {
    saveAccessTokenFromHeaders(response.headers)
    const res = response.data
    if (typeof res === 'string') {
      const htmlLike = /^\s*<!doctype html>|^\s*<html[\s>]/i.test(res)
      if (htmlLike) {
        return Promise.reject(new Error('未登录或接口返回了非预期页面'))
      }
    }
    // You can handle custom error codes here if your backend returns { code: ..., data: ... }
    // For now, we return the data directly or the full response depending on convention
    // Based on swagger RObject, we might want to check res.code
    if (res.code && !['0', 0, '200', 200, 'SUCCESS', 'success'].includes(res.code)) {
      // Handle business error
      console.error('API Error:', res.msg)
      return Promise.reject(new Error(res.msg || 'Error'))
    }
    return res
  },
  (error: any) => {
    const originalConfig = error?.config as CustomAxiosRequestConfig | undefined
    const status = error?.response?.status

    if (
      status === 401 &&
      originalConfig &&
      !originalConfig._retry &&
      !originalConfig._skipAuthRefresh &&
      !`${originalConfig.url || ''}`.includes('/auth/refresh')
    ) {
      originalConfig._retry = true

      return refreshAccessToken()
        .then(() => {
          const latestToken = getAccessToken()
          if (latestToken) {
            originalConfig.headers = (originalConfig.headers || {}) as AxiosRequestHeaders
            originalConfig.headers.Authorization = `Bearer ${latestToken}`
          }

          return service(originalConfig)
        })
        .catch(() => {
          localStorage.removeItem(ACCESS_TOKEN_KEY)
          return Promise.reject(new Error('登录已过期，请重新登录'))
        })
    }

    const backendMsg =
      error?.response?.data?.msg || error?.response?.data?.message || error?.response?.data?.error
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
