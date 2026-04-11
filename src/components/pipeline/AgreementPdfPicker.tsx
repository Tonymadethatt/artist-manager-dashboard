import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useFiles } from '@/hooks/useFiles'
import type { GeneratedFile } from '@/types'
import { isSelectableAgreementPdfFile } from '@/lib/files/pdfShareUrl'

function pdfMatchesScope(
  f: GeneratedFile,
  venueId: string | null | undefined,
  dealId: string | null | undefined
): boolean {
  if (!isSelectableAgreementPdfFile(f)) return false
  if (venueId && f.venue_id != null && f.venue_id !== venueId) return false
  if (dealId && f.deal_id != null && f.deal_id !== dealId) return false
  return true
}

type AgreementPdfPickerProps = {
  value: string | null | undefined
  onChange: (id: string | null) => void
  venueId: string | null | undefined
  dealId: string | null | undefined
  disabled?: boolean
  /** When set, only files matching venue (and deal if set) appear first; others listed under "Other". */
  preferScoped?: boolean
}

export function AgreementPdfPicker({
  value,
  onChange,
  venueId,
  dealId,
  disabled,
  preferScoped = true,
}: AgreementPdfPickerProps) {
  const { files, loading } = useFiles()

  const { scoped, rest } = useMemo(() => {
    const pdfs = files.filter(f => isSelectableAgreementPdfFile(f))
    if (!preferScoped || (!venueId && !dealId)) {
      return { scoped: pdfs, rest: [] as GeneratedFile[] }
    }
    const sc = pdfs.filter(f => pdfMatchesScope(f, venueId, dealId))
    const r = pdfs.filter(f => !pdfMatchesScope(f, venueId, dealId))
    return { scoped: sc, rest: r }
  }, [files, venueId, dealId, preferScoped])

  const labelFor = (f: GeneratedFile) => {
    const bits = [f.name]
    if (f.venue?.name) bits.push(f.venue.name)
    if (f.deal_id && dealId && f.deal_id === dealId) bits.push('this deal')
    return bits.join(' · ')
  }

  return (
    <div className="space-y-1">
      <Select
        value={value || '__none__'}
        onValueChange={v => onChange(v === '__none__' ? null : v)}
        disabled={disabled || loading}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={loading ? 'Loading PDFs…' : 'No document linked'} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">None</SelectItem>
          {scoped.map(f => (
            <SelectItem key={f.id} value={f.id} className="text-xs">
              {labelFor(f)}
            </SelectItem>
          ))}
          {rest.length > 0 && (
            <>
              <div className="px-2 py-1.5 text-[10px] text-neutral-500 uppercase tracking-wider">
                Other PDFs
              </div>
              {rest.map(f => (
                <SelectItem key={f.id} value={f.id} className="text-xs">
                  {labelFor(f)}
                </SelectItem>
              ))}
            </>
          )}
        </SelectContent>
      </Select>
      <p className="text-[10px] text-neutral-600 leading-snug">
        Lists every PDF in Files (including legacy rows with a broken share slug). Pick one, save the deal, then
        send.{' '}
        <Link to="/files/new" className="text-neutral-400 hover:text-neutral underline-offset-2 hover:underline">
          Generate PDF
        </Link>
      </p>
    </div>
  )
}
