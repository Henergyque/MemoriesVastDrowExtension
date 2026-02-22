/* ── Memories — app.js ─────────────────────────────────────
   Whiteboard infini partagé, optimisé mobile (tactile fluide)
   avec envoi de dessin + notification push.
───────────────────────────────────────────────────────────── */

/* ── Éléments DOM ──────────────────────────────────────── */
const entryEl = document.getElementById("entry");
const pseudoInput = document.getElementById("pseudo-input");
const codeInput = document.getElementById("code-input");
const joinBtn = document.getElementById("join-btn");

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d", { desynchronized: true });

const toolbar = document.getElementById("toolbar");
const colorPicker = document.getElementById("color-picker");
const sizeRange = document.getElementById("size-range");
const opacityRange = document.getElementById("opacity-range");
const sendBtn = document.getElementById("send-btn");
const clearBtn = document.getElementById("clear-btn");

const usersBadge = document.getElementById("users-badge");
const userCountEl = document.getElementById("user-count");
const userListEl = document.getElementById("user-list");

const receivedModal = document.getElementById("received-modal");
const receivedFrom = document.getElementById("received-from");
const receivedImage = document.getElementById("received-image");
const receivedDownload = document.getElementById("received-download");
const receivedClose = document.getElementById("received-close");

const tutorial = document.getElementById("tutorial");
const tutorialClose = document.getElementById("tutorial-close");

const toasts = document.getElementById("toasts");
const connectionStatus = document.getElementById("connection-status");

/* ── Utilitaires ───────────────────────────────────────── */
const showToast = (message) => {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  toasts.appendChild(toast);
  setTimeout(() => toast.remove(), 2600);
};

const updateConnectionStatus = (text) => {
  if (connectionStatus) connectionStatus.textContent = text;
};

/* ── Socket.io ─────────────────────────────────────────── */
updateConnectionStatus("Serveur: script chargé");

const socket = window.io
  ? window.io()
  : { connected: false, emit: () => {}, on: () => {} };

if (!window.io) {
  updateConnectionStatus("Serveur: script socket.io manquant");
  showToast("Ouvre l'app via localhost:3000 (pas en fichier local).");
} else {
  updateConnectionStatus("Serveur: connexion...");
}

/* ── État du dessin ────────────────────────────────────── */
let strokes = [];
let isDrawing = false;
let isPanning = false;
let lastPoint = null;
let lastPan = null;
let isSpacePressed = false;
let maintenanceActive = false;
let currentSessionCode = null;

let width = 0;
let height = 0;
let scale = 1;
let offsetX = 0;
let offsetY = 0;
let needsRedraw = false;
const MIN_DISTANCE = 0.3;
const MIN_DRAW_SCALE = 0.05;
const MAX_SEGMENT_LENGTH = 300;
let lastScaleToast = 0;

/* ── Multi-touch (pinch zoom + 2-finger pan) ───────────── */
const activePointers = new Map();
let pinchStartDist = 0;
let pinchStartScale = 1;
let pinchCenter = null;
let touchMode = "none"; // "none" | "draw" | "gesture"

const getDistance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
const getCenter = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/* ── Canvas ────────────────────────────────────────────── */
const resizeCanvas = () => {
  const prevW = width;
  const prevH = height;
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;

  if (prevW && prevH) {
    offsetX += (width - prevW) / 2;
    offsetY += (height - prevH) / 2;
  } else {
    offsetX = width / 2;
    offsetY = height / 2;
  }
  requestRedraw();
};

const applyTransform = () => {
  ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
};

const screenToWorld = (x, y) => ({
  x: (x - offsetX) / scale,
  y: (y - offsetY) / scale,
});

const drawSegment = (seg) => {
  applyTransform();
  ctx.strokeStyle = seg.color;
  ctx.globalAlpha = seg.opacity;
  ctx.lineWidth = seg.size / scale;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(seg.x1, seg.y1);
  ctx.lineTo(seg.x2, seg.y2);
  ctx.stroke();
  ctx.globalAlpha = 1;
};

const redrawAll = () => {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  strokes.forEach(drawSegment);
  needsRedraw = false;
};

const requestRedraw = () => {
  if (needsRedraw) return;
  needsRedraw = true;
  requestAnimationFrame(redrawAll);
};

/* ── UI utilitaires ────────────────────────────────────── */
const setUserList = (users, count, limit) => {
  userListEl.innerHTML = "";
  users.forEach((u) => {
    const li = document.createElement("li");
    li.textContent = u;
    userListEl.appendChild(li);
  });
  userCountEl.textContent = `${count}/${limit}`;
};

