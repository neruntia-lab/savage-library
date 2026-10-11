import type { ResourceInput } from "../../lib/validation/resource";

export function DependenciesEditor({
  dependencies,
  onChange,
}: {
  dependencies: ResourceInput["dependencies"];
  onChange: (value: ResourceInput["dependencies"]) => void;
}) {
  return (
    <fieldset className="dependencies-editor">
      <div className="fieldset-heading">
        <div>
          <legend>Dependencies</legend>
          <small>Modules or packages visitors need before installation.</small>
        </div>
        <button
          type="button"
          className="button button-secondary button-small"
          onClick={() =>
            onChange([
              ...dependencies,
              { name: "", versionRange: "", url: "", isRequired: true },
            ])
          }
        >
          + Add dependency
        </button>
      </div>
      {dependencies.map((dependency, index) => (
        <div className="dependency-row" key={index}>
          <input
            aria-label={`Dependency ${index + 1} name`}
            placeholder="Module name"
            value={dependency.name}
            onChange={(event) =>
              onChange(
                dependencies.map((item, itemIndex) =>
                  itemIndex === index
                    ? { ...item, name: event.target.value }
                    : item,
                ),
              )
            }
          />
          <input
            aria-label={`Dependency ${index + 1} version`}
            placeholder="Version range"
            value={dependency.versionRange ?? ""}
            onChange={(event) =>
              onChange(
                dependencies.map((item, itemIndex) =>
                  itemIndex === index
                    ? { ...item, versionRange: event.target.value }
                    : item,
                ),
              )
            }
          />
          <input
            aria-label={`Dependency ${index + 1} URL`}
            placeholder="https://…"
            value={dependency.url ?? ""}
            onChange={(event) =>
              onChange(
                dependencies.map((item, itemIndex) =>
                  itemIndex === index
                    ? { ...item, url: event.target.value }
                    : item,
                ),
              )
            }
          />
          <label>
            <input
              type="checkbox"
              checked={dependency.isRequired}
              onChange={(event) =>
                onChange(
                  dependencies.map((item, itemIndex) =>
                    itemIndex === index
                      ? { ...item, isRequired: event.target.checked }
                      : item,
                  ),
                )
              }
            />
            Required
          </label>
          <button
            type="button"
            className="admin-more-button"
            aria-label={`Remove dependency ${index + 1}`}
            onClick={() =>
              onChange(
                dependencies.filter((_, itemIndex) => itemIndex !== index),
              )
            }
          >
            ×
          </button>
        </div>
      ))}
    </fieldset>
  );
}
