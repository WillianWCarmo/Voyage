import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import { api, errorMessage } from "./api";
import { AuthContext } from "./authContext";
import { isPassActive, OwnedPass, PASS_CATALOG, PassDef } from "./passes";
import { PaymentMethod } from "./payments";

export type CardType = "comum" | "estudante" | "vale";
export const CARD_TYPE_LABEL: Record<CardType, string> = {
  comum: "Comum",
  estudante: "Estudante",
  vale: "Vale-transporte",
};

export type Card = {
  number: string;
  holder: string;
  type: CardType;
  linkedAt: number;
  status: "ativo" | "bloqueado";
};

export type TxType = "recarga" | "passe" | "viagem";
export type Tx = {
  id: string;
  type: TxType;
  title: string;
  subtitle: string;
  amount: number; // positivo = crédito, negativo = débito, 0 = uso de passe
  ts: number;
};

export type NoticeKind = "saldo" | "recarga" | "passe" | "transporte";
export type Notice = {
  id: string;
  kind: NoticeKind;
  title: string;
  message: string;
  ts: number;
  read: boolean;
};

export type FavRoute = { id: string; originId: string; destId: string };

// Estado da conta que a API devolve para o usuário autenticado.
type VoyageData = {
  balance: number;
  card: Card | null;
  passes: OwnedPass[];
  txs: Tx[];
  notices: Notice[];
  favLines: string[];
  favRoutes: FavRoute[];
};

export type Result = { ok: boolean; error?: string; message?: string };
type ActionResponse = { message: string; state: VoyageData };

export const LOW_BALANCE = 10;
export const MIN_RECHARGE = 5;
export const MAX_RECHARGE = 500;

const EMPTY: VoyageData = {
  balance: 0,
  card: null,
  passes: [],
  txs: [],
  notices: [],
  favLines: [],
  favRoutes: [],
};

type VoyageCtx = VoyageData & {
  ready: boolean;
  status: "loading" | "ready" | "error";
  error: string | null;
  refresh: () => Promise<void>;
  catalog: PassDef[];
  unread: number;
  activePasses: OwnedPass[];
  expiredPasses: OwnedPass[];
  linkCard: (number: string, holder: string, type: CardType) => Promise<Result>;
  generateCard: (holder: string, type: CardType) => Promise<Result>;
  unlinkCard: () => Promise<Result>;
  recharge: (amount: number, method: PaymentMethod) => Promise<Result>;
  buyPass: (passId: string) => Promise<Result>;
  boardLine: (lineId: string) => Promise<Result>;
  toggleFavLine: (lineId: string) => void;
  toggleFavRoute: (originId: string, destId: string) => Promise<boolean>;
  isFavRoute: (originId: string, destId: string) => boolean;
  removeFavRoute: (id: string) => void;
  markAllRead: () => void;
};

const VoyageContext = createContext<VoyageCtx | null>(null);

export function useVoyage(): VoyageCtx {
  const ctx = useContext(VoyageContext);
  if (!ctx) throw new Error("useVoyage deve ser usado dentro do VoyageProvider");
  return ctx;
}

