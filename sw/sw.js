/** service worker 脚本 */ 
// TODO 使用模块
// import {DB_NAME, storeMap} from '../../constants.js'

// fetch error fallbacks
const fallbacks = {
  404: './fallback/404.js',
  500: './fallback/500.js',
  default: './fallback/default.js'
}
// 用于本地调试，正常来讲，线上不会出现这种 case
const syntaxFallbacks = {
  TypeError: './fallback/typeerror.js',
}
// 缓存白名单
const includes = [/\.\/.*/, /sw\/.*/]
// 数据库名称
const DB_NAME = 'webpack-db'
// objectStore 的 name 与 key 的映射
const storeMap = {
  esModule: 'esmodule'
}
// 管理版本的键参数
const VERSION_KEY = 'version'
// 当前缓存版本
let curVersion;
// 获取缓存版本
const getVersion = (value) => `version${value}`
// 从数据库获取是否强制更新 sw 版本
const UPDATE_KEY = 'update'

/**
 * 生成器+indexedDB
 */
function asyncGenerator(generator){
  const gen = generator()
  function step(args){
    const {value, done} = gen.next(args)
    if(done) {
      return
    }

    value.onsuccess = event => {
      step(event.target.result)
    }
  }
  step()
}

/**
 * 
 * @param {function} step1 拿到 objectStore 后的回调
 * @param {function} step2 拿到 objectStore 中数据后的回调
 * @returns 
 */
const getEsModuleGenerator = (step1, step2) => asyncGenerator(function* generator(){
  const db = yield indexedDB.open(DB_NAME, 1)
  const transaction = db.transaction([storeMap.esModule], 'readwrite')
  const objectStore = transaction.objectStore(storeMap.esModule)
  const result = yield step1(objectStore)
  step2(objectStore, result)
})

const getVersionKey = objectStore => objectStore.get(VERSION_KEY)

/**
 * 构造器，产出可以清除缓存的实例
 * @param {Request} request 请求体
 * @param {number} validDuration 缓存有效期，以 ms 为 单位 
 * @returns 
 */
const KeyObject = function (request, validDuration = 5000) {
  this.key = request.url
  // 这也太大了
  this.source = request
  this.validDuration = validDuration
  // 生成 timer
  this.generateTimer()
  return this
}

KeyObject.clearAll = () => {
  // read from indexedDB
  const clearAll = (objectStore, data) => {
    const {keyobjects} = data
    if(!keyobjects) {
      return
    }

    // clear all timers of keyObjects
    Object.values(keyobjects).forEach(timer => {
      clearTimeout(timer)
    })
    // delete all keyObjects
    objectStore.put({...data, keyobjects: {}}, VERSION_KEY)
  }
  getEsModuleGenerator(getVersionKey, clearAll)
}

KeyObject.prototype.generateTimer = function(){
  if(!this.timer) {
    this.timer = setTimeout(async() => {
      // 清除该 request 下的缓存
      const cache = await caches.open(getVersion(curVersion))
      cache.delete(this.source)
      this.timer = null
    }, this.validDuration)
  }

  // 将 this push to indexedDB
  const pushObject = (objectStore, data) => {
    const {keyobjects = {}} = data
    keyobjects[this.key] = this.timer
    objectStore.put({...data, keyobjects}, VERSION_KEY)
  }
  getEsModuleGenerator(getVersionKey, pushObject)

  return this.timer
}

// 处理缓存版本号
const manageCacheVersion = () => {
  // 此时，视为数据库已经创建好
  const updateVersion = (objectStore, data) => {
    const {curVersion: version, oldVersions = [], usingVersion: usedVersion, keyobjects} = data || {}
    curVersion = (version || 0) + 1
    oldVersions.push(version)
    objectStore.put({curVersion, oldVersions, usingVersion: usedVersion || curVersion, keyobjects}, VERSION_KEY)
  }
  getEsModuleGenerator(getVersionKey, updateVersion)
}

const deleteOldCaches = () => {
  // db 中 oldVersions 清掉
  const clearCache = (objectStore, data) => {
    // cachestorage 清理
    data.oldVersions.map(async version => {
      await caches.delete(getVersion(version))
    })
    data.oldVersions = []
    data.usingVersion = curVersion
    objectStore.put(data, VERSION_KEY)
  }
  getEsModuleGenerator(getVersionKey, clearCache)
  console.log('clear cache.')
}

const updateSW = () => {
  const getUpdateKey = objectStore => objectStore.get(UPDATE_KEY)
  const update = (_, shouldUpdate) => {
    if(shouldUpdate){
      self.skipWaiting()
    }
  }
  getEsModuleGenerator(getUpdateKey, update)
}

// 监听 sw 的 install（安装） 事件
self.addEventListener('install', () => {
  console.log('installing...')
  manageCacheVersion()
  // 强制更新 sw 版本
  updateSW()
})

// 监听 sw 的 activate（激活） 事件
self.addEventListener('activate', () => {
  console.log('activate: ', curVersion)
  // 清空缓存时机：1. sw 版本迭代 2. 缓存内容过期（见 KeyObject.generateTimer）
  deleteOldCaches()
  // 清除所有内容的 timer
  KeyObject.clearAll()
})

const fetchWithFallback = async request => {
  console.log('custom fetch')
  const cache = await caches.match(request)

  // 优先使用缓存
  if(cache) {
    console.log('use cache.')
    return cache
  }

  try{
    const response = await fetch(request)
    if(response.status !== 200){
      throw response.status
    }

    // 添加缓存(此时，curVersion 即为 usingVersion)
    const cache = await caches.open(getVersion(curVersion))
    cache.put(request, response.clone())
    // 为缓存添加定时清除器
    new KeyObject(request)
    console.log('put in cache.')

    return response
  }catch(e) {
    console.log('request error: ', e)
    if(fallbacks[e]){
      return fetch(fallbacks[e])
    }

    const syntaxError = Object.keys(syntaxFallbacks).find(type => {
      return e.toString().indexOf(type) !== -1
    })

    if(syntaxError){
      return fetch(syntaxFallbacks[syntaxError])
    }
    
    return fetch(fallbacks.default)
  }
}

self.addEventListener('fetch', e => {
  console.log('request: ', e.request)

  if(includes.some(reg => reg.test(e.request.url))){
    e.respondWith(fetchWithFallback(e.request))
  } else {
    e.respondWith(fetch(e.request))
  }
})