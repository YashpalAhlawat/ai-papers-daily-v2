import { useState, useEffect, useCallback } from 'react'

// ─── Constants ────────────────────────────────────────────────────────────────
const CAT_COLORS = {
  'Language Models':       '#ff6b35',
  'Computer Vision':       '#4ecdc4',
  'Multimodal':            '#c77dff',
  'Reinforcement Learning':'#ffd93d',
  'Reasoning':             '#06d6a0',
  'Efficiency':            '#74b9ff',
  'AI Safety':             '#ff6b6b',
  'Audio / Speech':        '#fdcb6e',
  'Coding':                '#a29bfe',
  'AI Research':           '#8899aa',
}
const color = (cat) => CAT_COLORS[cat] ?? CAT_COLORS['AI Research']

function inferCategory(title = '', abstract = '') {
  const t = (title + ' ' + abstract).toLowerCase()
  if (t.match(/multimodal|multi-modal|vision.language|vlm|image.*text|text.*image/)) return 'Multimodal'
  if (t.match(/vision|image|visual|diffusion|pixel|video|segmentation|detection|generation/)) return 'Computer Vision'
  if (t.match(/code|program|software|bug|repo|repository/)) return 'Coding'
  if (t.match(/audio|speech|voice|sound|music/)) return 'Audio / Speech'
  if (t.match(/reinforcement|rl\b|reward|agent|policy|environment/)) return 'Reinforcement Learning'
  if (t.match(/safe|align|bias|harmful|fairness|toxic|red.team/)) return 'AI Safety'
  if (t.match(/reason|math|logic|proof|chain.of.thought|cot\b|step.by.step/)) return 'Reasoning'
  if (t.match(/efficient|fast|compress|quant|prune|distill|speed|latency/)) return 'Efficiency'
  if (t.match(/language model|llm|gpt|transformer|bert|token|pretraining|finetun/)) return 'Language Models'
  return 'AI Research'
}

