import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { getAccountById } from '@/lib/accounts'
import type { Account } from '@/types'

const APPROVE_FUNCTION_URL =
  'https://vyqfnsnthhdglwngrraf.supabase.co/functions/v1/approve-account'

export function ApproveAccountPage() {
  const [searchParams] = useSearchParams()
  const accountId = searchParams.get('account_id')

  const [account, setAccount] = useState<Account | null>(null)
  const [loadingAccount, setLoadingAccount] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [approving, setApproving] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  useEffect(() => {
    if (!accountId) {
      setLoadingAccount(false)
      setNotFound(true)
      return
    }
    getAccountById(accountId)
      .then(acc => {
        if (!acc) setNotFound(true)
        else setAccount(acc)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoadingAccount(false))
  }, [accountId])

  async function handleApprove() {
    if (!accountId) return
    setApproving(true)
    try {
      const res = await fetch(APPROVE_FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: accountId }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setResult({ ok: true, message: data.message ?? 'Cuenta aprobada correctamente.' })
      } else {
        setResult({ ok: false, message: data.error ?? 'No se pudo aprobar la cuenta.' })
      }
    } catch {
      setResult({ ok: false, message: 'Error de conexión al intentar aprobar la cuenta.' })
    } finally {
      setApproving(false)
    }
  }

  return (
    <div className="min-h-screen bg-neutral2-900 flex items-center justify-center p-6">
      <div className="bg-neutral2-800 rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
        <img src="/logo-handplan.png" alt="HandPlan" className="h-14 mx-auto mb-6" />

        {loadingAccount && (
          <div className="flex flex-col items-center gap-3 text-white/60">
            <Loader2 className="animate-spin" size={28} />
            <p>Cargando solicitud...</p>
          </div>
        )}

        {!loadingAccount && notFound && (
          <div className="flex flex-col items-center gap-3 text-white">
            <XCircle size={36} className="text-red-400" />
            <p>No se encontró ninguna solicitud con ese ID.</p>
          </div>
        )}

        {!loadingAccount && account && !result && (
          <>
            <h2 className="text-xl font-semibold text-white mb-4">Nueva solicitud de cuenta</h2>
            <div className="text-left bg-neutral2-700 rounded-lg p-4 mb-6 space-y-1 text-sm text-white/80">
              <p><span className="text-white/50">Club:</span> {account.name}</p>
              <p><span className="text-white/50">Código de acceso:</span> {account.access_code}</p>
            </div>

            {account.status === 'active' ? (
              <p className="text-amber-300 text-sm">Esta cuenta ya estaba activa. No hace falta hacer nada.</p>
            ) : (
              <>
                <button
                  onClick={handleApprove}
                  disabled={approving}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-medium py-3 rounded-xl transition flex items-center justify-center gap-2"
                >
                  {approving ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                  {approving ? 'Aprobando...' : 'Aprobar definitivamente'}
                </button>
                <p className="text-white/40 text-xs mt-4">
                  Esta cuenta todavía no fue activada. No se hizo ningún cambio hasta que apretás el botón.
                </p>
              </>
            )}
          </>
        )}

        {result && (
          <div className="flex flex-col items-center gap-3">
            {result.ok ? (
              <CheckCircle2 size={36} className="text-emerald-400" />
            ) : (
              <XCircle size={36} className="text-red-400" />
            )}
            <p className="text-white">{result.message}</p>
          </div>
        )}
      </div>
    </div>
  )
}
