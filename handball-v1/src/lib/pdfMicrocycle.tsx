import {
  Document, Page, View, Text, Image, StyleSheet, pdf,
} from '@react-pdf/renderer'
import { format } from 'date-fns'
import { CLUB_NAME } from '@/lib/constants'
import type { MicrocycleDay, ContentCategory, Subcontent } from '@/types'

const GREEN  = '#1a6b1a'
const YELLOW = '#f5c842'
const DARK   = '#1a1a1a'
const WHITE  = '#ffffff'
const LIGHT  = '#eef7ee'

const WEEK_LABELS = ['LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO', 'DOMINGO']

const CONTENT_SHORT: Record<ContentCategory, string> = {
  'Técnica individual OFENSIVA':  'TÉC IND OF',
  'Técnica individual DEFENSIVA': 'TÉC IND DEF',
  'Táctica OFENSIVA':  'TAC OF',
  'Táctica DEFENSIVA': 'TAC DEF',
  'MIXTO': 'MIXTO',
}

// Mismos colores que la pantalla, en hex (PDF no entiende clases de Tailwind)
const CONTENT_PDF_COLOR: Record<ContentCategory, string> = {
  'Técnica individual OFENSIVA':  '#125712',
  'Táctica OFENSIVA':  '#3da83d',
  'Técnica individual DEFENSIVA': '#1e3a8a',
  'Táctica DEFENSIVA': '#3b82f6',
  'MIXTO': '#4b5563',
}

export interface MicrocyclePDFInput {
  mesocycleNumber: number
  microcycleNumber: number
  weekStart: Date
  days: MicrocycleDay[]
  subcontents: Subcontent[]
}

const s = StyleSheet.create({
  page: { backgroundColor: '#2d2d2d', padding: 14, fontFamily: 'Helvetica' },

  header: {
    backgroundColor: GREEN, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', borderRadius: 8, padding: 10, marginBottom: 10,
    border: `2px solid ${YELLOW}`,
  },
  logoReal:  { width: 50, height: 50 },
  titleBox:  { flex: 1, alignItems: 'center' },
  title:     { color: YELLOW, fontSize: 18, fontFamily: 'Helvetica-Bold', textDecoration: 'underline', textAlign: 'center' },
  subtitle:  { color: WHITE, fontSize: 10, marginTop: 3 },

  grid: { flexDirection: 'row', gap: 6, flex: 1 },
  col:  { flex: 1, flexDirection: 'column' },

  dayHeader: { backgroundColor: '#1f5c1f', borderRadius: 6, paddingVertical: 6, alignItems: 'center', marginBottom: 5 },
  dayName:   { color: YELLOW, fontSize: 9, fontFamily: 'Helvetica-Bold' },
  dayDate:   { color: WHITE, fontSize: 11, fontFamily: 'Helvetica-Bold', marginTop: 1 },

  rivalImg: { width: '100%', height: 50, objectFit: 'contain', marginBottom: 4, borderRadius: 4 },

  labelsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 3, marginBottom: 4 },
  chip:      { backgroundColor: YELLOW, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 3 },
  chipText:  { color: DARK, fontSize: 7.5, fontFamily: 'Helvetica-Bold' },

  momentBox:   { backgroundColor: LIGHT, border: `1px solid ${GREEN}`, borderRadius: 5, padding: 5, marginBottom: 4 },
  momentLabel: { color: GREEN, fontSize: 7, fontFamily: 'Helvetica-Bold', marginBottom: 1 },
  momentText:  { color: DARK, fontSize: 8, lineHeight: 1.3, marginBottom: 2 },
  catBadge:    { borderRadius: 3, paddingHorizontal: 4, paddingVertical: 2, alignSelf: 'flex-start' },
  catBadgeText:{ color: WHITE, fontSize: 6.5, fontFamily: 'Helvetica-Bold' },

  emptyDay: { color: '#999', fontSize: 8, textAlign: 'center', marginTop: 10 },
})

