import { useState, useEffect } from 'react'
import { X, Download, Loader } from 'lucide-react'
import { getPDFBlob } from '@/lib/pdf'
import type { TrainingSession } from '@/types'

interface Props {
  session: TrainingSession
  onClose: () => void
  onDownload: () => void
}

export function PDFPreview({ session, onClose, onDownload }: Props) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getPDFBlob(session).then(blob => {
      const u = URL.createObjectURL(blob)
      setUrl(u)
      setLoading(false)
    })
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [])

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col overflow-hidden" style={{ maxHeight: '92vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 bg-dj-900 flex-shrink-0">
          <div>
            <p className="text-white font-bold text-sm">Vista previa del PDF</p>
            <p className="text-white/50 text-xs">
              Sesión {session.session_number} — {session.team_category} — {session.coach_name}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onDownload}
              className="bg-gold-400 hover:bg-gold-500 text-gray-900 text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5"
            >
              <Download size={14}/> Descargar PDF
            </button>
            <button onClick={onClose} className="text-white/50 hover:text-white p-2 rounded-xl hover:bg-white/10">
              <X size={18}/>
            </button>
          </div>
        </div>

        {/* Preview */}
        <div className="flex-1 bg-gray-200 flex items-center justify-center min-h-0">
          {loading ? (
            <div className="flex flex-col items-center gap-3 text-gray-500">
              <Loader size={32} className="animate-spin"/>
              <p className="text-sm">Generando preview...</p>
            </div>
          ) : url ? (
            <iframe
              src={`${url}#toolbar=0&navpanes=0`}
              className="w-full h-full border-0"
              style={{ minHeight: 480 }}
              title="Vista previa PDF"
            />
          ) : (
            <p className="text-gray-500 text-sm">No se pudo generar la vista previa.</p>
          )}
        </div>
      </div>
    </div>
  )
}
