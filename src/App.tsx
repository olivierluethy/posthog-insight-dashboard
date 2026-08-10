import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './styles/app.css'
import type {
  AnalysisResult,
  ClassifierConfig,
  DataCompleteness,
  NormalizedRow,
  RunSnapshot,
} from './types'
import { parseCsvFile } from './analysis/parse'
import { analyze } from './analysis/runner'
import {
  buildSnapshot,
  clearSnapshots,
  computeDiff,
  listSnapshots,
  saveSnapshot,
  type DiffRow,
} from './state/history'
import { Header } from './components/Header'
import { Dropzone } from './components/Dropzone'
import { ProgressView } from './components/ProgressView'
import { InsightsPanel } from './components/InsightsPanel'
import { Overview } from './components/Overview'
import { HistoryDiff } from './components/HistoryDiff'
import { EventFrequency } from './components/EventFrequency'
import { Timeseries } from './components/Timeseries'
import { Retention } from './components/Retention'
import { Errors } from './components/Errors'
import { Forecast } from './components/Forecast'
import { Segmentation } from './components/Segmentation'
import { AdvancedPanel } from './components/AdvancedPanel'

type Phase = 'idle' | 'parsing' | 'analyzing' | 'ready' | 'error'

const DEFAULT_CONFIG: ClassifierConfig = { passiveRatioThreshold: 20, overrides: {} }

