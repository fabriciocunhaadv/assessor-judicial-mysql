import { initializeApp } from 'firebase/app';
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// LOGIN: agora é próprio (MySQL), em ./sessao. Aqui continua só o Firestore dos módulos que ainda não foram migrados.
export { auth } from './sessao';

const app = initializeApp(firebaseConfig);
// Cache offline do próprio Firestore (IndexedDB do navegador, sem o limite de ~5 MB do localStorage).
const criarDb = () => {
  try {
    return initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }, firebaseConfig.firestoreDatabaseId);
  } catch {
    return getFirestore(app, firebaseConfig.firestoreDatabaseId);      // já inicializado (recarga a quente) ou navegador sem IndexedDB
  }
};
export const db = criarDb();
