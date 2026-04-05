import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Download, Trash2, Eye, X, Files as FilesIcon } from 'lucide-react'
import { useFiles } from '@/hooks/useFiles'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { GeneratedFile } from '@/types'

export default function Files() {
  const navigate = useNavigate()
  const { files, loading, deleteFile } = useFiles()
  const [preview, setPreview] = useState<GeneratedFile | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<GeneratedFile | null>(null)

  const handleDownload = (file: GeneratedFile) => {
    const blob = new Blob([file.content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${file.name.replace(/[^a-zA-Z0-9\s-_]/g, '').trim()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-500">
          {files.length} file{files.length !== 1 ? 's' : ''}
        </p>
        <Button onClick={() => navigate('/files/new')}>
          <Plus className="h-3.5 w-3.5" />
          Generate file
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-5 h-5 border-2 border-neutral-700 border-t-neutral-300 rounded-full animate-spin" />
        </div>
      ) : files.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-neutral-700 rounded-lg">
          <FilesIcon className="h-8 w-8 text-neutral-600 mx-auto mb-3" />
          <p className="font-medium text-neutral-400 text-sm mb-1">No files yet</p>
          <p className="text-xs text-neutral-500 mb-4">Generate a file from a template to see it here.</p>
          <Button variant="outline" size="sm" onClick={() => navigate('/files/new')}>
            Generate first file
          </Button>
        </div>
      ) : (
        <div className="rounded border border-neutral-800 overflow-hidden bg-neutral-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-950">
                <th className="text-left px-4 py-2.5 font-medium text-neutral-500 text-xs">Name</th>
                <th className="text-left px-3 py-2.5 font-medium text-neutral-500 text-xs hidden sm:table-cell">Venue</th>
                <th className="text-left px-3 py-2.5 font-medium text-neutral-500 text-xs hidden md:table-cell">Template</th>
                <th className="text-left px-3 py-2.5 font-medium text-neutral-500 text-xs">Date</th>
                <th className="px-3 py-2.5 w-24" />
              </tr>
            </thead>
            <tbody>
              {files.map(file => (
                <tr key={file.id} className="border-b border-neutral-800 last:border-0 hover:bg-neutral-800 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-medium text-neutral-100">{file.name}</span>
                  </td>
                  <td className="px-3 py-3 hidden sm:table-cell">
                    {file.venue ? (
                      <span className="text-xs text-neutral-400">{file.venue.name}</span>
                    ) : (
                      <span className="text-neutral-600 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 hidden md:table-cell">
                    {file.template ? (
                      <Badge variant="secondary" className="text-xs">{file.template.name}</Badge>
                    ) : (
                      <span className="text-neutral-600 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <span className="text-xs text-neutral-500">
                      {new Date(file.created_at).toLocaleDateString()}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPreview(file)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDownload(file)}>
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-500 hover:text-red-400"
                        onClick={() => setConfirmDelete(file)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {preview && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setPreview(null)} />
          <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg bg-neutral-900 border-l border-neutral-800 flex flex-col shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
              <div>
                <h2 className="font-semibold text-sm text-neutral-100">{preview.name}</h2>
                <p className="text-xs text-neutral-500 mt-0.5">{new Date(preview.created_at).toLocaleString()}</p>
              </div>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" onClick={() => handleDownload(preview)}>
                  <Download className="h-3.5 w-3.5" />
                  Download
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setPreview(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <pre className="flex-1 overflow-y-auto p-5 text-xs font-mono text-neutral-300 whitespace-pre-wrap leading-relaxed">
              {preview.content}
            </pre>
          </div>
        </>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setConfirmDelete(null)} />
          <div className="relative bg-neutral-900 rounded-lg border border-neutral-700 p-6 max-w-sm w-full shadow-xl">
            <h3 className="font-semibold text-neutral-100 mb-2">Delete file?</h3>
            <p className="text-sm text-neutral-400 mb-4">
              <strong className="text-neutral-200">{confirmDelete.name}</strong> will be permanently deleted.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(null)}>Cancel</Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={async () => {
                  await deleteFile(confirmDelete.id)
                  setConfirmDelete(null)
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
