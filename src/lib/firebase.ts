// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getStorage } from "firebase/storage";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  "projectId": "geomate-links",
  "appId": "1:822497657508:web:479f1db6c1717e92ed5c31",
  "storageBucket": "geomate-links.appspot.com",
  "apiKey": "AIzaSyDNvraraMy8wmzYCGgnJN35fxgQmeHlRAQ",
  "authDomain": "geomate-links.firebaseapp.com",
  "measurementId": "",
  "messagingSenderId": "822497657508"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const storage = getStorage(app);