/*
 * Site2Chat embeddable widget.
 * Usage:
 *   <script src="https://YOUR-FRONTEND/widget.js"
 *           data-chatbot-id="CHATBOT_UUID"
 *           data-chatbot-name="Business assistant" defer></script>
 *
 * Renders inside a Shadow DOM so the host page's CSS can't affect it and it
 * can't affect the host page. The chat itself is an iframe of this app's
 * /chat/:chatbotId route. No extra backend endpoint is needed.
 */
(function () {
  "use strict";

  if (window.__site2chatWidget) return;

  var script = document.currentScript || document.querySelector("script[data-chatbot-id]");
  if (!script) return;

  var chatbotId = (script.getAttribute("data-chatbot-id") || "").trim();
  var name = (script.getAttribute("data-chatbot-name") || "").trim() || "Website assistant";
  var uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuid.test(chatbotId)) {
    if (window.console) console.warn("[Site2Chat] data-chatbot-id is missing or invalid.");
    return;
  }

  var origin;
  try {
    origin = new URL(script.src, window.location.href).origin;
  } catch (e) {
    return;
  }

  window.__site2chatWidget = true;

  var chatUrl =
    origin + "/chat/" + encodeURIComponent(chatbotId) + "?embed=1&name=" + encodeURIComponent(name);

  var host = document.createElement("div");
  host.setAttribute("data-site2chat", "");
  var root = host.attachShadow({ mode: "open" });

  var css =
    ":host{all:initial}" +
    "*{box-sizing:border-box;font-family:system-ui,-apple-system,'Segoe UI',sans-serif}" +
    ".launcher{position:fixed;right:20px;bottom:20px;z-index:2147483000;width:56px;height:56px;border-radius:50%;" +
    "border:0;background:#14241b;color:#7bd99a;cursor:pointer;display:flex;align-items:center;justify-content:center;" +
    "box-shadow:0 8px 24px rgba(20,36,27,.28);transition:transform .18s ease}" +
    ".launcher:hover{transform:scale(1.05)}" +
    ".launcher:focus-visible,.close:focus-visible{outline:2px solid #7bd99a;outline-offset:2px}" +
    ".panel{position:fixed;right:20px;bottom:88px;z-index:2147483000;width:380px;height:min(640px,calc(100vh - 110px));" +
    "background:#faf8f3;border-radius:16px;overflow:hidden;display:none;flex-direction:column;" +
    "box-shadow:0 16px 48px rgba(20,36,27,.28);border:1px solid #e6e2d7}" +
    ".panel.open{display:flex}" +
    ".bar{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px 10px 16px;" +
    "background:#14241b;color:#fff;font-size:14px;font-weight:600}" +
    ".bar span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
    ".close{border:0;background:transparent;color:#fff;cursor:pointer;width:32px;height:32px;border-radius:8px;" +
    "display:flex;align-items:center;justify-content:center;flex:none}" +
    ".close:hover{background:rgba(255,255,255,.14)}" +
    "iframe{border:0;width:100%;flex:1;background:#faf8f3}" +
    "@media (max-width:520px){.panel{right:0;bottom:0;left:0;top:0;width:100%;height:100%;border-radius:0;border:0}" +
    ".launcher.hidden{display:none}}" +
    "@media (prefers-reduced-motion:reduce){.launcher{transition:none}}";

  var style = document.createElement("style");
  style.textContent = css;

  var svgChat =
    '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>';
  var svgClose =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';

  var launcher = document.createElement("button");
  launcher.className = "launcher";
  launcher.type = "button";
  launcher.setAttribute("aria-label", "Open chat with " + name);
  launcher.setAttribute("aria-expanded", "false");
  launcher.innerHTML = svgChat;

  var panel = document.createElement("div");
  panel.className = "panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", name);

  var bar = document.createElement("div");
  bar.className = "bar";
  var title = document.createElement("span");
  title.textContent = name;
  var close = document.createElement("button");
  close.className = "close";
  close.type = "button";
  close.setAttribute("aria-label", "Close chat");
  close.innerHTML = svgClose;
  bar.appendChild(title);
  bar.appendChild(close);
  panel.appendChild(bar);

  var frame = null;

  function setOpen(open) {
    if (open && !frame) {
      frame = document.createElement("iframe");
      frame.src = chatUrl;
      frame.title = name + " chat";
      frame.setAttribute("loading", "lazy");
      panel.appendChild(frame);
    }
    panel.classList.toggle("open", open);
    launcher.classList.toggle("hidden", open);
    launcher.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) close.focus();
    else launcher.focus();
  }

  launcher.addEventListener("click", function () {
    setOpen(true);
  });
  close.addEventListener("click", function () {
    setOpen(false);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && panel.classList.contains("open")) setOpen(false);
  });

  root.appendChild(style);
  root.appendChild(launcher);
  root.appendChild(panel);

  function mount() {
    document.body.appendChild(host);
  }
  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);
})();