/* ── Keyboard (desktop) ───────────────────────────────── */
window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    isSpacePressed = true;
    if (!isPanning && !isDrawing) canvas.style.cursor = "grab";
  }
});
window.addEventListener("keyup", (e) => {
  if (e.code === "Space") {
    isSpacePressed = false;
    if (!isPanning && !isDrawing) canvas.style.cursor = "crosshair";
  }
});

document.addEventListener("contextmenu", (e) => {
  if (e.target === canvas) e.preventDefault();
});

/* ── Pointer events (unifié desktop + mobile) ──────────── */
const handlePointerDown = (e) => {
  // Empêcher scroll / zoom navigateur
  e.preventDefault();
  canvas.setPointerCapture(e.pointerId);
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (activePointers.size >= 2) {
    // Passage en mode gesture (pinch / pan 2 doigts)
    // Annuler tout dessin en cours
    isDrawing = false;
    lastPoint = null;
    touchMode = "gesture";

    const pts = Array.from(activePointers.values());
    pinchStartDist = getDistance(pts[0], pts[1]);
    pinchStartScale = scale;
    pinchCenter = getCenter(pts[0], pts[1]);
    lastPan = { ...pinchCenter };
    return;
  }

  // 1 seul pointeur
  // Desktop : clic droit / milieu / espace → pan
  if (e.button === 1 || (e.button === 0 && isSpacePressed) || e.button === 2) {
    touchMode = "gesture";
    isPanning = true;
    lastPan = { x: e.clientX, y: e.clientY };
    canvas.style.cursor = "grabbing";
    return;
  }

  if (e.button !== 0) return;

  if (scale < MIN_DRAW_SCALE) {
    const now = Date.now();
    if (now - lastScaleToast > 1200) {
      showToast("Trop dézoomé pour dessiner. Zoom un peu.");
      lastScaleToast = now;
    }
    return;
  }

  touchMode = "draw";
  isDrawing = true;
  lastPoint = screenToWorld(e.clientX, e.clientY);
};

const handlePointerMove = (e) => {
  e.preventDefault();
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  // ── Mode 2-doigts : pinch-zoom + pan ──
  if (touchMode === "gesture" && activePointers.size >= 2) {
    const pts = Array.from(activePointers.values());
    const newDist = getDistance(pts[0], pts[1]);
    const newCenter = getCenter(pts[0], pts[1]);

    // Zoom (pinch)
    const zoomFactor = newDist / pinchStartDist;
    const newScale = Math.min(500, Math.max(0.0025, pinchStartScale * zoomFactor));

    // Appliquer le zoom centré sur le pinch
    const cx = newCenter.x;
    const cy = newCenter.y;
    const worldBefore = {
      x: (cx - offsetX) / scale,
      y: (cy - offsetY) / scale,
    };
    scale = newScale;
    offsetX = cx - worldBefore.x * scale;
    offsetY = cy - worldBefore.y * scale;

    // Pan (déplacement du centre)
    if (lastPan) {
      offsetX += newCenter.x - lastPan.x;
      offsetY += newCenter.y - lastPan.y;
    }
    lastPan = { ...newCenter };

    requestRedraw();
    return;
  }

  // ── Mode pan 1 doigt (clic droit desktop, etc.) ──
  if (isPanning && lastPan) {
    offsetX += e.clientX - lastPan.x;
    offsetY += e.clientY - lastPan.y;
    lastPan = { x: e.clientX, y: e.clientY };
    requestRedraw();
    return;
  }

  // ── Mode dessin ──
  if (!isDrawing || !lastPoint) return;
  if (scale < MIN_DRAW_SCALE) return;

  const samples = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];

  samples.forEach((sample) => {
    if (!lastPoint) return;
    const current = screenToWorld(sample.clientX, sample.clientY);
    const dx = current.x - lastPoint.x;
    const dy = current.y - lastPoint.y;
    if (dx * dx + dy * dy < MIN_DISTANCE * MIN_DISTANCE) return;

    const dist = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(dist / MAX_SEGMENT_LENGTH));
    const stepX = dx / steps;
    const stepY = dy / steps;

    for (let i = 0; i < steps; i++) {
      const next = { x: lastPoint.x + stepX, y: lastPoint.y + stepY };
      const seg = {
        x1: lastPoint.x,
        y1: lastPoint.y,
        x2: next.x,
        y2: next.y,
        color: colorPicker.value,
        size: Number(sizeRange.value),
        opacity: Number(opacityRange.value),
      };
      strokes.push(seg);
      drawSegment(seg);
      socket.emit("draw", seg);
      lastPoint = next;
    }
    lastPoint = current;
  });
};

