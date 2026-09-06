import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { StreamTextEvent } from '../types.js'
import { createAzureOpenAiAdapter } from './azureOpenAi.js'

const config = {
  endpoint: 'https://azure.example.com',
  deployment: 'gpt-4o-mini',
  apiKey: 'test-azure-key',
  apiVersion: '2024-02-15-preview',
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

test('streams Azure OpenAI chat-completion deltas', async () => {
  const originalFetch = globalThis.fetch
  let request: { input: string | URL | Request; init?: RequestInit } | undefined

  globalThis.fetch = async (input, init) => {
    request = { input, init }
    const encoder = new TextEncoder()

    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(
            'data: {"choices":[{"delta":{"content":"Azure"},"finish_reason":null}]}\n\n',
          ))
          controller.enqueue(encoder.encode(
            'data: {"choices":[{"delta":{"content":" stream"},"finish_reason":null}]}\n\n',
          ))
          controller.enqueue(encoder.encode(
            'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
          ))
          controller.close()
        },
      }),
      { status: 200, headers: { 'content-type': 'text/event-stream' } },
    )
  }

  try {
    const events = await collectEvents(createAzureOpenAiAdapter(config).streamText('Analyze'))

    assert.deepEqual(events, [
      { type: 'chunk', text: 'Azure' },
      { type: 'chunk', text: ' stream' },
      { type: 'done' },
    ])
    assert.equal(
      request?.input,
      'https://azure.example.com/openai/deployments/gpt-4o-mini/chat/completions?api-version=2024-02-15-preview',
    )
    assert.equal(request?.init?.headers && new Headers(request.init.headers).get('api-key'), 'test-azure-key')

    const body = JSON.parse(String(request?.init?.body)) as Record<string, unknown>
    assert.deepEqual(body, {
      messages: [{ role: 'user', content: 'Analyze' }],
      max_tokens: 1_000,
      temperature: 0,
      stream: true,
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('streams Azure OpenAI v1-compatible request bodies', async () => {
  const originalFetch = globalThis.fetch
  let request: { input: string | URL | Request; init?: RequestInit } | undefined

  globalThis.fetch = async (input, init) => {
    request = { input, init }
    const encoder = new TextEncoder()

    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(
            'data: {"choices":[{"delta":{"content":"v1"},"finish_reason":null}]}\n\n',
          ))
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        },
      }),
      { status: 200, headers: { 'content-type': 'text/event-stream' } },
    )
  }

  try {
    const events = await collectEvents(createAzureOpenAiAdapter({
      ...config,
      endpoint: 'https://azure.example.com/openai/v1',
      deployment: 'gpt-5-mini',
    }).streamText('Analyze'))

    assert.deepEqual(events, [
      { type: 'chunk', text: 'v1' },
      { type: 'done' },
    ])
    assert.equal(request?.input, 'https://azure.example.com/openai/v1/chat/completions')

    const body = JSON.parse(String(request?.init?.body)) as Record<string, unknown>
    assert.deepEqual(body, {
      model: 'gpt-5-mini',
      messages: [{ role: 'user', content: 'Analyze' }],
      max_completion_tokens: 1_000,
      stream: true,
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})
