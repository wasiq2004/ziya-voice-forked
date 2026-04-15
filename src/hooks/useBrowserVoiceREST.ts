import { useRef, useState, useCallback } from 'react';

interface BrowserVoiceRESTProps {
    agentId: string;
    userId: string;
    voiceId: string;
    identity: string;
    onTranscript?: (text: string) => void;
    onResponse?: (text: string, audio?: string) => void;
    onError?: (error: string) => void;
}

export const useBrowserVoiceREST = ({
    agentId,
    userId,
    voiceId,
    identity,
    onTranscript,
    onResponse,
    onError
}: BrowserVoiceRESTProps) => {
    const [isActive, setIsActive] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const sessionIdRef = useRef<string | null>(null);
    const microphoneStreamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);

    const getApiBaseUrl = () => {
        return process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
    };

    // Start a new browser voice session
    const startSession = useCallback(async () => {
        try {
            console.log('🎬 Starting browser voice REST session...');
            setIsLoading(true);

            const response = await fetch(`${getApiBaseUrl()}/browser-voice-rest/start-session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    voiceId,
                    agentId,
                    userId,
                    identity: encodeURIComponent(identity)
                })
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.message || 'Failed to start session');
            }

            sessionIdRef.current = data.sessionId;
            console.log(`✅ Session started: ${data.sessionId}`);

            // Request microphone access
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    }
                });
                microphoneStreamRef.current = stream;

                // Set up audio context for recording
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
                    sampleRate: 16000
                });

                const source = audioContextRef.current.createMediaStreamSource(stream);
                scriptProcessorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);

                source.connect(scriptProcessorRef.current);
                scriptProcessorRef.current.connect(audioContextRef.current.destination);

                console.log('🎤 Microphone initialized');
            } catch (err) {
                console.error('❌ Microphone access denied:', err);
                throw new Error('Microphone access required for voice calls');
            }

            setIsActive(true);
            setIsLoading(false);

        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            console.error('❌ Failed to start session:', errorMsg);
            onError?.(errorMsg);
            setIsLoading(false);
        }
    }, [agentId, userId, voiceId, identity, getApiBaseUrl, onError]);

    // Send a message and get response
    const sendMessage = useCallback(async (userMessage: string) => {
        if (!sessionIdRef.current) {
            console.error('❌ No active session');
            return;
        }

        try {
            setIsLoading(true);
            console.log(`💬 Sending message: "${userMessage}"`);

            const response = await fetch(`${getApiBaseUrl()}/browser-voice-rest/send-message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: sessionIdRef.current,
                    userMessage
                })
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.message || 'Failed to send message');
            }

            console.log(`✅ Response received: "${data.agentResponse.substring(0, 50)}..."`);
            onResponse?.(data.agentResponse, data.audioData || undefined);

            setIsLoading(false);

        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            console.error('❌ Error sending message:', errorMsg);
            onError?.(errorMsg);
            setIsLoading(false);
        }
    }, [getApiBaseUrl, onResponse, onError]);

    // Stop the session
    const stopSession = useCallback(async () => {
        if (!sessionIdRef.current) return;

        try {
            console.log('🛑 Stopping session...');

            // Stop microphone
            if (microphoneStreamRef.current) {
                microphoneStreamRef.current.getTracks().forEach(track => track.stop());
                microphoneStreamRef.current = null;
            }

            // Close audio context
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                await audioContextRef.current.close();
                audioContextRef.current = null;
            }

            // Disconnect script processor
            if (scriptProcessorRef.current) {
                scriptProcessorRef.current.disconnect();
                scriptProcessorRef.current = null;
            }

            // End session on server
            await fetch(`${getApiBaseUrl()}/browser-voice-rest/end-session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: sessionIdRef.current })
            }).catch(err => console.error('Warning: Failed to end session on server:', err));

            sessionIdRef.current = null;
            setIsActive(false);
            console.log('✅ Session stopped');

        } catch (error) {
            console.error('❌ Error stopping session:', error);
        }
    }, [getApiBaseUrl]);

    return {
        isActive,
        isLoading,
        sessionId: sessionIdRef.current,
        startSession,
        sendMessage,
        stopSession
    };
};