const handlePointerUp = (e) => {
  activePointers.delete(e.pointerId);

  if (activePointers.size < 2) {
    isPanning = false;
    lastPan = null;
    pinchCenter = null;
  }

  if (activePointers.size === 0) {
    isDrawing = false;
    isPanning = false;
    lastPoint = null;
    lastPan = null;
    touchMode = "none";
    canvas.style.cursor = isSpacePressed ? "grab" : "crosshair";
  }
};

/* ── Molette (zoom desktop) ────────────────────────────── */
const handleWheel = (e) => {
  e.preventDefault();
  const zoom = 1 + 0.1 * (e.deltaY < 0 ? 1 : -1);
  const worldBefore = screenToWorld(e.clientX, e.clientY);
  scale = Math.min(500, Math.max(0.0025, scale * zoom));
  offsetX = e.clientX - worldBefore.x * scale;
  offsetY = e.clientY - worldBefore.y * scale;
  requestRedraw();
};

/* ── Capture canvas → image format fond d'écran iPhone ──── */
const WALLPAPER_W = 1170;
const WALLPAPER_H = 2532;

const captureCanvas = () => {
  // Créer un canvas hors-écran aux dimensions fond d'écran iPhone
  const offscreen = document.createElement("canvas");
  offscreen.width = WALLPAPER_W;
  offscreen.height = WALLPAPER_H;
  const offCtx = offscreen.getContext("2d");

  // Fond blanc
  offCtx.fillStyle = "#ffffff";
  offCtx.fillRect(0, 0, WALLPAPER_W, WALLPAPER_H);

  // Calculer la zone visible du canvas actuel en coordonnées monde
  const topLeft = screenToWorld(0, 0);
  const bottomRight = screenToWorld(width, height);
  const viewW = bottomRight.x - topLeft.x;
  const viewH = bottomRight.y - topLeft.y;

  // Scale pour remplir le format portrait (cover)
  const scaleX = WALLPAPER_W / viewW;
  const scaleY = WALLPAPER_H / viewH;
  const fitScale = Math.max(scaleX, scaleY); // cover

  // Centrer le dessin
  const drawW = viewW * fitScale;
  const drawH = viewH * fitScale;
  const ox = (WALLPAPER_W - drawW) / 2;
  const oy = (WALLPAPER_H - drawH) / 2;

  // Dessiner tous les traits
  strokes.forEach((seg) => {
    offCtx.save();
    offCtx.translate(ox, oy);
    offCtx.scale(fitScale, fitScale);
    offCtx.translate(-topLeft.x, -topLeft.y);
    offCtx.strokeStyle = seg.color;
    offCtx.globalAlpha = seg.opacity;
    offCtx.lineWidth = seg.size / scale;
    offCtx.lineCap = "round";
    offCtx.lineJoin = "round";
    offCtx.beginPath();
    offCtx.moveTo(seg.x1, seg.y1);
    offCtx.lineTo(seg.x2, seg.y2);
    offCtx.stroke();
    offCtx.restore();
  });

  return offscreen.toDataURL("image/png");
};

/* ── Envoi du dessin ───────────────────────────────────── */
const sendDrawing = () => {
  if (!socket.connected) {
    showToast("Pas connecté au serveur.");
    return;
  }
  if (!currentSessionCode) {
    showToast("Rejoins une session d'abord.");
    return;
  }

  sendBtn.disabled = true;
  sendBtn.textContent = "⏳";

  const image = captureCanvas();
  socket.emit("send_drawing", { image });
};

/* ── Réception d'un dessin ─────────────────────────────── */
const showReceivedDrawing = (data) => {
  receivedFrom.textContent = `${data.from} t'a envoyé un dessin !`;
  receivedImage.src = data.image;
  receivedDownload.href = data.image;
  receivedModal.classList.remove("hidden");

  // Notification navigateur
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("Nouveau dessin !", {
      body: `${data.from} t'a envoyé un dessin`,
      icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎨</text></svg>",
    });
  }
};

/* ── Effacer le canvas ─────────────────────────────────── */
const clearCanvasLocal = () => {
  if (!confirm("Effacer tout le tableau ? (pour les 2)")) return;
  socket.emit("clear_canvas");
};

/* ── Bannière de permission notifications ──────────────── */
const showNotifBanner = () => {
  const banner = document.createElement("div");
  banner.className = "notif-banner";
  banner.innerHTML = `
    <p>Activer les notifications pour recevoir les dessins ?</p>
    <div class="notif-banner-btns">
      <button id="notif-yes" class="notif-btn notif-btn-yes">Oui !</button>
      <button id="notif-no" class="notif-btn">Plus tard</button>
    </div>
  `;
  document.body.appendChild(banner);

  banner.querySelector("#notif-yes").addEventListener("click", () => {
    Notification.requestPermission().then((perm) => {
      if (perm === "granted") {
        showToast("Notifications activées !");
      } else {
        showToast("Notifications refusées.");
      }
    });
    banner.remove();
  });

  banner.querySelector("#notif-no").addEventListener("click", () => {
    banner.remove();
  });
};

