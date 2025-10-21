/* ========================================
   CONFIGURATION & CONSTANTS
   ======================================== */

// ⚠️ IMPORTANT: Replace with your actual Perplexity API key
const PERPLEXITY_API_KEY = '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';
const API_ENDPOINT = 'https://api.perplexity.ai/chat/completions';

// Default model for chat completions
const DEFAULT_MODEL = 'sonar';

/* ========================================
   DOM ELEMENTS
   ======================================== */

const splashScreen = document.getElementById('splashScreen');
const chatApp = document.getElementById('chatApp');
const chatMessages = document.getElementById('chatMessages');
const chatContainer = document.getElementById('chatContainer');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const attachBtn = document.getElementById('attachBtn');
const fileInput = document.getElementById('fileInput');
const searchBtn = document.getElementById('searchBtn');
const themeToggle = document.getElementById('themeToggle');
const clearChat = document.getElementById('clearChat');
const filePreview = document.getElementById('filePreview');
const previewContainer = document.getElementById('previewContainer');
const closePreview = document.getElementById('closePreview');

/* ========================================
   STATE MANAGEMENT
   ======================================== */

let conversationHistory = [];
let isSearchMode = false;
let uploadedFile = null;
let currentTheme = localStorage.getItem('theme') || 'light';

/* ========================================
   INITIALIZATION
   ======================================== */

// Show chat app after splash screen
setTimeout(() => {
    splashScreen.style.display = 'none';
    chatApp.classList.remove('hidden');
    loadChatHistory();
    applyTheme(currentTheme);
}, 2500);

/* ========================================
   EVENT LISTENERS
   ======================================== */

// Send message on button click
sendBtn.addEventListener('click', handleSendMessage);

// Send message on Enter key (Shift+Enter for new line)
messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
    }
});

// Auto-resize textarea
messageInput.addEventListener('input', () => {
    messageInput.style.height = 'auto';
    messageInput.style.height = messageInput.scrollHeight + 'px';
});

// File upload
attachBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', handleFileUpload);
closePreview.addEventListener('click', clearFilePreview);

// Search mode toggle
searchBtn.addEventListener('click', () => {
    isSearchMode = !isSearchMode;
    searchBtn.classList.toggle('active', isSearchMode);
    messageInput.placeholder = isSearchMode 
        ? '🌐 Search the web...' 
        : 'Type your message here...';
});

// Theme toggle
themeToggle.addEventListener('click', () => {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(currentTheme);
    localStorage.setItem('theme', currentTheme);
});

// Clear chat
clearChat.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear the chat history?')) {
        conversationHistory = [];
        chatMessages.innerHTML = '';
        localStorage.removeItem('chatHistory');
        addWelcomeMessage();
    }
});

/* ========================================
   CORE FUNCTIONS
   ======================================== */

/**
 * Handle sending a message
 */
async function handleSendMessage() {
    const userMessage = messageInput.value.trim();
    
    if (!userMessage && !uploadedFile) return;

    // Display user message
    displayUserMessage(userMessage, uploadedFile);

    // Clear input and file
    messageInput.value = '';
    messageInput.style.height = 'auto';
    const fileToSend = uploadedFile;
    clearFilePreview();

    // Show typing indicator
    const typingId = showTypingIndicator();

    try {
        // Simulate realistic delay
        await sleep(800);

        // Get AI response
        const response = await getAIResponse(userMessage, fileToSend, isSearchMode);

        // Remove typing indicator
        removeTypingIndicator(typingId);

        // Display bot response
        displayBotMessage(response);

        // Save to history
        saveChatHistory();

    } catch (error) {
        removeTypingIndicator(typingId);
        displayBotMessage('Hmm, something seems off. Please try again. 🤔');
        console.error('Error:', error);
    }

    // Reset search mode after use
    if (isSearchMode) {
        isSearchMode = false;
        searchBtn.classList.remove('active');
        messageInput.placeholder = 'Type your message here...';
    }
}

/**
 * Get AI response from Perplexity API
 */
