import React, { useMemo, useState } from 'react';
import {
  Bell,
  Camera,
  CheckCircle2,
  ChevronLeft,
  CircleUserRound,
  MessageSquareText,
  Mic,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Smile,
  Sparkles,
  UserRoundPlus,
  Users,
  Video
} from 'lucide-react';

const menuItems = [
  { id: 'chat', label: 'Chat', icon: MessageSquareText },
  { id: 'updates', label: 'Updates', icon: Sparkles },
  { id: 'settings', label: 'Settings', icon: Settings }
];

const mockContacts = [
  { id: 1, name: 'Nisha Roy', username: '@nisha', online: true, lastSeen: 'online', unread: 3 },
  { id: 2, name: 'Arjun Sen', username: '@arjun', online: false, lastSeen: '2m ago', unread: 0 },
  { id: 3, name: 'Priya Das', username: '@priya', online: true, lastSeen: 'online', unread: 1 }
];

const defaultMessages = [
  { id: 1, from: 'them', text: 'Hey! Are we still meeting today?', time: '9:12 AM' },
  { id: 2, from: 'me', text: 'Yes, at 6pm. I’ll share the update after lunch.', time: '9:13 AM' },
  { id: 3, from: 'them', text: 'Perfect! I’ll bring the files.', time: '9:14 AM' }
];

