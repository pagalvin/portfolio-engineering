import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createOpenAiAdapter } from './openai.js'
import type { StreamTextEvent } from '../types.js'

const config = {
  apiKey: 'test-key',
  model: 'gpt-4o-mini',
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

test('sends an official OpenAI chat-completions request and parses the response', async () => {
  const originalFetch = globalThis.fetch
  let request: { input: string | URL | Request; init?: RequestInit } | undefined

  globalThis.fetch = async (input, init) => {
    request = { input, init }
    return new Response(
      JSON.stringify({
        id: 'chatcmpl-test',
        model: 'gpt-4o-mini-2026-01-01',
        choices: [{ message: { content: 'Hello from OpenAI.' } }],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
  }

  try {
    const result = await createOpenAiAdapter(config).generateText('Say hello', {
      connectionId: 'connection-1',
    })

    assert.equal(result.status, 'success')
    if (result.status === 'success') {
      assert.equal(result.responseText, 'Hello from OpenAI.')
      assert.equal(result.modelUsed, 'gpt-4o-mini-2026-01-01')
      assert.equal(result.connectionId, 'connection-1')
    }
    assert.equal(request?.input, 'https://api.openai.com/v1/chat/completions')
    assert.equal(request?.init?.headers && new Headers(request.init.headers).get('authorization'), 'Bearer test-key')
    const body = JSON.parse(String(request?.init?.body)) as Record<string, unknown>
    assert.deepEqual(body, {
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Say hello' }],
      max_tokens: 64,
      temperature: 0,
      stream: false,
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('sanitizes authentication and rate-limit failures', async () => {
  const originalFetch = globalThis.fetch
  const statuses = [401, 429]

  try {
    for (const status of statuses) {
      globalThis.fetch = async () => new Response('provider error', { status })
      const result = await createOpenAiAdapter(config).generateText('Say hello')

      assert.equal(result.status, 'failure')
      if (result.status === 'failure') {
        assert.equal(result.failureKind, status === 401 ? 'auth' : 'rate_limit')
        assert.equal(result.message, status === 401
          ? 'Authentication failed.'
          : 'Rate limit reached. Please wait before retrying.')
        assert.equal(JSON.stringify(result).includes('test-key'), false)
      }
    }
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('maps an aborted request to a timeout without exposing the key', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (_input, init) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        const error = new Error('request aborted')
        error.name = 'AbortError'
        reject(error)
      })
    })

  try {
    const result = await createOpenAiAdapter(config).generateText('Say hello', {
      timeoutMs: 1,
    })

    assert.equal(result.status, 'failure')
    if (result.status === 'failure') {
      assert.equal(result.failureKind, 'timeout')
      assert.equal(JSON.stringify(result).includes('test-key'), false)
    }
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('streams official OpenAI chat-completion deltas', async () => {
  const originalFetch = globalThis.fetch
  let request: { input: string | URL | Request; init?: RequestInit } | undefined

  globalThis.fetch = async (input, init) => {
    request = { input, init }
    const encoder = new TextEncoder()

    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(
            'data: {"choices":[{"delta":{"role":"assistant","content":""},"finish_reason":null}]}\n\n',
          ))
          controller.enqueue(encoder.encode(
            'data: {"choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}\n\n',
          ))
          controller.enqueue(encoder.encode(
            'data: {"choices":[{"delta":{"content":" from OpenAI."},"finish_reason":null}]}\n\n',
          ))
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        },
      }),
      { status: 200, headers: { 'content-type': 'text/event-stream' } },
    )
  }

  try {
    const events = await collectEvents(createOpenAiAdapter(config).streamText('Say hello', {
      connectionId: 'connection-1',
    }))

    assert.deepEqual(events, [
      { type: 'chunk', text: 'Hello' },
      { type: 'chunk', text: ' from OpenAI.' },
      { type: 'done' },
    ])
    assert.equal(request?.input, 'https://api.openai.com/v1/chat/completions')
    assert.equal(request?.init?.headers && new Headers(request.init.headers).get('authorization'), 'Bearer test-key')

    const body = JSON.parse(String(request?.init?.body)) as Record<string, unknown>
    assert.deepEqual(body, {
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Say hello' }],
      max_tokens: 1_000,
      temperature: 0,
      stream: true,
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})
