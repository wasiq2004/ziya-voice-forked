'use strict';

const WebSocket = require('ws');
const fetch = require('node-fetch');
const { LLMService } = require('../llmService.js');
const SarvamSttService = require('./sarvamSttService.js');
const WalletService = require('./walletService.js');
const CostCalculator = require('./costCalculator.js');
const AgentService = require('./agentService.js');
const ToolExecutionService = require('./toolExecutionService.js');

const sessions = new Map();

function getClientIp(req) {
    const fwd = req.headers['x-forwarded-for'];
    if (Array.isArray(fwd)) return fwd[0];
    return String(fwd || req.socket?.remoteAddress || 'unknown');
}

function uint8ToBase64(uint8) {
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < uint8.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, uint8.subarray(i, i + chunkSize));
    }
    return Buffer.from(uint8).toString('base64');
}

class BrowserVoiceHandler {
    constructor(geminiApiKey, openaiApiKey, elevenLabsApiKey, sarvamApiKey, mysqlPool = null) {
        if (!sarvamApiKey) throw new Error('Missing SARVAM_API_KEY');
        this.geminiApiKey = geminiApiKey;
        this.openaiApiKey = openaiApiKey;
        this.elevenLabsApiKey = elevenLabsApiKey;
        this.sarvamApiKey = sarvamApiKey;
        this.mysqlPool = mysqlPool;
        this.llmService = new LLMService(geminiApiKey, openaiApiKey);
        this.sarvamSttService = new SarvamSttService(sarvamApiKey);
        if (mysqlPool) {
            this.walletService = new WalletService(mysqlPool);
            this.costCalculator = new CostCalculator(mysqlPool, this.walletService);
        }
        console.log('✅ BrowserVoiceHandler initialized');
    }

