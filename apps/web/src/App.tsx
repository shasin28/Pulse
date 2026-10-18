import { useEffect, useRef, useState } from 'react'
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight,
  Bell, Bot, Check, CheckCircle2, ChevronDown, ChevronUp,
  ClipboardCheck, Clock3, Filter, Gauge, Menu, MoreHorizontal,
  Package, Radio, Search, Send, Settings2, ShieldCheck,
  SlidersHorizontal, Sparkles, Thermometer, TrendingDown, TrendingUp,
  Waves, Wrench, X, Zap,
} from 'lucide-react'
import {
  Area, CartesianGrid, ComposedChart, Line, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { QRCodeSVG } from 'qrcode.react'

// ── Types ──────────────────────────────────────────────────────────────────
type NavItem = 'Overview' | 'Assets' | 'Alerts' | 'Work orders'
type PlanKey = 'immediate' | 'reduced' | 'tomorrow'
type LiveReading = { vibration: number; temperature: number; current: number; pressure: number; anomalyScore: number }
type CopilotMsg = { role: 'user' | 'assistant'; content: string; sources?: string[]; confidence?: string }
type ApiAlert = {
  id: string; assetId: string; title: string; explanation: string; confidencePercent: number;
  estimatedTimeToFailure: string; status: string; possibleFailureModes: string[];
  vibration: { value: number; unit: string; changePercent: number };
  bearingTemperature: { value: number; unit: string; changePercent: number };
  motorCurrent: { value: number; unit: string; changePercent: number };
}
type ApiWorkOrder = {
  id: string; assetId: string; task: string; maintenanceWindow: string; status: string;
  requiredSkill: string; estimatedHours: number; partNumber: string; quantity: number;
  safetyChecks: string[]; requiredApprovals: string[]; technicianObservation: string;
  createdAt: string;
}
type ApiEvent = { id: string; type: string; assetId: string; message: string; severity: string; occurredAt: string }

// ── Static Data ────────────────────────────────────────────────────────────
const trendData = [
  { day: 'Mon', vibration: 3.1, temperature: 62, current: 41 },
  { day: 'Tue', vibration: 3.2, temperature: 63, current: 42 },
  { day: 'Wed', vibration: 3.5, temperature: 64, current: 41 },
  { day: 'Thu', vibration: 3.9, temperature: 66, current: 43 },
  { day: 'Fri', vibration: 4.5, temperature: 68, current: 44 },
  { day: 'Sat', vibration: 5.2, temperature: 71, current: 46 },
  { day: 'Sun', vibration: 5.8, temperature: 73, current: 47 },
]

const plans: { key: PlanKey; title: string; time: string; description: string; tag?: string; tone: string }[] = [
  { key: 'immediate', title: 'Stop immediately', time: 'Now', description: 'Lowest equipment risk. Standby pump unavailable.', tag: 'Not preferred', tone: 'coral' },
  { key: 'reduced', title: 'Reduce load, then repair', time: 'Today · 18:00', description: 'Standby returns at 17:00. Hot work clears at 16:30.', tag: 'Recommended', tone: 'green' },
  { key: 'tomorrow', title: 'Schedule for tomorrow', time: 'Tomorrow · 08:00', description: 'Best staffing. Longer degradation exposure.', tag: 'More exposure', tone: 'amber' },
]

const ALL_ASSETS = [
  { id: 'P-101A', name: 'Primary transfer pump', area: 'Production · Line 2', state: 'Degrading', tone: 'degrading', availability: '94.2%', service: 'Jan 12, 2026', owner: 'MC', ownerName: 'Maya Chen', healthScore: 68, alerts: 1 },
  { id: 'P-101B', name: 'Standby transfer pump', area: 'Production · Line 2', state: 'Healthy', tone: 'healthy', availability: '99.8%', service: 'Mar 04, 2026', owner: 'JR', ownerName: 'James Reed', healthScore: 21, alerts: 0 },
  { id: 'M-204',  name: 'Mixer drive motor',     area: 'Blending · Line 1',  state: 'Healthy', tone: 'healthy', availability: '98.7%', service: 'Feb 21, 2026', owner: 'AK', ownerName: 'A. Kumar',    healthScore: 18, alerts: 0 },
  { id: 'C-312',  name: 'Cooling water compressor', area: 'Utilities · East', state: 'Monitor', tone: 'monitor', availability: '96.1%', service: 'Dec 18, 2025', owner: 'JR', ownerName: 'James Reed', healthScore: 44, alerts: 1 },
  { id: 'F-118',  name: 'Process feed filter',   area: 'Production · Line 3', state: 'Healthy', tone: 'healthy', availability: '99.5%', service: 'Apr 02, 2026', owner: 'MC', ownerName: 'Maya Chen', healthScore: 14, alerts: 0 },
  { id: 'HX-207', name: 'Heat exchanger unit',   area: 'Utilities · West',   state: 'Healthy', tone: 'healthy', availability: '98.1%', service: 'Mar 15, 2026', owner: 'AK', ownerName: 'A. Kumar',    healthScore: 22, alerts: 0 },
  { id: 'V-305',  name: 'Storage vessel agitator', area: 'Blending · Line 2', state: 'Healthy', tone: 'healthy', availability: '99.9%', service: 'May 01, 2026', owner: 'JR', ownerName: 'James Reed', healthScore: 11, alerts: 0 },
  { id: 'P-201A', name: 'Secondary cooling pump', area: 'Utilities · East',  state: 'Healthy', tone: 'healthy', availability: '98.6%', service: 'Feb 08, 2026', owner: 'MC', ownerName: 'Maya Chen', healthScore: 19, alerts: 0 },
]

const SUGGESTED_QUESTIONS = [
  'Why is 9 bar normal for this pump?',
  'How serious is the vibration trend?',
  'When will the bearing fail?',
  'Is the standby pump available?',
  'What parts do we need?',
  'What should we do now?',
]

const initialHistory: LiveReading[] = Array.from({ length: 15 }, (_, i) => ({
  vibration: 3.1 + i * 0.18,
  temperature: 62 + i * 0.73,
  current: 41 + i * 0.4,
  pressure: 9.0 + Math.sin(i * 0.5) * 0.05,
  anomalyScore: 35 + i * 2.2,
}))

function statusLabel(s: string) {
  const map: Record<string, string> = { DRAFT: 'Draft', APPROVED: 'Approved', IN_PROGRESS: 'In Progress', COMPLETED: 'Completed' }
  return map[s] ?? s
}
function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

// ── Sparkline ──────────────────────────────────────────────────────────────
function Sparkline({ data, color, height = 24, width = 52 }: { data: number[]; color: string; height?: number; width?: number }) {
  if (data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / range) * height
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

// ── ChartTooltip ───────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { dataKey: string; value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <strong>{label}</strong>
      {payload.map((item) => (
        <span key={item.dataKey}>
          {item.dataKey === 'vibration' ? 'Vibration' : item.dataKey === 'temperature' ? 'Bearing temp' : 'Motor current'}
          {' '}<b>{item.value}{item.dataKey === 'vibration' ? ' mm/s' : item.dataKey === 'temperature' ? '°C' : ' A'}</b>
        </span>
      ))}
    </div>
  )
}

