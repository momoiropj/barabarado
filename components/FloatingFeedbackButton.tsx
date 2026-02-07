export default function FloatingFeedbackButton() {
  // ここを自分のGoogleフォームURLに差し替え
  const formUrl = "https://docs.google.com/forms/d/e/1FAIpQLSdvrbFNaC6-Y8yRjw5RjBhItFKeFE3TDHGcqUq2GPeC_9v4fw/viewform?usp=header";

  return (
    <a
      href={formUrl}
      target="_blank"
      rel="noreferrer"
      aria-label="不具合・要望を送る"
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        zIndex: 9999,
        padding: "12px 14px",
        borderRadius: 999,
        textDecoration: "none",
        fontSize: 14,
        fontWeight: 700,
        boxShadow: "0 6px 18px rgba(0,0,0,0.18)",
        border: "1px solid rgba(0,0,0,0.12)",
        background: "white",
        color: "black",
      }}
    >
      不具合・要望
    </a>
  );
}