/* ── Événements UI ─────────────────────────────────────── */
sendBtn.addEventListener("click", sendDrawing);
clearBtn.addEventListener("click", clearCanvasLocal);

receivedClose.addEventListener("click", () => {
  receivedModal.classList.add("hidden");
});

tutorialClose.addEventListener("click", () => {
  tutorial.classList.add("hidden");
});

/* ── Join ───────────────────────────────────────────────── */
joinBtn.addEventListener("click", () => {
  const pseudo = pseudoInput.value.trim();
  const code = codeInput.value.trim();

  if (!socket.connected) {
    showToast("Connexion au serveur impossible.");
    return;
  }
  if (!pseudo) {
    showToast("Pseudo obligatoire.");
    return;
  }
  if (!/^\d{5,6}$/.test(code)) {
    showToast("Code à 5-6 chiffres requis.");
    return;
  }
  if (maintenanceActive && !(pseudo.toLowerCase() === "admin")) {
    showToast("Maintenance en cours.");
    return;
  }

  socket.emit("join", { pseudo, code, maintenanceCode: code });
});

/* ── Événements Socket.io ──────────────────────────────── */
socket.on("connect", () => updateConnectionStatus("Serveur: connecté"));
socket.on("disconnect", () => updateConnectionStatus("Serveur: déconnecté"));
socket.on("connect_error", () => {
  updateConnectionStatus("Serveur: erreur de connexion");
  showToast("Impossible de joindre le serveur.");
});

socket.on("join_error", (msg) => {
  if (typeof msg === "string" && msg.toLowerCase().includes("maintenance")) {
    maintenanceActive = true;
    updateConnectionStatus("Serveur: maintenance");
  }
  showToast(msg);
});

socket.on("maintenance_status", (payload) => {
  maintenanceActive = Boolean(payload?.enabled);
  updateConnectionStatus(maintenanceActive ? "Serveur: maintenance" : "Serveur: connecté");
  if (maintenanceActive && payload?.message) showToast(payload.message);
});

socket.on("init", (payload) => {
  entryEl.classList.add("hidden");
  toolbar.classList.remove("hidden");
  usersBadge.classList.remove("hidden");
  currentSessionCode = payload.code;
  strokes = payload.strokes || [];
  setUserList(payload.users || [], payload.count || 0, payload.limit || 2);
  requestRedraw();

  // Montrer la bannière de demande de notifications
  if ("Notification" in window && Notification.permission === "default") {
    showNotifBanner();
  }

  // Montrer le tutorial au premier lancement
  if (!localStorage.getItem("memories_tutorial_seen")) {
    tutorial.classList.remove("hidden");
    localStorage.setItem("memories_tutorial_seen", "1");
  }
});

socket.on("user_list", (payload) => {
  setUserList(payload.users || [], payload.count || 0, payload.limit || 2);
});

socket.on("draw", (seg) => {
  strokes.push(seg);
  drawSegment(seg);
});

socket.on("canvas_cleared", () => {
  strokes = [];
  requestRedraw();
  showToast("Tableau effacé.");
});

socket.on("receive_drawing", (data) => {
  showReceivedDrawing(data);
});

socket.on("drawing_sent", () => {
  sendBtn.disabled = false;
  sendBtn.textContent = "📩";
  showToast("Dessin envoyé !");
});

/* ── Bindind canvas events ─────────────────────────────── */
canvas.style.touchAction = "none"; // Critique pour le tactile iOS

canvas.addEventListener("pointerdown", handlePointerDown);
canvas.addEventListener("pointermove", handlePointerMove);
canvas.addEventListener("pointerup", handlePointerUp);
canvas.addEventListener("pointercancel", handlePointerUp);
canvas.addEventListener("pointerleave", handlePointerUp);
canvas.addEventListener("wheel", handleWheel, { passive: false });

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

/* ── Service Worker (PWA) ──────────────────────────────── */
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}

/* ── Checks ────────────────────────────────────────────── */
if (window.location.protocol === "file:") {
  showToast("Ouvre l'app via localhost:3000, pas en fichier local.");
}

setTimeout(() => {
  if (!socket.connected) {
    showToast("Toujours pas connecté. Vérifie que le serveur tourne.");
  }
}, 1500);
