const { LLMService } = require("../llmService.js");
const nodeFetch = require("node-fetch");
const WalletService = require('./walletService.js');
const CostCalculator = require('./costCalculator.js');
const SarvamSttService = require('./sarvamSttService.js');

// Precompute mu-law to linear PCM table for fast VAD
const MU_LAW_TO_PCM = new Int16Array(256);
for (let i = 0; i < 256; i++) {
    let mu = ~i; // Invert bits
    let sign = (mu & 0x80);
    let exponent = (mu & 0x70) >> 4;
    let mantissa = (mu & 0x0F);
    let sample = (mantissa << (exponent + 3)) + 132;
    sample <<= (exponent);
    sample -= 132;
    MU_LAW_TO_PCM[i] = sign ? -sample : sample;
}

const sessions = new Map();

class MediaStreamHandler {
    constructor(geminiApiKey, openaiApiKey, campaignService, mysqlPool = null, sarvamApiKey = null) {
        if (!geminiApiKey) throw new Error("Missing Gemini API Key");
        if (!sarvamApiKey && !process.env.SARVAM_API_KEY) throw new Error("Missing Sarvam API Key for STT");

        this.llmService = new LLMService(geminiApiKey, openaiApiKey);
        this.campaignService = campaignService;
        this.mysqlPool = mysqlPool;
        this.sarvamApiKey = sarvamApiKey || process.env.SARVAM_API_KEY;
        this.sarvamSttService = new SarvamSttService(this.sarvamApiKey);

        if (mysqlPool) {
            this.walletService = new WalletService(mysqlPool);
            this.costCalculator = new CostCalculator(mysqlPool, this.walletService);
        }
        console.log('✅ MediaStreamHandler initialized (Sarvam STT)');
    }

    // ✅ FIX: Method to get fresh API key each time
    getElevenLabsApiKey() {
        return process.env.ELEVEN_LABS_API_KEY || process.env.ELEVEN_LABS_API_KEY;
    }

    createSession(callId, agentPrompt, agentVoiceId, ws, userId = null, agentId = null, agentModel = null, agentSettings = null, contactId = null, campaignId = null) {
        const session = {
            callId,
            contactId,
            campaignId,
            context: [],
            agentPrompt,
            agentVoiceId: agentVoiceId || "21m00Tcm4TlvDq8ikWAM",
            agentModel: agentModel || "gemini-2.0-flash",
            agentSettings: agentSettings,
            ws,
            streamSid: null,
            isReady: false,
            audioQueue: [],
            isSpeaking: false,
            lastUserSpeechTime: null,
            isProcessing: false,
            userId: userId,
            agentId: agentId,
            startTime: new Date(),
            // Sarvam STT Buffering & VAD
            audioBuffer: [],
            speechDetectedInChunk: false,
            silenceTimer: null,
            lastSpeechTime: Date.now(),
            usage: {
                twilio: 0,
                sarvam_stt: 0,
                gemini: 0,
                elevenlabs: 0,
                sarvam: 0
            }
        };
        sessions.set(callId, session);
        console.log(`✅ Created session for call ${callId} (Sarvam STT-ready)`);
        return session;
    }

