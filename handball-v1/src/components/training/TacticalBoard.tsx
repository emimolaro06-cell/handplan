import { useRef, useState, useEffect } from 'react'
import { RotateCcw, Trash2, Download, X, MousePointer, Minus } from 'lucide-react'
import { clsx } from '@/lib/utils'

type ToolType =
  | 'select' | 'player-own' | 'player-rival' | 'goalkeeper'
  | 'cone' | 'ball' | 'mannequin'
  | 'arrow-dash' | 'arrow-solid' | 'arrow-curve' | 'line' | 'eraser'

type CourtMode = 'full' | 'half-left' | 'half-right'

interface Pt { x: number; y: number }

interface Elem {
  id: string
  type: 'player-own' | 'player-rival' | 'goalkeeper' | 'cone' | 'ball' | 'mannequin'
  x: number; y: number; number?: number
}

interface Arrow {
  id: string
  type: 'arrow-dash' | 'arrow-solid' | 'arrow-curve' | 'line'
  x1: number; y1: number
  x2: number; y2: number
  cx?: number; cy?: number
  color: string
}

interface BoardState { elems: Elem[]; arrows: Arrow[] }

const W = 820
const H = 500

const COLORS = [
  { value: '#ffe600', label: 'Amarillo' },
  { value: '#ffffff', label: 'Blanco'   },
  { value: '#ef4444', label: 'Rojo'     },
  { value: '#3b82f6', label: 'Azul'     },
  { value: '#f97316', label: 'Naranja'  },
  { value: '#22c55e', label: 'Verde'    },
  { value: '#111111', label: 'Negro'    },
]

function uid() { return `${Date.now()}-${Math.random().toString(36).slice(2,6)}` }

