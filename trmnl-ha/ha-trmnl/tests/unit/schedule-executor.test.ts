/**
 * Unit tests for Schedule Executor — BYOS URI delivery.
 *
 * Covers the URI sent to BYOS servers in URI delivery mode: it must point
 * at the capture saved by the same run (served at /output/) so the BYOS
 * fetch does not trigger a second full dashboard render (#74).
 *
 * Uses a temp output dir and a globalThis.fetch override (restored in
 * afterAll) to capture the webhook payload without a network.
 *
 * @see lib/scheduler/schedule-executor.ts
 * @module tests/unit/schedule-executor
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  afterAll,
  mock,
  spyOn,
} from 'bun:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { captureLogs } from '../helpers/log-capture.js'
import { ScheduleExecutor } from '../../lib/scheduler/schedule-executor.js'
import * as sleepModule from '../../lib/sleep.js'
import {
  captureFetch,
  mockFetch,
  restoreFetch,
} from '../helpers/fetch-mock.js'
import {
  buildSchedule,
  buildByosSchedule,
} from '../helpers/schedule-fixtures.js'

afterAll(restoreFetch)

/** Executor writing into a fresh temp dir */
function createExecutor(
  screenshotFn: () => Promise<Buffer>,
): ScheduleExecutor {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trmnl-executor-'))
  return new ScheduleExecutor(screenshotFn, outputDir)
}

describe('ScheduleExecutor — BYOS URI delivery', () => {
  let outputDir: string
  let executor: ScheduleExecutor
  let requests: ReturnType<typeof captureFetch>

  beforeEach(() => {
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trmnl-executor-'))
    executor = new ScheduleExecutor(
      async () => Buffer.from('fake-png'),
      outputDir,
    )
    requests = captureFetch()
  })

  it('sends a URI pointing at the saved capture, not a render endpoint', async () => {
    const result = await executor.call(buildByosSchedule())

    // Payloads are JSON strings; anything else would be a test setup bug
    const payload = JSON.parse(requests[0]!.init?.body as string) as {
      screen: { uri: string }
    }
    const savedFilename = path.basename(result.savedPath)

    expect(payload.screen.uri).toBe(
      `http://192.168.1.10:10000/output/${savedFilename}`,
    )
  })

  it('saves the capture the URI points at', async () => {
    const result = await executor.call(buildByosSchedule())

    expect(fs.readFileSync(result.savedPath, 'utf-8')).toBe('fake-png')
  })

  it('falls back to embedded data when delivery_mode is data', async () => {
    const schedule = buildByosSchedule()
    schedule.webhook_format!.byosConfig!.delivery_mode = 'data'

    await executor.call(schedule)

    const payload = JSON.parse(requests[0]!.init?.body as string) as {
      screen: { uri?: string; data?: string }
    }

    expect(payload.screen.uri).toBeUndefined()
    expect(payload.screen.data).toBeDefined()
  })
})

describe('ScheduleExecutor — network retry', () => {
  let sleepSpy: { mockRestore: () => void }

  beforeEach(() => {
    // Skip the real 5s SCHEDULER_RETRY_DELAY_MS between attempts
    sleepSpy = spyOn(sleepModule, 'sleep').mockResolvedValue(undefined)
  })

  afterEach(() => {
    sleepSpy.mockRestore()
  })

  it('retries after a network error and succeeds', async () => {
    let attempts = 0
    const executor = createExecutor(async () => {
      attempts++
      if (attempts === 1) throw new Error('net::ERR_CONNECTION_REFUSED')
      return Buffer.from('fake-png')
    })

    const result = await executor.call(buildSchedule())

    expect(result.success).toBe(true)
    expect(attempts).toBe(2)
  })

  it('throws once retries are exhausted', async () => {
    let attempts = 0
    const executor = createExecutor(async () => {
      attempts++
      throw new Error('net::ERR_CONNECTION_REFUSED')
    })

    await expect(executor.call(buildSchedule())).rejects.toThrow(
      /ERR_CONNECTION_REFUSED/,
    )
    expect(attempts).toBe(3)
  })
})

describe('ScheduleExecutor — webhook failure reporting', () => {
  const webhookSchedule = () =>
    buildSchedule({ webhook_url: 'https://byos.example.com/api/screens' })

  it('reports statusCode and retryAfterMs from a WebhookHttpError', async () => {
    mockFetch({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      headers: new Headers({ 'Retry-After': '60' }),
    })
    const executor = createExecutor(async () => Buffer.from('fake-png'))

    const result = await executor.call(webhookSchedule())

    expect(result.webhook).toMatchObject({
      attempted: true,
      success: false,
      statusCode: 429,
      retryAfterMs: 60000,
    })
  })

  it('scrapes the status from a plain error message', async () => {
    globalThis.fetch = mock(async () => {
      throw new Error('HTTP 503: service unavailable')
    }) as unknown as typeof fetch
    const executor = createExecutor(async () => Buffer.from('fake-png'))

    const result = await executor.call(webhookSchedule())

    expect(result.webhook).toMatchObject({
      attempted: true,
      success: false,
      statusCode: 503,
    })
    expect(result.webhook!.retryAfterMs).toBeUndefined()
  })
})


describe('ScheduleExecutor credential-safe logs', () => {
  for (const status of [200, 503]) {
    it(`keeps the private upload URL out of completion logs for HTTP ${status}`, async () => {
      const logs = await captureLogs()
      const url = 'https://example.invalid/api/custom_plugins/SYNTHETIC-WRITE-CREDENTIAL'
      try {
        mockFetch({ok: status === 200, status, statusText: status === 200 ? 'OK' : 'Unavailable',
          text: async () => `Response from ${url}`})
        const result = await createExecutor(async () => Buffer.from('png')).call(buildSchedule({webhook_url: url}))
        expect(result.webhook?.success).toBe(status === 200)
        expect(logs.contains('Completed:')).toBe(true)
        expect(logs.contains(status === 200 ? '200 OK' : 'FAILED (HTTP 503)')).toBe(true)
        expect(logs.contains('SYNTHETIC-WRITE-CREDENTIAL')).toBe(false)
      } finally { await logs.stop(); restoreFetch() }
    })
  }
  it('redacts a private URL echoed by a transport error', async () => {
    const logs = await captureLogs()
    const url = 'https://example.invalid/api/custom_plugins/SYNTHETIC-ERROR-CREDENTIAL'
    try {
      globalThis.fetch = mock(async () => { throw new Error(`HTTP 503 upload failed: ${url}`) }) as unknown as typeof fetch
      const result = await createExecutor(async () => Buffer.from('png')).call(buildSchedule({webhook_url: url}))
      expect(result.webhook?.success).toBe(false)
      expect(logs.contains('Completed:')).toBe(true)
      expect(logs.contains('SYNTHETIC-ERROR-CREDENTIAL')).toBe(false)
    } finally { await logs.stop(); restoreFetch() }
  })
})