    async endSession(callId) {
        const session = sessions.get(callId);
        if (session) {
            // Execute tools marked to run after call
            if (session.tools && session.tools.length > 0 && session.agentId) {
                const afterCallTools = session.tools.filter(tool => tool.runAfterCall);
                if (afterCallTools.length > 0) {
                    console.log(`🔧 Executing ${afterCallTools.length} after-call tools...`);

                    const ToolExecutionService = require('./toolExecutionService.js');
                    const toolExecutionService = new ToolExecutionService(this.llmService, this.mysqlPool);

                    // Execute after-call tools (don't await to avoid blocking)
                    toolExecutionService.processToolsAfterCall(session, afterCallTools)
                        .then(() => {
                            console.log('✅ After-call tools executed successfully');
                        })
                        .catch(err => {
                            console.error('❌ Error executing after-call tools:', err);
                        });
                }
            }

            let finalCost = 0;
            const durationSecondsForCost = session.startTime ? (new Date() - session.startTime) / 1000 : 0;

            // Calculate and charge for Twilio usage first so we have the cost
            if (session.startTime && session.userId && this.costCalculator) {
                try {
                    session.usage.twilio = durationSecondsForCost / 60;
                    const chargeResult = await this.costCalculator.recordAndCharge(
                        session.userId,
                        session.callId,
                        session.usage,
                        true, // isVoiceCall
                        durationSecondsForCost // durationSeconds
                    );
                    finalCost = chargeResult.totalCharged || 0;
                    console.log(`✅ Charged user ${session.userId}: $${finalCost.toFixed(4)}`);
                    console.log('   Breakdown:', chargeResult.breakdown);
                } catch (err) {
                    console.error('❌ Error charging user:', err.message);
                    if (err.message === 'Insufficient balance') {
                        console.warn(`⚠️ User ${session.userId} ended call with insufficient balance`);
                    }
                }
            }

            // Save Transcript and Classify Intent for Campaigns
            if (session.contactId && this.campaignService) {
                try {
                    const fullTranscript = session.context.map(msg => `${msg.role.toUpperCase()}: ${msg.parts[0].text}`).join('\n');
                    const durationSeconds = Math.round(durationSecondsForCost);
                    console.log(`📝 Saving transcript and classifying intent for contact ${session.contactId}...`);

                    await this.campaignService.updateContactAfterCall(
                        session.contactId,
                        durationSeconds,
                        finalCost, // Passing calculated cost here
                        'completed',
                        fullTranscript
                    );
                    console.log(`✅ Campaign contact ${session.contactId} updated with transcript and LLM classification`);
                } catch (campaignErr) {
                    console.error('❌ Error updating campaign contact after call:', campaignErr);
                }
            }

            if (session.silenceTimer) {
                clearTimeout(session.silenceTimer);
            }
            session.audioBuffer = [];
            sessions.delete(callId);
            console.log(`❌ Ended session for call ${callId}`);
        }
    }

    appendToContext(session, text, role) {
        session.context.push({ role, parts: [{ text }] });
        console.log(`💬 ${role.toUpperCase()}: ${text}`);
    }

    // REPLACE the handleConnection method in mediaStreamHandler.js:

