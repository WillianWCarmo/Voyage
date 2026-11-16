import { createContext, PropsWithChildren, useEffect, useState } from "react";
import { api, ApiError, errorMessage } from "./api";

export interface User {
  id: string;
  name: string;
  usuario: string;
  email: string;
  avatar?: string;
}

type Profile = {
  id: string;
  name: string;
  usuario: string;
  email: string;
  avatar_url: string | null;
};

export type AuthResult = {
  ok: boolean;
  error?: string;
  message?: string;
  requiresConfirmation?: boolean;
};

type AuthContextProps = {
  isLoggedIn: boolean;
  isReading: boolean;
  user: User | null;
  logIn: (email: string, senha: string) => Promise<AuthResult>;
  register: (data: { name: string; usuario: string; email: string; senha: string }) => Promise<AuthResult>;
  updateUser: (patch: { name?: string; email?: string }) => Promise<AuthResult>;
  logOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextProps>({
  isLoggedIn: false,
  isReading: true,
  user: null,
  logIn: async () => ({ ok: false }),
  register: async () => ({ ok: false }),
  updateUser: async () => ({ ok: false }),
  logOut: async () => {},
});

function toUser(profile: Profile): User {
  return {
    id: profile.id,
    name: profile.name,
    usuario: profile.usuario,
    email: profile.email,
    avatar: profile.avatar_url ?? undefined,
  };
}

function getAuthErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case "INVALID_CREDENTIALS": return "E-mail ou senha incorretos. Verifique seus dados e tente novamente.";
      case "USER_ALREADY_EXISTS": return error.message;
      case "WEAK_PASSWORD": return "A senha deve ter pelo menos 6 caracteres.";
      case "INVALID_EMAIL": return "Informe um endereço de e-mail válido.";
      case "INVALID_USERNAME": return error.message;
      default: return error.message;
    }
  }
  return errorMessage(error);
}

export default function AuthProvider({ children }: PropsWithChildren) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isReading, setIsReading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let active = true;
    const restore = async () => {
      try {
        if (!(await api.hasToken())) return;
        const profile = await api.getProfile<Profile>();
        if (active) {
          setUser(toUser(profile));
          setIsLoggedIn(true);
        }
      } catch (error) {
        console.warn("[Voyage] Não foi possível restaurar a sessão:", error);
        if (active) {
          setUser(null);
          setIsLoggedIn(false);
        }
      } finally {
        if (active) setIsReading(false);
      }
    };
    void restore();
    return () => { active = false; };
  }, []);

  const logIn: AuthContextProps["logIn"] = async (email, senha) => {
    try {
      const result = await api.login<{ token: string; user: Profile }>(email, senha);
      setUser(toUser(result.user));
      setIsLoggedIn(true);
      return { ok: true };
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) await api.clearToken();
      setUser(null);
      setIsLoggedIn(false);
      return { ok: false, error: getAuthErrorMessage(error) };
    }
  };

  const register: AuthContextProps["register"] = async (data) => {
    try {
      const result = await api.register<{ token: string; user: Profile }>(data);
      setUser(toUser(result.user));
      setIsLoggedIn(true);
      return { ok: true, message: "Conta criada com sucesso." };
    } catch (error) {
      return { ok: false, error: getAuthErrorMessage(error) };
    }
  };

  const updateUser: AuthContextProps["updateUser"] = async (patch) => {
    try {
      const profile = await api.updateProfile<Profile>({
        ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
        ...(patch.email !== undefined ? { email: patch.email.trim().toLowerCase() } : {}),
      });
      setUser(toUser(profile));
      return { ok: true, message: "Dados atualizados com sucesso." };
    } catch (error) {
      return { ok: false, error: getAuthErrorMessage(error) };
    }
  };

  const logOut = async () => {
    await api.clearToken();
    setUser(null);
    setIsLoggedIn(false);
  };

  return (
    <AuthContext.Provider value={{ isLoggedIn, isReading, user, logIn, register, updateUser, logOut }}>
      {children}
    </AuthContext.Provider>
  );
}
