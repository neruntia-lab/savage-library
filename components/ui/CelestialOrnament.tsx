/** Decorative, reusable archive artwork; never part of the accessible name. */
export function CelestialOrnament({
  variant,
  className = "",
}: {
  variant: "sun" | "moon";
  className?: string;
}) {
  return (
    <svg
      className={`celestial-ornament ${className}`}
      viewBox="0 0 200 200"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      {Array.from({ length: 32 }, (_, index) => (
        <path
          key={index}
          d={index % 2 ? "M100 22v12" : "M100 8v26"}
          transform={`rotate(${index * 11.25} 100 100)`}
          strokeWidth={index % 2 ? ".7" : "1"}
        />
      ))}
      {variant === "sun" ? (
        <>
          <circle cx="100" cy="100" r="55" />
          <circle cx="100" cy="100" r="49" strokeWidth=".6" />
          <circle cx="100" cy="100" r="43" strokeDasharray="1 5" />
        </>
      ) : (
        <>
          <path
            d="M117 45a57 57 0 1 1-28 108A56 56 0 0 0 117 45Z"
            fill="currentColor"
            fillOpacity=".15"
          />
          <path d="m100 68 5 25 25 7-25 5-5 27-5-27-25-5 25-7Z" />
          <path d="M100 68v64M70 100h60" strokeWidth=".5" />
        </>
      )}
      <path d="m100 94 3 6-3 6-3-6Z" fill="currentColor" />
    </svg>
  );
}
