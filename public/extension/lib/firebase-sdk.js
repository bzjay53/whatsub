// Firebase SDK 통합
// Firebase 초기화 및 인증 기능

import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged,
  signOut as firebaseSignOut 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  serverTimestamp 
} from 'firebase/firestore';

// 별도의 설정 파일에서 Firebase 구성 가져오기
// 실제 배포 시에는 안전한 방법으로 구성이 로드되어야 함
import firebaseConfig from '../firebase-config.js';

// Firebase 앱 초기화
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// Google 로그인 함수
async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    
    // 사용자 정보를 Firestore에 저장
    await saveUserToFirestore(user);
    
    return user;
  } catch (error) {
    console.error("로그인 에러:", error);
    throw error;
  }
}

// 로그아웃 함수
async function signOut() {
  try {
    await firebaseSignOut(auth);
    console.log("로그아웃 성공");
    return true;
  } catch (error) {
    console.error("로그아웃 에러:", error);
    throw error;
  }
}

// 현재 사용자 정보 가져오기
function getCurrentUser() {
  return auth.currentUser;
}

// 인증 상태 변경 감지
function onAuthStateChange(callback) {
  return onAuthStateChanged(auth, callback);
}

// 사용자 정보를 Firestore에 저장
async function saveUserToFirestore(user) {
  if (!user) return;
  
  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);
  
  if (userSnap.exists()) {
    // 기존 사용자 정보 업데이트
    await updateDoc(userRef, {
      lastLogin: new Date(),
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL
    });
  } else {
    // 새 사용자 생성
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      createdAt: new Date(),
      lastLogin: new Date(),
      usageLimit: 600, // 기본 사용량 제한 (초)
      usageSeconds: 0, // 현재 사용량
      isPremium: false // 프리미엄 사용자 여부
    });
  }
}

export { 
  app, 
  auth, 
  db, 
  signInWithGoogle, 
  signOut, 
  getCurrentUser, 
  onAuthStateChange, 
  saveUserToFirestore 
}; 