# 完成github登录功能

## - 1. 在登录界面新增"github登录选项"
用户点击"github登录"后，跳转到路径/api/auth/oauth2/authorization/github，后端会引导用户重定向到github登录页面

## - 2. 转发code与state参数
用户完成授权后会跳转会根路径/，对应App.vue，此时url中会带有code与state参数，需要将code与state参数转发给后端处理。
GET /api/auth/login/oauth2/code/github?code=xxx&state=xxx

## - 3. 存储token
后端会返回token信息，access token将会存储在响应头的Authorization中，格式为Bearer xxx，需要将access token信息存储到localstorage中。

## - 4. 测试
在App.vue中显示当前用户的id，使用以下接口
GET /api/auth/test
该接口直接返回用户id的字符串

## - 5. 刷新token
在第三步中，refresh toekn会存储在http-only cookie中，配置全局axios，当接口返回401时自动尝试获取新的access token
GET /api/auth/refresh
该接口会返回新的access token，同样放在响应头的Authorization中，需要将新的access token存储到localstorage中，并重新发起第一次失败的请求
