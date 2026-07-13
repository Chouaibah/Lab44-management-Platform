'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useLab44Store } from '@/store/lab44';
import type { Message, Conversation } from '@/types';
import { timeAgo, getInitials, getAvatarColor, BreadcrumbNav } from '@/lib/helpers';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  MessageSquare, Send, ArrowLeft, Search, CheckCheck,
  Loader2, RefreshCw, Inbox, Users, ChevronRight,
} from 'lucide-react';

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = getInitials(name.split(' ')[0] || '', name.split(' ')[1] || '');
  const color = getAvatarColor(name);
  const sizes = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-12 w-12 text-base' };
  return (
    <div className={`flex items-center justify-center rounded-full text-white font-bold shrink-0 ${color} ${sizes[size]}`}>
      {initials}
    </div>
  );
}

// ─── Message Bubble ──────────────────────────────────────────────────────────

function MessageBubble({ message, isOwn }: { message: Message; isOwn: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
      className={`flex ${isOwn ? 'justify-end' : 'justify-start'} group`}
    >
      <div className={`max-w-[78%] sm:max-w-[65%]`}>
        <div
          className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
            isOwn
              ? 'bg-primary text-primary-foreground rounded-br-sm'
              : 'bg-card border border-border/60 text-foreground rounded-bl-sm'
          }`}
        >
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
        <div className={`flex items-center gap-1 mt-1 px-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${isOwn ? 'justify-end' : 'justify-start'}`}>
          <span className="text-[10px] text-muted-foreground">{timeAgo(message.createdAt)}</span>
          {isOwn && (
            <CheckCheck className={`h-3 w-3 ${message.read ? 'text-primary' : 'text-muted-foreground'}`} />
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Day Separator ────────────────────────────────────────────────────────────

function DaySeparator({ date }: { date: string }) {
  const label = (() => {
    const d = new Date(date);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  })();
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex-1 h-px bg-border/50" />
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-2">{label}</span>
      <div className="flex-1 h-px bg-border/50" />
    </div>
  );
}

// ─── Conversation Row ─────────────────────────────────────────────────────────

function ConversationRow({
  conversation, isActive, onClick,
}: {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 text-left relative overflow-hidden ${
        isActive
          ? 'bg-primary/8 border border-primary/15'
          : 'hover:bg-muted/60 border border-transparent'
      }`}
    >
      {isActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-8 bg-primary rounded-full" />
      )}
      <Avatar name={conversation.userName} size="md" />
      <div className="min-w-0 flex-1 overflow-hidden">
        <div className="flex items-baseline gap-2">
          <p className={`text-sm font-semibold truncate min-w-0 ${isActive ? 'text-primary' : ''}`}>
            {conversation.userName}
          </p>
          <span className="text-[10px] text-muted-foreground shrink-0 ml-auto">{timeAgo(conversation.lastMessageAt)}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <p className={`text-xs truncate min-w-0 flex-1 ${conversation.unreadCount > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
            {conversation.lastMessage}
          </p>
          {conversation.unreadCount > 0 && (
            <Badge className="bg-primary text-primary-foreground text-[10px] h-4 min-w-4 px-1 shrink-0">
              {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
            </Badge>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── Contact Row (no conversation yet) ───────────────────────────────────────

function ContactRow({
  contact, onClick,
}: {
  contact: { id: number; role: string; name: string; labId?: number | null };
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-muted/60 border border-transparent transition-all duration-150 text-left group"
    >
      <Avatar name={contact.name} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{contact.name}</p>
        <p className="text-[10px] text-muted-foreground capitalize">{contact.role}</p>
      </div>
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

// ─── Empty Chat Placeholder ───────────────────────────────────────────────────

function EmptyChat() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-20 text-center select-none">
      <div className="h-16 w-16 rounded-2xl bg-muted/40 flex items-center justify-center mb-4">
        <MessageSquare className="h-7 w-7 text-muted-foreground/40" />
      </div>
      <p className="text-sm font-medium text-foreground/60">Select a conversation</p>
      <p className="text-xs text-muted-foreground mt-1">Choose someone from the left panel</p>
    </div>
  );
}

// ─── Group messages by day ─────────────────────────────────────────────────────

function groupByDay(messages: Message[]) {
  const groups: { day: string; messages: Message[] }[] = [];
  for (const msg of messages) {
    const day = msg.createdAt.slice(0, 10);
    const last = groups[groups.length - 1];
    if (!last || last.day !== day) {
      groups.push({ day, messages: [msg] });
    } else {
      last.messages.push(msg);
    }
  }
  return groups;
}

// ─── Main Messaging View ──────────────────────────────────────────────────────

export default function MessagingView() {
  const { auth, conversations, setConversations, messages, setMessages, setUnreadMessageCount } = useLab44Store();

  const [selectedPeer, setSelectedPeer] = useState<{ id: number; role: string; name: string } | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [availableContacts, setAvailableContacts] = useState<{ id: number; role: string; name: string; labId?: number | null }[]>([]);
  const [mobileShowChat, setMobileShowChat] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isNearBottomRef = useRef(true);

  const isStudent = auth.role === 'student';
  const isInstructor = auth.role === 'instructor';

  // ── Data loaders ────────────────────────────────────────────────────────────

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/messages');
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
        setAvailableContacts(data.availableContacts || []);
      }
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [setConversations]);

  const loadUnreadCount = useCallback(async () => {
    try {
      const res = await fetch('/api/messages/unread-count');
      if (res.ok) {
        const data = await res.json();
        setUnreadMessageCount(data.count || 0);
      }
    } catch { /* silent */ }
  }, [setUnreadMessageCount]);

  useEffect(() => {
    loadConversations();
    loadUnreadCount();
  }, [loadConversations, loadUnreadCount]);

  // ── Load thread when peer changes ───────────────────────────────────────────

  useEffect(() => {
    if (!selectedPeer) return;
    let cancelled = false;

    (async () => {
      setLoadingMessages(true);
      try {
        const res = await fetch(`/api/messages?with=${selectedPeer.id}&role=${selectedPeer.role}`);
        if (res.ok && !cancelled) setMessages((await res.json()).messages || []);
      } catch { /* silent */ } finally {
        if (!cancelled) setLoadingMessages(false);
      }
    })();

    // Mark as read (fire-and-forget)
    fetch('/api/messages/mark-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senderId: selectedPeer.id, senderRole: selectedPeer.role }),
    }).then(() => Promise.all([loadConversations(), loadUnreadCount()])).catch(() => {});

    return () => { cancelled = true; };
  }, [selectedPeer, setMessages, loadConversations, loadUnreadCount]);

  // ── Auto-scroll ─────────────────────────────────────────────────────────────

  const handleChatScroll = useCallback(() => {
    const el = chatContainerRef.current;
    if (!el) return;
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }, []);

  useEffect(() => {
    if (isNearBottomRef.current) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [messages]);

  // ── Send ─────────────────────────────────────────────────────────────────────

  const handleSend = async () => {
    if (!selectedPeer || !messageInput.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverId: selectedPeer.id, receiverRole: selectedPeer.role, content: messageInput.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages([...messages, data.message]);
        setMessageInput('');
        textareaRef.current?.focus();
        loadConversations();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to send message');
      }
    } catch {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const openChat = (peer: { id: number; role: string; name: string }) => {
    setSelectedPeer(peer);
    setMobileShowChat(true);
  };

  // ── Filtered lists ───────────────────────────────────────────────────────────

  const filteredConversations = conversations.filter(c =>
    c.userName.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredContacts = availableContacts.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
    !conversations.some(conv => conv.userId === c.id && conv.userRole === c.role)
  );

  const messageGroups = groupByDay(messages);
  const myId = auth.student?.id ?? auth.instructor?.id;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-4rem)] p-4 sm:p-6 gap-4 max-w-6xl mx-auto overflow-hidden">

      {/* Breadcrumb + header */}
      <div>
        <BreadcrumbNav items={
          isStudent  ? [{ label: 'Dashboard', view: 'student-choice' }, { label: 'Messages' }]
          : isInstructor ? [{ label: 'Dashboard', view: 'instructor-panel' }, { label: 'Messages' }]
          : [{ label: 'Messages' }]
        } />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl text-primary font-semibold  items-center gap-2">Messages</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isStudent ? 'Chat with your lab instructor' : isInstructor ? 'Chat with your students' : 'All conversations'}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={() => { loadConversations(); loadUnreadCount(); }}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline text-xs">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="flex gap-3 flex-1 min-h-0">

        {/* ── Left: Sidebar ─────────────────────────────────────────────────── */}
        <div className={`flex flex-col w-full lg:w-[300px] xl:w-[320px] shrink-0 bg-card border border-border/60 rounded-2xl overflow-hidden ${mobileShowChat ? 'hidden lg:flex' : 'flex'}`}>

          {/* Sidebar header */}
          <div className="px-4 pt-4 pb-3 border-b border-border/40">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-8 text-sm bg-muted/40 border-0 focus-visible:ring-1"
              />
            </div>
          </div>

          {/* List — custom scrollbar always visible */}
          <div className="flex-1 overflow-y-auto" style={{ scrollbarGutter: 'stable' }}>
            <div className="px-2 py-2 space-y-0.5">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : filteredConversations.length === 0 && filteredContacts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                  <Inbox className="h-8 w-8 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {isStudent ? 'No conversations yet. Start chatting with your instructor.' : 'No conversations yet.'}
                  </p>
                </div>
              ) : (
                <>
                  {filteredConversations.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-3 py-1.5">Recent</p>
                      {filteredConversations.map((conv) => (
                        <ConversationRow
                          key={`${conv.userId}-${conv.userRole}`}
                          conversation={conv}
                          isActive={selectedPeer?.id === conv.userId && selectedPeer?.role === conv.userRole}
                          onClick={() => openChat({ id: conv.userId, role: conv.userRole, name: conv.userName })}
                        />
                      ))}
                    </div>
                  )}

                  {filteredContacts.length > 0 && (
                    <div className={filteredConversations.length > 0 ? 'mt-3 pt-3 border-t border-border/40' : ''}>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-3 py-1.5 flex items-center gap-1.5">
                        <Users className="h-3 w-3" />
                        {isStudent ? 'Instructors' : 'Students'}
                      </p>
                      {filteredContacts.map((contact) => (
                        <ContactRow
                          key={`${contact.id}-${contact.role}`}
                          contact={contact}
                          onClick={() => openChat({ id: contact.id, role: contact.role, name: contact.name })}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Right: Chat panel ──────────────────────────────────────────────── */}
        <div className={`flex flex-col flex-1 min-w-0 bg-card border border-border/60 rounded-2xl overflow-hidden ${!mobileShowChat ? 'hidden lg:flex' : 'flex'}`}>
          <AnimatePresence mode="wait">
            {selectedPeer ? (
              <motion.div
                key={`${selectedPeer.id}-${selectedPeer.role}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex flex-col h-full"
              >
                {/* Chat header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40 bg-muted/20">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 lg:hidden"
                    onClick={() => setMobileShowChat(false)}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <Avatar name={selectedPeer.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{selectedPeer.name}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">{selectedPeer.role}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[10px] text-muted-foreground h-7 gap-1"
                    onClick={async () => {
                      await fetch('/api/messages/mark-read', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ senderId: selectedPeer.id, senderRole: selectedPeer.role }),
                      });
                      await Promise.all([loadConversations(), loadUnreadCount()]);
                      toast.success('Marked as read');
                    }}
                  >
                    <CheckCheck className="h-3 w-3" />
                    <span className="hidden sm:inline">Mark read</span>
                  </Button>
                </div>

                {/* Messages area */}
                <div
                  ref={chatContainerRef}
                  className="flex-1 overflow-y-auto px-4 py-4 space-y-1"
                  style={{ scrollbarGutter: 'stable' }}
                  onScroll={handleChatScroll}
                >
                  {loadingMessages ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <MessageSquare className="h-9 w-9 text-muted-foreground/25 mb-3" />
                      <p className="text-sm text-muted-foreground">No messages yet — say hello!</p>
                    </div>
                  ) : (
                    <>
                      {messageGroups.map(({ day, messages: dayMsgs }) => (
                        <div key={day}>
                          <DaySeparator date={day} />
                          <div className="space-y-1.5">
                            {dayMsgs.map((msg) => (
                              <MessageBubble
                                key={msg.id}
                                message={msg}
                                isOwn={msg.senderId === myId}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                      <div ref={chatEndRef} />
                    </>
                  )}
                </div>

                {/* Input */}
                <div className="px-4 py-3 border-t border-border/40 bg-muted/10">
                  <div className="flex items-end gap-2">
                    <Textarea
                      ref={textareaRef}
                      placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
                      value={messageInput}
                      onChange={(e) => {
                        setMessageInput(e.target.value);
                        // Auto-resize
                        e.target.style.height = 'auto';
                        e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                      }}
                      onKeyDown={handleKeyDown}
                      className="flex-1 min-h-[40px] max-h-[120px] text-sm resize-none py-2.5 leading-relaxed"
                      disabled={sending}
                      rows={1}
                    />
                    <Button
                      onClick={handleSend}
                      disabled={!messageInput.trim() || sending}
                      size="icon"
                      className="h-10 w-10 shrink-0 mb-0"
                    >
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1"
              >
                <EmptyChat />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
