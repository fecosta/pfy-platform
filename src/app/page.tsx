export default function HomePage() {
  return (
    <main className="shell">
      <p className="eyebrow">Portuguese for You</p>
      <h1>The learning platform foundation is online.</h1>
      <p className="lede">
        The operational shell is ready for the next PFY specifications. Learning content and account
        features are intentionally not part of this baseline.
      </p>
      <a className="status" href="/api/health">
        Check application health <span aria-hidden="true">-&gt;</span>
      </a>
    </main>
  );
}
