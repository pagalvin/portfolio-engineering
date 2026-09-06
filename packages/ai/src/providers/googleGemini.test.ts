import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { StreamTextEvent } from '../types.js'
import { createGoogleGeminiAdapter } from './googleGemini.js'

const config = {
  apiKey: 'test-gemini-key',
  model: 'gemini-2.5-flash-lite',
}

async function collectEvents(
  stream: AsyncGenerator<StreamTextEvent>,
): Promise<StreamTextEvent[]> {
  const events: StreamTextEvent[] = []

  for await (const event of stream) {
    events.push(event)
  }

  return events
}

test('streams Gemini generate-content chunks', async () => {
  const originalFetch = globalThis.fetch
  let request: { input: string | URL | Request; init?: RequestInit } | undefined

  globalThis.fetch = async (input, init) => {
    request = { input, init }
    const encoder = new TextEncoder()

    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(
            'data: {"candidates":[{"content":{"parts":[{"text":"Gem"}]}}]}\n\n',
          ))
          controller.enqueue(encoder.encode(
            'data: {"candidates":[{"content":{"parts":[{"text":"ini"}]},"finishReason":"STOP"}]}\n\n',
          ))
          controller.close()
        },
      }),
      { status: 200, headers: { 'content-type': 'text/event-stream' } },
    )
  }

  try {
    const events = await collectEvents(createGoogleGeminiAdapter(config).streamText('Analyze'))

    assert.deepEqual(events, [
      { type: 'chunk', text: 'Gem' },
      { type: 'chunk', text: 'ini' },
      { type: 'done' },
    ])
    assert.equal(
      request?.input,
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:streamGenerateContent?alt=sse',
    )
    assert.equal(request?.init?.headers && new Headers(request.init.headers).get('x-goog-api-key'), 'test-gemini-key')

    const body = JSON.parse(String(request?.init?.body)) as {
      readonly contents?: unknown
      readonly generationConfig?: Record<string, unknown>
    }
    assert.deepEqual(body.contents, [{ parts: [{ text: 'Analyze' }] }])
    assert.deepEqual(body.generationConfig, {
      maxOutputTokens: 1_000,
      temperature: 0,
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('streams Gemini Interactions-style text deltas when encountered', async () => {
  const originalFetch = globalThis.fetch

  globalThis.fetch = async () => {
    const encoder = new TextEncoder()

    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(
            'event: step.delta\ndata: {"event_type":"step.delta","delta":{"type":"text","text":"Interaction"}}\n\n',
          ))
          controller.enqueue(encoder.encode(
            'event: interaction.completed\ndata: {"event_type":"interaction.completed"}\n\n',
          ))
          controller.close()
        },
      }),
      { status: 200, headers: { 'content-type': 'text/event-stream' } },
    )
  }

  try {
    const events = await collectEvents(createGoogleGeminiAdapter(config).streamText('Analyze'))

    assert.deepEqual(events, [
      { type: 'chunk', text: 'Interaction' },
      { type: 'done' },
    ])
  } finally {
    globalThis.fetch = originalFetch
  }
})
