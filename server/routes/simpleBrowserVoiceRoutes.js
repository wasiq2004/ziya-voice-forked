const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const FormData = require('form-data');

// Simple endpoint: convert audio to text using Sarvam STT
router.post('/transcribe', async (req, res) => {
    try {
        const { audio } = req.body;

        if (!audio) {
            return res.status(400).json({
                success: false,
                message: 'No audio data provided'
            });
        }

        console.log(`\n📝 Transcribing audio...`);

        // Convert base64 to buffer
        const audioBuffer = Buffer.from(audio, 'base64');
        console.log(`📊 Audio size: ${audioBuffer.length} bytes`);

        // Send to Sarvam STT API using multipart form-data
        const sarvamApiKey = process.env.SARVAM_API_KEY;
        if (!sarvamApiKey) {
            return res.status(500).json({
                success: false,
                message: 'Sarvam API key not configured'
            });
        }

        // Create FormData with the audio file
        const formData = new FormData();
        formData.append('file', audioBuffer, { filename: 'audio.wav' });

        const sarvamResponse = await fetch('https://api.sarvam.ai/speech-to-text', {
            method: 'POST',
            headers: {
                ...formData.getHeaders(),
                'api-subscription-key': sarvamApiKey
            },
            body: formData
        });

        if (!sarvamResponse.ok) {
            const err = await sarvamResponse.text();
            console.error(`❌ Sarvam error ${sarvamResponse.status}:`, err);
            return res.status(500).json({
                success: false,
                message: `Sarvam STT failed: ${sarvamResponse.statusText}`
            });
        }

        const result = await sarvamResponse.json();
        console.log(`✅ Transcript: "${result.transcript}"`);

        res.json({
            success: true,
            transcript: result.transcript || '',
            language: result.language_code || 'en-IN'
        });

    } catch (error) {
        console.error('❌ Transcribe error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to transcribe audio',
            error: error.message
        });
    }
});

// TTS endpoint: convert text to speech using Sarvam
router.post('/tts-sarvam', async (req, res) => {
    try {
        const { text, voiceId, language = 'en-IN' } = req.body;

        if (!text) {
            return res.status(400).json({
                success: false,
                message: 'No text provided'
            });
        }

        console.log(`\n🔊 Converting to speech (Sarvam): "${text.substring(0, 50)}..."`);

        // Get Sarvam API key
        const sarvamApiKey = process.env.SARVAM_API_KEY;
        if (!sarvamApiKey) {
            return res.status(500).json({
                success: false,
                message: 'Sarvam API key not configured'
            });
        }

        // Send to Sarvam TTS API
        const sarvamResponse = await fetch('https://api.sarvam.ai/text-to-speech', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-subscription-key': sarvamApiKey
            },
            body: JSON.stringify({
                inputs: [{ text }],
                target_language_code: language,
                speaker: voiceId || 'default',
                pitch: 1.0,
                pace: 1.0,
                loudness: 1.5
            })
        });

        if (!sarvamResponse.ok) {
            const err = await sarvamResponse.text();
            console.error(`❌ Sarvam TTS error ${sarvamResponse.status}:`, err);
            return res.status(500).json({
                success: false,
                message: `Sarvam TTS failed: ${sarvamResponse.statusText}`,
                error: err
            });
        }

        const result = await sarvamResponse.json();
        console.log(`✅ TTS generated successfully`);

        // Sarvam returns audio in base64
        res.json({
            success: true,
            audio: result.audios?.[0] || result.audio,
            mimeType: 'audio/wav'
        });

    } catch (error) {
        console.error('❌ TTS error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to convert text to speech',
            error: error.message
        });
    }
});

module.exports = router;
