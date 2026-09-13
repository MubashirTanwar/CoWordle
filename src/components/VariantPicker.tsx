'use client';
import type { Variant } from '@shared/types';

export const VARIANT_INFO: Record<Variant, { label: string; blurb: string }> = {
  classic: { label: 'Classic', blurb: '6 tries · tiles show which letters are right' },
  word500: { label: 'Word500', blurb: '8 tries · only counts of 🟩🟨🟥 — not which letters' },
};

interface VariantPickerProps {
  value: Variant;
  onChange: (variant: Variant) => void;
}

export default function VariantPicker({ value, onChange }: VariantPickerProps) {
  return (
    <div>
      <div className="flex gap-2">
        {(Object.keys(VARIANT_INFO) as Variant[]).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={`flex-1 py-2 rounded text-sm font-bold transition-colors ${
              value === v
                ? 'bg-[#538d4e] text-white'
                : 'bg-[#3a3a3c] text-[#818384] hover:bg-[#565758] hover:text-white'
            }`}
          >
            {VARIANT_INFO[v].label}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-[#818384] mt-1.5">{VARIANT_INFO[value].blurb}</p>
    </div>
  );
}