    async handleConnection(ws, req) {
        let callId = null;
        let agentId = null;
        let session = null;

        try {
            console.log(`📞 WebSocket connection initiated from handleConnection`);

            // Extract from query params as fallback (for non-Twilio or early identification)
            const queryParams = require('url').parse(req.url, true).query;
            let queryCallId = queryParams.callId;
            let queryAgentId = queryParams.agentId;
            let queryUserId = queryParams.userId;
            let queryContactId = queryParams.contactId;
            let queryCampaignId = queryParams.campaignId;

            // ✅ Set up error handler FIRST before any other operations
            ws.on("error", (error) => {
                // Ignore UTF-8 errors from binary frames (Twilio sends binary audio data)
                if (error.code === 'WS_ERR_INVALID_UTF8' ||
                    error.message?.includes('invalid UTF-8') ||
                    error.message?.includes('Invalid WebSocket frame')) {
                    console.log("⚠️  Ignoring binary frame error (normal for audio data)");
                    return; // Don't crash
                }
                console.error("❌ WebSocket error:", error);
            });

            ws.on("message", async (message) => {
                try {
                    let data;

                    // ✅ CRITICAL: Handle binary messages from Twilio
                    if (Buffer.isBuffer(message)) {
                        // Binary message - try to parse as JSON first
                        try {
                            const messageStr = message.toString('utf8');
                            data = JSON.parse(messageStr);
                        } catch (e) {
                            // Not JSON - could be raw audio, ignore
                            return;
                        }
                    } else if (typeof message === 'string') {
                        // String message - parse as JSON
                        data = JSON.parse(message);
                    } else {
                        // Unknown message type
                        return;
                    }

                    // ✅ Get parameters from Twilio "start" event
                    if (data.event === "start") {
                        console.log("▶️  Media Stream START event received");

                        // Extract parameters from start event
                        const streamParams = data.start?.customParameters || {};
                        callId = streamParams.callId || queryCallId || data.start?.callSid;
                        agentId = streamParams.agentId || queryAgentId;
                        const userId = streamParams.userId || queryUserId;
                        const contactId = streamParams.contactId || queryContactId;
                        const campaignId = streamParams.campaignId || queryCampaignId;

                        console.log(`📞 Call ID: ${callId}`);
                        console.log(`🤖 Agent ID: ${agentId}`);
                        console.log(`👤 User ID: ${userId}`);
                        if (contactId) console.log(`🧑‍💼 Contact ID: ${contactId}`);

                        if (!callId) {
                            console.error("❌ No callId found in start event or query params");
                            ws.close();
                            return;
                        }

                        // Load agent configuration
                        let agentPrompt = "You are a helpful AI assistant.";
                        let agentVoiceId = "21m00Tcm4TlvDq8ikWAM"; // Default voice
                        let agentModel = "gemini-2.0-flash"; // Default model
                        let greetingMessage = "Hello! How can I help you today?";
                        let tools = [];
                        let agent = null; // Declare agent outside the if block

                        if (agentId) {
                            try {
                                const AgentService = require('./agentService.js');
                                const agentService = new AgentService(require('../config/database.js').default);

                                console.log(`🔍 Fetching agent from database: userId=${userId}, agentId=${agentId}`);
                                agent = await agentService.getAgentById(userId, agentId);
                                console.log(`📋 Agent query result:`, agent ? `Found: ${agent.name}` : 'NOT FOUND');

                                if (agent) {
                                    console.log(`📊 Agent details:`, {
                                        name: agent.name,
                                        voiceId: agent.voiceId,
                                        hasIdentity: !!agent.identity,
                                        hasGreeting: !!agent.settings?.greetingLine
                                    });

                                    agentPrompt = agent.identity || agentPrompt;

                                    // Process Tools
                                    if (agent.settings && agent.settings.tools && agent.settings.tools.length > 0) {
                                        tools = agent.settings.tools;
                                        const toolDescriptions = tools.map(tool =>
                                            `- ${tool.name}: ${tool.description} (Parameters: ${tool.parameters?.map(p => `${p.name} (${p.type})${p.required ? ' [required]' : ''}`).join(', ') || 'None'})`
                                        ).join('\n');

                                        agentPrompt += `\n\nAvailable Tools:\n${toolDescriptions}\n\nWhen you need to collect information from the user, ask for the required parameters. When all required information is collected, respond with a JSON object in the format: {"tool": "tool_name", "data": {"param1": "value1", "param2": "value2"}}. Do NOT add any other text before or after the JSON.`;
                                    }

                                    // ✅ CRITICAL: Use the voice ID directly from database
                                    if (agent.voiceId) {
                                        agentVoiceId = agent.voiceId;
                                        console.log(`🎤 Using agent voice ID from database: ${agentVoiceId}`);
                                    } else {
                                        console.warn(`⚠️  Agent has no voiceId, using default: ${agentVoiceId}`);
                                    }

                                    // ✅ CRITICAL: Use the model directly from database
                                    if (agent.model) {
                                        agentModel = agent.model;
                                        console.log(`🤖 Using agent model from database: ${agentModel}`);
                                    } else {
                                        console.warn(`⚠️  Agent has no model, using default: ${agentModel}`);
                                    }

                                    if (agent.settings?.greetingLine) {
                                        greetingMessage = agent.settings.greetingLine;
                                        console.log(`👋 Using custom greeting: "${greetingMessage}"`);
                                    } else {
                                        console.log(`👋 Using default greeting: "${greetingMessage}"`);
                                    }
                                    console.log(`✅ Loaded agent: ${agent.name} with ${tools.length} tools`);
                                    console.log(`   Voice ID: ${agentVoiceId}`);
                                    console.log(`   Prompt: ${agentPrompt.substring(0, 100)}...`);
                                } else {
                                    console.error(`❌ Agent ${agentId} not found in database for userId ${userId}`);
                                    console.warn(`⚠️  Using defaults: voice=${agentVoiceId}, greeting="${greetingMessage}"`);
                                }
                            } catch (err) {
                                console.error("⚠️  Error loading agent:", err.message);
                            }
                        } else {
                            console.log(`ℹ️  No agentId provided, using default voice: ${agentVoiceId}`);
                        }

                        // Check user balance before starting call
                        if (userId && this.walletService) {
                            const balanceCheck = await this.walletService.checkBalanceForCall(userId, 0.10);
                            if (!balanceCheck.allowed) {
                                console.error(`❌ Insufficient balance for user ${userId}: ${balanceCheck.message}`);
                                // Send error to Twilio and close connection
                                ws.send(JSON.stringify({
                                    event: 'error',
                                    message: balanceCheck.message
                                }));
                                ws.close();
                                return;
                            }
                            console.log(`✅ Balance check passed: $${balanceCheck.balance.toFixed(4)}`);
                        }

                        // Map agent language to Sarvam language codes
                        const languageMap = {
                            'ENGLISH': 'en-IN',
                            'HINDI': 'hi-IN',
                            'TAMIL': 'ta-IN',
                            'TELUGU': 'te-IN',
                            'KANNADA': 'kn-IN',
                            'MALAYALAM': 'ml-IN',
                            'BENGALI': 'bn-IN',
                            'MARATHI': 'mr-IN',
                            'GUJARATI': 'gu-IN',
                            'PUNJABI': 'pa-IN'
                        };

                        // Get language from agent or default to English
                        const agentLanguage = agent?.language || 'ENGLISH';
                        const sarvamLanguage = languageMap[agentLanguage] || 'en-IN';
                        console.log(`🌐 Using language: ${agentLanguage} (Sarvam: ${sarvamLanguage})`);

                        session = this.createSession(callId, agentPrompt, agentVoiceId, ws, userId, agentId, agentModel, agent?.settings, contactId, campaignId);
                        session.tools = tools;
                        session.language = agentLanguage;
                        session.greetingMessage = greetingMessage;
                        session.streamSid = data.start.streamSid;
                        session.isReady = true;

                        // ✅ Twilio keep-alive: Send silence immediately
                        if (session.isReady && session.streamSid) {
                            const silenceBuffer = Buffer.alloc(160, 0xFF);
                            const base64Silence = silenceBuffer.toString('base64');
                            for (let i = 0; i < 5; i++) {
                                session.ws.send(JSON.stringify({
                                    event: "media",
                                    streamSid: session.streamSid,
                                    media: { payload: base64Silence }
                                }));
                            }
                        }

                        // Send greeting
                        setTimeout(async () => {
                            try {
                                const audio = await this.synthesizeTTS(session.greetingMessage, session.agentVoiceId, session);
                                if (audio && audio.length > 0) {
                                    this.sendAudioToTwilio(session, audio);
                                }
                            } catch (err) {
                                console.error("❌ Greeting error:", err);
                            }
                        }, 800);

                    } else if (data.event === "connected") {
                        console.log("✅ Twilio connected");

                    } else if (data.event === "media") {
                        if (session?.isReady && data.media?.payload) {
                            const audioBuffer = Buffer.from(data.media.payload, "base64");
                            this.handleIncomingAudio(session, audioBuffer);
                        }

                    } else if (data.event === "stop") {
                        console.log("⏹️  Stream stopped");
                        if (callId) this.endSession(callId);

                    } else if (data.event === "mark") {
                        console.log("📍 Mark:", data.mark?.name);
                    }

                } catch (err) {
                    // Only log real errors
                    if (!err.message?.includes('JSON') && !err.message?.includes('Unexpected')) {
                        console.error("❌ Message processing error:", err);
                    }
                }
            });

            ws.on("close", () => {
                console.log("🔌 WebSocket closed");
                if (callId) this.endSession(callId);
            });

            console.log("✅ WebSocket handlers registered and ready");

        } catch (err) {
            console.error("❌ Connection setup error:", err);
            try {
                ws.close();
            } catch (closeErr) {
                // Ignore close errors
            }
        }
    }
    async callLLM(session) {
        try {
            const modelToUse = session.agentModel || "gemini-2.0-flash";
            const isGemini = modelToUse.includes('gemini');
            const provider = isGemini ? 'Gemini' : 'OpenAI';

            console.log(`🧠 Calling ${provider} LLM Stream with model: ${modelToUse}`);

            const stream = await this.llmService.generateContentStream({
                model: modelToUse,
                contents: session.context,
                config: { systemInstruction: session.agentPrompt },
            });

            let fullText = "";
            let currentSentence = "";
            const sentenceBoundaries = /[.!?]+(\s|$)/;

            for await (const chunk of stream) {
                let content = "";
                if (isGemini) {
                    content = chunk.text();
                } else {
                    content = chunk.choices[0]?.delta?.content || "";
                }

                if (!content) continue;

                fullText += content;
                currentSentence += content;

                if (sentenceBoundaries.test(currentSentence)) {
                    const match = currentSentence.match(sentenceBoundaries);
                    const splitIndex = match.index + match[0].length;
                    const completeSentence = currentSentence.slice(0, splitIndex).trim();

                    if (completeSentence && !completeSentence.startsWith('{')) {
                        console.log(`📡 Sentence ready for TTS: "${completeSentence}"`);
                        this.processSentenceTTS(completeSentence, session);
                    }

                    currentSentence = currentSentence.slice(splitIndex);
                }
            }

            if (currentSentence.trim() && !currentSentence.trim().startsWith('{')) {
                console.log(`📡 Final sentence ready for TTS: "${currentSentence.trim()}"`);
                this.processSentenceTTS(currentSentence.trim(), session);
            }

            console.log(`💬 ${provider} full response received:`, fullText.substring(0, 100) + '...');

            try {
                const cleanText = fullText.replace(/```json/g, '').replace(/```/g, '').trim();
                if (cleanText.startsWith('{') && cleanText.endsWith('}')) {
                    const parsed = JSON.parse(cleanText);

                    if (parsed.tool && parsed.data) {
                        console.log(`🛠️ Tool usage detected: ${parsed.tool}`);
                        const tool = session.tools?.find(t => t.name === parsed.tool);
                        if (tool) {
                            const filteredData = {};
                            const allowedParams = tool.parameters || [];
                            allowedParams.forEach(param => {
                                if (parsed.data[param.name] !== undefined) {
                                    filteredData[param.name] = parsed.data[param.name];
                                }
                            });

                            const blackList = ['transcript', 'context', 'raw_text', 'conversation', 'history'];
                            blackList.forEach(key => delete filteredData[key]);

                            if (!session.dataSaved && Object.keys(filteredData).length > 0) {
                                try {
                                    const ToolExecutionService = require('./toolExecutionService.js');
                                    const toolService = new ToolExecutionService(this.llmService, this.mysqlPool);
                                    await toolService.executeTool(tool, filteredData, session, session.agentSettings);
                                    session.dataSaved = true;
                                    console.log(`✅ Structured data processed via WebhookService`);
                                } catch (toolErr) {
                                    console.error('❌ Failed to execute tool service:', toolErr);
                                }
                            }
                        }

                        this.appendToContext(session, JSON.stringify({
                            tool: parsed.tool,
                            status: "success",
                            message: "Execution completed"
                        }), "user");

                        return await this.callLLM(session);
                    }
                }
            } catch (jsonError) {
                // Not a valid JSON tool call
            }

            return fullText;
        } catch (err) {
            console.error("❌ LLM stream error:", err);
            return "I apologize, I'm having trouble processing that right now.";
        }
    }

