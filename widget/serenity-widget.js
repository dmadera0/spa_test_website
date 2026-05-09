/**
 * Serenity Spa & Wellness — Chat Widget
 * serenity-widget.js
 */
(function (global) {
  'use strict';

  var cfg = {};
  var sessionId = null;
  var isOpen = false;
  var isTyping = false;
  var messageHistory = [];

  function uid() {
    return 'sess-' + Math.random().toString(36).slice(2, 10) + '-' + Date.now();
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function shadeColor(hex, pct) {
    var num = parseInt(hex.replace('#', ''), 16);
    var r = Math.min(255, Math.max(0, (num >> 16) + pct));
    var g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + pct));
    var b = Math.min(255, Math.max(0, (num & 0xff) + pct));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  function injectStyles(primary, accent) {
    var style = document.createElement('style');
    style.id = 'serenity-widget-styles';
    style.textContent = ':root{--sw-primary:' + primary + ';--sw-primary-dark:' + shadeColor(primary, -20) + ';--sw-accent:' + accent + ';--sw-surface:#ffffff;--sw-bg:#faf9f7;--sw-border:#e8e2da;--sw-text:#2d2d2d;--sw-text-light:#6b6b7b;--sw-radius:16px;--sw-shadow:0 8px 40px rgba(0,0,0,0.18);}#sw-launcher{position:fixed;bottom:24px;right:24px;width:58px;height:58px;border-radius:50%;background:var(--sw-primary);border:none;cursor:pointer;box-shadow:0 4px 20px rgba(107,91,149,0.45);display:flex;align-items:center;justify-content:center;transition:transform .2s ease,box-shadow .2s ease;z-index:99999;outline:none;}#sw-launcher:hover{transform:scale(1.08);box-shadow:0 6px 28px rgba(107,91,149,0.55);}#sw-launcher:active{transform:scale(0.96);}#sw-launcher.open svg.icon-chat{display:none;}#sw-launcher.open svg.icon-close{display:block !important;}#sw-badge{position:absolute;top:-4px;right:-4px;background:var(--sw-accent);color:#fff;width:18px;height:18px;border-radius:50%;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;border:2px solid #fff;pointer-events:none;}#sw-panel{position:fixed;bottom:96px;right:24px;width:360px;max-width:calc(100vw - 32px);height:520px;max-height:calc(100vh - 120px);background:var(--sw-surface);border-radius:var(--sw-radius);box-shadow:var(--sw-shadow);display:flex;flex-direction:column;overflow:hidden;z-index:99998;transform:translateY(12px) scale(0.97);opacity:0;pointer-events:none;transition:transform .25s cubic-bezier(.34,1.56,.64,1),opacity .2s ease;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;}#sw-panel.visible{transform:translateY(0) scale(1);opacity:1;pointer-events:auto;}#sw-header{background:linear-gradient(135deg,var(--sw-primary-dark),var(--sw-primary));padding:16px 18px;display:flex;align-items:center;gap:12px;flex-shrink:0;}#sw-avatar{width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;}#sw-header-text{flex:1;}#sw-agent-name{font-size:14px;font-weight:600;color:#fff;line-height:1.2;}#sw-status{font-size:11px;color:rgba(255,255,255,0.75);display:flex;align-items:center;gap:5px;}.sw-dot{width:7px;height:7px;border-radius:50%;background:#6ee7b7;display:inline-block;}#sw-close-btn{background:none;border:none;cursor:pointer;color:rgba(255,255,255,0.8);padding:4px;border-radius:6px;display:flex;align-items:center;justify-content:center;transition:background .15s;}#sw-close-btn:hover{background:rgba(255,255,255,0.15);}#sw-messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;scroll-behavior:smooth;}#sw-messages::-webkit-scrollbar{width:4px;}#sw-messages::-webkit-scrollbar-thumb{background:var(--sw-border);border-radius:4px;}.sw-msg{display:flex;gap:8px;max-width:85%;animation:swFadeUp .2s ease both;}.sw-msg.user{align-self:flex-end;flex-direction:row-reverse;}.sw-msg-bubble{padding:10px 14px;border-radius:14px;font-size:13.5px;line-height:1.55;word-break:break-word;}.sw-msg.bot .sw-msg-bubble{background:var(--sw-bg);border:1px solid var(--sw-border);color:var(--sw-text);border-bottom-left-radius:4px;}.sw-msg.user .sw-msg-bubble{background:var(--sw-primary);color:#fff;border-bottom-right-radius:4px;}.sw-msg-icon{width:28px;height:28px;border-radius:50%;flex-shrink:0;background:var(--sw-bg);border:1px solid var(--sw-border);display:flex;align-items:center;justify-content:center;font-size:13px;align-self:flex-end;}#sw-typing{display:flex;gap:8px;max-width:85%;padding:0;}#sw-typing .sw-msg-bubble{display:flex;gap:5px;align-items:center;padding:10px 14px;}.sw-dot-anim{width:7px;height:7px;border-radius:50%;background:var(--sw-text-light);animation:swBounce 1.2s infinite ease-in-out;}.sw-dot-anim:nth-child(2){animation-delay:.2s;}.sw-dot-anim:nth-child(3){animation-delay:.4s;}#sw-input-area{padding:12px 14px;border-top:1px solid var(--sw-border);display:flex;gap:8px;align-items:flex-end;background:var(--sw-surface);flex-shrink:0;}#sw-input{flex:1;resize:none;border:1.5px solid var(--sw-border);border-radius:10px;padding:9px 12px;font-size:13.5px;font-family:inherit;color:var(--sw-text);background:var(--sw-bg);outline:none;max-height:100px;overflow-y:auto;line-height:1.5;transition:border-color .15s;}#sw-input:focus{border-color:var(--sw-primary);}#sw-input::placeholder{color:var(--sw-text-light);}#sw-send{width:36px;height:36px;border-radius:50%;background:var(--sw-primary);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background .15s,transform .1s;}#sw-send:hover{background:var(--sw-primary-dark);}#sw-send:active{transform:scale(0.93);}#sw-send:disabled{background:var(--sw-border);cursor:default;}#sw-footer{text-align:center;padding:6px 0 10px;font-size:10.5px;color:var(--sw-text-light);}#sw-footer a{color:var(--sw-primary);text-decoration:none;}@keyframes swFadeUp{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:none;}}@keyframes swBounce{0%,60%,100%{transform:translateY(0);}30%{transform:translateY(-5px);}}@media(max-width:480px){#sw-panel{right:12px;bottom:88px;width:calc(100vw - 24px);}#sw-launcher{right:16px;bottom:16px;}}';
    document.head.appendChild(style);
  }

  function buildWidget() {
    var launcher = document.createElement('button');
    launcher.id = 'sw-launcher';
    launcher.setAttribute('aria-label', 'Open chat');
    launcher.innerHTML = '<svg class="icon-chat" width="24" height="24" fill="none" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg><svg class="icon-close" width="20" height="20" fill="none" viewBox="0 0 24 24" style="display:none"><path d="M18 6 6 18M6 6l12 12" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></svg><span id="sw-badge" style="display:none">1</span>';

    var panel = document.createElement('div');
    panel.id = 'sw-panel';
    panel.setAttribute('role', 'dialog');
    panel.innerHTML = '<div id="sw-header"><div id="sw-avatar">🌿</div><div id="sw-header-text"><div id="sw-agent-name">' + escapeHtml(cfg.agentName) + '</div><div id="sw-status"><span class="sw-dot"></span>Online now</div></div><button id="sw-close-btn" aria-label="Close chat"><svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg></button></div><div id="sw-messages" role="log" aria-live="polite"></div><div id="sw-input-area"><textarea id="sw-input" placeholder="Type a message…" rows="1" maxlength="2000"></textarea><button id="sw-send" disabled><svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="m22 2-11 11M22 2 15 22l-4-9-9-4 20-7z" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div><div id="sw-footer">Powered by <a href="#" tabindex="-1">Serenity Spa</a></div>';

    document.body.appendChild(launcher);
    document.body.appendChild(panel);

    launcher.addEventListener('click', togglePanel);
    panel.querySelector('#sw-close-btn').addEventListener('click', closePanel);

    var input = panel.querySelector('#sw-input');
    var sendBtn = panel.querySelector('#sw-send');

    input.addEventListener('input', function () {
      sendBtn.disabled = !input.value.trim();
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 100) + 'px';
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!sendBtn.disabled) sendMessage();
      }
    });

    sendBtn.addEventListener('click', sendMessage);
  }

  function openPanel() {
    isOpen = true;
    document.getElementById('sw-panel').classList.add('visible');
    document.getElementById('sw-launcher').classList.add('open');
    document.getElementById('sw-launcher').setAttribute('aria-label', 'Close chat');
    document.getElementById('sw-badge').style.display = 'none';
    document.getElementById('sw-input').focus();
  }

  function closePanel() {
    isOpen = false;
    document.getElementById('sw-panel').classList.remove('visible');
    document.getElementById('sw-launcher').classList.remove('open');
    document.getElementById('sw-launcher').setAttribute('aria-label', 'Open chat');
  }

  function togglePanel() {
    if (isOpen) closePanel(); else openPanel();
  }

  function appendMessage(role, text) {
    var msgs = document.getElementById('sw-messages');
    var typing = document.getElementById('sw-typing');
    if (typing) typing.remove();
    var wrap = document.createElement('div');
    wrap.className = 'sw-msg ' + role;
    var icon = role === 'bot' ? '<div class="sw-msg-icon">🌿</div>' : '';
    var safe = escapeHtml(text).replace(/\n/g, '<br>');
    wrap.innerHTML = icon + '<div class="sw-msg-bubble">' + safe + '</div>';
    msgs.appendChild(wrap);
    msgs.scrollTop = msgs.scrollHeight;
    messageHistory.push({ role: role, text: text });
  }

  function showTyping() {
    var msgs = document.getElementById('sw-messages');
    var el = document.createElement('div');
    el.id = 'sw-typing';
    el.className = 'sw-msg bot';
    el.innerHTML = '<div class="sw-msg-icon">🌿</div><div class="sw-msg-bubble"><span class="sw-dot-anim"></span><span class="sw-dot-anim"></span><span class="sw-dot-anim"></span></div>';
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function sendMessage() {
    var input = document.getElementById('sw-input');
    var sendBtn = document.getElementById('sw-send');
    var text = input.value.trim();
    if (!text || isTyping) return;

    input.value = '';
    input.style.height = 'auto';
    sendBtn.disabled = true;

    appendMessage('user', text);
    isTyping = true;
    showTyping();

    var base = cfg.apiUrl.replace(/\/$/, '');
    var endpoint = base + '/prod/serenity-spa';

    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sessionId, userId: cfg.tenantId, message: text })
    })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        isTyping = false;
        var reply = (data && data.response) ? data.response : 'Sorry, I could not get a response. Please try again.';
        appendMessage('bot', reply);
      })
      .catch(function (err) {
        isTyping = false;
        var typing = document.getElementById('sw-typing');
        if (typing) typing.remove();
        appendMessage('bot', 'Connection failed. Please check your internet and try again.');
      });
  }

  function init(options) {
    if (!options || !options.apiUrl) { console.error('[SerenityWidget] apiUrl is required.'); return; }
    cfg = {
      tenantId: options.tenantId || 'serenity-spa',
      apiUrl: options.apiUrl,
      primaryColor: options.primaryColor || '#6b5b95',
      accentColor: options.accentColor || '#c9b99a',
      agentName: options.agentName || 'Serenity Assistant',
      greetingMessage: options.greetingMessage || 'Welcome! How can we help you today?',
      position: options.position || 'bottom-right',
    };
    sessionId = uid();

    function setup() {
      injectStyles(cfg.primaryColor, cfg.accentColor);
      buildWidget();
      setTimeout(function () {
        appendMessage('bot', cfg.greetingMessage);
        var badge = document.getElementById('sw-badge');
        if (badge && !isOpen) badge.style.display = 'flex';
      }, 800);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setup);
    } else {
      setup();
    }
  }

  global.DemoChat = { init: init };
}(window));
