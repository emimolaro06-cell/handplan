import { useRef, useState, useEffect, useCallback } from 'react'
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

// ─── Canvas helpers ────────────────────────────────────────────────────────
function drawCourtFn(ctx: CanvasRenderingContext2D, mode: CourtMode) {
  ctx.fillStyle = '#2d7a2d'
  ctx.fillRect(0, 0, W, H)

  if (mode === 'half-left') {
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(W/2, 0, W/2, H)
  } else if (mode === 'half-right') {
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, W/2, H)
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2
  ctx.strokeRect(16, 16, W-32, H-32)
  ctx.beginPath(); ctx.moveTo(W/2,16); ctx.lineTo(W/2,H-16); ctx.stroke()

  const gY = H/2
  ctx.beginPath(); ctx.arc(16, gY, 150, -1.15, 1.15); ctx.stroke()
  ctx.beginPath(); ctx.arc(W-16, gY, 150, Math.PI-1.15, Math.PI+1.15); ctx.stroke()
  ctx.setLineDash([8,6])
  ctx.beginPath(); ctx.arc(16, gY, 210, -1.0, 1.0); ctx.stroke()
  ctx.beginPath(); ctx.arc(W-16, gY, 210, Math.PI-1.0, Math.PI+1.0); ctx.stroke()
  ctx.setLineDash([])
  const gH=80, gTop=gY-gH/2
  ctx.lineWidth=4
  ctx.strokeRect(0, gTop, 14, gH)
  ctx.strokeRect(W-14, gTop, 14, gH)
  ctx.lineWidth=2
}

