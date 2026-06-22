import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Sparkles } from 'lucide-react'

export function CreateAccountComingSoonPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 mb-6">
          <Sparkles size={28} className="text-emerald-400"/>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Próximamente</h1>
        <p className="text-gray-400 text-sm mb-8">
          Estamos terminando de preparar el registro de cuentas nuevas para clubes y entrenadores. Muy pronto vas a poder crear la tuya directamente desde aquí.
        </p>
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 text-sm font-medium"
        >
          <ArrowLeft size={15}/> Volver
        </button>
      </div>
    </div>
  )
}
