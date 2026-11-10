"use client";

import { useFormStatus } from "react-dom";

// AI calls can take a few seconds on a small laptop, so the button says it is
// working instead of looking frozen (PDD §14, "AI responses show progress").
// It is a plain submit button, so forms still work before hydration.
export function PendingButton({
  label,
  busy,
  className = "button",
}: {
  label: string;
  busy: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button className={className} type="submit" disabled={pending}>
      {pending ? busy : label}
    </button>
  );
}
