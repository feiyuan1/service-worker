# 介绍
这是一个使用 service worker、cache storage、indexedDB、generator 的 demo

# 支持的功能
- 请求缓存：利用 service worker + cache Storage
- 缓存版本控制：利用 indexedDB + generator
- 请求失败回退
- 设置缓存白名单
- 设置缓存有效期（setTimeout）
- 强制更新 sw 版本

# 缓存策略
- 仅对白名单中的请求进行缓存
- 更新缓存时机：
  - sw 版本更新
  - 缓存过期

# 使用说明

## 开启强制更新 sw 版本
文件路径：/constants/key.js shouldUpdate 常量

## 设置缓存白名单

文件路径：/sw/sw.js includes 常量

# 启动
1. npm run start 启动
2. 访问 http://localhost:port

> 注意：sw 仅在 https 协议与 localhost 下生效