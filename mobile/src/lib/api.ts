import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
const defaultUrl = Platform.OS === "android"
  ? "http://10.0.2.2:3333/api"
  : "http://localhost:3333/api";

export const API_BASE_URL = (configuredUrl || defaultUrl).replace(/\/+$/, "");
export const API_URL_DISPLAY = API_BASE_URL;
export type ServerStatus = "ok" | "wrong" | "offline";
const TOKEN_KEY = "voyage_access_token";

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
    this.name = "ApiError";
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError || error instanceof Error) return error.message;
  return "Algo deu errado. Tente novamente.";
}

async function readToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    if (typeof window === "undefined") return null;
    try { return window.localStorage.getItem(TOKEN_KEY); } catch { return null; }
  }
  return AsyncStorage.getItem(TOKEN_KEY);
}

async function writeToken(token: string): Promise<void> {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") {
      try { window.localStorage.setItem(TOKEN_KEY, token); } catch { throw new ApiError("Não foi possível salvar a sessão neste navegador.", 0, "STORAGE_ERROR"); }
    }
    return;
  }
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

async function removeToken(): Promise<void> {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") {
      try { window.localStorage.removeItem(TOKEN_KEY); } catch { /* armazenamento indisponível */ }
    }
    return;
  }
  await AsyncStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}, authenticated = true): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (authenticated) {
    const token = await readToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  } catch {
    throw new ApiError(`Não foi possível conectar à API em ${API_BASE_URL}. Confira se o backend está ligado e se o celular está na mesma rede Wi-Fi.`, 0, "NETWORK_ERROR");
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && authenticated) await removeToken();
    throw new ApiError(payload.message || "Não foi possível concluir a solicitação.", response.status, payload.error);
  }
  return payload as T;
}

export async function checkHealth(): Promise<ServerStatus> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`${API_BASE_URL}/health`, { signal: controller.signal });
    if (response.ok) return "ok";
    return response.status >= 400 && response.status < 500 ? "wrong" : "offline";
  } catch {
    return "offline";
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  // Sessão e autenticação
  hasToken: async () => Boolean(await readToken()),
  clearToken: removeToken,
  login: async <T>(email: string, password: string): Promise<T> => {
    const result = await request<T & { token: string }>("/auth/login", {
      method: "POST", body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    }, false);
    await writeToken(result.token);
    return result;
  },
  register: async <T>(data: { name: string; usuario: string; email: string; senha: string }): Promise<T> => {
    const result = await request<T & { token: string }>("/auth/register", {
      method: "POST", body: JSON.stringify({ ...data, name: data.name.trim(), usuario: data.usuario.trim().toLowerCase(), email: data.email.trim().toLowerCase() }),
    }, false);
    await writeToken(result.token);
    return result;
  },
  // Perfil
  getProfile: <T>(): Promise<T> => request<T>("/voyage/profile"),
  updateProfile: <T>(patch: { name?: string; email?: string }): Promise<T> =>
    request<{ user: T }>("/auth/me", { method: "PATCH", body: JSON.stringify(patch) }).then((result) => result.user),

  // Estado e catálogo
  getVoyageState: <T>() => request<T>("/voyage/state"),
  getPassCatalog: <T>() => request<T>("/voyage/passes"),

  // Cartões
  setCard: <T>(number: string, holder: string, type: string) =>
    request<T>("/voyage/card", { method: "PUT", body: JSON.stringify({ number, holder, type }) }),
  createVirtualCard: <T>(holder: string, type: string) =>
    request<T>("/voyage/card/virtual", { method: "POST", body: JSON.stringify({ holder, type }) }),
  removeCard: <T>() => request<T>("/voyage/card", { method: "DELETE" }),

  // Carteira e passagens
  rechargeWallet: <T>(amount: number, method: string) =>
    request<T>("/voyage/wallet/recharge", { method: "POST", body: JSON.stringify({ amount, method }) }),
  purchasePass: <T>(passId: string) =>
    request<T>("/voyage/passes/purchase", { method: "POST", body: JSON.stringify({ passId }) }),
  boardLine: <T>(lineId: string) =>
    request<T>("/voyage/transit/board", { method: "POST", body: JSON.stringify({ lineId }) }),

  // Favoritos e notificações
  toggleFavoriteLine: <T>(lineId: string) =>
    request<T>("/voyage/favorites/lines/toggle", { method: "POST", body: JSON.stringify({ lineId }) }),
  addFavoriteRoute: <T>(originId: string, destId: string) =>
    request<T>("/voyage/favorites/routes", { method: "POST", body: JSON.stringify({ originId, destId }) }),
  removeFavoriteRoute: <T>(id: string) =>
    request<T>(`/voyage/favorites/routes/${encodeURIComponent(id)}`, { method: "DELETE" }),
  markAllNoticesRead: <T>() => request<T>("/voyage/notices/read-all", { method: "POST" }),

  // Transporte
  getTransitData: <T>() => request<T>("/public/transit"),
  getBuses: <T>() => request<T>("/public/buses"),
};
