import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// @ts-ignore
import config from "./firebase-applet-config.json";

export const isFirebaseConfigured = !!(config && config.apiKey && config.apiKey.trim().length > 0);

export const app = isFirebaseConfigured ? (getApps().length === 0 ? initializeApp(config) : getApp()) : null;
export const db = isFirebaseConfigured ? getFirestore(app!, config.firestoreDatabaseId || undefined) : null;
export const auth = isFirebaseConfigured ? getAuth(app!) : null;

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified || null,
      isAnonymous: auth?.currentUser?.isAnonymous || null,
      tenantId: auth?.currentUser?.tenantId || null,
    },
    operationType,
    path,
  };
  console.error("Firestore Permission/Access Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
