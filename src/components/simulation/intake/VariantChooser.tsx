"use client"

import type { ScopeField } from "@/domains/types"

type VariantChooserProps = {
  field: ScopeField
  onChoose: (label: string) => void
}

// The first beat of a lane with kinds: one chips field, rendered as cards
// with room for a hint, because this answer reshapes everything after it.
export const VariantChooser = ({ field, onChoose }: VariantChooserProps) => (
  <div className="mx-auto max-w-[640px] pt-6 text-center">
    <h1 className="text-[25px] font-semibold tracking-[-.02em]">{field.label}</h1>
    <div role="group" aria-label={field.label} className="mt-8 grid gap-4 sm:grid-cols-2">
      {(field.options ?? []).map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChoose(option.label)}
          className="focus-ring rounded-2xl border border-line bg-surface-raised p-6 text-left shadow-card transition-colors hover:border-accent-line hover:bg-surface-2"
        >
          <span className="block text-[17px] font-semibold tracking-[-.01em]">{option.label}</span>
          {option.hint && (
            <span className="mt-1.5 block text-[13px] leading-normal text-on-surface-2">
              {option.hint}
            </span>
          )}
        </button>
      ))}
    </div>
  </div>
)
