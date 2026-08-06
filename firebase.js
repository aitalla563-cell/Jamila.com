// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import {
    getFirestore,
    collection,
    addDoc,
    doc,
    onSnapshot,
    serverTimestamp,
    setDoc,
    updateDoc,
    getDocs,
    getDoc,
    query,
    orderBy,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import {
    getAuth,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// إعدادات مشروع Firebase
const firebaseConfig = {
    apiKey: "AIzaSyDe5IV6y1zkcLeZ62EE5bN9TvoLm8HNPc0",
    authDomain: "jamilati-4100e.firebaseapp.com",
    projectId: "jamilati-4100e",
    storageBucket: "jamilati-4100e.firebasestorage.app",
    messagingSenderId: "943338488923",
    appId: "1:943338488923:web:084c2f1d419341f7c82b7e",
    measurementId: "G-50EG1F2VLQ"
};

// تهيئة التطبيق والخدمات
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const auth = getAuth(app);

export {
    db,
    auth,
    collection,
    addDoc,
    doc,
    onSnapshot,
    serverTimestamp,
    setDoc,
    updateDoc,
    getDocs,
    getDoc,
    query,
    orderBy,
    deleteDoc,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
};
