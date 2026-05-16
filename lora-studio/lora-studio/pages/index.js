import { useState, useRef, useEffect } from 'react'
import Head from 'next/head'
import JSZip from 'jszip'

export default function Home() {
  const [token, setToken] = useState('')
  const [images, setImages] = useState([])
  const [triggerWord, setTriggerWord] = useState('LUCIENE')
  const [training, setTraining] = useState(false)
  const [status, setStatus] = useState(null)
  const [predictionId, setPredictionId] = useState(null)
  const [generatedImage, setGeneratedImage] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [activeTab, setActiveTab] = useState('upload')
  const fileInputRef = useRef(null)

  useEffect(() => {
    const saved = localStorage.getItem('replicate_token')
    if (saved) setToken(saved)
  }, [])

  const saveToken = () => {
    localStorage.setItem('replicate_token', token)
    alert('Token salvo!')
  }

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files)
    const validFiles = files.filter(f => 
      f.type.startsWith('image/') && f.size < 10 * 1024 * 1024
    )
    if (validFiles.length !== files.length) {
      alert('Alguns arquivos ignorados (máx 10MB, apenas imagens)')
    }
    setImages(prev => [...prev, ...validFiles])
  }

  const removeImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index))
  }

  const createZip = async () => {
    const zip = new JSZip()
    for (let i = 0; i < images.length; i++) {
      const arrayBuffer = await images[i].arrayBuffer()
      zip.file(`image_${String(i).padStart(3, '0')}.jpg`, arrayBuffer)
    }
    return await zip.generateAsync({ type: 'blob' })
  }

  const startTraining = async () => {
    if (!token) { alert('Cole seu token do Replicate!'); return }
    if (images.length < 5) { alert('Mínimo 5 imagens!'); return }
    if (!triggerWord.trim()) { alert('Digite trigger word!'); return }

    setTraining(true)
    setStatus({ message: 'Criando ZIP...', progress: 10 })

    try {
      const zipBlob = await createZip()
      setStatus({ message: 'Upload para Replicate...', progress: 30 })

      const uploadForm = new FormData()
      uploadForm.append('content', zipBlob, 'dataset.zip')

      const uploadRes = await fetch('https://dreambooth-api-experimental.replicate.com/v1/upload/data.zip', {
        method: 'POST',
        headers: { 'Authorization': `Token ${token}` },
        body: uploadForm
      })

      if (!uploadRes.ok) throw new Error('Erro no upload')
      const uploadData = await uploadRes.json()

      setStatus({ message: 'Iniciando treino...', progress: 50 })

      const trainRes = await fetch('/api/train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          input_images: uploadData.signedUrl,
          trigger_word: triggerWord,
          training_steps: 1000,
          lora_rank: 16
        })
      })

      if (!trainRes.ok) {
        const err = await trainRes.json()
        throw new Error(err.error || 'Erro ao iniciar treino')
      }

      const trainData = await trainRes.json()
      setPredictionId(trainData.id)
      setStatus({ message: 'Treinando...', progress: 60 })
      pollStatus(trainData.id)

    } catch (err) {
      setStatus({ message: `❌ ${err.message}`, progress: 0 })
      setTraining(false)
    }
  }

  const pollStatus = async (id) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/training-status?id=${id}&token=${token}`)
        const data = await res.json()

        if (data.status === 'succeeded') {
          clearInterval(interval)
          setStatus({ message: '✅ Concluído!', progress: 100 })
          setTraining(false)
          localStorage.setItem('lora_url', data.output)
          setActiveTab('generate')
        } else if (data.status === 'failed') {
          clearInterval(interval)
          setStatus({ message: `❌ ${data.error}`, progress: 0 })
          setTraining(false)
        } else {
          setStatus({ message: `⏳ ${data.status}`, progress: 75 })
        }
      } catch (err) { console.error(err) }
    }, 5000)
  }

  const generateImage = async () => {
    if (!prompt.trim()) { alert('Digite um prompt!'); return }
    setGenerating(true)

    try {
      const res = await fetch('/api/generate-luciene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          prompt,
          lora_url: localStorage.getItem('lora_url'),
          trigger_word: triggerWord
        })
      })

      if (!res.ok) throw new Error('Erro na geração')
      const data = await res.json()
      setGeneratedImage(data.image_url)
    } catch (err) {
      alert(`Erro: ${err.message}`)
    } finally {
      setGenerating(false)
    }
  }

  const tabs = [
    { id: 'token', label: 'Token', icon: '🔑' },
    { id: 'upload', label: 'Fotos', icon: '📸' },
    { id: 'generate', label: 'Gerar', icon: '✨' },
  ]

  return (
    <div className="min-h-screen bg-[#070710] text-white font-sans">
      <Head><title>LoRA Studio</title></Head>

      <main className="max-w-2xl mx-auto p-4 pb-24">
        <header className="text-center py-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-400 to-purple-500 bg-clip-text text-transparent">
            🎨 LoRA Studio
          </h1>
          <p className="text-gray-400 mt-2">Treine e gere imagens personalizadas</p>
        </header>

        {activeTab === 'token' && (
          <section className="bg-[#13131f] rounded-2xl p-6 border border-indigo-500/20">
            <h2 className="text-xl font-semibold mb-4">🔑 Token Replicate</h2>
            <input
              type="password"
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="r8_xxxxxxxxxxxxxxxx"
              className="w-full bg-[#1a1a2e] border border-indigo-500/30 rounded-lg px-4 py-3 mb-3"
            />
            <button onClick={saveToken} className="w-full bg-indigo-600 hover:bg-indigo-700 py-3 rounded-lg font-medium">
              Salvar Token
            </button>
          </section>
        )}

        {activeTab === 'upload' && (
          <section className="bg-[#13131f] rounded-2xl p-6 border border-indigo-500/20">
            <h2 className="text-xl font-semibold mb-4">📸 Dataset</h2>

            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-indigo-500/30 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-500/60 transition"
            >
              <p className="text-lg">📁 Clique para selecionar fotos</p>
              <p className="text-sm text-gray-500 mt-1">Mínimo 5, ideal 15-25 imagens</p>
              <input ref={fileInputRef} type="file" multiple accept="image/*" onChange={handleFileSelect} className="hidden" />
            </div>

            {images.length > 0 && (
              <div className="mt-4">
                <p className="text-sm text-gray-400 mb-2">{images.length} imagens</p>
                <div className="grid grid-cols-5 gap-2">
                  {images.map((img, i) => (
                    <div key={i} className="relative">
                      <img src={URL.createObjectURL(img)} className="w-full h-16 object-cover rounded-lg" alt="" />
                      <button onClick={() => removeImage(i)} className="absolute -top-1 -right-1 bg-red-500 text-white w-5 h-5 rounded-full text-xs">×</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4">
              <label className="text-sm text-gray-400">Trigger Word</label>
              <input
                type="text"
                value={triggerWord}
                onChange={e => setTriggerWord(e.target.value.toUpperCase())}
                className="w-full bg-[#1a1a2e] border border-indigo-500/30 rounded-lg px-4 py-3 mt-1"
              />
            </div>

            <button
              onClick={startTraining}
              disabled={training || images.length < 5}
              className="w-full mt-4 bg-gradient-to-r from-indigo-600 to-purple-600 disabled:opacity-50 py-4 rounded-xl font-bold text-lg"
            >
              {training ? '⏳ Treinando...' : '🚀 Iniciar Treino'}
            </button>

            {status && (
              <div className="mt-4">
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div className="bg-indigo-500 h-2 rounded-full transition-all" style={{width: `${status.progress}%`}} />
                </div>
                <p className="text-sm mt-2">{status.message}</p>
              </div>
            )}
          </section>
        )}

        {activeTab === 'generate' && (
          <section className="bg-[#13131f] rounded-2xl p-6 border border-indigo-500/20">
            <h2 className="text-xl font-semibold mb-4">✨ Gerar Imagem</h2>

            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder={`${triggerWord} sorrindo, close-up, 4k...`}
              rows={3}
              className="w-full bg-[#1a1a2e] border border-indigo-500/30 rounded-lg px-4 py-3 resize-none"
            />

            <button
              onClick={generateImage}
              disabled={generating}
              className="w-full mt-3 bg-gradient-to-r from-purple-600 to-pink-600 disabled:opacity-50 py-3 rounded-xl font-bold"
            >
              {generating ? '⏳ Gerando...' : '✨ Gerar'}
            </button>

            {generatedImage && (
              <div className="mt-4">
                <img src={generatedImage} alt="Gerada" className="w-full rounded-xl" />
                <a href={generatedImage} download className="block text-center mt-2 text-indigo-400 text-sm">
                  📥 Baixar
                </a>
              </div>
            )}
          </section>
        )}
      </main>

      <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-[#13131f] border border-indigo-500/20 rounded-2xl p-2 flex gap-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-xl font-medium transition ${activeTab === tab.id ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
