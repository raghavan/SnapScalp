const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // API key management
    getApiKey: () => ipcRenderer.invoke('get-api-key'),
    getLlmConfig: () => ipcRenderer.invoke('get-llm-config'),
    switchLlmProvider: (provider) => ipcRenderer.invoke('switch-llm-provider', provider),
    
    // Area selection
    selectArea: () => ipcRenderer.invoke('select-area'),
    getCaptureArea: () => ipcRenderer.invoke('get-capture-area'),
    
    // Screenshot and analysis
    captureScreenshot: () => ipcRenderer.invoke('capture-screenshot'),
    analyzeChart: (imageBase64) => ipcRenderer.invoke('analyze-chart', imageBase64),
    
    // Analysis control
    startAnalysis: () => ipcRenderer.invoke('start-analysis'),
    stopAnalysis: () => ipcRenderer.invoke('stop-analysis'),
    
    // Event listeners
    onStatusUpdate: (callback) => ipcRenderer.on('status-update', callback),
    onAnalysisResult: (callback) => ipcRenderer.on('analysis-result', callback),
    onZoomChange: (callback) => ipcRenderer.on('zoom-change', callback),
    onZoomReset: (callback) => ipcRenderer.on('zoom-reset', callback),
    
    // Area selection overlay events
    areaSelected: (area) => ipcRenderer.send('area-selected', area),
    areaCancelled: () => ipcRenderer.send('area-cancelled'),
    
    // Remove listeners
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});
