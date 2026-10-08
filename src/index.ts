import type { IncomingMessage, ServerResponse } from 'node:http'
import { handleLeanspecHttp } from './http.ts'

export const name = 'leanspec-web-viewer'

export const inject = ['webServer']

export function apply(ctx: {
  webServer: {
    register: (route: {
      kind: 'exact' | 'prefix'
      path: string
      handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
    }) => () => void
  }
  effect: (fn: () => (() => void) | void) => void
}): void {
  ctx.effect(() => {
    const dispose = ctx.webServer.register({
      kind: 'prefix',
      path: '/leanspec-viewer',
      handler: (req, res) => handleLeanspecRequest(req, res),
    })
    return dispose
  })
}

async function handleLeanspecRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const host = req.headers.host ?? '127.0.0.1'
  const url = new URL(req.url ?? '/', `http://${host}`)
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(Buffer.from(chunk))
  const rawBody = Buffer.concat(chunks).toString('utf8')
  const result = await handleLeanspecHttp({
    method: req.method ?? 'GET',
    pathname: url.pathname,
    searchParams: url.searchParams,
    body: rawBody,
  })
  // Binary first: an image response must not be JSON-encoded, and the bytes go
  // out as they came off disk.
  if (result.binary) {
    res.writeHead(result.status, {
      'content-type': result.binary.contentType,
      'x-content-type-options': 'nosniff',
      ...result.binary.headers,
    })
    res.end(result.binary.bytes)
    return
  }
  // nosniff on the JSON branch too: this origin also serves file content.
  res.writeHead(result.status, {
    'content-type': 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff',
  })
  res.end(JSON.stringify(result.body))
}
