// ================= CONFIG =================
// Text descriptions the free on-device model (CLIP) compares the photo against.
const DRAIN_LABELS = [
    { text: 'a clean storm drain grate with no debris and free water flow', kind: 'clear' },
    { text: 'a clear empty street drain opening', kind: 'clear' },
    { text: 'a clean concrete drain channel with a visible grate', kind: 'clear' },
    { text: 'a clean drain with only a little harmless dust', kind: 'clear' },
    { text: 'a storm drain clogged with dry leaves', kind: 'blocked', items: ['Leaves'] },
    { text: 'a drain blocked with mud and silt', kind: 'blocked', items: ['Mud / silt'] },
    { text: 'a drain blocked by plastic bottles', kind: 'blocked', items: ['Plastic bottles'], heavy: true },
    { text: 'a drain blocked by plastic bags and plastic waste', kind: 'blocked', items: ['Plastic waste'] },
    { text: 'a drain full of garbage and trash', kind: 'blocked', items: ['Mixed garbage'], heavy: true },
    { text: 'a drain blocked by twigs and branches', kind: 'blocked', items: ['Twigs / branches'] },
    { text: 'a drain covered with paper, cardboard and litter', kind: 'blocked', items: ['Paper / litter'] },
    { text: 'a drain blocked by food waste', kind: 'blocked', items: ['Food waste'] }
];

// ==========================================

class DrainageAnalyzerApp {
    constructor() {
        this.currentImageBase64 = null;
        this.currentImageMimeType = null;
        this.history = JSON.parse(localStorage.getItem('hydroscan_history_v2') || '[]');
        this.currentCoords = null;
        this.detailsPromise = null;
        this.idTouched = false;
        this.locTouched = false;
        document.getElementById('drainId').addEventListener('input', () => { this.idTouched = true; });
        document.getElementById('drainLocation').addEventListener('input', () => { this.locTouched = true; this.currentCoords = null; });
        this.initLucide();
        this.loadDelivery();
    }

    initLucide() {
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    handleDragOver(e) {
        e.preventDefault();
        e.currentTarget.classList.add('border-emerald-500', 'bg-emerald-500/5');
    }

    handleDragLeave(e) {
        e.preventDefault();
        e.currentTarget.classList.remove('border-emerald-500', 'bg-emerald-500/5');
    }

    handleDrop(e) {
        e.preventDefault();
        e.currentTarget.classList.remove('border-emerald-500', 'bg-emerald-500/5');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.processFile(files[0]);
        }
    }

    handleFileSelect(e) {
        const files = e.target.files;
        if (files.length > 0) {
            this.processFile(files[0]);
        }
    }

    processFile(file) {
        if (!file.type.startsWith('image/')) {
            this.showNotification('Please upload a valid image file.', 'error');
            return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
            this.setImageData(event.target.result, file.type);
        };
        reader.readAsDataURL(file);
    }

    setImageData(dataUrl, mimeType) {
        this.currentImageBase64 = dataUrl.split(',')[1];
        this.currentImageMimeType = mimeType || 'image/jpeg';

        const preview = document.getElementById('imagePreview');
        preview.src = dataUrl;
        document.getElementById('previewContainer').classList.remove('hidden');
        document.getElementById('uploadPrompt').classList.add('hidden');

        const analyzeBtn = document.getElementById('analyzeBtn');
        analyzeBtn.disabled = false;
        analyzeBtn.className = "w-full mt-5 py-3 px-4 rounded-xl font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 transition flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/20 cursor-pointer";

        // New image -> new Drain ID + location (not the same for every scan)
        this.detailsPromise = this.autoFillDrainDetails(dataUrl).catch(e => console.error('Auto-fill error:', e));
    }

    clearImage() {
        this.currentImageBase64 = null;
        this.currentImageMimeType = null;
        document.getElementById('fileInput').value = '';
        document.getElementById('previewContainer').classList.add('hidden');
        document.getElementById('uploadPrompt').classList.remove('hidden');

        const analyzeBtn = document.getElementById('analyzeBtn');
        analyzeBtn.disabled = true;
        analyzeBtn.className = "w-full mt-5 py-3 px-4 rounded-xl font-semibold text-white bg-slate-800 text-slate-500 cursor-not-allowed transition flex items-center justify-center space-x-2 shadow-lg";

        this.showState('empty');
    }

