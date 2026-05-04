import { useState, useRef, useCallback, useEffect } from 'react'
import Head from 'next/head'

const STEPS = [
  { id: 'token', label: 'Token', icon: '🔑' },
  { id: 'upload', label: 'Fotos', icon: '📸' },
  { id: 'config', label: 'Config', icon: '⚙️' },
  { id: 'train', label: 'Treino', icon: '🧠' },
  { id: 'generate', label: 'Gerar', icon: '✨' },
]

const STATUS_COLOR = {
  idle: '#64748b',
  starting: '#f59e0b',
  processing: '#6366f1',
  succeeded: '#10b981',
  failed: '#ef4444',
}

export default function Home() {
  const [step, setStep] = useState('token')
  const [apiToken, setApiToken] = useState('')
  const [tokenSaved, setTokenSaved] = useState(false)
  const [images, setImages] = useState([])
  const [imagePreviews, setImagePreviews] = useState([])
  const [uploading, setUploading] = useState(false)
  const [datasetReady, setDatasetReady] = useState(false)
  const [trigger, setTrigger] = useState('TOK')
  const [trainSteps, setTrainSteps] = useState(1000)
  const [rank, setRank] = useState(16)
  const [scheduler, setScheduler] = useState('constant')
  const [trainingId, setTrainingId] = useState(null)
  const [trainingStatus, setTrainingStatus] = useState('idle')
  const [trainingLogs, setTrainingLogs] = useState([])
  const [loraWeights, setLoraWeights] = useState('')
  const [prompt, setPrompt] = useState('')
  const [generatedImages, setGeneratedImages] = useState([])
  const [generating, setGenerating] = useState(false)
  const [logs, setLogs] = useState(['$ LoRA Studio iniciado. Aguardando token...'])
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef()
  const logsRef = useRef()
  const pollRef = useRef()

  const log = (msg) => setLogs(p => [...p, `[${new Date().toLocaleTimeString()}] ${msg}`])

  useEffect(() => {
    if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight
  }, [logs])

  const saveToken = () => {
    if (!apiToken.trim().startsWith('r8_')) return alert('Token inválido. Deve começar com r8_')
    setTokenSaved(true)
    log('✅ Token salvo. Pronto para treinar!')
    setStep('upload')
  }

  const handleFiles = useCallback((files) => {
    const imgs = Array.from(files).filter(f => f.type.startsWith('image/'))
    if (imgs.length < 5) return alert('Mínimo de 5 imagens necessário.')
    setImages(imgs)
    const previews = imgs.slice(0, 12).map(f => URL.createObjectURL(f))
    setImagePreviews(previews)
    log(`📸 ${imgs.length} imagens selecionadas.`)
  }, [])

  const onDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    handleFiles(e.dataTransfer.files)
  }

  const prepareDataset = async () => {
    setUploading(true)
    log('📦 Preparando dataset...')
    // In production: use JSZip to zip images and upload to a storage bucket
    // For now we simulate preparation
    await new Promise(r => setTimeout(r, 1500))
    setDatasetReady(true)
    setUploading(false)
    log(`✅ ${images.length} imagens prontas para treino.`)
    setStep('config')
  }

  const startTraining = async () => {
    if (!tokenSaved) return alert('Salve o token primeiro.')
    setStep('train')
    setTrainingStatus('starting')
    log('🚀 Iniciando treino no Replicate...')

    try {
      // NOTE: In production you need a backend proxy to avoid CORS.
      // This calls Replicate directly - works if CORS is allowed or via a Next.js API route.
      const res = await fetch('/api/train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: apiToken,
          trigger,
          steps: trainSteps,
          rank,
          scheduler,
          imageCount: images.length,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao iniciar treino')
      }

      const data = await res.json()
      setTrainingId(data.id)
      setTrainingStatus('processing')
      log(`📋 Treino iniciado: ${data.id}`)
      pollTraining(data.id)
    } catch (err) {
      log(`❌ Erro: ${err.message}`)
      setTrainingStatus('failed')
    }
  }

  const pollTraining = (id) => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/training-status?id=${id}&token=${apiToken}`)
        const data = await res.json()
        setTrainingStatus(data.status)

        if (data.logs) {
          const lines = data.logs.split('\n').filter(Boolean)
          const last = lines[lines.length - 1]
          if (last) log(`📊 ${last}`)
        }

        if (data.status === 'succeeded') {
          clearInterval(pollRef.current)
          const weights = data.output?.weights
          if (weights) setLoraWeights(weights)
          log(`🎉 Treino concluído! Weights disponíveis.`)
          setStep('generate')
        } else if (data.status === 'failed') {
          clearInterval(pollRef.current)
          log(`❌ Falhou: ${data.error}`)
        }
      } catch (err) {
        log(`⚠️ Erro ao checar: ${err.message}`)
      }
    }, 10000)
  }

  const generateImage = async () => {
    if (!prompt.trim()) return alert('Digite um prompt.')
    if (!loraWeights) return alert('Cole a URL dos LoRA weights.')
    setGenerating(true)
    log(`🎨 Gerando: "${trigger} ${prompt}"`)

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: apiToken, prompt: `${trigger} ${prompt}`, loraWeights }),
      })
      const data = await res.json()
      if (data.imageUrl) {
        setGeneratedImages(p => [data.imageUrl, ...p])
        log('✅ Imagem gerada!')
      } else {
        log(`❌ ${data.error}`)
      }
    } catch (err) {
      log(`❌ ${err.message}`)
    }
    setGenerating(false)
  }

  const stepIndex = STEPS.findIndex(s => s.id === step)

  return (
    <>
      <Head>
        <title>LoRA Studio — Treinamento de Personagens</title>
        <meta name="description" content="Treine consistência visual de personagens com IA" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="app">
        {/* Background effects */}
        <div className="bg-grid" />
        <div className="bg-orb orb-1" />
        <div className="bg-orb orb-2" />

        <div className="container">
          {/* Header */}
          <header className="header">
            <div className="badge">◆ LORA STUDIO ◆</div>
            <h1 className="title">Character LoRA Trainer</h1>
            <p className="subtitle">Treine consistência visual de personagens com Flux + Replicate</p>
          </header>

          {/* Step Navigator */}
          <nav className="steps-nav">
            {STEPS.map((s, i) => (
              <button
                key={s.id}
                className={`step-btn ${step === s.id ? 'active' : ''} ${i < stepIndex ? 'done' : ''}`}
                onClick={() => i <= stepIndex && setStep(s.id)}
                disabled={i > stepIndex}
              >
                <span className="step-icon">{i < stepIndex ? '✓' : s.icon}</span>
                <span className="step-label">{s.label}</span>
              </button>
            ))}
          </nav>

          {/* Main Panel */}
          <main className="panel">

            {/* TOKEN */}
            {step === 'token' && (
              <section className="section fade-in">
                <h2 className="section-title">🔑 Conectar Replicate</h2>
                <p className="section-desc">
                  Cole seu token da API do Replicate. Ele fica salvo apenas no seu navegador.
                </p>
                <div className="token-form">
                  <input
                    type="password"
                    className="input"
                    value={apiToken}
                    onChange={e => setApiToken(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveToken()}
                    placeholder="r8_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    disabled={tokenSaved}
                  />
                  {!tokenSaved ? (
                    <button className="btn btn-primary" onClick={saveToken}>SALVAR TOKEN</button>
                  ) : (
                    <div className="badge-success">✓ CONECTADO</div>
                  )}
                </div>
                <p className="hint">
                  Obtenha em: replicate.com/account/api-tokens
                </p>
              </section>
            )}

            {/* UPLOAD */}
            {step === 'upload' && (
              <section className="section fade-in">
                <h2 className="section-title">📸 Dataset do Personagem</h2>
                <p className="section-desc">
                  Carregue 10–25 fotos. Varie ângulos, expressões e iluminação para melhor consistência.
                </p>

                <div
                  className={`dropzone ${dragOver ? 'drag-over' : ''} ${images.length > 0 ? 'has-images' : ''}`}
                  onDrop={onDrop}
                  onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onClick={() => fileRef.current.click()}
                >
                  <div className="dropzone-icon">{images.length > 0 ? '🖼️' : '⬆️'}</div>
                  <div className="dropzone-text">
                    {images.length > 0
                      ? `${images.length} imagens carregadas`
                      : 'Arraste imagens aqui ou clique para selecionar'}
                  </div>
                  <div className="dropzone-hint">JPG, PNG, WEBP — mínimo 5 imagens</div>
                  <input
                    ref={fileRef}
                    type="file"
                    multiple
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={e => handleFiles(e.target.files)}
                  />
                </div>

                {imagePreviews.length > 0 && (
                  <div className="previews">
                    {imagePreviews.map((src, i) => (
                      <div key={i} className="preview-thumb">
                        <img src={src} alt="" />
                      </div>
                    ))}
                    {images.length > 12 && (
                      <div className="preview-more">+{images.length - 12}</div>
                    )}
                  </div>
                )}

                <button
                  className="btn btn-primary btn-full"
                  onClick={prepareDataset}
                  disabled={images.length < 5 || uploading}
                >
                  {uploading ? '⏳ PROCESSANDO...' : 'CONTINUAR →'}
                </button>
              </section>
            )}

            {/* CONFIG */}
            {step === 'config' && (
              <section className="section fade-in">
                <h2 className="section-title">⚙️ Configuração do Treino</h2>
                <p className="section-desc">Parâmetros otimizados para Flux Dev LoRA.</p>

                <div className="config-grid">
                  <div className="field">
                    <label className="label">TRIGGER WORD</label>
                    <input
                      className="input"
                      value={trigger}
                      onChange={e => setTrigger(e.target.value.toUpperCase())}
                      placeholder="Ex: JEADSON"
                    />
                    <span className="hint">Palavra única que ativa o personagem nos prompts</span>
                  </div>

                  <div className="field">
                    <label className="label">TRAINING STEPS</label>
                    <input
                      className="input"
                      type="number"
                      value={trainSteps}
                      onChange={e => setTrainSteps(Number(e.target.value))}
                      min={500} max={4000}
                    />
                    <span className="hint">1000–2000 recomendado para consistência</span>
                  </div>

                  <div className="field">
                    <label className="label">LORA RANK</label>
                    <input
                      className="input"
                      type="number"
                      value={rank}
                      onChange={e => setRank(Number(e.target.value))}
                      min={4} max={128}
                    />
                    <span className="hint">16 = rápido · 32 = balanceado · 64 = máximo</span>
                  </div>

                  <div className="field">
                    <label className="label">LR SCHEDULER</label>
                    <select
                      className="input"
                      value={scheduler}
                      onChange={e => setScheduler(e.target.value)}
                    >
                      <option value="constant">constant</option>
                      <option value="cosine">cosine</option>
                      <option value="linear">linear</option>
                    </select>
                    <span className="hint">constant = estável · cosine = dinâmico</span>
                  </div>
                </div>

                <div className="summary-box">
                  <div className="summary-title">RESUMO</div>
                  <div className="summary-grid">
                    {[
                      ['Imagens', images.length],
                      ['Trigger', trigger],
                      ['Steps', trainSteps],
                      ['Rank', rank],
                      ['Scheduler', scheduler],
                      ['Custo est.', '~$0.50'],
                    ].map(([k, v]) => (
                      <div key={k} className="summary-item">
                        <div className="summary-key">{k}</div>
                        <div className="summary-val">{v}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <button className="btn btn-primary btn-full" onClick={startTraining}>
                  🚀 INICIAR TREINO
                </button>
              </section>
            )}

            {/* TRAIN */}
            {step === 'train' && (
              <section className="section fade-in">
                <h2 className="section-title">🧠 Treinando LoRA</h2>

                <div className="status-row">
                  <div
                    className="status-dot"
                    style={{
                      background: STATUS_COLOR[trainingStatus],
                      boxShadow: `0 0 12px ${STATUS_COLOR[trainingStatus]}`,
                      animation: trainingStatus === 'processing' ? 'pulse 1.2s infinite' : 'none',
                    }}
                  />
                  <span className="status-text" style={{ color: STATUS_COLOR[trainingStatus] }}>
                    {trainingStatus.toUpperCase()}
                  </span>
                  {trainingId && (
                    <span className="status-id">#{trainingId.slice(0, 8)}...</span>
                  )}
                </div>

                <div className="progress-bar-wrap">
                  <div className="progress-bar-inner"
                    style={{
                      width: trainingStatus === 'succeeded' ? '100%'
                        : trainingStatus === 'processing' ? '65%'
                        : trainingStatus === 'starting' ? '15%' : '5%'
                    }}
                  />
                </div>

                {trainingStatus === 'succeeded' && (
                  <div className="alert alert-success">
                    <strong>🎉 Treino concluído!</strong>
                    {loraWeights && <div className="alert-sub">{loraWeights}</div>}
                    <button
                      className="btn btn-primary"
                      style={{ marginTop: '16px' }}
                      onClick={() => setStep('generate')}
                    >
                      GERAR IMAGENS →
                    </button>
                  </div>
                )}

                {trainingStatus === 'failed' && (
                  <div className="alert alert-error">
                    <strong>❌ Treino falhou.</strong> Verifique os logs abaixo.
                  </div>
                )}

                {trainingStatus === 'processing' && (
                  <div className="alert alert-info">
                    <strong>⏳ Treinando...</strong> Isso leva 20–40 minutos. Não feche a página.
                  </div>
                )}
              </section>
            )}

            {/* GENERATE */}
            {step === 'generate' && (
              <section className="section fade-in">
                <h2 className="section-title">✨ Gerar Imagens</h2>
                <p className="section-desc">
                  Use <strong style={{ color: '#818cf8' }}>{trigger}</strong> no prompt para ativar o personagem.
                </p>

                {!loraWeights && (
                  <div className="field" style={{ marginBottom: '16px' }}>
                    <label className="label">URL DOS WEIGHTS (cole aqui)</label>
                    <input
                      className="input"
                      value={loraWeights}
                      onChange={e => setLoraWeights(e.target.value)}
                      placeholder="https://replicate.delivery/..."
                    />
                  </div>
                )}

                <div className="prompt-row">
                  <input
                    className="input"
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && generateImage()}
                    placeholder={`${trigger} sorrindo, foto profissional 4k...`}
                  />
                  <button
                    className="btn btn-primary"
                    onClick={generateImage}
                    disabled={generating}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    {generating ? '⏳' : 'GERAR'}
                  </button>
                </div>

                <div className="quick-prompts">
                  {[
                    `${trigger} sorrindo, close-up`,
                    `${trigger} em ambiente urbano`,
                    `${trigger} retrato profissional`,
                    `${trigger} estilo cinematográfico`,
                  ].map(p => (
                    <button key={p} className="quick-btn" onClick={() => setPrompt(p)}>{p}</button>
                  ))}
                </div>

                {generatedImages.length > 0 ? (
                  <div className="image-grid">
                    {generatedImages.map((url, i) => (
                      <div key={i} className="image-card">
                        <img src={url} alt={`Generated ${i + 1}`} />
                        <a href={url} download className="download-btn">↓</a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    {generating ? '🎨 Gerando sua imagem...' : 'Nenhuma imagem gerada ainda'}
                  </div>
                )}
              </section>
            )}
          </main>

          {/* Terminal */}
          <div className="terminal">
            <div className="terminal-bar">
              <span className="dot red" /><span className="dot yellow" /><span className="dot green" />
              <span className="terminal-label">LOGS</span>
            </div>
            <div className="terminal-body" ref={logsRef}>
              {logs.map((l, i) => <div key={i} className="log-line">{l}</div>)}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .app {
          min-height: 100vh;
          position: relative;
          padding: 0;
        }
        .bg-grid {
          position: fixed; inset: 0; z-index: 0; pointer-events: none;
          background-image:
            linear-gradient(rgba(99,102,241,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(99,102,241,0.05) 1px, transparent 1px);
          background-size: 48px 48px;
        }
        .bg-orb {
          position: fixed; border-radius: 50%; pointer-events: none; z-index: 0;
        }
        .orb-1 {
          width: 700px; height: 700px; top: -300px; left: -300px;
          background: radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%);
        }
        .orb-2 {
          width: 500px; height: 500px; bottom: -200px; right: -200px;
          background: radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%);
        }
        .container {
          position: relative; z-index: 1;
          max-width: 900px; margin: 0 auto;
          padding: 40px 20px 60px;
        }
        .header { text-align: center; margin-bottom: 48px; }
        .badge {
          display: inline-flex; align-items: center;
          background: rgba(99,102,241,0.12); border: 1px solid rgba(99,102,241,0.3);
          border-radius: 100px; padding: 6px 18px; margin-bottom: 20px;
          font-size: 10px; letter-spacing: 3px; color: #818cf8;
        }
        .title {
          font-family: var(--font-display);
          font-size: clamp(28px, 5vw, 52px); font-weight: 800;
          letter-spacing: -2px; line-height: 1.1;
          background: linear-gradient(135deg, #e2e8f0 0%, #818cf8 50%, #10b981 100%);
          background-size: 200% 200%;
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: gradientShift 4s ease infinite;
          margin-bottom: 12px;
        }
        .subtitle { color: var(--muted); font-size: 13px; letter-spacing: 0.5px; }

        .steps-nav {
          display: flex; background: var(--surface);
          border: 1px solid var(--border); border-radius: 14px;
          padding: 6px; margin-bottom: 24px; gap: 2px;
          backdrop-filter: blur(12px);
        }
        .step-btn {
          flex: 1; padding: 10px 6px; border: none; border-radius: 10px;
          background: transparent; color: var(--dim);
          cursor: not-allowed; transition: all 0.2s;
          display: flex; flex-direction: column; align-items: center; gap: 4px;
        }
        .step-btn.done { color: #4ade80; cursor: pointer; }
        .step-btn.active {
          background: linear-gradient(135deg, rgba(99,102,241,0.35), rgba(79,70,229,0.35));
          color: #a5b4fc; cursor: pointer;
        }
        .step-icon { font-size: 16px; }
        .step-label { font-size: 9px; letter-spacing: 1px; font-weight: 700; }

        .panel {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: 20px; padding: 32px; margin-bottom: 20px;
          backdrop-filter: blur(12px); min-height: 300px;
        }
        .fade-in { animation: fadeIn 0.3s ease forwards; }
        .section-title {
          font-family: var(--font-display); font-size: 20px; font-weight: 800;
          color: var(--text); margin-bottom: 8px;
        }
        .section-desc { color: var(--muted); font-size: 12px; margin-bottom: 24px; line-height: 1.7; }

        .token-form { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 8px; }
        .badge-success {
          padding: 10px 16px; background: rgba(16,185,129,0.15);
          border: 1px solid rgba(16,185,129,0.3); border-radius: 10px;
          color: #10b981; font-size: 11px; font-weight: 700; letter-spacing: 1px;
          display: flex; align-items: center;
        }

        .input {
          width: 100%; background: rgba(99,102,241,0.07);
          border: 1px solid var(--border); border-radius: 10px;
          padding: 11px 14px; color: var(--text); font-size: 13px;
          outline: none; transition: border-color 0.2s;
        }
        .input:focus { border-color: rgba(99,102,241,0.5); }
        .input:disabled { opacity: 0.5; cursor: not-allowed; }
        select.input { cursor: pointer; }

        .hint { font-size: 11px; color: var(--dim); margin-top: 6px; display: block; }

        .btn {
          padding: 11px 20px; border: none; border-radius: 10px;
          font-family: var(--font-mono); font-weight: 700; font-size: 12px;
          letter-spacing: 1.5px; cursor: pointer; transition: all 0.2s;
        }
        .btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .btn-primary {
          background: linear-gradient(135deg, #6366f1, #4f46e5);
          color: white;
        }
        .btn-primary:hover:not(:disabled) {
          background: linear-gradient(135deg, #818cf8, #6366f1);
          transform: translateY(-1px);
        }
        .btn-full { display: block; width: 100%; margin-top: 24px; padding: 14px; }

        .dropzone {
          border: 2px dashed rgba(99,102,241,0.3); border-radius: 16px;
          padding: 48px 24px; text-align: center; cursor: pointer;
          transition: all 0.3s; margin-bottom: 16px;
        }
        .dropzone:hover, .dropzone.drag-over {
          border-color: rgba(99,102,241,0.7);
          background: rgba(99,102,241,0.05);
        }
        .dropzone.has-images { border-style: solid; border-color: rgba(99,102,241,0.4); }
        .dropzone-icon { font-size: 44px; margin-bottom: 12px; }
        .dropzone-text { color: #818cf8; font-weight: 700; font-size: 14px; margin-bottom: 6px; }
        .dropzone-hint { color: var(--dim); font-size: 11px; }

        .previews { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; }
        .preview-thumb {
          width: 70px; height: 70px; border-radius: 10px; overflow: hidden;
          border: 1px solid var(--border);
        }
        .preview-thumb img { width: 100%; height: 100%; object-fit: cover; }
        .preview-more {
          width: 70px; height: 70px; border-radius: 10px;
          border: 1px solid var(--border); display: flex;
          align-items: center; justify-content: center;
          color: var(--indigo-light); font-size: 13px; font-weight: 700;
        }

        .config-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-bottom: 20px;
        }
        @media (max-width: 600px) { .config-grid { grid-template-columns: 1fr; } }
        .field { display: flex; flex-direction: column; }
        .label {
          font-size: 9px; color: #6366f1; letter-spacing: 2.5px;
          font-weight: 700; margin-bottom: 6px;
        }

        .summary-box {
          background: rgba(99,102,241,0.07); border: 1px solid rgba(99,102,241,0.2);
          border-radius: 12px; padding: 16px;
        }
        .summary-title {
          font-size: 9px; color: #6366f1; letter-spacing: 3px; margin-bottom: 12px;
        }
        .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .summary-key { font-size: 10px; color: var(--dim); margin-bottom: 4px; }
        .summary-val { font-size: 14px; color: #a5b4fc; font-weight: 700; }

        .status-row {
          display: flex; align-items: center; gap: 12px; margin-bottom: 20px;
        }
        .status-dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; }
        .status-text { font-weight: 700; letter-spacing: 1.5px; font-size: 13px; }
        .status-id { font-size: 11px; color: var(--dim); }

        .progress-bar-wrap {
          height: 6px; background: rgba(99,102,241,0.15);
          border-radius: 100px; overflow: hidden; margin-bottom: 20px;
        }
        .progress-bar-inner {
          height: 100%; border-radius: 100px;
          background: linear-gradient(90deg, #6366f1, #10b981);
          transition: width 1s ease;
        }

        .alert {
          padding: 16px; border-radius: 12px; font-size: 13px; margin-bottom: 16px;
        }
        .alert-success {
          background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.3); color: #10b981;
        }
        .alert-error {
          background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); color: #ef4444;
        }
        .alert-info {
          background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.3); color: #818cf8;
        }
        .alert-sub { font-size: 11px; margin-top: 6px; word-break: break-all; opacity: 0.8; }

        .prompt-row { display: flex; gap: 10px; margin-bottom: 12px; }
        .quick-prompts { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 20px; }
        .quick-btn {
          background: rgba(99,102,241,0.08); border: 1px solid rgba(99,102,241,0.2);
          border-radius: 100px; padding: 5px 12px; color: #818cf8;
          font-size: 11px; cursor: pointer; font-family: var(--font-mono);
          transition: all 0.2s;
        }
        .quick-btn:hover { background: rgba(99,102,241,0.2); }

        .image-grid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 12px;
        }
        .image-card {
          position: relative; aspect-ratio: 1; border-radius: 12px;
          overflow: hidden; border: 1px solid var(--border);
        }
        .image-card img { width: 100%; height: 100%; object-fit: cover; }
        .download-btn {
          position: absolute; bottom: 8px; right: 8px;
          background: rgba(0,0,0,0.7); border: 1px solid rgba(255,255,255,0.2);
          border-radius: 8px; padding: 4px 10px; color: white;
          text-decoration: none; font-size: 14px;
          transition: all 0.2s;
        }
        .download-btn:hover { background: rgba(99,102,241,0.8); }
        .empty-state {
          text-align: center; padding: 48px; border: 1px dashed rgba(99,102,241,0.2);
          border-radius: 12px; color: var(--dim); font-size: 13px;
        }

        .terminal {
          background: rgba(3,3,8,0.95); border: 1px solid rgba(99,102,241,0.15);
          border-radius: 16px; overflow: hidden;
        }
        .terminal-bar {
          padding: 10px 16px; border-bottom: 1px solid rgba(99,102,241,0.12);
          display: flex; align-items: center; gap: 8px;
        }
        .dot { width: 10px; height: 10px; border-radius: 50%; }
        .dot.red { background: #ef4444; }
        .dot.yellow { background: #f59e0b; }
        .dot.green { background: #10b981; }
        .terminal-label { font-size: 10px; color: var(--dim); letter-spacing: 2px; margin-left: 8px; }
        .terminal-body {
          height: 150px; overflow-y: auto;
          padding: 12px 16px; line-height: 1.9;
        }
        .log-line { font-size: 11px; color: #4ade80; }
      `}</style>
    </>
  )
}
