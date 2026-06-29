import { Document, Page, View, Text, Image, StyleSheet, pdf } from '@react-pdf/renderer'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import { CLUB_NAME } from '@/lib/constants'
import type { ContentCategory, Account } from '@/types'

const GREEN_DEFAULT = '#1a6b1a'
const YELLOW = '#f5c842'
const DARK   = '#1a1a1a'
const WHITE  = '#ffffff'

// Gris preestablecido para cuentas sin marca propia
const GRAY_SECONDARY = '#9ca3af'

const CONTENT_SHORT: Record<ContentCategory, string> = {
  'Técnica individual OFENSIVA':  'TÉC IND OF',
  'Técnica individual DEFENSIVA': 'TÉC IND DEF',
  'Táctica OFENSIVA':  'TAC OF',
  'Táctica DEFENSIVA': 'TAC DEF',
  'MIXTO': 'MIXTO',
  'Gimnasio': 'GIMNASIO',
  'Habilidades': 'HABILIDADES',
  'Condición Física': 'COND. FÍSICA',
  'Evaluaciones Físicas': 'EVAL. FÍSICA',
}

const CONTENT_BG: Record<ContentCategory, string> = {
  'Técnica individual OFENSIVA':  '#166f16',
  'Técnica individual DEFENSIVA': '#1d4ed8',
  'Táctica OFENSIVA':  '#b45309',
  'Táctica DEFENSIVA': '#7c3aed',
  'MIXTO': '#4b5563',
  'Gimnasio': '#a5b4fc',
  'Habilidades': '#6366f1',
  'Condición Física': '#3730a3',
  'Evaluaciones Físicas': '#dc2626',
}

function buildStyles(green: string, secondary: string) {
  return StyleSheet.create({
    page: { backgroundColor: '#f5f5f5', padding: 0, fontFamily: 'Helvetica' },
    header: {
      backgroundColor: green,
      flexDirection: 'row',
      alignItems: 'center',
      padding: 10,
      borderBottom: `3px solid ${secondary}`,
    },
    headerLeft: { flex: 1 },
    clubName: { color: WHITE, fontSize: 12, fontFamily: 'Helvetica-Bold' },
    monthTitle: { color: secondary, fontSize: 16, fontFamily: 'Helvetica-Bold', marginTop: 2 },
    headerRight: { width: 70, alignItems: 'center', justifyContent: 'center', backgroundColor: WHITE, borderRadius: 8, padding: 4 },
    logo: { width: 62, height: 62 },

    body: { flexDirection: 'row', flex: 1, padding: 8, gap: 8 },

    sidebar: { width: 110 },
    sidebarCard: { backgroundColor: WHITE, borderRadius: 6, padding: 8, marginBottom: 6, border: `1px solid #ddd` },
    sidebarTitle: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: green, textTransform: 'uppercase', marginBottom: 4 },
    sidebarText: { fontSize: 7, color: DARK, lineHeight: 1.4 },

    calendar: { flex: 1 },
    dayHeaders: { flexDirection: 'row', marginBottom: 3 },
    dayHeader: { flex: 1, textAlign: 'center', fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#555', textTransform: 'uppercase' },
    dayHeaderWeekend: { flex: 1, textAlign: 'center', fontSize: 7, fontFamily: 'Helvetica-Bold', color: green, textTransform: 'uppercase' },

    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
    dayCell: { width: '13.8%', minHeight: 55, backgroundColor: WHITE, borderRadius: 4, border: `1px solid #ddd`, padding: 3 },
    dayCellWeekend: { width: '13.8%', minHeight: 55, backgroundColor: '#f0faf0', borderRadius: 4, border: `1px solid #c8e6c9`, padding: 3 },
    dayCellOtherMonth: { width: '13.8%', minHeight: 55, backgroundColor: '#f9f9f9', borderRadius: 4, border: `1px solid #eee`, padding: 3, opacity: 0.4 },
    dayNum: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: DARK, marginBottom: 2 },
    dayNumWeekend: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: green, marginBottom: 2 },
    chip: { borderRadius: 3, paddingHorizontal: 3, paddingVertical: 1, marginBottom: 1.5 },
    chipText: { fontSize: 5.5, fontFamily: 'Helvetica-Bold', color: WHITE },
    noteChip: { backgroundColor: '#fef3c7', borderRadius: 3, paddingHorizontal: 3, paddingVertical: 1, marginBottom: 1.5 },
    noteText: { fontSize: 5.5, color: '#92400e' },
  })
}

