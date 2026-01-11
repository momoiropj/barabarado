"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function HomePage() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setIsLoggedIn(!!data.user);
    });
  }, []);

  const ctaHref = isLoggedIn ? "/lists" : "/login";

  return (
    <main style={{ padding: 24 }}>
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        {/* Header */}
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div style={{ fontWeight: 800, letterSpacing: 0.2 }}>バラバラDo</div>
          <nav style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Link href="/lists" style={{ textDecoration: "underline" }}>
              Lists
            </Link>
            <Link href="/login" style={{ textDecoration: "underline" }}>
              Login
            </Link>
          </nav>
        </header>

        {/* Hero */}
        <section style={{ marginTop: 36, padding: 22, border: "1px solid #eee", borderRadius: 16 }}>
          <h1 style={{ fontSize: 42, lineHeight: 1.1, margin: 0 }}>
            考えなくていいToDo。
          </h1>
          <p style={{ fontSize: 18, marginTop: 14, marginBottom: 0, opacity: 0.9 }}>
            やりたいことを入れると、いまやることが出てくる。
          </p>

          <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link
              href={ctaHref}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "12px 16px",
                borderRadius: 12,
                border: "1px solid #ddd",
                textDecoration: "none",
                fontWeight: 700,
              }}
            >
              今すぐ使ってみる
            </Link>

            <span style={{ display: "inline-flex", alignItems: "center", opacity: 0.75 }}>
              {isLoggedIn === null ? "" : isLoggedIn ? "ログイン中：/listsへ" : "未ログイン：/loginへ"}
            </span>
          </div>
        </section>

        {/* Pain */}
        <section style={{ marginTop: 28 }}>
          <h2 style={{ fontSize: 22, marginBottom: 10 }}>こんなこと、ありませんか？</h2>
          <ul style={{ marginTop: 8, lineHeight: 1.9 }}>
            <li>やりたいことはあるのに、何から始めればいいかわからない</li>
            <li>やることが多すぎて、考えるだけで疲れてしまう</li>
            <li>ToDoを書いても、結局動けない</li>
          </ul>
          <p style={{ marginTop: 10 }}>
            それ、あなたの意志が弱いからじゃない。<br />
            <strong>「分解されていない」だけ。</strong>
          </p>
        </section>

        {/* Solution */}
        <section style={{ marginTop: 28, padding: 18, border: "1px solid #eee", borderRadius: 16 }}>
          <h2 style={{ fontSize: 22, marginBottom: 10 }}>バラバラDoは、最初の一歩を作るToDoです</h2>
          <p style={{ lineHeight: 1.9, marginTop: 0 }}>
            大きな目標をそのままToDoにしない。<br />
            AIが、<strong>いま実行できる小さな行動</strong>に分解します。
          </p>

          <ul style={{ lineHeight: 1.9, marginTop: 10 }}>
            <li>5〜10分でできること</li>
            <li>調べるだけでいいこと</li>
            <li>決めるだけで前に進むこと</li>
          </ul>

          <p style={{ marginTop: 10 }}>考える前に、動ける状態をつくります。</p>
        </section>

        {/* How to */}
        <section style={{ marginTop: 28 }}>
          <h2 style={{ fontSize: 22, marginBottom: 10 }}>使い方はとてもシンプル</h2>

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
            <div style={{ padding: 16, border: "1px solid #eee", borderRadius: 16 }}>
              <div style={{ fontWeight: 800 }}>1. やりたいことを書く</div>
              <div style={{ marginTop: 6, opacity: 0.9 }}>
                例：引っ越ししたい / 新規事業のLPを出したい / 毎日運動したい
              </div>
            </div>

            <div style={{ padding: 16, border: "1px solid #eee", borderRadius: 16 }}>
              <div style={{ fontWeight: 800 }}>2. AIで分解する</div>
              <div style={{ marginTop: 6, opacity: 0.9 }}>
                「最初の一歩」「情報収集」「予算」「段取り」目的に合わせて分解。
              </div>
            </div>

            <div style={{ padding: 16, border: "1px solid #eee", borderRadius: 16 }}>
              <div style={{ fontWeight: 800 }}>3. そのままToDoに追加</div>
              <div style={{ marginTop: 6, opacity: 0.9 }}>気に入ったものだけ選んで、すぐ行動。</div>
            </div>
          </div>
        </section>

        {/* Audience */}
        <section style={{ marginTop: 28 }}>
          <h2 style={{ fontSize: 22, marginBottom: 10 }}>バラバラDoが向いている人</h2>
          <ul style={{ lineHeight: 1.9, marginTop: 8 }}>
            <li>0→1がつらい人</li>
            <li>考えすぎて動けなくなる人</li>
            <li>完璧じゃなくていいから、前に進みたい人</li>
          </ul>
        </section>

        {/* CTA */}
        <section style={{ marginTop: 30, padding: 18, border: "1px solid #eee", borderRadius: 16 }}>
          <h2 style={{ fontSize: 22, marginBottom: 10 }}>無料で使えます</h2>
          <p style={{ marginTop: 0, lineHeight: 1.9 }}>
            登録して、すぐ使えます。<br />
            <strong>考えなくていいToDo。バラバラにして、動こう。</strong>
          </p>

          <Link
            href={ctaHref}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "12px 16px",
              borderRadius: 12,
              border: "1px solid #ddd",
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            今すぐ使ってみる
          </Link>

          <p style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
            ※ 本サービスは現在ベータ版です。
          </p>
        </section>

        {/* Footer */}
        <footer style={{ marginTop: 28, paddingBottom: 24, opacity: 0.7, fontSize: 12 }}>
          © {new Date().getFullYear()} BarabaraDo
        </footer>
      </div>
    </main>
  );
}