    async processSentenceTTS(text, session) {
        try {
            const ttsAudio = await this.synthesizeTTS(text, session.agentVoiceId, session);
            if (ttsAudio) {
                this.sendAudioToTwilio(session, ttsAudio);
            }
        } catch (err) {
            console.error("❌ Error processing sentence TTS:", err);
        }
    }

    async synthesizeTTS(text, voiceId, session = null) {
        try {
            const { generateTTS } = require('./tts_controller.js');
            const audioBuffer = await generateTTS(text, { voiceId });

            if (session && session.usage) {
                const characterCount = text.length;
                const sarvamVoices = [
                    'anushka', 'abhilash', 'manisha', 'vidya', 'arya', 'karun',
                    'hitesh', 'aditya', 'isha', 'ritu', 'chirag', 'harsh',
                    'sakshi', 'priya', 'neha', 'rahul', 'pooja', 'rohan',
                    'simran', 'kavya', 'anjali', 'sneha', 'kiran', 'vikram',
                    'rajesh', 'sunita', 'tara', 'anirudh', 'kriti', 'ishaan',
                    'ratan', 'varun', 'manan', 'sumit', 'roopa', 'kabir',
                    'aayan', 'shubh', 'arvind'
                ];

                const isSarvam = voiceId && (
                    voiceId.includes('sarvam') ||
                    sarvamVoices.includes(voiceId.toLowerCase())
                );

                if (isSarvam) {
                    session.usage.sarvam += characterCount;
                } else {
                    session.usage.elevenlabs += characterCount;
                }
            }
            return audioBuffer;
        } catch (err) {
            console.error("❌ TTS error:", err);
            return null;
        }
    }

