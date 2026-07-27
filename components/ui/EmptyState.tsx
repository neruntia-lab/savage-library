export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="empty-state" role="status">
      <span aria-hidden="true">⌕</span>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}
