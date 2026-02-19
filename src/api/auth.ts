/* eslint-disable @typescript-eslint/no-explicit-any */
import request from '@/utils/request'

export interface UserLogin {
  username?: string
  password?: string
}

export interface UserRegister {
  username: string
  password?: string
  email?: string
  code?: string
}

export interface RObject<T = unknown> {
  code?: string | number
  msg?: string
  data?: T
}

const AUTH_API = '/auth'

export function sendCode(email: string) {
  return request.post<any, RObject>(`${AUTH_API}/sendCode`, email, {
    params: { email }, // swagger says 'in: query'
  })
}

// Correction based on swagger check: 
// /sendCode: parameters email in query. requestBody string. 
// It's a bit ambiguous/redundant in swagger, but query is safer for "GET-like" POSTs or just following swagger param.
// BUT, usually post implies body. Let's send key data in body if possible, but here swagger says param email. 
// I'll stick to what usually works: query params for 'in: query'.

export function sendCodeWithBody(email: string) {
    return request.post<any, RObject>(`${AUTH_API}/sendCode`, email, {
        params: { email }
    })
}

export function authLogin(data: UserLogin) {
  return request.post<any, RObject>(`${AUTH_API}/login`, data)
}

export function authRegister(data: UserRegister) {
  return request.post<any, RObject>(`${AUTH_API}/register`, data)
}

export function authLoginByGithubCode(code: string, state: string) {
  return request.get(`${AUTH_API}/login/oauth2/code/github`, {
    params: { code, state },
  })
}

export function getCurrentUserId() {
  return request.get<string, string>(`${AUTH_API}/test`)
}

export function logout() {
  return request.post(`${AUTH_API}/logout`)
}
