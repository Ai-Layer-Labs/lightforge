/**
 * Electron wrapper for RCRT Tools Runner
 * Packages tools as a desktop application
 */

const { app, BrowserWindow, ipcMain, Menu, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

// Keep a global reference of the window object
let mainWindow;
let toolsProcess;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    icon: path.join(__dirname, 'assets/icon.png'), // Add icon if available
    title: 'RCRT Tools Runner',
    show: false
  });

  // Load the app
  const isDev = process.env.NODE_ENV === 'development';
  
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Start tools runner process
    startToolsRunner();
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
    stopToolsRunner();
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

function startToolsRunner() {
  console.log('Starting RCRT Tools Runner...');
  
  // Set environment for local Electron deployment
  const env = {
    ...process.env,
    DEPLOYMENT_MODE: 'electron',
    RCRT_PROXY_URL: 'http://localhost:3000/api/rcrt',
    TOKEN_ENDPOINT: 'http://localhost:3000/api/auth/token',
    WORKSPACE: 'workspace:tools',
    ENABLE_BUILTIN_TOOLS: 'true',
    ENABLE_LANGCHAIN_TOOLS: 'true',
    ENABLE_TOOL_UI: 'true'
  };

  // Start tools runner as child process
  toolsProcess = spawn('node', [path.join(__dirname, 'tools-runner.js')], {
    env,
    stdio: ['pipe', 'pipe', 'pipe']
  });

  toolsProcess.stdout.on('data', (data) => {
    console.log(`Tools Runner: ${data.toString().trim()}`);
    
    // Send logs to renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('tools-log', data.toString());
    }
  });

  toolsProcess.stderr.on('data', (data) => {
    console.error(`Tools Runner Error: ${data.toString().trim()}`);
    
    // Send error logs to renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('tools-error', data.toString());
    }
  });

  toolsProcess.on('close', (code) => {
    console.log(`Tools Runner exited with code ${code}`);
  });
}

function stopToolsRunner() {
  if (toolsProcess) {
    console.log('Stopping RCRT Tools Runner...');
    toolsProcess.kill('SIGTERM');
    toolsProcess = null;
  }
}

// App event handlers
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  // On macOS, keep app running even when all windows are closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS, re-create window when dock icon is clicked
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  stopToolsRunner();
});

// IPC handlers
ipcMain.handle('get-tools-status', async () => {
  // Return tools status (would integrate with actual registry)
  return {
    running: !!toolsProcess,
    tools: []
  };
});

ipcMain.handle('restart-tools', async () => {
  stopToolsRunner();
  setTimeout(startToolsRunner, 1000);
  return { success: true };
});

// Create application menu
function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Restart Tools',
          click: () => {
            stopToolsRunner();
            setTimeout(startToolsRunner, 1000);
          }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(createMenu);
