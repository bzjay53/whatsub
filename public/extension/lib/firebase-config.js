/**
 * Firebase 설정 및 초기화
 * Whatsub 확장 프로그램에서 사용하는 Firebase 서비스 연결
 */

// Firebase 설정
const firebaseConfig = {
  apiKey: "AIzaSyBH5WTiT7OyR9RPiWvmKjyLXolY3UGvnfo",
  authDomain: "whatsub-extension.firebaseapp.com",
  projectId: "whatsub-extension",
  storageBucket: "whatsub-extension.appspot.com",
  messagingSenderId: "1063753446688",
  appId: "1:1063753446688:web:8d2b3f5b3c3f9a3d8c4e4a",
  measurementId: "G-LJWLC0ER6E"
};

// Firebase 앱 초기화 함수
function initializeFirebaseApp() {
  try {
    console.log('[Firebase] 초기화 시작...');
    
    // Firebase SDK가 이미 로드되어 있는지 확인
    if (typeof firebase !== 'undefined') {
      // 앱이 이미 초기화되었는지 확인
      if (firebase.apps.length === 0) {
        // Firebase 앱 초기화
        firebase.initializeApp(firebaseConfig);
        console.log('[Firebase] 앱 초기화 성공');
      } else {
        console.log('[Firebase] 앱이 이미 초기화되었습니다');
      }
      return true;
    } else {
      console.warn('[Firebase] Firebase SDK가 로드되지 않았습니다');
      
      // 모의 Firebase 객체 생성 (Firebase SDK가 없는 경우 대체)
      if (typeof window !== 'undefined' && !window.firebase) {
        window.firebase = createMockFirebase();
        console.log('[Firebase] 모의 Firebase 객체가 생성되었습니다');
      }
      return true;
    }
  } catch (error) {
    console.error('[Firebase] 초기화 오류:', error);
    return false;
  }
}

// 모의 Firebase 객체 생성 (SDK가 없을 때 사용)
function createMockFirebase() {
  console.warn('[Firebase] 모의 Firebase 객체를 사용합니다');
  
  return {
    apps: [],
    initializeApp: (config) => {
      console.log('[Firebase] 모의 앱 초기화:', config.projectId);
      return {
        name: '[DEFAULT]',
        options: { ...config }
      };
    },
    auth: () => ({
      currentUser: null,
      onAuthStateChanged: (callback) => {
        setTimeout(() => callback(null), 0);
        return () => {};  // Unsubscribe 함수
      },
      signOut: () => Promise.resolve()
    }),
    firestore: () => {
      const firestoreInstance = {
        collection: (path) => ({
          doc: (id) => ({
            get: () => Promise.resolve({ exists: false, data: () => ({}) }),
            set: (data) => Promise.resolve(data),
            update: (data) => Promise.resolve(data),
            collection: (subPath) => ({
              add: (data) => Promise.resolve({ id: 'mock-id' }),
              get: () => Promise.resolve({ docs: [] })
            })
          }),
          add: (data) => Promise.resolve({ id: 'mock-id' }),
          where: () => ({
            get: () => Promise.resolve({ empty: true, docs: [] })
          })
        })
      };
      
      // FieldValue 객체 추가
      firestoreInstance.FieldValue = {
        serverTimestamp: () => new Date().toISOString(),
        delete: () => null,
        increment: (n) => n
      };
      
      return firestoreInstance;
    }
  };
}

// 앱 초기화
initializeFirebaseApp();

// 외부에서 사용하도록 모듈 내보내기
export default {
  getFirebaseApp: () => {
    if (typeof firebase !== 'undefined') {
      return firebase.apps[0] || null;
    }
    return null;
  },
  initialize: initializeFirebaseApp
}; 