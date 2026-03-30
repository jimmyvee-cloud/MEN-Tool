import { Navigate, useParams } from "react-router-dom";

export function RedirectReliefPreset() {
  const { presetId } = useParams();
  if (!presetId) return <Navigate to="/relievers" replace />;
  return <Navigate to={`/relievers/preset/${presetId}`} replace />;
}