const DAYS_ES = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB']

export function MonthlyDocument({ plan, date, account }: {
  plan: Record<string, unknown>; date: Date; account?: Account | null
}) {
  const monthStart = startOfMonth(date)
  const monthEnd   = endOfMonth(date)
  const calStart   = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calEnd     = endOfWeek(monthEnd,   { weekStartsOn: 0 })
  const calDays    = eachDayOfInterval({ start: calStart, end: calEnd })

  const accountName = account?.name || CLUB_NAME
  const logoUrl = account?.logo_url || `${window.location.origin}/logo-handplan.png`
  const green = account?.primary_color || GREEN_DEFAULT
  const isDyJ = !account || account.primary_color === GREEN_DEFAULT
  const secondary = isDyJ ? YELLOW : GRAY_SECONDARY
  const s = buildStyles(green, secondary)

  const days = (plan.days ?? {}) as Record<string, { contents: ContentCategory[]; note: string }>

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <Text style={s.clubName}>{accountName}</Text>
            <Text style={s.monthTitle}>
              {format(date, "MMMM yyyy", { locale: es }).toUpperCase()} — {plan.team_category as string}
            </Text>
          </View>
          <View style={s.headerRight}>
            <Image src={logoUrl} style={s.logo as Record<string,unknown>}/>
          </View>
        </View>

        <View style={s.body}>
          {/* Sidebar */}
          <View style={s.sidebar}>
            {(plan.rivals as string) ? (
              <View style={s.sidebarCard}>
                <Text style={s.sidebarTitle}>Rivales</Text>
                <Text style={s.sidebarText}>{plan.rivals as string}</Text>
              </View>
            ) : null}
            {(plan.monthly_contents as string) ? (
              <View style={s.sidebarCard}>
                <Text style={s.sidebarTitle}>Contenidos</Text>
                <Text style={s.sidebarText}>{plan.monthly_contents as string}</Text>
              </View>
            ) : null}
            {(plan.observations as string) ? (
              <View style={s.sidebarCard}>
                <Text style={s.sidebarTitle}>Observaciones</Text>
                <Text style={s.sidebarText}>{plan.observations as string}</Text>
              </View>
            ) : null}

            {/* Referencias */}
            <View style={s.sidebarCard}>
              <Text style={s.sidebarTitle}>Referencias</Text>
              {(Object.entries(CONTENT_SHORT) as [ContentCategory, string][]).map(([cat, short]) => (
                <View key={cat} style={[s.chip, { backgroundColor: CONTENT_BG[cat], marginBottom: 3 }]}>
                  <Text style={s.chipText}>{short}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Calendario */}
          <View style={s.calendar}>
            <View style={s.dayHeaders}>
              {DAYS_ES.map((d, i) => (
                <Text key={d} style={i === 0 || i === 6 ? s.dayHeaderWeekend : s.dayHeader}>{d}</Text>
              ))}
            </View>
            <View style={s.grid}>
              {calDays.map(day => {
                const key = format(day, 'yyyy-MM-dd')
                const dayData = days[key] ?? { contents: [], note: '' }
                const inMonth = isSameMonth(day, date)
                const isWeekend = day.getDay() === 0 || day.getDay() === 6
                const cellStyle = !inMonth ? s.dayCellOtherMonth : isWeekend ? s.dayCellWeekend : s.dayCell
                const numStyle  = isWeekend && inMonth ? s.dayNumWeekend : s.dayNum

                return (
                  <View key={key} style={cellStyle}>
                    <Text style={numStyle}>{format(day, 'd')}</Text>
                    {dayData.contents.map((c: ContentCategory) => (
                      <View key={c} style={[s.chip, { backgroundColor: CONTENT_BG[c] }]}>
                        <Text style={s.chipText}>{CONTENT_SHORT[c]}</Text>
                      </View>
                    ))}
                    {dayData.note ? (
                      <View style={s.noteChip}>
                        <Text style={s.noteText}>{dayData.note}</Text>
                      </View>
                    ) : null}
                  </View>
                )
              })}
            </View>
          </View>
        </View>
      </Page>
    </Document>
  )
}

export async function downloadMonthlyPDF(plan: Record<string, unknown>, date: Date, account?: Account | null) {
  const blob = await pdf(<MonthlyDocument plan={plan} date={date} account={account}/>).toBlob()
  const url  = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href     = url
  link.download = `planificacion_${plan.team_category}_${format(date, 'yyyy-MM')}.pdf`
  link.click()
  URL.revokeObjectURL(url)
}
