import { useEffect, useState } from 'react';
import './styles.css';

const storedToken = () => localStorage.getItem('auth_token');

async function api(path, options = {}) {
  const response = await fetch(path, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

function taskDetails(content) {
  const section = (name) => {
    const match = content.match(new RegExp(`\\*\\*${name}:\\*\\*\\s*([\\s\\S]*?)(?=\\n\\s*\\*\\*|$)`, 'i'));
    return match?.[1]?.trim() || '';
  };
  const description = section('Description');
  return {
    title: section('Task Title') || 'Generated task',
    description: description.replace(/^[-*]\s*/gm, '').split('\n').filter(Boolean),
    priority: section('Priority') || 'Not set',
    dueDate: section('Due Date Note') || 'No due date provided',
  };
}

function TaskResult({ content }) {
  const [copied, setCopied] = useState(false);
  const task = taskDetails(content);
  async function copyTask() {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }
  return <article className="task-result" aria-live="polite">
    <div className="result-topline"><span className="result-kicker">AI GENERATED TASK</span><button className="quiet-button" type="button" onClick={copyTask}>{copied ? 'Copied' : 'Copy task'}</button></div>
    <h3>{task.title}</h3>
    {task.description.length > 0 && <ul className="task-list">{task.description.map((item) => <li key={item}>{item}</li>)}</ul>}
    <div className="task-meta"><div><span>PRIORITY</span><strong className={`priority ${task.priority.toLowerCase()}`}>{task.priority}</strong></div><div><span>DUE DATE</span><strong>{task.dueDate}</strong></div></div>
  </article>;
}

function AuthPage({ onAuthenticated }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState('');

  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get('verified');
    if (status === 'success') setVerificationStatus('Your email is verified. Log in with the same email and password you used to sign up.');
    if (status === 'error') setVerificationStatus('That verification link is invalid or has expired. Please sign up again to receive a new link.');
  }, []);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setVerificationStatus('');
    setLoading(true);
    try {
      const data = await api(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (mode === 'signup' && data.requiresVerification) setVerificationSent(true);
      else { localStorage.setItem('auth_token', data.token); onAuthenticated(data.user); }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  const signingUp = mode === 'signup';
  if (verificationSent) return <main className="auth-shell"><div className="brand">AI TASK <span>MANAGER</span></div><section className="auth-card"><p className="eyebrow">CHECK YOUR INBOX</p><h1>Verify your email.</h1><p className="intro">We sent a verification link to <strong>{email}</strong>. Open it to verify your account, then return here and log in with the same email and password.</p><button className="primary-button" type="button" onClick={() => { setVerificationSent(false); setMode('login'); }}>Back to log in</button></section></main>;
  return <main className="auth-shell">
    <div className="brand">AI TASK <span>MANAGER</span></div>
    <section className="auth-card" aria-labelledby="auth-title">
      <p className="eyebrow">AI TASK MANAGER</p>
      <h1 id="auth-title">Plan work with clarity.</h1>
      <p className="intro">Sign in to turn ideas into focused, actionable tasks.</p>
      {verificationStatus && <p className="form-success" role="status">{verificationStatus}</p>}
      <div className="auth-tabs" role="tablist" aria-label="Authentication options">
        <button className={mode === 'login' ? 'active' : ''} type="button" onClick={() => { setMode('login'); setError(''); }}>Log in</button>
        <button className={signingUp ? 'active' : ''} type="button" onClick={() => { setMode('signup'); setError(''); }}>Sign up</button>
      </div>
      <form className="auth-form" onSubmit={submit}>
        <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" required /></label>
        <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" autoComplete={signingUp ? 'new-password' : 'current-password'} minLength="8" required /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button" disabled={loading}>{loading ? 'Please wait...' : signingUp ? 'Create account' : 'Log in'}</button>
      </form>
      <p className="switch-copy">{signingUp ? 'Already have an account?' : 'New here?'} <button type="button" onClick={() => setMode(signingUp ? 'login' : 'signup')}>{signingUp ? 'Log in' : 'Create an account'}</button></p>
    </section>
  </main>;
}

function TaskManager({ user, onLogout }) {
  const [prompt, setPrompt] = useState('Turn this into a task: Prepare the Q3 roadmap deck by Friday.');
  const [provider, setProvider] = useState('groq');
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function generateTask(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setResult('');
    try {
      const data = await api('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${storedToken()}` },
        body: JSON.stringify({ provider, prompt }),
      });
      setResult(data.content);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return <main className="app-shell">
    <header className="topbar"><div className="brand">AI TASK <span>MANAGER</span></div><div className="profile"><span>{user.email}</span><button type="button" onClick={onLogout}>Log out</button></div></header>
    <section className="workspace" aria-labelledby="workspace-title">
      <div className="workspace-copy"><p className="eyebrow">YOUR AI WORKSPACE</p><h1 id="workspace-title">Turn rough thoughts into<br /><em>clear next steps.</em></h1><p>Give the assistant a brief. It will shape the work into a focused task you can act on.</p></div>
      <form className="task-form" onSubmit={generateTask}>
        <label className="provider-label">AI model<select value={provider} onChange={(event) => setProvider(event.target.value)}><option value="groq">Groq</option><option value="mistral">Mistral</option></select></label>
        <label className="brief-label">What would you like to plan?<textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows="7" placeholder="Example: prepare a client handoff by Friday" /></label>
        <button className="primary-button" disabled={loading}><span>{loading ? 'Thinking through it...' : 'Generate a clear task'}</span><b aria-hidden="true">→</b></button>
      </form>
      {error && <p className="form-error" role="alert">{error}</p>}
      {result && <TaskResult content={result} />}
    </section>
  </main>;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const token = storedToken();
    if (!token) { setCheckingSession(false); return; }
    api('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then((data) => setUser(data.user))
      .catch(() => localStorage.removeItem('auth_token'))
      .finally(() => setCheckingSession(false));
  }, []);

  function logout() { localStorage.removeItem('auth_token'); setUser(null); }
  if (checkingSession) return <main className="loading-screen">Loading your workspace...</main>;
  return user ? <TaskManager user={user} onLogout={logout} /> : <AuthPage onAuthenticated={setUser} />;
}
