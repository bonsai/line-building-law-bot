import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { Client, middleware } from '@line/bot-sdk'
import { spawn } from 'child_process'
import { EventEmitter } from 'events'

// Environment variables
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || ''
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || ''
const PORT = parseInt(process.env.PORT || '8080')

// Hono app
const app = new Hono()

// LINE Bot Client
const lineClient = new Client({
  channelAccessToken: LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: LINE_CHANNEL_SECRET,
})

// LINE Middleware
const lineMiddlewareWrapper = () => {
  const lineMiddleware = middleware({
    channelSecret: LINE_CHANNEL_SECRET,
  })
  
  return async (ctx: any, next: any) => {
    const body = await ctx.req.text()
    const signature = ctx.req.header('X-Line-Signature') || ''
    
    try {
      await new Promise((resolve, reject) => {
        const mockReq = {
          body,
          headers: { 'x-line-signature': signature }
        }
        const mockRes = {
          setHeader: () => {},
          end: resolve
        }
        lineMiddleware(mockReq as any, mockRes as any, reject)
      })
      ctx.req.rawBody = body
      await next()
    } catch (error) {
      return ctx.text('Invalid signature', 400)
    }
  }
}

// MCP Client for building-standards-act-mcp
class MCPClient extends EventEmitter {
  private session: any = null
  private transport: any = null

  async initialize() {
    // Spawn the MCP server process
    const mcpProcess = spawn('node', [
      'C:/Users/dance/Documents/MEGA/building-standards-act-mcp/dist/index.js'
    ], {
      stdio: ['pipe', 'pipe', 'pipe']
    })

    this.transport = {
      read: async () => {
        return new Promise((resolve) => {
          mcpProcess.stdout.once('data', (data: Buffer) => {
            resolve(JSON.parse(data.toString()))
          })
        })
      },
      send: (message: any) => {
        mcpProcess.stdin.write(JSON.stringify(message) + '\n')
      }
    }

    // Initialize session
    this.transport.send({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'line-building-law-bot',
          version: '1.0.0'
        }
      }
    })

    await this.transport.read() // Wait for initialize response

    this.transport.send({
      jsonrpc: '2.0',
      method: 'notifications/initialized'
    })

    return this
  }

  async callTool(toolName: string, args: Record<string, any>) {
    const requestId = Date.now()
    
    this.transport.send({
      jsonrpc: '2.0',
      id: requestId,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    })

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('MCP tool call timeout'))
      }, 30000)

      const handler = (response: any) => {
        if (response.id === requestId) {
          clearTimeout(timeout)
          if (response.error) {
            reject(new Error(response.error.message))
          } else {
            resolve(response.result)
          }
        }
      }

      this.transport.read().then(handler)
    })
  }
}

// Global MCP client instance
let mcpClient: MCPClient | null = null

// Initialize MCP client on startup
async function initMCP() {
  try {
    mcpClient = new MCPClient()
    await mcpClient.initialize()
    console.log('MCP client initialized successfully')
  } catch (error) {
    console.error('Failed to initialize MCP client:', error)
  }
}

// Parse building law query
function parseBuildingLawQuery(text: string): { lawName?: string; articleNumber?: string } {
  const lawPatterns: Record<string, string[]> = {
    '建築基準法': ['建築基準法', '建基法', '基準法'],
    '建築基準法施行令': ['建築基準法施行令', '建基令', '基準法施行令'],
    '建築基準法施行規則': ['建築基準法施行規則', '建基規則'],
    '都市計画法': ['都市計画法', '都計法'],
    '消防法': ['消防法'],
  }

  let lawName: string | undefined
  let articleNumber: string | undefined

  // Find law name
  for (const [formalName, aliases] of Object.entries(lawPatterns)) {
    for (const alias of aliases) {
      if (text.includes(alias)) {
        lawName = formalName
        break
      }
    }
    if (lawName) break
  }

  // Find article number
  const articleMatch = text.match(/(第？[\d 一二三四五六七八九十]+条 | 附則 | 別表 [\d 一二三四五六七八九十]*)/)
  if (articleMatch) {
    articleNumber = articleMatch[1]
  }

  return { lawName, articleNumber }
}

// Handle building law query using MCP
async function handleBuildingLawQuery(query: string): Promise<string> {
  if (!mcpClient) {
    return 'MCP クライアントが初期化されていません。'
  }

  const { lawName, articleNumber } = parseBuildingLawQuery(query)

  try {
    if (lawName && articleNumber) {
      // Get specific article
      const result: any = await mcpClient.callTool('get_law', {
        law_name: lawName,
        article_number: articleNumber,
        format: 'text'
      })

      if (result?.content?.[0]?.text) {
        return result.content[0].text
      }
    }

    if (lawName && !articleNumber) {
      // Search law
      const result: any = await mcpClient.callTool('search_law', {
        keyword: query
      })

      if (result?.content?.[0]?.text) {
        return result.content[0].text
      }
    }

    // Default: search
    const result: any = await mcpClient.callTool('search_law', {
      keyword: query
    })

    if (result?.content?.[0]?.text) {
      return result.content[0].text
    }

    return '該当する法令が見つかりませんでした。'
  } catch (error) {
    console.error('MCP tool call error:', error)
    return `エラーが発生しました：${error instanceof Error ? error.message : '不明なエラー'}`
  }
}

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ status: 'healthy' })
})

// LINE webhook endpoint
app.post('/callback', lineMiddlewareWrapper(), async (c) => {
  const body = await c.req.text()
  const webhookBody = JSON.parse(body) as { events: any[] }
  
  for (const event of webhookBody.events) {
    if (event.type === 'message' && event.message.type === 'text') {
      const userText = event.message.text

      // Handle commands
      if (userText === 'ヘルプ') {
        await lineClient.replyMessage(event.replyToken, {
          type: 'text',
          text: `建築基準法 LINE Bot へようこそ！

以下の形式で質問できます：

📖 条文取得
「建築基準法第 20 条」
「建基法 6 条」

🔍 検索
「耐火構造について教えて」
「用途変更とは」

📋 全文取得
「建築基準法施行令の全文」

📢 告示取得
「耐火構造の構造方法を定める件」

利用可能な法令：
- 建築基準法（建基法）
- 建築基準法施行令（建基令）
- 都市計画法（都計法）
- 消防法
など 112 法令`
        })
        continue
      }

      if (userText === 'テスト') {
        await lineClient.replyMessage(event.replyToken, {
          type: 'text',
          text: '接続テスト成功！建築基準法 MCP サーバーに接続されています。'
        })
        continue
      }

      // Handle building law queries
      try {
        const replyText = await handleBuildingLawQuery(userText)
        await lineClient.replyMessage(event.replyToken, {
          type: 'text',
          text: replyText
        })
      } catch (error) {
        await lineClient.replyMessage(event.replyToken, {
          type: 'text',
          text: `エラーが発生しました：${error instanceof Error ? error.message : '不明なエラー'}\n\nもう一度お試しください。`
        })
      }
    }
  }

  return c.text('OK')
})

// Start server
async function start() {
  await initMCP()

  console.log(`Starting server on port ${PORT}...`)
  serve({
    fetch: app.fetch,
    port: PORT,
  }, (info) => {
    console.log(`Server listening on http://localhost:${info.port}`)
  })
}

start()
