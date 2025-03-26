// Firebase App SDK
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import { getAuth, signInWithCredential, GoogleAuthProvider } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';

const firebaseConfig = {
    apiKey: "AIzaSyBJL_kxYxCwQr7g3cFvyD6u8lZFn0maEGY",
    authDomain: "sup-sub.firebaseapp.com",
    projectId: "sup-sub",
    storageBucket: "sup-sub.appspot.com",
    messagingSenderId: "1060430808730",
    appId: "1:1060430808730:web:e13eb03fc7771f25088123"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export { app, auth, signInWithCredential, GoogleAuthProvider }; 