import React from 'react';
import { useSimpleVoice } from '../hooks/useSimpleVoice';

export const SimpleVoiceTest: React.FC = () => {
    const [error, setError] = React.useState<string>('');
    const [lastTranscript, setLastTranscript] = React.useState<string>('');

    const { isListening, isTranscribing, transcript, startListening, stopListening } = useSimpleVoice({
        onTranscript: (text) => {
            setLastTranscript(text);
            setError('');
        },
        onError: (err) => {
            setError(err);
        }
    });

    return (
        <div className="w-full max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg">
            <h1 className="text-2xl font-bold mb-6 text-center">🎤 Simple Voice Test</h1>

            {/* Status */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                    <div
                        className={`w-4 h-4 rounded-full ${
                            isListening ? 'bg-red-500 animate-pulse' : 'bg-gray-300'
                        }`}
                    />
                    <span className="text-sm font-semibold">
                        {isListening ? 'Listening...' : 'Ready'}
                    </span>
                </div>

                {isTranscribing && (
                    <div className="flex items-center gap-2 text-blue-600">
                        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm">Transcribing...</span>
                    </div>
                )}
            </div>

            {/* Buttons */}
            <div className="flex gap-2 mb-6">
                <button
                    onClick={startListening}
                    disabled={isListening || isTranscribing}
                    className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 transition-colors font-semibold"
                >
                    🎤 Start
                </button>

                <button
                    onClick={stopListening}
                    disabled={!isListening || isTranscribing}
                    className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:bg-gray-400 transition-colors font-semibold"
                >
                    ⏹️ Stop & Transcribe
                </button>
            </div>

            {/* Error */}
            {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700">❌ {error}</p>
                </div>
            )}

            {/* Transcript */}
            {lastTranscript && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-xs font-semibold text-green-700 mb-2">Transcript:</p>
                    <p className="text-sm text-gray-800">{lastTranscript}</p>
                </div>
            )}

            {/* Current Transcript (while recording) */}
            {isListening && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs font-semibold text-blue-700 mb-2">Recording...</p>
                    <p className="text-sm text-gray-600">Speak now. Click "Stop & Transcribe" when done.</p>
                </div>
            )}
        </div>
    );
};
