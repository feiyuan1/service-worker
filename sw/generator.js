import {DB_NAME, storeMap} from '../../constants/db.js'

export default function asyncGenerator(generator){
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

export const getEsModuleGenerator = (step1, step2) => asyncGenerator(function* generator(){
  const db = yield indexedDB.open(DB_NAME, 1)
  const transaction = db.transaction([storeMap.esModule], 'readwrite')
  const objectStore = transaction.objectStore(storeMap.esModule)
  const result = yield step1(objectStore)
  step2(objectStore, result)
})