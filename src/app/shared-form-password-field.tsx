"use client";

import { useEffect, useState } from "react";

type PasswordTarget = {
  formId: string;
  name: string;
};

type SharedFormPasswordFieldProps = {
  label: string;
  placeholder: string;
  helperText?: string;
  errorText?: string;
  targets: PasswordTarget[];
  className?: string;
};

export function SharedFormPasswordField({
  label,
  placeholder,
  helperText,
  errorText,
  targets,
  className,
}: SharedFormPasswordFieldProps) {
  const [value, setValue] = useState("");

  useEffect(() => {
    const cleanups = targets.map((target) => {
      const form = document.getElementById(target.formId);
      if (!(form instanceof HTMLFormElement)) {
        return () => {};
      }

      const handleFormData = (event: FormDataEvent) => {
        event.formData.set(target.name, value);
      };

      form.addEventListener("formdata", handleFormData);
      return () => {
        form.removeEventListener("formdata", handleFormData);
      };
    });

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [targets, value]);

  return (
    <>
      <div className={["grid gap-1", className].filter(Boolean).join(" ")}>
        <label className="text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>
          {label}
        </label>
        <input
          type="password"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          aria-invalid={Boolean(errorText)}
          className="h-10 rounded-lg border bg-white px-3 text-sm"
          style={{ borderColor: errorText ? "#fda4af" : "var(--line)" }}
          placeholder={placeholder}
          autoComplete="current-password"
        />
        {errorText ? (
          <p className="text-xs" style={{ color: "var(--danger)" }}>
            {errorText}
          </p>
        ) : helperText ? (
          <p className="text-xs" style={{ color: "var(--ink-soft)" }}>
            {helperText}
          </p>
        ) : null}
      </div>

      {targets.map((target) => (
        <input
          key={`${target.formId}:${target.name}`}
          type="hidden"
          form={target.formId}
          name={target.name}
          value={value}
          readOnly
        />
      ))}
    </>
  );
}