function App() {
  const [activeTab, setActiveTab] = useState('chat');
  const [authMode, setAuthMode] = useState('login');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    displayName: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedContact, setSelectedContact] = useState(mockContacts[0]);
  const [messages, setMessages] = useState(defaultMessages);
  const [draft, setDraft] = useState('');

  const activePage = useMemo(() => {
    if (!isAuthenticated) {
      return 'auth';
    }

    return activeTab;
  }, [activeTab, isAuthenticated]);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
    setError('');
    setSuccess('');
  };

  const handleAuthSubmit = async (event) => {
    event.preventDefault();

    try {
      const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const payload = authMode === 'login'
        ? { identifier: formData.email || formData.username, password: formData.password }
        : {
            email: formData.email,
            username: formData.username,
            password: formData.password,
            displayName: formData.displayName
          };

      const response = await fetch(`http://localhost:4000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed.');
      }

      setSuccess(authMode === 'login' ? 'Logged in successfully.' : 'Account created. Please verify your email.');
      setIsAuthenticated(true);
      setActiveTab('chat');
      setError('');
    } catch (submitError) {
      setError(submitError.message || 'Unable to authenticate right now.');
      setSuccess('');
    }
  };

  const handleSendMessage = () => {
    if (!draft.trim()) {
      return;
    }

    const newMessage = {
      id: Date.now(),
      from: 'me',
      text: draft.trim(),
      time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    };

    setMessages((current) => [...current, newMessage]);
    setDraft('');
  };

  if (activePage === 'auth') {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <div className="brand-badge">
            <MessageSquareText size={22} />
            <span>Flow Chat</span>
          </div>

          <div className="auth-toggle">
            <button
              className={authMode === 'login' ? 'active' : ''}
              type="button"
              onClick={() => setAuthMode('login')}
            >
              Login
            </button>
            <button
              className={authMode === 'signup' ? 'active' : ''}
              type="button"
              onClick={() => setAuthMode('signup')}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleAuthSubmit} className="auth-form">
            {authMode === 'signup' && (
              <>
                <label>
                  <span>Display name</span>
                  <input
                    name="displayName"
                    value={formData.displayName}
                    onChange={handleInputChange}
                    placeholder="Your display name"
                  />
                </label>
              </>
            )}

            {authMode === 'signup' && (
              <label>
                <span>Email address</span>
                <input
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="name@gmail.com"
                />
              </label>
            )}

            <label>
              <span>{authMode === 'login' ? 'Username or email' : 'Username'}</span>
              <input
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                placeholder={authMode === 'login' ? 'username or email' : 'unique username'}
              />
            </label>

            <label>
              <span>Password</span>
              <input
                name="password"
                type="password"
                minLength={8}
                value={formData.password}
                onChange={handleInputChange}
                placeholder="********"
              />
            </label>

            {error && <div className="message error">{error}</div>}
            {success && <div className="message success">{success}</div>}

            <button type="submit" className="primary-button full-width">
              {authMode === 'login' ? 'Login to Flow Chat' : 'Create account'}
            </button>
          </form>

          <div className="security-note">
            <ShieldCheck size={16} />
            <span>Secure sessions, unique usernames, and email verification are enforced on the backend.</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-title">
          <div className="logo-mark">
            <MessageSquareText size={18} />
          </div>
          <div>
            <h1>Flow Chat</h1>
          </div>
        </div>

        <div className="topbar-actions">
          <button className="icon-button" type="button" aria-label="Search chats">
            <Search size={18} />
          </button>
          <button className="icon-button" type="button" aria-label="Add contact">
            <UserRoundPlus size={18} />
          </button>
        </div>
      </header>

      {activeTab === 'chat' && (
        <main className="page chat-page">
          <div className="chat-sidebar">
            <div className="search-box">
              <Search size={16} />
              <input type="text" placeholder="Search users..." />
            </div>

            <div className="contact-list">
              {mockContacts.map((contact) => (
                <button
                  key={contact.id}
                  type="button"
                  className={`contact-item ${selectedContact.id === contact.id ? 'selected' : ''}`}
                  onClick={() => setSelectedContact(contact)}
                >
                  <div className="avatar-wrap">
                    <div className="avatar avatar-purple">{contact.name.charAt(0)}</div>
                    {contact.online && <span className="online-dot" />}
                  </div>

                  <div className="contact-body">
                    <div className="contact-topline">
                      <strong>{contact.name}</strong>
                      <span>{contact.lastSeen}</span>
                    </div>
                    <div className="contact-username">{contact.username}</div>
                  </div>

                  {contact.unread > 0 && <span className="unread-pill">{contact.unread}</span>}
                </button>
              ))}
            </div>
          </div>

          <section className="chat-panel">
            <div className="chat-header">
              <button type="button" className="icon-button ghost" aria-label="Back">
                <ChevronLeft size={18} />
              </button>

              <div className="chat-user-header">
                <div className="avatar avatar-purple large">{selectedContact.name.charAt(0)}</div>
                <div>
                  <h2>{selectedContact.name}</h2>
                  <small>{selectedContact.online ? 'online' : `last seen ${selectedContact.lastSeen}`}</small>
                </div>
              </div>

              <div className="chat-actions">
                <button type="button" className="icon-button ghost" aria-label="Video call">
                  <Video size={18} />
                </button>
                <button type="button" className="icon-button ghost" aria-label="Voice call">
                  <Mic size={18} />
                </button>
                <button type="button" className="icon-button ghost" aria-label="More actions">
                  <MoreHorizontal size={18} />
                </button>
              </div>
            </div>

            <div className="message-list">
              {messages.map((message) => (
                <div key={message.id} className={`message-row ${message.from === 'me' ? 'outgoing' : 'incoming'}`}>
                  <div className="bubble">
                    <span>{message.text}</span>
                    <small>{message.time}</small>
                  </div>
                </div>
              ))}
            </div>

            <div className="composer">
              <button type="button" className="icon-button ghost" aria-label="Smiley">
                <Smile size={18} />
              </button>

              <button type="button" className="icon-button ghost" aria-label="Camera">
                <Camera size={18} />
              </button>

              <input
                type="text"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Type a message"
              />

              <button type="button" className="icon-button primary" aria-label="Send message" onClick={handleSendMessage}>
                <Send size={18} />
              </button>
            </div>
          </section>
        </main>
      )}

      {activeTab === 'updates' && (
        <main className="page updates-page">
          <div className="updates-header">
            <div>
              <h2>Updates</h2>
              <small>Recent stories and status updates</small>
            </div>
            <button type="button" className="mini-action" aria-label="Add status">
              <Plus size={18} />
              <span>New</span>
            </button>
          </div>

          <div className="status-grid">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="status-card">
                <div className="status-avatar avatar-purple">{item}</div>
                <div>
                  <strong>User {item}</strong>
                  <small>2h ago</small>
                </div>
              </div>
            ))}
          </div>
        </main>
      )}

      {activeTab === 'settings' && (
        <main className="page settings-page">
          <div className="settings-header">
            <div className="avatar avatar-purple large">F</div>
            <div>
              <h2>Flow User</h2>
              <small>@flowuser</small>
            </div>
          </div>

          <div className="settings-section">
            <h3>Profile</h3>
            <div className="settings-row">
              <CircleUserRound size={18} />
              <span>Profile customization</span>
            </div>
            <div className="settings-row">
              <Bell size={18} />
              <span>Notifications and privacy</span>
            </div>
            <div className="settings-row">
              <ShieldCheck size={18} />
              <span>Account security and verification</span>
            </div>
          </div>

          <div className="settings-section">
            <h3>Personal information</h3>
            <div className="settings-row">
              <Users size={18} />
              <span>Username, email, and account details</span>
            </div>
            <div className="settings-row">
              <Settings size={18} />
              <span>Password management</span>
            </div>
          </div>

          <button type="button" className="logout-button" onClick={() => setIsAuthenticated(false)}>
            Log out
          </button>

          <div className="credit">By DibyaJyoti Singha !!</div>
        </main>
      )}

      <nav className="bottom-nav" aria-label="Bottom navigation">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export default App;