    loadPreset(type) {
        let svgContent = '';
        if (type === 'clear') {
            svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect width="600" height="400" fill="#0f172a"/><rect x="150" y="100" width="300" height="200" fill="#1e293b" rx="10"/><path d="M180 200h240" stroke="#34d399" stroke-width="10" stroke-dasharray="16 16"/><text x="300" y="350" fill="#34d399" font-size="18" font-family="sans-serif" text-anchor="middle">Sample: Clear Drainage Grate Visible</text></svg>`;
        } else if (type === 'leaves') {
            svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect width="600" height="400" fill="#1e293b"/><rect x="150" y="100" width="300" height="200" fill="#0f172a" rx="10"/><path d="M220 180c20-20 60-10 80 10s30 60 10 80-60 10-80-10-30-60-10-80z" fill="#f59e0b" opacity="0.9"/><circle cx="350" cy="220" r="15" fill="#a16207"/><text x="300" y="350" fill="#facc15" font-size="18" font-family="sans-serif" text-anchor="middle">Sample: Leaves & Mud Accumulation</text></svg>`;
        } else {
            svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect width="600" height="400" fill="#1e293b"/><rect x="150" y="100" width="300" height="200" fill="#334155" rx="10"/><path d="M200 150l50 50-50 50h200l-50-50 50-50z" fill="#ef4444" opacity="0.8"/><circle cx="380" cy="180" r="22" fill="#3b82f6"/><text x="300" y="350" fill="#f87171" font-size="18" font-family="sans-serif" text-anchor="middle">Sample: Plastic Waste & Bottles Blockage</text></svg>`;
        }
        const blob = new Blob([svgContent], { type: 'image/svg+xml' });
        const reader = new FileReader();
        reader.onload = (e) => {
            this.setImageData(e.target.result, 'image/svg+xml');
        };
        reader.readAsDataURL(blob);
    }

    showState(state) {
        document.getElementById('loadingState').classList.toggle('hidden', state !== 'loading');
        document.getElementById('emptyState').classList.toggle('hidden', state !== 'empty');
        document.getElementById('resultState').classList.toggle('hidden', state !== 'result');
    }

    async analyzeImage() {
        if (!this.currentImageBase64) return;

        this.showState('loading');

        const errBox = document.getElementById('analysisError');
        errBox.classList.add('hidden');

        let data = null;
        let lastError = '';
        try {
            // Free, on-device analysis: no API key, no server. The image never leaves this browser.
            const imageUrl = await this.prepareImageForModel();
            const classifier = await this.getClassifier();
            const output = await classifier(imageUrl, DRAIN_LABELS.map(l => l.text));
            data = this.buildResultFromScores(output);
        } catch (err) {
            console.error('Analysis error:', err);
            lastError = (err && err.message) ? err.message : String(err);
        }
        this.resetLoadingText();

        // IMPORTANT: if analysis fails we do NOT pretend the drain is clear.
        if (!data) {
            this.showState('empty');
            errBox.textContent = 'Analysis failed: ' + lastError + '  (The free on-device model is downloaded once from the internet - check your connection and try again.)';
            errBox.classList.remove('hidden');
            this.showNotification('Analysis failed - Drain NOT marked as clear.', 'error');
            return;
        }

        this.renderResult(data);
        this.saveToHistory(data, document.getElementById('imagePreview').src);

        // ===== AUTOMATIC ALERT: fires immediately when status == blocked =====
        this.sendAlert(data);
    }

    // ---------- Free on-device AI (CLIP via Transformers.js, no API key) ----------
    async getClassifier() {
        if (!this.classifierPromise) {
            this.classifierPromise = (async () => {
                const { pipeline, env } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.5.4');
                env.allowLocalModels = false;
                return await pipeline('zero-shot-image-classification', 'Xenova/clip-vit-base-patch32', {
                    progress_callback: (p) => {
                        if (p && p.status === 'progress' && typeof p.progress === 'number') {
                            this.setLoadingText('Downloading free on-device AI model (first time only)... ' + Math.round(p.progress) + '%');
                        }
                    }
                });
            })();
            this.classifierPromise.catch(() => { this.classifierPromise = null; });
        }
        this.setLoadingText('Loading free on-device AI model...');
        const classifier = await this.classifierPromise;
        this.resetLoadingText();
        return classifier;
    }

    // Re-draw the photo on a canvas (max 512px) so every format, including the SVG samples, works.
    async prepareImageForModel() {
        const src = document.getElementById('imagePreview').src;
        const img = await new Promise((resolve, reject) => {
            const im = new Image();
            im.onload = () => resolve(im);
            im.onerror = () => reject(new Error('could not read this image format'));
            im.src = src;
        });
        const w0 = img.naturalWidth || 600, h0 = img.naturalHeight || 400;
        const scale = Math.min(1, 512 / Math.max(w0, h0));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(w0 * scale));
        canvas.height = Math.max(1, Math.round(h0 * scale));
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', 0.92);
    }

    setLoadingText(text) {
        const el = document.querySelector('#loadingState h3');
        if (el) el.textContent = text;
    }

    resetLoadingText() {
        const el = document.querySelector('#loadingState h3');
        if (el) el.textContent = 'Analyzing water-entry area & debris...';
    }

    // Turn the model's scores into the same result structure the rest of the app already uses.
    buildResultFromScores(output) {
        const scored = output.map(o => ({ ...DRAIN_LABELS.find(l => l.text === o.label), score: o.score }));
        const blockedProb = scored.filter(l => l.kind === 'blocked').reduce((a, l) => a + l.score, 0);
        const pct = v => Math.round(v * 100);

        if (blockedProb < 0.5) {
            return {
                statusTitle: 'Clear Drainage',
                status: 'clear',
                severity: 'None',
                detectedCategories: ['Clear Drainage'],
                urgency: 'No action needed',
                recommendedAction: 'No clean-up required. Continue routine inspections.',
                detailedSummary: `The on-device AI found the water-entry area and grate to be clear, with little or no debris blocking water flow (clear-drain confidence ${pct(1 - blockedProb)}%).`
            };
        }

        const blocked = scored.filter(l => l.kind === 'blocked').sort((a, b) => b.score - a.score);
        const top = blocked[0];
        const keep = blocked.filter(l => l.score >= Math.max(0.1, top.score * 0.35)).slice(0, 3);
        const items = [...new Set(keep.flatMap(l => l.items || []))];

        let severity = 'Low';
        if (blockedProb >= 0.85 && (top.heavy || keep.length >= 3)) severity = 'High/Severe Sump Blockage';
        else if (blockedProb >= 0.7) severity = 'Moderate';

        const urgency = severity === 'Low' ? 'Routine maintenance recommended' : 'Immediate action required';
        const action = severity === 'High/Severe Sump Blockage'
            ? 'Dispatch maintenance team immediately to remove the waste and flush the sump.'
            : severity === 'Moderate'
                ? 'Clear the debris from the grate and water-entry area as soon as possible.'
                : 'Schedule removal of the surface debris at the next routine round.';

        return {
            statusTitle: 'Blocked Drainage',
            status: 'blocked',
            severity: severity,
            detectedCategories: items.length ? items : ['Debris'],
            urgency: urgency,
            recommendedAction: action,
            detailedSummary: `The on-device AI found signs of blockage or waste accumulation in the drain (blockage confidence ${pct(blockedProb)}%). Most likely debris: ${(items.length ? items : ['mixed debris']).join(', ').toLowerCase()}. This is an automatic visual estimate - confirm on site before dispatching if the photo is unclear.`
        };
    }

    // ---------- Automatic Drain ID + location for every new image ----------
    async autoFillDrainDetails(dataUrl) {
        const idEl = document.getElementById('drainId');
        const locEl = document.getElementById('drainLocation');
        const srcEl = document.getElementById('locationSource');
        this.idTouched = false;
        this.locTouched = false;
        this.currentCoords = null;

        // Drain ID: unique per image (same image -> same ID)
        const b64 = dataUrl.split(',')[1] || '';
        let h = 2166136261;
        for (let i = 0; i < b64.length; i += 53) { h ^= b64.charCodeAt(i); h = Math.imul(h, 16777619); }
        h ^= b64.length; h = Math.imul(h, 16777619);
        idEl.value = 'D-' + String((h >>> 0) % 9000 + 1000);

        locEl.value = 'Detecting location...';
        srcEl.textContent = 'Looking for the location of this image...';

        // 1) GPS stored inside the photo, 2) this device's location, 3) unknown
        let coords = null, source = '';
        try { coords = this.readExifGps(this.base64ToBytes(b64)); } catch (e) {}
        if (coords) {
            source = 'photo GPS';
        } else {
            coords = await this.getDeviceLocation();
            if (coords) source = 'this device\'s location (the photo has no GPS data)';
        }

        if (!coords) {
            if (!this.locTouched) locEl.value = 'Location not available';
            srcEl.textContent = 'No GPS data in the photo and device location is blocked - type the location manually.';
            return;
        }
        this.currentCoords = coords;
        const coordText = coords.lat.toFixed(5) + ', ' + coords.lon.toFixed(5);
        if (!this.locTouched) locEl.value = coordText;
        srcEl.textContent = 'Location taken from ' + source + '.';

        const place = await this.reverseGeocode(coords.lat, coords.lon);
        if (place && !this.locTouched) locEl.value = place + ' (' + coordText + ')';
    }

    base64ToBytes(b64) {
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return bytes;
    }

    // Reads GPS latitude/longitude from a JPEG's EXIF data (phone photos usually have it).
    readExifGps(b) {
        try {
            if (b[0] !== 0xFF || b[1] !== 0xD8) return null;
            let off = 2;
            while (off + 4 < b.length && b[off] === 0xFF) {
                const marker = b[off + 1];
                const len = (b[off + 2] << 8) | b[off + 3];
                if (marker === 0xE1 && b[off + 4] === 0x45 && b[off + 5] === 0x78 && b[off + 6] === 0x69 && b[off + 7] === 0x66) {
                    return this.readTiffGps(b, off + 10);
                }
                if (marker === 0xDA) break;
                off += 2 + len;
            }
        } catch (e) {}
        return null;
    }

    readTiffGps(b, t) {
        const le = b[t] === 0x49;
        const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
        const u16 = o => dv.getUint16(t + o, le);
        const u32 = o => dv.getUint32(t + o, le);
        const readIfd = o => {
            const n = u16(o), tags = {};
            for (let i = 0; i < n; i++) { const e = o + 2 + i * 12; tags[u16(e)] = e + 8; }
            return tags;
        };
        const ifd0 = readIfd(u32(4));
        if (!ifd0[0x8825]) return null;
        const gps = readIfd(u32(ifd0[0x8825]));
        if (!gps[2] || !gps[4]) return null;
        const dms = v => {
            const o = u32(v);
            const r = i => u32(o + i * 8) / (u32(o + i * 8 + 4) || 1);
            return r(0) + r(1) / 60 + r(2) / 3600;
        };
        let lat = dms(gps[2]), lon = dms(gps[4]);
        if (gps[1] && String.fromCharCode(b[t + gps[1]]) === 'S') lat = -lat;
        if (gps[3] && String.fromCharCode(b[t + gps[3]]) === 'W') lon = -lon;
        if (!isFinite(lat) || !isFinite(lon) || (lat === 0 && lon === 0) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
        return { lat, lon };
    }

    getDeviceLocation() {
        return new Promise(resolve => {
            if (!navigator.geolocation) return resolve(null);
            navigator.geolocation.getCurrentPosition(
                pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
                () => resolve(null),
                { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
            );
        });
    }

    // Free place-name lookup (OpenStreetMap Nominatim, no key). Falls back to coordinates only.
    async reverseGeocode(lat, lon) {
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=17&lat=${lat}&lon=${lon}`);
            if (!res.ok) return '';
            const j = await res.json();
            const a = j.address || {};
            const parts = [a.road || a.pedestrian || a.neighbourhood, a.suburb || a.neighbourhood || a.city_district, a.city || a.town || a.village || a.county]
                .filter(Boolean);
            const uniq = [...new Set(parts)];
            if (uniq.length) return uniq.join(', ');
            return (j.display_name || '').split(',').slice(0, 3).join(',').trim();
        } catch (e) {
            return '';
        }
    }

    testAlert(kind) {
        const data = {
            statusTitle: "Blocked Drainage",
            status: "blocked",
            severity: kind === 'severe' ? "High/Severe Sump Blockage" : "Moderate",
            detectedCategories: ["Plastic bottles", "Mud", "Leaves"],
            urgency: "Immediate action required",
            recommendedAction: "Dispatch maintenance team immediately",
            detailedSummary: "Test scenario: the drain grate is covered by plastic bottles, mud and leaves, restricting water flow."
        };
        this.renderResult(data);
        this.sendAlert(data);
    }

    // ---------- Alert through ntfy ----------
    async sendAlert(data) {
        if (this.detailsPromise) await this.detailsPromise;   // wait for Drain ID / location auto-fill
        const isBlocked = data.status === 'blocked' || !(data.statusTitle || '').toLowerCase().includes('clear');
        if (!isBlocked) {
            this.showAlertStatus('clear', 'No alert needed', 'Drainage is clear.');
            return;
        }

        const drainId = document.getElementById('drainId').value.trim() || 'D-001';
        const location = document.getElementById('drainLocation').value.trim() || 'Unknown location';
        const mapQuery = this.currentCoords ? `${this.currentCoords.lat},${this.currentCoords.lon}` : location;
        const sev = (data.severity || '').toLowerCase();
        const isSevere = sev.includes('high') || sev.includes('severe');
        const level = isSevere ? 'CRITICAL' : 'WARNING';
        const when = new Date();

        const text =
`[${level}] Drain blockage detected
Drain: ${drainId}
Location: ${location}
Severity: ${data.severity}
Debris: ${(data.detectedCategories || []).join(', ') || 'n/a'}
Action: ${data.recommendedAction || 'Dispatch maintenance team'}
Map: https://maps.google.com/?q=${encodeURIComponent(mapQuery)}
Time: ${when.toLocaleDateString()} ${when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

        const cfg = this.getDelivery();
        if (!cfg.ntfyTopic) {
            this.showAlertStatus('skipped', 'Alert not sent', 'Enter an alert channel name (ntfy topic) in the "Send Alerts to Friend\'s Device" box.');
            return;
        }

        this.showAlertStatus('sending', 'Sending alert...', 'Pushing to friend\'s device.');

        const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(mapQuery)}`;
        const title = `[${level}] Drain blockage - ${drainId}`;

        // Send through ntfy (a short pause keeps the "Sending..." status visible)
        let outcome;
        try {
            await Promise.all([
                this.sendNtfy(cfg.ntfyTopic, title, text, mapsUrl, isSevere),
                new Promise(r => setTimeout(r, 900))
            ]);
            outcome = 'Phone push (ntfy): delivered to channel "' + cfg.ntfyTopic + '"';
        } catch (e) {
            console.error('ntfy error:', e);
            outcome = 'Phone push (ntfy): FAILED (' + ((e && e.message) ? e.message : 'check internet') + ')';
        }
        this.beep();

        const anyFail = outcome.includes('FAILED');
        this.showAlertStatus(
            anyFail ? 'failed' : 'sent',
            anyFail ? 'Alert could not be sent' : (isSevere ? 'Critical alert sent via ntfy' : 'Alert sent via ntfy'),
            outcome
        );

        this.showNotification(anyFail ? 'Alert delivery failed' : 'Alert delivered', anyFail ? 'error' : 'info');
        document.getElementById('alertStatus').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // ---------- Delivery settings ----------
    loadDelivery() {
        let cfg = {};
        try { cfg = JSON.parse(localStorage.getItem('hydroscan_delivery_v1') || '{}'); } catch (e) {}
        if (!cfg.ntfyTopic) {
            // unique, hard-to-guess channel name generated once per browser
            cfg.ntfyTopic = 'hydroscan-' + Math.random().toString(36).slice(2, 10);
            try { localStorage.setItem('hydroscan_delivery_v1', JSON.stringify(cfg)); } catch (e) {}
        }
        document.getElementById('ntfyTopic').value = cfg.ntfyTopic || '';
        this.updateNtfyLink();
    }

    updateNtfyLink() {
        const link = document.getElementById('ntfyLink');
        const topic = document.getElementById('ntfyTopic').value.trim().replace(/[^A-Za-z0-9_-]/g, '');
        if (!link) return;
        link.href = 'https://ntfy.sh/' + topic;
        link.textContent = 'ntfy.sh/' + topic;
    }

    getDelivery() {
        return {
            ntfyTopic: document.getElementById('ntfyTopic').value.trim().replace(/[^A-Za-z0-9_-]/g, '')
        };
    }

    saveDelivery() {
        this.updateNtfyLink();
        try { localStorage.setItem('hydroscan_delivery_v1', JSON.stringify(this.getDelivery())); } catch (e) {}
    }

    // ---------- Real push notification via ntfy.sh (free, no account / API key) ----------
    async sendNtfy(topic, title, message, clickUrl, urgent) {
        // Plain POST to https://ntfy.sh/<topic>; title/priority/tags/click go in the URL so the
        // browser sends a "simple" request (no preflight) that ntfy accepts from any page.
        const params = new URLSearchParams({
            title: title,
            priority: urgent ? '5' : '4',
            tags: urgent ? 'rotating_light' : 'warning',
            click: clickUrl
        });
        const res = await fetch('https://ntfy.sh/' + encodeURIComponent(topic) + '?' + params.toString(), {
            method: 'POST',
            body: message
        });
        if (!res.ok) {
            let detail = '';
            try { detail = (await res.text()).slice(0, 150); } catch (e) {}
            throw new Error('ntfy HTTP ' + res.status + ' ' + detail);
        }
    }

    beep() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            [0, 0.18].forEach(t => {
                const o = ctx.createOscillator();
                const g = ctx.createGain();
                o.frequency.value = 880;
                g.gain.value = 0.08;
                o.connect(g); g.connect(ctx.destination);
                o.start(ctx.currentTime + t);
                o.stop(ctx.currentTime + t + 0.12);
            });
        } catch (e) {}
    }

    showAlertStatus(kind, title, detail) {
        const box = document.getElementById('alertStatus');
        const styles = {
            clear:   ['bg-slate-900/80 border-slate-700 text-slate-300', 'check', 'text-emerald-400'],
            sending: ['bg-amber-950/40 border-amber-500/30 text-amber-100', 'loader', 'text-amber-400'],
            sent:    ['bg-emerald-950/40 border-emerald-500/30 text-emerald-100', 'send', 'text-emerald-400'],
            skipped: ['bg-slate-900/80 border-slate-700 text-slate-300', 'info', 'text-slate-400'],
            failed:  ['bg-red-950/40 border-red-500/30 text-red-100', 'alert-circle', 'text-red-400']
        };
        const [cls, icon, iconColor] = styles[kind];
        box.className = `p-4 rounded-2xl border shadow-xl flex items-start space-x-3 text-sm ${cls}`;
        document.getElementById('alertStatusIcon').innerHTML = `<i data-lucide="${icon}" class="w-5 h-5 ${iconColor}"></i>`;
        document.getElementById('alertStatusTitle').textContent = title;
        document.getElementById('alertStatusDetail').textContent = detail || '';
        this.initLucide();
    }

    renderResult(data) {
        this.showState('result');
        document.getElementById('alertStatus').className = 'hidden';

        const banner = document.getElementById('statusBanner');
        const iconContainer = document.getElementById('statusIconContainer');
        const statusTitle = document.getElementById('statusTitle');
        const severityBadge = document.getElementById('severityBadge');

        statusTitle.textContent = data.statusTitle;
        severityBadge.textContent = `${data.severity} Severity`;

        const isClear = data.status === 'clear' || data.statusTitle.toLowerCase().includes('clear');

        if (isClear) {
            banner.className = "p-6 rounded-2xl border shadow-xl flex items-center justify-between bg-emerald-950/40 border-emerald-500/30 text-emerald-100";
            iconContainer.className = "w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
            iconContainer.innerHTML = `<i data-lucide="check-circle-2" class="w-8 h-8"></i>`;
            severityBadge.className = "px-4 py-2 rounded-xl text-xs font-bold tracking-wider uppercase border bg-emerald-500/20 border-emerald-500/40 text-emerald-300";
        } else {
            banner.className = "p-6 rounded-2xl border shadow-xl flex items-center justify-between bg-red-950/40 border-red-500/30 text-red-100";
            iconContainer.className = "w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg bg-red-500/20 text-red-400 border border-red-500/30";
            iconContainer.innerHTML = `<i data-lucide="alert-triangle" class="w-8 h-8"></i>`;
            severityBadge.className = "px-4 py-2 rounded-xl text-xs font-bold tracking-wider uppercase border bg-red-500/20 border-red-500/40 text-red-300";
        }

        // Categories list
        const categoriesList = document.getElementById('detectedCategoriesList');
        categoriesList.innerHTML = '';
        (data.detectedCategories || []).forEach(cat => {
            const tag = document.createElement('span');
            tag.className = "px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 border border-slate-700 text-slate-200 flex items-center space-x-1.5";
            tag.innerHTML = `<i data-lucide="tag" class="w-3.5 h-3.5 text-emerald-400"></i>`;
            const label = document.createElement('span');
            label.textContent = cat;
            tag.appendChild(label);
            categoriesList.appendChild(tag);
        });

        document.getElementById('urgencyText').textContent = data.urgency || 'N/A';
        document.getElementById('actionText').textContent = data.recommendedAction || 'N/A';
        document.getElementById('detailedSummary').textContent = data.detailedSummary || 'N/A';

        this.initLucide();
    }

    saveToHistory(data, imgSrc) {
        const record = {
            id: Date.now(),
            date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            data: data,
            imgSrc: imgSrc
        };
        this.history.unshift(record);
        if (this.history.length > 20) this.history.pop();
        try {
            localStorage.setItem('hydroscan_history_v2', JSON.stringify(this.history));
        } catch (e) {
            // storage full (large images) - drop oldest entries
            this.history = this.history.slice(0, 5);
            try { localStorage.setItem('hydroscan_history_v2', JSON.stringify(this.history)); } catch (e2) {}
        }
    }

    openHistoryModal() {
        const container = document.getElementById('historyListContainer');
        container.innerHTML = '';

        if (this.history.length === 0) {
            container.innerHTML = `<div class="text-center py-12 text-slate-500 text-sm">No analysis history found.</div>`;
        } else {
            this.history.forEach(item => {
                const isClear = item.data.status === 'clear' || item.data.statusTitle.toLowerCase().includes('clear');
                const card = document.createElement('div');
                card.className = "bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between space-x-4";
                card.innerHTML = `
                    <div class="flex items-center space-x-3">
                        <img src="${item.imgSrc}" class="w-12 h-12 object-cover rounded-lg border border-slate-700 flex-shrink-0">
                        <div>
                            <h4 class="font-semibold text-sm text-slate-200">${item.data.statusTitle}</h4>
                            <p class="text-xs text-slate-500">${item.date}</p>
                        </div>
                    </div>
                    <span class="px-2.5 py-1 rounded-full text-xs font-medium border ${isClear ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}">
                        ${item.data.severity || 'Status'}
                    </span>
                `;
                container.appendChild(card);
            });
        }

        document.getElementById('historyCount').textContent = `${this.history.length} scans recorded`;
        document.getElementById('historyModal').classList.remove('hidden');
        this.initLucide();
    }

    closeHistoryModal() {
        document.getElementById('historyModal').classList.add('hidden');
    }

    clearHistory() {
        this.history = [];
        localStorage.removeItem('hydroscan_history_v2');
        this.openHistoryModal();
    }

    resetApp() {
        this.clearImage();
        this.showState('empty');
    }

    showNotification(msg, type = 'info') {
        const div = document.createElement('div');
        div.className = `fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-xl text-sm font-medium border flex items-center space-x-2 transition-all duration-300 ${type === 'error' ? 'bg-red-950/90 border-red-500/40 text-red-200' : 'bg-slate-900/90 border-slate-700 text-slate-200'}`;
        div.innerHTML = `<i data-lucide="${type === 'error' ? 'alert-circle' : 'info'}" class="w-4 h-4 text-emerald-400"></i><span></span>`;
        div.querySelector('span').textContent = msg;
        document.body.appendChild(div);
        this.initLucide();
        setTimeout(() => {
            div.style.opacity = '0';
            setTimeout(() => div.remove(), 300);
        }, 4000);
    }
}

const app = new DrainageAnalyzerApp();
