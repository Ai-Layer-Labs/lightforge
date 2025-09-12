import { useEffect, useState } from 'react';
import { ExtensionAPI } from '../lib/api';

type SessionSummary = {
  session_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  is_archived?: boolean;
};

type Props = {
  onResume: (sessionId: string) => void;
};

export function Sessions({ onResume }: Props) {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [smokeStatus, setSmokeStatus] = useState<"idle"|"running"|"ok"|"failed">("idle");
  const [smokeMessage, setSmokeMessage] = useState<string>("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await ExtensionAPI.listSessions(1, 50);
      setSessions(res.sessions || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const runSmokeTest = async () => {
    setSmokeStatus("running");
    setSmokeMessage("");
    try {
      // Pick a supervisor if available, else fallback to orchestrator crew
      let options: any = {};
      try {
        const supervisors = await ExtensionAPI.getSupervisors();
        const first = supervisors[0];
        if (first?.id) options = { supervisor_id: first.id };
      } catch {}
      if (!options.supervisor_id) options = { crew_id: 'orchestrator' };

      // Create a fresh session
      const session = await ExtensionAPI.createSession('Smoke test');
      if (!session.id) throw new Error('No session_id returned');

      // Send a simple user message (non-stream)
      await ExtensionAPI.chat({
        session_id: session.id,
        messages: [{ role: 'user', content: 'hi' }],
        options,
      });

      setSmokeStatus("ok");
      setSmokeMessage(`OK: Session created successfully`);
      // Open it in chat
      onResume(session.id);
      // Refresh list
      load();
    } catch (e: any) {
      setSmokeStatus("failed");
      setSmokeMessage(e?.message || 'Smoke test failed');
    }
  };

  return (
            <div className="p-3 bg-gray-900 text-gray-200 min-w-0">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold">Sessions</div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="text-xs px-2 py-1 bg-gray-800 rounded border border-gray-700">Refresh</button>
          <button onClick={runSmokeTest} disabled={smokeStatus==='running'} className="text-xs px-2 py-1 bg-teal-600 text-black rounded disabled:opacity-50">
            {smokeStatus==='running' ? 'Testing…' : 'Run smoke test'}
          </button>
        </div>
      </div>
      {smokeStatus !== 'idle' && (
        <div className={`text-xs mb-2 ${smokeStatus==='ok' ? 'text-green-400' : smokeStatus==='failed' ? 'text-red-400' : 'text-gray-400'}`}>
          {smokeStatus==='running' ? 'Running smoke test…' : smokeMessage}
        </div>
      )}
      {loading ? (
        <div className="text-xs text-gray-400">Loading…</div>
      ) : error ? (
        <div className="text-xs text-red-400">{error}</div>
      ) : sessions.length === 0 ? (
        <div className="text-xs text-gray-400">No past sessions</div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-auto">
          {sessions.map(s => (
            <div key={s.session_id} className="p-2 rounded bg-gray-850 border border-gray-700 flex items-center justify-between">
              <div className="text-xs">
                <div className="text-gray-200 font-medium line-clamp-1">{s.title || s.session_id}</div>
                <div className="text-gray-500">{new Date(s.updated_at || s.created_at).toLocaleString()}</div>
              </div>
              <button onClick={() => onResume(s.session_id)} className="text-xs px-2 py-1 bg-teal-600 text-black rounded">Open</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


