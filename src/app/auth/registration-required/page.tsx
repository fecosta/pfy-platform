export default function RegistrationRequiredPage() {
  return (
    <main className="shell">
      <h1>Registration required</h1>
      <p className="lede">This authenticated email does not have a PFY identity yet.</p>
      <a className="status" href="/login">
        Return to authentication
      </a>
    </main>
  );
}