async function getAIResponse(userMessage, file, searchMode) {
    // Prepare message content
    let messageContent = userMessage;

    // Add file context if uploaded
    if (file) {
        if (file.type.startsWith('image/')) {
            messageContent += '\n\n[User uploaded an image: ' + file.name + '. Please describe or analyze it.]';
        } else {
            messageContent += '\n\n[User uploaded a document: ' + file.name + '. Content: ' + file.content + ']';
        }
    }

    // Add search context if in search mode
    if (searchMode) {
        messageContent = '🌐 Perform a web search and provide current information about: ' + messageContent;
    }

    // Check for code generation keywords
    const codeKeywords = ['write code', 'generate code', 'create program', 'write a program', 'code for', 'function that'];
    const isCodeRequest = codeKeywords.some(keyword => userMessage.toLowerCase().includes(keyword));

    if (isCodeRequest) {
        messageContent += '\n\nPlease format code snippets using proper markdown code blocks with language identifiers.';
    }

    // Add to conversation history
    conversationHistory.push({
        role: 'user',
        content: messageContent
    });

    // Create system message to define Rinowi's identity
const systemMessage = {
    role: 'system',
    content: `You are Rinowi, an intelligent AI chat assistant. You are NOT Perplexity. 
    Your name is Rinowi and you were created as a helpful, friendly AI assistant. 
    You can chat naturally, write code, analyze documents and images, and search the web. 
    Always introduce yourself as Rinowi when asked who you are. 
    Be helpful, concise, and professional in your responses.`
};

// Prepare conversation with system message
const messagesWithSystem = [systemMessage, ...conversationHistory.slice(-10)];

// Prepare API request
const requestBody = {
    model: searchMode ? 'sonar' : DEFAULT_MODEL,
    messages: messagesWithSystem,
    max_tokens: 1000,
    temperature: 0.7,
    stream: false
};


    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        // Handle HTTP errors
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Extract AI response
        const aiMessage = data.choices[0].message.content;

        // Add to conversation history
        conversationHistory.push({
            role: 'assistant',
            content: aiMessage
        });

        return aiMessage;

    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

/**
 * Display user message in chat
 */
function displayUserMessage(text, file) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user-message';

    let fileHTML = '';
    if (file) {
        if (file.type.startsWith('image/')) {
            fileHTML = `<img src="${file.preview}" alt="${file.name}" class="preview-image" style="margin-bottom: 8px; border-radius: 8px;">`;
        } else {
            fileHTML = `<div style="background: rgba(255,255,255,0.2); padding: 8px 12px; border-radius: 8px; margin-bottom: 8px;">
                <ion-icon name="document" style="vertical-align: middle;"></ion-icon> ${file.name}
            </div>`;
        }
    }

    messageDiv.innerHTML = `
        <div class="message-avatar">
            <ion-icon name="person-circle"></ion-icon>
        </div>
        <div class="message-content">
            <div class="message-bubble">
                ${fileHTML}
                ${text ? `<p>${escapeHtml(text)}</p>` : ''}
            </div>
            <span class="message-time">${getCurrentTime()}</span>
        </div>
    `;

    chatMessages.appendChild(messageDiv);
    scrollToBottom();
}

/**
 * Display bot message in chat with markdown and code formatting
 */
function displayBotMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot-message';

    // Format the message content (markdown-like)
    const formattedText = formatMessageContent(text);

    messageDiv.innerHTML = `
        <div class="message-avatar">
            <ion-icon name="sparkles"></ion-icon>
        </div>
        <div class="message-content">
            <div class="message-bubble">
                ${formattedText}
            </div>
            <span class="message-time">${getCurrentTime()}</span>
        </div>
    `;

    chatMessages.appendChild(messageDiv);

    // Apply syntax highlighting to code blocks
    messageDiv.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightElement(block);
    });

    scrollToBottom();
}

/**
 * Format message content with markdown-like syntax
 */
function formatMessageContent(text) {
    // Detect and format code blocks with language identifier
    text = text.replace(/``````/g, (match, lang, code) => {
        const language = lang || 'plaintext';
        return `<pre><code class="language-${language}">${escapeHtml(code.trim())}</code></pre>`;
    });

    // Format inline code
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Format bold text
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Format italic text
    text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Format lists
    text = text.replace(/^\* (.+)$/gm, '<li>$1</li>');
    text = text.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

    // Format numbered lists
    text = text.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

    // Format paragraphs
    text = text.split('\n\n').map(para => {
        if (!para.startsWith('<') && para.trim()) {
            return `<p>${para}</p>`;
        }
        return para;
    }).join('');

    return text;
}

/**
 * Show typing indicator
 */