function drawArrowFn(ctx: CanvasRenderingContext2D, a: Arrow, alpha = 1) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.strokeStyle = a.color; ctx.fillStyle = a.color; ctx.lineWidth = 2.8
  if (a.type === 'arrow-dash') ctx.setLineDash([9,6])
  else ctx.setLineDash([])

  ctx.beginPath()
  if (a.type === 'arrow-curve' && a.cx !== undefined && a.cy !== undefined) {
    ctx.moveTo(a.x1, a.y1)
    ctx.quadraticCurveTo(a.cx, a.cy, a.x2, a.y2)
  } else {
    ctx.moveTo(a.x1, a.y1); ctx.lineTo(a.x2, a.y2)
  }
  ctx.stroke(); ctx.setLineDash([])

  if (a.type !== 'line') {
    const angle = (a.type === 'arrow-curve' && a.cx !== undefined && a.cy !== undefined)
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

function drawControlFn(ctx: CanvasRenderingContext2D, a: Arrow) {
  if (a.cx === undefined || a.cy === undefined) return
  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.setLineDash([4,3]); ctx.lineWidth=1
  ctx.beginPath(); ctx.moveTo(a.x1,a.y1); ctx.lineTo(a.cx,a.cy); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(a.x2,a.y2); ctx.lineTo(a.cx,a.cy); ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle='white'; ctx.strokeStyle=a.color; ctx.lineWidth=2
  ctx.beginPath(); ctx.arc(a.cx,a.cy,8,0,Math.PI*2); ctx.fill(); ctx.stroke()
  ctx.restore()
}

function drawElemFn(ctx: CanvasRenderingContext2D, el: Elem, sel: boolean) {
  if (sel) { ctx.shadowColor='white'; ctx.shadowBlur=14 }
  const {x,y} = el
  switch(el.type) {
    case 'player-own':
      ctx.fillStyle='#d32f2f'; ctx.beginPath(); ctx.arc(x,y,19,0,Math.PI*2); ctx.fill()
      ctx.strokeStyle='white'; ctx.lineWidth=2; ctx.stroke()
      ctx.fillStyle='white'; ctx.font='bold 13px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle'
      ctx.fillText(String(el.number??''),x,y); break
    case 'player-rival':
      ctx.fillStyle='#1565c0'; ctx.beginPath(); ctx.arc(x,y,19,0,Math.PI*2); ctx.fill()
      ctx.strokeStyle='white'; ctx.lineWidth=2; ctx.stroke()
      ctx.fillStyle='white'; ctx.font='bold 13px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle'
      ctx.fillText(String(el.number??''),x,y); break
    case 'goalkeeper':
      ctx.fillStyle='#f9a825'; ctx.beginPath(); ctx.arc(x,y,19,0,Math.PI*2); ctx.fill()
      ctx.strokeStyle='white'; ctx.lineWidth=2; ctx.stroke()
      ctx.fillStyle='white'; ctx.font='bold 13px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle'
      ctx.fillText(String(el.number??''),x,y); break
    case 'cone':
      ctx.fillStyle='#ff6600'
      ctx.beginPath(); ctx.moveTo(x,y-15); ctx.lineTo(x-11,y+10); ctx.lineTo(x+11,y+10)
      ctx.closePath(); ctx.fill(); ctx.strokeStyle='white'; ctx.lineWidth=1.5; ctx.stroke(); break
    case 'ball':
      ctx.fillStyle='#f5f5f5'; ctx.beginPath(); ctx.arc(x,y,11,0,Math.PI*2); ctx.fill()
      ctx.strokeStyle='#444'; ctx.lineWidth=1.5; ctx.stroke()
      ctx.strokeStyle='#999'; ctx.lineWidth=1
      ctx.beginPath(); ctx.moveTo(x-11,y); ctx.lineTo(x+11,y); ctx.moveTo(x,y-11); ctx.lineTo(x,y+11); ctx.stroke(); break
    case 'mannequin':
      ctx.strokeStyle='#ff9800'; ctx.fillStyle='#ff9800'; ctx.lineWidth=2.5
      ctx.beginPath(); ctx.arc(x,y-16,7,0,Math.PI*2); ctx.fill()
      ctx.beginPath(); ctx.moveTo(x,y-9); ctx.lineTo(x,y+9); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(x-11,y-1); ctx.lineTo(x+11,y-1); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(x,y+9); ctx.lineTo(x-9,y+22); ctx.moveTo(x,y+9); ctx.lineTo(x+9,y+22); ctx.stroke(); break
  }
  ctx.shadowBlur=0
}

// ─── Componente ──────────────────────────────────────────────────────────────
export function TacticalBoard({ onSave, onClose }: {
  onSave: (url: string) => void
  onClose: () => void
}) {
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const stateRef    = useRef<BoardState>({ elems: [], arrows: [] })
  const toolRef     = useRef<ToolType>('select')
  const colorRef    = useRef('#ffe600')
  const courtRef    = useRef<CourtMode>('full')
  const selectedRef = useRef<string | null>(null)
  const showCtrlRef = useRef(false)

  const [tool, setToolState]         = useState<ToolType>('select')
  const [color, setColorState]       = useState('#ffe600')
  const [courtMode, setCourtState]   = useState<CourtMode>('full')
  const [, forceUpdate]              = useState(0)
  const [history, setHistory]        = useState<BoardState[]>([{ elems:[], arrows:[] }])
  const [histIdx, setHistIdx]        = useState(0)
  const [counts, setCounts]          = useState({ own:1, rival:1, gk:1 })

  // Sincronizar refs con state
  function setTool(t: ToolType) { toolRef.current=t; setToolState(t) }
  function setColor(c: string)  { colorRef.current=c; setColorState(c) }
  function setCourt(m: CourtMode) { courtRef.current=m; setCourtState(m); redraw() }

  const dragRef = useRef<{
    mode: 'none' | 'elem' | 'control' | 'arrow' | 'arrow-start' | 'arrow-end' | 'arrow-move'
    id?: string
    offX?: number; offY?: number
    startPt?: Pt
    currentPt?: Pt
  }>({ mode: 'none' })

  function redraw(s?: BoardState) {
    const cv = canvasRef.current; if (!cv) return
    const ctx = cv.getContext('2d')!
    const bs = s ?? stateRef.current
    ctx.clearRect(0,0,W,H)
    drawCourtFn(ctx, courtRef.current)
    bs.arrows.forEach(a => drawArrowFn(ctx, a))
    if (showCtrlRef.current) {
      bs.arrows.forEach(a => {
        // Punto inicio (cuadrado blanco)
        ctx.fillStyle='white'; ctx.strokeStyle='rgba(255,255,255,0.5)'; ctx.lineWidth=1.5
        ctx.fillRect(a.x1-6, a.y1-6, 12, 12)
        ctx.strokeRect(a.x1-6, a.y1-6, 12, 12)
        // Punto fin (cuadrado blanco)
        ctx.fillRect(a.x2-6, a.y2-6, 12, 12)
        ctx.strokeRect(a.x2-6, a.y2-6, 12, 12)
        // Control point curva
        if (a.type==='arrow-curve') drawControlFn(ctx, a)
      })
    }
    bs.elems.forEach(el => drawElemFn(ctx, el, el.id===selectedRef.current))
  }

  useEffect(() => { redraw() }, [])

  function getPos(e: React.MouseEvent<HTMLCanvasElement>): Pt {
    const r = canvasRef.current!.getBoundingClientRect()
    return {
      x: (e.clientX-r.left)*(W/r.width),
      y: (e.clientY-r.top)*(H/r.height),
    }
  }

  function findElem(p: Pt): Elem | null {
    return [...stateRef.current.elems].reverse().find(el => Math.hypot(el.x-p.x,el.y-p.y)<24) ?? null
  }

  function findCurveCtrl(p: Pt): Arrow | null {
    return stateRef.current.arrows.find(a =>
      a.type==='arrow-curve' && a.cx!==undefined && a.cy!==undefined &&
      Math.hypot(a.cx-p.x, a.cy-p.y)<18
    ) ?? null
  }

  // Buscar si el punto está cerca del inicio de una flecha
  function findArrowStart(p: Pt): Arrow | null {
    return [...stateRef.current.arrows].reverse().find(a =>
      Math.hypot(a.x1-p.x, a.y1-p.y)<14
    ) ?? null
  }

  // Buscar si el punto está cerca del final de una flecha
  function findArrowEnd(p: Pt): Arrow | null {
    return [...stateRef.current.arrows].reverse().find(a =>
      Math.hypot(a.x2-p.x, a.y2-p.y)<14
    ) ?? null
  }

  // Buscar si el punto está sobre el cuerpo de una flecha (para moverla)
  function findArrowBody(p: Pt): Arrow | null {
    return [...stateRef.current.arrows].reverse().find(a => {
      const mx = (a.x1+a.x2)/2, my = (a.y1+a.y2)/2
      return Math.hypot(mx-p.x, my-p.y) < 22
    }) ?? null
  }

  function commitState(ns: BoardState) {
    stateRef.current = ns
    setHistory(h => {
      const nh = h.slice(0, histIdx+1)
      nh.push({...ns, elems:[...ns.elems], arrows:[...ns.arrows]})
      setHistIdx(nh.length-1)
      return nh
    })
    redraw(ns)
    forceUpdate(n=>n+1)
  }

  function onMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    e.preventDefault()
    const p = getPos(e)
    const t = toolRef.current
    const d = dragRef.current

    if (t === 'eraser') {
      const el = findElem(p)
      if (el) {
        const ns = { ...stateRef.current, elems: stateRef.current.elems.filter(x=>x.id!==el.id) }
        commitState(ns); return
      }
      let minD=40, target: string|null=null
      stateRef.current.arrows.forEach(a => {
        const mx=(a.x1+a.x2)/2, my=(a.y1+a.y2)/2
        const dd = Math.hypot(mx-p.x, my-p.y)
        if (dd<minD) { minD=dd; target=a.id }
      })
      if (target) commitState({ ...stateRef.current, arrows: stateRef.current.arrows.filter(a=>a.id!==target) })
      return
    }

    if (t === 'select') {
      // 1. Control point de curva
      const curve = findCurveCtrl(p)
      if (curve) { d.mode='control'; d.id=curve.id; return }
      // 2. Extremo final de flecha (mover punta)
      const arrowEnd = findArrowEnd(p)
      if (arrowEnd) { d.mode='arrow-end'; d.id=arrowEnd.id; return }
      // 3. Extremo inicio de flecha (mover cola)
      const arrowStart = findArrowStart(p)
      if (arrowStart) { d.mode='arrow-start'; d.id=arrowStart.id; return }
      // 4. Cuerpo de flecha (mover toda)
      const arrowBody = findArrowBody(p)
      if (arrowBody) {
        d.mode='arrow-move'; d.id=arrowBody.id
        d.offX=p.x-(arrowBody.x1+arrowBody.x2)/2
        d.offY=p.y-(arrowBody.y1+arrowBody.y2)/2
        return
      }
      // 5. Elemento
      const el = findElem(p)
      if (el) {
        selectedRef.current = el.id
        d.mode='elem'; d.id=el.id; d.offX=p.x-el.x; d.offY=p.y-el.y
        redraw(); return
      }
      selectedRef.current = null; redraw(); return
    }

    if (['arrow-dash','arrow-solid','arrow-curve','line'].includes(t)) {
      d.mode='arrow'; d.startPt=p; d.currentPt=p; return
    }

    // Colocar elemento
    const type = t as Elem['type']
    let number: number|undefined
    const nc = {...counts}
    if (t==='player-own')   { number=nc.own++;   setCounts({...nc}) }
    if (t==='player-rival') { number=nc.rival++;  setCounts({...nc}) }
    if (t==='goalkeeper')   { number=nc.gk++;     setCounts({...nc}) }
    const ns = { ...stateRef.current, elems: [...stateRef.current.elems, { id:uid(), type, x:p.x, y:p.y, number }] }
    commitState(ns)
  }

  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    e.preventDefault()
    const p = getPos(e)
    const d = dragRef.current

    if (d.mode === 'elem' && d.id) {
      const ns = {
        ...stateRef.current,
        elems: stateRef.current.elems.map(el =>
          el.id===d.id ? { ...el, x: p.x-(d.offX??0), y: p.y-(d.offY??0) } : el
        )
      }
      stateRef.current = ns
      redraw(ns); return
    }

    if (d.mode === 'control' && d.id) {
      const ns = {
        ...stateRef.current,
        arrows: stateRef.current.arrows.map(a =>
          a.id===d.id ? { ...a, cx:p.x, cy:p.y } : a
        )
      }
      stateRef.current = ns; redraw(ns); return
    }

    if (d.mode === 'arrow-end' && d.id) {
      const ns = {
        ...stateRef.current,
        arrows: stateRef.current.arrows.map(a =>
          a.id===d.id ? { ...a, x2:p.x, y2:p.y,
            cx: a.type==='arrow-curve' ? (a.x1+p.x)/2 : a.cx,
            cy: a.type==='arrow-curve' ? Math.min(a.y1,p.y)-70 : a.cy,
          } : a
        )
      }
      stateRef.current = ns; redraw(ns); return
    }

    if (d.mode === 'arrow-start' && d.id) {
      const ns = {
        ...stateRef.current,
        arrows: stateRef.current.arrows.map(a =>
          a.id===d.id ? { ...a, x1:p.x, y1:p.y,
            cx: a.type==='arrow-curve' ? (p.x+a.x2)/2 : a.cx,
            cy: a.type==='arrow-curve' ? Math.min(p.y,a.y2)-70 : a.cy,
          } : a
        )
      }
      stateRef.current = ns; redraw(ns); return
    }

    if (d.mode === 'arrow-move' && d.id) {
      const arrow = stateRef.current.arrows.find(a => a.id===d.id)
      if (!arrow) return
      const dx = p.x-(d.offX??0)-(arrow.x1+arrow.x2)/2
      const dy = p.y-(d.offY??0)-(arrow.y1+arrow.y2)/2
      const ns = {
        ...stateRef.current,
        arrows: stateRef.current.arrows.map(a =>
          a.id===d.id ? {
            ...a,
            x1: a.x1+dx, y1: a.y1+dy,
            x2: a.x2+dx, y2: a.y2+dy,
            cx: a.cx !== undefined ? a.cx+dx : undefined,
            cy: a.cy !== undefined ? a.cy+dy : undefined,
          } : a
        )
      }
      // Actualizar offX/Y para el siguiente frame
      d.offX = p.x - (ns.arrows.find(a=>a.id===d.id)!.x1 + ns.arrows.find(a=>a.id===d.id)!.x2)/2
      d.offY = p.y - (ns.arrows.find(a=>a.id===d.id)!.y1 + ns.arrows.find(a=>a.id===d.id)!.y2)/2
      stateRef.current = ns; redraw(ns); return
    }

    if (d.mode === 'arrow' && d.startPt) {
      d.currentPt = p
      // Preview: redibujar con flecha temporal
      const cv = canvasRef.current; if (!cv) return
      const ctx = cv.getContext('2d')!
      ctx.clearRect(0,0,W,H)
      drawCourtFn(ctx, courtRef.current)
      stateRef.current.arrows.forEach(a => drawArrowFn(ctx, a))
      stateRef.current.elems.forEach(el => drawElemFn(ctx, el, false))

      // Dibujar preview de la flecha
      const t = toolRef.current
      const preview: Arrow = {
        id: 'preview', type: t as Arrow['type'],
        x1: d.startPt.x, y1: d.startPt.y,
        x2: p.x, y2: p.y,
        color: colorRef.current,
        cx: t==='arrow-curve' ? (d.startPt.x+p.x)/2 : undefined,
        cy: t==='arrow-curve' ? Math.min(d.startPt.y,p.y)-70 : undefined,
      }
      drawArrowFn(ctx, preview, 0.7)
    }
  }

  function onMouseUp(e: React.MouseEvent<HTMLCanvasElement>) {
    e.preventDefault()
    const p = getPos(e)
    const d = dragRef.current

    if (['elem','control','arrow-start','arrow-end','arrow-move'].includes(d.mode)) {
      d.mode='none'; commitState(stateRef.current); return
    }

    if (d.mode === 'arrow' && d.startPt) {
      const dist = Math.hypot(p.x-d.startPt.x, p.y-d.startPt.y)
      if (dist > 15) {
        const t = toolRef.current
        const arrow: Arrow = {
          id: uid(), type: t as Arrow['type'],
          x1: d.startPt.x, y1: d.startPt.y,
          x2: p.x, y2: p.y,
          color: colorRef.current,
          cx: t==='arrow-curve' ? (d.startPt.x+p.x)/2 : undefined,
          cy: t==='arrow-curve' ? Math.min(d.startPt.y,p.y)-70 : undefined,
        }
        commitState({ ...stateRef.current, arrows: [...stateRef.current.arrows, arrow] })
      } else {
        redraw()
      }
      d.mode='none'; d.startPt=undefined; d.currentPt=undefined
    }
  }

  function undo() {
    if (histIdx > 0) {
      const ni = histIdx-1
      setHistIdx(ni)
      stateRef.current = history[ni]
      redraw(history[ni])
    }
  }

  function clear() {
    const ns = { elems:[], arrows:[] }
    stateRef.current = ns
    selectedRef.current = null
    commitState(ns)
    setCounts({ own:1, rival:1, gk:1 })
  }

  function toggleShowCtrl() {
    showCtrlRef.current = !showCtrlRef.current
    redraw()
    forceUpdate(n=>n+1)
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
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-wrap gap-2">
          <h2 className="text-white font-bold text-sm">🏐 Pizarra táctica</h2>
          <div className="flex gap-2 items-center flex-wrap">
            {/* Selector cancha */}
            <div className="flex gap-1 bg-white/10 rounded-xl p-1">
              {([
                { id:'full',       label:'Completa' },
                { id:'half-left',  label:'Mitad izq.' },
                { id:'half-right', label:'Mitad der.' },
              ] as { id: CourtMode; label: string }[]).map(m => (
                <button key={m.id} onClick={() => setCourt(m.id)}
                  className={clsx('text-xs px-2.5 py-1.5 rounded-lg transition-colors',
                    courtMode===m.id ? 'bg-dj-600 text-white font-semibold' : 'text-white/60 hover:text-white'
                  )}>
                  {m.label}
                </button>
              ))}
            </div>

            <button onClick={undo} disabled={histIdx===0}
              className="text-white/50 hover:text-white disabled:opacity-20 p-1.5 rounded-lg hover:bg-white/10" title="Deshacer">
              <RotateCcw size={16}/>
            </button>
            <button onClick={clear}
              className="text-white/50 hover:text-red-400 p-1.5 rounded-lg hover:bg-white/10" title="Limpiar todo">
              <Trash2 size={16}/>
            </button>
            <button onClick={() => onSave(canvasRef.current!.toDataURL('image/png'))}
              className="bg-dj-600 hover:bg-dj-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5">
              <Download size={14}/> Guardar
            </button>
            <button onClick={onClose}
              className="text-white/50 hover:text-white p-1.5 rounded-lg hover:bg-white/10">
              <X size={18}/>
            </button>
          </div>
        </div>

        <div className="flex">
          {/* Panel izquierdo */}
          <div className="flex flex-col gap-0.5 p-2 border-r border-white/10 w-42 flex-shrink-0 overflow-y-auto" style={{width:168}}>

            {/* Colores */}
            <div className="px-1 pb-2 border-b border-white/10 mb-1">
              <p className="text-white/40 text-xs mb-1.5 uppercase tracking-wide">Color líneas</p>
              <div className="flex flex-wrap gap-1.5">
                {COLORS.map(c => (
                  <button key={c.value} onClick={() => setColor(c.value)} title={c.label}
                    className={clsx('w-6 h-6 rounded-full border-2 transition-transform',
                      color===c.value ? 'border-white scale-125' : 'border-transparent hover:scale-110'
                    )}
                    style={{ backgroundColor: c.value }}
                  />
                ))}
              </div>
            </div>

            {/* Herramientas */}
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

            {/* Toggle puntos de control */}
            <button onClick={toggleShowCtrl}
              className={clsx('mt-1 flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs transition-all text-left border',
                showCtrlRef.current ? 'border-dj-500 text-dj-400 bg-dj-900/50' : 'border-white/10 text-white/40 hover:text-white/60'
              )}>
              <span className="w-5 flex items-center justify-center">
                <span className="w-3 h-3 rounded-full bg-white inline-block"/>
              </span>
              <span>Editar curvas</span>
            </button>
          </div>

          {/* Canvas */}
          <div className="flex-1 p-3 flex items-center justify-center bg-gray-800/50">
            <canvas
              ref={canvasRef}
              width={W} height={H}
              className="rounded-xl w-full select-none"
              style={{ cursor, maxHeight: '72vh' }}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={e => { if (dragRef.current.mode !== 'none') onMouseUp(e) }}
            />
          </div>
        </div>

        <div className="px-4 py-2 border-t border-white/10 text-xs text-white/25 text-center">
          Clic para colocar · Arrastrá para flechas · "Mover" para desplazar · "Editar curvas" para ajustar control points
        </div>
      </div>
    </div>
  )
}
