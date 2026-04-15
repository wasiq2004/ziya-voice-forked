import React, { useState } from 'react';
import { useBrowserVoiceREST } from '../hooks/useBrowserVoiceREST';

interface SimplifiedVoiceCallProps {
    agentId: string;
    userId: string;
    voiceId: string;
    identity: string;
}

export const SimplifiedVoiceCall: React.FC<SimplifiedVoiceCallProps> = ({
    agentId,
    userId,
    voiceId,
    identity
}) => {
    const [userMessage, setUserMessage] = useState('');
    const [messages, setMessages] = useState<Array<{ role: 'user' | 'agent'; text: string }>>([]);
    const [isPlayingAudio, setIsPlayingAudio] = useState(false);

    const {
        isActive,
        isLoading,
        startSession,
        sendMessage,
        stopSession
    } = useBrowserVoiceREST({
        agentId,
        userId,
        voiceId,
        identity,
        onResponse: (agentResponse, audioData) => {
            // Add agent response to messages
            setMessages(prev => [...prev, { role: 'agent', text: agentResponse }]);

            // Play audio if available
            if (audioData) {
                playAudio(audioData);
            }
        },
        onError: (error) => {
            alert(`Error: ${error}`);
        }
    });

    const playAudio = (base64Audio: string) => {
        try {
            setIsPlayingAudio(true);
            const audioSrc = `data:audio/mpeg;base64,${base64Audio}`;
            const audio = new Audio(audioSrc);

            audio.onended = () => {
                setIsPlayingAudio(false);
            };

            audio.play().catch(err => {
                console.error('Failed to play audio:', err);
                setIsPlayingAudio(false);
            });
        } catch (error) {
            console.error('Error preparing audio:', error);
            setIsPlayingAudio(false);
        }
    };

    const handleStartCall = async () => {
        await startSession();
        setMessages([]);
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!userMessage.trim() || !isActive || isLoading) return;

        // Add user message to display
        setMessages(prev => [...prev, { role: 'user', text: userMessage }]);

        // Send to server
        await sendMessage(userMessage);
        setUserMessage('');
    };

    return (
        <div className="w-full max-w-2xl mx-auto p-6 bg-white rounded-xl shadow-lg">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Voice Assistant</h2>
                <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
                    <span className="text-sm text-gray-600">
                        {isActive ? 'Call Active' : 'Call Inactive'}
                    </span>
                </div>
            </div>

            {/* Messages Display */}
            <div className="bg-gray-50 rounded-lg p-4 h-64 overflow-y-auto mb-4 border border-gray-200">
                {messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-400">
                        <p>No messages yet. Start a call to begin.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {messages.map((msg, idx) => (
                            <div
                                key={idx}
                                className={`p-3 rounded-lg ${
                                    msg.role === 'user'
                                        ? 'bg-blue-100 text-blue-900 ml-8'
                                        : 'bg-green-100 text-green-900 mr-8'
                                }`}
                            >
                                <p className="text-sm font-semibold mb-1">
                                    {msg.role === 'user' ? 'You' : 'Agent'}
                                </p>
                                <p className="text-sm">{msg.text}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Input Area */}
            <form onSubmit={handleSendMessage} className="space-y-3">
                <textarea
                    value={userMessage}
                    onChange={(e) => setUserMessage(e.target.value)}
                    placeholder="Type your message..."
                    disabled={!isActive || isLoading}
                    className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    rows={3}
                />

                <div className="flex gap-2">
                    {!isActive ? (
                        <button
                            onClick={handleStartCall}
                            disabled={isLoading}
                            className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-400 transition-colors flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Starting...
                                </>
                            ) : (
                                <>
                                    🎙️ Start Voice Call
                                </>
                            )}
                        </button>
                    ) : (
                        <>
                            <button
                                type="submit"
                                disabled={!userMessage.trim() || isLoading || isPlayingAudio}
                                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 transition-colors"
                            >
                                {isLoading ? 'Sending...' : 'Send Message'}
                            </button>
                            <button
                                onClick={stopSession}
                                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                            >
                                End Call
                            </button>
                        </>
                    )}
                </div>

                {isPlayingAudio && (
                    <div className="text-sm text-gray-600 flex items-center gap-2">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        Playing audio response...
                    </div>
                )}
            </form>
        </div>
    );
};
