export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { token, prompt, lora_url, trigger_word } = req.body

  if (!token || !prompt) {
    return res.status(400).json({ error: 'Token e prompt obrigatórios' })
  }

  try {
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: "black-forest-labs/flux-schnell",
        input: {
          prompt: prompt,
          num_inference_steps: 4,
          guidance_scale: 7.5,
          aspect_ratio: "1:1",
          output_format: "png",
          output_quality: 80,
          prompt_upsampling: true,
          lora_scale: 1,
          lora_url: lora_url || undefined
        }
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Erro na API')
    }

    const data = await response.json()

    let result = data
    let attempts = 0
    const maxAttempts = 60

    while (result.status !== 'succeeded' && result.status !== 'failed' && attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 5000))
      const statusRes = await fetch(`https://api.replicate.com/v1/predictions/${data.id}`, {
        headers: { 'Authorization': `Token ${token}` }
      })
      result = await statusRes.json()
      attempts++
    }

    if (result.status === 'succeeded') {
      res.status(200).json({ image_url: result.output[0] || result.output })
    } else {
      throw new Error(result.error || 'Falhou')
    }

  } catch (error) {
    console.error('Generate error:', error)
    res.status(500).json({ error: error.message })
  }
}
