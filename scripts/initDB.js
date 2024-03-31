import { DB_NAME, storeMap } from "../constants/db.js"

// TODO 这里的数据库以及 storename 是不是动态传入比较好？
const request = indexedDB.open(DB_NAME, 1)

// 创建数据库时会进入 upgradeneeded 生命周期
request.onupgradeneeded = (event) => {
  const db = event.target.result
  // 创建 objectStore（只能在该生命周期中创建）
  db.createObjectStore(storeMap.esModule)
  console.log('created')
}