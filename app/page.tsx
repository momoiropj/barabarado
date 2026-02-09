// app/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

const PASSCODE = "0214";
const PASS_OK_KEY = "bbdo_pass_ok_v1";

export default function HomePage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const ok = localStorage.getItem(PASS_OK_KEY) === "1";
      if (ok) router.replace("/lists");
    } catch {
      // ignore
    }
  }, [router]);

  const submit = () => {
    setError("");
    if (code.trim() === PASSCODE) {
      try {
        localStorage.setItem(PASS_OK_KEY, "1");
        localStorage.setItem("bbdo_pass_ok_at", new Date().toISOString());
      } catch {
        // ignore
      }
      router.push("/lists");
      return;
    }
    setError("パスコードが違うみたい。もう一回！");
  };

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <div className={styles.brand}>BaraBaraDo</div>
        <div className={styles.title}>パスコードを入力</div>
        <div className={styles.desc}>
          クローズドテスト用の入口だよ。<br />
          <span className={styles.muted}>（この端末のブラウザに保存される）</span>
        </div>

        <div className={styles.row}>
          <input
            className={styles.input}
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="0214"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            aria-label="passcode"
          />
          <button className={styles.btn} onClick={submit} type="button">
            入る
          </button>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.footer}>
          ※パスコードは仮のゲート。必要ならあとで「期限付き」や「招待制」に強化できる。
        </div>
      </div>
    </main>
  );
}
