import { useState, useEffect, useRef, useCallback } from 'react';
import { chatApi } from '../api/client';
import { marked } from 'marked';

// Configure marked for safe rendering
marked.setOptions({ breaks: true, gfm: true });

const QUICK_CHIPS = [
  'Quán ăn nộp thuế gì?',
  'Tiệm cắt tóc tính thuế thế nào?',
  'Tiệm sửa xe nộp thuế bao nhiêu?',
  'Hạn nộp thuế 2026',
  'Doanh thu dưới 500 triệu có phải nộp thuế?',
  'Lệ phí môn bài là gì?',
];

function getSpeechRecognitionCtor() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function stripMarkdown(value = '') {
  return value
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/#{1,6}\s+/g, '')
    .replace(/[>*_`~]/g, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\n+/g, '. ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function TypingIndicator() {
  return (
    <div className="bubble-wrap bubble-ai chat-typing">
      <div className="bubble-avatar">A</div>
      <div className="bubble">
        <div className="typing-dots">
          <div className="typing-dot" />
          <div className="typing-dot" />
          <div className="typing-dot" />
        </div>
      </div>
    </div>
  );
}

function Bubble({ msg, onSpeak, isSpeaking }) {
  const isUser = msg.sender === 'USER';
  const html = isUser ? null : marked.parse(msg.content || '');
  const timeLabel = formatTime(msg.createdAt);
  return (
    <div className={`bubble-wrap${isUser ? ' bubble-user' : ' bubble-ai'}`}>
      <div className="bubble-avatar">{isUser ? '👤' : 'A'}</div>
      <div className="bubble">
        <div className="bubble-meta">
          <strong>{isUser ? 'Bạn' : 'A Trợ'}</strong>
          {timeLabel && <span>{timeLabel}</span>}
          {!isUser && onSpeak && (
            <button
              type="button"
              className={`bubble-action${isSpeaking ? ' active' : ''}`}
              onClick={() => onSpeak(msg)}
              aria-label={isSpeaking ? 'Dừng đọc phản hồi' : 'Đọc phản hồi'}
              title={isSpeaking ? 'Dừng đọc phản hồi' : 'Đọc phản hồi'}
            >
              {isSpeaking ? '⏹' : '🔊'}
            </button>
          )}
        </div>
        {isUser
          ? <span>{msg.content || ''}</span>
          : <span dangerouslySetInnerHTML={{ __html: html }} />
        }
      </div>
    </div>
  );
}

function EmptyState({ onPick }) {
  const starterPrompts = [
    {
      title: 'Thuế môn bài',
      desc: 'Hạn nộp, mức thu và trường hợp miễn năm đầu.',
      text: 'Lệ phí môn bài năm 2026 là gì?'
    },
    {
      title: 'Thuế khoán',
      desc: 'Cách tính theo ngành và doanh thu thực tế.',
      text: 'Thuế khoán cho hộ kinh doanh dịch vụ tính thế nào?'
    },
    {
      title: 'Doanh thu nhỏ',
      desc: 'Mốc 500 triệu/năm có phải nộp thuế không.',
      text: 'Doanh thu dưới 500 triệu có phải nộp thuế không?'
    },
    {
      title: 'Hóa đơn điện tử',
      desc: 'Đăng ký, xuất và xử lý sai sót khi cần.',
      text: 'Hộ kinh doanh có cần xuất hóa đơn điện tử không?'
    },
  ];

  return (
    <div className="chat-empty">
      <div className="chat-empty-illustration">🤖</div>
      <div className="chat-empty-copy">
        <div className="label">TRỢ LÝ AI</div>
        <h2 className="h2">A Trợ sẵn sàng trả lời</h2>
        <p className="body">
          Hỏi ngay về thuế, hóa đơn, thời hạn nộp hoặc cách tính thuế cho hộ kinh doanh.
          Câu trả lời được tạo trực tiếp qua Gemini.
        </p>
      </div>
      <div className="chat-empty-grid">
        {starterPrompts.map((prompt) => (
          <button
            key={prompt.title}
            type="button"
            className="chat-empty-card"
            onClick={() => onPick(prompt.text)}
          >
            <strong>{prompt.title}</strong>
            <span>{prompt.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [histLoading, setHistLoading] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [speakingId, setSpeakingId] = useState(null);
  const [voiceError, setVoiceError] = useState('');
  const [voiceSupport, setVoiceSupport] = useState({ recognition: false, synthesis: false });
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);

  // Load history
  useEffect(() => {
    chatApi.history()
      .then(data => {
        if (Array.isArray(data)) setMessages(data);
        else setMessages([]);
      })
      .catch(() => setMessages([]))
      .finally(() => setHistLoading(false));
  }, []);

  useEffect(() => {
    const SpeechRecognition = getSpeechRecognitionCtor();
    setVoiceSupport({
      recognition: Boolean(SpeechRecognition),
      synthesis: typeof window !== 'undefined' && 'speechSynthesis' in window,
    });

    return () => {
      recognitionRef.current?.abort?.();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const stopReading = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeakingId(null);
  }, []);

  const speakMessage = useCallback((msg) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setVoiceError('Trình duyệt này chưa hỗ trợ đọc phản hồi bằng giọng nói.');
      return;
    }

    const text = stripMarkdown(msg?.content || '');
    if (!text) return;

    stopReading();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'vi-VN';
    utterance.rate = 0.96;
    utterance.pitch = 1;
    utterance.volume = 1;

    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(voice => voice.lang?.toLowerCase().startsWith('vi'))
      || voices.find(voice => voice.lang?.toLowerCase().startsWith('en'))
      || voices[0];

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onstart = () => setSpeakingId(msg.id);
    utterance.onend = () => setSpeakingId(prev => (prev === msg.id ? null : prev));
    utterance.onerror = () => setSpeakingId(prev => (prev === msg.id ? null : prev));

    window.speechSynthesis.speak(utterance);
  }, [stopReading]);

  const startListening = useCallback(() => {
    const SpeechRecognition = getSpeechRecognitionCtor();
    if (!SpeechRecognition) {
      setVoiceError('Trình duyệt này chưa hỗ trợ nhập bằng giọng nói.');
      return;
    }

    setVoiceError('');

    const recognition = new SpeechRecognition();
    recognition.lang = 'vi-VN';
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onstart = () => {
      setIsListening(true);
      setInput('');
      stopReading();
    };

    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let index = 0; index < event.results.length; index += 1) {
        const transcript = event.results[index][0].transcript.trim();
        if (event.results[index].isFinal) {
          finalTranscript += `${transcript} `;
        } else {
          interimTranscript += transcript;
        }
      }

      setInput(`${finalTranscript}${interimTranscript}`.trim());
    };

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setVoiceError('Cần cấp quyền microphone để nhập bằng giọng nói.');
      } else {
        setVoiceError('Không nhận được giọng nói, vui lòng thử lại.');
      }
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
      inputRef.current?.focus();
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (error) {
      setVoiceError('Không thể khởi động microphone.');
      setIsListening(false);
      recognitionRef.current = null;
    }
  }, [stopReading]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop?.();
      return;
    }

    startListening();
  }, [isListening, startListening]);

  const send = useCallback(async (text) => {
    const content = (text || input).trim();
    if (!content || loading) return;
    recognitionRef.current?.stop?.();
    stopReading();
    setInput('');

    // Optimistic: add user message immediately
    const tempUser = { sender: 'USER', content, id: `tmp_u_${Date.now()}` };
    setMessages(prev => [...prev, tempUser]);
    setLoading(true);

    try {
      const data = await chatApi.send(content);
      setMessages(prev => [
        ...prev.filter(m => m.id !== tempUser.id),
        data.userMessage,
        data.aiMessage,
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { sender: 'AI', content: `⚠️ Lỗi: ${err.message}. Vui lòng thử lại.`, id: `err_${Date.now()}` },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading, stopReading]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const handleClear = async () => {
    if (!window.confirm('Xoá toàn bộ lịch sử trò chuyện?')) return;
    try {
      recognitionRef.current?.stop?.();
      stopReading();
      await chatApi.clear();
      setMessages([]);
    } catch (e) { alert(e.message); }
  };

  const isEmpty = !histLoading && messages.length === 0;
  const statusText = loading
    ? 'A Trợ đang tổng hợp câu trả lời...'
    : 'Kết nối trực tiếp với Gemini 2.5 Flash';
  const voiceHint = voiceSupport.recognition
    ? (isListening
      ? 'Đang nghe... nói xong rồi chờ A Trợ nhận câu hoặc bấm lại nút mic để dừng.'
      : 'Nhấn nút mic để nhập bằng giọng nói. Các phản hồi AI có nút đọc riêng.')
    : 'Trình duyệt này chưa hỗ trợ nhập bằng giọng nói.';

  return (
    <div className="page-container chat-page">
      <section className="card card--accent chat-hero">
        <div className="chat-hero-copy">
          <div className="label">TRỢ LÝ AI</div>
          <h1 className="display">A Trợ AI</h1>
          <p className="body">
            Trao đổi tự nhiên về thuế khoán, hóa đơn điện tử, thời hạn nộp và cách tính thuế.
            Phản hồi đang được tạo trực tiếp qua Gemini.
          </p>
        </div>

        <div className="chat-hero-aside">
          <div className={`chat-status${loading ? ' is-loading' : ''}`}>
            <span className="chat-status-dot" />
            <span>{loading ? 'Gemini đang phản hồi' : 'Gemini trực tuyến'}</span>
          </div>
          <div className="chat-hero-note">{statusText}</div>
          <div className="chat-hero-actions">
            <button
              type="button"
              className={`voice-btn${isListening ? ' active' : ''}`}
              onClick={toggleListening}
              disabled={!voiceSupport.recognition}
              title={voiceSupport.recognition ? (isListening ? 'Dừng nhập giọng nói' : 'Nhập bằng giọng nói') : 'Trình duyệt chưa hỗ trợ giọng nói'}
            >
              {isListening ? '⏹' : '🎙'}
              <span>{isListening ? 'Dừng nghe' : 'Giọng nói'}</span>
            </button>
            <button
              type="button"
              className="voice-btn voice-btn--secondary"
              onClick={stopReading}
              disabled={!speakingId}
              title={speakingId ? 'Dừng đọc phản hồi' : 'Không có phản hồi nào đang được đọc'}
            >
              ⏸
              <span>Dừng đọc</span>
            </button>
            {messages.length > 0 && (
              <button
                id="clear-chat-btn"
                type="button"
                className="voice-btn voice-btn--ghost"
                onClick={handleClear}
                title="Xóa lịch sử trò chuyện"
              >
                🗑
                <span>Xóa lịch sử</span>
              </button>
            )}
          </div>
          <div className="chat-hero-stats">
            <div className="chat-stat">
              <span className="caption">Mô hình</span>
              <strong>Gemini 2.5 Flash</strong>
            </div>
            <div className="chat-stat">
              <span className="caption">Phạm vi</span>
              <strong>Thuế VN</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="card chat-shell">
        <div className="chat-scroll" role="log" aria-live="polite">
          {histLoading && (
            <div className="chat-container">
              {[1, 2, 3].map((i) => (
                <div key={i} className={`bubble-wrap${i % 2 === 0 ? ' bubble-user' : ' bubble-ai'}`}>
                  <div className="skeleton skeleton-avatar" />
                  <div className="skeleton" style={{ height: 64, width: '60%', borderRadius: 18 }} />
                </div>
              ))}
            </div>
          )}

          {!histLoading && isEmpty && <EmptyState onPick={send} />}

          {!histLoading && !isEmpty && (
            <div className="chat-container">
              {messages.map((msg, idx) => (
                <Bubble
                  key={msg.id || idx}
                  msg={msg}
                  onSpeak={msg.sender === 'AI' ? speakMessage : null}
                  isSpeaking={speakingId === msg.id}
                />
              ))}
              {loading && <TypingIndicator />}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <div className="chat-composer">
          {!isEmpty && (
            <div className="chips-row chat-chips-row">
              {QUICK_CHIPS.map(q => (
                <button key={q} type="button" className="chip" onClick={() => send(q)}>
                  {q}
                </button>
              ))}
            </div>
          )}

          <div className="chat-composer-row">
            <textarea
              id="chat-input"
              ref={inputRef}
              className="chat-input"
              placeholder="Nhập câu hỏi về thuế..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
            />
            <button
              id="chat-voice-btn"
              type="button"
              className={`chat-voice-btn${isListening ? ' active' : ''}`}
              onClick={toggleListening}
              disabled={!voiceSupport.recognition}
              aria-label={isListening ? 'Dừng nhập bằng giọng nói' : 'Nhập bằng giọng nói'}
              title={voiceSupport.recognition ? (isListening ? 'Dừng nhập bằng giọng nói' : 'Nhập bằng giọng nói') : 'Trình duyệt chưa hỗ trợ giọng nói'}
            >
              {isListening ? '⏹' : '🎙'}
            </button>
            <button
              id="chat-send-btn"
              className="chat-send-btn"
              onClick={() => send()}
              disabled={loading || !input.trim()}
              aria-label="Gửi tin nhắn"
            >
              {loading ? '…' : '➤'}
            </button>
          </div>

          <div className="chat-composer-hint">
            <span>{voiceHint}</span>
            <span>A Trợ ưu tiên nội dung về thuế, hóa đơn và tài chính hộ kinh doanh</span>
          </div>

          {voiceError && <div className="chat-voice-error">{voiceError}</div>}
        </div>
      </section>
    </div>
  );
}