// Estado da conta (saldo, cartão, passes, histórico, avisos, favoritos) sincronizado com a API local.
// As operações que alteram saldo, passes e embarques rodam em funções transacionais no banco.
export function VoyageProvider({ children }: PropsWithChildren) {
  const { user } = useContext(AuthContext);
  const userId = user?.id ?? null;

  const [data, setData] = useState<VoyageData>(EMPTY);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<PassDef[]>(PASS_CATALOG);
  const [tick, setTick] = useState(0);
  const ref = useRef<VoyageData>(EMPTY);
  const userIdRef = useRef<string | null>(userId);
  const refreshSequence = useRef(0);
  userIdRef.current = userId;

  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const apply = useCallback((state: VoyageData) => {
    ref.current = state;
    setData(state);
  }, []);

  const refresh = useCallback(async () => {
    const requestedUserId = userId;
    if (!requestedUserId) return;

    const sequence = ++refreshSequence.current;
    try {
      const state = await api.getVoyageState<VoyageData>();
      // Uma resposta atrasada nunca pode restaurar dados de outra sessão.
      if (
        sequence !== refreshSequence.current ||
        userIdRef.current !== requestedUserId
      ) return;

      apply(state);
      setError(null);
      setStatus("ready");
      setTick((t) => t + 1);
    } catch (e) {
      if (
        sequence !== refreshSequence.current ||
        userIdRef.current !== requestedUserId
      ) return;

      // Se já estava carregado, ignora falhas passageiras de rede.
      if (statusRef.current !== "ready") {
        setError(errorMessage(e));
        setStatus("error");
      }
    }
  }, [apply, userId]);

  // Carrega (ou limpa) os dados quando o usuário entra/sai.
  useEffect(() => {
    // Invalida todas as requisições iniciadas na sessão anterior.
    refreshSequence.current += 1;

    if (userId === null) {
      apply(EMPTY);
      setStatus("loading");
      setError(null);
      return;
    }

    apply(EMPTY);
    setStatus("loading");
    setError(null);
    void refresh();

    api
      .getPassCatalog<PassDef[]>()
      .then((passes) => {
        if (userIdRef.current === userId && passes.length) setCatalog(passes);
      })
      .catch((catalogError) => {
        console.warn("[Voyage] Não foi possível carregar o catálogo:", catalogError);
      });
  }, [userId, apply, refresh]);

  // Mantém atualizado: a cada 60 s e quando o app volta para a tela
  useEffect(() => {
    if (status !== "ready") return;
    const id = setInterval(refresh, 60000);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") refresh();
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [status, refresh]);

  // Executa uma operação na API local e aplica o estado atualizado.
  const act = useCallback(
    async (call: () => Promise<ActionResponse>): Promise<Result> => {
      const actionUserId = userIdRef.current;
      if (!actionUserId) {
        return { ok: false, error: "Entre na sua conta para continuar." };
      }
      const actionSequence = ++refreshSequence.current;
      try {
        const res = await call();
        if (userIdRef.current !== actionUserId) {
          return { ok: false, error: "A sessão mudou. Entre novamente para continuar." };
        }
        if (actionSequence !== refreshSequence.current) {
          // Outra leitura começou durante a ação; busca a foto final do banco
          // em vez de aplicar uma resposta que pode ter ficado desatualizada.
          void refresh();
          return { ok: true, message: res.message };
        }
        apply(res.state);
        return { ok: true, message: res.message };
      } catch (e) {
        return { ok: false, error: errorMessage(e) };
      }
    },
    [apply, refresh],
  );

  const linkCard = useCallback<VoyageCtx["linkCard"]>(
    (number, holder, type) => act(() => api.setCard<ActionResponse>(number, holder, type)),
    [act],
  );
  const generateCard = useCallback<VoyageCtx["generateCard"]>(
    (holder, type) => act(() => api.createVirtualCard<ActionResponse>(holder, type)),
    [act],
  );
  const unlinkCard = useCallback<VoyageCtx["unlinkCard"]>(() => act(() => api.removeCard<ActionResponse>()), [act]);
  const recharge = useCallback<VoyageCtx["recharge"]>(
    (amount, method) => act(() => api.rechargeWallet<ActionResponse>(amount, method)),
    [act],
  );
  const buyPass = useCallback<VoyageCtx["buyPass"]>(
    (passId) => act(() => api.purchasePass<ActionResponse>(passId)),
    [act],
  );
  const boardLine = useCallback<VoyageCtx["boardLine"]>(
    (lineId) => act(() => api.boardLine<ActionResponse>(lineId)),
    [act],
  );

  // ---------- Favoritos: atualiza a tela na hora e confirma na API local ----------
  const toggleFavLine = useCallback(
    (lineId: string) => {
      const cur = ref.current;
      const has = cur.favLines.includes(lineId);
      apply({ ...cur, favLines: has ? cur.favLines.filter((id) => id !== lineId) : [...cur.favLines, lineId] });
      const actionUserId = userIdRef.current;
      api
        .toggleFavoriteLine<ActionResponse>(lineId)
        .then((res) => {
          if (userIdRef.current === actionUserId) apply(res.state);
        })
        .catch(() => {
          if (userIdRef.current === actionUserId) void refresh();
        });
    },
    [apply, refresh],
  );

  const isFavRoute = useCallback(
    (o: string, d: string) => data.favRoutes.some((r) => r.originId === o && r.destId === d),
    [data.favRoutes],
  );

  const toggleFavRoute = useCallback(
    async (o: string, d: string) => {
      const cur = ref.current;
      const existing = cur.favRoutes.find((r) => r.originId === o && r.destId === d);
      const actionUserId = userIdRef.current;
      if (!actionUserId) return false;
      try {
        if (existing) {
          apply({ ...cur, favRoutes: cur.favRoutes.filter((r) => r.id !== existing.id) });
          const res = await api.removeFavoriteRoute<ActionResponse>(existing.id);
          if (userIdRef.current !== actionUserId) return false;
          apply(res.state);
          return false;
        }
        const res = await api.addFavoriteRoute<ActionResponse>(o, d);
        if (userIdRef.current !== actionUserId) return false;
        apply(res.state);
        return true;
      } catch {
        if (userIdRef.current === actionUserId) void refresh();
        return !!existing;
      }
    },
    [apply, refresh],
  );

  const removeFavRoute = useCallback(
    (id: string) => {
      const cur = ref.current;
      apply({ ...cur, favRoutes: cur.favRoutes.filter((r) => r.id !== id) });
      const actionUserId = userIdRef.current;
      api
        .removeFavoriteRoute<ActionResponse>(id)
        .then((res) => {
          if (userIdRef.current === actionUserId) apply(res.state);
        })
        .catch(() => {
          if (userIdRef.current === actionUserId) void refresh();
        });
    },
    [apply, refresh],
  );

  const markAllRead = useCallback(() => {
    const cur = ref.current;
    if (!cur.notices.some((n) => !n.read)) return;
    apply({ ...cur, notices: cur.notices.map((n) => ({ ...n, read: true })) });
    const actionUserId = userIdRef.current;
    api.markAllNoticesRead<ActionResponse>()
      .then((res) => {
        if (userIdRef.current === actionUserId) apply(res.state);
      })
      .catch(() => {
        if (userIdRef.current === actionUserId) void refresh();
      });
  }, [apply, refresh]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const activePasses = useMemo(() => data.passes.filter((p) => isPassActive(p)), [data.passes, tick]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const expiredPasses = useMemo(() => data.passes.filter((p) => !isPassActive(p)), [data.passes, tick]);
  const unread = data.notices.filter((n) => !n.read).length;

  const value: VoyageCtx = {
    ...data,
    ready: status === "ready",
    status,
    error,
    refresh,
    catalog,
    unread,
    activePasses,
    expiredPasses,
    linkCard,
    generateCard,
    unlinkCard,
    recharge,
    buyPass,
    boardLine,
    toggleFavLine,
    toggleFavRoute,
    isFavRoute,
    removeFavRoute,
    markAllRead,
  };

  return <VoyageContext.Provider value={value}>{children}</VoyageContext.Provider>;
}
