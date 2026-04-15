const express = require('express');
const router = express.Router();

// Simpler REST-based browser voice implementation
const activeSessions = new Map(); // sessionId -> session state

const LLMService = require('../llmService.js');
const SarvamSttService = require('../services/sarvamSttService.js');
const WalletService = require('../services/walletService.js');
const AgentService = require('../services/agentService.js');

// Initialize session for browser voice
router.post('/start-session', async (req, res) => {
    try {
        const { voiceId, agentId, userId, identity } = req.body;

        if (!agentId || !userId) {
            return res.status(400).json({
                success: false,
                message: 'Missing agentId or userId'
            });
        }

        const sessionId = `bvr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        console.log(`\n🎬 Starting browser voice session: ${sessionId}`);
        console.log(`👤 Agent: ${agentId} | User: ${userId}`);

        const session = {
            sessionId,
            voiceId: voiceId || 'default',
            agentId,
            userId,
            identity: decodeURIComponent(identity || ''),
            conversationHistory: [],
            audioBuffer: [],
            createdAt: Date.now(),
            lastActivityAt: Date.now()
        };

        activeSessions.set(sessionId, session);

        // Session expires after 30 minutes
        setTimeout(() => {
            activeSessions.delete(sessionId);
            console.log(`🗑️ Session expired: ${sessionId}`);
        }, 30 * 60 * 1000);

        res.json({
            success: true,
            sessionId,
            message: 'Session started'
        });

    } catch (error) {
        console.error('❌ Error starting session:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to start session',
            error: error.message
        });
    }
});

// Send user message and get agent response
router.post('/send-message', async (req, res) => {
    try {
        const { sessionId, userMessage } = req.body;

        const session = activeSessions.get(sessionId);
        if (!session) {
            return res.status(404).json({
                success: false,
                message: 'Session not found'
            });
        }

        session.lastActivityAt = Date.now();
        const { agentId, userId } = session;

        console.log(`\n💬 Processing message in ${sessionId}: "${userMessage.substring(0, 50)}..."`);

        // Load agent if not loaded
        if (!session.agent) {
            try {
                const agentService = new AgentService(req.mysqlPool);
                session.agent = await agentService.getAgentById(userId, agentId);
                console.log(`✅ Agent loaded: ${session.agent?.name}`);
            } catch (err) {
                console.error('❌ Failed to load agent:', err.message);
                return res.status(500).json({
                    success: false,
                    message: 'Failed to load agent configuration'
                });
            }
        }

        // Add user message to history
        session.conversationHistory.push({
            role: 'user',
            parts: [{ text: userMessage }]
        });

        // Generate agent response using Gemini
        const llmService = new LLMService(process.env.VITE_GEMINI_API_KEY);
        const systemPrompt = session.agent?.identity || 'You are a helpful assistant.';

        try {
            console.log(`🤖 Calling LLM for response...`);
            const result = await llmService.generateContent({
                model: session.agent?.model || 'gemini-2.0-flash',
                contents: session.conversationHistory,
                config: { systemInstruction: systemPrompt }
            });

            const agentResponse = result.text;
            console.log(`✅ Response generated: "${agentResponse.substring(0, 50)}..."`);

            // Add to history
            session.conversationHistory.push({
                role: 'model',
                parts: [{ text: agentResponse }]
            });

            // Generate TTS audio
            console.log(`🎙️ Generating TTS audio...`);
            let audioData;
            try {
                audioData = await generateTTS(
                    agentResponse,
                    session.voiceId,
                    process.env.SARVAM_API_KEY,
                    process.env.ELEVEN_LABS_API_KEY
                );
                if (audioData) {
                    console.log(`✅ TTS complete: ${audioData.length} bytes`);
                } else {
                    console.log(`⚠️ TTS returned no data, sending text-only response`);
                }
            } catch (ttsErr) {
                console.error('⚠️ TTS error:', ttsErr.message);
                audioData = null;
            }

            res.json({
                success: true,
                agentResponse,
                hasAudio: !!audioData,
                audioData: audioData ? audioData.toString('base64') : null
            });

        } catch (llmErr) {
            console.error('❌ LLM error:', llmErr.message);
            res.status(500).json({
                success: false,
                message: 'Failed to generate response',
                error: llmErr.message
            });
        }

    } catch (error) {
        console.error('❌ Error processing message:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to process message',
            error: error.message
        });
    }
});

// Get session info
router.get('/session/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const session = activeSessions.get(sessionId);

    if (!session) {
        return res.status(404).json({
            success: false,
            message: 'Session not found'
        });
    }

    res.json({
        success: true,
        sessionId,
        conversationHistory: session.conversationHistory,
        createdAt: session.createdAt,
        lastActivityAt: session.lastActivityAt
    });
});

// End session
router.post('/end-session', (req, res) => {
    const { sessionId } = req.body;
    
    if (activeSessions.has(sessionId)) {
        activeSessions.delete(sessionId);
        console.log(`\n🛑 Session ended: ${sessionId}`);
    }

    res.json({
        success: true,
        message: 'Session ended'
    });
});

// Helper function to generate TTS
async function generateTTS(text, voiceId, sarvamApiKey, elevenLabsApiKey) {
    if (!text || !text.trim()) return null;

    const provider = determineProvider(voiceId);
    console.log(`🎙️ TTS [${provider}]: "${text.substring(0, 50)}..."`);

    try {
        if (provider === 'elevenlabs') {
            return await elevenLabsTTS(text, voiceId, elevenLabsApiKey);
        } else {
            return await sarvamTTS(text, voiceId, sarvamApiKey);
        }
    } catch (err) {
        console.error(`⚠️ TTS error [${provider}]:`, err.message);
        return null; // Return null on error, not throw
    }
}

function determineProvider(voiceId) {
    if (!voiceId) return 'elevenlabs';
    const sarvamVoices = ['ananya', 'aditi', 'vidya', 'manisha', 'anushka', 'amartya',
        'arvind', 'abhilash', 'aarav', 'karun', 'dhruv', 'rohan', 'arya', 'hitesh', 'chitra'];
    if (voiceId.toLowerCase().includes('sarvam') || sarvamVoices.includes(voiceId.toLowerCase())) {
        return 'sarvam';
    }
    return 'elevenlabs';
}

async function elevenLabsTTS(text, voiceId, apiKey) {
    const fetch = require('node-fetch');
    
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`, {
        method: 'POST',
        headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': apiKey
        },
        body: JSON.stringify({
            text,
            model_id: 'eleven_turbo_v2_5',
            output_format: 'mp3_44100_128'
        })
    });

    if (!res.ok) {
        const err = await res.text().catch(() => res.statusText);
        throw new Error(`ElevenLabs ${res.status}: ${err}`);
    }

    const chunks = [];
    for await (const chunk of res.body) chunks.push(chunk);
    const audio = Buffer.concat(chunks);
    
    console.log(`✅ ElevenLabs TTS: ${audio.length} bytes`);
    return audio;
}

async function sarvamTTS(text, voiceId, apiKey) {
    const fetch = require('node-fetch');
    const speakerId = voiceId.replace(/^sarvam[:/]/i, '');

    const res = await fetch('https://api.sarvam.ai/text-to-speech', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'api-subscription-key': apiKey
        },
        body: JSON.stringify({
            inputs: [text],
            target_language_code: 'en-IN',
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

    console.log(`✅ Sarvam TTS complete`);
    return Buffer.from(data.audios[0], 'base64');
}

module.exports = router;