    // ─── safe send ────────────────────────────────────────────────────────────
    safeSend(ws, payload) {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            console.warn(`⚠️ Cannot send - WebSocket not ready (state: ${ws?.readyState})`);
            return false;
        }
        try {
            console.log(`📤 Sending:`, JSON.stringify(payload).substring(0, 100));
            ws.send(JSON.stringify(payload));
            return true;
        } catch (e) {
            console.error('❌ safeSend error:', e.message);
            return false;
        }
    }

    // ─── main entry point ─────────────────────────────────────────────────────
    handleConnection(ws, req) {
        try {
            const url = new URL(req.url, `http://${req.headers.host}`);
            const voiceId = url.searchParams.get('voiceId') || 'default';
            const agentId = url.searchParams.get('agentId');
            const userId = url.searchParams.get('userId');
            const identityFromQuery = url.searchParams.get('identity') || '';
            const connectionId = `bv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            console.log(`🌐 New connection: ${connectionId} | voice: ${voiceId} | agent: ${agentId} | user: ${userId}`);

        // ── Session object ────────────────────────────────────────────────────
        const session = {
            connectionId,
            ws,
            userId,
            agentId,
            voiceId,
            agentPrompt: identityFromQuery,
            agentModel: 'gemini-2.0-flash',
            greetingMessage: 'Hello! How can I help you today?',
            tools: [],
            agentSettings: null,
            conversationHistory: [],
            // audio pipeline
            audioBuffer: [],
            speechDetected: false,
            silenceTimer: null,
            pendingAudioChunks: [], // holds chunks received before setup completes
            setupComplete: false,
            isProcessing: false,
            inputQueue: [],
            detectedLanguage: 'en-IN',
            // billing
            startTime: Date.now(),
            totalSTTSeconds: 0,
            totalTTSCharacters: 0,
            totalInputTokens: 0,
            totalOutputTokens: 0,
            callLogId: null,
            // rate limit
            rateLimit: { windowMs: 60000, maxTurns: 20, turnCount: 0, windowStart: Date.now() },
        };

        sessions.set(connectionId, session);

        // ── STEP 1: Wire ALL event handlers FIRST (before sending anything) ────
        console.log(`⚙️ Setting up event handlers...`);

        ws.on('message', (raw) => {
            try {
                const data = JSON.parse(raw);
                console.log(`📨 Message received [${connectionId}]:`, data.event, `| setupComplete: ${session.setupComplete}`);
                
                if (data.event === 'audio') {
                    if (!session.setupComplete) {
                        console.log(`📝 Queuing audio (setup pending) - queue size: ${session.pendingAudioChunks.length + 1}`);
                        session.pendingAudioChunks.push(data.data);
                    } else {
                        console.log(`🎙️ Processing audio chunk immediately`);
                        try {
                            this.handleAudioChunk(session, data.data);
                        } catch (audioErr) {
                            console.error(`❌ handleAudioChunk error [${connectionId}]:`, audioErr.message);
                            this.safeSend(ws, { event: 'error', message: `Audio processing failed: ${audioErr.message}` });
                        }
                    }
                } else if (data.event === 'ping') {
                    this.safeSend(ws, { event: 'pong' });
                } else if (data.event === 'stop-speaking') {
                    this.handleInterruption(session);
                } else {
                    console.log(`⚠️ Unknown event [${connectionId}]:`, data.event);
                }
            } catch (e) {
                console.error(`❌ Message parse/handle error [${connectionId}]:`, e.message);
            }
        });

        ws.on('close', async (code, reason) => {
            console.log(`🔌 Disconnected: ${connectionId} | code: ${code} | reason: ${reason?.toString()}`);
            await this.endSession(connectionId);
        });

        ws.on('error', (err) => {
            console.error(`❌ WS error (${connectionId}):`, err.message, err.code);
            console.error('Error type:', err.constructor.name);
        });

        // Heartbeat to detect dead connections
        const heartbeat = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.ping();
            } else {
                clearInterval(heartbeat);
            }
        }, 15000);
        ws.on('pong', () => { /* connection alive */ });

        console.log(`✅ Event handlers registered`);

        // ── STEP 2: Send session-ready AFTER all handlers are set up ──────────
        console.log(`📤 Sending session-ready on state: ${ws.readyState}`);
        this.safeSend(ws, { event: 'session-ready', connectionId });
        console.log(`✅ session-ready sent: ${connectionId}`);

        // ── STEP 3: Load agent from DB in background ──────────────────────────
        console.log(`⏳ Starting agent setup in background...`);
        this.loadAgentSetup(session, agentId, userId, voiceId).then(() => {
            session.setupComplete = true;
            console.log(`✅ Agent setup complete: ${connectionId}`);

            // Process any audio that arrived before setup finished
            if (session.pendingAudioChunks.length > 0) {
                console.log(`🔄 Processing ${session.pendingAudioChunks.length} pending audio chunks`);
                for (const chunk of session.pendingAudioChunks) {
                    try {
                        this.handleAudioChunk(session, chunk);
                    } catch (err) {
                        console.error(`❌ Error processing queued chunk:`, err.message);
                    }
                }
                session.pendingAudioChunks = [];
            }

            // Send greeting
            this.sendGreeting(session);

            // Log call start
            this.logCallStart(session).catch(e => console.error('logCallStart error:', e));

        }).catch(err => {
            console.error(`❌ Agent setup failed (${connectionId}):`, err.message);
            // Still mark setup complete with defaults so pipeline works
            session.setupComplete = true;
            this.sendGreeting(session);
        });

        } catch (err) {
            console.error(`❌ CRITICAL ERROR in handleConnection:`, err.message);
            console.error('Stack:', err.stack);
            try {
                ws.close(1011, `Server error: ${err.message}`);
            } catch (closeErr) {
                console.error('Failed to close WebSocket:', closeErr.message);
            }
        }
    }

    // ─── load agent from database ─────────────────────────────────────────────
    async loadAgentSetup(session, agentId, userId, voiceId) {
        if (!agentId || !userId || !this.mysqlPool) {
            console.log(`⚠️ Skipping DB load — missing agentId/userId/pool`);
            return;
        }

        try {
            const agentService = new AgentService(this.mysqlPool);
            const agent = await agentService.getAgentById(userId, agentId);

            if (!agent) {
                console.warn(`⚠️ Agent not found: ${agentId}`);
                return;
            }

            session.agentPrompt = agent.identity || session.agentPrompt;
            session.agentModel = agent.model || session.agentModel;
            session.agentSettings = agent.settings || null;
            session.greetingMessage = agent.settings?.greetingLine || session.greetingMessage;

            // Only use agent voiceId if none was passed in query
            if ((!voiceId || voiceId === 'default') && agent.voiceId) {
                session.voiceId = agent.voiceId;
            }

            // Tools
            if (agent.settings?.tools?.length > 0) {
                session.tools = agent.settings.tools;
                const toolDesc = session.tools.map(t =>
                    `- ${t.name}: ${t.description} (Params: ${t.parameters?.map(p => `${p.name}(${p.type})${p.required ? '*' : ''}`).join(', ') || 'none'})`
                ).join('\n');
                session.agentPrompt += `\n\nAvailable Tools:\n${toolDesc}\n\nWhen all required info is collected respond ONLY with JSON: {"tool":"name","data":{...}}`;
            }

            // Multilingual instruction
            session.agentPrompt += `\n\nIMPORTANT: Always reply in the same language the user speaks.`;

            console.log(`✅ Loaded agent: ${agent.name} | model: ${session.agentModel} | tools: ${session.tools.length}`);

            // Balance check
            if (this.walletService) {
                const check = await this.walletService.checkBalanceForCall(userId, 0.10);
                if (!check.allowed) {
                    console.warn(`❌ Insufficient balance for ${userId}: ${check.message}`);
                    this.safeSend(session.ws, { event: 'error', message: check.message, balance: check.balance });
                    session.ws.close(1008, 'Insufficient balance');
                    return;
                }
                console.log(`✅ Balance OK: $${check.balance.toFixed(4)}`);
            }

        } catch (err) {
            console.error('loadAgentSetup error:', err);
            throw err;
        }
    }

    // ─── send greeting ────────────────────────────────────────────────────────
    async sendGreeting(session) {
        if (!session.ws || session.ws.readyState !== WebSocket.OPEN) {
            console.warn(`⚠️ Cannot send greeting - WebSocket not ready (state: ${session.ws?.readyState})`);
            return;
        }

        const text = session.greetingMessage;
        console.log(`📢 Sending greeting: "${text}"`);
        this.safeSend(session.ws, { event: 'agent-response', text });
        this.appendToHistory(session, text, 'assistant');

        try {
            console.log(`🎙️ Starting TTS for greeting...`);
            await this.textToSpeech(session, text);
            console.log(`✅ Greeting TTS complete`);
        } catch (err) {
            console.error('❌ Greeting TTS error:', err.message, err.stack);
            this.safeSend(session.ws, { event: 'error', message: `Greeting TTS failed: ${err.message}` });
        }
    }

    // ─── audio pipeline: VAD ─────────────────────────────────────────────────
    handleAudioChunk(session, base64Audio) {
        try {
            const chunk = Buffer.from(base64Audio, 'base64');
            session.audioBuffer.push(chunk);

            // Energy-based VAD
            let sumSq = 0;
            for (let i = 0; i < chunk.length - 1; i += 2) {
                const s = chunk.readInt16LE(i);
                sumSq += s * s;
            }
            const rms = Math.sqrt(sumSq / (chunk.length / 2));
            const SILENCE_THRESHOLD = 3000;

            if (rms > SILENCE_THRESHOLD) {
                session.speechDetected = true;
                session.lastSpeechTime = Date.now();
                if (session.silenceTimer) {
                    clearTimeout(session.silenceTimer);
                    session.silenceTimer = null;
                }
            } else if (session.audioBuffer.length > 0 && !session.silenceTimer) {
                session.silenceTimer = setTimeout(() => this.processAudio(session), 700);
            }
        } catch (e) {
            console.error('handleAudioChunk error:', e.message);
        }
    }

    // ─── audio pipeline: STT ─────────────────────────────────────────────────
    async processAudio(session) {
        session.silenceTimer = null;

        if (session.audioBuffer.length === 0) return;
        if (!session.speechDetected) {
            session.audioBuffer = [];
            return;
        }

        const pcm = Buffer.concat(session.audioBuffer);
        session.audioBuffer = [];
        session.speechDetected = false;

        // Min buffer check (~0.5s at 16kHz 16-bit mono = 32000 bytes/s → 16000 bytes)
        if (pcm.length < 16000) {
            console.log(`⚠️ Buffer too short (${pcm.length} bytes), skipping`);
            return;
        }

        try {
            console.log(`🎤 Sending ${pcm.length} bytes to Sarvam STT...`);
            const wav = this.buildWav(pcm);
            const result = await this.sarvamSttService.transcribe(wav);
            const transcript = result.transcript?.trim();
            const lang = result.language_code;

            session.totalSTTSeconds += pcm.length / 32000;
            if (lang) session.detectedLanguage = lang;

            if (!transcript) {
                console.log('📝 Empty transcript, skipping');
                return;
            }

            // Filter hallucinations on very short buffers
            const hallucinations = ['Okay.', 'Yes.', 'No.', 'Okay', 'Yes', 'No', 'Hmm.', 'Hmm'];
            if (hallucinations.includes(transcript) && pcm.length < 20000) {
                console.log(`⚠️ Hallucination filtered: "${transcript}"`);
                return;
            }

            console.log(`📝 Transcript: "${transcript}" (${lang})`);
            this.safeSend(session.ws, { event: 'transcript', text: transcript, isFinal: true });
            this.appendToHistory(session, transcript, 'user');

            await this.processUserInput(session, transcript);

        } catch (err) {
            console.error('❌ STT error:', err.message);
            this.safeSend(session.ws, { event: 'error', message: 'Speech recognition failed' });
        }
    }

    // ─── LLM ─────────────────────────────────────────────────────────────────
    async processUserInput(session, userInput) {
        // Rate limit
        const now = Date.now();
        if (now - session.rateLimit.windowStart >= session.rateLimit.windowMs) {
            session.rateLimit.windowStart = now;
            session.rateLimit.turnCount = 0;
        }
        session.rateLimit.turnCount++;
        if (session.rateLimit.turnCount > session.rateLimit.maxTurns) {
            this.safeSend(session.ws, { event: 'error', message: 'Too many requests. Please slow down.' });
            return;
        }

        session.inputQueue.push(userInput);
        if (session.isProcessing) return;
        session.isProcessing = true;

        while (session.inputQueue.length > 0) {
            const input = session.inputQueue.shift();
            try {
                const response = await this.callLLM(session, input);
                if (response) {
                    this.safeSend(session.ws, { event: 'agent-response', text: response });
                }
            } catch (err) {
                console.error('LLM error:', err.message);
                this.safeSend(session.ws, { event: 'error', message: 'Failed to process your message' });
            }
        }

        session.isProcessing = false;
    }

    async callLLM(session, userInput) {
        try {
            const model = session.agentModel || 'gemini-2.0-flash';
            const isGemini = model.includes('gemini');

            const contents = session.conversationHistory.map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }]
            }));

            const stream = await this.llmService.generateContentStream({
                model,
                contents,
                config: { systemInstruction: session.agentPrompt }
            });

            let fullText = '';
            let sentenceBuf = '';
            const SENTENCE_END = /[.!?]+(\s|$)/;

            for await (const chunk of stream) {
                let token = '';
                try {
                    token = isGemini ? chunk.text() : (chunk.choices?.[0]?.delta?.content || '');
                } catch { continue; }
                if (!token) continue;

                fullText += token;
                sentenceBuf += token;

                if (SENTENCE_END.test(sentenceBuf)) {
                    const match = sentenceBuf.match(SENTENCE_END);
                    const splitAt = match.index + match[0].length;
                    const sentence = sentenceBuf.slice(0, splitAt).trim();
                    sentenceBuf = sentenceBuf.slice(splitAt);

                    if (sentence && !sentence.startsWith('{')) {
                        this.textToSpeech(session, sentence).catch(e =>
                            console.error('TTS sentence error:', e.message)
                        );
                    }
                }
            }

            // Flush remainder
            if (sentenceBuf.trim() && !sentenceBuf.trim().startsWith('{')) {
                this.textToSpeech(session, sentenceBuf.trim()).catch(e =>
                    console.error('TTS flush error:', e.message)
                );
            }

            // Check for tool call
            try {
                const clean = fullText.replace(/```json|```/g, '').trim();
                if (clean.startsWith('{') && clean.endsWith('}')) {
                    const parsed = JSON.parse(clean);
                    if (parsed.tool && parsed.data && this.mysqlPool) {
                        const tool = session.tools?.find(t => t.name === parsed.tool);
                        if (tool) {
                            const svc = new ToolExecutionService(this.llmService, this.mysqlPool);
                            await svc.executeTool(tool, parsed.data, session, session.agentSettings);
                            return await this.callLLM(session, 'Tool executed. Please confirm to the user.');
                        }
                    }
                }
            } catch { /* not a tool call */ }

            if (fullText) this.appendToHistory(session, fullText, 'assistant');
            return fullText;

        } catch (err) {
            console.error('callLLM error:', err.message);
            const fallback = "I'm sorry, I'm having trouble responding right now.";
            this.textToSpeech(session, fallback).catch(() => {});
            return fallback;
        }
    }

    // ─── TTS router ──────────────────────────────────────────────────────────
    async textToSpeech(session, text) {
        if (!text?.trim()) return;
        const provider = this.getVoiceProvider(session.voiceId);
        console.log(`🔊 TTS [${provider}]: "${text.substring(0, 60)}"`);

        try {
            if (provider === 'elevenlabs') {
                await this.elevenLabsTTS(session, text);
            } else {
                await this.sarvamTTS(session, text);
            }
            session.totalTTSCharacters += text.length;
        } catch (err) {
            console.error(`❌ TTS error [${provider}]:`, err.message);
            this.safeSend(session.ws, { event: 'error', message: 'Speech generation failed' });
        }
    }

    // ─── ElevenLabs TTS ──────────────────────────────────────────────────────
    async elevenLabsTTS(session, text) {
        if (!this.elevenLabsApiKey) throw new Error('ElevenLabs API key not configured');

        console.log(`🔄 ElevenLabs TTS request - voice: ${session.voiceId}`);
        const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${session.voiceId}/stream`, {
            method: 'POST',
            headers: {
                'Accept': 'audio/mpeg',
                'Content-Type': 'application/json',
                'xi-api-key': this.elevenLabsApiKey
            },
            body: JSON.stringify({
                text,
                model_id: 'eleven_turbo_v2_5',
                output_format: 'mp3_22050_32',
                voice_settings: { stability: 0.4, similarity_boost: 0.7 }
            })
        });

        if (!res.ok) {
            const err = await res.text().catch(() => res.statusText);
            throw new Error(`ElevenLabs ${res.status}: ${err}`);
        }

        const chunks = [];
        for await (const chunk of res.body) chunks.push(chunk);
        const audio = Buffer.concat(chunks);
        
        console.log(`✅ ElevenLabs audio received: ${audio.length} bytes`);

        if (session.ws.readyState !== WebSocket.OPEN) {
            console.warn(`⚠️ WebSocket not open (state: ${session.ws.readyState}) - cannot send audio`);
            return;
        }

        this.safeSend(session.ws, {
            event: 'audio',
            audio: audio.toString('base64'),
            format: 'mp3'
        });
        console.log(`✅ Audio payload sent via WebSocket`);
    }

    // ─── Sarvam TTS ──────────────────────────────────────────────────────────
    async sarvamTTS(session, text) {
        if (!this.sarvamApiKey) throw new Error('Sarvam API key not configured');

        const speakerId = session.voiceId.replace(/^sarvam[:/]/i, '');
        console.log(`🔄 Sarvam TTS request - speaker: ${speakerId}, language: ${session.detectedLanguage || 'en-IN'}`);

        const res = await fetch('https://api.sarvam.ai/text-to-speech', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-subscription-key': this.sarvamApiKey
            },
            body: JSON.stringify({
                inputs: [text],
                target_language_code: session.detectedLanguage || 'en-IN',
                speaker: speakerId,
                pitch: 0.2,
                pace: 0.95,
                loudness: 1.5,
                speech_sample_rate: 22050,
                enable_preprocessing: true,
                model: 'bulbul:v2'
            })
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Sarvam TTS ${res.status}: ${err}`);
        }

        const data = await res.json();
        if (!data.audios?.[0]) throw new Error('No audio in Sarvam response');

        console.log(`✅ Sarvam audio received`);
        
        if (session.ws.readyState !== WebSocket.OPEN) {
            console.warn(`⚠️ WebSocket not open (state: ${session.ws.readyState}) - cannot send audio`);
            return;
        }

        this.safeSend(session.ws, {
            event: 'audio',
            audio: data.audios[0],
            format: 'wav'
        });
        console.log('✅ Audio payload sent via WebSocket');
    }

    // ─── helpers ─────────────────────────────────────────────────────────────
    getVoiceProvider(voiceId = '') {
        const sarvamVoices = ['ananya','aditi','vidya','manisha','anushka','amartya',
            'arvind','abhilash','aarav','karun','dhruv','rohan','arya','hitesh','chitra'];
        if (voiceId.toLowerCase().includes('sarvam') ||
            sarvamVoices.includes(voiceId.toLowerCase())) return 'sarvam';
        return 'elevenlabs';
    }

    buildWav(pcm) {
        const header = Buffer.alloc(44);
        const dataLen = pcm.length;
        header.write('RIFF', 0);
        header.writeUInt32LE(36 + dataLen, 4);
        header.write('WAVE', 8);
        header.write('fmt ', 12);
        header.writeUInt32LE(16, 16);
        header.writeUInt16LE(1, 20);
        header.writeUInt16LE(1, 22);
        header.writeUInt32LE(16000, 24);
        header.writeUInt32LE(32000, 28);
        header.writeUInt16LE(2, 32);
        header.writeUInt16LE(16, 34);
        header.write('data', 36);
        header.writeUInt32LE(dataLen, 40);
        return Buffer.concat([header, pcm]);
    }

    appendToHistory(session, content, role) {
        session.conversationHistory.push({ role, content, timestamp: Date.now() });
        if (session.conversationHistory.length > 20) {
            session.conversationHistory = session.conversationHistory.slice(-20);
        }
    }

    handleInterruption(session) {
        session.isProcessing = false;
        session.inputQueue = [];
        this.safeSend(session.ws, { event: 'stop-audio' });
        console.log(`⏸️ Interrupted: ${session.connectionId}`);
    }

    // ─── session end ─────────────────────────────────────────────────────────
    async endSession(connectionId) {
        const session = sessions.get(connectionId);
        if (!session) return;
        if (session.silenceTimer) clearTimeout(session.silenceTimer);
        await this.logCallEnd(session);
        sessions.delete(connectionId);
        console.log(`📴 Session ended: ${connectionId}`);
    }

    // ─── database logging ─────────────────────────────────────────────────────
    async logCallStart(session) {
        if (!this.mysqlPool || !session.userId) return;
        try {
            const { v4: uuidv4 } = require('uuid');
            const id = uuidv4();
            await this.mysqlPool.execute(
                `INSERT INTO calls (id, user_id, agent_id, call_sid, from_number, to_number, direction, status, call_type, started_at, timestamp)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                [id, session.userId, session.agentId || null, session.connectionId,
                 'browser-client', 'voice-agent', 'inbound', 'in-progress', 'web_call', new Date(session.startTime)]
            );
            session.callLogId = id;
            console.log(`✅ Call logged: ${id}`);
        } catch (e) {
            console.error('logCallStart error:', e.message);
        }
    }

    async logCallEnd(session) {
        if (!this.mysqlPool || !session.callLogId) return;
        try {
            const duration = Math.floor((Date.now() - session.startTime) / 1000);
            await this.mysqlPool.execute(
                `UPDATE calls SET status='completed', ended_at=?, duration=? WHERE id=?`,
                [new Date(), duration, session.callLogId]
            );
            console.log(`✅ Call ended: ${session.callLogId} (${duration}s)`);

            if (session.userId && this.costCalculator) {
                const provider = this.getVoiceProvider(session.voiceId);
                const usage = {
                    gemini: session.totalInputTokens + session.totalOutputTokens,
                    deepgram: session.totalSTTSeconds,
                    ...(provider === 'elevenlabs'
                        ? { elevenlabs: session.totalTTSCharacters }
                        : { sarvam: session.totalTTSCharacters })
                };
                const result = await this.costCalculator.recordAndCharge(
                    session.userId, session.callLogId, usage, true, duration
                );
                console.log(`💰 Charged: $${result.totalCharged.toFixed(4)}`);
            }
        } catch (e) {
            console.error('logCallEnd error:', e.message);
        }
    }
}

module.exports = { BrowserVoiceHandler };