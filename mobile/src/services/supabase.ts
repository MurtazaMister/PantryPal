import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import { createClient } from "@supabase/supabase-js";
import type { Session } from "@supabase/supabase-js";

WebBrowser.maybeCompleteAuthSession();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabase =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

function parseAuthParams(url: string) {
  const parsed = new URL(url);
  const query = new URLSearchParams(parsed.search);
  const hash = new URLSearchParams(parsed.hash.replace(/^#/, ""));
  const combined = new URLSearchParams();

  query.forEach((value, key) => combined.set(key, value));
  hash.forEach((value, key) => combined.set(key, value));

  return combined;
}

export async function signInWithGoogle() {
  if (!supabase) {
    throw new Error("Missing Supabase environment variables in mobile app.");
  }

  const redirectTo = makeRedirectUri({
    scheme: "pantrypal",
    path: "auth/callback",
  });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error) {
    throw error;
  }
  if (!data.url) {
    throw new Error("Failed to create Google OAuth URL.");
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success") {
    throw new Error("Google sign-in was cancelled.");
  }

  const params = parseAuthParams(result.url);
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  const code = params.get("code");

  if (accessToken && refreshToken) {
    const { error: setSessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (setSessionError) {
      throw setSessionError;
    }
  } else if (code) {
    // `exchangeCodeForSession` is available in Supabase v2 for PKCE redirects.
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      throw exchangeError;
    }
  } else {
    throw new Error("No auth tokens returned from Google OAuth redirect.");
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session) {
    throw sessionError ?? new Error("No authenticated session returned.");
  }

  return sessionData.session;
}

export async function getCurrentSession(): Promise<Session | null> {
  if (!supabase) {
    return null;
  }
  const { data } = await supabase.auth.getSession();
  return data.session;
}
