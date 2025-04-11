import { firebaseSDK } from './lib/firebase-sdk.js';

// Whatsub Firebase 구성
const firebaseConfig = {
    // Firebase 콘솔의 프로젝트 설정에서 이 값들을 복사하여 붙여넣으세요
    apiKey: "AIzaSyDMMEinb1Y9Q8Xg9b63DInknUhEDLBe8rQ",
    authDomain: "whatsub-402502.firebaseapp.com",
    projectId: "whatsub-402502",
    storageBucket: "whatsub-402502.appspot.com",
    messagingSenderId: "1063753446688",
    appId: "1:1063753446688:web:5b1c63fed5cd0cb27cb3cb",
    measurementId: "G-2EQPQN0CCH"
};

// Chrome Extension용 Firebase 인증 초기화
export const initializeFirebase = async () => {
    try {
        const app = firebaseSDK.initializeApp(firebaseConfig);
        const auth = firebaseSDK.auth();

        // Chrome Identity API를 사용한 인증
        const getAuthToken = () => {
            return new Promise((resolve, reject) => {
                chrome.identity.getAuthToken({ interactive: true }, (token) => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve(token);
                    }
                });
            });
        };

        // Firebase 커스텀 인증
        const signInWithToken = async (token) => {
            const credential = auth.GoogleAuthProvider.credential(null, token);
            credential.apiKey = firebaseConfig.apiKey;
            return await auth.signInWithCredential(credential);
        };

        // 인증 상태 관찰자
        auth.onAuthStateChanged((user) => {
            if (user) {
                console.log('User is signed in:', user.email);
                chrome.storage.local.set({ user });
            } else {
                console.log('User is signed out');
                chrome.storage.local.remove(['user']);
            }
        });

        return { getAuthToken, signInWithToken };
    } catch (error) {
        console.error('Firebase initialization error:', error);
        throw error;
    }
}; 