    sendAudioToTwilio(session, audioBuffer) {
        try {
            if (!session.isReady || !session.streamSid) {
                session.audioQueue.push(audioBuffer);
                return;
            }

            session.isSpeaking = true;
            const chunkSize = 160;
            let chunksSent = 0;
            let offset = 0;

            const sendNextChunk = () => {
                if (!session.isSpeaking) return;
                if (offset >= audioBuffer.length) {
                    session.ws.send(JSON.stringify({
                        event: "mark",
                        streamSid: session.streamSid,
                        mark: { name: "audio_complete" },
                    }));
                    setTimeout(() => { session.isSpeaking = false; }, chunksSent * 20);
                    return;
                }

                const chunkBuffer = audioBuffer.slice(offset, offset + chunkSize);
                session.ws.send(JSON.stringify({
                    event: "media",
                    streamSid: session.streamSid,
                    media: { payload: chunkBuffer.toString('base64') },
                }));
                chunksSent++;
                offset += chunkSize;
                setTimeout(sendNextChunk, 18);
            };
            sendNextChunk();
        } catch (err) {
            console.error("❌ Error sending audio to Twilio:", err);
            session.isSpeaking = false;
        }
    }

    /**
     * Handle incoming audio from Twilio (mulaw)
     */
    async handleIncomingAudio(session, audioChunk) {
        try {
            session.audioBuffer.push(audioChunk);

            // VAD Logic for mulaw
            let sumSquares = 0;
            for (let i = 0; i < audioChunk.length; i++) {
                const sample = MU_LAW_TO_PCM[audioChunk[i]];
                sumSquares += sample * sample;
            }
            const rms = Math.sqrt(sumSquares / audioChunk.length);

            // Adjusted threshold for phone line noise
            const SILENCE_THRESHOLD = 1500;

            if (rms > SILENCE_THRESHOLD) {
                session.speechDetectedInChunk = true;
                session.lastSpeechTime = Date.now();
                if (session.silenceTimer) {
                    clearTimeout(session.silenceTimer);
                    session.silenceTimer = null;
                }

                // Interruption check: User spoke while agent was talking
                if (session.isSpeaking) {
                    console.log(`⚠️ User interruption detected`);
                    session.isSpeaking = false;
                    if (session.ws && session.streamSid) {
                        session.ws.send(JSON.stringify({
                            event: "clear",
                            streamSid: session.streamSid
                        }));
                    }
                }
            } else {
                if (!session.silenceTimer && session.audioBuffer.length > 0) {
                    // 600ms: phone lines have less ambient noise so shorter wait is safe.
                    session.silenceTimer = setTimeout(() => {
                        this.processBufferedAudio(session);
                    }, 600);
                }
            }
        } catch (error) {
            console.error('Error handling incoming audio:', error);
        }
    }

