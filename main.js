const { app, BrowserWindow, ipcMain, screen, globalShortcut, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const screenshot = require('screenshot-desktop');
const sharp = require('sharp');
const LLMService = require('./llm-service');
require('dotenv').config();

class SnapScalpMain {
    constructor() {
        this.mainWindow = null;
        this.overlayWindow = null;
        this.captureArea = null;
        this.isAnalyzing = false;
        this.analysisInterval = null;
        this.llmService = new LLMService();
        this.config = {
            provider: 'openai',
            apiKeys: {
                openai: '',
                claude: '',
                perplexity: ''
            }
        };
        
        this.setupApp();
        this.loadConfiguration();
    }

    setupApp() {
        app.whenReady().then(() => {
            this.createMainWindow();
            this.setupIpcHandlers();
            this.registerShortcuts();
        });

        app.on('window-all-closed', () => {
            if (process.platform !== 'darwin') {
                app.quit();
            }
        });

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                this.createMainWindow();
            }
        });

        app.on('will-quit', () => {
            globalShortcut.unregisterAll();
        });
    }

    createMainWindow() {
        this.mainWindow = new BrowserWindow({
            width: 680,
            height: 520,
            alwaysOnTop: true,
            opacity: 0.98,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, 'preload.js')
            },
            titleBarStyle: 'default',
            resizable: true,
            minimizable: true,
            maximizable: false
        });

        this.mainWindow.loadFile('index.html');

        // Development tools
        if (process.argv.includes('--dev')) {
            this.mainWindow.webContents.openDevTools();
        }
    }

    registerShortcuts() {
        // Zoom shortcuts
        globalShortcut.register('CommandOrControl+=', () => {
            this.mainWindow?.webContents.send('zoom-change', 1);
        });
        globalShortcut.register('CommandOrControl+-', () => {
            this.mainWindow?.webContents.send('zoom-change', -1);
        });
        globalShortcut.register('CommandOrControl+0', () => {
            this.mainWindow?.webContents.send('zoom-reset');
        });
        
        // Quick area selection
        globalShortcut.register('CommandOrControl+Shift+A', () => {
            this.selectArea();
        });
    }

    loadConfiguration() {
        // Try to load from dev.env or local.env files
        const envFiles = ['dev.env', 'local.env'];
        
        for (const envFile of envFiles) {
            const envPath = path.join(__dirname, envFile);
            if (fs.existsSync(envPath)) {
                try {
                    const content = fs.readFileSync(envPath, 'utf8');
                    const lines = content.split('\n');
                    
                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) {
                            continue;
                        }
                        
                        const [key, value] = trimmed.split('=', 2);
                        const keyName = key.trim();
                        const keyValue = value.trim();
                        
                        switch (keyName) {
                            case 'openai_key':
                                this.config.apiKeys.openai = keyValue;
                                break;
                            case 'claudeai_key':
                                this.config.apiKeys.claude = keyValue;
                                break;
                            case 'perplexityai_key':
                                this.config.apiKeys.perplexity = keyValue;
                                break;
                        }
                    }
                } catch (error) {
                    console.error(`Error reading ${envFile}:`, error);
                }
            }
        }
        
        // Fallback to environment variables
        this.config.apiKeys.openai = this.config.apiKeys.openai || process.env.OPENAI_API_KEY || '';
        this.config.apiKeys.claude = this.config.apiKeys.claude || process.env.ANTHROPIC_API_KEY || '';
        this.config.apiKeys.perplexity = this.config.apiKeys.perplexity || process.env.PERPLEXITY_API_KEY || '';
        
        // Initialize LLM service
        try {
            this.llmService.initialize(this.config);
            console.log(`LLM Service initialized with provider: ${this.config.provider}`);
        } catch (error) {
            console.error('Failed to initialize LLM service:', error);
        }
    }

    setupIpcHandlers() {
        ipcMain.handle('get-api-key', () => {
            // Return the current provider's API key for compatibility
            return this.config.apiKeys[this.config.provider] || '';
        });

        ipcMain.handle('get-llm-config', () => {
            return {
                provider: this.config.provider,
                providerInfo: this.llmService.getProviderInfo(),
                hasApiKey: !!this.config.apiKeys[this.config.provider]
            };
        });

        ipcMain.handle('switch-llm-provider', (event, provider) => {
            try {
                this.config.provider = provider.toLowerCase();
                this.llmService.switchProvider(this.config.provider);
                return { success: true, provider: this.config.provider };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });

        ipcMain.handle('select-area', () => {
            return this.selectArea();
        });

        ipcMain.handle('capture-screenshot', () => {
            return this.captureScreenshot();
        });

        ipcMain.handle('analyze-chart', (event, imageBase64) => {
            return this.analyzeChart(imageBase64);
        });

        ipcMain.handle('start-analysis', () => {
            return this.startAnalysis();
        });

        ipcMain.handle('stop-analysis', () => {
            return this.stopAnalysis();
        });

        ipcMain.handle('get-capture-area', () => {
            return this.captureArea;
        });
    }

    async selectArea() {
        return new Promise((resolve) => {
            // Minimize main window to allow access to other windows
            this.mainWindow.minimize();
            
            // Wait a moment for the minimize animation
            setTimeout(() => {
                // Get all displays to cover multi-monitor setups
                const displays = screen.getAllDisplays();
                const primaryDisplay = displays[0];
                
                // Create overlay window that covers the primary display but allows click-through
                this.overlayWindow = new BrowserWindow({
                    width: primaryDisplay.bounds.width,
                    height: primaryDisplay.bounds.height,
                    x: primaryDisplay.bounds.x,
                    y: primaryDisplay.bounds.y,
                    frame: false,
                    transparent: true,
                    alwaysOnTop: true,
                    skipTaskbar: true,
                    resizable: false,
                    movable: false,
                    focusable: true,
                    webPreferences: {
                        nodeIntegration: false,
                        contextIsolation: true,
                        preload: path.join(__dirname, 'preload.js')
                    }
                });

                // Load overlay HTML
                this.overlayWindow.loadFile('overlay.html');
                
                // Focus the overlay window to capture keyboard events
                this.overlayWindow.focus();

                // Handle area selection result
                ipcMain.once('area-selected', (event, area) => {
                    this.captureArea = area;
                    this.overlayWindow?.close();
                    this.overlayWindow = null;
                    this.mainWindow.restore(); // Restore main window
                    this.mainWindow.focus();
                    resolve(area);
                });

                ipcMain.once('area-cancelled', () => {
                    this.overlayWindow?.close();
                    this.overlayWindow = null;
                    this.mainWindow.restore(); // Restore main window
                    this.mainWindow.focus();
                    resolve(null);
                });
            }, 300);
        });
    }

    async captureScreenshot() {
        if (!this.captureArea) {
            throw new Error('No capture area set');
        }

        try {
            const displays = screen.getAllDisplays();
            const primaryDisplay = displays[0];
            
            // Get screenshot of entire screen first
            const img = await screenshot({ format: 'png' });
            
            // Calculate scaling factor
            const scaleFactor = primaryDisplay.scaleFactor || 1;
            
            // Calculate crop area (accounting for scale factor)
            const cropArea = {
                left: Math.round(this.captureArea.x * scaleFactor),
                top: Math.round(this.captureArea.y * scaleFactor),
                width: Math.round(this.captureArea.width * scaleFactor),
                height: Math.round(this.captureArea.height * scaleFactor)
            };

            // Crop the image using Sharp
            const croppedBuffer = await sharp(img)
                .extract(cropArea)
                .png()
                .toBuffer();

            // Convert cropped buffer to base64
            const base64 = croppedBuffer.toString('base64');
            
            return {
                success: true,
                image: base64,
                cropArea: cropArea
            };
        } catch (error) {
            console.error('Screenshot capture error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async analyzeChart(imageBase64) {
        try {
            console.log('[Main] Starting chart analysis...');
            console.log(`[Main] Image base64 length: ${imageBase64 ? imageBase64.length : 0}`);
            
            const result = await this.llmService.analyzeChart(imageBase64);
            
            console.log('[Main] LLM Service returned result:', result);
            console.log('[Main] Result type:', typeof result);
            console.log('[Main] Result length:', result ? result.length : 0);
            
            return result;
        } catch (error) {
            console.error('[Main] Analysis error:', error);
            throw new Error(`Analysis failed: ${error.message}`);
        }
    }

    startAnalysis() {
        if (!this.config.apiKeys[this.config.provider]) {
            throw new Error(`Missing API key for ${this.config.provider}`);
        }
        if (!this.captureArea) {
            throw new Error('No capture area set');
        }

        this.isAnalyzing = true;
        
        // Trigger immediate analysis for debugging
        console.log('[Main] Triggering immediate analysis for debugging...');
        setTimeout(async () => {
            if (!this.isAnalyzing) return;
            
            try {
                console.log('[Main] Immediate analysis starting...');
                this.mainWindow?.webContents.send('status-update', 'Capturing (immediate)');
                
                const screenshot = await this.captureScreenshot();
                console.log('[Main] Immediate screenshot result:', { success: screenshot.success, imageLength: screenshot.image ? screenshot.image.length : 0 });
                
                if (screenshot.success) {
                    this.mainWindow?.webContents.send('status-update', 'Analyzing (immediate)');
                    
                    const analysis = await this.analyzeChart(screenshot.image);
                    console.log('[Main] Immediate analysis complete:', analysis);
                    
                    this.mainWindow?.webContents.send('analysis-result', analysis, screenshot.image);
                    this.mainWindow?.webContents.send('status-update', 'Updated (immediate)');
                    
                    console.log('[Main] Immediate analysis sent to renderer');
                } else {
                    console.log('[Main] Immediate screenshot failed:', screenshot.error);
                    this.mainWindow?.webContents.send('status-update', 'Immediate capture failed');
                }
            } catch (error) {
                console.error('[Main] Immediate analysis error:', error);
                this.mainWindow?.webContents.send('status-update', 'Immediate analysis error');
            }
        }, 2000);
        
        // Start analysis loop - capture every 30 seconds
        this.analysisInterval = setInterval(async () => {
            if (!this.isAnalyzing) return;
            
            try {
                console.log('[Main] Analysis loop iteration starting...');
                this.mainWindow?.webContents.send('status-update', 'Capturing');
                
                const screenshot = await this.captureScreenshot();
                console.log('[Main] Screenshot result:', { success: screenshot.success, imageLength: screenshot.image ? screenshot.image.length : 0 });
                
                if (screenshot.success) {
                    this.mainWindow?.webContents.send('status-update', 'Analyzing');
                    
                    const analysis = await this.analyzeChart(screenshot.image);
                    console.log('[Main] Analysis complete, sending to renderer...');
                    console.log('[Main] Analysis result:', analysis);
                    
                    const now = new Date();
                    const timeString = now.toLocaleTimeString('en-US', { 
                        hour12: false, 
                        hour: '2-digit', 
                        minute: '2-digit', 
                        second: '2-digit' 
                    });
                    this.mainWindow?.webContents.send('analysis-result', analysis, screenshot.image);
                    this.mainWindow?.webContents.send('status-update', `Updated at ${timeString}`);
                    
                    console.log('[Main] Sent analysis-result and status-update to renderer');
                } else {
                    console.log('[Main] Screenshot failed:', screenshot.error);
                    this.mainWindow?.webContents.send('status-update', 'Capture failed');
                }
            } catch (error) {
                console.error('[Main] Analysis loop error:', error);
                this.mainWindow?.webContents.send('status-update', 'Analysis error');
            }
        }, 30000);

        return { success: true };
    }

    stopAnalysis() {
        this.isAnalyzing = false;
        if (this.analysisInterval) {
            clearInterval(this.analysisInterval);
            this.analysisInterval = null;
        }
        return { success: true };
    }
}

// Initialize the app
new SnapScalpMain();
