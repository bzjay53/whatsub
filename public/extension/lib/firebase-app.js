// Firebase 앱 설정 모듈
// 중앙 집중식 Firebase 구성을 사용합니다

import firebaseConfig from '../firebase-config.js';
import { initializeApp } from 'firebase/app';

// Firebase 앱 초기화
const app = initializeApp(firebaseConfig);

export default app; 