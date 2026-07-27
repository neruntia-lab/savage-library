import type { CatalogFacets } from "../../lib/domain/resource";

export function TaxonomyManager({
  facets,
  onStatus,
}: {
  facets: CatalogFacets;
  onStatus: (message: string) => void;
}) {
  const groups = [
    ["author", "Authors", facets.authors],
    ["category", "Categories", facets.categories],
    ["system", "Game systems", facets.gameSystems],
    ["tag", "Tags", facets.tags],
  ] as const;

  async function create(formData: FormData) {
    const response = await fetch("/api/taxonomy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData)),
    });
    onStatus(
      response.ok
        ? "Metadata entry created. Reload the page to use it."
        : "Metadata entry could not be created.",
    );
  }

  async function update(type: string, id: string, formData: FormData) {
    const response = await fetch(`/api/taxonomy/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, ...Object.fromEntries(formData) }),
    });
    onStatus(response.ok ? "Metadata updated." : "Metadata update failed.");
  }

  async function remove(type: string, id: string) {
    const response = await fetch(
      `/api/taxonomy/${id}?type=${encodeURIComponent(type)}`,
      { method: "DELETE" },
    );
    onStatus(
      response.ok
        ? "Metadata deleted. Reload to refresh the list."
        : "Metadata is still in use or could not be deleted.",
    );
  }

  return (
    <div className="taxonomy-grid">
      {groups.map(([type, title, items]) => (
        <section className="admin-panel" key={type}>
          <div className="admin-panel-heading">
            <h2>{title}</h2>
            <span>{items.length}</span>
          </div>
          <form className="taxonomy-create" action={create}>
            <input type="hidden" name="type" value={type} />
            <input name="name" placeholder={`New ${type} name`} required />
            <input name="slug" placeholder="url-slug" required />
            <button className="button button-primary button-small">Add</button>
          </form>
          <div className="taxonomy-list">
            {items.map((item) => (
              <form
                key={item.id}
                action={(formData) => update(type, item.id, formData)}
              >
                <input name="name" defaultValue={item.name} required />
                <input name="slug" defaultValue={item.slug} required />
                <button className="button button-secondary button-small">
                  Update
                </button>
                <button
                  className="button button-danger button-small"
                  type="button"
                  onClick={() => remove(type, item.id)}
                >
                  Delete
                </button>
              </form>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
