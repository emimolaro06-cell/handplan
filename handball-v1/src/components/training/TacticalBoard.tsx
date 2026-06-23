import { useRef, useState, useEffect } from 'react'
import { RotateCcw, Trash2, Download, X, MousePointer, Minus } from 'lucide-react'
import { clsx } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────
type Tool =
  | 'select' | 'player-own' | 'player-rival' | 'goalkeeper'
  | 'cone' | 'ball' | 'mannequin' | 'text'
  | 'arrow-solid' | 'arrow-dash' | 'arrow-curve' | 'line' | 'eraser'

type CourtMode = 'full' | 'half-left' | 'half-right'

interface Pt { x: number; y: number }

interface Elem {
  id: string
  kind: 'player-own' | 'player-rival' | 'goalkeeper' | 'cone' | 'ball' | 'mannequin'
  x: number; y: number; n?: number
}

interface TextElem {
  id: string
  kind: 'text'
  x: number; y: number
  text: string
  color: string
}

interface Arrow {
  id: string
  kind: 'arrow-solid' | 'arrow-dash' | 'arrow-curve' | 'line'
  x1: number; y1: number
  x2: number; y2: number
  cx: number; cy: number   // control point (para curva; para recta = punto medio)
  color: string
}

interface Scene { elems: Elem[]; arrows: Arrow[]; texts: TextElem[] }

const W = 820, H = 500
const HIT = 16  // radio de hit-test en px canvas

const COLORS = [
  '#ffe600','#ffffff','#ef4444','#3b82f6','#f97316','#22c55e','#111111'
]

let _id = 0
function uid() { return `e${++_id}` }
function midPt(x1:number,y1:number,x2:number,y2:number,lift=0): Pt {
  return { x:(x1+x2)/2, y:(y1+y2)/2 - lift }
}

// ─── Draw helpers ─────────────────────────────────────────────────────────────
const COURT_BG = '#4a85b8'
const COURT_LINE = '#111111'

function court(ctx: CanvasRenderingContext2D, mode: CourtMode) {
  ctx.fillStyle = COURT_BG; ctx.fillRect(0,0,W,H)
  ctx.strokeStyle = COURT_LINE; ctx.lineWidth = 2.5

  const halfW = W/2 // ancho de una mitad de cancha completa, referencia para las proporciones

  if (mode === 'full') {
    ctx.strokeRect(8,8,W-16,H-16)
    ctx.beginPath(); ctx.moveTo(W/2,8); ctx.lineTo(W/2,H-8); ctx.stroke()

    const gY=H/2
    const r6 = halfW * 0.48   // radio área de portero (6m)
    const r9 = halfW * 0.68   // radio línea de tiro libre (9m)
    // Área de portero (6m) — línea sólida
    ctx.beginPath(); ctx.arc(8,gY,r6,-1.15,1.15); ctx.stroke()
    ctx.beginPath(); ctx.arc(W-8,gY,r6,Math.PI-1.15,Math.PI+1.15); ctx.stroke()
    // Línea de tiro libre (9m) — punteada
    ctx.setLineDash([9,7])
    ctx.beginPath(); ctx.arc(8,gY,r9,-1.0,1.0); ctx.stroke()
    ctx.beginPath(); ctx.arc(W-8,gY,r9,Math.PI-1.0,Math.PI+1.0); ctx.stroke()
    ctx.setLineDash([])
    // Marcas de 7 metros (penal) — rayitas cortas, entre la línea de 6m y la de 9m
    const r7 = (r6+r9)/2
    ctx.beginPath(); ctx.moveTo(8+r7,gY-7); ctx.lineTo(8+r7,gY+7); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(W-8-r7,gY-7); ctx.lineTo(W-8-r7,gY+7); ctx.stroke()
    // Línea de gol + portería
    const gH=70, gTop=gY-gH/2
    ctx.lineWidth=5; ctx.strokeRect(0,gTop,12,gH); ctx.strokeRect(W-12,gTop,12,gH); ctx.lineWidth=2.5
    return
  }

  // Mitad de cancha: como esta única mitad ocupa todo el ancho del canvas, las proporciones
  // se calculan sobre W (no halfW) para que se vea agrandada, como pidió el usuario.
  const gY = H/2
  const r6h = W * 0.46
  const r9h = W * 0.64
  ctx.strokeRect(8,8,W-16,H-16)

  if (mode === 'half-left') {
    ctx.beginPath(); ctx.arc(8,gY,r6h,-0.62,0.62); ctx.stroke()
    ctx.setLineDash([9,7])
    ctx.beginPath(); ctx.arc(8,gY,r9h,-0.52,0.52); ctx.stroke()
    ctx.setLineDash([])
    const r7=(r6h+r9h)/2
    ctx.beginPath(); ctx.moveTo(8+r7,gY-7); ctx.lineTo(8+r7,gY+7); ctx.stroke()
    const gH=70, gTop=gY-gH/2
    ctx.lineWidth=5; ctx.strokeRect(0,gTop,12,gH); ctx.lineWidth=2.5
  } else {
    ctx.beginPath(); ctx.arc(W-8,gY,r6h,Math.PI-0.62,Math.PI+0.62); ctx.stroke()
    ctx.setLineDash([9,7])
    ctx.beginPath(); ctx.arc(W-8,gY,r9h,Math.PI-0.52,Math.PI+0.52); ctx.stroke()
    ctx.setLineDash([])
    const r7=(r6h+r9h)/2
    ctx.beginPath(); ctx.moveTo(W-8-r7,gY-7); ctx.lineTo(W-8-r7,gY+7); ctx.stroke()
    const gH=70, gTop=gY-gH/2
    ctx.lineWidth=5; ctx.strokeRect(W-12,gTop,12,gH); ctx.lineWidth=2.5
  }
}

