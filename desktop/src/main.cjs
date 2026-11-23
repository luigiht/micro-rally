// Micro Rally desktop shell: a native window around the production game.
// No Node in the page (context isolation + sandbox); saves live in the window's
// own persistent storage under the app's userData folder.
const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('node:path');

const ORIGIN = 'https://micro-rally.luigiht.com';
const START_URL = `${ORIGIN}/game`;

if (!app.requestSingleInstanceLock()) app.quit();

/** Same-origin pages stay in the window; everything else opens in the browser. */
function isInternal(url) {
  try {
    return new URL(url).origin === ORIGIN;
  } catch {
    return false;
  }
}

function offlinePage(reason) {
  const html = `<!doctype html><meta charset="utf-8"><title>Micro Rally</title>
<style>
  html,body{height:100%;margin:0;background:#1f1f22;color:#f4f1ea;font:16px/1.5 system-ui,sans-serif}
  main{height:100%;display:grid;place-items:center;text-align:center}
  button{font:inherit;padding:.6em 1.4em;border:0;border-radius:8px;background:#b9cf82;color:#1f1f22;cursor:pointer}
  button:focus-visible{outline:3px solid #fff;outline-offset:3px}
  p{opacity:.75}
</style>
<main><div><h1>Can't reach Micro Rally</h1><p>Check your internet connection and try again.</p>
<p><small>${reason.replace(/[<>&]/g, '')}</small></p>
<button autofocus onclick="location.href='${START_URL}'">Try again</button></div></main>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 800,
    minHeight: 500,
    title: 'Micro Rally',
    backgroundColor: '#1f1f22',
    autoHideMenuBar: true,
    show: false,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      // Keep the game running at full rate while the window is behind another one.
      backgroundThrottling: false,
    },
  });

  win.once('ready-to-show', () => win.show());

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isInternal(url)) {
      win.loadURL(url);
    } else if (/^https?:|^mailto:/.test(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (isInternal(url) || url.startsWith('data:')) return;
    event.preventDefault();
    if (/^https?:|^mailto:/.test(url)) shell.openExternal(url);
  });

  win.webContents.on('did-fail-load', (_e, code, description, url, isMainFrame) => {
    // -3 is an aborted load (a redirect or a new navigation), not a failure.
    if (!isMainFrame || code === -3 || url.startsWith('data:')) return;
    win.loadURL(offlinePage(`${description} (${code})`));
  });

  // F11 (and Ctrl/Cmd+Shift+F) toggle full screen on every platform.
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const full =
      input.key === 'F11' ||
      (input.key.toLowerCase() === 'f' && input.shift && (input.control || input.meta));
    if (full) {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    }
  });

  win.loadURL(START_URL);
  return win;
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.on('second-instance', () => {
  const [win] = BrowserWindow.getAllWindows();
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
});

app.whenReady().then(() => {
  buildMenu();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
