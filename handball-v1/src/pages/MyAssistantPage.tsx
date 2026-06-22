import { useState, useEffect } from 'react'
import { UserPlus, X, Trash2, AlertCircle } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { Button, Toast, Card } from '@/components/ui/index'
import { getMyAssistant, linkAssistantByUsername, unlinkAssistant, type AssistantLink } from '@/lib/assistantLinks'

export function MyAssistantPage() {
  const { profile } = useAppStore()
  const [link, setLink] = useState<AssistantLink | null>(null)
  const [assistantName, setAssistantName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [username, setUsername] = useState('')
  const [linking, setLinking] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    if (!profile) return
    getMyAssistant(profile.id)
      .then(result => {
        if (result) {
          setLink(result.link)
          setAssistantName(result.assistantName)
        }
      })
      .catch(() => setToast({ msg: 'Error al cargar.', type: 'error' }))
      .finally(() => setLoading(false))
  }, [profile])

  async function handleLink() {
    if (!profile || !username.trim()) return
    setLinking(true)
    try {
      const created = await linkAssistantByUsername(profile.id, username.trim())
      setLink(created)
      setAssistantName(username.trim())
      setUsername('')
      setToast({ msg: 'Ayudante técnico vinculado.', type: 'success' })
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : 'Error al vincular.', type: 'error' })
    } finally {
      setLinking(false)
    }
  }

  async function handleUnlink() {
    if (!link) return
    if (!confirm('¿Desvincular a este Ayudante Técnico? Va a perder el acceso a tus entrenamientos y planificación.')) return
    try {
      await unlinkAssistant(link.id)
      setLink(null)
      setAssistantName(null)
      setToast({ msg: 'Ayudante técnico desvinculado.', type: 'success' })
    } catch {
      setToast({ msg: 'Error al desvincular.', type: 'error' })
    }
  }

  return (
    <div className="space-y-4 max-w-lg">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 font-display">Mi ayudante técnico</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Tu AT puede ver y editar tus entrenamientos, planificación y asistencia, igual que vos.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 py-4">Cargando...</p>
      ) : link && assistantName ? (
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 uppercase font-bold tracking-wide">Vinculado</p>
              <p className="font-semibold text-gray-900 mt-0.5">{assistantName}</p>
            </div>
            <button
              onClick={handleUnlink}
              className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600 font-medium"
            >
              <Trash2 size={14}/> Desvincular
            </button>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl p-3 mb-4">
            <AlertCircle size={16} className="text-amber-500 flex-shrink-0 mt-0.5"/>
            <p className="text-xs text-amber-700">
              El usuario que vincules debe haberse registrado antes en la app, con su propio perfil
              (vos le pasás el código del club como a cualquier entrenador nuevo).
            </p>
          </div>
          <label className="text-sm font-medium text-gray-700 block mb-1.5">
            Nombre de usuario de tu Ayudante Técnico
          </label>
          <div className="flex gap-2">
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLink()}
              placeholder="Ej: javier_alonso"
              className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-dj-400"
            />
            <Button icon={<UserPlus size={15}/>} loading={linking} disabled={!username.trim()} onClick={handleLink}>
              Vincular
            </Button>
          </div>
        </Card>
      )}

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)}/>}
    </div>
  )
}