// ─── Fetch papers from HuggingFace daily papers JSON API ─────────────────────
// HF exposes https://huggingface.co/api/daily_papers with CORS headers ✓
async function fetchHFPapers() {
  const res = await fetch('https://huggingface.co/api/daily_papers', {
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`HuggingFace API ${res.status}`)
  const data = await res.json()

  return data.slice(0, 10).map((item) => {
    const paper = item.paper ?? item
    const id    = paper.id ?? paper.arxiv_id ?? String(Math.random())
    const title = paper.title ?? 'Untitled'
    const abstract = paper.summary ?? paper.abstract ?? ''
    const authors = (paper.authors ?? []).map((a) => (typeof a === 'string' ? a : a.name ?? '')).filter(Boolean)
    const date  = (item.publishedAt ?? paper.publishedAt ?? '').slice(0, 10) || new Date().toISOString().slice(0, 10)
    const url   = `https://huggingface.co/papers/${id}`
    const category = inferCategory(title, abstract)
    return { id, title, abstract, authors, date, url, category }
  })
}

// ─── Generate layman summary via Claude API ───────────────────────────────────
async function generateSummary(title, abstract, apiKey) {
  const prompt = `You are explaining AI research to someone with zero technical background.

Paper: "${title}"
Abstract: "${abstract}"

Reply ONLY with valid JSON, no markdown fences, no extra text:
{"emoji":"<one emoji>","headline":"<punchy sentence, max 12 words>","summary":"<2-3 sentences using everyday analogies — what they built, what problem it fixes, why it matters>","impact":"<one sentence on real-world use>"}`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? `API ${res.status}`)
  }

  const data = await res.json()
  const text = (data.content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('')
  const clean = text.replace(/```json|```/g, '').trim()
  return JSON.parse(clean)
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────
function Skeleton() {
  const bar = (w, h = '12px', mb = '14px') => (
    <div style={{
      height: h, width: w, borderRadius: '6px', marginBottom: mb,
      background: 'linear-gradient(90deg,rgba(255,255,255,.04) 25%,rgba(255,255,255,.09) 50%,rgba(255,255,255,.04) 75%)',
      backgroundSize: '600px 100%',
      animation: 'shimmer 1.5s ease infinite',
    }} />
  )
  return (
    <div style={{ background:'rgba(255,255,255,.025)', border:'1px solid rgba(255,255,255,.06)', borderRadius:16, padding:28 }}>
      {bar('18%')} {bar('80%','17px')} {bar('38%')} {bar('95%')} {bar('65%')}
    </div>
  )
}

// ─── Summary box ──────────────────────────────────────────────────────────────
function SummaryBox({ s, cat }) {
  const c = color(cat)
  return (
    <div style={{
      background:`linear-gradient(135deg,${c}12,${c}07)`,
      border:`1px solid ${c}2a`, borderRadius:12, padding:20, marginBottom:20,
      animation:'fadeUp .4s ease',
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
        <span style={{ fontSize:20 }}>{s.emoji}</span>
        <span style={{ color:c, fontSize:10, letterSpacing:'1.5px', textTransform:'uppercase', fontFamily:'Space Mono,monospace' }}>Plain English</span>
      </div>
      <p style={{ color:'#eee', fontSize:14, fontFamily:'Playfair Display,serif', fontWeight:700, lineHeight:1.55, marginBottom:10 }}>{s.headline}</p>
      <p style={{ color:'#ccc', fontSize:13, fontFamily:'Lora,serif', lineHeight:1.85, marginBottom:s.impact?10:0 }}>{s.summary}</p>
      {s.impact && (
        <p style={{ color:'#888', fontSize:12, fontStyle:'italic', fontFamily:'Lora,serif', borderTop:'1px solid rgba(255,255,255,.07)', paddingTop:10 }}>
          💡 {s.impact}
        </p>
      )}
    </div>
  )
}

// ─── Paper card ───────────────────────────────────────────────────────────────
function PaperCard({ paper, summary, sumLoading, onSummarize }) {
  const c = color(paper.category)
  return (
    <div
      style={{ background:'rgba(255,255,255,.025)', border:'1px solid rgba(255,255,255,.07)', borderRadius:16, padding:28, transition:'all .25s ease' }}
      onMouseEnter={e=>{ const el=e.currentTarget; el.style.background='rgba(255,255,255,.05)'; el.style.borderColor=c+'44'; el.style.transform='translateY(-3px)'; el.style.boxShadow=`0 14px 40px ${c}18` }}
      onMouseLeave={e=>{ const el=e.currentTarget; el.style.background='rgba(255,255,255,.025)'; el.style.borderColor='rgba(255,255,255,.07)'; el.style.transform='none'; el.style.boxShadow='none' }}
    >
      {/* Header row */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:8 }}>
        <span style={{ background:c+'18', color:c, border:`1px solid ${c}35`, borderRadius:20, padding:'4px 12px', fontSize:10, fontFamily:'Space Mono,monospace', textTransform:'uppercase', letterSpacing:'0.8px' }}>
          {paper.category}
        </span>
        <span style={{ color:'#383838', fontSize:11, fontFamily:'Space Mono,monospace' }}>{paper.date}</span>
      </div>

      {/* Title */}
      <h3 style={{ color:'#f0f0f0', fontSize:15, fontFamily:'Playfair Display,serif', fontWeight:700, lineHeight:1.55, marginBottom:12 }}>
        {paper.title}
      </h3>

      {/* Authors */}
      {paper.authors?.length > 0 && (
        <p style={{ color:'#444', fontSize:11, fontFamily:'Space Mono,monospace', marginBottom:14 }}>
          {paper.authors.slice(0,3).join(', ')}{paper.authors.length > 3 ? ' et al.' : ''}
        </p>
      )}

      {/* Abstract */}
      {paper.abstract && (
        <p style={{ color:'#666', fontSize:13, fontFamily:'Lora,serif', lineHeight:1.75, marginBottom:20 }}>
          {paper.abstract.slice(0, 240)}{paper.abstract.length > 240 ? '…' : ''}
        </p>
      )}

      {/* Summary */}
      {summary && <SummaryBox s={summary} cat={paper.category} />}

      {/* Summary loading */}
      {sumLoading && (
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 18px', marginBottom:20, background:'rgba(255,255,255,.02)', borderRadius:10, border:'1px solid rgba(255,255,255,.05)' }}>
          <span style={{ animation:'spin .8s linear infinite', display:'inline-block', fontSize:15 }}>⟳</span>
          <span style={{ color:'#444', fontSize:11, fontFamily:'Space Mono,monospace' }}>Generating plain-English summary…</span>
        </div>
      )}

      {/* Buttons */}
      <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
        <button
          onClick={onSummarize}
          disabled={sumLoading}
          style={{ background:sumLoading?'rgba(255,255,255,.03)':`${c}22`, color:sumLoading?'#333':c, border:`1px solid ${sumLoading?'rgba(255,255,255,.05)':c+'40'}`, borderRadius:8, padding:'9px 18px', fontSize:11, fontFamily:'Space Mono,monospace', fontWeight:700, cursor:sumLoading?'not-allowed':'pointer', transition:'all .2s' }}
        >
          {summary ? '↻ Re-explain' : '✦ Explain Simply'}
        </button>
        <a
          href={paper.url} target="_blank" rel="noopener noreferrer"
          style={{ background:'rgba(255,255,255,.04)', color:'#555', border:'1px solid rgba(255,255,255,.08)', borderRadius:8, padding:'9px 16px', fontSize:11, fontFamily:'Space Mono,monospace', textDecoration:'none', transition:'all .2s' }}
          onMouseEnter={e=>{ e.target.style.color='#bbb'; e.target.style.background='rgba(255,255,255,.08)' }}
          onMouseLeave={e=>{ e.target.style.color='#555'; e.target.style.background='rgba(255,255,255,.04)' }}
        >
          Read Paper →
        </a>
      </div>
    </div>
  )
}

// ─── API Key modal ────────────────────────────────────────────────────────────
function KeyModal({ onSave }) {
  const [val, setVal] = useState('')
  const valid = val.startsWith('sk-ant-') || val.startsWith('sk-')
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.88)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:24, backdropFilter:'blur(8px)' }}>
      <div style={{ background:'#0e1016', border:'1px solid rgba(255,255,255,.1)', borderRadius:20, padding:40, maxWidth:440, width:'100%', animation:'fadeUp .3s ease' }}>
        <div style={{ fontSize:32, marginBottom:14 }}>🔑</div>
        <h2 style={{ fontFamily:'Playfair Display,serif', fontSize:22, marginBottom:10, color:'#f0f0f0' }}>Add Anthropic API Key</h2>
        <p style={{ color:'#555', fontSize:13, lineHeight:1.8, marginBottom:24, fontFamily:'Lora,serif' }}>
          Papers load instantly for free. An API key is only needed to generate plain-English summaries.
          It's stored only in your browser and sent only to Anthropic.
        </p>
        <input
          type="password" placeholder="sk-ant-..." value={val}
          onChange={e=>setVal(e.target.value)}
          onKeyDown={e=>e.key==='Enter' && valid && onSave(val)}
          style={{ width:'100%', padding:'12px 16px', background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.12)', borderRadius:10, color:'#f0f0f0', fontSize:13, fontFamily:'Space Mono,monospace', marginBottom:14, outline:'none' }}
        />
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={()=>onSave(val)} disabled={!valid}
            style={{ flex:1, padding:'12px', background:valid?'linear-gradient(135deg,#ff6b35,#c77dff)':'rgba(255,255,255,.05)', color:valid?'#000':'#333', border:'none', borderRadius:10, fontSize:12, fontFamily:'Space Mono,monospace', fontWeight:700, cursor:valid?'pointer':'not-allowed' }}>
            Save Key
          </button>
          <button onClick={()=>onSave(null)}
            style={{ padding:'12px 20px', background:'rgba(255,255,255,.04)', color:'#555', border:'1px solid rgba(255,255,255,.08)', borderRadius:10, fontSize:12, fontFamily:'Space Mono,monospace', cursor:'pointer' }}>
            Skip
          </button>
        </div>
        <p style={{ color:'#2a2a2a', fontSize:11, marginTop:14, fontFamily:'Lora,serif' }}>
          Get a free key at <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer" style={{ color:'#444' }}>console.anthropic.com</a>
        </p>
      </div>
    </div>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [papers,        setPapers]        = useState([])
  const [summaries,     setSummaries]     = useState({})
  const [loadingPapers, setLoadingPapers] = useState(false)
  const [loadingSum,    setLoadingSum]    = useState({})
  const [summarizingAll,setSummarizingAll]= useState(false)
  const [error,         setError]         = useState(null)
  const [showModal,     setShowModal]     = useState(false)
  const [apiKey,        setApiKey]        = useState(() => {
    try { return localStorage.getItem('anthropic_key') || null } catch { return null }
  })

  const loadPapers = useCallback(async () => {
    setLoadingPapers(true)
    setError(null)
    setSummaries({})
    try {
      const data = await fetchHFPapers()
      setPapers(data)
    } catch (e) {
      setError('Could not load papers from Hugging Face. Check your connection and try again.')
      console.error(e)
    } finally {
      setLoadingPapers(false)
    }
  }, [])

  useEffect(() => { loadPapers() }, [loadPapers])

  const saveKey = (key) => {
    if (key) { try { localStorage.setItem('anthropic_key', key) } catch {} }
    setApiKey(key)
    setShowModal(false)
  }

  const handleSummarize = useCallback(async (paper) => {
    if (!apiKey) { setShowModal(true); return }
    setLoadingSum(prev => ({ ...prev, [paper.id]: true }))
    try {
      const s = await generateSummary(paper.title, paper.abstract, apiKey)
      setSummaries(prev => ({ ...prev, [paper.id]: s }))
    } catch (e) {
      setSummaries(prev => ({ ...prev, [paper.id]: { emoji:'⚠️', headline:'Summary failed', summary: e.message || 'Please try again.', impact:'' } }))
    } finally {
      setLoadingSum(prev => ({ ...prev, [paper.id]: false }))
    }
  }, [apiKey])

  const handleSummarizeAll = useCallback(async () => {
    if (!apiKey) { setShowModal(true); return }
    setSummarizingAll(true)
    for (const p of papers) {
      if (!summaries[p.id]) await handleSummarize(p)
    }
    setSummarizingAll(false)
  }, [papers, summaries, handleSummarize, apiKey])

  return (
    <div style={{ minHeight:'100vh', background:'#07090d' }}>
      {showModal && <KeyModal onSave={saveKey} />}

      {/* Subtle grid */}
      <div style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:0, opacity:.015,
        backgroundImage:'linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)',
        backgroundSize:'44px 44px' }} />

      <div style={{ maxWidth:880, margin:'0 auto', padding:'56px 24px 80px', position:'relative', zIndex:1 }}>

        {/* ── Header ── */}
        <div style={{ marginBottom:48, animation:'fadeUp .6s ease' }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:16, marginBottom:0 }}>
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
                <div style={{ width:40, height:40, borderRadius:10, background:'linear-gradient(135deg,#ff6b35,#c77dff)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, boxShadow:'0 0 22px #ff6b3530' }}>⚡</div>
                <span style={{ color:'#ff6b35', fontSize:10, letterSpacing:'3px', textTransform:'uppercase' }}>Daily Intelligence Feed</span>
              </div>
              <h1 style={{ fontFamily:'Playfair Display,serif', fontSize:'clamp(26px,5vw,40px)', fontWeight:900, lineHeight:1.1,
                background:'linear-gradient(135deg,#fff 30%,#555)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', marginBottom:12 }}>
                AI Research, Decoded
              </h1>
              <p style={{ color:'#444', fontSize:13, lineHeight:1.85, maxWidth:500, fontFamily:'Lora,serif' }}>
                Latest papers straight from Hugging Face — loaded in seconds, summarized in plain English by Claude AI.
              </p>
            </div>

            <button onClick={()=>setShowModal(true)} style={{
              background: apiKey ? 'rgba(6,214,160,.1)' : 'rgba(255,107,53,.1)',
              color:       apiKey ? '#06d6a0'            : '#ff6b35',
              border:`1px solid ${apiKey?'rgba(6,214,160,.22)':'rgba(255,107,53,.22)'}`,
              borderRadius:10, padding:'10px 16px', fontSize:11,
              fontFamily:'Space Mono,monospace', cursor:'pointer',
              display:'flex', alignItems:'center', gap:6, whiteSpace:'nowrap',
            }}>
              {apiKey ? '🔑 Key saved' : '🔑 Add API key'}
            </button>
          </div>
        </div>

        {/* ── Controls ── */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:32, flexWrap:'wrap' }}>
          <button onClick={loadPapers} disabled={loadingPapers} style={{
            background: loadingPapers ? 'rgba(255,255,255,.03)' : 'rgba(255,107,53,.12)',
            color:       loadingPapers ? '#333'                  : '#ff6b35',
            border:`1px solid ${loadingPapers?'rgba(255,255,255,.05)':'rgba(255,107,53,.25)'}`,
            borderRadius:9, padding:'10px 20px', fontSize:11, fontFamily:'Space Mono,monospace',
            fontWeight:700, cursor:loadingPapers?'not-allowed':'pointer',
            display:'flex', alignItems:'center', gap:7, transition:'all .2s',
          }}>
            <span style={loadingPapers?{animation:'spin .9s linear infinite',display:'inline-block'}:{}}>{loadingPapers?'⟳':'⟳'}</span>
            {loadingPapers ? 'Fetching…' : 'Refresh Papers'}
          </button>

          {papers.length > 0 && (
            <button onClick={handleSummarizeAll} disabled={summarizingAll||loadingPapers} style={{
              background: summarizingAll ? 'rgba(255,255,255,.03)' : 'rgba(199,125,255,.1)',
              color:       summarizingAll ? '#333'                  : '#c77dff',
              border:`1px solid ${summarizingAll?'rgba(255,255,255,.05)':'rgba(199,125,255,.22)'}`,
              borderRadius:9, padding:'10px 20px', fontSize:11, fontFamily:'Space Mono,monospace',
              fontWeight:700, cursor:summarizingAll?'not-allowed':'pointer',
              display:'flex', alignItems:'center', gap:7, transition:'all .2s',
            }}>
              <span style={summarizingAll?{animation:'pulse 1s ease infinite',display:'inline-block'}:{}}>✦</span>
              {summarizingAll ? 'Summarizing…' : 'Summarize All'}
            </button>
          )}

          {papers.length > 0 && !loadingPapers && (
            <span style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background:'#06d6a0', animation:'pulse 2s ease infinite', display:'inline-block' }} />
              <span style={{ color:'#2a2a2a', fontSize:11, fontFamily:'Space Mono,monospace' }}>{papers.length} papers</span>
            </span>
          )}
        </div>

        {/* ── Error ── */}
        {error && (
          <div style={{ background:'rgba(255,80,80,.07)', border:'1px solid rgba(255,80,80,.18)', borderRadius:10, padding:'14px 20px', color:'#ff8080', fontSize:13, marginBottom:24, fontFamily:'Lora,serif' }}>
            ⚠️ {error}
          </div>
        )}

        {/* ── Skeletons ── */}
        {loadingPapers && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {[1,2,3,4,5].map(i=><Skeleton key={i}/>)}
          </div>
        )}

        {/* ── Papers ── */}
        {!loadingPapers && papers.length > 0 && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {papers.map((p,i)=>(
              <div key={p.id} style={{ animation:`fadeUp .45s ease ${i*.07}s both` }}>
                <PaperCard
                  paper={p}
                  summary={summaries[p.id]}
                  sumLoading={!!loadingSum[p.id]}
                  onSummarize={()=>handleSummarize(p)}
                />
              </div>
            ))}
          </div>
        )}

        {/* ── Empty ── */}
        {!loadingPapers && papers.length===0 && !error && (
          <div style={{ textAlign:'center', padding:'80px 0', color:'#2a2a2a' }}>
            <div style={{ fontSize:48, marginBottom:16 }}>📡</div>
            <p style={{ fontFamily:'Space Mono,monospace', fontSize:13 }}>No papers loaded yet</p>
          </div>
        )}

        {/* ── Footer ── */}
        <div style={{ marginTop:60, paddingTop:24, borderTop:'1px solid rgba(255,255,255,.05)', textAlign:'center' }}>
          <p style={{ color:'#1a1a1a', fontSize:10, letterSpacing:'1.5px', fontFamily:'Space Mono,monospace' }}>
            PAPERS FROM HUGGING FACE · SUMMARIES BY CLAUDE AI
          </p>
        </div>
      </div>
    </div>
  )
}
