import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  label?: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  onCreate?: (value: string) => void;
  placeholder?: string;
};

export default function MultiSelect({ label, options, selected, onChange, onCreate, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown, true);
    return () => document.removeEventListener('mousedown', onDown, true);
  }, []);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return options;
    return options.filter(o => o.toLowerCase().includes(qq));
  }, [q, options]);

  const toggle = (value: string) => {
    const set = new Set(selected);
    if (set.has(value)) set.delete(value); else set.add(value);
    onChange(Array.from(set));
  };

  const remove = (value: string) => {
    onChange(selected.filter(v => v !== value));
  };

  const canCreate = () => {
    const v = q.trim();
    return v.length > 0 && !options.includes(v);
  };

  return (
    <div ref={wrapRef} className="relative">
      {label && <label className="block text-sm font-medium">{label}</label>}
      <div className="mt-1">
        <button type="button" onClick={() => setOpen(v=>!v)} className="w-full border rounded-md px-3 py-2 text-left flex items-center gap-2 flex-wrap min-h-[40px]">
          {selected.length === 0 ? (
            <span className="text-slate-400 text-sm">{placeholder || 'Select...'}</span>
          ) : (
            selected.map(v => (
              <span key={v} className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 text-xs px-2 py-1 rounded">
                {v}
                <button type="button" onClick={(e)=>{ e.stopPropagation(); remove(v); }} className="text-slate-400 hover:text-slate-600">×</button>
              </span>
            ))
          )}
        </button>
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border rounded-md shadow">
          <div className="p-2 border-b">
            <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder={placeholder || 'Type to search or add'} className="w-full text-sm border rounded-md px-2 py-1.5" />
            {onCreate && canCreate() && (
              <button
                type="button"
                onClick={() => { const v = q.trim(); if (!v) return; onCreate(v); onChange(Array.from(new Set([...selected, v]))); setQ(""); }}
                className="mt-2 w-full text-left text-xs px-2 py-1.5 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              >
                Add "{q.trim()}"
              </button>
            )}
          </div>
          <div className="max-h-56 overflow-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-sm text-slate-500">No results</div>
            ) : filtered.map(opt => {
              const active = selected.includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => toggle(opt)}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-slate-50 ${active ? 'bg-slate-50' : ''}`}
                >
                  <span className={`inline-block w-4 h-4 rounded border ${active ? 'bg-[#7b0f2b] border-[#7b0f2b]' : 'border-slate-300'}`} />
                  <span className="truncate">{opt}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