function arrowShape(ctx: CanvasRenderingContext2D, a: Arrow, alpha=1, sel=false) {
  ctx.save(); ctx.globalAlpha=alpha
  if (sel) { ctx.shadowColor='white'; ctx.shadowBlur=12 }
  ctx.strokeStyle=a.color; ctx.fillStyle=a.color; ctx.lineWidth=2.8
  if (a.kind==='arrow-dash') ctx.setLineDash([9,6]); else ctx.setLineDash([])
  ctx.beginPath()
  if (a.kind==='arrow-curve') {
    ctx.moveTo(a.x1,a.y1); ctx.quadraticCurveTo(a.cx,a.cy,a.x2,a.y2)
  } else {
    ctx.moveTo(a.x1,a.y1); ctx.lineTo(a.x2,a.y2)
  }
  ctx.stroke(); ctx.setLineDash([])
  if (a.kind!=='line') {
    const angle = a.kind==='arrow-curve'
      ? Math.atan2(a.y2-a.cy, a.x2-a.cx)
      : Math.atan2(a.y2-a.y1, a.x2-a.x1)
    const s=13
    ctx.beginPath()
    ctx.moveTo(a.x2,a.y2)
    ctx.lineTo(a.x2-s*Math.cos(angle-.5), a.y2-s*Math.sin(angle-.5))
    ctx.lineTo(a.x2-s*Math.cos(angle+.5), a.y2-s*Math.sin(angle+.5))
    ctx.closePath(); ctx.fill()
  }
  ctx.restore()
}

function handle(ctx: CanvasRenderingContext2D, x:number, y:number, fill='white', stroke='#888') {
  ctx.save()
  ctx.fillStyle=fill; ctx.strokeStyle=stroke; ctx.lineWidth=2
  ctx.beginPath(); ctx.arc(x,y,7,0,Math.PI*2); ctx.fill(); ctx.stroke()
  ctx.restore()
}

