import { useRef, useState, useEffect, useCallback } from 'react'
import {
  MousePointer, Minus, ArrowRight, Trash2, Download,
  RotateCcw, Circle, Triangle, ZoomIn, ZoomOut,
} from 'lucide-react'
import { clsx } from '@/lib/utils'

// ─── Tipos ───────────────────────────────────────────────────────────────────
type ToolType =
  | 'select'
  | 'player-own'    // jugador propio (rojo)
  | 'player-rival'  // jugador rival (azul)
  | 'goalkeeper'    // portero (amarillo)
  | 'cone'          // cono (naranja)
  | 'ball'          // pelota
  | 'mannequin'     // muñeco
  | 'arrow-dash'    // flecha punteada (pase/lanzamiento)
  | 'arrow-solid'   // flecha lineal (trayectoria)
  | 'arrow-curve'   // flecha curva libre
  | 'eraser'

interface Point { x: number; y: number }

interface BoardElement {
  id: string
  type: 'player-own' | 'player-rival' | 'goalkeeper' | 'cone' | 'ball' | 'mannequin'
  x: number
  y: number
  number?: number
  label?: string
}

interface BoardArrow {
  id: string
  type: 'arrow-dash' | 'arrow-solid' | 'arrow-curve'
  points: Point[]        // [start, ...control, end]
  controlPoint?: Point   // para curva
}

interface BoardState {
  elements: BoardElement[]
  arrows: BoardArrow[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function uid() { return `${Date.now()}-${Math.random().toString(36).slice(2)}` }

// Dimensiones de la cancha (proporciones reales handball)
const COURT_W = 720
const COURT_H = 480

// ─── Componente principal ────────────────────────────────────────────────────
interface Props {
  onSave: (imageDataUrl: string) => void
  onClose: () => void
  initialImage?: string | null
}

export function TacticalBoard({ onSave, onClose, initialImage }: Props) {
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const overlayRef  = useRef<HTMLDivElement>(null)

  const [tool, setTool]     = useState<ToolType>('select')
  const [board, setBoard]   = useState<BoardState>({ elements: [], arrows: [] })
  const [history, setHistory] = useState<BoardState[]>([{ elements: [], arrows: [] }])
  const [histIdx, setHistIdx] = useState(0)

  // Estado de drag
  const dragging   = useRef<{ id: string; offX: number; offY: number } | null>(null)
  const drawing    = useRef<{ points: Point[] } | null>(null)
  const curveEdit  = useRef<{ id: string } | null>(null)

  const [selected, setSelected] = useState<string | null>(null)
  const [playerCount, setPlayerCount] = useState({ own: 1, rival: 1, gk: 1 })

  // ─── Dibujar cancha ────────────────────────────────────────────────────────
  useEffect(() => {
    drawAll()
  }, [board])

  function drawAll() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, COURT_W, COURT_H)
    drawCourt(ctx)
    drawArrows(ctx)
    drawElements(ctx)
  }

  function drawCourt(ctx: CanvasRenderingContext2D) {
    // Fondo verde
    ctx.fillStyle = '#2d7a2d'
    ctx.fillRect(0, 0, COURT_W, COURT_H)

    // Líneas blancas
    ctx.strokeStyle = 'white'
    ctx.lineWidth = 2

    // Perímetro
    ctx.strokeRect(20, 20, COURT_W - 40, COURT_H - 40)

    // Línea central
    ctx.beginPath()
    ctx.moveTo(COURT_W / 2, 20)
    ctx.lineTo(COURT_W / 2, COURT_H - 20)
    ctx.stroke()

    // Arco izquierdo (área de 6m)
    ctx.beginPath()
    ctx.arc(20, COURT_H / 2, 130, -Math.PI / 2.2, Math.PI / 2.2)
    ctx.stroke()

    // Arco derecho
    ctx.beginPath()
    ctx.arc(COURT_W - 20, COURT_H / 2, 130, Math.PI - Math.PI / 2.2, Math.PI + Math.PI / 2.2)
    ctx.stroke()

    // Línea de 9m izquierda (punteada)
    ctx.setLineDash([8, 6])
    ctx.beginPath()
    ctx.arc(20, COURT_H / 2, 190, -Math.PI / 2.8, Math.PI / 2.8)
    ctx.stroke()

    // Línea de 9m derecha
    ctx.beginPath()
    ctx.arc(COURT_W - 20, COURT_H / 2, 190, Math.PI - Math.PI / 2.8, Math.PI + Math.PI / 2.8)
    ctx.stroke()
    ctx.setLineDash([])

    // Porterías
    const goalH = 70
    const goalY = COURT_H / 2 - goalH / 2
    ctx.lineWidth = 4
    ctx.strokeStyle = 'white'
    // Izquierda
    ctx.strokeRect(0, goalY, 12, goalH)
    // Derecha
    ctx.strokeRect(COURT_W - 12, goalY, 12, goalH)
    ctx.lineWidth = 2
  }