export function TacticalBoard({ onSave, onClose }: {
  onSave: (url: string) => void
  onClose: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [tool, setTool]           = useState<ToolType>('select')
  const [courtMode, setCourtMode] = useState<CourtMode>('full')
  const [color, setColor]         = useState('#ffe600')
  const [state, setState]         = useState<BoardState>({ elems: [], arrows: [] })
  const [history, setHistory]     = useState<BoardState[]>([{ elems: [], arrows: [] }])
  const [histIdx, setHistIdx]     = useState(0)
  const [counts, setCounts]       = useState({ own: 1, rival: 1, gk: 1 })
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const mouseState = useRef<{
    mode: 'idle' | 'dragging-elem' | 'drawing-arrow' | 'dragging-control'
    elemId?: string
    arrowId?: string
    offX?: number; offY?: number
    arrowStart?: Pt
  }>({ mode: 'idle' })

  useEffect(() => { drawAll(state) }, [state, selectedId, courtMode])

  function getPos(e: React.MouseEvent<HTMLCanvasElement>): Pt {
    const r = canvasRef.current!.getBoundingClientRect()
    return {
      x: (e.clientX - r.left) * (W / r.width),
      y: (e.clientY - r.top)  * (H / r.height),
    }
  }

  function findElem(p: Pt, s: BoardState): Elem | null {
    return [...s.elems].reverse().find(el => Math.hypot(el.x-p.x, el.y-p.y) < 24) ?? null
  }

  // Buscar si el punto está cerca del control point de una curva
  function findCurveControl(p: Pt, s: BoardState): Arrow | null {
    return s.arrows.find(a =>
      a.type === 'arrow-curve' && a.cx !== undefined && a.cy !== undefined &&
      Math.hypot(a.cx-p.x, a.cy-p.y) < 18
    ) ?? null
  }

  // ─── Dibujo ────────────────────────────────────────────────────────────────
  function drawAll(s: BoardState, preview?: { type: ToolType; x1:number;y1:number;x2:number;y2:number; color:string }) {
    const cv = canvasRef.current; if (!cv) return
    const ctx = cv.getContext('2d')!
    ctx.clearRect(0, 0, W, H)
    drawCourt(ctx, courtMode)
    s.arrows.forEach(a => drawArrow(ctx, a))
    // Mostrar puntos de control de curvas cuando tool=select
    if (tool === 'select') {
      s.arrows.filter(a => a.type === 'arrow-curve').forEach(a => {
        if (a.cx !== undefined && a.cy !== undefined) drawControlPoint(ctx, a)
      })
    }
    if (preview) drawPreview(ctx, preview)
    s.elems.forEach(el => drawElem(ctx, el, el.id === selectedId))
  }

  function drawCourt(ctx: CanvasRenderingContext2D, mode: CourtMode) {
    const fullW = mode === 'full' ? W : W
    const startX = mode === 'half-right' ? W/2 : 0
    const endX   = mode === 'half-left'  ? W/2 : W

    ctx.fillStyle = '#2d7a2d'
    ctx.fillRect(0, 0, W, H)

    // Si es mitad, oscurecer la parte que no se usa
    if (mode === 'half-left') {
      ctx.fillStyle = 'rgba(0,0,0,0.45)'
      ctx.fillRect(W/2, 0, W/2, H)
    } else if (mode === 'half-right') {
      ctx.fillStyle = 'rgba(0,0,0,0.45)'
      ctx.fillRect(0, 0, W/2, H)
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.9)'
    ctx.lineWidth = 2

    ctx.strokeRect(16, 16, W-32, H-32)
    // Línea central
    ctx.beginPath(); ctx.moveTo(W/2, 16); ctx.lineTo(W/2, H-16); ctx.stroke()

    const gY = H/2
    // Área 6m
    ctx.beginPath(); ctx.arc(16, gY, 150, -1.15, 1.15); ctx.stroke()
    ctx.beginPath(); ctx.arc(W-16, gY, 150, Math.PI-1.15, Math.PI+1.15); ctx.stroke()
    // 9m punteada
    ctx.setLineDash([8,6])
    ctx.beginPath(); ctx.arc(16, gY, 210, -1.0, 1.0); ctx.stroke()
    ctx.beginPath(); ctx.arc(W-16, gY, 210, Math.PI-1.0, Math.PI+1.0); ctx.stroke()
    ctx.setLineDash([])
    // Porterías
    const gH = 80, gTop = gY-gH/2
    ctx.lineWidth = 4
    ctx.strokeRect(0, gTop, 14, gH)
    ctx.strokeRect(W-14, gTop, 14, gH)
    ctx.lineWidth = 2
  }

  function drawArrow(ctx: CanvasRenderingContext2D, a: Arrow) {
    ctx.save()
    ctx.strokeStyle = a.color
    ctx.fillStyle   = a.color
    ctx.lineWidth   = 2.8
    if (a.type === 'arrow-dash') ctx.setLineDash([9,6])
    else ctx.setLineDash([])

    ctx.beginPath()
    if (a.type === 'arrow-curve' && a.cx !== undefined && a.cy !== undefined) {
      ctx.moveTo(a.x1, a.y1)
      ctx.quadraticCurveTo(a.cx, a.cy, a.x2, a.y2)
    } else {
      ctx.moveTo(a.x1, a.y1); ctx.lineTo(a.x2, a.y2)
    }
    ctx.stroke()
    ctx.setLineDash([])

    if (a.type !== 'line') {
      const angle = a.type === 'arrow-curve' && a.cx !== undefined && a.cy !== undefined
        ? Math.atan2(a.y2 - a.cy, a.x2 - a.cx)
        : Math.atan2(a.y2 - a.y1, a.x2 - a.x1)
      const sz = 13
      ctx.beginPath()
      ctx.moveTo(a.x2, a.y2)
      ctx.lineTo(a.x2 - sz*Math.cos(angle-0.5), a.y2 - sz*Math.sin(angle-0.5))
      ctx.lineTo(a.x2 - sz*Math.cos(angle+0.5), a.y2 - sz*Math.sin(angle+0.5))
      ctx.closePath(); ctx.fill()
    }
    ctx.restore()
  }

  function drawControlPoint(ctx: CanvasRenderingContext2D, a: Arrow) {
    if (a.cx === undefined || a.cy === undefined) return
    ctx.save()
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'
    ctx.setLineDash([4,3])
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(a.x1,a.y1); ctx.lineTo(a.cx,a.cy); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(a.x2,a.y2); ctx.lineTo(a.cx,a.cy); ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = 'white'
    ctx.strokeStyle = a.color
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(a.cx, a.cy, 7, 0, Math.PI*2); ctx.fill(); ctx.stroke()
    ctx.restore()
  }

  function drawPreview(ctx: CanvasRenderingContext2D, p: { type: ToolType; x1:number;y1:number;x2:number;y2:number; color:string }) {
    ctx.save()
    ctx.strokeStyle = p.color
    ctx.globalAlpha = 0.5
    ctx.lineWidth = 2
    if (p.type === 'arrow-dash') ctx.setLineDash([9,6])
    ctx.beginPath(); ctx.moveTo(p.x1,p.y1); ctx.lineTo(p.x2,p.y2); ctx.stroke()
    ctx.setLineDash([])
    ctx.restore()
  }

  function drawElem(ctx: CanvasRenderingContext2D, el: Elem, sel: boolean) {
    if (sel) { ctx.shadowColor='white'; ctx.shadowBlur=14 }
    switch (el.type) {
      case 'player-own':   drawCircle(ctx, el, '#d32f2f'); break
      case 'player-rival': drawCircle(ctx, el, '#1565c0'); break
      case 'goalkeeper':   drawCircle(ctx, el, '#f9a825'); break
      case 'cone':         drawCone(ctx, el); break
      case 'ball':         drawBall(ctx, el); break
      case 'mannequin':    drawMannequin(ctx, el); break
    }
    ctx.shadowBlur = 0
  }

  function drawCircle(ctx: CanvasRenderingContext2D, el: Elem, c: string) {
    ctx.fillStyle=c; ctx.beginPath(); ctx.arc(el.x,el.y,19,0,Math.PI*2); ctx.fill()
    ctx.strokeStyle='white'; ctx.lineWidth=2; ctx.stroke()
    ctx.fillStyle='white'; ctx.font='bold 13px Arial'
    ctx.textAlign='center'; ctx.textBaseline='middle'
    ctx.fillText(String(el.number??''), el.x, el.y)
  }

  function drawCone(ctx: CanvasRenderingContext2D, el: Elem) {
    ctx.fillStyle='#ff6600'
    ctx.beginPath(); ctx.moveTo(el.x,el.y-15); ctx.lineTo(el.x-11,el.y+10); ctx.lineTo(el.x+11,el.y+10)
    ctx.closePath(); ctx.fill(); ctx.strokeStyle='white'; ctx.lineWidth=1.5; ctx.stroke()
  }

  function drawBall(ctx: CanvasRenderingContext2D, el: Elem) {
    ctx.fillStyle='#f5f5f5'; ctx.beginPath(); ctx.arc(el.x,el.y,11,0,Math.PI*2); ctx.fill()
    ctx.strokeStyle='#444'; ctx.lineWidth=1.5; ctx.stroke()
    ctx.strokeStyle='#999'; ctx.lineWidth=1
    ctx.beginPath(); ctx.moveTo(el.x-11,el.y); ctx.lineTo(el.x+11,el.y)
    ctx.moveTo(el.x,el.y-11); ctx.lineTo(el.x,el.y+11); ctx.stroke()
  }

  function drawMannequin(ctx: CanvasRenderingContext2D, el: Elem) {
    const {x,y}=el
    ctx.strokeStyle='#ff9800'; ctx.fillStyle='#ff9800'; ctx.lineWidth=2.5
    ctx.beginPath(); ctx.arc(x,y-16,7,0,Math.PI*2); ctx.fill()
    ctx.beginPath(); ctx.moveTo(x,y-9); ctx.lineTo(x,y+9); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(x-11,y-1); ctx.lineTo(x+11,y-1); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(x,y+9); ctx.lineTo(x-9,y+22); ctx.moveTo(x,y+9); ctx.lineTo(x+9,y+22); ctx.stroke()
  }

  // ─── Eventos ─────────────────────────────────────────────────────────────
  function onMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const p = getPos(e)
    const ms = mouseState.current

    if (tool === 'eraser') {
      const el = findElem(p, state)
      if (el) { commit({ ...state, elems: state.elems.filter(x => x.id!==el.id) }); return }
      let minD=35, target: string|null=null
      state.arrows.forEach(a => {
        const d = Math.hypot((a.x1+a.x2)/2-p.x, (a.y1+a.y2)/2-p.y)
        if (d<minD) { minD=d; target=a.id }
      })
      if (target) commit({ ...state, arrows: state.arrows.filter(a=>a.id!==target) })
      return
    }

    if (tool === 'select') {
      // Primero verificar si clickea un punto de control de curva
      const curve = findCurveControl(p, state)
      if (curve) {
        ms.mode = 'dragging-control'
        ms.arrowId = curve.id
        return
      }
      const el = findElem(p, state)
      if (el) {
        setSelectedId(el.id)
        ms.mode = 'dragging-elem'
        ms.elemId = el.id
        ms.offX = p.x - el.x
        ms.offY = p.y - el.y
      } else {
        setSelectedId(null)
      }
      return
    }

    if (['arrow-dash','arrow-solid','arrow-curve','line'].includes(tool)) {
      ms.mode = 'drawing-arrow'
      ms.arrowStart = p
      return
    }

    // Colocar elemento
    const type = tool as Elem['type']
    let number: number|undefined
    const nc = {...counts}
    if (tool==='player-own')   { number=nc.own++;   setCounts({...nc}) }
    if (tool==='player-rival') { number=nc.rival++;  setCounts({...nc}) }
    if (tool==='goalkeeper')   { number=nc.gk++;     setCounts({...nc}) }
    commit({ ...state, elems: [...state.elems, { id:uid(), type, x:p.x, y:p.y, number }] })
  }

  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const p = getPos(e)
    const ms = mouseState.current

    if (ms.mode === 'dragging-elem' && ms.elemId) {
      setState(prev => ({
        ...prev,
        elems: prev.elems.map(el =>
          el.id === ms.elemId ? { ...el, x: p.x-(ms.offX??0), y: p.y-(ms.offY??0) } : el
        )
      }))
      return
    }

    if (ms.mode === 'dragging-control' && ms.arrowId) {
      setState(prev => ({
        ...prev,
        arrows: prev.arrows.map(a =>
          a.id === ms.arrowId ? { ...a, cx: p.x, cy: p.y } : a
        )
      }))
      return
    }

    if (ms.mode === 'drawing-arrow' && ms.arrowStart) {
      drawAll(state, { type: tool, x1:ms.arrowStart.x, y1:ms.arrowStart.y, x2:p.x, y2:p.y, color })
    }
  }

  function onMouseUp(e: React.MouseEvent<HTMLCanvasElement>) {
    const p = getPos(e)
    const ms = mouseState.current

    if (ms.mode === 'dragging-elem' || ms.mode === 'dragging-control') {
      ms.mode = 'idle'
      commit(state)
      return
    }

    if (ms.mode === 'drawing-arrow' && ms.arrowStart) {
      if (Math.hypot(p.x-ms.arrowStart.x, p.y-ms.arrowStart.y) > 20) {
        const arrow: Arrow = {
          id: uid(),
          type: tool as Arrow['type'],
          x1: ms.arrowStart.x, y1: ms.arrowStart.y,
          x2: p.x, y2: p.y,
          color,
          cx: tool==='arrow-curve' ? (ms.arrowStart.x+p.x)/2 : undefined,
          cy: tool==='arrow-curve' ? Math.min(ms.arrowStart.y,p.y)-70 : undefined,
        }
        commit({ ...state, arrows: [...state.arrows, arrow] })
      }
      ms.mode = 'idle'
      ms.arrowStart = undefined
    }
  }

  function commit(ns: BoardState) {
    const nh = history.slice(0, histIdx+1)
    nh.push(ns)
    setHistory(nh)
    setHistIdx(nh.length-1)
    setState(ns)
  }

  function undo() {
    if (histIdx > 0) { setHistIdx(histIdx-1); setState(history[histIdx-1]) }
  }

  function clear() {
    commit({ elems:[], arrows:[] })
    setCounts({ own:1, rival:1, gk:1 })
    setSelectedId(null)
  }

  const TOOLS: { id: ToolType; label: string; el: React.ReactNode }[] = [
    { id:'select',       label:'Mover / Editar',    el:<MousePointer size={14}/> },
    { id:'player-own',   label:'Jugador propio',    el:<span className="w-4 h-4 rounded-full bg-red-600 border border-white inline-block"/> },
    { id:'player-rival', label:'Jugador rival',     el:<span className="w-4 h-4 rounded-full bg-blue-600 border border-white inline-block"/> },
    { id:'goalkeeper',   label:'Portero',           el:<span className="w-4 h-4 rounded-full bg-yellow-400 border border-white inline-block"/> },
    { id:'mannequin',    label:'Muñeco',            el:<span className="text-base leading-none">🚶</span> },
    { id:'cone',         label:'Cono',              el:<span className="text-orange-500 font-bold text-sm">▲</span> },
    { id:'ball',         label:'Pelota',            el:<span className="text-gray-200 font-bold text-sm">●</span> },
    { id:'arrow-solid',  label:'Trayectoria ——▶',  el:<span className="text-yellow-400 text-xs font-bold">——▶</span> },
    { id:'arrow-dash',   label:'Pase/Lanz. - -▶',  el:<span className="text-yellow-400 text-xs font-bold">- -▶</span> },
    { id:'arrow-curve',  label:'Curva libre ∿▶',   el:<span className="text-yellow-400 text-xs font-bold">∿▶</span> },
    { id:'line',         label:'Línea separadora',  el:<Minus size={14} className="text-white/70"/> },
    { id:'eraser',       label:'Borrar',            el:<Trash2 size={14}/> },
  ]

  const cursor = tool==='select' ? 'default'
    : ['arrow-dash','arrow-solid','arrow-curve','line'].includes(tool) ? 'crosshair'
    : tool==='eraser' ? 'crosshair' : 'copy'

  return (
    <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-3">
      <div className="bg-gray-900 rounded-2xl shadow-2xl flex flex-col w-full" style={{ maxWidth: 1060 }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h2 className="text-white font-bold text-sm">🏐 Pizarra táctica</h2>
          <div className="flex gap-2 items-center flex-wrap">
            {/* Selector cancha */}
            <div className="flex gap-1 bg-white/10 rounded-xl p-1">
              {([
                { id:'full',       label:'Cancha completa' },
                { id:'half-left',  label:'Mitad izq.' },
                { id:'half-right', label:'Mitad der.' },
              ] as { id: CourtMode; label: string }[]).map(m => (
                <button key={m.id} onClick={() => setCourtMode(m.id)}
                  className={clsx('text-xs px-2.5 py-1.5 rounded-lg transition-colors',
                    courtMode===m.id ? 'bg-dj-600 text-white font-semibold' : 'text-white/60 hover:text-white'
                  )}>
                  {m.label}
                </button>
              ))}
            </div>

            <button onClick={undo} disabled={histIdx===0}
              className="text-white/50 hover:text-white disabled:opacity-20 p-1.5 rounded-lg hover:bg-white/10">
              <RotateCcw size={16}/>
            </button>
            <button onClick={clear}
              className="text-white/50 hover:text-red-400 p-1.5 rounded-lg hover:bg-white/10">
              <Trash2 size={16}/>
            </button>
            <button onClick={() => onSave(canvasRef.current!.toDataURL('image/png'))}
              className="bg-dj-600 hover:bg-dj-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5">
              <Download size={14}/> Guardar
            </button>
            <button onClick={onClose} className="text-white/50 hover:text-white p-1.5 rounded-lg hover:bg-white/10">
              <X size={18}/>
            </button>
          </div>
        </div>

        <div className="flex">
          {/* Herramientas */}
          <div className="flex flex-col gap-0.5 p-2 border-r border-white/10 w-40 flex-shrink-0 overflow-y-auto">

            {/* Selector de color */}
            <div className="px-2 pb-2 border-b border-white/10 mb-1">
              <p className="text-white/40 text-xs mb-1.5 uppercase tracking-wide">Color</p>
              <div className="flex flex-wrap gap-1.5">
                {COLORS.map(c => (
                  <button
                    key={c.value}
                    onClick={() => setColor(c.value)}
                    title={c.label}
                    className={clsx(
                      'w-6 h-6 rounded-full border-2 transition-transform',
                      color===c.value ? 'border-white scale-125' : 'border-transparent hover:scale-110'
                    )}
                    style={{ backgroundColor: c.value }}
                  />
                ))}
              </div>
            </div>

            {TOOLS.map(t => (
              <button key={t.id} onClick={() => setTool(t.id)}
                className={clsx(
                  'flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs transition-all text-left',
                  tool===t.id ? 'bg-dj-600 text-white font-semibold' : 'text-white/60 hover:text-white hover:bg-white/10'
                )}>
                <span className="w-5 flex items-center justify-center flex-shrink-0">{t.el}</span>
                <span className="leading-tight">{t.label}</span>
              </button>
            ))}
          </div>

          {/* Canvas */}
          <div className="flex-1 p-3 flex items-center justify-center">
            <canvas
              ref={canvasRef}
              width={W} height={H}
              className="rounded-xl w-full"
              style={{ cursor, maxHeight: '72vh' }}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
            />
          </div>
        </div>

        <div className="px-4 py-2 border-t border-white/10 text-xs text-white/25 text-center">
          Seleccionar → mover elementos y arrastrar punto blanco para editar curvas · Arrastrá para dibujar flechas
        </div>
      </div>
    </div>
  )
}
