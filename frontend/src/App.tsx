import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { flushOutbox, onOnlineFlush, outboxCount } from "@/lib/offlineQueue";
import { getApiOrigin, getStoredTokens } from "@/lib/api";
import { BottomNav } from "@/components/BottomNav";
import { BadgeUnlockProvider } from "@/context/BadgeUnlockContext";
import { UserHeaderProvider } from "@/context/UserHeaderContext";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { TodayPage } from "@/pages/TodayPage";
import { CheckinPage } from "@/pages/CheckinPage";
import { StressorPage } from "@/pages/StressorPage";
import { ReliefPage } from "@/pages/ReliefPage";
import { InsightsPage } from "@/pages/InsightsPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { UserPublicPage } from "@/pages/UserPublicPage";
import { AdminPage } from "@/pages/AdminPage";
import { ReliefPresetPage } from "@/pages/ReliefPresetPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { FindFriendPage } from "@/pages/FindFriendPage";
import { ReferFriendPage } from "@/pages/ReferFriendPage";
import { RedirectReliefPreset } from "@/pages/LegacyRedirects";

const PendingContext = createContext<{
  pending: number;
  refreshPending: () => Promise<void>;
}>({ pending: 0, refreshPending: async () => {} });

export function usePending() {
  return useContext(PendingContext);
}

function Layout({ children }: { children: React.ReactNode }) {
  const { pending, refreshPending } = usePending();

  useEffect(() => {
    const off = onOnlineFlush(getApiOrigin(), () => {
      void refreshPending();
    });
    void refreshPending();
    return off;
  }, [refreshPending]);

  return (
    <UserHeaderProvider>
      <BadgeUnlockProvider>
        <div className="min-h-dvh bg-night pb-24">
          {pending > 0 && (
            <div className="sticky top-0 z-50 bg-gold/20 text-gold text-center text-xs py-1">
              {pending} change(s) pending sync — will send when online
            </div>
          )}
          {children}
          <BottomNav />
        </div>
      </BadgeUnlockProvider>
    </UserHeaderProvider>
  );
}

function Private({ children }: { children: React.ReactNode }) {
  const nav = useNavigate();
  const loc = useLocation();
  const { access } = getStoredTokens();
  useEffect(() => {
    if (!access) {
      const returnUrl = encodeURIComponent(loc.pathname + loc.search);
      nav(`/login?returnUrl=${returnUrl}`, { replace: true });
    }
  }, [access, nav, loc.pathname, loc.search]);
  if (!access) return null;
  return <Layout>{children}</Layout>;
}

function AppRoutes() {
  const [pending, setPending] = useState(0);
  const refreshPending = useCallback(async () => {
    setPending(await outboxCount());
  }, []);

  return (
    <PendingContext.Provider value={{ pending, refreshPending }}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/"
          element={
            <Private>
              <TodayPage />
            </Private>
          }
        />
        <Route
          path="/checkin"
          element={
            <Private>
              <CheckinPage />
            </Private>
          }
        />
        <Route
          path="/stressors"
          element={
            <Private>
              <StressorPage />
            </Private>
          }
        />
        <Route
          path="/relievers"
          element={
            <Private>
              <ReliefPage />
            </Private>
          }
        />
        <Route
          path="/relievers/preset/:presetId"
          element={
            <Private>
              <ReliefPresetPage />
            </Private>
          }
        />
        <Route
          path="/insights"
          element={
            <Private>
              <InsightsPage />
            </Private>
          }
        />
        <Route
          path="/profile"
          element={
            <Private>
              <ProfilePage />
            </Private>
          }
        />
        <Route
          path="/refer"
          element={
            <Private>
              <ReferFriendPage />
            </Private>
          }
        />
        <Route
          path="/users/:userId"
          element={
            <Private>
              <UserPublicPage />
            </Private>
          }
        />
        <Route
          path="/admin"
          element={
            <Private>
              <AdminPage />
            </Private>
          }
        />
        <Route
          path="/settings"
          element={
            <Private>
              <SettingsPage />
            </Private>
          }
        />
        <Route
          path="/find-friend"
          element={
            <Private>
              <FindFriendPage />
            </Private>
          }
        />
        <Route path="/stressor" element={<Navigate to="/stressors" replace />} />
        <Route path="/relief" element={<Navigate to="/relievers" replace />} />
        <Route
          path="/relief/preset/:presetId"
          element={
            <Private>
              <RedirectReliefPreset />
            </Private>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </PendingContext.Provider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