  function drawArrows(ctx: CanvasRenderingContext2D) {
    board.arrows.forEach(arrow => {
      if (arrow.points.length < 2) return
      const start = arrow.points[0]
      const end   = arrow.points[arrow.points.length - 1]

      ctx.strokeStyle = '#fff700'
      ctx.lineWidth = 2.5

      if (arrow.type === 'arrow-dash') {
        ctx.setLineDash([8, 5])
      } else {
        ctx.setLineDash([])
      }

      ctx.beginPath()
      if (arrow.type === 'arrow-curve' && arrow.controlPoint) {
        ctx.moveTo(start.x, start.y)
        ctx.quadraticCurveTo(arrow.controlPoint.x, arrow.controlPoint.y, end.x, end.y)
      } else {
        ctx.moveTo(start.x, start.y)
        ctx.lineTo(end.x, end.y)
      }
      ctx.stroke()
      ctx.setLineDash([])

      // Punta de flecha
      drawArrowhead(ctx, start, end, arrow.controlPoint)
    })
  }

  function drawArrowhead(
    ctx: CanvasRenderingContext2D,
    start: Point,
    end: Point,
    control?: Point
  ) {
    let angle: number
    if (control) {
      // Ángulo tangente al final de la curva cuadrática
      angle = Math.atan2(end.y - control.y, end.x - control.x)
    } else {
      angle = Math.atan2(end.y - start.y, end.x - start.x)
    }
    const size = 12
    ctx.fillStyle = '#fff700'
    ctx.beginPath()
    ctx.moveTo(end.x, end.y)
    ctx.lineTo(
      end.x - size * Math.cos(angle - Math.PI / 6),
      end.y - size * Math.sin(angle - Math.PI / 6)
    )
    ctx.lineTo(
      end.x - size * Math.cos(angle + Math.PI / 6),
      end.y - size * Math.sin(angle + Math.PI / 6)
    )
    ctx.closePath()
    ctx.fill()
  }

  function drawElements(ctx: CanvasRenderingContext2D) {
    board.elements.forEach(el => {
      const isSelected = el.id === selected
      if (isSelected) {
        ctx.shadowColor = 'white'
        ctx.shadowBlur = 10
      }

      switch (el.type) {
        case 'player-own':   drawPlayerCircle(ctx, el, '#e53935', el.number ?? 1); break
        case 'player-rival': drawPlayerCircle(ctx, el, '#1565c0', el.number ?? 1); break
        case 'goalkeeper':   drawPlayerCircle(ctx, el, '#f9a825', el.number ?? 1); break
        case 'cone':         drawCone(ctx, el); break
        case 'ball':         drawBall(ctx, el); break
        case 'mannequin':    drawMannequin(ctx, el); break
      }

      ctx.shadowBlur = 0
    })
  }

  function drawPlayerCircle(ctx: CanvasRenderingContext2D, el: BoardElement, color: string, num: number) {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(el.x, el.y, 18, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'white'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.fillStyle = 'white'
    ctx.font = 'bold 13px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(num), el.x, el.y)
  }

  function drawCone(ctx: CanvasRenderingContext2D, el: BoardElement) {
    ctx.fillStyle = '#ff6600'
    ctx.beginPath()
    ctx.moveTo(el.x, el.y - 14)
    ctx.lineTo(el.x - 10, el.y + 10)
    ctx.lineTo(el.x + 10, el.y + 10)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = 'white'
    ctx.lineWidth = 1.5
    ctx.stroke()
  }

  function drawBall(ctx: CanvasRenderingContext2D, el: BoardElement) {
    ctx.fillStyle = '#f5f5f5'
    ctx.beginPath()
    ctx.arc(el.x, el.y, 10, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#333'
    ctx.lineWidth = 1.5
    ctx.stroke()
    // Líneas de la pelota
    ctx.strokeStyle = '#555'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(el.x, el.y, 10, 0, Math.PI * 2)
    ctx.moveTo(el.x - 10, el.y)
    ctx.lineTo(el.x + 10, el.y)
    ctx.moveTo(el.x, el.y - 10)
    ctx.lineTo(el.x, el.y + 10)
    ctx.stroke()
  }

  function drawMannequin(ctx: CanvasRenderingContext2D, el: BoardElement) {
    const x = el.x, y = el.y
    ctx.strokeStyle = '#ff9800'
    ctx.fillStyle = '#ff9800'
    ctx.lineWidth = 2.5
    // Cabeza
    ctx.beginPath()
    ctx.arc(x, y - 14, 6, 0, Math.PI * 2)
    ctx.fill()
    // Cuerpo
    ctx.beginPath()
    ctx.moveTo(x, y - 8)
    ctx.lineTo(x, y + 8)
    ctx.stroke()
    // Brazos
    ctx.beginPath()
    ctx.moveTo(x - 10, y - 2)
    ctx.lineTo(x + 10, y - 2)
    ctx.stroke()
    // Piernas
    ctx.beginPath()
    ctx.moveTo(x, y + 8)
    ctx.lineTo(x - 8, y + 20)
    ctx.moveTo(x, y + 8)
    ctx.lineTo(x + 8, y + 20)
    ctx.stroke()
  }

  // ─── Interacción con el canvas ────────────────────────────────────────────
  function getPos(e: React.MouseEvent<HTMLCanvasElement>): Point {
    const rect = canvasRef.current!.getBoundingClientRect()
    const scaleX = COURT_W / rect.width
    const scaleY = COURT_H / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top)  * scaleY,
    }
  }

