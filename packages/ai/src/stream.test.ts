import assert from 'node:assert/strict'
import { test } from 'node:test'
import { invokeStreamingGeneration } from './stream.js'
import type { StreamTextEvent } from './types.js'

async function collectEvents(
  stream: AsyncGenerator<StreamTextEvent>,
): Promise<StreamTextEvent[]> {
  const events: StreamTextEvent[] = []

  for await (const event of stream) {
    events.push(event)
  }

  return events
}

function createSseResponse(frames: string[]): Response {
  const encoder = new TextEncoder()

  return new Response(
    new ReadableStream({
      start(controller) {
        for (const frame of frames) {
          controller.enqueue(encoder.encode(frame))
        }
        controller.close()
      },
    }),
    { status: 200, headers: { 'content-type': 'text/event-stream' } },
  )
}

test('streams chunks from an SSE fetch response and applies output defaults', async () => {
  const originalFetch = globalThis.fetch
  let requestBody: Record<string, unknown> | undefined

  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>

    return createSseResponse([
      'data: {"delta":"Hello "}\n\n',
      'data: {"delta":"world"}\n\n',
      'data: [DONE]\n\n',
    ])
  }

  try {
    const events = await collectEvents(invokeStreamingGeneration({
      providerId: 'mock-provider',
      connectionId: 'connection-1',
      prompt: 'Analyze this.',
      endpoint: 'https://provider.test/stream',
      headers: { Authorization: 'Bearer fake-api-key' },
      requestBody: {
        max_tokens: 10_000,
        stream: true,
      },
      parseStreamData: (data) => ({
        type: 'chunk',
        text: (JSON.parse(data) as { readonly delta: string }).delta,
      }),
    }))

    assert.deepEqual(events, [
      { type: 'chunk', text: 'Hello ' },
      { type: 'chunk', text: 'world' },
      { type: 'done' },
    ])
    assert.equal(requestBody?.max_tokens, 1_000)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('maps non-2xx responses to safe stream errors without provider body or secrets', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => new Response('raw provider body fake-api-key', { status: 401 })

  try {
    const events = await collectEvents(invokeStreamingGeneration({
      providerId: 'mock-provider',
      endpoint: 'https://provider.test/stream',
      prompt: 'Sensitive Journal content',
      headers: { Authorization: 'Bearer fake-api-key' },
      requestBody: {},
      parseStreamData: () => undefined,
    }))

    assert.deepEqual(events, [{
      type: 'error',
      failureKind: 'auth',
      message: 'Authentication failed.',
      providerStatusCode: 401,
    }])
    assert.equal(JSON.stringify(events).includes('fake-api-key'), false)
    assert.equal(JSON.stringify(events).includes('Sensitive Journal content'), false)
    assert.equal(JSON.stringify(events).includes('raw provider body'), false)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('aborts on caller signal and returns a safe timeout error', async () => {
  const originalFetch = globalThis.fetch
  const controller = new AbortController()

  globalThis.fetch = async (_input, init) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        const error = new Error('aborted fake-api-key')
        error.name = 'AbortError'
        reject(error)
      })
      controller.abort()
    })

  try {
    const events = await collectEvents(invokeStreamingGeneration({
      providerId: 'mock-provider',
      endpoint: 'https://provider.test/stream',
      prompt: 'Sensitive Journal content',
      headers: { Authorization: 'Bearer fake-api-key' },
      requestBody: {},
      signal: controller.signal,
      parseStreamData: () => undefined,
    }))

    assert.deepEqual(events, [{
      type: 'error',
      failureKind: 'timeout',
      message: 'The request timed out.',
    }])
    assert.equal(JSON.stringify(events).includes('fake-api-key'), false)
    assert.equal(JSON.stringify(events).includes('Sensitive Journal content'), false)
  } finally {
    globalThis.fetch = originalFetch
  }
})
