import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { useNavigate } from "react-router-dom";
import {
  apiJson,
  formatApiError,
  getApiOrigin,
  isLikelyNetworkError,
  setTokens,
} from "@/lib/api";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (resp: { credential: string }) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              theme?: string;
              size?: string;
              width?: string | number;
              text?: string;
              shape?: string;
            }
          ) => void;
        };
      };
    };
  }
}

const clientId = (): string =>
  (import.meta.env.VITE_GOOGLE_CLIENT_ID || "").trim();

/**
 * Google Identity Services button. Hidden when VITE_GOOGLE_CLIENT_ID is unset.
 * inviteCodeRef.current is read at callback time (Register page typing).
 */
export function GoogleSignInButton({
  inviteCodeRef,
}: {
  inviteCodeRef?: MutableRefObject<string>;
}) {
  const nav = useNavigate();
  const divRef = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState("");
  const cid = clientId();

  useEffect(() => {
    if (!cid) return;

    let cancelled = false;
    let intervalId = 0;

    const mount = () => {
      const node = divRef.current;
      if (cancelled || !node || !window.google?.accounts?.id) return false;
      window.google.accounts.id.initialize({
        client_id: cid,
        callback: async (res: { credential: string }) => {
          setErr("");
          try {
            const invite = inviteCodeRef?.current?.trim() || null;
            const data = await apiJson<{
              access_token: string;
              refresh_token: string;
            }>("/v1/auth/google", {
              method: "POST",
              skipAuth: true,
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id_token: res.credential,
                invite_code: invite || null,
              }),
            });
            setTokens(data.access_token, data.refresh_token);
            nav("/", { replace: true });
          } catch (ex) {
            if (isLikelyNetworkError(ex)) {
              const origin = getApiOrigin() || "this origin (Vite /v1 proxy)";
              setErr(
                `Cannot reach the API (${origin}). Start the stack: docker compose up api dynamodb-local — or if you open the UI from another device, keep VITE_API_BASE_URL empty so requests use the Vite dev server proxy.`,
              );
              return;
            }
            setErr(formatApiError(ex));
          }
        },
      });
      node.replaceChildren();
      window.google.accounts.id.renderButton(node, {
        theme: "filled_black",
        size: "large",
        width: "100%",
        text: "continue_with",
        shape: "rectangular",
      });
      return true;
    };

    if (mount()) {
      return () => {
        cancelled = true;
      };
    }

    intervalId = window.setInterval(() => {
      if (mount()) {
        window.clearInterval(intervalId);
      }
    }, 100);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [cid, nav, inviteCodeRef]);

  if (!cid) return null;

  return (
    <div className="w-full space-y-2">
      <p className="text-center text-muted text-xs">or</p>
      <div ref={divRef} className="w-full flex justify-center min-h-[40px]" />
      {err ? <p className="text-red-400 text-sm break-all">{err}</p> : null}
    </div>
  );
}
