import { ChangeEvent, FormEvent, useEffect, useState } from 'react'
import {
  AlertTriangle, ArrowLeft, Camera, Check, CheckCircle2, ChevronRight,
  Clock3, CloudOff, Gauge, MapPin, Radio, RefreshCw, ShieldCheck,
  Thermometer, Vibrate, Wifi, X,
} from 'lucide-react'

type Readings = {
  vibration: number
  temperature: number
  current: number
  pressure: number
}

type InspectionStatus = 'idle' | 'submitting' | 'submitted' | 'local'

const safetyChecks = [
  { id: 'permit', title: 'Permit and work scope confirmed', detail: 'WO-2481 · Bearing inspection' },
  { id: 'isolation', title: 'Isolation and stored energy reviewed', detail: 'Follow site LOTO procedure before work' },
  { id: 'area', title: 'Work area safe to inspect', detail: 'Check access, guarding, and nearby activity' },
]

const fallbackReadings: Readings = {
  vibration: 5.8,
  temperature: 73,
  current: 47,
  pressure: 9.0,
}

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function App() {
  const [readings, setReadings] = useState(fallbackReadings)
  const [checked, setChecked] = useState<string[]>([])
  const [observation, setObservation] = useState('')
  const [photoName, setPhotoName] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [status, setStatus] = useState<InspectionStatus>('idle')
  const [apiConnected, setApiConnected] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    fetch('/api/sensors/P-101A/live')
      .then(response => {
        if (!response.ok) throw new Error('Pulse API unavailable')
        return response.json()
      })
      .then(data => {
        if (!active) return
        setReadings({
          vibration: Number(data.vibration),
          temperature: Number(data.bearingTemperature),
          current: Number(data.motorCurrent),
          pressure: Number(data.pressure),
        })
        setApiConnected(true)
        setUpdatedAt(new Date())
      })
      .catch(() => {
        if (active) setApiConnected(false)
      })
    return () => { active = false }
  }, [])

  useEffect(() => () => {
    if (photoUrl) URL.revokeObjectURL(photoUrl)
  }, [photoUrl])

  function toggleCheck(id: string) {
    setChecked(current => current.includes(id)
      ? current.filter(item => item !== id)
      : [...current, id])
  }

  function selectPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (photoUrl) URL.revokeObjectURL(photoUrl)
    setPhotoName(file.name)
    setPhotoUrl(URL.createObjectURL(file))
  }

  async function submitInspection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (checked.length !== safetyChecks.length || !observation.trim()) return
    setStatus('submitting')
    setError('')

    try {
      const response = await fetch('/api/alerts/P-101A/validation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          technician: 'Maya Chen',
          diagnosis: 'Bearing degradation; inspect and verify alignment',
          observation: observation.trim(),
          action: 'FIELD_INSPECTION_SUBMITTED_FOR_REVIEW',
        }),
      })
      if (!response.ok) throw new Error('Pulse API could not save the inspection.')
      setApiConnected(true)
      setStatus('submitted')
    } catch {
      setApiConnected(false)
      setStatus('local')
    }
  }

  const canSubmit = checked.length === safetyChecks.length && observation.trim().length > 0
  const completedCount = checked.length

  return (
    <div className="field-app">
      <header className="topbar">
        <button className="back-button" aria-label="Back to assigned work">
          <ArrowLeft size={19} />
        </button>
        <div className="topbar-title">
          <span className="brand-mark">P</span>
          <span>Pulse <b>FIELD</b></span>
        </div>
        <button className="topbar-action" aria-label="Refresh readings" onClick={() => window.location.reload()}>
          <RefreshCw size={17} />
        </button>
      </header>

      <main>
        <section className="assignment-banner" aria-label="Current assignment">
          <div className="assignment-meta">
            <span className="eyebrow">ASSIGNED INSPECTION</span>
            <span className="priority-label"><i /> PRIORITY 1</span>
          </div>
          <h1>Drive-end bearing</h1>
          <p className="assignment-subtitle">Listen, inspect, and record findings</p>
          <div className="asset-context">
            <span className="asset-id">P-101A</span>
            <span className="context-divider" />
            <span><MapPin size={13} /> Production · Line 2</span>
          </div>
          <div className="assignment-footer">
            <span><Clock3 size={14} /> Today · 18:00 window</span>
            <span className="review-chip"><ShieldCheck size={14} /> Review required</span>
          </div>
        </section>

        <section className="progress-section" aria-label="Inspection progress">
          <div className="progress-copy">
            <span className="section-kicker">FIELD CHECK</span>
            <strong>{completedCount} <span>/ {safetyChecks.length}</span> safety checks</strong>
          </div>
          <div className="progress-track" aria-hidden="true">
            {safetyChecks.map((item, index) => (
              <span key={item.id} className={index < completedCount ? 'progress-step is-done' : 'progress-step'} />
            ))}
          </div>
        </section>

        <section className="inspection-section">
          <div className="section-heading">
            <div>
              <span className="section-kicker">01 / BEFORE YOU BEGIN</span>
              <h2>Safety confirmation</h2>
            </div>
            <ShieldCheck className="heading-icon" size={20} />
          </div>
          <div className="checklist">
            {safetyChecks.map((item, index) => {
              const isChecked = checked.includes(item.id)
              return (
                <button
                  className={`check-row ${isChecked ? 'check-row-done' : ''}`}
                  key={item.id}
                  type="button"
                  onClick={() => toggleCheck(item.id)}
                  aria-pressed={isChecked}
                >
                  <span className={`check-control ${isChecked ? 'checked' : ''}`}>
                    {isChecked ? <Check size={17} strokeWidth={3} /> : <span>{index + 1}</span>}
                  </span>
                  <span className="check-copy">
                    <strong>{item.title}</strong>
                    <small>{item.detail}</small>
                  </span>
                  <ChevronRight className="check-chevron" size={17} />
                </button>
              )
            })}
          </div>
          <p className="safety-notice"><AlertTriangle size={14} /> This checklist records confirmation only. Follow your site’s approved procedures.</p>
        </section>

        <section className="inspection-section readings-section">
          <div className="section-heading readings-heading">
            <div>
              <span className="section-kicker">02 / CURRENT CONDITION</span>
              <h2>Latest readings</h2>
            </div>
            <span className={`connection-pill ${apiConnected ? 'connected' : 'demo'}`}>
              {apiConnected ? <Wifi size={13} /> : <CloudOff size={13} />}
              {apiConnected ? 'API LIVE' : 'DEMO DATA'}
            </span>
          </div>
          <div className="reading-grid">
            <Reading icon={<Vibrate size={16} />} label="Vibration" value={readings.vibration.toFixed(1)} unit="mm/s" state={readings.vibration > 4.2 ? 'high' : 'normal'} />
            <Reading icon={<Thermometer size={16} />} label="Bearing temp" value={readings.temperature.toFixed(1)} unit="°C" state={readings.temperature > 70 ? 'high' : 'normal'} />
            <Reading icon={<Radio size={16} />} label="Motor current" value={readings.current.toFixed(1)} unit="A" state={readings.current > 45 ? 'watch' : 'normal'} />
            <Reading icon={<Gauge size={16} />} label="Pressure" value={readings.pressure.toFixed(2)} unit="bar" state="normal" />
          </div>
          <div className="reading-footnote">
            <span><span className="baseline-marker" /> Learned baseline shown in asset record</span>
            <span>{updatedAt ? `Synced ${formatTime(updatedAt)}` : 'Sample readings'}</span>
          </div>
        </section>

        <form onSubmit={submitInspection}>
          <section className="inspection-section findings-section">
            <div className="section-heading">
              <div>
                <span className="section-kicker">03 / TECHNICIAN INPUT</span>
                <h2>Record what you find</h2>
              </div>
              <span className="optional-tag">REQUIRED</span>
            </div>
            <label className="field-label" htmlFor="observation">Inspection observation</label>
            <textarea
              id="observation"
              value={observation}
              onChange={event => setObservation(event.target.value)}
              placeholder="Describe sound, movement, visible wear, or anything unusual…"
              rows={4}
              required
            />
            <div className="textarea-foot"><span>Be specific. Your notes support the maintenance review.</span><span>{observation.length}/500</span></div>
            <label className="photo-control">
              {photoUrl ? <img src={photoUrl} alt="Selected inspection evidence" /> : <span className="camera-icon"><Camera size={19} /></span>}
              <span className="photo-copy"><strong>{photoName || 'Add photo evidence'}</strong><small>{photoName ? 'Selected on this device · not uploaded' : 'Optional · take a photo or choose a file'}</small></span>
              {photoName && <button className="remove-photo" type="button" aria-label="Remove photo" onClick={(event) => { event.preventDefault(); setPhotoName(''); setPhotoUrl('') }}><X size={16} /></button>}
              <input type="file" accept="image/*" capture="environment" onChange={selectPhoto} />
            </label>
          </section>

          {status === 'submitted' && (
            <div className="submission-result success-result" role="status">
              <CheckCircle2 size={20} />
              <span><strong>Inspection sent for review</strong><small>Technician validation was recorded in Pulse.</small></span>
            </div>
          )}
          {status === 'local' && (
            <div className="submission-result local-result" role="status">
              <CloudOff size={19} />
              <span><strong>API unavailable · not synced</strong><small>Your entry is still on this screen. Retry when connected.</small></span>
            </div>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}

          <div className="submit-area">
            <button className="submit-button" type="submit" disabled={!canSubmit || status === 'submitting'}>
              {status === 'submitting' ? 'Sending for review…' : status === 'submitted' ? 'Send another update' : 'Submit for review'}
              {status === 'submitting' ? <span className="button-spinner" /> : <ChevronRight size={19} />}
            </button>
            <p><ShieldCheck size={14} /> Submission does not authorize work or equipment control.</p>
          </div>
        </form>
      </main>

      <footer className="app-footer">
        <span className="footer-status"><span /> NORTHLINE 04</span>
        <span>FIELD WORKSPACE <b>·</b> MAYA CHEN</span>
      </footer>
    </div>
  )
}

function Reading({ icon, label, value, unit, state }: {
  icon: React.ReactNode
  label: string
  value: string
  unit: string
  state: 'high' | 'watch' | 'normal'
}) {
  return (
    <article className={`reading-tile reading-${state}`}>
      <div className="reading-title">{icon}<span>{label}</span></div>
      <div className="reading-value">{value}<small>{unit}</small></div>
      <div className="reading-status"><i />{state === 'high' ? 'Above baseline' : state === 'watch' ? 'Monitor' : 'In range'}</div>
    </article>
  )
}

export default App
