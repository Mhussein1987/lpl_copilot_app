import { useState } from 'react';
import Head from 'next/head';

const mockStatements = {
  'John Doe': 'https://example.com/statements/john-doe-statement.pdf',
  'Jane Smith': 'https://example.com/statements/jane-smith-statement.pdf',
};

const mockHistory = {
  'John Doe': [
    'Client called on Monday about a transfer delay.',
    'Requested a status update on Wednesday.',
    'Now requesting escalation due to inactivity.',
  ],
  'Jane Smith': [
    'Client inquired about tax documents.',
    'Asked for 2023 and 2024 statements.',
  ],
};

const MODES = ['Client', 'Agent Assist', 'RAG Q&A', 'ChatGPT API'];

export default function Home() {
  // UI State
  const [mode, setMode] = useState('Client');
  const [user, setUser] = useState('None');
  const [messages, setMessages] = useState([]);
  const [chatgptMessages, setChatgptMessages] = useState([]);
  const [question, setQuestion] = useState('');
  const [ragAnswer, setRagAnswer] = useState('');
  const [uploadedText, setUploadedText] = useState('');
  const [ragChunks, setRagChunks] = useState([]);
  const [loading, setLoading] = useState(false);

  // Sidebar
  const Sidebar = () => (
    <aside className="sidebar">
      <img src="/logo.png" width={84} alt="Logo" className="logo" />
      <h2>Settings</h2>
      <div className="sidebar-section">
        <label>Mode:</label>
        <select value={mode} onChange={e => setMode(e.target.value)}>
          {MODES.map(m => <option key={m}>{m}</option>)}
        </select>
      </div>
      <div className="sidebar-section">
        <label>Login as:</label>
        <select value={user} onChange={e => setUser(e.target.value)}>
          <option>None</option>
          {Object.keys(mockStatements).map(u => <option key={u}>{u}</option>)}
        </select>
      </div>
      <div className="sidebar-section user-status">🔐 <span>Logged in:</span> <b>{user !== 'None' ? user : 'No user'}</b></div>
    </aside>
  );

  // Chat message display
  const ChatMessages = ({ msgs }) => (
    <div className="chat-messages">
      {msgs.map((msg, i) => (
        <div key={i} className={`chat-message ${msg.role}`}>{msg.content}</div>
      ))}
    </div>
  );

  // Client mode logic
  const handleClientQuery = async (query) => {
    setMessages(msgs => [...msgs, { role: 'user', content: query }]);
    let response = '';
    if (query.toLowerCase().includes('statement')) {
      if (user !== 'None' && mockStatements[user]) {
        response = `Here’s your latest statement: <a href="${mockStatements[user]}" target="_blank">Download PDF</a>`;
      } else {
        response = 'Please log in to access your account statement.';
      }
    } else {
      // Call OpenAI API route
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: 'You are a helpful financial assistant.' },
            { role: 'user', content: query },
          ],
        }),
      });
      const data = await res.json();
      response = data.result || 'No response.';
    }
    setMessages(msgs => [...msgs, { role: 'assistant', content: response }]);
  };

  // Agent Assist mode logic
  const handleAgentAssist = async () => {
    if (user === 'None' || !mockStatements[user]) return;
    const history = mockHistory[user] || [];
    const summaryPrompt = `Summarize this client history and suggest a professional, empathetic response:\n${history.join('\n')}`;
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: 'You are a customer service expert.' },
          { role: 'user', content: summaryPrompt },
        ],
      }),
    });
    const data = await res.json();
    setMessages([{ role: 'assistant', content: data.result || 'No response.' }]);
  };

  // RAG Q&A mode logic (mocked, no embeddings)
  const handleRagProcess = (text) => {
    const chunks = [];
    for (let i = 0; i < text.length; i += 500) {
      chunks.push(text.slice(i, i + 500));
    }
    setRagChunks(chunks);
    setUploadedText(text);
  };
  const handleRagQuestion = async () => {
    if (!question || ragChunks.length === 0) return;
    // For demo, just concatenate chunks as context
    const context = ragChunks.slice(0, 3).join('\n');
    const answerPrompt = `Use the following information to answer the question:\n${context}\n\nQuestion: ${question}`;
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: 'You are an expert assistant extracting policy answers.' },
          { role: 'user', content: answerPrompt },
        ],
      }),
    });
    const data = await res.json();
    setRagAnswer(data.result || 'No answer.');
  };

  // ChatGPT API mode logic
  const handleChatGpt = async (input) => {
    setChatgptMessages(msgs => [...msgs, { role: 'user', content: input }]);
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'user', content: input },
        ],
      }),
    });
    const data = await res.json();
    setChatgptMessages(msgs => [...msgs, { role: 'assistant', content: data.result || 'No response.' }]);
  };

  return (
    <>
      <Head>
        <title>LPL Co-Pilot Chatbot</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet" />
      </Head>
      <div className="container">
        <Sidebar />
        <main>
          <header className="header">
            <h1>LPL Co-Pilot <span className="highlight">Chatbot</span></h1>
            <p className="subtitle">Hi, I’m your Co-Pilot! How can I help you today?</p>
          </header>

          {/* Mode UI */}
          {mode === 'Client' && (
            <section className="mode-section">
              <h2>Client Self-Service</h2>
              <ChatMessages msgs={messages} />
              <form className="chat-form" onSubmit={e => { e.preventDefault(); handleClientQuery(e.target.query.value); e.target.reset(); }}>
                <input name="query" placeholder="Ask something (e.g., 'get my latest statement')" required autoComplete="off" />
                <button type="submit" disabled={loading}>{loading ? 'Sending...' : 'Send'}</button>
              </form>
            </section>
          )}

          {mode === 'Agent Assist' && (
            <section className="mode-section">
              <h2>Agent Assist Mode</h2>
              {user !== 'None' && mockStatements[user] ? (
                <>
                  <h3>🗃 Client History</h3>
                  <ul className="history-list">
                    {(mockHistory[user] || []).map((line, i) => <li key={i}>{line}</li>)}
                  </ul>
                  <button className="primary-btn" onClick={handleAgentAssist} disabled={loading}>{loading ? 'Summarizing...' : 'Summarize History & Suggest Reply'}</button>
                  <ChatMessages msgs={messages} />
                </>
              ) : <div className="info-box">Please log in as a client to view their interaction history.</div>}
            </section>
          )}

          {mode === 'RAG Q&A' && (
            <section className="mode-section">
              <h2>RAG: Ask Questions from Uploaded Documents</h2>
              <textarea rows={4} placeholder="Paste document text here..." onChange={e => handleRagProcess(e.target.value)} className="doc-textarea" />
              <div className="rag-row">
                <input value={question} onChange={e => setQuestion(e.target.value)} placeholder="Ask a question based on the document" className="rag-input" />
                <button className="primary-btn" onClick={handleRagQuestion} disabled={loading}>{loading ? 'Asking...' : 'Ask'}</button>
              </div>
              {ragAnswer && <div className="answer-box"><strong>💡 Answer:</strong> {ragAnswer}</div>}
            </section>
          )}

          {mode === 'ChatGPT API' && (
            <section className="mode-section">
              <h2>ChatGPT API Playground</h2>
              <ChatMessages msgs={chatgptMessages} />
              <form className="chat-form" onSubmit={e => { e.preventDefault(); handleChatGpt(e.target.input.value); e.target.reset(); }}>
                <input name="input" placeholder="Ask ChatGPT anything..." required autoComplete="off" />
                <button type="submit" disabled={loading}>{loading ? 'Sending...' : 'Send'}</button>
              </form>
            </section>
          )}
        </main>
      </div>
      <style jsx global>{`
        html, body { font-family: 'Inter', sans-serif; background: #f4f6fa; margin: 0; padding: 0; }
        .container { display: flex; min-height: 100vh; }
        .sidebar { min-width: 240px; background: #fff; padding: 2rem 1.5rem; box-shadow: 2px 0 8px #e0e0e0; display: flex; flex-direction: column; align-items: flex-start; }
        .logo { border-radius: 12px; margin-bottom: 1rem; }
        .sidebar-section { margin-bottom: 1.5rem; width: 100%; }
        .sidebar select { width: 100%; padding: 0.5rem; border-radius: 6px; border: 1px solid #d0d0d0; }
        .user-status { font-size: 1rem; color: #1976d2; }
        main { flex: 1; padding: 2.5rem 3vw; }
        .header { margin-bottom: 2rem; }
        .highlight { color: #1976d2; }
        .subtitle { color: #555; font-size: 1.1rem; margin-top: 0.5rem; }
        .mode-section { background: #fff; border-radius: 12px; box-shadow: 0 2px 12px #e0e0e0; padding: 2rem; margin-bottom: 2rem; }
        .chat-messages { margin-bottom: 1.5rem; }
        .chat-message { padding: 0.7rem 1rem; border-radius: 8px; margin-bottom: 0.5rem; max-width: 80%; word-break: break-word; direction: ltr; text-align: left; }
        .chat-message.user { background: #e3f0fc; color: #1976d2; margin-left: auto; }
        .chat-message.assistant { background: #f0f0f0; color: #333; margin-right: auto; }
        .chat-form { display: flex; gap: 0.5rem; margin-top: 1rem; }
        .chat-form input { flex: 1; padding: 0.7rem; font-size: 1rem; border-radius: 8px; border: 1px solid #d0d0d0; }
        .chat-form button { padding: 0.7rem 1.5rem; border-radius: 8px; background: #1976d2; color: #fff; border: none; font-weight: 600; cursor: pointer; transition: background 0.2s; }
        .chat-form button:disabled { background: #b0c4de; cursor: not-allowed; }
        .primary-btn { padding: 0.7rem 1.5rem; border-radius: 8px; background: #1976d2; color: #fff; border: none; font-weight: 600; cursor: pointer; margin-top: 1rem; transition: background 0.2s; }
        .primary-btn:disabled { background: #b0c4de; cursor: not-allowed; }
        .info-box { background: #f9f9f9; border-left: 4px solid #1976d2; padding: 1rem; border-radius: 8px; color: #555; margin-top: 1rem; }
        .history-list { margin: 1rem 0 2rem 0; padding-left: 1.2rem; color: #333; }
        .doc-textarea { width: 100%; padding: 0.7rem; border-radius: 8px; border: 1px solid #d0d0d0; margin-bottom: 1rem; font-size: 1rem; }
        .rag-row { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
        .rag-input { flex: 1; padding: 0.7rem; border-radius: 8px; border: 1px solid #d0d0d0; }
        .answer-box { background: #e3f0fc; border-left: 4px solid #1976d2; padding: 1rem; border-radius: 8px; color: #1976d2; font-size: 1.1rem; margin-top: 1rem; }
        @media (max-width: 900px) {
          .container { flex-direction: column; }
          .sidebar { width: 100vw; min-width: 0; flex-direction: row; align-items: center; justify-content: space-between; padding: 1rem; box-shadow: none; }
          main { padding: 1rem; }
        }
        @media (max-width: 600px) {
          .container { flex-direction: column; }
          .sidebar { width: 100vw; min-width: 0; flex-direction: column; align-items: flex-start; padding: 1rem; }
          main { padding: 0.5rem; }
          .mode-section { padding: 1rem; }
        }
      `}</style>
    </>
  );
}
