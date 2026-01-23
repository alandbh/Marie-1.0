import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const readEnv = (key: string): string => {
    try {
        if (typeof import.meta !== "undefined" && import.meta.env) {
            const viteKey = `VITE_${key}`;
            if ((import.meta.env as any)[viteKey]) return (import.meta.env as any)[viteKey];
        }
    } catch (e) {}

    try {
        if (typeof process !== "undefined" && process.env && process.env[key]) {
            return process.env[key] as string;
        }
    } catch (e) {}

    return "";
};

const firebaseConfig = {
    apiKey: readEnv("FIREBASE_API_KEY"),
    authDomain: readEnv("FIREBASE_AUTH_DOMAIN"),
    projectId: readEnv("FIREBASE_PROJECT_ID"),
    appId: readEnv("FIREBASE_APP_ID"),
};

export const hasFirebaseConfig = Object.values(firebaseConfig).every(Boolean);

let app: FirebaseApp | null = null;

export const getFirebaseAuth = () => {
    if (!hasFirebaseConfig) return null;

    if (!app) {
        app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    }

    return getAuth(app);
};

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });
