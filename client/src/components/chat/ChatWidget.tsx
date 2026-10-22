import { useEffect, useRef, useState, type FormEvent } from 'react';
import { animate } from 'motion';
import { Bot, Loader2, MessageCircle, SendHorizontal, Sparkles, Trash2, X } from 'lucide-react';
import { useChat } from '../../hooks/useChat';
import { EXPO_OUT, prefersReducedMotion } from '../../utils/motion';
import ChatDraftCard from './ChatDraftCard';
import type { ChatMessage } from '../../types';

const SUGGESTIONS = ['What did I do today?', 'best squat', 'last chest workout', 'help'];
const MAX_LENGTH = 500;

// Floating chat assistant: a launcher button plus a panel (full screen on
// mobile, a card in the corner on larger screens).
export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const launcherRef = useRef<HTMLButtonElement>(null);

  const close = () => {
    setOpen(false);
    // Hand focus back to where the user came from
    requestAnimationFrame(() => launcherRef.current?.focus());
  };

  return (
    <>
      {open && <ChatPanel onClose={close} />}
      <button
        ref={launcherRef}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-label={open ? 'Close assistant' : 'Open assistant'}
        aria-expanded={open}
        className={`fixed bottom-5 right-5 z-[901] w-14 h-14 rounded-full bg-brand-orange hover:bg-brand-orange-hover text-white shadow-lg flex items-center justify-center transition cursor-pointer ${
          open ? 'max-sm:hidden' : ''
        }`}
      >
        {open ? <X size={24} /> : <MessageCircle size={24} />}
      </button>
    </>
  );
}

function ChatPanel({ onClose }: { onClose: () => void }) {
  const chat = useChat();
  const [input, setInput] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Entrance animation (skipped for users who prefer reduced motion)
  useEffect(() => {
    inputRef.current?.focus();
    if (panelRef.current && !prefersReducedMotion()) {
      animate(panelRef.current, { opacity: [0, 1], transform: ['translateY(16px)', 'translateY(0)'] }, { duration: 0.3, ease: EXPO_OUT });
    }
  }, []);

  // Escape closes from anywhere: listening on the panel alone misses it once
  // focus drops to <body> (e.g. after the clicked Dismiss button unmounts)
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Keep the newest message (or the typing indicator) in view
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [chat.messages.length, chat.isSending]);

  const submit = (text: string) => {
    if (chat.sendMessage(text)) setInput('');
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(input);
  };

  const handleClear = () => {
    if (window.confirm('Clear the whole conversation?')) chat.clearHistory();
  };

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Training assistant"
      className="fixed z-[900] inset-0 sm:inset-auto sm:bottom-24 sm:right-5 sm:w-[380px] sm:h-[560px] sm:max-h-[calc(100vh-8rem)] bg-white sm:rounded-2xl sm:border border-brand-border shadow-2xl flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-brand-border shrink-0">
        <div className="w-9 h-9 rounded-full bg-brand-orange/10 text-brand-orange flex items-center justify-center">
          <Bot size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-brand-navy">Training assistant</div>
          <div className={`text-xs ${chat.isOnline ? 'text-brand-muted' : 'text-brand-danger'}`}>
            {chat.isOnline ? 'Log workouts or ask about your training' : 'Offline: drafts can still be confirmed'}
          </div>
        </div>
        {chat.messages.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            disabled={chat.isClearing}
            aria-label="Clear conversation"
            title="Clear conversation"
            className="p-2 rounded-lg text-brand-muted hover:bg-slate-100 hover:text-brand-danger transition cursor-pointer disabled:opacity-50"
          >
            <Trash2 size={16} />
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close assistant"
          className="p-2 rounded-lg text-brand-muted hover:bg-slate-100 transition cursor-pointer"
        >
          <X size={18} />
        </button>
      </div>

      {/* Messages */}
      <div ref={listRef} role="log" aria-live="polite" className="flex-1 overflow-y-auto bg-brand-bg px-4 py-4 space-y-3">
        {chat.isLoading ? (
          <div className="flex justify-center py-8 text-brand-muted">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : chat.messages.length === 0 ? (
          <EmptyChat onPick={submit} disabled={!chat.canSend} />
        ) : (
          chat.messages.map((m) => (
            <MessageBubble key={m.id} message={m}>
              {m.action && (
                <ChatDraftCard
                  draft={m.action.draft}
                  status={chat.statusOf(m.id)}
                  actionable={m.id === chat.actionableId}
                  confirming={chat.confirmingId === m.id}
                  onConfirm={() => chat.confirmAction(m)}
                  onDismiss={() => chat.dismissAction(m.id)}
                />
              )}
            </MessageBubble>
          ))
        )}
        {chat.isSending && <TypingIndicator />}
      </div>

      {/* Composer */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 px-3 py-3 border-t border-brand-border shrink-0">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={MAX_LENGTH}
          disabled={!chat.canSend}
          placeholder={chat.canSend ? 'e.g. bench 3x8 60kg' : "You're offline: chat needs a connection"}
          aria-label="Message the assistant"
          className="flex-1 min-w-0 bg-slate-50 border border-brand-border rounded-full px-4 py-2 text-sm text-brand-navy placeholder:text-brand-muted focus:outline-none focus:ring-2 focus:ring-brand-orange/40 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={!chat.canSend || chat.isSending || !input.trim()}
          aria-label="Send message"
          className="w-10 h-10 shrink-0 rounded-full bg-brand-orange hover:bg-brand-orange-hover text-white flex items-center justify-center transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <SendHorizontal size={18} />
        </button>
      </form>
    </div>
  );
}

function MessageBubble({ message, children }: { message: ChatMessage; children?: React.ReactNode }) {
  const isUser = message.role === 'USER';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[85%]">
        <div
          className={`px-3.5 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words ${
            isUser ? 'bg-brand-navy text-white rounded-br-md' : 'bg-white border border-brand-border text-brand-navy rounded-bl-md'
          }`}
        >
          {message.content}
        </div>
        {/* Be transparent about which replies an AI generated */}
        {message.source === 'LLM' && (
          <div className="flex items-center gap-1 mt-1 text-[0.68rem] text-brand-muted">
            <Sparkles size={11} /> AI answer, double-check numbers
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start" aria-label="Assistant is typing">
      <div className="bg-white border border-brand-border rounded-2xl rounded-bl-md px-3.5 py-3 flex gap-1">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="w-1.5 h-1.5 rounded-full bg-brand-muted animate-bounce motion-reduce:animate-none"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

function EmptyChat({ onPick, disabled }: { onPick: (text: string) => void; disabled: boolean }) {
  return (
    <div className="text-center py-6">
      <div className="w-12 h-12 mx-auto rounded-full bg-brand-orange/10 text-brand-orange flex items-center justify-center">
        <Bot size={24} />
      </div>
      <p className="mt-3 text-sm font-semibold text-brand-navy">Log a set or ask about your training</p>
      <p className="mt-1 text-xs text-brand-muted">Quick commands are instant. Other questions use AI.</p>
      <div className="flex flex-wrap justify-center gap-2 mt-4">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            disabled={disabled}
            className="bg-white border border-brand-border rounded-full px-3 py-1 text-xs text-brand-navy hover:border-brand-orange hover:text-brand-orange transition cursor-pointer disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
