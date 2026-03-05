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
      path: '/search',
      name: 'search',
      component: () => import('../views/search/SearchResult.vue'),
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
    {
      path: '/order/confirm',
      name: 'orderConfirm',
      component: () => import('../views/order/ConfirmOrder.vue'),
    },
    {
      path: '/order/list',
      name: 'orderList',
      component: () => import('../views/order/OrderList.vue'),
    },
    {
      path: '/order/detail/:orderSn',
      name: 'orderDetail',
      component: () => import('../views/order/OrderDetail.vue'),
    },
  ],
})

export default router
