import { initializeApp } from "firebase/app";
import { getFirestore,
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc, } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyChvF_k7ma1G7AJjlXx2D4kS1D2UqWzr4A",
  authDomain: "rukun-a144a.firebaseapp.com",
  projectId: "rukun-a144a",
  storageBucket: "rukun-a144a.firebasestorage.app",
  messagingSenderId: "3456577861",
  appId: "1:3456577861:web:b3c0e63f424b2ca9558e2c",
  measurementId: "G-N31Y19604S"
};
export {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
};
// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);