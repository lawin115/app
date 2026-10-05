import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const KEY = "luxedrive_token";

async function webGet(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(KEY);
}
async function webSet(v: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, v);
}
async function webClear() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}

export const tokenStore = {
  get: () => (Platform.OS === "web" ? webGet() : SecureStore.getItemAsync(KEY)),
  set: (v: string) => (Platform.OS === "web" ? webSet(v) : SecureStore.setItemAsync(KEY, v)),
  clear: () => (Platform.OS === "web" ? webClear() : SecureStore.deleteItemAsync(KEY)),
};
