import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { AuthContext, type AuthState } from "./auth-context";
import type { UserProfile } from "./auth-core";
import { fetchProfile } from "./auth-core";
import { supabase } from "./supabase";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<AuthState, "updateProfile">>({
    session: null,
    profile: null,
    loading: true,
    error: null,
  });
  const updateProfile = useCallback((profile: UserProfile) => {
    setState((current) => ({ ...current, profile }));
  }, []);

  useEffect(() => {
    window.localStorage.removeItem("sida.users");
    window.localStorage.removeItem("sida.session");
    if (!supabase) {
      setState({
        session: null,
        profile: null,
        loading: false,
        error: "Supabase não configurado.",
      });
      return;
    }

    let active = true;
    let requestId = 0;
    const loadProfile = async (session: Session | null) => {
      const currentRequest = ++requestId;
      if (!session) {
        if (active)
          setState({
            session: null,
            profile: null,
            loading: false,
            error: null,
          });
        return;
      }
      if (active)
        setState({ session, profile: null, loading: true, error: null });
      try {
        const profile = await fetchProfile(session.access_token);
        if (active && currentRequest === requestId) {
          setState({ session, profile, loading: false, error: null });
        }
      } catch (error) {
        if (active && currentRequest === requestId) {
          setState({
            session,
            profile: null,
            loading: false,
            error:
              error instanceof Error
                ? error.message
                : "Falha ao validar perfil.",
          });
        }
      }
    };

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      queueMicrotask(() => void loadProfile(session));
    });
    void supabase.auth
      .getSession()
      .then(({ data: sessionData }) => loadProfile(sessionData.session));

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
