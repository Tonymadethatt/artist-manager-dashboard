import { useCallback, useMemo, useState } from 'react'
import { Check, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useArtistProfile } from '@/hooks/useArtistProfile'
import {
  ALL_CALL_INTAKE_QUESTION_IDS,
  CALL_INTAKE_SECTIONS,
  personalizeScriptText,
  type ScriptBlock,
} from '@/lib/intake/callIntakeDefinition'

function personalizeBlockText(
  block: ScriptBlock,
  artistName: string,
  managerName: string,
  clientName: string,
): string {
  if (block.type === 'question' || block.type === 'paragraph' || block.type === 'coach') {
    return personalizeScriptText(block.text, { artistName, managerName, clientName })
  }
  if (block.type === 'heading' || block.type === 'subheading') {
    return personalizeScriptText(block.text, { artistName, managerName, clientName })
  }
  return ''
}

/** Read-only checklist for Forms → Preview (nothing persisted). */
export function CallIntakeScriptChecklist({ embedded }: { embedded?: boolean }) {
  const { profile } = useArtistProfile()
  const artistName = profile?.artist_name ?? ''
  const managerName =
    [profile?.manager_name?.trim(), profile?.manager_title?.trim()].filter(Boolean).join(', ') ||
    profile?.manager_name ||
    ''
  const [clientName, setClientName] = useState('')

  const [done, setDone] = useState<Set<string>>(() => new Set())
  const toggle = useCallback((id: string) => {
    setDone(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])
  const clearAll = useCallback(() => setDone(new Set()), [])

  const progress = useMemo(() => {
    const n = ALL_CALL_INTAKE_QUESTION_IDS.filter(id => done.has(id)).length
    return { n, total: ALL_CALL_INTAKE_QUESTION_IDS.length }
  }, [done])

  return (
    <div className={cn(embedded ? 'pb-6' : 'max-w-3xl mx-auto pb-12')}>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500 mb-1">
            Internal · Front Office
          </p>
          <h1 className="text-lg font-semibold text-white tracking-tight">Client call script</h1>
          <p className="text-sm text-neutral-400 mt-0.5">Live call checklist · sample client name below</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-neutral-500 tabular-nums">
            {progress.n}/{progress.total} checked
          </span>
          <button
            type="button"
            onClick={clearAll}
            className="text-xs font-medium text-neutral-400 hover:text-white border border-white/10 rounded-lg px-2.5 py-1.5 transition-colors"
          >
            Reset checklist
          </button>
        </div>
      </div>

      <div className="mb-6 space-y-1.5 max-w-md">
        <label className="text-[11px] font-medium text-neutral-500 uppercase tracking-wide">
          Client first name (for opener/closer)
        </label>
        <input
          type="text"
          value={clientName}
          onChange={e => setClientName(e.target.value)}
          placeholder="e.g. Alex"
          className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-neutral-500"
        />
      </div>

      <p className="text-xs text-neutral-500 mb-8 border-l-2 border-white/10 pl-3">
        Nothing is saved here — use Intake under Forms for persisted call notes. Tap a line to mark it done.
      </p>

      <div className="space-y-8">
        {CALL_INTAKE_SECTIONS.map(section => (
          <section
            key={section.title}
            className="rounded-xl border border-white/[0.07] bg-neutral-900/40 overflow-hidden"
          >
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500 px-4 py-2.5 border-b border-white/[0.06] bg-neutral-900/60">
              {section.title}
            </h2>
            <div className="p-4 space-y-3">
              {section.blocks.map((block, i) => {
                if (block.type === 'heading') {
                  return (
                    <h3 key={i} className="text-sm font-semibold text-white pt-1">
                      {personalizeBlockText(block, artistName, managerName, clientName)}
                    </h3>
                  )
                }
                if (block.type === 'subheading') {
                  return (
                    <p
                      key={i}
                      className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500 pt-2"
                    >
                      {personalizeBlockText(block, artistName, managerName, clientName)}
                    </p>
                  )
                }
                if (block.type === 'paragraph') {
                  return (
                    <p
                      key={i}
                      className="text-sm text-neutral-200 leading-relaxed whitespace-pre-wrap"
                    >
                      {personalizeBlockText(block, artistName, managerName, clientName)}
                    </p>
                  )
                }
                if (block.type === 'coach') {
                  return (
                    <p
                      key={i}
                      className="text-xs text-neutral-500 leading-relaxed italic border-l-2 border-amber-500/40 pl-3"
                    >
                      {personalizeBlockText(block, artistName, managerName, clientName)}
                    </p>
                  )
                }
                const isChecked = done.has(block.id)
                const line = personalizeBlockText(block, artistName, managerName, clientName)
                return (
                  <button
                    key={block.id}
                    type="button"
                    onClick={() => toggle(block.id)}
                    className={cn(
                      'w-full text-left flex gap-3 rounded-lg border px-3 py-2.5 transition-all duration-150',
                      isChecked
                        ? 'border-white/[0.06] bg-neutral-950/80 opacity-55'
                        : 'border-white/[0.1] bg-neutral-950/40 hover:border-white/[0.14] hover:bg-neutral-950/60',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors',
                        isChecked
                          ? 'border-emerald-600/80 bg-emerald-600/20 text-emerald-400'
                          : 'border-neutral-600 text-neutral-600',
                      )}
                    >
                      {isChecked ? (
                        <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                      ) : (
                        <Circle className="w-3 h-3 opacity-40" />
                      )}
                    </span>
                    <span
                      className={cn(
                        'text-sm leading-relaxed flex-1 min-w-0',
                        isChecked
                          ? 'text-neutral-500 line-through decoration-neutral-600'
                          : 'text-neutral-100',
                      )}
                    >
                      {line}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-10 text-[10px] text-neutral-600 text-center">Prepared for internal use only</p>
    </div>
  )
}

/** @deprecated Use CallIntakeScriptChecklist; kept for transitional imports. */
export const RafaelLamasCallScriptChecklist = CallIntakeScriptChecklist
