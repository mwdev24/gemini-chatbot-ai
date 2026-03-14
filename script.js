document.addEventListener('DOMContentLoaded', () => {
  const chatForm = document.getElementById('chat-form');
  const userInput = document.getElementById('user-input');
  const chatBox = document.getElementById('chat-box');
  const resetChatButton = document.getElementById('reset-chat');
  const presetButtons = document.querySelectorAll('.preset-card');
  const conversation = [];

  const initialMessage = [
    'Selamat datang. Saya adalah TravelGo, asisten perjalanan AI dengan gaya bahasa formal.',
    'Silakan sampaikan tujuan wisata, durasi perjalanan, jumlah pelancong, dan preferensi anggaran Anda agar saya dapat menyusun rekomendasi yang relevan.'
  ].join('\n\n');

  const escapeHtml = (text) => text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  const formatInline = (text) => escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');

  const renderStructuredText = (text) => {
    const lines = text.split('\n');
    const html = [];
    let paragraph = [];
    let currentListType = null;

    const flushParagraph = () => {
      if (paragraph.length > 0) {
        html.push(`<p>${formatInline(paragraph.join(' '))}</p>`);
        paragraph = [];
      }
    };

    const closeList = () => {
      if (currentListType) {
        html.push(`</${currentListType}>`);
        currentListType = null;
      }
    };

    for (const rawLine of lines) {
      const line = rawLine.trim();

      if (!line) {
        flushParagraph();
        closeList();
        continue;
      }

      const orderedMatch = line.match(/^(\d+)\.\s+(.*)$/);
      const unorderedMatch = line.match(/^\*\s+(.*)$/);

      if (orderedMatch) {
        flushParagraph();
        if (currentListType !== 'ol') {
          closeList();
          currentListType = 'ol';
          html.push('<ol>');
        }
        html.push(`<li>${formatInline(orderedMatch[2])}</li>`);
        continue;
      }

      if (unorderedMatch) {
        flushParagraph();
        if (currentListType !== 'ul') {
          closeList();
          currentListType = 'ul';
          html.push('<ul>');
        }
        html.push(`<li>${formatInline(unorderedMatch[1])}</li>`);
        continue;
      }

      closeList();
      paragraph.push(line);
    }

    flushParagraph();
    closeList();

    return html.join('');
  };

  const addMessage = (text, sender, elementId) => {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', sender);

    if (sender === 'bot') {
      messageElement.innerHTML = renderStructuredText(text);
    } else {
      messageElement.textContent = text;
    }

    if (elementId) {
      messageElement.id = elementId;
    }

    chatBox.appendChild(messageElement);
    chatBox.scrollTop = chatBox.scrollHeight;
  };

  const resetConversation = () => {
    conversation.length = 0;
    chatBox.innerHTML = '';
    addMessage(initialMessage, 'system');
  };

  const submitPrompt = async (message) => {
    addMessage(message, 'user');
    conversation.push({ role: 'user', text: message });

    const thinkingMessageId = `bot-thinking-${Date.now()}`;
    addMessage('Sedang menyiapkan rekomendasi perjalanan Anda...', 'bot', thinkingMessageId);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ conversation }),
      });

      const thinkingElement = document.getElementById(thinkingMessageId);
      if (!thinkingElement) {
        return;
      }

      if (!response.ok) {
        thinkingElement.textContent = 'Permintaan belum dapat diproses. Silakan coba kembali dalam beberapa saat.';
        console.error('Server error:', response.status, response.statusText);
        return;
      }

      const data = await response.json();
      const botReply = data?.result || 'Maaf, saya belum menerima respons yang dapat ditampilkan.';
      thinkingElement.innerHTML = renderStructuredText(botReply);
      conversation.push({ role: 'model', text: botReply });
    } catch (error) {
      const thinkingElement = document.getElementById(thinkingMessageId);
      if (thinkingElement) {
        thinkingElement.textContent = 'Koneksi ke server bermasalah. Silakan periksa layanan backend Anda.';
      }
      console.error('Fetch error:', error);
    } finally {
      chatBox.scrollTop = chatBox.scrollHeight;
    }
  };

  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const userMessage = userInput.value.trim();
    if (!userMessage) {
      return;
    }

    userInput.value = '';
    await submitPrompt(userMessage);
  });

  resetChatButton.addEventListener('click', () => {
    resetConversation();
    userInput.focus();
  });

  presetButtons.forEach((button) => {
    button.addEventListener('click', async () => {
      const prompt = button.dataset.prompt?.trim();
      if (!prompt) {
        return;
      }

      userInput.value = prompt;
      userInput.focus();
      await submitPrompt(prompt);
      userInput.value = '';
    });
  });

  resetConversation();
});