    /**
     * Process buffered audio: mulaw -> WAV -> Sarvam STT -> LLM
     */
    async processBufferedAudio(session) {
        if (session.audioBuffer.length === 0) return;
        session.silenceTimer = null;

        if (!session.speechDetectedInChunk) {
            session.audioBuffer = [];
            return;
        }

        const completeBuffer = Buffer.concat(session.audioBuffer);
        session.audioBuffer = [];
        session.speechDetectedInChunk = false;

        // Skip extremely short buffers (noise)
        if (completeBuffer.length < 4000) return; // < 0.5s

        try {
            console.log(`🎤 Transcribing ${completeBuffer.length} bytes with Sarvam STT...`);

            // Pure-JS mulaw (8kHz) → WAV (16kHz PCM) — no FFmpeg spawn needed
            const wavBuffer = this.convertMulawToWavJS(completeBuffer);

            const result = await this.sarvamSttService.transcribe(wavBuffer);
            const transcript = result.transcript;

            // Track usage (8kHz mulaw = 8000 bytes/sec)
            const durationSeconds = completeBuffer.length / 8000;
            session.usage.sarvam_stt += durationSeconds;

            if (transcript && transcript.trim()) {
                console.log(`📝 Sarvam Transcript: "${transcript}"`);
                this.appendToContext(session, transcript, "user");

                session.isProcessing = true;
                const llmResponse = await this.callLLM(session);
                this.appendToContext(session, llmResponse, "model");
                session.isProcessing = false;
            }
        } catch (error) {
            console.error('❌ Sarvam STT processing error:', error);
            session.isProcessing = false;
        }
    }

