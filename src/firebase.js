import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAibib4T3AV_2usgHlg-j7sg8y1-7YGZZE",
  authDomain: "test-6d374.firebaseapp.com",
  projectId: "test-6d374",
  storageBucket: "test-6d374.appspot.com",
  messagingSenderId: "858225152012",
  appId: "1:858225152012:web:438dab1348623d7d765e29"
};

// Inicjalizacja Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth }; 