  function findElement(pos: Point): BoardElement | null {
    return board.elements.slice().reverse().find(el => {
      const dx = el.x - pos.x
      const dy = el.y - pos.y
      return Math.sqrt(dx*dx + dy*dy) < 22
    }) ?? null
  }

  function pushHistory(newBoard: BoardState) {
    const newHistory = history.slice(0, histIdx + 1)
    newHistory.push(newBoard)
    setHistory(newHistory)
    setHistIdx(newHistory.length - 1)
  }

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const pos = getPos(e)

    if (tool === 'select') {
      const el = findElement(pos)
      if (el) {
        setSelected(el.id)
        dragging.current = { id: el.id, offX: pos.x - el.x, offY: pos.y - el.y }
      } else {
        setSelected(null)
      }
      return
    }

    if (tool === 'eraser') {
      const el = findElement(pos)
      if (el) {
        const nb = { ...board, elements: board.elements.filter(e => e.id !== el.id) }
        setBoard(nb); pushHistory(nb)
      } else {
        // borrar flecha cercana (simplificado: borra la última)
        const nb = { ...board, arrows: board.arrows.slice(0, -1) }
        setBoard(nb); pushHistory(nb)
      }
      return
    }

    if (['arrow-dash', 'arrow-solid', 'arrow-curve'].includes(tool)) {
      drawing.current = { points: [pos] }
      return
    }

    // Colocar elemento
    if (['player-own','player-rival','goalkeeper','cone','ball','mannequin'].includes(tool)) {
      let num: number | undefined
      let newCounts = { ...playerCount }
      if (tool === 'player-own')   { num = playerCount.own;   newCounts.own++  }
      if (tool === 'player-rival') { num = playerCount.rival; newCounts.rival++ }
      if (tool === 'goalkeeper')   { num = playerCount.gk;    newCounts.gk++   }
      setPlayerCount(newCounts)

      const el: BoardElement = {
        id: uid(),
        type: tool as BoardElement['type'],
        x: pos.x,
        y: pos.y,
        number: num,
      }
      const nb = { ...board, elements: [...board.elements, el] }
      setBoard(nb); pushHistory(nb)
    }
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const pos = getPos(e)

    if (dragging.current) {
      const nb = {
        ...board,
        elements: board.elements.map(el =>
          el.id === dragging.current!.id
            ? { ...el, x: pos.x - dragging.current!.offX, y: pos.y - dragging.current!.offY }
            : el
        )
      }
      setBoard(nb)
      return
    }