function elemShape(ctx: CanvasRenderingContext2D, el: Elem, sel: boolean) {
  if (sel) { ctx.shadowColor='white'; ctx.shadowBlur=14 }
  const {x,y}=el
  if (el.kind==='player-own'||el.kind==='player-rival'||el.kind==='goalkeeper') {
    const c = el.kind==='player-own' ? '#d32f2f' : el.kind==='player-rival' ? '#ffffff' : '#f9a825'
    const textColor = el.kind==='player-rival' ? '#111111' : 'white'
    ctx.fillStyle=c; ctx.beginPath(); ctx.arc(x,y,19,0,Math.PI*2); ctx.fill()
    ctx.strokeStyle= el.kind==='player-rival' ? '#111111' : 'white'; ctx.lineWidth=2; ctx.stroke()
    ctx.fillStyle=textColor; ctx.font='bold 13px Arial'
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(String(el.n??''),x,y)
  } else if (el.kind==='cone') {
    ctx.fillStyle='#ff6600'
    ctx.beginPath(); ctx.moveTo(x,y-15); ctx.lineTo(x-11,y+10); ctx.lineTo(x+11,y+10)
    ctx.closePath(); ctx.fill(); ctx.strokeStyle='white'; ctx.lineWidth=2; ctx.stroke()
  } else if (el.kind==='ball') {
    ctx.fillStyle='#f5f5f5'; ctx.beginPath(); ctx.arc(x,y,11,0,Math.PI*2); ctx.fill()
    ctx.strokeStyle='#111'; ctx.lineWidth=1.5; ctx.stroke()
    ctx.strokeStyle='#999'; ctx.lineWidth=1
    ctx.beginPath(); ctx.moveTo(x-11,y); ctx.lineTo(x+11,y); ctx.moveTo(x,y-11); ctx.lineTo(x,y+11); ctx.stroke()
  } else if (el.kind==='mannequin') {
    ctx.strokeStyle='#ff9800'; ctx.fillStyle='#ff9800'; ctx.lineWidth=2.5
    ctx.beginPath(); ctx.arc(x,y-16,7,0,Math.PI*2); ctx.fill()
    ctx.beginPath(); ctx.moveTo(x,y-9); ctx.lineTo(x,y+9); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(x-11,y-1); ctx.lineTo(x+11,y-1); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(x,y+9); ctx.lineTo(x-9,y+22); ctx.moveTo(x,y+9); ctx.lineTo(x+9,y+22); ctx.stroke()
  }
  ctx.shadowBlur=0
}

function textShape(ctx: CanvasRenderingContext2D, t: TextElem, sel: boolean) {
  ctx.save()
  if (sel) { ctx.shadowColor='white'; ctx.shadowBlur=10 }
  ctx.font='bold 16px Arial'
  ctx.textAlign='center'; ctx.textBaseline='middle'
  // Fondo semi-transparente para que se lea sobre cualquier color de cancha
  const w = ctx.measureText(t.text).width
  ctx.fillStyle='rgba(0,0,0,0.55)'
  ctx.fillRect(t.x - w/2 - 6, t.y - 12, w + 12, 24)
  ctx.fillStyle=t.color
  ctx.fillText(t.text, t.x, t.y)
  ctx.restore()
}

