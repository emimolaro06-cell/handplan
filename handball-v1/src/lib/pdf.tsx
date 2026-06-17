import {
  Document, Page, View, Text, Image, StyleSheet, pdf,
} from '@react-pdf/renderer'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import type { TrainingSession, Moment } from '@/types'
import { CLUB_NAME } from '@/lib/constants'

const GREEN  = '#1a6b1a'
const YELLOW = '#f5c842'
const DARK   = '#1a1a1a'
const WHITE  = '#ffffff'
const LIGHT  = '#f0f0f0'

const s = StyleSheet.create({
  page: { backgroundColor: '#2d2d2d', padding: 0, fontFamily: 'Helvetica' },
  header: {
    backgroundColor: GREEN, flexDirection: 'row',
    alignItems: 'stretch', borderBottom: `4px solid ${YELLOW}`, minHeight: 90,
  },
  headerLeft:   { flex: 1.4, padding: 12, borderRight: `2px solid ${YELLOW}`, justifyContent: 'center' },
  headerCenter: { flex: 2,   padding: 12, justifyContent: 'center', gap: 5 },
  headerRight:  { width: 95, padding: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: YELLOW },

  clubName:     { color: WHITE,  fontSize: 16, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5 },
  sessionLabel: { color: YELLOW, fontSize: 20, fontFamily: 'Helvetica-Bold', marginTop: 4, textDecoration: 'underline' },
  tagRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 },
  tag:          { backgroundColor: YELLOW, color: DARK, fontSize: 10, fontFamily: 'Helvetica-Bold', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },

  dateRow:    { flexDirection: 'row', gap: 8, marginBottom: 4 },
  dateLabel:  { color: YELLOW, fontSize: 13, fontFamily: 'Helvetica-Bold' },
  dateValue:  { color: WHITE,  fontSize: 13, fontFamily: 'Helvetica-Bold' },
  contentRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  contentLabel: { color: YELLOW, fontSize: 12, fontFamily: 'Helvetica-Bold' },
  contentBox:   { backgroundColor: WHITE, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 3, flex: 1 },
  contentText:  { color: DARK, fontSize: 11, fontFamily: 'Helvetica-Bold' },
  objectiveText: { color: WHITE, fontSize: 10, marginTop: 3 },

  logoReal: { width: 85, height: 85 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: 7, gap: 7 },
  momentBox: { width: '48.7%', backgroundColor: LIGHT, borderRadius: 4, overflow: 'hidden', border: `1px solid #888` },

  momentHeader: { backgroundColor: DARK, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, paddingVertical: 6, gap: 6 },
  momentHeaderText:  { color: WHITE, fontSize: 10, fontFamily: 'Helvetica-Bold', flex: 1 },
  momentHeaderBadge: { backgroundColor: YELLOW, color: DARK, fontSize: 8, fontFamily: 'Helvetica-Bold', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 3 },

  momentBody: { flexDirection: 'row', minHeight: 115, maxHeight: 140 },
  momentImage: { width: 135, height: 130, objectFit: 'contain', backgroundColor: '#1a4a1a' },
  momentImagePlaceholder: { width: 135, height: 130, backgroundColor: '#1a4a1a', alignItems: 'center', justifyContent: 'center' },
  momentImagePlaceholderText: { color: '#4a8a4a', fontSize: 9, textAlign: 'center' },

  momentContent:   { flex: 1, padding: 7 },
  momentLabel:     { color: '#1a6b1a', fontSize: 9,  fontFamily: 'Helvetica-Bold', marginBottom: 3 },
  momentDesc:      { color: DARK,      fontSize: 10, lineHeight: 1.4, marginBottom: 4 },
  momentObs:       { color: '#555',    fontSize: 9,  lineHeight: 1.3, fontStyle: 'italic' },
  momentObsLabel:  { color: '#333',    fontSize: 9,  fontFamily: 'Helvetica-Bold' },
})

