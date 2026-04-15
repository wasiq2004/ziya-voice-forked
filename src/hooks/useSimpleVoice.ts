import { useRef, useState, useCallback } from 'react';

interface UseSimpleVoiceProps {
    onTranscript?: (text: string) => void;
    onError?: (error: string) => void;
}

export const useSimpleVoice = ({ onTranscript, onError }: UseSimpleVoiceProps) => {
    const [isListening, setIsListening] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [transcript, setTranscript] = useState('');

    const audioContextRef = useRef<AudioContext | null>(null);
    const micStreamRef = useRef<MediaStream | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const audioChunksRef = useRef<Float32Array[]>([]);

    // Start listening to microphone
    const startListening = useCallback(async () => {
        try {
            console.log('🎤 Starting microphone...');

            // Request microphone access
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            micStreamRef.current = stream;
            audioChunksRef.current = [];

            // Create audio context
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
                sampleRate: 16000 // Sarvam requires 16kHz
            });
            audioContextRef.current = audioContext;

            // Create source from microphone
            const source = audioContext.createMediaStreamSource(stream);

            // Create processor node to capture audio
            const processor = audioContext.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            // Capture audio data
            processor.onaudioprocess = (event) => {
                const inputData = event.inputBuffer.getChannelData(0);
                // Store a copy of the audio data
                audioChunksRef.current.push(new Float32Array(inputData));
            };

            source.connect(processor);
            processor.connect(audioContext.destination);

            setIsListening(true);
            console.log('✅ Microphone active, recording audio...');

        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Microphone access denied';
            console.error('❌ Microphone error:', errorMsg);
            onError?.(errorMsg);
        }
    }, [onError]);

    // Stop listening and send audio to Sarvam for transcription
    const stopListening = useCallback(async () => {
        try {
            console.log('🛑 Stopping microphone...');

            if (isTranscribing) {
                console.warn('⏳ Already transcribing, please wait...');
                return;
            }

            // Stop microphone
            if (micStreamRef.current) {
                micStreamRef.current.getTracks().forEach(track => track.stop());
                micStreamRef.current = null;
            }

            if (processorRef.current) {
                processorRef.current.onaudioprocess = null;
                processorRef.current.disconnect();
            }

            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                await audioContextRef.current.close();
                audioContextRef.current = null;
            }

            setIsListening(false);

            // Convert audio chunks to PCM
            const chunks = audioChunksRef.current;
            if (chunks.length === 0) {
                console.warn('⚠️ No audio recorded');
                return;
            }

            console.log(`📦 Converting ${chunks.length} audio chunks to PCM...`);
            const pcmData = concatFloat32(chunks);
            const wavData = floatToWav(pcmData, 16000);
            const base64Audio = Buffer.from(wavData).toString('base64');

            console.log(`📤 Sending ${base64Audio.length} bytes to Sarvam...`);
            setIsTranscribing(true);

            // Send to backend
            const response = await fetch('/api/simple-voice/transcribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ audioData: base64Audio })
            });

            const result = await response.json();

            if (result.success) {
                console.log(`✅ Transcript: "${result.transcript}"`);
                setTranscript(result.transcript);
                onTranscript?.(result.transcript);
            } else {
                throw new Error(result.message || 'Transcription failed');
            }

            setIsTranscribing(false);

        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Transcription error';
            console.error('❌ Error:', errorMsg);
            onError?.(errorMsg);
            setIsTranscribing(false);
        }
    }, [onTranscript, onError, isTranscribing]);

    return {
        isListening,
        isTranscribing,
        transcript,
        startListening,
        stopListening
    };
};

// Helper: Concatenate Float32Arrays
function concatFloat32(arrays: Float32Array[]): Float32Array {
    const totalLength = arrays.reduce((acc, arr) => acc + arr.length, 0);
    const result = new Float32Array(totalLength);
    let offset = 0;
    for (const arr of arrays) {
        result.set(arr, offset);
        offset += arr.length;
    }
    return result;
}

// Helper: Convert Float32 to WAV format
function floatToWav(floatData: Float32Array, sampleRate: number): Uint8Array {
    const pcm16 = new Int16Array(floatData.length);
    for (let i = 0; i < floatData.length; i++) {
        const s = Math.max(-1, Math.min(1, floatData[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    const channels = 1;
    const bytesPerSample = 2;

    const buffer = new ArrayBuffer(44 + pcm16.byteLength);
    const view = new DataView(buffer);

    // WAV header
    const writeString = (offset: number, string: string) => {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + pcm16.byteLength, true);
    writeString(8, 'WAVE');

    // fmt chunk
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // chunkSize
    view.setUint16(20, 1, true); // format (PCM)
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * channels * bytesPerSample, true);
    view.setUint16(32, channels * bytesPerSample, true);
    view.setUint16(34, 16, true); // bits per sample

    // data chunk
    writeString(36, 'data');
    view.setUint32(40, pcm16.byteLength, true);

    // Copy PCM data
    const pcmView = new Int16Array(buffer, 44);
    pcmView.set(pcm16);

    return new Uint8Array(buffer);
}
