export default function Loading() {
  return (
    <section className="section" aria-busy="true" aria-label="Loading content">
      <div className="container">
        <div className="loading-heading" />
        <div className="loading-grid">
          {Array.from({ length: 3 }, (_, index) => (
            <div className="loading-card" key={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
