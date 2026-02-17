import React, { useState } from 'react';

interface CreateCampaignModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (campaign: any) => void;
}

const CreateCampaignModal: React.FC<CreateCampaignModalProps> = ({ isOpen, onClose, onSave }) => {
    const [name, setName] = useState('');
    const [agent, setAgent] = useState('Agent Alpha');
    const [concurrentCalls, setConcurrentCalls] = useState(2);
    const [retryAttempts, setRetryAttempts] = useState(3);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ name, agent, concurrentCalls, retryAttempts });
        onClose();
        setName(''); // Reset
    };

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 p-8 rounded-[40px] w-full max-w-lg shadow-[0_20px_50px_rgba(0,0,0,0.3)] relative card-animate">
                <button
                    onClick={onClose}
                    className="absolute top-8 right-8 p-2 rounded-2xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-white transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-600"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M16 8L8 16M8 8l8 8" /></svg>
                </button>

                <div className="mb-8">
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white leading-tight">Create Campaign</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 font-bold uppercase tracking-widest opacity-60">Configure your outreach strategy</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="group">
                        <label className="block text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-2 px-1">
                            Campaign Name
                        </label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Real Estate Q1 Outreach"
                            className="w-full bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-100 dark:border-slate-700 rounded-2xl px-5 py-4 text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-bold"
                        />
                    </div>

                    <div className="group">
                        <label className="block text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-2 px-1">
                            Select AI Agent
                        </label>
                        <select
                            value={agent}
                            onChange={(e) => setAgent(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-100 dark:border-slate-700 rounded-2xl px-5 py-4 text-sm text-slate-900 dark:text-white outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-bold appearance-none cursor-pointer"
                        >
                            <option>Agent Alpha (Friendly Sales)</option>
                            <option>Agent Betty (Professional Tech)</option>
                            <option>Agent Charlie (Direct & Clear)</option>
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="group">
                            <label className="block text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-2 px-1">
                                Concurrent Calls
                            </label>
                            <input
                                type="number"
                                min="1"
                                max="50"
                                value={concurrentCalls}
                                onChange={(e) => setConcurrentCalls(parseInt(e.target.value))}
                                className="w-full bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-100 dark:border-slate-700 rounded-2xl px-5 py-4 text-sm text-slate-900 dark:text-white outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-black"
                            />
                        </div>
                        <div className="group">
                            <label className="block text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-2 px-1">
                                Retry Attempts
                            </label>
                            <input
                                type="number"
                                min="0"
                                max="5"
                                value={retryAttempts}
                                onChange={(e) => setRetryAttempts(parseInt(e.target.value))}
                                className="w-full bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-100 dark:border-slate-700 rounded-2xl px-5 py-4 text-sm text-slate-900 dark:text-white outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-black"
                            />
                        </div>
                    </div>

                    <div className="flex gap-4 pt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-8 py-4 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-white rounded-2xl font-black transition-all transform active:scale-95 text-sm uppercase tracking-wider"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-8 py-4 bg-primary hover:bg-primary-dark text-white rounded-2xl font-black shadow-2xl shadow-primary/30 transition-all transform active:scale-95 hover:scale-[1.02] text-sm uppercase tracking-wider"
                        >
                            Save Campaign
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateCampaignModal;