// ─── Component ────────────────────────────────────────────────────────────────
export function TacticalBoard({ onSave, onClose }: {
  onSave:(url:string)=>void; onClose:()=>void
}) {
  const cvRef    = useRef<HTMLCanvasElement>(null)
  const scene    = useRef<Scene>({ elems:[], arrows:[], texts:[] })
  const hist     = useRef<Scene[]>([{ elems:[], arrows:[], texts:[] }])
  const histIdx  = useRef(0)
  const counts   = useRef({ own:1, rival:1, gk:1 })
  const selId    = useRef<string|null>(null)
  const selArrowId = useRef<string|null>(null)
  const editMode = useRef(false)   // mostrar handles de flechas

  // drag state
  const drag = useRef<{
    what: 'none'|'elem'|'text'|'arrow-body'|'arrow-p1'|'arrow-p2'|'arrow-ctrl'|'drawing'
    id: string
    ox: number; oy: number   // offset o punto de inicio
  }>({ what:'none', id:'', ox:0, oy:0 })

  // UI state (solo para re-render de toolbar)
  const [tool,  setTool]    = useState<Tool>('select')
  const [color, setColor]   = useState(COLORS[0])
  const [court2, setCourt2] = useState<CourtMode>('full')
  const [, tick] = useState(0)
  const rerender = () => tick(n=>n+1)

  const toolRef  = useRef<Tool>('select')
  const colorRef = useRef(COLORS[0])
  const courtRef = useRef<CourtMode>('full')

  function setT(t:Tool)         { toolRef.current=t;  setTool(t)    }
  function setC(c:string)       { colorRef.current=c; setColor(c)   }
  function setM(m:CourtMode)    { courtRef.current=m; setCourt2(m); paint() }

  // ─── Paint ─────────────────────────────────────────────────────────────────
  function paint(s?: Scene) {
    const cv=cvRef.current; if (!cv) return
    const ctx=cv.getContext('2d')!
    const sc = s ?? scene.current
    ctx.clearRect(0,0,W,H)
    court(ctx, courtRef.current)
    sc.arrows.forEach(a => arrowShape(ctx, a, 1, a.id===selArrowId.current))
    if (editMode.current) {
      sc.arrows.forEach(a => {
        handle(ctx, a.x1, a.y1, '#fff', a.color)
        handle(ctx, a.x2, a.y2, '#fff', a.color)
        if (a.kind==='arrow-curve') handle(ctx, a.cx, a.cy, '#ffff00', '#fff')
      })
    }
    sc.elems.forEach(el => elemShape(ctx, el, el.id===selId.current))
    sc.texts.forEach(t => textShape(ctx, t, t.id===selId.current))
  }

  useEffect(() => { paint() }, [])

  // Borrar con Supr/Delete el elemento, texto o flecha seleccionado actualmente
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      if (!selId.current && !selArrowId.current) return
      // Evitar borrar mientras se escribe en un input/textarea de otra parte de la pantalla
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      e.preventDefault()
      const s = scene.current
      if (selArrowId.current) {
        const id = selArrowId.current
        commit({ ...s, arrows: s.arrows.filter(a => a.id !== id) })
        selArrowId.current = null
      } else if (selId.current) {
        const id = selId.current
        commit({
          elems: s.elems.filter(el => el.id !== id),
          texts: s.texts.filter(t => t.id !== id),
          arrows: s.arrows,
        })
        selId.current = null
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // ─── Canvas coords ─────────────────────────────────────────────────────────
  function pos(e: React.MouseEvent<HTMLCanvasElement>): Pt {
    const r=cvRef.current!.getBoundingClientRect()
    return { x:(e.clientX-r.left)*(W/r.width), y:(e.clientY-r.top)*(H/r.height) }
  }

  // ─── Hit tests ─────────────────────────────────────────────────────────────
  function hitElem(p:Pt): Elem|null {
    return [...scene.current.elems].reverse().find(e=>Math.hypot(e.x-p.x,e.y-p.y)<HIT+8)??null
  }
  function hitText(p:Pt): TextElem|null {
    return [...scene.current.texts].reverse().find(t=>Math.hypot(t.x-p.x,t.y-p.y)<HIT+14)??null
  }
  function hitArrowP1(p:Pt): Arrow|null {
    if (!editMode.current) return null
    return scene.current.arrows.find(a=>Math.hypot(a.x1-p.x,a.y1-p.y)<HIT)??null
  }
  function hitArrowP2(p:Pt): Arrow|null {
    if (!editMode.current) return null
    return scene.current.arrows.find(a=>Math.hypot(a.x2-p.x,a.y2-p.y)<HIT)??null
  }
  function hitArrowCtrl(p:Pt): Arrow|null {
    if (!editMode.current) return null
    return scene.current.arrows.find(a=>a.kind==='arrow-curve'&&Math.hypot(a.cx-p.x,a.cy-p.y)<HIT)??null
  }
  function hitArrowBody(p:Pt): Arrow|null {
    return [...scene.current.arrows].reverse().find(a=>{
      const mx=(a.x1+a.x2)/2, my=(a.y1+a.y2)/2
      return Math.hypot(mx-p.x,my-p.y)<HIT+6
    })??null
  }

  // ─── Commit ────────────────────────────────────────────────────────────────
  function commit(ns: Scene) {
    scene.current = { elems:[...ns.elems], arrows:[...ns.arrows], texts:[...ns.texts] }
    const h = hist.current.slice(0, histIdx.current+1)
    h.push({ elems:[...ns.elems], arrows:[...ns.arrows], texts:[...ns.texts] })
    hist.current = h
    histIdx.current = h.length-1
    paint(ns)
    rerender()
  }

  // ─── Mouse ─────────────────────────────────────────────────────────────────
  function down(e: React.MouseEvent<HTMLCanvasElement>) {
    e.preventDefault()
    const p = pos(e)
    const t = toolRef.current
    const d = drag.current

    // ERASER
    if (t==='eraser') {
      const el = hitElem(p)
      if (el) { commit({...scene.current, elems:scene.current.elems.filter(x=>x.id!==el.id)}); return }
      const tx = hitText(p)
      if (tx) { commit({...scene.current, texts:scene.current.texts.filter(x=>x.id!==tx.id)}); return }
      const ab = hitArrowBody(p)
      if (ab) { commit({...scene.current, arrows:scene.current.arrows.filter(a=>a.id!==ab.id)}); return }
      return
    }

    // SELECT
    if (t==='select') {
      // handles tienen prioridad
      const ac = hitArrowCtrl(p)
      if (ac) { d.what='arrow-ctrl'; d.id=ac.id; d.ox=p.x; d.oy=p.y; return }
      const p2 = hitArrowP2(p)
      if (p2) { d.what='arrow-p2';  d.id=p2.id; d.ox=p.x; d.oy=p.y; return }
      const p1 = hitArrowP1(p)
      if (p1) { d.what='arrow-p1';  d.id=p1.id; d.ox=p.x; d.oy=p.y; return }
      const el = hitElem(p)
      if (el) { selId.current=el.id; selArrowId.current=null; d.what='elem'; d.id=el.id; d.ox=p.x-el.x; d.oy=p.y-el.y; paint(); return }
      const tx = hitText(p)
      if (tx) { selId.current=tx.id; selArrowId.current=null; d.what='text'; d.id=tx.id; d.ox=p.x-tx.x; d.oy=p.y-tx.y; paint(); return }
      const ab = hitArrowBody(p)
      if (ab) { selId.current=null; selArrowId.current=ab.id; d.what='arrow-body'; d.id=ab.id; d.ox=p.x; d.oy=p.y; paint(); return }
      selId.current=null; selArrowId.current=null; paint(); return
    }

    // PLACE TEXT
    if (t==='text') {
      const txt = window.prompt('Texto a agregar:', '')
      if (txt && txt.trim()) {
        commit({ ...scene.current, texts:[...scene.current.texts, { id:uid(), kind:'text', x:p.x, y:p.y, text:txt.trim(), color:colorRef.current }] })
      }
      return
    }

    // DRAWING ARROWS
    if (['arrow-solid','arrow-dash','arrow-curve','line'].includes(t)) {
      d.what='drawing'; d.id=''; d.ox=p.x; d.oy=p.y; return
    }

    // PLACE ELEMENT
    const kind = t as Elem['kind']
    let n: number|undefined
    const c = counts.current
    if (t==='player-own')   { n=c.own++;  }
    if (t==='player-rival') { n=c.rival++; }
    if (t==='goalkeeper')   { n=c.gk++;   }
    commit({ ...scene.current, elems:[...scene.current.elems, { id:uid(), kind, x:p.x, y:p.y, n }] })
  }

  function move(e: React.MouseEvent<HTMLCanvasElement>) {
    e.preventDefault()
    const p = pos(e)
    const d = drag.current
    const s = scene.current

    if (d.what==='elem') {
      const ns = { ...s, elems: s.elems.map(el=>el.id===d.id?{...el,x:p.x-d.ox,y:p.y-d.oy}:el) }
      scene.current=ns; paint(ns); return
    }

    if (d.what==='text') {
      const ns = { ...s, texts: s.texts.map(t=>t.id===d.id?{...t,x:p.x-d.ox,y:p.y-d.oy}:t) }
      scene.current=ns; paint(ns); return
    }

    if (d.what==='arrow-p1') {
      const ns = { ...s, arrows: s.arrows.map(a=>a.id===d.id?{...a,x1:p.x,y1:p.y,cx:(p.x+a.x2)/2,cy:a.kind==='arrow-curve'?Math.min(p.y,a.y2)-60:a.cy}:a) }
      scene.current=ns; paint(ns); return
    }
    if (d.what==='arrow-p2') {
      const ns = { ...s, arrows: s.arrows.map(a=>a.id===d.id?{...a,x2:p.x,y2:p.y,cx:(a.x1+p.x)/2,cy:a.kind==='arrow-curve'?Math.min(a.y1,p.y)-60:a.cy}:a) }
      scene.current=ns; paint(ns); return
    }
    if (d.what==='arrow-ctrl') {
      const ns = { ...s, arrows: s.arrows.map(a=>a.id===d.id?{...a,cx:p.x,cy:p.y}:a) }
      scene.current=ns; paint(ns); return
    }
    if (d.what==='arrow-body') {
      const dx=p.x-d.ox, dy=p.y-d.oy
      const ns = { ...s, arrows: s.arrows.map(a=>a.id===d.id?{...a,x1:a.x1+dx,y1:a.y1+dy,x2:a.x2+dx,y2:a.y2+dy,cx:a.cx+dx,cy:a.cy+dy}:a) }
      d.ox=p.x; d.oy=p.y; scene.current=ns; paint(ns); return
    }

    if (d.what==='drawing') {
      // preview
      const cv=cvRef.current!; const ctx=cv.getContext('2d')!
      ctx.clearRect(0,0,W,H); court(ctx,courtRef.current)
      s.arrows.forEach(a=>arrowShape(ctx,a))
      if (editMode.current) s.arrows.forEach(a=>{
        handle(ctx,a.x1,a.y1,'#fff',a.color); handle(ctx,a.x2,a.y2,'#fff',a.color)
        if(a.kind==='arrow-curve') handle(ctx,a.cx,a.cy,'#ffff00','#fff')
      })
      s.elems.forEach(el=>elemShape(ctx,el,false))
      s.texts.forEach(t=>textShape(ctx,t,false))
      const t=toolRef.current
      const prev: Arrow = {
        id:'prev', kind:t as Arrow['kind'],
        x1:d.ox,y1:d.oy, x2:p.x,y2:p.y,
        cx: t==='arrow-curve'?(d.ox+p.x)/2:( d.ox+p.x)/2,
        cy: t==='arrow-curve'?Math.min(d.oy,p.y)-60:(d.oy+p.y)/2,
        color: colorRef.current
      }
      arrowShape(ctx, prev, 0.6)
    }
  }

  function up(e: React.MouseEvent<HTMLCanvasElement>) {
    e.preventDefault()
    const p = pos(e)
    const d = drag.current

    if (['elem','text','arrow-p1','arrow-p2','arrow-ctrl'].includes(d.what)) {
      d.what='none'; commit(scene.current); return
    }
    if (d.what==='arrow-body') {
      d.what='none'; commit(scene.current); return
    }
    if (d.what==='drawing') {
      const dist=Math.hypot(p.x-d.ox,p.y-d.oy)
      if (dist>15) {
        const t=toolRef.current
        const a: Arrow = {
          id:uid(), kind:t as Arrow['kind'],
          x1:d.ox,y1:d.oy, x2:p.x,y2:p.y,
          cx: t==='arrow-curve'?(d.ox+p.x)/2:(d.ox+p.x)/2,
          cy: t==='arrow-curve'?Math.min(d.oy,p.y)-60:(d.oy+p.y)/2,
          color: colorRef.current
        }
        commit({ ...scene.current, arrows:[...scene.current.arrows,a] })
      } else {
        paint()
      }
      d.what='none'
    }
  }

  function undo() {
    if (histIdx.current>0) {
      histIdx.current--
      scene.current = hist.current[histIdx.current]
      paint(); rerender()
    }
  }
  function clear() {
    scene.current={elems:[],arrows:[],texts:[]}
    hist.current=[{elems:[],arrows:[],texts:[]}]
    histIdx.current=0
    selId.current=null
    selArrowId.current=null
    counts.current={own:1,rival:1,gk:1}
    paint(); rerender()
  }
  function toggleEdit() { editMode.current=!editMode.current; paint(); rerender() }

  // ─── Toolbar data ────────────────────────────────────────────────────────
  const TOOLS: {id:Tool; label:string; el:React.ReactNode}[] = [
    {id:'select',       label:'Mover / Editar',   el:<MousePointer size={14}/>},
    {id:'player-own',   label:'Jugador propio',   el:<span className="w-4 h-4 rounded-full bg-red-600 border border-white inline-block"/>},
    {id:'player-rival', label:'Jugador rival',    el:<span className="w-4 h-4 rounded-full bg-white border-2 border-black inline-block"/>},
    {id:'goalkeeper',   label:'Portero',          el:<span className="w-4 h-4 rounded-full bg-yellow-400 border border-white inline-block"/>},
    {id:'mannequin',    label:'Muñeco',           el:<span className="text-base">🚶</span>},
    {id:'cone',         label:'Cono',             el:<span className="text-orange-500 font-bold">▲</span>},
    {id:'ball',         label:'Pelota',           el:<span className="text-gray-200 font-bold">●</span>},
    {id:'text',         label:'Texto',            el:<span className="text-white font-bold text-sm">T</span>},
    {id:'arrow-solid',  label:'Trayectoria ——▶', el:<span className="text-yellow-400 text-xs font-bold">——▶</span>},
    {id:'arrow-dash',   label:'Pase / Lanz. - -▶',el:<span className="text-yellow-400 text-xs font-bold">- -▶</span>},
    {id:'arrow-curve',  label:'Curva libre ∿▶',  el:<span className="text-yellow-400 text-xs font-bold">∿▶</span>},
    {id:'line',         label:'Línea separadora', el:<Minus size={14} className="text-white/70"/>},
    {id:'eraser',       label:'Borrar',           el:<Trash2 size={14}/>},
  ]

  const cursor = tool==='select'?'default':['arrow-solid','arrow-dash','arrow-curve','line'].includes(tool)?'crosshair':tool==='eraser'?'crosshair':'copy'

  return (
    <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-3">
      <div className="bg-gray-900 rounded-2xl shadow-2xl flex flex-col w-full" style={{maxWidth:1060}}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-wrap gap-2">
          <h2 className="text-white font-bold text-sm">🏐 Pizarra táctica</h2>
          <div className="flex gap-2 items-center flex-wrap">
            <div className="flex gap-1 bg-white/10 rounded-xl p-1">
              {(['full','half-left','half-right'] as CourtMode[]).map((m,i) => (
                <button type="button" key={m} onClick={()=>setM(m)}
                  className={clsx('text-xs px-2.5 py-1.5 rounded-lg transition-colors',
                    court2===m?'bg-dj-600 text-white font-semibold':'text-white/60 hover:text-white')}>
                  {['Completa','Mitad izq.','Mitad der.'][i]}
                </button>
              ))}
            </div>
            <button type="button" onClick={undo} disabled={histIdx.current===0}
              className="text-white/50 hover:text-white disabled:opacity-20 p-1.5 rounded-lg hover:bg-white/10" title="Deshacer">
              <RotateCcw size={16}/>
            </button>
            <button type="button" onClick={clear} className="text-white/50 hover:text-red-400 p-1.5 rounded-lg hover:bg-white/10" title="Limpiar">
              <Trash2 size={16}/>
            </button>
            <button type="button" onClick={()=>onSave(cvRef.current!.toDataURL('image/png'))}
              className="bg-dj-600 hover:bg-dj-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5">
              <Download size={14}/> Guardar
            </button>
            <button type="button" onClick={onClose} className="text-white/50 hover:text-white p-1.5 rounded-lg hover:bg-white/10">
              <X size={18}/>
            </button>
          </div>
        </div>

        <div className="flex">
          {/* Panel */}
          <div className="flex flex-col gap-0.5 p-2 border-r border-white/10 overflow-y-auto" style={{width:168}}>
            <div className="px-1 pb-2 border-b border-white/10 mb-1">
              <p className="text-white/40 text-xs mb-1.5 uppercase tracking-wide">Color</p>
              <div className="flex flex-wrap gap-1.5">
                {COLORS.map(c=>(
                  <button type="button" key={c} onClick={()=>setC(c)} title={c}
                    className={clsx('w-6 h-6 rounded-full border-2 transition-transform',
                      color===c?'border-white scale-125':'border-transparent hover:scale-110')}
                    style={{backgroundColor:c}}/>
                ))}
              </div>
            </div>
            {TOOLS.map(t=>(
              <button type="button" key={t.id} onClick={()=>setT(t.id)}
                className={clsx('flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs transition-all text-left',
                  tool===t.id?'bg-dj-600 text-white font-semibold':'text-white/60 hover:text-white hover:bg-white/10')}>
                <span className="w-5 flex items-center justify-center flex-shrink-0">{t.el}</span>
                <span className="leading-tight">{t.label}</span>
              </button>
            ))}
            <button type="button" onClick={toggleEdit}
              className={clsx('mt-1 flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs transition-all text-left border',
                editMode.current?'border-dj-500 text-dj-300 bg-dj-900/60':'border-white/10 text-white/40 hover:text-white/60')}>
              <span className="w-5 flex items-center justify-center">
                <span className="w-3 h-3 rounded-full bg-white inline-block"/>
              </span>
              <span>Editar flechas</span>
            </button>
          </div>

          {/* Canvas */}
          <div className="flex-1 p-3 flex items-center justify-center bg-gray-800/30">
            <canvas ref={cvRef} width={W} height={H}
              className="rounded-xl w-full select-none"
              style={{cursor, maxHeight:'72vh'}}
              onMouseDown={down} onMouseMove={move} onMouseUp={up}
              onMouseLeave={e=>{if(drag.current.what!=='none')up(e)}}
            />
          </div>
        </div>

        <div className="px-4 py-2 border-t border-white/10 text-xs text-white/25 text-center">
          Seleccionar → mover, o apretar Supr/Delete para borrar · "Editar flechas" → arrastrar puntos de inicio, fin y curva
        </div>
      </div>
    </div>
  )
}
