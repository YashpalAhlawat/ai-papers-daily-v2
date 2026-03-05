// api/summarize.ts - Vercel serverless function
export const runtime = 'edge'

export async function POST(request) {
  const { title, abstract } = await request.json()
  
  if (!title || !abstract) {
    return Response.json({ error: 'Missing title or abstract' }, { status: 400 })
  }

  const prompt = `You are explaining AI research papers to someone with zero technical background.

Paper Title: "${title}"
Paper Abstract: "${abstract}"

Reply ONLY with valid JSON, no markdown fences:
{"emoji":"<one emoji>","headline":"<punchy sentence, max 12 words>","summary":"<2-3 sentences using everyday analogies>","impact":"<one sentence on real-world use>"}`

  // Try Ollama first (local, free)
  try {
    const ollamaRes = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.2',
        messages: [{ role: 'user', content: prompt }],
        stream: false,
      }),
    })

    if (ollamaRes.ok) {
      const data = await ollamaRes.json()
      const text = data.message?.content || ''
      const clean = text.replace(/```json|```/g, '').trim()
      try {
        return Response.json(JSON.parse(clean))
      } catch {
        return Response.json({ emoji: "📄", headline: title.slice(0, 50), summary: clean.slice(0, 300), impact: "See paper for details" })
      }
    }
  } catch (e) {
    console.log('Ollama not available:', e.message)
  }

  // Fallback: Try Anthropic if API key provided
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (anthropicKey) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 400,
          messages: [{ role: 'user', content: prompt }],
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const text = (data.content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('')
        const clean = text.replace(/```json|```/g, '').trim()
        return Response.json(JSON.parse(clean))
      }
    } catch (e) {
      console.log('Anthropic error:', e.message)
    }
  }

  // Final fallback: HuggingFace free API
  try {
    const hfRes = await fetch(
      'https://api-inference.huggingface.co/models/HuggingFaceH4/zephyr-7b-beta/v1/chat/completions',
      {
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 400,
        }),
      }
    )

    if (hfRes.ok) {
      const data = await hfRes.json()
      const text = data.choices?.[0]?.message?.content || ''
      const clean = text.replace(/```json|```/g, '').trim()
      try {
        return Response.json(JSON.parse(clean))
      } catch {
        return Response.json({ emoji: "📄", headline: title.slice(0, 50), summary: clean.slice(0, 300), impact: "See paper for details" })
      }
    }
  } catch (e) {
    console.log('HF error:', e.message)
  }

  return Response.json({ 
    error: 'All LLM services unavailable. Make sure Ollama is running locally.',
    hint: 'Run: ollama serve'
  }, { status: 503 })
}
