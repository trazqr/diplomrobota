const { app, BrowserWindow, Menu, shell } = require('electron')
const { spawn } = require('node:child_process')
const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')

const PACKAGED = !process.defaultApp && /[\\/]resources[\\/]app/.test(__dirname)
const RESOURCES = PACKAGED ? path.join(__dirname, '..') : null
const ROOT = path.join(__dirname, '..')

const DIST = PACKAGED ? path.join(RESOURCES, 'frontend') : path.join(ROOT, 'frontend', 'dist')

const BACKEND_DIR =
  process.env.DND_BACKEND_DIR ||
  (PACKAGED ? path.join(RESOURCES, 'backend') : path.join(ROOT, 'backend'))
const BACKEND_PORT = 5107
const BACKEND_ORIGIN = `http://127.0.0.1:${BACKEND_PORT}`

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.json': 'application/json; charset=utf-8',
}

let backend = null
let server = null

function proxyToBackend(req, res) {
  const upstream = http.request(
    {
      host: '127.0.0.1',
      port: BACKEND_PORT,
      method: req.method,
      path: req.url,
      headers: req.headers,
    },
    upRes => {
      res.writeHead(upRes.statusCode, upRes.headers)
      upRes.pipe(res)
    },
  )

  upstream.on('error', () => {
    res.writeHead(502, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: 'backend_unreachable' }))
  })

  req.pipe(upstream)
}

function serveStatic(req, res) {
  const url = new URL(req.url, 'http://localhost')
  let file = path.join(DIST, decodeURIComponent(url.pathname))

  if (!file.startsWith(DIST)) {
    res.writeHead(403).end()
    return
  }

  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    file = path.join(DIST, 'index.html')
  }

  const body = fs.readFileSync(file)
  res.writeHead(200, {
    'content-type': MIME[path.extname(file)] || 'application/octet-stream',
    'cache-control': 'no-store',
  })
  res.end(body)
}

function startServer() {
  return new Promise((resolve, reject) => {
    server = http.createServer((req, res) => {
      if (req.url.startsWith('/api')) proxyToBackend(req, res)
      else serveStatic(req, res)
    })
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => resolve(server.address().port))
  })
}

function startBackend() {
  backend = spawn(
    'dotnet',
    ['run', '--no-launch-profile', '--urls', BACKEND_ORIGIN],
    {
      cwd: BACKEND_DIR,
      env: { ...process.env, ASPNETCORE_ENVIRONMENT: 'Development' },
      stdio: 'ignore',
      shell: process.platform === 'win32',
    },
  )
  backend.on('exit', code => {
    if (code !== 0 && !app.isQuitting) console.error('backend exited with code', code)
  })
}

function waitForBackend(timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs
  return new Promise((resolve, reject) => {
    const probe = () => {
      const req = http.get(BACKEND_ORIGIN + '/api/health', res => {
        res.resume()
        if (res.statusCode === 200) resolve()
        else retry()
      })
      req.on('error', retry)
      req.setTimeout(2000, () => req.destroy())
    }
    const retry = () => {
      if (Date.now() > deadline) reject(new Error('backend did not start in time'))
      else setTimeout(probe, 500)
    }
    probe()
  })
}

async function createWindow() {
  const port = await startServer()
  startBackend()

  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    backgroundColor: '#212021',
    icon: path.join(__dirname, 'icon.png'),
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  try {
    await waitForBackend()
  } catch (error) {
    console.error(error.message)
  }

  await win.loadURL(`http://127.0.0.1:${port}/`)
  win.show()
}

app.setName('Dungeons & Dragons Forum')
app.setAppUserModelId('com.dndforum.desktop')
Menu.setApplicationMenu(null)

app.whenReady().then(createWindow)

app.on('before-quit', () => {
  app.isQuitting = true
  if (backend && !backend.killed) {
    if (process.platform === 'win32') spawn('taskkill', ['/pid', backend.pid, '/f', '/t'])
    else backend.kill('SIGTERM')
  }
  if (server) server.close()
})

app.on('window-all-closed', () => app.quit())
