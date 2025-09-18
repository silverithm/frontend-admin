import { initializeApp } from 'firebase/app';
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Firebase 설정
// 실제 값은 환경 변수로 관리하는 것이 좋습니다
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'dummy-api-key',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'dummy.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'dummy-project',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'dummy.appspot.com',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '123456789',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:123456789:web:abc123'
};

// Firebase 초기화
let app: any;
let db: any;
let auth: any;

try {
  app = initializeApp(firebaseConfig);

  // Firestore 초기화 - 다중 탭 지원을 위한 설정
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });

  auth = getAuth(app);
} catch (error) {
  console.warn('Firebase initialization failed:', error);
  // Create mock instances for build time
  app = {};
  db = {};
  auth = {};
}

export { app, db, auth }; 