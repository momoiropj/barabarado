"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string>("");

  const signInWithEmail = async () => {
    setStatus("Sending magic link...");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: "http://localhost:3000/lists" },
    });
    if (error) return setStatus(`Error: ${error.message}`);
    setStatus("Check your email for the magic link.");
  };

  return (
    <main style={{ padding: 24, maxWidth: 520, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>Login</h1>
      <p style={{ marginTop: 8 }}>Enter your email to get a magic link.</p>

      <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
        <input
          style={{ flex: 1, padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button
          style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #ddd" }}
          onClick={signInWithEmail}
          disabled={!email}
        >
          Send
        </button>
      </div>

      {status && <p style={{ marginTop: 12 }}>{status}</p>}
    </main>
  );
}