export function App() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [fileName, setFileName] = useState('')
  const [parsePct, setParsePct] = useState(0)
  const [parsedRows, setParsedRows] = useState(0)
  const [stage, setStage] = useState('')
  const [analyzePct, setAnalyzePct] = useState(0)
  const [mode, setMode] = useState<'worker' | 'main-thread' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [partial, setPartial] = useState<Partial<AnalysisResult>>({})
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [config, setConfig] = useState<ClassifierConfig>(DEFAULT_CONFIG)
  const [reanalyzing, setReanalyzing] = useState(false)

  const [snapshots, setSnapshots] = useState<RunSnapshot[]>([])
  const [currentSnap, setCurrentSnap] = useState<RunSnapshot | null>(null)
  const [previousSnap, setPreviousSnap] = useState<RunSnapshot | null>(null)

  const rowsRef = useRef<NormalizedRow[]>([])
  const completenessRef = useRef<DataCompleteness | null>(null)

  const runAnalysis = useCallback(
    async (
      rows: NormalizedRow[],
      completeness: DataCompleteness,
      cfg: ClassifierConfig,
      opts: { reanalysis: boolean; fName: string },
    ) => {
      setPartial({})
      setAnalyzePct(0)
      setStage('Starting…')
      if (opts.reanalysis) setReanalyzing(true)
      else setPhase('analyzing')

      try {
        const res = await analyze(rows, completeness, cfg, {
          onProgress: (s, p) => {
            setStage(s)
            setAnalyzePct(p)
          },
          onPartial: (key, value) =>
            setPartial((prev) => ({ ...prev, [key]: value }) as Partial<AnalysisResult>),
          onMode: (m) => setMode(m),
        })
        setResult(res)
        setPhase('ready')
        setReanalyzing(false)

        if (!opts.reanalysis) {
          // Persist a lightweight snapshot and diff against the previous upload.
          try {
            const prior = await listSnapshots()
            const snap = buildSnapshot(opts.fName, rows.length, res)
            await saveSnapshot(snap)
            setCurrentSnap(snap)
            setPreviousSnap(prior[0] ?? null)
            setSnapshots([snap, ...prior])
          } catch {
            /* IndexedDB may be unavailable (e.g. some file:// contexts) — non-fatal. */
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
        setPhase('error')
        setReanalyzing(false)
      }
    },
    [],
  )

  const onFile = useCallback(
    async (file: File) => {
      setError(null)
      setResult(null)
      setPartial({})
      setCurrentSnap(null)
      setPreviousSnap(null)
      setConfig(DEFAULT_CONFIG)
      setFileName(file.name)
      setPhase('parsing')
      setParsePct(0)
      setParsedRows(0)
      try {
        const { rows, completeness } = await parseCsvFile(file, (pct, rows) => {
          setParsePct(pct)
          setParsedRows(rows)
        })
        if (rows.length === 0) {
          setError('No usable rows found — every row was missing an event or timestamp.')
          setPhase('error')
          return
        }
        rowsRef.current = rows
        completenessRef.current = completeness
        await runAnalysis(rows, completeness, DEFAULT_CONFIG, { reanalysis: false, fName: file.name })
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
        setPhase('error')
      }
    },
    [runAnalysis],
  )

  const applyConfig = useCallback(
    (cfg: ClassifierConfig) => {
      setConfig(cfg)
      if (rowsRef.current.length && completenessRef.current) {
        void runAnalysis(rowsRef.current, completenessRef.current, cfg, {
          reanalysis: true,
          fName: fileName,
        })
      }
    },
    [runAnalysis, fileName],
  )

  const reset = useCallback(() => {
    setPhase('idle')
    setResult(null)
    setPartial({})
    setError(null)
    setFileName('')
    rowsRef.current = []
    completenessRef.current = null
  }, [])

  useEffect(() => {
    // Load stored run count on mount (for the history section subtitle).
    listSnapshots()
      .then((all) => setSnapshots(all))
      .catch(() => {})
  }, [])

  const diffMap = useMemo(() => {
    if (!currentSnap || !previousSnap) return undefined
    const m = new Map<string, DiffRow>()
    for (const r of computeDiff(currentSnap, previousSnap)) m.set(r.label, r)
    return m
  }, [currentSnap, previousSnap])

  const view = result ?? (partial as Partial<AnalysisResult>)
  const showDashboard = phase === 'analyzing' || phase === 'ready'

  return (
    <div className="app">
      <Header onReset={reset} hasData={phase === 'ready'} />

      <main className="app-main">
        {phase === 'idle' && <Dropzone onFile={onFile} />}

        {phase === 'parsing' && (
          <ProgressView
            phase="parsing"
            stage="Reading and normalising columns…"
            pct={parsePct}
            rows={parsedRows}
            fileName={fileName}
            mode={null}
          />
        )}

        {phase === 'error' && (
          <div className="panel error-panel">
            <div className="eyebrow" style={{ color: 'var(--neg)' }}>
              Could not analyse this file
            </div>
            <p className="error-msg">{error}</p>
            <button className="btn btn-primary" onClick={reset}>
              Try another file
            </button>
          </div>
        )}

        {showDashboard && (
          <div className="dashboard">
            {phase === 'analyzing' && (
              <div className="analyze-strip">
                <div className="analyze-strip-track">
                  <div className="analyze-strip-fill" style={{ width: `${Math.round(analyzePct * 100)}%` }} />
                </div>
                <span className="mono analyze-strip-label">
                  {stage} · {Math.round(analyzePct * 100)}%
                  {mode === 'main-thread' && ' · main-thread fallback'}
                </span>
              </div>
            )}

            {view.insights && <InsightsPanel insights={view.insights} />}
            {view.kpis && view.completeness && (
              <Overview kpis={view.kpis} completeness={view.completeness} diff={diffMap} />
            )}
            {phase === 'ready' && currentSnap && (
              <HistoryDiff
                current={currentSnap}
                previous={previousSnap}
                runCount={snapshots.length}
                onClear={() => {
                  void clearSnapshots().then(() => {
                    setSnapshots(currentSnap ? [currentSnap] : [])
                    setPreviousSnap(null)
                  })
                }}
              />
            )}
            {view.eventFreq && <EventFrequency rows={view.eventFreq} />}
            {view.timeseriesDay && view.timeseriesHour && (
              <Timeseries day={view.timeseriesDay} hour={view.timeseriesHour} />
            )}
            {view.retention && <Retention r={view.retention} />}
            {view.errors && <Errors e={view.errors} />}
            {view.forecast && <Forecast f={view.forecast} />}
            {view.segmentation && <Segmentation s={view.segmentation} />}
            {view.classes && (
              <AdvancedPanel classes={view.classes} config={config} onApply={applyConfig} busy={reanalyzing} />
            )}

            {phase === 'analyzing' && !view.insights && (
              <div className="panel streaming-note">
                <span className="spinner" /> Streaming results — KPIs first, heavier modules as they finish…
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="app-footer">
        <span>
          Signal Desk · all analysis runs locally in your browser — no upload, no network.
          {result && <> Engine: {Math.round(result.elapsedMs)} ms.</>}
        </span>
      </footer>
    </div>
  )
}
