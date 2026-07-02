import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCXpRHSWYk_gaRgyyb9CiygkkT5GLWBhSY",
  authDomain: "vigo-monety.firebaseapp.com",
  projectId: "vigo-monety",
  storageBucket: "vigo-monety.firebasestorage.app",
  messagingSenderId: "291435063734",
  appId: "1:291435063734:web:93859c3864775d729b7917",
  measurementId: "G-929MR3V458"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