function MomentBox({ index, content, category, subcontentLabel }: {
  index: number
  content: string
  category: ContentCategory | null
  subcontentLabel: string | null
}) {
  return (
    <View style={s.momentBox}>
      <Text style={s.momentLabel}>M{index + 1}:</Text>
      <Text style={s.momentText}>{content}</Text>
      {category && (
        <View style={[s.catBadge, { backgroundColor: CONTENT_PDF_COLOR[category] }]}>
          <Text style={s.catBadgeText}>
            {CONTENT_SHORT[category]}{subcontentLabel ? ` · ${subcontentLabel}` : ''}
          </Text>
        </View>
      )}
    </View>
  )
}

function DayCol({ label, day, subcontents }: {
  label: string; day: MicrocycleDay; subcontents: Subcontent[]
}) {
  const date = new Date(day.date + 'T12:00:00')
  // Solo se cuentan como "contenido real" los Momentos con texto o categoría asignada
  const realMoments = day.moments.filter(m => m.content.trim() || m.category)
  const hasContent = (day.labels?.length ?? 0) > 0 || realMoments.length > 0 || !!day.rival_logo_url

  return (
    <View style={s.col}>
      <View style={s.dayHeader}>
        <Text style={s.dayName}>{label}</Text>
        <Text style={s.dayDate}>{format(date, 'd/MM/yyyy')}</Text>
      </View>

      {day.rival_logo_url && (
        <Image src={day.rival_logo_url} style={s.rivalImg as Record<string, unknown>}/>
      )}

      {(day.labels?.length ?? 0) > 0 && (
        <View style={s.labelsRow}>
          {(day.labels ?? []).map((lbl, i) => (
            <View key={i} style={s.chip}>
              <Text style={s.chipText}>{lbl.toUpperCase()}</Text>
            </View>
          ))}
        </View>
      )}

      {[...realMoments].sort((a, b) => a.order - b.order).map((m, i) => (
        <MomentBox
          key={m.id}
          index={i}
          content={m.content || '—'}
          category={m.category}
          subcontentLabel={m.subcontent_id ? (subcontents.find(s => s.id === m.subcontent_id)?.label ?? null) : null}
        />
      ))}

      {!hasContent && <Text style={s.emptyDay}>—</Text>}
    </View>
  )
}

function MicrocycleDocument({ input }: { input: MicrocyclePDFInput }) {
  const logoUrl = `${window.location.origin}/logo-dj.png`

  const activeDays = input.days
    .map((day, i) => ({ day, label: WEEK_LABELS[i] }))
    .filter(({ day }) => {
      const realMoments = day.moments.filter(m => m.content.trim() || m.category)
      return (day.labels?.length ?? 0) > 0 || realMoments.length > 0 || !!day.rival_logo_url
    })

  const daysToRender = activeDays.length > 0
    ? activeDays
    : input.days.map((day, i) => ({ day, label: WEEK_LABELS[i] }))

  return (
    <Document title={`Mesociclo ${input.mesocycleNumber} - Microciclo ${input.microcycleNumber}`}>
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.header}>
          <Image src={logoUrl} style={s.logoReal as Record<string, unknown>}/>
          <View style={s.titleBox}>
            <Text style={s.title}>
              MESOCICLO {input.mesocycleNumber} | MICROCICLO {input.microcycleNumber}
            </Text>
            <Text style={s.subtitle}>{CLUB_NAME}</Text>
          </View>
          <Image src={logoUrl} style={s.logoReal as Record<string, unknown>}/>
        </View>

        <View style={s.grid}>
          {daysToRender.map(({ day, label }) => (
            <DayCol key={day.date} label={label} day={day} subcontents={input.subcontents}/>
          ))}
        </View>
      </Page>
    </Document>
  )
}

export async function downloadMicrocyclePDF(input: MicrocyclePDFInput) {
  const blob = await pdf(<MicrocycleDocument input={input}/>).toBlob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `mesociclo${input.mesocycleNumber}_microciclo${input.microcycleNumber}_${format(input.weekStart, 'yyyy-MM-dd')}.pdf`
  link.click()
  URL.revokeObjectURL(url)
}

export { MicrocycleDocument }
