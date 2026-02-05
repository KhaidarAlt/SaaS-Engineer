(function() {
  'use strict';
  
  var SCW = window.SmartCatalogWidget || {};
  var config = {};
  var conversationId = null;
  var widgetKey = null;
  var baseUrl = '';
  var sessionId = null;
  var isOpen = false;
  var container = null;
  
  function generateSessionId() {
    var stored = localStorage.getItem('scw_session');
    if (stored) return stored;
    var id = 'scw_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('scw_session', id);
    return id;
  }
  
  function getBaseUrl() {
    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
      if (scripts[i].src && scripts[i].src.indexOf('widget.js') > -1) {
        var url = new URL(scripts[i].src);
        return url.origin;
      }
    }
    return '';
  }
  
  function createStyles() {
    var style = document.createElement('style');
    style.textContent = "\n      .scw-widget {\n        position: fixed;\n        z-index: 999999;\n        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;\n      }\n      .scw-widget.bottom-right {\n        bottom: 20px;\n        right: 20px;\n      }\n      .scw-widget.bottom-left {\n        bottom: 20px;\n        left: 20px;\n      }\n      .scw-button {\n        width: 60px;\n        height: 60px;\n        border-radius: 50%;\n        border: none;\n        cursor: pointer;\n        display: flex;\n        align-items: center;\n        justify-content: center;\n        box-shadow: 0 4px 12px rgba(0,0,0,0.15);\n        transition: transform 0.2s, box-shadow 0.2s;\n      }\n      .scw-button:hover {\n        transform: scale(1.05);\n        box-shadow: 0 6px 16px rgba(0,0,0,0.2);\n      }\n      .scw-button svg {\n        width: 28px;\n        height: 28px;\n        fill: white;\n      }\n      .scw-chat {\n        position: absolute;\n        bottom: 70px;\n        width: 360px;\n        max-width: calc(100vw - 40px);\n        height: 500px;\n        max-height: calc(100vh - 100px);\n        background: white;\n        border-radius: 16px;\n        box-shadow: 0 8px 32px rgba(0,0,0,0.15);\n        display: none;\n        flex-direction: column;\n        overflow: hidden;\n      }\n      .scw-widget.bottom-right .scw-chat {\n        right: 0;\n      }\n      .scw-widget.bottom-left .scw-chat {\n        left: 0;\n      }\n      .scw-chat.open {\n        display: flex;\n      }\n      .scw-header {\n        padding: 16px;\n        color: white;\n        font-weight: 600;\n        display: flex;\n        align-items: center;\n        justify-content: space-between;\n      }\n      .scw-close {\n        background: none;\n        border: none;\n        color: white;\n        cursor: pointer;\n        padding: 4px;\n        opacity: 0.8;\n      }\n      .scw-close:hover {\n        opacity: 1;\n      }\n      .scw-messages {\n        flex: 1;\n        overflow-y: auto;\n        padding: 16px;\n        display: flex;\n        flex-direction: column;\n        gap: 12px;\n      }\n      .scw-message {\n        max-width: 80%;\n        padding: 10px 14px;\n        border-radius: 16px;\n        font-size: 14px;\n        line-height: 1.4;\n      }\n      .scw-message.user {\n        align-self: flex-end;\n        background: #f0f0f0;\n        border-bottom-right-radius: 4px;\n      }\n      .scw-message.assistant {\n        align-self: flex-start;\n        color: white;\n        border-bottom-left-radius: 4px;\n      }\n      .scw-input-area {\n        padding: 12px 16px;\n        border-top: 1px solid #eee;\n        display: flex;\n        gap: 8px;\n      }\n      .scw-input {\n        flex: 1;\n        padding: 10px 14px;\n        border: 1px solid #ddd;\n        border-radius: 20px;\n        font-size: 14px;\n        outline: none;\n      }\n      .scw-input:focus {\n        border-color: #aaa;\n      }\n      .scw-send {\n        width: 40px;\n        height: 40px;\n        border-radius: 50%;\n        border: none;\n        cursor: pointer;\n        display: flex;\n        align-items: center;\n        justify-content: center;\n      }\n      .scw-send:disabled {\n        opacity: 0.5;\n        cursor: not-allowed;\n      }\n      .scw-send svg {\n        width: 18px;\n        height: 18px;\n        fill: white;\n      }\n      .scw-typing {\n        display: flex;\n        gap: 4px;\n        padding: 10px 14px;\n        align-self: flex-start;\n      }\n      .scw-typing span {\n        width: 8px;\n        height: 8px;\n        border-radius: 50%;\n        background: #ccc;\n        animation: scw-bounce 1.4s infinite ease-in-out;\n      }\n      .scw-typing span:nth-child(1) { animation-delay: -0.32s; }\n      .scw-typing span:nth-child(2) { animation-delay: -0.16s; }\n      @keyframes scw-bounce {\n        0%, 80%, 100% { transform: scale(0); }\n        40% { transform: scale(1); }\n      }\n    ";
    document.head.appendChild(style);
  }
  
  function createWidget() {
    container = document.createElement('div');
    container.className = 'scw-widget ' + (config.position || 'bottom-right');
    
    var html = '\n      <div class="scw-chat" id="scw-chat">\n        <div class="scw-header" style="background: ' + config.primaryColor + '">\n          <span>' + (config.name || 'Чат') + '</span>\n          <button class="scw-close" id="scw-close">\n            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">\n              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>\n            </svg>\n          </button>\n        </div>\n        <div class="scw-messages" id="scw-messages"></div>\n        <div class="scw-input-area">\n          <input type="text" class="scw-input" id="scw-input" placeholder="' + (config.placeholder || 'Введите сообщение...') + '">\n          <button class="scw-send" id="scw-send" style="background: ' + config.primaryColor + '">\n            <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>\n          </button>\n        </div>\n      </div>\n      <button class="scw-button" id="scw-toggle" style="background: ' + config.primaryColor + '">\n        <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>\n      </button>\n    ';
    
    container.innerHTML = html;
    document.body.appendChild(container);
    
    document.getElementById('scw-toggle').addEventListener('click', toggleChat);
    document.getElementById('scw-close').addEventListener('click', toggleChat);
    document.getElementById('scw-send').addEventListener('click', sendMessage);
    document.getElementById('scw-input').addEventListener('keypress', function(e) {
      if (e.key === 'Enter') sendMessage();
    });
  }
  
  function toggleChat() {
    isOpen = !isOpen;
    var chat = document.getElementById('scw-chat');
    chat.classList.toggle('open', isOpen);
    
    if (isOpen && !conversationId) {
      initConversation();
    }
  }
  
  function initConversation() {
    fetch(baseUrl + '/api/public/widget/' + widgetKey + '/conversation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sessionId })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      conversationId = data.conversationId;
      if (data.welcomeMessage) {
        addMessage(data.welcomeMessage, 'assistant');
      }
    })
    .catch(function(err) {
      console.error('SCW init error:', err);
    });
  }
  
  function addMessage(text, role) {
    var messages = document.getElementById('scw-messages');
    var msg = document.createElement('div');
    msg.className = 'scw-message ' + role;
    msg.textContent = text;
    if (role === 'assistant') {
      msg.style.background = config.primaryColor;
    }
    messages.appendChild(msg);
    messages.scrollTop = messages.scrollHeight;
  }
  
  function showTyping() {
    var messages = document.getElementById('scw-messages');
    var typing = document.createElement('div');
    typing.className = 'scw-typing';
    typing.id = 'scw-typing';
    typing.innerHTML = '<span></span><span></span><span></span>';
    messages.appendChild(typing);
    messages.scrollTop = messages.scrollHeight;
  }
  
  function hideTyping() {
    var typing = document.getElementById('scw-typing');
    if (typing) typing.remove();
  }
  
  function sendMessage() {
    var input = document.getElementById('scw-input');
    var text = input.value.trim();
    if (!text || !conversationId) return;
    
    input.value = '';
    addMessage(text, 'user');
    showTyping();
    
    var sendBtn = document.getElementById('scw-send');
    sendBtn.disabled = true;
    
    fetch(baseUrl + '/api/public/widget/' + widgetKey + '/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: conversationId, message: text })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      hideTyping();
      if (data.reply) {
        addMessage(data.reply, 'assistant');
      }
    })
    .catch(function(err) {
      hideTyping();
      console.error('SCW send error:', err);
    })
    .finally(function() {
      sendBtn.disabled = false;
    });
  }
  
  function init(key) {
    widgetKey = key;
    baseUrl = getBaseUrl();
    sessionId = generateSessionId();
    
    fetch(baseUrl + '/api/public/widget/' + widgetKey + '/config')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        config = data;
        createStyles();
        createWidget();
      })
      .catch(function(err) {
        console.error('SCW config error:', err);
      });
  }
  
  SCW.init = init;
  
  if (SCW.q) {
    for (var i = 0; i < SCW.q.length; i++) {
      var args = SCW.q[i];
      if (args[0] === 'init') {
        init(args[1]);
      }
    }
  }
  
  window.SmartCatalogWidget = SCW;
})();
