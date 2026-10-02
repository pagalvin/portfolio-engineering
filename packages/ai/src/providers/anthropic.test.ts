import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { StreamTextEvent } from '../types.js'
import { createAnthropicAdapter } from './anthropic.js'

const config = {
  apiKey: 'anthropic-test-key',
  model: 'claude-3-7-sonnet-20250219',
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

function jsonRequestBody(init?: RequestInit): Record<string, unknown> {
  return JSON.parse(String(init?.body)) as Record<string, unknown>
}

test('sends an Anthropic Messages request and extracts text blocks and model', async () => {
  const originalFetch = globalThis.fetch
  let request: { input: string | URL | Request; init?: RequestInit } | undefined

  globalThis.fetch = async (input, init) => {
    request = { input, init }
    return new Response(
      JSON.stringify({
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        model: 'claude-3-7-sonnet-20250219',
        content: [
          { type: 'text', text: 'Hello ' },
          { type: 'thinking', thinking: 'internal' },
          { type: 'text', text: 'from Anthropic.' },
        ],
        stop_reason: 'end_turn',
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
  }

  try {
    const result = await createAnthropicAdapter(config).generateText('  Say hello  ', {
      connectionId: 'connection-1',
      maxOutputTokens: 500,
    })

    assert.equal(result.status, 'success')
    if (result.status === 'success') {
      assert.equal(result.responseText, 'Hello from Anthropic.')
      assert.equal(result.modelUsed, 'claude-3-7-sonnet-20250219')
      assert.equal(result.connectionId, 'connection-1')
    }

    assert.equal(request?.input, 'https://api.anthropic.com/v1/messages')
    const headers = new Headers(request?.init?.headers)
    assert.equal(headers.get('x-api-key'), 'anthropic-test-key')
    assert.equal(headers.get('anthropic-version'), '2023-06-01')
    assert.equal(headers.get('content-type'), 'application/json')
    assert.deepEqual(jsonRequestBody(request?.init), {
      model: 'claude-3-7-sonnet-20250219',
      max_tokens: 64,
      messages: [{ role: 'user', content: 'Say hello' }],
      stream: false,
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('streams Anthropic text deltas and message completion', async () => {
  const originalFetch = globalThis.fetch
  let request: { input: string | URL | Request; init?: RequestInit } | undefined

  globalThis.fetch = async (input, init) => {
    request = { input, init }
    const encoder = new TextEncoder()

    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(
            'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_test","model":"claude-3-7-sonnet-20250219"}}\n\n',
          ))
          controller.enqueue(encoder.encode(
            'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}\n\n',
          ))
          controller.enqueue(encoder.encode(
            'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" from Anthropic."}}\n\n',
          ))
          controller.enqueue(encoder.encode(
            'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}\n\n',
          ))
          controller.enqueue(encoder.encode(
            'event: message_stop\ndata: {"type":"message_stop"}\n\n',
          ))
          controller.close()
        },
      }),
      { status: 200, headers: { 'content-type': 'text/event-stream' } },
    )
  }

  try {
    const events = await collectEvents(createAnthropicAdapter(config).streamText('Analyze', {
      connectionId: 'connection-1',
      maxOutputTokens: 1_500,
    }))

    assert.deepEqual(events, [
      { type: 'chunk', text: 'Hello' },
      { type: 'chunk', text: ' from Anthropic.' },
      { type: 'done' },
    ])
    assert.equal(request?.input, 'https://api.anthropic.com/v1/messages')
    const headers = new Headers(request?.init?.headers)
    assert.equal(headers.get('x-api-key'), 'anthropic-test-key')
    assert.equal(headers.get('anthropic-version'), '2023-06-01')
    assert.deepEqual(jsonRequestBody(request?.init), {
      model: 'claude-3-7-sonnet-20250219',
      max_tokens: 1_000,
      messages: [{ role: 'user', content: 'Analyze' }],
      stream: true,
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('maps representative HTTP failures to safe results without leaking credentials or provider bodies', async () => {
  const originalFetch = globalThis.fetch
  const cases = [
    [401, 'auth'],
    [404, 'not_found'],
    [429, 'rate_limit'],
    [400, 'bad_request'],
    [500, 'provider_error'],
  ] as const
  const prompt = 'secret prompt that must not be returned'
  const providerBody = JSON.stringify({
    type: 'error',
    error: {
      type: 'authentication_error',
      message: 'raw provider details',
      api_key: config.apiKey,
    },
  })

  try {
    for (const [status, failureKind] of cases) {
      globalThis.fetch = async () =>
        new Response(providerBody, {
          status,
          headers: { 'content-type': 'application/json' },
        })

      const result = await createAnthropicAdapter(config).generateText(prompt)

      assert.equal(result.status, 'failure')
      if (result.status === 'failure') {
        assert.equal(result.failureKind, failureKind)
        assert.equal(result.providerStatusCode, status)
      }
      const serialized = JSON.stringify(result)
      assert.equal(serialized.includes(config.apiKey), false)
      assert.equal(serialized.includes(prompt), false)
      assert.equal(serialized.includes('raw provider details'), false)
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
    const result = await createAnthropicAdapter(config).generateText('secret prompt', {
      timeoutMs: 1,
    })

    assert.equal(result.status, 'failure')
    if (result.status === 'failure') {
      assert.equal(result.failureKind, 'timeout')
    }
    assert.equal(JSON.stringify(result).includes(config.apiKey), false)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('maps Anthropic in-stream errors to safe provider-neutral events', async () => {
  const originalFetch = globalThis.fetch
  const providerBody = 'raw stream provider body with anthropic-test-key'

  globalThis.fetch = async () => {
    const encoder = new TextEncoder()

    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(
            `event: error\ndata: {"type":"error","error":{"type":"rate_limit_error","message":"${providerBody}"}}\n\n`,
          ))
          controller.close()
        },
      }),
      { status: 200, headers: { 'content-type': 'text/event-stream' } },
    )
  }

  try {
    const events = await collectEvents(createAnthropicAdapter(config).streamText('secret prompt'))

    assert.deepEqual(events, [{
      type: 'error',
      failureKind: 'rate_limit',
      message: 'Rate limit reached. Please wait before retrying.',
    }])
    const serialized = JSON.stringify(events)
    assert.equal(serialized.includes(config.apiKey), false)
    assert.equal(serialized.includes('secret prompt'), false)
    assert.equal(serialized.includes(providerBody), false)
  } finally {
    globalThis.fetch = originalFetch
  }
})
