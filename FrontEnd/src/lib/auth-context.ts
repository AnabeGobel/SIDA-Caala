import { createContext } from "react";
import type { Session } from "@supabase/supabase-js";
import type { UserProfile } from "./auth-core";

export type AuthState = {
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  updateProfile: (profile: UserProfile) => void;
};

export const AuthContext = createContext<AuthState>({
  session: null,
  profile: null,
  loading: true,
  error: null,
  updateProfile: () => {},
});
