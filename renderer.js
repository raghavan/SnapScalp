class SnapScalpRenderer {
    constructor() {
        this.isRunning = false;
        this.currentZoom = 0;
        this.captureArea = null;
        
        this.initializeElements();
        this.setupEventListeners();
        this.setupIpcListeners();
        this.checkApiKey();
        this.loadLlmConfig();
    }

    initializeElements() {
        // Buttons
        this.btnSetArea = document.getElementById('btn-set-area');
        this.btnStart = document.getElementById('btn-start');
        this.btnStop = document.getElementById('btn-stop');
        
        // Status
        this.statusLabel = document.getElementById('status-label');
        
        // LLM Provider
        this.llmProviderSelect = document.getElementById('llm-provider-select');
        this.providerStatus = document.getElementById('provider-status');
        
        // Decision banner
        this.decisionBanner = document.getElementById('decision-banner');
        this.decisionText = document.getElementById('decision-text');
        this.confidenceValue = document.getElementById('confidence-value');
        this.reasonText = document.getElementById('reason-text');
        
        // Scenarios table
        this.scenariosTbody = document.getElementById('scenarios-tbody');
        
        // Levels
        this.supportBadge = document.getElementById('support-badge');
        this.resistanceBadge = document.getElementById('resistance-badge');
        
        // Preview
        this.previewImage = document.getElementById('preview-image');
        
        // App container for zoom
        this.appContainer = document.querySelector('.app-container');
    }

    setupEventListeners() {
        this.btnSetArea.addEventListener('click', () => this.selectArea());
        this.btnStart.addEventListener('click', () => this.startAnalysis());
        this.btnStop.addEventListener('click', () => this.stopAnalysis());
        this.llmProviderSelect.addEventListener('change', (e) => this.switchLlmProvider(e.target.value));
    }

    setupIpcListeners() {
        // Status updates
        window.electronAPI.onStatusUpdate((event, status) => {
            this.updateStatus(status);
        });

        // Analysis results
        window.electronAPI.onAnalysisResult((event, analysisText, imageBase64) => {
            console.log('[Renderer] Received analysis result');
            console.log('[Renderer] Analysis text:', analysisText);
            console.log('[Renderer] Analysis text type:', typeof analysisText);
            console.log('[Renderer] Image base64 length:', imageBase64 ? imageBase64.length : 0);
            
            this.updateResults(analysisText);
            this.updatePreview(imageBase64);
        });

        // Zoom controls
        window.electronAPI.onZoomChange((event, delta) => {
            this.changeZoom(delta);
        });

        window.electronAPI.onZoomReset(() => {
            this.resetZoom();
        });
    }

    async checkApiKey() {
        try {
            const apiKey = await window.electronAPI.getApiKey();
            if (!apiKey) {
                this.updateStatus('Missing API key in dev.env');
            }
        } catch (error) {
            console.error('Error checking API key:', error);
        }
    }

    async loadLlmConfig() {
        try {
            const config = await window.electronAPI.getLlmConfig();
            
            // Set the current provider in the dropdown
            this.llmProviderSelect.value = config.provider;
            
            // Update provider status
            this.updateProviderStatus(config);
            
        } catch (error) {
            console.error('Error loading LLM config:', error);
            this.updateProviderStatus({ hasApiKey: false });
        }
    }

    updateProviderStatus(config) {
        this.providerStatus.className = 'provider-status';
        
        if (config.hasApiKey) {
            this.providerStatus.classList.add('connected');
            this.providerStatus.title = `Connected to ${config.provider}`;
        } else {
            this.providerStatus.classList.add('error');
            this.providerStatus.title = `Missing API key for ${config.provider}`;
        }
    }

    async switchLlmProvider(provider) {
        try {
            this.updateStatus(`Switching to ${provider}...`);
            
            const result = await window.electronAPI.switchLlmProvider(provider);
            
            if (result.success) {
                this.updateStatus(`Switched to ${provider}`);
                // Reload config to update status
                await this.loadLlmConfig();
            } else {
                this.updateStatus(`Failed to switch: ${result.error}`);
                // Revert selection
                const config = await window.electronAPI.getLlmConfig();
                this.llmProviderSelect.value = config.provider;
            }
        } catch (error) {
            console.error('Error switching LLM provider:', error);
            this.updateStatus('Provider switch failed');
        }
    }

    async selectArea() {
        try {
            this.updateStatus('Minimizing window - drag to select chart area...');
            const area = await window.electronAPI.selectArea();
            
            if (area) {
                this.captureArea = area;
                this.updateStatus(`Area set: ${Math.round(area.width)}x${Math.round(area.height)}`);
            } else {
                this.updateStatus('Area selection cancelled');
            }
        } catch (error) {
            console.error('Area selection error:', error);
            this.updateStatus('Area selection failed');
        }
    }

    async startAnalysis() {
        try {
            const config = await window.electronAPI.getLlmConfig();
            if (!config.hasApiKey) {
                alert(`Missing API key for ${config.provider} in dev.env`);
                return;
            }

            const captureArea = await window.electronAPI.getCaptureArea();
            if (!captureArea) {
                alert('Press Set Area and drag over your chart first');
                return;
            }

            await window.electronAPI.startAnalysis();
            
            this.isRunning = true;
            this.btnStart.disabled = true;
            this.btnStop.disabled = false;
            this.updateStatus('Capturing every 30s');
        } catch (error) {
            console.error('Start analysis error:', error);
            alert(`Failed to start analysis: ${error.message}`);
        }
    }

    async stopAnalysis() {
        try {
            await window.electronAPI.stopAnalysis();
            
            this.isRunning = false;
            this.btnStart.disabled = false;
            this.btnStop.disabled = true;
            this.updateStatus('Stopped');
        } catch (error) {
            console.error('Stop analysis error:', error);
        }
    }

    updateStatus(status) {
        this.statusLabel.textContent = status;
    }

    updateResults(analysisText) {
        try {
            console.log('[Renderer] updateResults called with:', analysisText);
            console.log('[Renderer] Attempting to parse JSON...');
            
            const data = JSON.parse(analysisText);
            console.log('[Renderer] Parsed JSON successfully:', data);
            
            const decision = data.decision || 'WAIT';
            const confidence = parseInt(data.confidence || 0);
            const reason = (data.reason || '').substring(0, 80);
            const scenarios = (data.scenarios || []).slice(0, 2);
            const levels = data.levels || {};

            console.log('[Renderer] Extracted data:', { decision, confidence, reason, scenarios, levels });

            // Update decision banner
            console.log('[Renderer] Updating decision banner...');
            this.decisionText.textContent = decision.toUpperCase();
            this.confidenceValue.textContent = confidence.toString();
            this.reasonText.textContent = reason || '—';
            
            console.log('[Renderer] Decision banner updated:', {
                decision: this.decisionText.textContent,
                confidence: this.confidenceValue.textContent,
                reason: this.reasonText.textContent
            });

            // Flash animation
            this.decisionText.classList.add('decision-flash');
            setTimeout(() => {
                this.decisionText.classList.remove('decision-flash');
            }, 120);

            // Update banner styling
            this.decisionBanner.className = 'decision-banner';
            if (decision.toLowerCase() === 'long') {
                this.decisionBanner.classList.add('long');
            } else if (decision.toLowerCase() === 'short') {
                this.decisionBanner.classList.add('short');
            } else {
                this.decisionBanner.classList.add('wait');
            }

            // Update scenarios table
            console.log('[Renderer] Updating scenarios table...');
            this.updateScenariosTable(scenarios);

            // Update levels
            const support = (levels.support || []).slice(0, 2).join(' ') || '—';
            const resistance = (levels.resistance || []).slice(0, 2).join(' ') || '—';
            
            console.log('[Renderer] Updating levels:', { support, resistance });
            this.supportBadge.textContent = `S ${support}`;
            this.resistanceBadge.textContent = `R ${resistance}`;
            
            console.log('[Renderer] All UI updates completed successfully');

        } catch (error) {
            console.error('[Renderer] Parse results error:', error);
            console.error('[Renderer] Failed to parse analysis text:', analysisText);
            this.updateStatus('Parse error');
        }
    }

    updateScenariosTable(scenarios) {
        // Clear existing rows
        this.scenariosTbody.innerHTML = '';

        scenarios.forEach(scenario => {
            const row = document.createElement('tr');
            
            const side = scenario.side || '';
            const entry = scenario.entry || '';
            const stop = scenario.stop || '';
            const targets = scenario.targets || [];
            
            const t1 = targets[0] || '—';
            const t2 = targets[1] || '—';
            const t3 = targets[2] || '—';

            row.innerHTML = `
                <td>${side}</td>
                <td>${entry}</td>
                <td>${stop}</td>
                <td>${t1}</td>
                <td>${t2}</td>
                <td>${t3}</td>
            `;

            // Add styling based on side
            if (side.toLowerCase() === 'long') {
                row.classList.add('long');
            } else if (side.toLowerCase() === 'short') {
                row.classList.add('short');
            }

            this.scenariosTbody.appendChild(row);
        });
    }

    updatePreview(imageBase64) {
        if (imageBase64) {
            this.previewImage.src = `data:image/png;base64,${imageBase64}`;
            this.previewImage.style.display = 'block';
        }
    }

    changeZoom(delta) {
        this.currentZoom = Math.max(-1, Math.min(4, this.currentZoom + delta));
        this.applyZoom();
    }

    resetZoom() {
        this.currentZoom = 0;
        this.applyZoom();
    }

    applyZoom() {
        // Remove all zoom classes
        this.appContainer.className = 'app-container';
        
        // Add current zoom class
        if (this.currentZoom !== 0) {
            this.appContainer.classList.add(`zoom${this.currentZoom}`);
        }
    }
}

// Initialize the renderer when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new SnapScalpRenderer();
});
