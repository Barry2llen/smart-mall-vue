import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/home/Home.vue'),
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/login/Login.vue'),
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('../views/register/Register.vue'),
    },
    {
      path: '/cart',
      name: 'cart',
      component: () => import('../views/cart/Cart.vue'),
    },
  ],
})

export default router
