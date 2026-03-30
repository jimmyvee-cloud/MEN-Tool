import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, Search } from "lucide-react";
import { apiJson } from "@/lib/api";
import { avatarSrc } from "@/lib/branding";

type SearchHit = {
  user_id: string;
  display_name: string;
  avatar_url?: string;
};

const SEARCH_DEBOUNCE_MS = 300;

export function FindFriendPage() {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (debounced.length < 1) {
      setResults([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    apiJson<SearchHit[]>(`/v1/users/search?q=${encodeURIComponent(debounced)}`)
      .then((rows) => {
        if (!cancelled) setResults(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const showEmptyHint = query.trim().length === 0;
  const showNoMatches =
    !showEmptyHint && !loading && debounced.length > 0 && results.length === 0;

  return (
    <div className="min-h-dvh bg-[#121820] max-w-lg mx-auto px-4 pt-5 pb-24">
      <header className="flex items-center gap-2 pb-4 border-b border-white/10">
        <Link to="/" className="text-white p-1 -ml-1 rounded-lg hover:bg-white/5" aria-label="Back">
          <ChevronLeft className="w-7 h-7" />
        </Link>
        <h1 className="text-lg font-bold text-white tracking-tight">Find a Friend</h1>
      </header>

      <div className="mt-5">
        <label className="block relative rounded-full border-2 border-[#f5a623] bg-[#1a2330] shadow-[0_0_0_1px_rgba(245,166,35,0.15)] focus-within:ring-1 focus-within:ring-[#f5a623]/40 transition-shadow">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/35 pointer-events-none"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name..."
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            className="w-full bg-transparent text-white placeholder:text-white/35 pl-12 pr-4 py-3.5 text-[15px] rounded-full outline-none"
            aria-label="Search by name"
          />
        </label>
      </div>

      <div className="mt-6 min-h-[200px]">
        {showEmptyHint && (
          <div className="flex flex-col items-center justify-center pt-12 pb-8 text-center px-4">
            <div className="text-white/[0.12] mb-4" aria-hidden>
              <Search className="w-20 h-20 stroke-[1]" />
            </div>
            <p className="text-white/50 text-[15px] leading-relaxed max-w-[260px]">
              Type a name to find friends
            </p>
          </div>
        )}

        {loading && debounced.length > 0 && (
          <div
            className="flex flex-col items-center gap-3 py-10"
            aria-busy="true"
            aria-label="Searching"
          >
            <div className="h-9 w-9 rounded-full border-2 border-white/15 border-t-[#f5a623] animate-spin" />
            <span className="text-xs text-white/45">Searching…</span>
          </div>
        )}

        {showNoMatches && (
          <p className="text-center text-sm text-white/45 py-10">No matches yet. Try another name.</p>
        )}

        {!loading && results.length > 0 && (
          <ul className="space-y-2">
            {results.map((u) => (
              <li key={u.user_id}>
                <Link
                  to={`/users/${u.user_id}`}
                  className="flex items-center gap-4 rounded-2xl bg-[#1a2330]/80 border border-white/5 px-4 py-3 active:bg-white/5 transition-colors"
                >
                  <div className="w-12 h-12 rounded-full overflow-hidden border border-white/10 shrink-0 bg-black/30">
                    <img
                      src={avatarSrc(u.avatar_url)}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="text-white font-medium text-[15px] truncate">{u.display_name}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
