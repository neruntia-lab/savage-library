import Link from "next/link";
import { ROUTES } from "../lib/config/site";

export default function NotFound() {
  return (
    <section className="section">
      <div className="container narrow-container">
        <div className="error-state">
          <p className="eyebrow">404</p>
          <h1>Resource not found.</h1>
          <p>It may be unpublished, renamed, or no longer available.</p>
          <Link className="button button-primary" href={ROUTES.library}>
            Browse the library
          </Link>
        </div>
      </div>
    </section>
  );
}