function MomentoBlock({ moment, index, coachName }: {
  moment: Moment; index: number; coachName: string
}) {
  return (
    <View style={s.momentBox}>
      <View style={s.momentHeader}>
        <Text style={s.momentHeaderText}>
          MOMENTO: {index + 1}{'  '}TIEMPO: {moment.duration_min} MIN{'  '}PROFE: {coachName}
        </Text>
        {moment.exercise_category && (
          <Text style={s.momentHeaderBadge}>{moment.exercise_category.toUpperCase()}</Text>
        )}
      </View>
      <View style={s.momentBody}>
        {moment.image_url ? (
          <Image src={moment.image_url} style={s.momentImage as Record<string,unknown>}/>
        ) : (
          <View style={s.momentImagePlaceholder}>
            <Text style={s.momentImagePlaceholderText}>Sin imagen</Text>
          </View>
        )}
        <View style={s.momentContent}>
          {moment.exercise_label && <Text style={s.momentLabel}>{moment.exercise_label}</Text>}
          <Text style={s.momentDesc}>{moment.description || '—'}</Text>
          {moment.observations ? (
            <>
              <Text style={s.momentObsLabel}>Observaciones:</Text>
              <Text style={s.momentObs}>{moment.observations}</Text>
            </>
          ) : null}
        </View>
      </View>
    </View>
  )
}

function TrainingDocument({ session }: { session: TrainingSession }) {
  const date   = parseISO(session.session_date)
  const dayStr = format(date, "EEEE d/MM", { locale: es })
  const monStr = format(date, "MMMM", { locale: es }).toUpperCase()
  const uniqueCats = Array.from(new Set(session.moments.map(m => m.exercise_category).filter(Boolean)))
  const sorted = [...session.moments].sort((a, b) => a.order_index - b.order_index)
  const logoUrl = `${window.location.origin}/logo-dj.png`

  return (
    <Document title={`Entrenamiento ${session.team_category} - Sesión ${session.session_number}`}>
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.header}>
          <View style={s.headerLeft}>
            <Text style={s.clubName}>{CLUB_NAME}</Text>
            <Text style={s.sessionLabel}>Sesión: {session.session_number}</Text>
            <View style={s.tagRow}>
              {uniqueCats.map(cat => <Text key={cat} style={s.tag}>{(cat as string).toUpperCase()}</Text>)}
            </View>
          </View>
          <View style={s.headerCenter}>
            <View style={s.dateRow}>
              <Text style={s.dateLabel}>Día:</Text>
              <Text style={s.dateValue}>{dayStr.charAt(0).toUpperCase() + dayStr.slice(1)}</Text>
              <Text style={s.dateLabel}>   Mes:</Text>
              <Text style={s.dateValue}>{monStr}</Text>
            </View>
            <View style={s.contentRow}>
              <Text style={s.contentLabel}>Contenido:</Text>
              <View style={s.contentBox}>
                <Text style={s.contentText}>{session.content_category}</Text>
              </View>
            </View>
            <Text style={s.objectiveText}>
              {'Categoría: '}<Text style={{ fontFamily:'Helvetica-Bold' }}>{session.team_category}</Text>
              {'   Prof.: '}<Text style={{ fontFamily:'Helvetica-Bold' }}>{session.coach_name}</Text>
            </Text>
            {session.general_objective
              ? <Text style={s.objectiveText}>{'Objetivo: '}{session.general_objective}</Text>
              : null}
          </View>
          <View style={s.headerRight}>
            <Image src={logoUrl} style={s.logoReal as Record<string,unknown>}/>
          </View>
        </View>
        <View style={s.grid}>
          {sorted.map((m, i) => (
            <MomentoBlock key={m.id} moment={m} index={i} coachName={session.coach_name}/>
          ))}
        </View>
      </Page>
    </Document>
  )
}

export async function downloadTrainingPDF(session: TrainingSession) {
  const blob = await pdf(<TrainingDocument session={session}/>).toBlob()
  const url  = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href     = url
  link.download = `sesion_${session.session_number}_${session.team_category}_${session.session_date}.pdf`
  link.click()
  URL.revokeObjectURL(url)
}

export async function getPDFBlob(session: TrainingSession): Promise<Blob> {
  return pdf(<TrainingDocument session={session}/>).toBlob()
}

export { TrainingDocument }