    /**
     * Pure-JS mulaw→8kHz PCM→16kHz PCM→WAV conversion.
     * Replaces the FFmpeg child-process spawn — eliminates 150–300ms cold-start per utterance.
     *
     * Steps:
     *   1. Mulaw bytes → 16-bit signed PCM at 8kHz  (MU_LAW_TO_PCM lookup table already in memory)
     *   2. 8kHz → 16kHz upsample via linear interpolation (2×)
     *   3. Wrap in a standard 44-byte WAV header
     *
     * @param {Buffer} mulawBuffer - Raw µ-law 8kHz mono audio from Twilio
     * @returns {Buffer} WAV file buffer at 16kHz PCM, ready for Sarvam STT
     */
    convertMulawToWavJS(mulawBuffer) {
        const len = mulawBuffer.length;

        // Step 1: mulaw → 16-bit PCM at 8kHz using the in-memory lookup table
        const pcm8k = new Int16Array(len);
        for (let i = 0; i < len; i++) {
            pcm8k[i] = MU_LAW_TO_PCM[mulawBuffer[i]];
        }

        // Step 2: Upsample 8kHz → 16kHz by 2× linear interpolation
        // Each input sample becomes 2 output samples:
        //   out[2i]   = in[i]
        //   out[2i+1] = average of in[i] and in[i+1]  (linear interpolation)
        const upLen = len * 2;
        const pcm16k = new Int16Array(upLen);
        for (let i = 0; i < len - 1; i++) {
            pcm16k[2 * i] = pcm8k[i];
            pcm16k[2 * i + 1] = Math.round((pcm8k[i] + pcm8k[i + 1]) / 2);
        }
        // Handle the last sample (no next sample to interpolate with)
        pcm16k[2 * (len - 1)] = pcm8k[len - 1];
        pcm16k[2 * (len - 1) + 1] = pcm8k[len - 1];

        // Step 3: Build a standard 44-byte WAV/RIFF header + PCM data
        const pcmBuffer = Buffer.from(pcm16k.buffer);
        const dataSize = pcmBuffer.length;
        const sampleRate = 16000;
        const channels = 1;
        const bitDepth = 16;
        const byteRate = sampleRate * channels * (bitDepth / 8);
        const blockAlign = channels * (bitDepth / 8);

        const header = Buffer.alloc(44);
        header.write('RIFF', 0);
        header.writeUInt32LE(36 + dataSize, 4);
        header.write('WAVE', 8);
        header.write('fmt ', 12);
        header.writeUInt32LE(16, 16);           // PCM sub-chunk size
        header.writeUInt16LE(1, 20);            // PCM format (linear)
        header.writeUInt16LE(channels, 22);
        header.writeUInt32LE(sampleRate, 24);
        header.writeUInt32LE(byteRate, 28);
        header.writeUInt16LE(blockAlign, 32);
        header.writeUInt16LE(bitDepth, 34);
        header.write('data', 36);
        header.writeUInt32LE(dataSize, 40);

        return Buffer.concat([header, pcmBuffer]);
    }
}

module.exports = { MediaStreamHandler };