function showTypingIndicator() {
    const typingId = 'typing-' + Date.now();
    const typingDiv = document.createElement('div');
    typingDiv.id = typingId;
    typingDiv.className = 'message bot-message';
    typingDiv.innerHTML = `
        <div class="message-avatar">
            <ion-icon name="sparkles"></ion-icon>
        </div>
        <div class="message-content">
            <div class="message-bubble">
                <div class="typing-indicator">
                    <span class="typing-dot"></span>
                    <span class="typing-dot"></span>
                    <span class="typing-dot"></span>
                </div>
            </div>
        </div>
    `;
    chatMessages.appendChild(typingDiv);
    scrollToBottom();
    return typingId;
}

/**
 * Remove typing indicator
 */
function removeTypingIndicator(typingId) {
    const typingDiv = document.getElementById(typingId);
    if (typingDiv) {
        typingDiv.remove();
    }
}

/**
 * Handle file upload
 */
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    if (file.type.startsWith('image/')) {
        reader.onload = (e) => {
            uploadedFile = {
                name: file.name,
                type: file.type,
                preview: e.target.result
            };
            showFilePreview();
        };
        reader.readAsDataURL(file);
    } else {
        reader.onload = (e) => {
            uploadedFile = {
                name: file.name,
                type: file.type,
                content: e.target.result.substring(0, 5000) // Limit content
            };
            showFilePreview();
        };
        reader.readAsText(file);
    }

    fileInput.value = '';
}

/**
 * Show file preview
 */
function showFilePreview() {
    filePreview.classList.remove('hidden');

    if (uploadedFile.type.startsWith('image/')) {
        previewContainer.innerHTML = `
            <img src="${uploadedFile.preview}" alt="${uploadedFile.name}" class="preview-image">
            <span class="preview-file-name">${uploadedFile.name}</span>
        `;
    } else {
        previewContainer.innerHTML = `
            <div class="preview-file-info">
                <ion-icon name="document" class="preview-file-icon"></ion-icon>
                <span class="preview-file-name">${uploadedFile.name}</span>
            </div>
        `;
    }
}

/**
 * Clear file preview
 */
function clearFilePreview() {
    uploadedFile = null;
    filePreview.classList.add('hidden');
    previewContainer.innerHTML = '';
}

/**
 * Add welcome message
 */
function addWelcomeMessage() {
    const welcomeDiv = document.createElement('div');
    welcomeDiv.className = 'message bot-message';
    welcomeDiv.innerHTML = `
        <div class="message-avatar">
            <ion-icon name="sparkles"></ion-icon>
        </div>
        <div class="message-content">
            <div class="message-bubble">
                <p>👋 Hello! I'm <strong>Rinowi</strong>, your AI assistant. How can I help you today?</p>
            </div>
            <span class="message-time">${getCurrentTime()}</span>
        </div>
    `;
    chatMessages.appendChild(welcomeDiv);
}

/* ========================================
   UTILITY FUNCTIONS
   ======================================== */

/**
 * Scroll chat to bottom
 */
function scrollToBottom() {
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

/**
 * Get current time
 */
function getCurrentTime() {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Sleep function for delay
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Apply theme
 */
function applyTheme(theme) {
    if (theme === 'dark') {
        document.documentElement.setAttribute('data-color-scheme', 'dark');
        themeToggle.querySelector('ion-icon').setAttribute('name', 'sunny');
    } else {
        document.documentElement.setAttribute('data-color-scheme', 'light');
        themeToggle.querySelector('ion-icon').setAttribute('name', 'moon');
    }
}

/**
 * Save chat history to localStorage
 */
function saveChatHistory() {
    const messages = Array.from(chatMessages.children).map(msg => msg.outerHTML);
    localStorage.setItem('chatHistory', JSON.stringify(messages));
    localStorage.setItem('conversationHistory', JSON.stringify(conversationHistory));
}

/**
 * Load chat history from localStorage
 */
function loadChatHistory() {
    const savedMessages = localStorage.getItem('chatHistory');
    const savedConversation = localStorage.getItem('conversationHistory');

    if (savedMessages) {
        chatMessages.innerHTML = JSON.parse(savedMessages).join('');
        scrollToBottom();
    } else {
        addWelcomeMessage();
    }

    if (savedConversation) {
        conversationHistory = JSON.parse(savedConversation);
    }
}

/* ========================================
   INITIALIZATION COMPLETE
   ======================================== */

console.log('🤖 Rinowi AI Chat Assistant initialized successfully!');
