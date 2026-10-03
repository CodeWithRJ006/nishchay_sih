import React, { useId } from 'react';

type FieldProps = {
  label: string;
  error?: string;
  children: React.ReactElement;
  htmlFor?: string;
};

export const Field = ({ label, error, children, htmlFor }: FieldProps) => {
  const generatedId = useId();
  const id = htmlFor || children.props.id || generatedId;
  const name = children.props.name || id;
  const autoComplete = children.props.autoComplete || 'off';

  return (
    <div className="flex flex-col gap-1 mb-4">
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
      </label>
      {React.cloneElement(children, { id, name, autoComplete })}
      {error && <span className="text-xs text-seal-break-red font-medium">{error}</span>}
    </div>
  );
};
