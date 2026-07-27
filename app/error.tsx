"use client";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="section">
      <div className="container narrow-container">
        <div className="error-state" role="alert">
          <p className="eyebrow">Something went wrong</p>
          <h1>The library could not load.</h1>
          <p>Try again. If the problem continues, return to the library later.</p>
          <button className="button button-primary" type="button" onClick={reset}>
            Try again
          </button>
        </div>
      </div>
    </section>
  );
}