    if (drawing.current) {
      // Preview en tiempo real
      const tempBoard = {
        ...board,
        arrows: [
          ...board.arrows,
          {
            id: 'preview',
            type: tool as BoardArrow['type'],
            points: [drawing.current.points[0], pos],
            controlPoint: tool === 'arrow-curve'
              ? { x: (drawing.current.points[0].x + pos.x) / 2, y: Math.min(drawing.current.points[0].y, pos.y) - 50 }
              : undefined,
          }
        ]
      }
      const canvas = canvasRef.current!
      const ctx = canvas.getContext('2d')!
      ctx.clearRect(0, 0, COURT_W, COURT_H)
      drawCourt(ctx)
      // Dibujar flechas existentes
      const prevBoard = board
      setBoard(tempBoard)
      setTimeout(() => {
        drawAll()
        setBoard(prevBoard)
      }, 0)
    }
  }

  function handleMouseUp(e: React.MouseEvent<HTMLCanvasElement>) {
    const pos = getPos(e)

    if (dragging.current) {
      dragging.current = null
      pushHistory(board)
      return
    }

    if (drawing.current) {
      const start = drawing.current.points[0]
      const dist = Math.sqrt((pos.x-start.x)**2 + (pos.y-start.y)**2)
      if (dist > 15) {
        const arrow: BoardArrow = {
          id: uid(),
          type: tool as BoardArrow['type'],
          points: [start, pos],
          controlPoint: tool === 'arrow-curve'
            ? { x: (start.x + pos.x) / 2, y: Math.min(start.y, pos.y) - 60 }
            : undefined,
        }
        const nb = { ...board, arrows: [...board.arrows, arrow] }
        setBoard(nb); pushHistory(nb)
      }
      drawing.current = null
    }
  }

  function handleUndo() {
    if (histIdx > 0) {
      setHistIdx(histIdx - 1)
      setBoard(history[histIdx - 1])
    }
  }

  function handleClear() {
    const nb = { elements: [], arrows: [] }
    setBoard(nb); pushHistory(nb)
    setPlayerCount({ own: 1, rival: 1, gk: 1 })
  }

  function handleSave() {
    const canvas = canvasRef.current!
    const dataUrl = canvas.toDataURL('image/png')
    onSave(dataUrl)
  }

  // ─── Herramientas ─────────────────────────────────────────────────────────
  const tools: { id: ToolType; label: string; icon: React.ReactNode; color?: string }[] = [
    { id: 'select',       label: 'Seleccionar',   icon: <MousePointer size={16}/> },
    { id: 'player-own',   label: 'Jugador propio', icon: <span className="w-4 h-4 rounded-full bg-red-600 border-2 border-white inline-block"/> },
    { id: 'player-rival', label: 'Jugador rival',  icon: <span className="w-4 h-4 rounded-full bg-blue-600 border-2 border-white inline-block"/> },
    { id: 'goalkeeper',   label: 'Portero',        icon: <span className="w-4 h-4 rounded-full bg-yellow-400 border-2 border-white inline-block"/> },
    { id: 'mannequin',    label: 'Muñeco',         icon: <span className="text-orange-400 font-bold text-xs">M</span> },
    { id: 'cone',         label: 'Cono',           icon: <Triangle size={14} className="text-orange-500"/> },
    { id: 'ball',         label: 'Pelota',         icon: <Circle size={14} className="text-gray-300"/> },
    { id: 'arrow-dash',   label: 'Pase/Lanzamiento', icon: <span className="text-yellow-400 text-xs font-bold">- -▶</span> },
    { id: 'arrow-solid',  label: 'Trayectoria',    icon: <span className="text-yellow-400 text-xs font-bold">——▶</span> },
    { id: 'arrow-curve',  label: 'Curva libre',    icon: <span className="text-yellow-400 text-xs font-bold">∿▶</span> },
    { id: 'eraser',       label: 'Borrar',         icon: <Trash2 size={14}/> },
  ]

  const cursor = tool === 'select' ? 'cursor-default'
    : tool === 'eraser' ? 'cursor-crosshair'
    : ['arrow-dash','arrow-solid','arrow-curve'].includes(tool) ? 'cursor-crosshair'
    : 'cursor-copy'

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl shadow-2xl flex flex-col" style={{ maxWidth: 900, width: '100%' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h2 className="text-white font-bold text-sm">🏐 Pizarra táctica</h2>
          <div className="flex gap-2">
            <button
              onClick={handleUndo}
              disabled={histIdx === 0}
              className="text-white/60 hover:text-white disabled:opacity-30 p-1.5 rounded-lg hover:bg-white/10"
              title="Deshacer"
            >
              <RotateCcw size={16}/>
            </button>
            <button
              onClick={handleClear}
              className="text-white/60 hover:text-red-400 p-1.5 rounded-lg hover:bg-white/10"
              title="Limpiar todo"
            >
              <Trash2 size={16}/>
            </button>
            <button
              onClick={handleSave}
              className="bg-dj-600 hover:bg-dj-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5"
            >
              <Download size={14}/> Guardar imagen
            </button>
            <button
              onClick={onClose}
              className="text-white/60 hover:text-white text-xs px-3 py-1.5 rounded-lg hover:bg-white/10"
            >
              Cerrar
            </button>
          </div>
        </div>

        <div className="flex gap-0">
          {/* Barra de herramientas */}
          <div className="flex flex-col gap-1 p-2 border-r border-white/10 min-w-32">
            {tools.map(t => (
              <button
                key={t.id}
                onClick={() => setTool(t.id)}
                className={clsx(
                  'flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs transition-colors text-left',
                  tool === t.id
                    ? 'bg-dj-600 text-white'
                    : 'text-white/60 hover:text-white hover:bg-white/10'
                )}
              >
                <span className="flex-shrink-0 flex items-center justify-center w-5">{t.icon}</span>
                <span className="leading-tight">{t.label}</span>
              </button>
            ))}
          </div>

          {/* Canvas */}
          <div className="flex-1 p-3">
            <canvas
              ref={canvasRef}
              width={COURT_W}
              height={COURT_H}
              className={clsx('rounded-xl w-full', cursor)}
              style={{ maxHeight: 420 }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