// ── LiveSensorPanel ────────────────────────────────────────────────────────
function LiveSensorPanel({ live, history, liveAge, flash }: {
  live: LiveReading; history: LiveReading[]; liveAge: number; flash: Record<string, boolean>
}) {
  const cards = [
    { key: 'vibration', label: 'VIBRATION · DE', value: live.vibration, unit: 'mm/s', prev: history.at(-2)?.vibration ?? live.vibration, data: history.map(h => h.vibration), warn: live.vibration > 4.2, color: '#db7657', baseline: '3.2–4.2' },
    { key: 'temperature', label: 'BEARING TEMP', value: live.temperature, unit: '°C', prev: history.at(-2)?.temperature ?? live.temperature, data: history.map(h => h.temperature), warn: live.temperature > 70, color: '#c9963a', baseline: '62–68' },
    { key: 'current', label: 'MOTOR CURRENT', value: live.current, unit: 'A', prev: history.at(-2)?.current ?? live.current, data: history.map(h => h.current), warn: live.current > 45, color: '#507b8a', baseline: '41–45' },
    { key: 'pressure', label: 'PRESSURE', value: live.pressure, unit: 'bar', prev: history.at(-2)?.pressure ?? live.pressure, data: history.map(h => h.pressure), warn: false, color: '#5e9468', baseline: '8.5–9.5' },
  ]

  return (
    <section className="live-sensor-panel">
      <div className="live-panel-head">
        <div className="live-panel-title">
          <span className="live-badge"><Radio size={10} /> LIVE</span>
          <strong>Signal monitor · P-101A</strong>
          <span className="live-sub">Compared against 6-month learned baseline</span>
        </div>
        <span className="live-age">{liveAge < 5 ? 'Updated just now' : `Updated ${liveAge}s ago`}</span>
      </div>
      <div className="sensor-cards">
        {cards.map(c => {
          const up = c.value > c.prev
          const Icon = c.key === 'temperature' ? Thermometer : c.key === 'current' ? Zap : c.key === 'pressure' ? Gauge : Activity
          return (
            <div key={c.key} className={`sensor-card ${c.warn ? 'sensor-warn' : 'sensor-ok'} ${flash[c.key] ? 'sensor-flash' : ''}`}>
              <div className="sensor-top">
                <span className="sensor-label"><Icon size={10} /> {c.label}</span>
                <Sparkline data={c.data} color={c.color} />
              </div>
              <div className="sensor-value">{c.value}<span className="sensor-unit">{c.unit}</span></div>
              <div className="sensor-foot">
                <span className={`sensor-trend ${c.warn ? 'trend-warn' : 'trend-ok'}`}>
                  {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                  {c.key === 'pressure' ? 'Stable' : up ? 'Rising' : 'Falling'}
                </span>
                <span className="sensor-baseline">baseline {c.baseline} {c.unit}</span>
              </div>
              {c.key === 'pressure' && <span className="sensor-learned-tag"><Check size={10} /> Learned norm</span>}
            </div>
          )
        })}
      </div>
      <div className="anomaly-bar-row">
        <span className="anomaly-label">ANOMALY SCORE</span>
        <div className="anomaly-track">
          <div className="anomaly-fill" style={{ width: `${live.anomalyScore}%` }} />
          <span className="anomaly-zones">
            <span style={{ left: '40%' }} />
            <span style={{ left: '70%' }} />
          </span>
        </div>
        <span className="anomaly-val">{live.anomalyScore}<span>/100</span></span>
        <span className={`anomaly-status ${live.anomalyScore > 70 ? 'status-high' : live.anomalyScore > 40 ? 'status-med' : 'status-low'}`}>
          {live.anomalyScore > 70 ? 'HIGH RISK' : live.anomalyScore > 40 ? 'AT RISK' : 'NORMAL'}
        </span>
      </div>
    </section>
  )
}

// ── CopilotPanel ───────────────────────────────────────────────────────────
function CopilotPanel({ isOpen, messages, loading, input, onInputChange, onSend, onSuggest, onClose, endRef }: {
  isOpen: boolean; messages: CopilotMsg[]; loading: boolean; input: string;
  onInputChange: (v: string) => void; onSend: () => void; onSuggest: (q: string) => void;
  onClose: () => void; endRef: React.RefObject<HTMLDivElement>
}) {
  if (!isOpen) return null
  return (
    <div className="copilot-overlay">
      <div className="copilot-panel">
        <div className="copilot-header">
          <div className="copilot-title">
            <span className="copilot-icon"><Sparkles size={15} /></span>
            <div>
              <strong>Pulse AI</strong>
              <small>Gemini on Vertex AI · Grounded in operational data</small>
            </div>
          </div>
          <button className="icon-button" onClick={onClose}><X size={17} /></button>
        </div>
        <div className="copilot-context">
          <span className="context-chip"><Activity size={10} /> P-101A · Bearing degradation alert</span>
          <span className="context-chip gcp-chip">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5z" fill="#4285F4"/><path d="M2 17l10 5 10-5" stroke="#34A853" strokeWidth="2" fill="none"/>
              <path d="M2 12l10 5 10-5" stroke="#FBBC05" strokeWidth="2" fill="none"/>
            </svg>
            Vertex AI
          </span>
        </div>
        <div className="copilot-messages">
          {messages.length === 0 && (
            <div className="copilot-welcome">
              <div className="welcome-icon"><Bot size={22} /></div>
              <p>Ask me anything about P-101A — evidence, history, recommendations, or what to do next.</p>
              <div className="suggested-list">
                {SUGGESTED_QUESTIONS.map(q => (
                  <button key={q} className="suggested-q" onClick={() => onSuggest(q)}>{q}</button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`chat-msg ${msg.role}`}>
              {msg.role === 'assistant' && <span className="msg-avatar"><Sparkles size={12} /></span>}
              <div className="msg-bubble">
                <p>{msg.content}</p>
                {msg.sources && msg.sources.length > 0 && (
                  <div className="msg-sources">
                    {msg.sources.map(s => <span key={s} className="source-tag">{s}</span>)}
                  </div>
                )}
                {msg.confidence && <span className="msg-confidence">{msg.confidence} confidence</span>}
              </div>
            </div>
          ))}
          {loading && (
            <div className="chat-msg assistant">
              <span className="msg-avatar"><Sparkles size={12} /></span>
              <div className="msg-bubble typing-bubble">
                <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
        <div className="copilot-input">
          <input
            type="text"
            placeholder="Ask about evidence, history, or next steps…"
            value={input}
            onChange={e => onInputChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !loading) onSend() }}
          />
          <button className="send-button" onClick={onSend} disabled={loading || !input.trim()}>
            <Send size={15} />
          </button>
        </div>
        <div className="copilot-footer">
          <ShieldCheck size={11} /> Grounded in asset records, manuals, and maintenance history via BigQuery
        </div>
      </div>
    </div>
  )
}

// ── Main App ───────────────────────────────────────────────────────────────
function App() {
  // Navigation
  const [activeNav, setActiveNav] = useState<NavItem>('Overview')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Overview
  const [activePlan, setActivePlan] = useState<PlanKey>('reduced')
  const [observation, setObservation] = useState('The drive-end bearing sounds rough. Check alignment before replacing the bearing.')
  const [validated, setValidated] = useState(false)
  const [workOrderCreated, setWorkOrderCreated] = useState(false)
  const [workOrderId, setWorkOrderId] = useState('WO-2481')
  const [createdWindow, setCreatedWindow] = useState('Today at 18:00')
  const [submitting, setSubmitting] = useState(false)
  const [showAllAssets, setShowAllAssets] = useState(false)

  // Live sensors
  const [live, setLive] = useState<LiveReading>({ vibration: 5.8, temperature: 73, current: 47, pressure: 9.0, anomalyScore: 68 })
  const [liveHistory, setLiveHistory] = useState<LiveReading[]>(initialHistory)
  const [liveAge, setLiveAge] = useState(0)
  const [liveFlash, setLiveFlash] = useState<Record<string, boolean>>({})

  // Copilot
  const [copilotOpen, setCopilotOpen] = useState(false)
  const [copilotInput, setCopilotInput] = useState('')
  const [messages, setMessages] = useState<CopilotMsg[]>([])
  const [copilotLoading, setCopilotLoading] = useState(false)
  const copilotEndRef = useRef<HTMLDivElement>(null)

  // Alerts page
  const [alertFilter, setAlertFilter] = useState('Active')
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null)
  const [apiAlerts, setApiAlerts] = useState<ApiAlert[]>([])

  // Work orders page
  const [woFilter, setWoFilter] = useState('All')
  const [apiWorkOrders, setApiWorkOrders] = useState<ApiWorkOrder[]>([])
  const [expandedWo, setExpandedWo] = useState<string | null>(null)
  const [closingWo, setClosingWo] = useState<string | null>(null)
  const [outcomeNote, setOutcomeNote] = useState('')

  // Assets page
  const [assetFilter, setAssetFilter] = useState('All')

  // Events
  const [events, setEvents] = useState<ApiEvent[]>([])

  // Toast
  const [notice, setNotice] = useState('')

  // ── Effects ────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchLive = async () => {
      try {
        const res = await fetch('/api/sensors/P-101A/live')
        if (!res.ok) return
        const d = await res.json()
        const reading: LiveReading = { vibration: d.vibration, temperature: d.bearingTemperature, current: d.motorCurrent, pressure: d.pressure, anomalyScore: d.anomalyScore }
        setLive(prev => {
          const changed: Record<string, boolean> = {}
          if (Math.abs(d.vibration - prev.vibration) > 0.04) changed.vibration = true
          if (Math.abs(d.bearingTemperature - prev.temperature) > 0.1) changed.temperature = true
          if (Math.abs(d.motorCurrent - prev.current) > 0.1) changed.current = true
          setLiveFlash(changed)
          setTimeout(() => setLiveFlash({}), 700)
          return reading
        })
        setLiveHistory(h => [...h.slice(-14), reading])
        setLiveAge(0)
      } catch { /* offline — keep last reading */ }
    }
    fetchLive()
    const pollInterval = setInterval(fetchLive, 3000)
    const ageInterval = setInterval(() => setLiveAge(a => a + 1), 1000)
    return () => { clearInterval(pollInterval); clearInterval(ageInterval) }
  }, [])

  useEffect(() => {
    fetch('/api/alerts').then(r => r.json()).then(setApiAlerts).catch(() => {})
    fetch('/api/work-orders').then(r => r.json()).then(setApiWorkOrders).catch(() => {})
    fetch('/api/events').then(r => r.json()).then(setEvents).catch(() => {})
  }, [])

  useEffect(() => {
    copilotEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Actions ────────────────────────────────────────────────────────────
  function showNotice(msg: string) {
    setNotice(msg)
    setTimeout(() => setNotice(''), 4000)
  }

  async function validateDiagnosis() {
    setSubmitting(true)
    try {
      const res = await fetch('/api/alerts/P-101A/validation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ technician: 'Maya Chen', diagnosis: 'Bearing degradation; verify alignment', observation, action: 'CONFIRM_DIAGNOSIS' }),
      })
      if (!res.ok) throw new Error()
      setValidated(true)
      showNotice('Technician validation added to alert history.')
    } catch { showNotice('Could not reach Pulse API. Start the API service and try again.') }
    finally { setSubmitting(false) }
  }

  async function createWorkOrder() {
    if (workOrderCreated) return
    setSubmitting(true)
    const windows: Record<PlanKey, string> = { immediate: 'Today · Immediate', reduced: 'Today · 18:00', tomorrow: 'Tomorrow · 08:00' }
    try {
      const res = await fetch('/api/work-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: activePlan, window: windows[activePlan], technician: 'Maya Chen', technicianObservation: observation }),
      })
      if (!res.ok) throw new Error()
      const order: { id: string } = await res.json()
      setWorkOrderId(order.id)
      setCreatedWindow(windows[activePlan].replace(' · ', ' at '))
      setWorkOrderCreated(true)
      showNotice(`Draft work order ${order.id} is ready for review.`)
      fetch('/api/work-orders').then(r => r.json()).then(setApiWorkOrders).catch(() => {})
    } catch { showNotice('Could not reach Pulse API. Start the API service and try again.') }
    finally { setSubmitting(false) }
  }

  async function askCopilot(question?: string) {
    const q = question ?? copilotInput
    if (!q.trim() || copilotLoading) return
    setCopilotInput('')
    setMessages(m => [...m, { role: 'user', content: q }])
    setCopilotLoading(true)
    try {
      const res = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, context: 'P-101A bearing degradation alert ALT-1042' }),
      })
      if (!res.ok) throw new Error()
      const d = await res.json()
      setMessages(m => [...m, { role: 'assistant', content: d.answer, sources: d.sources, confidence: d.confidence }])
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: 'Unable to reach Pulse AI. Please check the API connection.' }])
    } finally { setCopilotLoading(false) }
  }

  async function closeWorkOrder(id: string) {
    if (!outcomeNote.trim()) { showNotice('Add an actual finding before closing.'); return }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/work-orders/${id}/outcome`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actualFinding: outcomeNote, actionTaken: 'Bearing inspection and replacement', partConsumed: 'BRG-6208', predictionCorrect: true }),
      })
      if (!res.ok) throw new Error()
      setApiWorkOrders(prev => prev.map(wo => wo.id === id ? { ...wo, status: 'COMPLETED' } : wo))
      setClosingWo(null)
      setOutcomeNote('')
      showNotice(`Work order ${id} closed. Outcome recorded for learning.`)
    } catch { showNotice('Could not close work order. Check the API connection.') }
    finally { setSubmitting(false) }
  }

  // ── Nav items ──────────────────────────────────────────────────────────
  const navItems: { label: NavItem; icon: typeof Gauge; count?: string }[] = [
    { label: 'Overview', icon: Gauge },
    { label: 'Assets', icon: Activity, count: '8' },
    { label: 'Alerts', icon: AlertTriangle, count: '3' },
    { label: 'Work orders', icon: ClipboardCheck, count: '4' },
  ]

  // ── Pages ──────────────────────────────────────────────────────────────
  function OverviewPage() {
    return (
      <>
        <section className="page-heading">
          <div>
            <div className="eyebrow"><span className="eyebrow-line" /> FRIDAY, OCTOBER 16, 2026 <span className="eyebrow-separator">·</span> NORTHLINE 04</div>
            <h1>Good morning, Maya<span className="heading-dot">.</span></h1>
            <p className="page-subtitle">Here's the reliability picture for your site today.</p>
          </div>
          <div className="heading-actions">
            <button className="ai-copilot-trigger" onClick={() => setCopilotOpen(true)}>
              <Sparkles size={14} /> Ask Pulse AI
            </button>
            <button className="outline-button"><SlidersHorizontal size={15} /> Customize view</button>
          </div>
        </section>

        <section className="metric-grid" aria-label="Plant summary">
          <article className="metric-card metric-alerts">
            <div className="metric-top"><span>Active alerts</span><span className="metric-icon coral-icon"><AlertTriangle size={17} /></span></div>
            <div className="metric-value">03 <span className="metric-trend trend-up"><ArrowUpRight size={13} /> 1</span></div>
            <div className="metric-foot"><span className="severity-dot" /> 1 needs attention today</div>
          </article>
          <article className="metric-card">
            <div className="metric-top"><span>Asset availability</span><span className="metric-icon green-icon"><Activity size={17} /></span></div>
            <div className="metric-value">96.8<span className="metric-unit">%</span><span className="metric-trend trend-up"><ArrowUpRight size={13} /> 2.4%</span></div>
            <div className="metric-foot"><span className="metric-neutral">↑ 2.4%</span> vs. last 30 days</div>
          </article>
          <article className="metric-card">
            <div className="metric-top"><span>Ready to schedule</span><span className="metric-icon amber-icon"><Wrench size={17} /></span></div>
            <div className="metric-value">07 <span className="metric-unit metric-small-unit">work orders</span></div>
            <div className="metric-foot">Across <strong>4 assets</strong> · 2 high priority</div>
          </article>
          <article className="metric-card">
            <div className="metric-top"><span>Unplanned downtime</span><span className="metric-icon blue-icon"><Clock3 size={17} /></span></div>
            <div className="metric-value">2.4 <span className="metric-unit">hrs</span><span className="metric-trend trend-down"><ArrowDownRight size={13} /> 18%</span></div>
            <div className="metric-foot">This month <span className="metric-muted">· target &lt; 4 hrs</span></div>
          </article>
        </section>

        <section className="section-heading">
          <div className="section-title"><span className="section-live" /> <h2>Needs your attention</h2><span className="section-count">1</span></div>
          <button className="text-button" onClick={() => setActiveNav('Alerts')}>View all alerts <ArrowRight size={15} /></button>
        </section>

        <section className="alert-card">
          <div className="alert-main">
            <div className="alert-header">
              <div className="alert-heading-left">
                <span className="alert-symbol"><AlertTriangle size={19} /></span>
                <div><div className="alert-overline">PREDICTIVE ALERT <span>·</span> 2 HOURS AGO</div><h3>Bearing degradation detected</h3></div>
              </div>
              <div className="alert-header-actions">
                <button className="copilot-chip" onClick={() => setCopilotOpen(true)}><Sparkles size={12} /> Ask AI</button>
                <button className="icon-button alert-more" title="More alert options"><MoreHorizontal size={19} /></button>
              </div>
            </div>
            <div className="asset-strip">
              <span className="asset-chip">P-101A</span>
              <span className="asset-divider" />
              <span>Primary transfer pump</span>
              <span className="asset-divider" />
              <span className="asset-location">Production line 2</span>
              <span className="priority-badge"><span /> PRIORITY 1</span>
            </div>
            <div className="alert-insight">
              <div className="insight-quote-mark">"</div>
              <p>Drive-end vibration has risen <strong>31% over five days</strong>. Bearing temperature and motor current are trending up under comparable load. Pattern resembles <strong>2 previous bearing-wear cases.</strong></p>
            </div>
            <div className="alert-evidence">
              <div className="evidence-stat"><span className="evidence-label">MODEL CONFIDENCE</span><strong>87<span>%</span></strong><div className="confidence-track"><i /></div></div>
              <div className="evidence-stat"><span className="evidence-label">EST. TIME TO FAILURE</span><strong>5–8 <small>days</small></strong><em>Moderate uncertainty</em></div>
              <div className="evidence-stat limit-stat"><span className="evidence-label">PRESSURE · OPERATING NORM</span><strong>9.0 <small>bar</small></strong><em><Check size={13} /> Within learned baseline</em></div>
            </div>
            <div className="chart-section">
              <div className="chart-title-row"><div><strong>Signal behavior</strong><span>Compared against this asset's 6-month baseline</span></div><button className="chart-period">5 days <ChevronDown size={13} /></button></div>
              <div className="chart-legend"><span><i className="legend-vibration" /> Vibration <b>+31%</b></span><span><i className="legend-temperature" /> Bearing temp <b>+11°C</b></span><span><i className="legend-current" /> Motor current</span><span className="baseline-key"><i /> Learned baseline</span></div>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={trendData} margin={{ top: 8, right: 7, left: -24, bottom: 0 }}>
                    <CartesianGrid stroke="#e9ede7" vertical={false} />
                    <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: '#8b928b', fontSize: 11, fontFamily: 'DM Sans' }} dy={8} />
                    <YAxis yAxisId="vibration" domain={[2, 7]} tickLine={false} axisLine={false} tick={{ fill: '#a0a69e', fontSize: 10, fontFamily: 'DM Sans' }} ticks={[2, 3, 4, 5, 6, 7]} />
                    <YAxis yAxisId="temperature" domain={[60, 76]} hide />
                    <YAxis yAxisId="current" domain={[40, 50]} hide />
                    <Tooltip content={<ChartTooltip />} />
                    <ReferenceLine yAxisId="vibration" y={4.2} stroke="#8c9b88" strokeDasharray="4 4" />
                    <Area yAxisId="vibration" type="monotone" dataKey="vibration" stroke="none" fill="#edab8f" fillOpacity={0.16} />
                    <Line yAxisId="vibration" type="monotone" dataKey="vibration" name="Vibration" stroke="#db7657" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: '#db7657', stroke: '#fff', strokeWidth: 2 }} />
                    <Line yAxisId="temperature" type="monotone" dataKey="temperature" name="Bearing temp" stroke="#d3a448" strokeWidth={1.8} dot={false} strokeDasharray="5 4" />
                    <Line yAxisId="current" type="monotone" dataKey="current" name="Motor current" stroke="#54889a" strokeWidth={1.8} dot={false} strokeDasharray="2 4" />
                  </ComposedChart>
                </ResponsiveContainer>
                <span className="baseline-label">baseline edge</span>
              </div>
            </div>
            <div className="alert-footer"><span><ShieldCheck size={15} /> Pressure is within approved safety limit <strong>· 10.5 bar max</strong></span><button className="text-button compact" onClick={() => setActiveNav('Alerts')}>View all evidence <ArrowRight size={14} /></button></div>
          </div>

          <aside className="alert-side">
            <div className="side-section-head"><div><span className="side-kicker">ASSET CONDITION</span><h4>P-101A</h4></div><button className="icon-button tiny-more" title="Asset options"><MoreHorizontal size={18} /></button></div>
            <div className="condition-gauge">
              <div className="gauge-visual"><div className="gauge-arc"><div className="gauge-fill" /><div className="gauge-cover" /></div><div className="gauge-center"><strong>68</strong><span>AT RISK</span></div></div>
              <div className="gauge-note"><span className="risk-dot" /> Degrading <span>·</span> monitor closely</div>
            </div>
            <div className="condition-list">
              <div><span>Operating pressure</span><strong className="condition-ok"><Check size={13} /> 9.0 bar</strong></div>
              <div><span>Vibration · DE</span><strong className="condition-warn">5.8 mm/s <ArrowUpRight size={12} /></strong></div>
              <div><span>Bearing temperature</span><strong className="condition-warn">73°C <ArrowUpRight size={12} /></strong></div>
              <div><span>Motor current</span><strong>47 A</strong></div>
            </div>
            <div className="side-separator" />
            <div className="related-heading"><strong>Related maintenance</strong><span>2 cases</span></div>
            <div className="case-row"><span className="case-icon"><Wrench size={14} /></span><div><strong>P-099B · Bearing wear</strong><small>Resolved · 3 months ago</small></div><ArrowRight size={14} /></div>
            <div className="case-row"><span className="case-icon"><Wrench size={14} /></span><div><strong>P-101A · Alignment check</strong><small>Resolved · 8 months ago</small></div><ArrowRight size={14} /></div>
            <button className="side-link" onClick={() => setActiveNav('Assets')}>Open asset history <ArrowRight size={13} /></button>
            <div className="side-source"><span className="source-spark">✳</span><div><strong>Grounded in your records</strong><small>1 manual · 3 service records</small></div></div>
          </aside>
        </section>

        <LiveSensorPanel live={live} history={liveHistory} liveAge={liveAge} flash={liveFlash} />

        <section className="workflow-grid">
          <article className="workflow-panel validation-panel">
            <div className="panel-heading"><div className="step-number">01</div><div><span className="panel-kicker">YOUR EXPERTISE</span><h3>Validate the diagnosis</h3></div>{validated && <span className="validated-pill"><CheckCircle2 size={13} /> Validated</span>}</div>
            <p className="panel-description">Does this match what you're seeing in the field?</p>
            <div className="diagnosis-choice"><span className="choice-check"><Check size={13} /></span><div><strong>Suspected bearing degradation</strong><small>Possible misalignment · Confidence 87%</small></div><button className="edit-link">Edit</button></div>
            <label className="observation-label" htmlFor="observation">FIELD OBSERVATION <span>OPTIONAL</span></label>
            <textarea id="observation" value={observation} onChange={e => setObservation(e.target.value)} placeholder="Add a sound, smell, recent process change..." />
            <div className="validation-actions"><button className="quiet-button" onClick={() => { setObservation(''); showNotice('Diagnosis marked for inspection.') }}>Request inspection</button><button className="primary-button" onClick={validateDiagnosis} disabled={submitting}>{validated ? <><Check size={15} /> Saved</> : <>{submitting ? 'Saving…' : 'Confirm diagnosis'} <ArrowRight size={15} /></>}</button></div>
            <div className="privacy-note"><ShieldCheck size={13} /> Your note is attributed to Maya Chen</div>
          </article>

          <article className="workflow-panel readiness-panel">
            <div className="panel-heading"><div className="step-number">02</div><div><span className="panel-kicker">INTERVENTION READINESS</span><h3>Choose a maintenance window</h3></div></div>
            <div className="readiness-strip"><span className="readiness-icon"><Check size={14} /></span><span>Parts &amp; skills available</span><span className="readiness-sep" /><span>1 scheduling constraint</span></div>
            <div className="constraint-row"><span className="constraint-time">16:30</span><span className="constraint-indicator" /><div><strong>Hot work permit clears</strong><small>Line 2 · Current job in area</small></div><span className="constraint-status">ACTIVE</span></div>
            <div className="constraint-row"><span className="constraint-time">17:00</span><span className="constraint-indicator indicator-green" /><div><strong>Standby pump available</strong><small>P-101B · Return to service</small></div><span className="constraint-status status-green">CONFIRMED</span></div>
            <div className="plan-options">
              {plans.map(plan => (
                <button key={plan.key} className={`plan-option ${activePlan === plan.key ? 'plan-selected' : ''}`} onClick={() => setActivePlan(plan.key)}>
                  <span className={`radio-mark ${activePlan === plan.key ? 'radio-checked' : ''}`}>{activePlan === plan.key && <i />}</span>
                  <span className="plan-copy"><strong>{plan.title}</strong><small>{plan.description}</small></span>
                  <span className="plan-time"><b>{plan.time}</b><em className={`plan-tag ${plan.tone}`}>{plan.tag}</em></span>
                </button>
              ))}
            </div>
            <div className="readiness-foot"><span><AlertTriangle size={13} /> Pulse recommends reduced load until standby is ready.</span><button title="Plan details"><MoreHorizontal size={17} /></button></div>
          </article>

          <article className={`workflow-panel workorder-panel ${workOrderCreated ? 'workorder-ready' : ''}`}>
            <div className="panel-heading"><div className="step-number">03</div><div><span className="panel-kicker">READY FOR REVIEW</span><h3>{workOrderCreated ? 'Work order drafted' : 'Prepare work order'}</h3></div>{workOrderCreated && <span className="draft-badge">DRAFT</span>}</div>
            {workOrderCreated ? (
              <>
                <div className="created-order"><div className="order-confirm-icon"><CheckCircle2 size={18} /></div><div><strong>{workOrderId} · P-101A bearing inspection</strong><small>{createdWindow} · Awaiting supervisor review</small></div><button className="icon-button" onClick={() => setActiveNav('Work orders')}><ArrowRight size={17} /></button></div>
                <div className="field-handoff">
                  <div className="field-handoff-text">
                    <span className="field-handoff-label">FIELD TECHNICIAN</span>
                    <strong>Open in Pulse Field</strong>
                    <small>Scan to open the inspection app on your phone</small>
                  </div>
                  <div className="field-qr">
                    <QRCodeSVG
                      value={`http://${window.location.hostname}:5174`}
                      size={72}
                      bgColor="transparent"
                      fgColor="#364037"
                      level="M"
                    />
                  </div>
                </div>
              </>
            ) : <p className="panel-description">Scope, parts, isolation checks, and approvals in one review-ready draft.</p>}
            <div className="workorder-summary">
              <div><span><Wrench size={14} /> TASK</span><strong>Inspect drive-end bearing &amp; verify alignment</strong></div>
              <div><span><Package size={14} /> PARTS RESERVED</span><strong>BRG-6208 × 1 <i>In stock</i></strong></div>
              <div><span><Activity size={14} /> REQUIRED SKILL</span><strong>Rotating equipment · 2.5 hrs</strong></div>
              <div><span><ShieldCheck size={14} /> SAFETY REVIEW</span><strong>LOTO + stored energy check <i className="review-needed">Review required</i></strong></div>
            </div>
            <div className="workorder-bottom"><span><span className="approval-dot" /> Requires 2 approvals</span><button className="primary-button" onClick={createWorkOrder} disabled={submitting}>{workOrderCreated ? 'Draft created' : submitting ? 'Creating…' : 'Create draft work order'} <ArrowRight size={14} /></button></div>
            <p className="safety-disclaimer"><ShieldCheck size={12} /> Pulse prepares the work. Authorized personnel approve permits and perform isolation.</p>
          </article>
        </section>

        <section className="assets-section">
          <div className="section-heading assets-heading"><div className="section-title"><h2>Asset health</h2><span className="section-count neutral-count">8</span></div><button className="text-button" onClick={() => setActiveNav('Assets')}>All assets <ArrowRight size={15} /></button></div>
          <div className="assets-table">
            <div className="asset-table-head"><span>ASSET</span><span>CONDITION</span><span>AVAILABILITY</span><span>LAST SERVICE</span><span>OWNER</span><span /></div>
            {ALL_ASSETS.slice(0, showAllAssets ? 8 : 4).map(asset => (
              <div className="asset-table-row" key={asset.id}>
                <div className="asset-identity"><span className={`asset-row-icon ${asset.tone}`}><Activity size={15} /></span><span><strong>{asset.id} <i>{asset.name}</i></strong><small>{asset.area}</small></span></div>
                <span className={`health-status ${asset.tone}`}><i /> {asset.state}</span>
                <span className="availability-cell">{asset.availability}</span>
                <span className="service-cell">{asset.service}</span>
                <span className="owner-cell"><span className="owner-avatar">{asset.owner}</span>{asset.ownerName}</span>
                <button className="icon-button row-action" title={`Open ${asset.id}`} onClick={() => setActiveNav('Assets')}><ArrowRight size={15} /></button>
              </div>
            ))}
          </div>
          <div className="asset-footnote"><span><span className="live-dot" /> Data updated just now</span><button onClick={() => setShowAllAssets(!showAllAssets)}><SlidersHorizontal size={13} /> {showAllAssets ? 'Show less' : 'Show all 8'}</button></div>
        </section>

        {events.length > 0 && (
          <section className="events-section">
            <div className="section-heading"><div className="section-title"><h2>Recent activity</h2></div></div>
            <div className="events-list">
              {events.map(ev => (
                <div key={ev.id} className={`event-row ev-${ev.severity.toLowerCase()}`}>
                  <span className="ev-dot" />
                  <span className="ev-asset">{ev.assetId}</span>
                  <span className="ev-msg">{ev.message}</span>
                  <span className="ev-time">{timeAgo(ev.occurredAt)}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <footer className="page-footer"><span>Pulse Reliability Platform <i>·</i> Demo environment</span><span>Human judgment, always in the loop <ShieldCheck size={13} /></span></footer>
      </>
    )
  }

  function AssetsPage() {
    const filters = ['All', 'At Risk', 'Monitor', 'Healthy']
    const filtered = assetFilter === 'All' ? ALL_ASSETS
      : ALL_ASSETS.filter(a => a.state.toLowerCase() === assetFilter.toLowerCase())
    return (
      <>
        <section className="page-heading">
          <div>
            <div className="eyebrow"><span className="eyebrow-line" /> ASSET FLEET</div>
            <h1>All assets<span className="heading-dot">.</span></h1>
            <p className="page-subtitle">Health, availability, and service history for 8 monitored assets.</p>
          </div>
          <button className="ai-copilot-trigger" onClick={() => setCopilotOpen(true)}><Sparkles size={14} /> Ask Pulse AI</button>
        </section>
        <div className="page-filter-bar">
          {filters.map(f => {
            const count = f === 'All' ? ALL_ASSETS.length : ALL_ASSETS.filter(a => a.state.toLowerCase() === f.toLowerCase()).length
            return <button key={f} className={`filter-tab ${assetFilter === f ? 'filter-active' : ''}`} onClick={() => setAssetFilter(f)}>{f} <span>{count}</span></button>
          })}
          <button className="outline-button ml-auto"><Filter size={13} /> Filter <ChevronDown size={12} /></button>
        </div>
        <div className="asset-cards-grid">
          {filtered.map(asset => {
            const score = asset.healthScore
            const arcDeg = (score / 100) * 180
            return (
              <div key={asset.id} className={`asset-card ac-${asset.tone}`}>
                <div className="ac-header">
                  <div>
                    <span className="ac-id">{asset.id}</span>
                    <span className={`ac-badge badge-${asset.tone}`}>{asset.state}</span>
                    {asset.alerts > 0 && <span className="ac-alert-count"><AlertTriangle size={9} /> {asset.alerts}</span>}
                  </div>
                  <button className="icon-button tiny-more"><MoreHorizontal size={16} /></button>
                </div>
                <p className="ac-name">{asset.name}</p>
                <small className="ac-area">{asset.area}</small>
                <div className="ac-gauge-row">
                  <div className="ac-gauge">
                    <svg viewBox="0 0 60 34" width="60" height="34">
                      <path d="M5 30 A25 25 0 0 1 55 30" fill="none" stroke="#eaede8" strokeWidth="5" strokeLinecap="round" />
                      <path d="M5 30 A25 25 0 0 1 55 30" fill="none"
                        stroke={asset.tone === 'degrading' ? '#d47b5d' : asset.tone === 'monitor' ? '#c9963a' : '#5e9468'}
                        strokeWidth="5" strokeLinecap="round"
                        strokeDasharray={`${(arcDeg / 180) * 78.5} 78.5`} />
                      <text x="30" y="29" textAnchor="middle" fontSize="10" fontFamily="Space Grotesk" fontWeight="600" fill="#364037">{score}</text>
                    </svg>
                  </div>
                  <div className="ac-readings">
                    {asset.id === 'P-101A' ? (
                      <>
                        <div className="ac-reading warn"><span>Vibration</span><strong>{live.vibration} mm/s <TrendingUp size={10} /></strong></div>
                        <div className="ac-reading warn"><span>Bearing temp</span><strong>{live.temperature}°C <TrendingUp size={10} /></strong></div>
                        <div className="ac-reading ok"><span>Pressure</span><strong><Check size={10} /> {live.pressure} bar</strong></div>
                      </>
                    ) : (
                      <>
                        <div className="ac-reading ok"><span>Availability</span><strong>{asset.availability}</strong></div>
                        <div className="ac-reading"><span>Last service</span><strong>{asset.service}</strong></div>
                        <div className="ac-reading"><span>Owner</span><strong>{asset.ownerName}</strong></div>
                      </>
                    )}
                  </div>
                </div>
                <div className="ac-footer">
                  <span className="ac-owner"><span className="owner-avatar">{asset.owner}</span>{asset.ownerName}</span>
                  <button className="text-button compact" onClick={() => setActiveNav('Overview')}>View detail <ArrowRight size={12} /></button>
                </div>
              </div>
            )
          })}
        </div>
        <footer className="page-footer"><span>Pulse Reliability Platform <i>·</i> Demo environment</span><span>Human judgment, always in the loop <ShieldCheck size={13} /></span></footer>
      </>
    )
  }

  function AlertsPage() {
    const displayAlerts = apiAlerts.length > 0 ? apiAlerts : [
      { id: 'ALT-1042', assetId: 'P-101A', title: 'Bearing degradation detected', explanation: 'Drive-end vibration has risen 31% over five days. Bearing temperature and motor current are trending up under comparable load.', confidencePercent: 87, estimatedTimeToFailure: '5–8 days', status: 'ACTIVE', possibleFailureModes: ['Bearing wear', 'Misalignment'], vibration: { value: 5.8, unit: 'mm/s', changePercent: 31 }, bearingTemperature: { value: 73, unit: '°C', changePercent: 11 }, motorCurrent: { value: 47, unit: 'A', changePercent: 15 } },
      { id: 'ALT-1039', assetId: 'C-312', title: 'Cooling efficiency declining', explanation: 'Cooling water flow rate has dropped 12% over two weeks. Pattern consistent with fouled heat exchanger or blocked strainer.', confidencePercent: 72, estimatedTimeToFailure: '12–18 days', status: 'ACTIVE', possibleFailureModes: ['Heat exchanger fouling', 'Blocked strainer'], vibration: { value: 3.8, unit: 'm³/h', changePercent: -12 }, bearingTemperature: { value: 48, unit: '°C', changePercent: 14 }, motorCurrent: { value: 52, unit: 'A', changePercent: 8 } },
      { id: 'ALT-1035', assetId: 'F-118', title: 'Differential pressure normalised', explanation: 'Filter differential pressure returned to normal range after cleaning. Alert resolved.', confidencePercent: 92, estimatedTimeToFailure: 'N/A', status: 'CLOSED', possibleFailureModes: ['Resolved'], vibration: { value: 0.3, unit: 'bar', changePercent: 0 }, bearingTemperature: { value: 22, unit: '°C', changePercent: 0 }, motorCurrent: { value: 12, unit: 'A', changePercent: 0 } },
    ]
    const activeCount = displayAlerts.filter(a => a.status === 'ACTIVE').length
    const closedCount = displayAlerts.filter(a => a.status === 'CLOSED').length
    const filtered = alertFilter === 'Active' ? displayAlerts.filter(a => a.status === 'ACTIVE')
      : alertFilter === 'Closed' ? displayAlerts.filter(a => a.status === 'CLOSED')
      : displayAlerts
    return (
      <>
        <section className="page-heading">
          <div>
            <div className="eyebrow"><span className="eyebrow-line" /> PREDICTIVE ALERTS</div>
            <h1>Alert center<span className="heading-dot">.</span></h1>
            <p className="page-subtitle">AI-detected anomalies ranked by severity and time to failure.</p>
          </div>
          <button className="ai-copilot-trigger" onClick={() => setCopilotOpen(true)}><Sparkles size={14} /> Ask Pulse AI</button>
        </section>
        <div className="alerts-summary-bar">
          <div className="alert-summary-stat"><span className="asts-value coral">{activeCount}</span><span>Active alerts</span></div>
          <div className="alert-summary-stat"><span className="asts-value amber">0</span><span>Acknowledged</span></div>
          <div className="alert-summary-stat"><span className="asts-value muted">{closedCount}</span><span>Closed today</span></div>
          <div className="alert-summary-stat"><span className="asts-value green">87%</span><span>Avg confidence</span></div>
        </div>
        <div className="page-filter-bar">
          {['Active', 'All', 'Closed'].map(f => (
            <button key={f} className={`filter-tab ${alertFilter === f ? 'filter-active' : ''}`} onClick={() => setAlertFilter(f)}>{f}</button>
          ))}
        </div>
        <div className="alerts-list">
          {filtered.map((alert, idx) => {
            const isExpanded = expandedAlert === alert.id
            const priorityNum = idx + 1
            return (
              <div key={alert.id} className={`alert-row-card ${alert.status === 'CLOSED' ? 'arc-closed' : idx === 0 ? 'arc-high' : 'arc-medium'}`}>
                <div className="arc-main" onClick={() => setExpandedAlert(isExpanded ? null : alert.id)}>
                  <span className={`arc-priority p${Math.min(priorityNum, 3)}`}>P{priorityNum}</span>
                  <div className="arc-body">
                    <div className="arc-title"><strong>{alert.title}</strong><span className="arc-asset">{alert.assetId}</span>{alert.status === 'CLOSED' && <span className="arc-closed-badge"><Check size={10} /> Closed</span>}</div>
                    <p className="arc-expl">{alert.explanation}</p>
                    {isExpanded && (
                      <div className="arc-detail">
                        <div className="arc-signals">
                          <div className="arc-sig"><span>VIBRATION / FLOW</span><strong>{alert.vibration.value} {alert.vibration.unit}</strong><em className={alert.vibration.changePercent !== 0 ? 'sig-change' : ''}>{alert.vibration.changePercent > 0 ? `+${alert.vibration.changePercent}%` : alert.vibration.changePercent < 0 ? `${alert.vibration.changePercent}%` : 'No change'}</em></div>
                          <div className="arc-sig"><span>BEARING TEMP</span><strong>{alert.bearingTemperature.value} {alert.bearingTemperature.unit}</strong><em className={alert.bearingTemperature.changePercent > 0 ? 'sig-change' : ''}>{alert.bearingTemperature.changePercent > 0 ? `+${alert.bearingTemperature.changePercent}%` : 'Stable'}</em></div>
                          <div className="arc-sig"><span>MOTOR CURRENT</span><strong>{alert.motorCurrent.value} {alert.motorCurrent.unit}</strong><em>{alert.motorCurrent.changePercent > 0 ? `+${alert.motorCurrent.changePercent}%` : 'Stable'}</em></div>
                          <div className="arc-sig"><span>FAILURE MODES</span><strong>{alert.possibleFailureModes.join(' · ')}</strong></div>
                        </div>
                        {alert.status === 'ACTIVE' && (
                          <div className="arc-actions">
                            <button className="quiet-button" onClick={e => { e.stopPropagation(); setActiveNav('Overview') }}>Validate diagnosis</button>
                            <button className="primary-button" onClick={e => { e.stopPropagation(); setActiveNav('Work orders') }}>Create work order <ArrowRight size={13} /></button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="arc-meta">
                    <span className="arc-conf"><strong>{alert.confidencePercent}%</strong><small>conf.</small></span>
                    <span className="arc-ttf">{alert.estimatedTimeToFailure}</span>
                    <span className="arc-chevron">{isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        <footer className="page-footer"><span>Pulse Reliability Platform <i>·</i> Demo environment</span><span>Human judgment, always in the loop <ShieldCheck size={13} /></span></footer>
      </>
    )
  }

  function WorkOrdersPage() {
    const displayWOs: ApiWorkOrder[] = apiWorkOrders.length > 0 ? apiWorkOrders : [
      { id: 'WO-2479', assetId: 'P-101B', task: 'Valve seat replacement — isolation valve IV-201', maintenanceWindow: 'Today · 09:00', status: 'IN_PROGRESS', requiredSkill: 'Mechanical', estimatedHours: 3.0, partNumber: 'VLV-201-SEAT', quantity: 1, safetyChecks: ['LOTO applied', 'Pressure bled'], requiredApprovals: ['Area authority'], technicianObservation: 'Valve passing — internal seat worn', createdAt: new Date(Date.now() - 10800000).toISOString() },
      { id: 'WO-2477', assetId: 'M-204', task: 'Annual oil change and filter replacement', maintenanceWindow: 'Yesterday · 08:00', status: 'COMPLETED', requiredSkill: 'Mechanical', estimatedHours: 1.5, partNumber: 'OIL-ISO-68', quantity: 2, safetyChecks: ['Motor isolated and tagged', 'Oil drained correctly'], requiredApprovals: [], technicianObservation: 'As expected — oil black, filter 60% blocked', createdAt: new Date(Date.now() - 86400000).toISOString() },
      { id: 'WO-2475', assetId: 'C-312', task: 'Compressor belt and pulley inspection', maintenanceWindow: 'Monday · 14:00', status: 'APPROVED', requiredSkill: 'Mechanical', estimatedHours: 2.0, partNumber: 'BELT-C312-02', quantity: 1, safetyChecks: ['Energy isolation verified', 'Guard removal documented'], requiredApprovals: ['Maintenance supervisor'], technicianObservation: '', createdAt: new Date(Date.now() - 259200000).toISOString() },
    ]
    const statusOrder: Record<string, number> = { IN_PROGRESS: 0, DRAFT: 1, APPROVED: 2, COMPLETED: 3 }
    const sorted = [...displayWOs].sort((a, b) => (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99))
    const filtered = woFilter === 'All' ? sorted : sorted.filter(wo => wo.status === woFilter)
    const counts: Record<string, number> = {}
    for (const wo of displayWOs) counts[wo.status] = (counts[wo.status] ?? 0) + 1
    return (
      <>
        <section className="page-heading">
          <div>
            <div className="eyebrow"><span className="eyebrow-line" /> WORK ORDERS</div>
            <h1>Maintenance queue<span className="heading-dot">.</span></h1>
            <p className="page-subtitle">From AI-detected anomaly to review-ready work order.</p>
          </div>
          <button className="ai-copilot-trigger" onClick={() => setCopilotOpen(true)}><Sparkles size={14} /> Ask Pulse AI</button>
        </section>
        <div className="wo-summary-bar">
          {[['DRAFT', 'Draft', '#b59645'], ['APPROVED', 'Approved', '#507b8a'], ['IN_PROGRESS', 'In Progress', '#5e9468'], ['COMPLETED', 'Completed', '#778078']].map(([key, label, color]) => (
            <div key={key} className="wo-sum-item">
              <span className="wo-sum-count" style={{ color }}>{counts[key] ?? 0}</span>
              <span>{label}</span>
            </div>
          ))}
        </div>
        <div className="page-filter-bar">
          {['All', 'DRAFT', 'APPROVED', 'IN_PROGRESS', 'COMPLETED'].map(f => (
            <button key={f} className={`filter-tab ${woFilter === f ? 'filter-active' : ''}`} onClick={() => setWoFilter(f)}>{f === 'IN_PROGRESS' ? 'In Progress' : statusLabel(f)}</button>
          ))}
        </div>
        <div className="wo-list">
          {filtered.map(wo => {
            const isExpanded = expandedWo === wo.id
            const isClosing = closingWo === wo.id
            return (
              <div key={wo.id} className={`wo-card wc-${wo.status.toLowerCase()}`}>
                <div className="wo-card-header" onClick={() => setExpandedWo(isExpanded ? null : wo.id)}>
                  <div className="wo-id-area">
                    <span className="wo-id">{wo.id}</span>
                    <span className={`wo-status-chip ws-${wo.status.toLowerCase()}`}>{statusLabel(wo.status)}</span>
                  </div>
                  <div className="wo-main-info">
                    <strong>{wo.task}</strong>
                    <div className="wo-meta-row">
                      <span className="wo-asset">{wo.assetId}</span>
                      <span className="wo-divider" />
                      <span>{wo.maintenanceWindow}</span>
                      <span className="wo-divider" />
                      <span>{wo.requiredSkill} · {wo.estimatedHours}h</span>
                    </div>
                  </div>
                  <div className="wo-chevron">{isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</div>
                </div>
                {isExpanded && !isClosing && (
                  <div className="wo-detail">
                    <div className="wo-detail-grid">
                      <div><span>Part number</span><strong>{wo.partNumber} × {wo.quantity}</strong></div>
                      <div><span>Estimated time</span><strong>{wo.estimatedHours} hours</strong></div>
                      <div><span>Required approvals</span><strong>{wo.requiredApprovals.length > 0 ? wo.requiredApprovals.join(', ') : 'None required'}</strong></div>
                      <div><span>Created</span><strong>{timeAgo(wo.createdAt)}</strong></div>
                    </div>
                    {wo.safetyChecks.length > 0 && (
                      <div className="wo-checks">
                        <span className="wo-checks-label">SAFETY CHECKS</span>
                        {wo.safetyChecks.map(c => <span key={c} className="wo-check-item"><ShieldCheck size={10} /> {c}</span>)}
                      </div>
                    )}
                    {wo.technicianObservation && (
                      <div className="wo-observation"><span>Technician observation</span><p>"{wo.technicianObservation}"</p></div>
                    )}
                    {wo.status === 'COMPLETED' && (
                      <div className="wo-completed-banner"><CheckCircle2 size={14} /> Work order closed · Outcome recorded</div>
                    )}
                    {(wo.status === 'DRAFT' || wo.status === 'IN_PROGRESS') && (
                      <div className="wo-actions">
                        {wo.status === 'DRAFT' && <button className="quiet-button">Approve</button>}
                        <button className="primary-button" onClick={e => { e.stopPropagation(); setClosingWo(wo.id) }}>Record outcome <ArrowRight size={13} /></button>
                      </div>
                    )}
                  </div>
                )}
                {isClosing && (
                  <div className="wo-closeout">
                    <div className="closeout-head"><CheckCircle2 size={14} /> Close work order — record actual findings</div>
                    <label htmlFor="outcome-note">ACTUAL FINDING</label>
                    <textarea id="outcome-note" placeholder="Describe what was found and what action was taken…" value={outcomeNote} onChange={e => setOutcomeNote(e.target.value)} />
                    <div className="closeout-actions">
                      <button className="quiet-button" onClick={() => { setClosingWo(null); setOutcomeNote('') }}>Cancel</button>
                      <button className="primary-button" onClick={() => closeWorkOrder(wo.id)} disabled={submitting}>{submitting ? 'Closing…' : 'Close and record'} <ArrowRight size={13} /></button>
                    </div>
                    <p className="safety-disclaimer"><ShieldCheck size={11} /> Outcome is recorded in asset history and used to improve future predictions.</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <footer className="page-footer"><span>Pulse Reliability Platform <i>·</i> Demo environment</span><span>Human judgment, always in the loop <ShieldCheck size={13} /></span></footer>
      </>
    )
  }

  // ── Shell ──────────────────────────────────────────────────────────────
  return (
    <div className="app-shell">
      {mobileMenuOpen && <button className="mobile-scrim" aria-label="Close menu" onClick={() => setMobileMenuOpen(false)} />}
      <aside className={`sidebar ${mobileMenuOpen ? 'sidebar-open' : ''}`}>
        <div className="brand-lockup">
          <div className="brand-mark"><Activity size={20} strokeWidth={2.3} /></div>
          <span>pulse<span className="brand-period">.</span></span>
          <button className="mobile-close icon-button" aria-label="Close navigation" onClick={() => setMobileMenuOpen(false)}><X size={18} /></button>
        </div>
        <button className="plant-switcher">
          <span className="plant-avatar">N</span>
          <span className="plant-name"><strong>Northline plant</strong><small>Site 04 · Indiana</small></span>
          <ChevronDown size={15} />
        </button>
        <div className="sidebar-label">WORKSPACE</div>
        <nav className="primary-nav" aria-label="Main navigation">
          {navItems.map(({ label, icon: Icon, count }) => (
            <button key={label} className={`nav-item ${activeNav === label ? 'nav-active' : ''}`} onClick={() => { setActiveNav(label); setMobileMenuOpen(false) }}>
              <Icon size={17} strokeWidth={1.9} />
              <span>{label}</span>
              {count && <span className={`nav-count ${label === 'Alerts' ? 'count-alert' : ''}`}>{count}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-label systems-label">SYSTEMS</div>
        <button className="nav-item"><Waves size={17} strokeWidth={1.9} /><span>Signal monitor</span><span className="live-dot" /></button>
        <button className="nav-item"><Package size={17} strokeWidth={1.9} /><span>Parts inventory</span></button>
        <div className="sidebar-bottom">
          <div className="uptime-card">
            <div className="uptime-top"><span className="uptime-dot" /> All systems normal</div>
            <div className="uptime-caption">Last sync <strong>just now</strong></div>
            <div className="uptime-bars" aria-hidden="true">{Array.from({ length: 24 }, (_, i) => <i key={i} />)}</div>
          </div>
          <button className="profile-button" onClick={() => setCopilotOpen(true)}>
            <span className="profile-avatar">MC</span>
            <span className="profile-name"><strong>Maya Chen</strong><small>Reliability lead</small></span>
            <Bot size={17} style={{ color: '#5e9468' }} />
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            <button className="mobile-menu icon-button" aria-label="Open navigation" onClick={() => setMobileMenuOpen(true)}><Menu size={19} /></button>
            <span>Northline plant</span><span className="breadcrumb-slash">/</span><strong>{activeNav}</strong>
          </div>
          <div className="topbar-actions">
            <span className="shift-pill"><span className="live-dot" /> DAY SHIFT <span className="shift-divider" /> 06:00–18:00</span>
            <button className="icon-button search-button" title="Search"><Search size={18} /></button>
            <button className="icon-button notification-button" title="Notifications"><Bell size={18} /><i /></button>
            <button className="copilot-topbar-btn" onClick={() => setCopilotOpen(!copilotOpen)} title="Pulse AI"><Sparkles size={16} /></button>
            <button className="icon-button topbar-settings" title="Settings"><Settings2 size={18} /></button>
          </div>
        </header>
        <div className="page-wrap">
          {activeNav === 'Overview' && OverviewPage()}
          {activeNav === 'Assets' && AssetsPage()}
          {activeNav === 'Alerts' && AlertsPage()}
          {activeNav === 'Work orders' && WorkOrdersPage()}
        </div>
      </main>

      <CopilotPanel
        isOpen={copilotOpen}
        messages={messages}
        loading={copilotLoading}
        input={copilotInput}
        onInputChange={setCopilotInput}
        onSend={() => askCopilot()}
        onSuggest={q => askCopilot(q)}
        onClose={() => setCopilotOpen(false)}
        endRef={copilotEndRef}
      />

      {notice && (
        <div className="toast">
          <CheckCircle2 size={17} />{notice}
          <button aria-label="Dismiss" onClick={() => setNotice('')}><X size={15} /></button>
        </div>
      )}
    </div>
  )
}

export default App
