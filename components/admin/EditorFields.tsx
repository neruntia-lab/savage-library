import type { ChangeEvent } from "react";

export function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="admin-section-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}

export function Field({
  label,
  name,
  value,
  type = "text",
  hint,
  ...props
}: {
  label: string;
  name: string;
  value: string;
  type?: string;
  hint?: string;
  required?: boolean;
  maxLength?: number;
  placeholder?: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <input name={name} type={type} defaultValue={value} {...props} />
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

export function TextArea({
  label,
  name,
  value,
  compact = false,
}: {
  label: string;
  name: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <label>
      <span>{label}</span>
      <textarea
        name={name}
        defaultValue={value}
        className={compact ? "textarea-compact" : ""}
      />
    </label>
  );
}

export function SelectField({
  label,
  name,
  value,
  options,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  options: Array<readonly [string, string]>;
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <select name={name} defaultValue={value} required onChange={onChange}>
        <option value="" disabled>
          Select…
        </option>
        {options.map(([optionValue, optionLabel]) => (
          <option value={optionValue} key={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}
