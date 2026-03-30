import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { apiJson } from "@/lib/api";

export type MeHeader = {
  user_id: string;
  display_name: string;
  avatar_url?: string;
  tier?: string;
};

type Ctx = {
  me: MeHeader | null;
  refresh: () => void;
};

const UserHeaderContext = createContext<Ctx | null>(null);

export function UserHeaderProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<MeHeader | null>(null);

  const refresh = useCallback(() => {
    apiJson<{ user: MeHeader }>("/v1/me")
      .then((m) => setMe(m.user))
      .catch(() => setMe(null));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <UserHeaderContext.Provider value={{ me, refresh }}>
      {children}
    </UserHeaderContext.Provider>
  );
}

export function useUserHeader() {
  const ctx = useContext(UserHeaderContext);
  if (!ctx) {
    throw new Error("useUserHeader must be used inside UserHeaderProvider");
  }
  return ctx;
}
