import { Bug, ChevronUp, ChevronDown } from 'lucide-react';

interface ScanDebugPanelProps {
    debugData: Record<string, any>;
    debugOpen: boolean;
    onToggleDebug: () => void;
}

export default function ScanDebugPanel({ debugData, debugOpen, onToggleDebug }: ScanDebugPanelProps) {
    return (
        <div className="mt-6 backdrop-blur-md bg-gray-900/95 rounded-3xl shadow-glass overflow-hidden text-left">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
                <button
                    onClick={onToggleDebug}
                    className="flex items-center justify-between flex-1 text-gray-300 hover:text-white transition-colors"
                >
                    <span className="flex items-center gap-2 text-sm font-mono">
                        <Bug className="w-4 h-4 text-yellow-400" />
                        Debug Panel
                        <span className="text-xs text-gray-500">(?debug=1)</span>
                    </span>
                    {debugOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {debugOpen && (
                    <button
                        className="ml-4 px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-mono rounded-md border border-gray-700 transition"
                        onClick={(e) => {
                            e.preventDefault();
                            navigator.clipboard.writeText(JSON.stringify(debugData, null, 2));
                            const btn = e.currentTarget;
                            btn.innerText = 'Copied!';
                            setTimeout(() => { if(btn) btn.innerText = 'Copy Data' }, 2000);
                        }}
                    >
                        Copy Data
                    </button>
                )}
            </div>
            {debugOpen && (
                <div className="px-5 pb-5 pt-3 space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                        {Object.entries(debugData.timings || {}).map(([key, val]) => (
                            <div key={key} className="flex justify-between bg-gray-800 rounded-lg px-3 py-2">
                                <span className="text-gray-400">{key}</span>
                                <span className="text-green-400">{String(val)}ms</span>
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-2 text-xs font-mono flex-wrap">
                        <span className="bg-blue-900/50 text-blue-300 px-2 py-1 rounded">model: {debugData.modelUsed}</span>
                        <span className="bg-purple-900/50 text-purple-300 px-2 py-1 rounded">mode: {debugData.scanMode}</span>
                        {debugData.requestId && <span className="bg-purple-900/50 text-purple-300 px-2 py-1 rounded">reqId: {debugData.requestId}</span>}
                        <span className="bg-amber-900/50 text-amber-300 px-2 py-1 rounded">conf: {debugData.confidence}%</span>
                        <span className="bg-emerald-900/50 text-emerald-300 px-2 py-1 rounded">score: {debugData.overallScore}/100</span>
                    </div>
                    <details className="text-xs" open={!!debugData.failedJson}>
                        <summary className={`cursor-pointer font-mono ${debugData.failedJson ? 'text-red-400 hover:text-red-300 font-bold' : 'text-gray-400 hover:text-gray-200'}`}>
                            {debugData.failedJson ? 'Failed AI Response (JSON parse/validation error)' : 'Raw AI Response JSON'}
                        </summary>
                        <pre className={`mt-2 rounded-xl p-3 overflow-x-auto max-h-80 overflow-y-auto font-mono text-[10px] leading-relaxed ${debugData.failedJson ? 'bg-red-950/50 text-red-200 border border-red-900/50' : 'bg-gray-800 text-gray-300'}`}>
                            {debugData.failedJson || JSON.stringify(debugData.rawResult, null, 2)}
                        </pre>
                    </details>
                </div>
            )}
        </div>
    );
}
