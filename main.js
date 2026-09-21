const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const url = require('url');
const fs = require('fs');

let mainWindow;

function createWindow() {
  let iconPath = path.join(__dirname, 'public/icon.ico');
  if (!fs.existsSync(iconPath)) {
    iconPath = path.join(__dirname, 'public/icon.png');
  }
  if (!fs.existsSync(iconPath)) {
    iconPath = path.join(__dirname, 'dist/frontend-angular/browser/icon.png');
  }

  mainWindow = new BrowserWindow({
    width: 1500,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    icon: iconPath
  });

  // Prevent opening untrusted windows inside Electron
  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    if (targetUrl.startsWith('http:') || targetUrl.startsWith('https:')) {
      shell.openExternal(targetUrl);
    }
    return { action: 'deny' };
  });

  // Prevent navigating away from the local application
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    try {
      const parsedUrl = new URL(navigationUrl);
      if (parsedUrl.origin !== 'http://localhost:4200' && parsedUrl.protocol !== 'file:') {
        event.preventDefault();
        shell.openExternal(navigationUrl);
      }
    } catch {
      event.preventDefault();
    }
  });

  const args = process.argv.slice(1);
  const serve = args.some(val => val === '--serve');

  if (serve) {
    // Modo de desarrollo: Carga el ng serve
    mainWindow.loadURL('http://localhost:4200');
    mainWindow.webContents.openDevTools();
  } else {
    // Modo producción: Carga los archivos compilados de Angular
    mainWindow.loadURL(
      url.format({
        pathname: path.join(__dirname, 'dist/frontend-angular/browser/index.html'),
        protocol: 'file:',
        slashes: true
      })
    );
  }

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow();
  }
});
