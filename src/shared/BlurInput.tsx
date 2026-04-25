import { useState, useEffect } from 'react';

export function BlurInput({ value, placeholder, onCommit, className }: {
  value: string;
  placeholder?: string;
  onCommit: (value: string) => void;
  className?: string;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);
  return (
    <input
      className={className}
      value={local}
      placeholder={placeholder}
      onChange={e => setLocal(e.target.value)}
      onBlur={() => { if (local !== value) onCommit(local); }}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
    />
  );
}
