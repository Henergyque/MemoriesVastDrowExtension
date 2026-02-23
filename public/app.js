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

/* ── Features panel & menu ─────────────────────────────── */
const menuBtn = document.getElementById("menu-btn");
const featuresPanel = document.getElementById("features-panel");
const featuresClose = document.getElementById("features-close");

/* ── Compteur relation ─────────────────────────────────── */
const counterDaysEl = document.getElementById("counter-days");
const counterDetailEl = document.getElementById("counter-detail");
const counterEditBtn = document.getElementById("counter-edit-btn");
const counterModal = document.getElementById("counter-modal");
const counterDateInput = document.getElementById("counter-date-input");
const counterSaveBtn = document.getElementById("counter-save-btn");
const counterCancelBtn = document.getElementById("counter-cancel-btn");

/* ── Heartbeat presence ────────────────────────────────── */
const heartbeatWidget = document.getElementById("heartbeat-widget");
const heartbeatIcon = document.getElementById("heartbeat-icon");
const heartbeatLabel = document.getElementById("heartbeat-label");
const presenceHeart = document.getElementById("presence-heart");
const presenceStatus = document.getElementById("presence-status");
const presenceDetail = document.getElementById("presence-detail");

/* ── Miss you ──────────────────────────────────────────── */
const missBtn = document.getElementById("miss-btn");

/* ── Mood weather ──────────────────────────────────────── */
const moodMyLabel = document.getElementById("mood-my-label");
const moodMyEmoji = document.getElementById("mood-my-emoji");
const moodPartnerLabel = document.getElementById("mood-partner-label");
const moodPartnerEmoji = document.getElementById("mood-partner-emoji");
const moodPicker = document.getElementById("mood-picker");

/* ── Word of the day ───────────────────────────────────── */
const wordMyAuthor = document.getElementById("word-my-author");
const wordMyText = document.getElementById("word-my-text");
const wordPartnerAuthor = document.getElementById("word-partner-author");
const wordPartnerText = document.getElementById("word-partner-text");
const wordInput = document.getElementById("word-input");
const wordSendBtn = document.getElementById("word-send");

/* ── Post-its ──────────────────────────────────────────── */
const postitsList = document.getElementById("postits-list");
const postitInput = document.getElementById("postit-input");
const postitAddBtn = document.getElementById("postit-add");

/* ── Journal ───────────────────────────────────────────── */
const journalPrev = document.getElementById("journal-prev");
const journalNext = document.getElementById("journal-next");
const journalDateLabel = document.getElementById("journal-date-label");
const journalMyAuthor = document.getElementById("journal-my-author");
const journalMyText = document.getElementById("journal-my-text");
const journalPartnerAuthor = document.getElementById("journal-partner-author");
const journalPartnerText = document.getElementById("journal-partner-text");
const journalSave = document.getElementById("journal-save");

/* ── Map ───────────────────────────────────────────────── */
const mapContainer = document.getElementById("map-container");
const mapPlacesList = document.getElementById("map-places-list");
const mapPlaceModal = document.getElementById("map-place-modal");
const mapPlaceName = document.getElementById("map-place-name");
const mapPlaceEmoji = document.getElementById("map-place-emoji");
const mapPlaceSave = document.getElementById("map-place-save");
const mapPlaceCancel = document.getElementById("map-place-cancel");

/* ── Alarm ─────────────────────────────────────────────── */
const alarmTimeDisplay = document.getElementById("alarm-time-display");
const alarmStatus = document.getElementById("alarm-status");
const alarmTimeInput = document.getElementById("alarm-time-input");
const alarmSetBtn = document.getElementById("alarm-set-btn");
const alarmClearBtn = document.getElementById("alarm-clear-btn");

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

/* ── Cadre fond d'écran iPhone (zone de capture) ───── */
const FRAME_RATIO = 2532 / 1170; // ~2.164 ratio iPhone
const FRAME_HALF_W = 400; // demi-largeur en coordonnées monde
const FRAME_HALF_H = FRAME_HALF_W * FRAME_RATIO;

const drawFrame = () => {
  applyTransform();
  ctx.strokeStyle = "rgba(0, 0, 0, 0.15)";
  ctx.lineWidth = 2 / scale;
  ctx.setLineDash([10 / scale, 6 / scale]);
  ctx.beginPath();
  ctx.roundRect(
    -FRAME_HALF_W, -FRAME_HALF_H,
    FRAME_HALF_W * 2, FRAME_HALF_H * 2,
    30 / scale
  );
  ctx.stroke();
  ctx.setLineDash([]);

  // Petit label en haut du cadre
  ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
  ctx.font = `${14 / scale}px -apple-system, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("📱 Zone fond d'écran", 0, -FRAME_HALF_H + 20 / scale);
  ctx.textAlign = "start";
};

const redrawAll = () => {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  drawFrame();
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
  const offscreen = document.createElement("canvas");
  offscreen.width = WALLPAPER_W;
  offscreen.height = WALLPAPER_H;
  const offCtx = offscreen.getContext("2d");

  // Fond blanc
  offCtx.fillStyle = "#ffffff";
  offCtx.fillRect(0, 0, WALLPAPER_W, WALLPAPER_H);

  // Mapper le cadre (zone -FRAME_HALF_W..+FRAME_HALF_W, -FRAME_HALF_H..+FRAME_HALF_H)
  // vers le canvas 1170x2532
  const scaleX = WALLPAPER_W / (FRAME_HALF_W * 2);
  const scaleY = WALLPAPER_H / (FRAME_HALF_H * 2);
  const fitScale = Math.min(scaleX, scaleY);

  strokes.forEach((seg) => {
    offCtx.save();
    offCtx.translate(WALLPAPER_W / 2, WALLPAPER_H / 2);
    offCtx.scale(fitScale, fitScale);
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
  // Ne pas afficher 2 fois par session
  if (document.querySelector(".notif-banner")) return;

  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const banner = document.createElement("div");
  banner.className = "notif-banner";

  if (isIOS) {
    banner.innerHTML = `
      <p>🔔 Pour recevoir les dessins en fond d'écran :</p>
      <p style="font-size:13px;color:rgba(0,0,0,0.6);margin:0">Installe <b>Pushcut</b> depuis l'App Store puis configure le raccourci iOS (voir README)</p>
      <div class="notif-banner-btns">
        <button id="notif-no" class="notif-btn notif-btn-yes">Compris !</button>
      </div>
    `;
  } else {
    banner.innerHTML = `
      <p>🔔 Activer les notifications pour recevoir les dessins ?</p>
      <div class="notif-banner-btns">
        <button id="notif-yes" class="notif-btn notif-btn-yes">Oui !</button>
        <button id="notif-no" class="notif-btn">Plus tard</button>
      </div>
    `;
  }

  document.body.appendChild(banner);

  const yesBtn = banner.querySelector("#notif-yes");
  if (yesBtn) {
    yesBtn.addEventListener("click", () => {
      Notification.requestPermission().then((perm) => {
        showToast(perm === "granted" ? "Notifications activées !" : "Notifications refusées.");
      });
      banner.remove();
    });
  }

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

/* ── Features panel (menu) ─────────────────────────────── */
menuBtn.addEventListener("click", () => {
  featuresPanel.classList.remove("hidden");
  // Init map quand le panel s'ouvre (Leaflet a besoin d'un container visible)
  setTimeout(() => {
    initMap();
    if (leafletMap) leafletMap.invalidateSize();
    renderMapPlaces();
  }, 100);
});

featuresClose.addEventListener("click", () => {
  featuresPanel.classList.add("hidden");
});

/* ── Compteur relation ─────────────────────────────────── */
let sharedDataLocal = {};

const updateCounter = () => {
  const dateStr = sharedDataLocal.relationshipDate;
  if (!dateStr) {
    counterDaysEl.textContent = "—";
    counterDetailEl.textContent = "Définissez votre date pour démarrer le compteur";
    counterEditBtn.textContent = "📅 Définir la date";
    return;
  }

  const start = new Date(dateStr + "T00:00:00");
  const now = new Date();
  const diffMs = now - start;
  const totalDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  counterDaysEl.textContent = totalDays.toLocaleString("fr-FR");

  // Détail : années, mois, jours
  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  let days = now.getDate() - start.getDate();
  if (days < 0) {
    months--;
    const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    days += prevMonth.getDate();
  }
  if (months < 0) {
    years--;
    months += 12;
  }

  const parts = [];
  if (years > 0) parts.push(`${years} an${years > 1 ? "s" : ""}`);
  if (months > 0) parts.push(`${months} mois`);
  if (days > 0) parts.push(`${days} jour${days > 1 ? "s" : ""}`);

  counterDetailEl.textContent = parts.length ? parts.join(", ") : "Aujourd'hui ! 🎉";

  // Milestones spéciaux
  const milestones = [100, 200, 365, 500, 730, 1000, 1095, 1461, 2000];
  if (milestones.includes(totalDays)) {
    counterDetailEl.textContent += ` ✨ ${totalDays} jours !`;
  }

  counterEditBtn.textContent = "📅 Modifier la date";
};

// Mettre à jour le compteur chaque minute
setInterval(updateCounter, 60000);

counterEditBtn.addEventListener("click", () => {
  if (sharedDataLocal.relationshipDate) {
    counterDateInput.value = sharedDataLocal.relationshipDate;
  }
  counterModal.classList.remove("hidden");
});

counterSaveBtn.addEventListener("click", () => {
  const val = counterDateInput.value;
  if (!val) {
    showToast("Choisis une date !");
    return;
  }
  socket.emit("set_shared", { relationshipDate: val });
  counterModal.classList.add("hidden");
  showToast("Date enregistrée 💕");
});

counterCancelBtn.addEventListener("click", () => {
  counterModal.classList.add("hidden");
});

/* ── Heartbeat / Présence ──────────────────────────────── */
let partnerOnline = false;
let myPseudo = "";

const updatePresenceUI = (online, count) => {
  const others = online.filter((u) => u !== myPseudo);
  partnerOnline = others.length > 0;

  if (partnerOnline) {
    const partnerName = others[0];
    heartbeatIcon.textContent = "❤️";
    heartbeatIcon.classList.add("beating");
    heartbeatLabel.textContent = `${partnerName} est là`;
    heartbeatWidget.classList.add("online");

    presenceHeart.textContent = "❤️";
    presenceHeart.classList.add("beating");
    presenceStatus.textContent = `${partnerName} est connecté(e) !`;
    presenceDetail.textContent = "Son cœur bat avec le tien en ce moment 💓";
  } else {
    heartbeatIcon.textContent = "🤍";
    heartbeatIcon.classList.remove("beating");
    heartbeatLabel.textContent = "Hors ligne";
    heartbeatWidget.classList.remove("online");

    presenceHeart.textContent = "🤍";
    presenceHeart.classList.remove("beating");
    presenceStatus.textContent = "Pas encore connecté(e)…";
    presenceDetail.textContent = "Le cœur battra quand l'autre se connecte";
  }
};

// Envoyer un heartbeat ping toutes les 30s
setInterval(() => {
  if (socket.connected && currentSessionCode) {
    socket.emit("heartbeat_ping");
  }
}, 30000);

/* ── Miss you ──────────────────────────────────────────── */
let missCooldown = false;

missBtn.addEventListener("click", () => {
  if (!socket.connected || !currentSessionCode) {
    showToast("Pas connecté.");
    return;
  }
  if (missCooldown) return;

  socket.emit("miss_you");
  missBtn.disabled = true;
  missCooldown = true;
  showToast("💕 Envoyé !");

  // Vibrer sur son propre appareil aussi
  if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

  setTimeout(() => {
    missBtn.disabled = false;
    missCooldown = false;
  }, 5000); // Cooldown 5s
});

const showMissOverlay = (fromName) => {
  // Vibrer le téléphone
  if (navigator.vibrate) {
    navigator.vibrate([200, 100, 200, 100, 300]);
  }

  const overlay = document.createElement("div");
  overlay.className = "miss-overlay";
  overlay.innerHTML = `
    <div class="miss-overlay-content">
      <span class="miss-overlay-emoji">💕</span>
      <div class="miss-overlay-text">${fromName} pense à toi !</div>
    </div>
  `;
  document.body.appendChild(overlay);

  setTimeout(() => overlay.remove(), 2800);

  // Notification navigateur
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("Tu me manques 💕", {
      body: `${fromName} pense fort à toi !`,
    });
  }
};

/* ── Mood weather ──────────────────────────────────────── */
const MOOD_EMOJIS = {
  sunny: "☀️", partly: "⛅", cloudy: "☁️", rainy: "🌧️",
  stormy: "⛈️", rainbow: "🌈", love: "🥰", fire: "🔥",
};

const updateMoodUI = () => {
  const moods = sharedDataLocal.moods || {};
  const today = new Date().toISOString().slice(0, 10);

  // Mon humeur
  const myMood = moods[myPseudo];
  if (myMood && myMood.date === today) {
    moodMyEmoji.textContent = MOOD_EMOJIS[myMood.mood] || "❓";
    // Highlight selected button
    moodPicker.querySelectorAll(".mood-option").forEach((btn) => {
      btn.classList.toggle("selected", btn.dataset.mood === myMood.mood);
    });
  } else {
    moodMyEmoji.textContent = "❓";
    moodPicker.querySelectorAll(".mood-option").forEach((btn) => {
      btn.classList.remove("selected");
    });
  }

  moodMyLabel.textContent = myPseudo || "Moi";

  // Humeur du partenaire
  const otherNames = Object.keys(moods).filter((n) => n !== myPseudo);
  if (otherNames.length > 0) {
    const partnerName = otherNames[0];
    const partnerMood = moods[partnerName];
    moodPartnerLabel.textContent = partnerName;
    if (partnerMood && partnerMood.date === today) {
      moodPartnerEmoji.textContent = MOOD_EMOJIS[partnerMood.mood] || "❓";
    } else {
      moodPartnerEmoji.textContent = "❓";
    }
  } else {
    moodPartnerLabel.textContent = "L'autre";
    moodPartnerEmoji.textContent = "❓";
  }
};

moodPicker.addEventListener("click", (e) => {
  const btn = e.target.closest(".mood-option");
  if (!btn) return;
  const mood = btn.dataset.mood;
  if (!mood || !myPseudo) return;

  const today = new Date().toISOString().slice(0, 10);
  const moods = sharedDataLocal.moods || {};
  moods[myPseudo] = { mood, date: today };

  socket.emit("set_shared", { moods });
  showToast(`Humeur mise à jour : ${MOOD_EMOJIS[mood]}`);
});

/* ── Word of the day ───────────────────────────────────── */
const updateWordUI = () => {
  const words = sharedDataLocal.words || {};
  const today = new Date().toISOString().slice(0, 10);

  // Mon mot
  const myWord = words[myPseudo];
  wordMyAuthor.textContent = myPseudo || "Moi";
  if (myWord && myWord.date === today) {
    wordMyText.textContent = myWord.text;
    wordInput.value = myWord.text;
  } else {
    wordMyText.textContent = "Pas encore de mot…";
    wordInput.value = "";
  }

  // Mot du partenaire
  const otherNames = Object.keys(words).filter((n) => n !== myPseudo);
  if (otherNames.length > 0) {
    const pName = otherNames[0];
    const pWord = words[pName];
    wordPartnerAuthor.textContent = pName;
    if (pWord && pWord.date === today) {
      wordPartnerText.textContent = pWord.text;
    } else {
      wordPartnerText.textContent = "Pas encore de mot…";
    }
  } else {
    wordPartnerAuthor.textContent = "L'autre";
    wordPartnerText.textContent = "Pas encore de mot…";
  }
};

wordSendBtn.addEventListener("click", () => {
  const text = wordInput.value.trim();
  if (!text) {
    showToast("Écris quelque chose !");
    return;
  }
  if (!myPseudo) return;

  const today = new Date().toISOString().slice(0, 10);
  const words = sharedDataLocal.words || {};
  words[myPseudo] = { text, date: today };

  socket.emit("set_shared", { words });
  showToast("Mot du jour envoyé 🌟");
});

wordInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") wordSendBtn.click();
});

/* ── Post-its ──────────────────────────────────────────── */
const POSTIT_COLORS = ["color-yellow", "color-pink", "color-blue", "color-green", "color-purple"];

const renderPostits = () => {
  const postits = sharedDataLocal.postits || [];
  postitsList.innerHTML = "";

  if (postits.length === 0) {
    postitsList.innerHTML = '<div class="postits-empty">Aucun post-it pour l\'instant 📌</div>';
    return;
  }

  postits.forEach((p, i) => {
    const colorClass = POSTIT_COLORS[i % POSTIT_COLORS.length];
    const div = document.createElement("div");
    div.className = `postit-item ${colorClass}`;
    div.innerHTML = `
      <div class="postit-text">${escapeHtml(p.text)}<span class="postit-author">— ${escapeHtml(p.author)}</span></div>
      <button class="postit-delete" data-index="${i}">✕</button>
    `;
    postitsList.appendChild(div);
  });
};

const escapeHtml = (str) =>
  str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

postitAddBtn.addEventListener("click", () => {
  const text = postitInput.value.trim();
  if (!text) return;
  if (!myPseudo) return;

  const postits = sharedDataLocal.postits || [];
  postits.push({ text, author: myPseudo, id: Date.now() });

  socket.emit("set_shared", { postits });
  postitInput.value = "";
  showToast("Post-it ajouté 📝");
});

postitInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") postitAddBtn.click();
});

postitsList.addEventListener("click", (e) => {
  const btn = e.target.closest(".postit-delete");
  if (!btn) return;
  const idx = Number(btn.dataset.index);
  const postits = sharedDataLocal.postits || [];
  if (idx >= 0 && idx < postits.length) {
    postits.splice(idx, 1);
    socket.emit("set_shared", { postits });
  }
});

/* ── Shared Lists (films, restaurants, wishlist) ───────── */
const LISTS_CONFIG = {
  movies: { el: document.getElementById("movies-list"), input: document.getElementById("movies-input"), emoji: "🎬", emptyMsg: "Rien dans la liste pour l'instant 🍿" },
  restaurants: { el: document.getElementById("restaurants-list"), input: document.getElementById("restaurants-input"), emoji: "🍽️", emptyMsg: "Rien dans la liste pour l'instant 🫕" },
  wishlist: { el: document.getElementById("wishlist-list"), input: document.getElementById("wishlist-input"), emoji: "🎁", emptyMsg: "Rien dans la liste pour l'instant 🎀" },
};

const renderSharedList = (key) => {
  const cfg = LISTS_CONFIG[key];
  if (!cfg) return;
  const items = sharedDataLocal[key] || [];
  cfg.el.innerHTML = "";

  if (items.length === 0) {
    cfg.el.innerHTML = `<div class="shared-list-empty">${cfg.emptyMsg}</div>`;
    return;
  }

  items.forEach((item, i) => {
    const div = document.createElement("div");
    div.className = "list-item";
    div.innerHTML = `
      <button class="list-item-check ${item.done ? 'checked' : ''}" data-list="${key}" data-index="${i}">${item.done ? '✓' : ''}</button>
      <span class="list-item-text ${item.done ? 'checked-text' : ''}">${escapeHtml(item.text)}</span>
      <span class="list-item-author">${escapeHtml(item.author || '')}</span>
      <button class="list-item-delete" data-list="${key}" data-index="${i}">✕</button>
    `;
    cfg.el.appendChild(div);
  });
};

const renderAllLists = () => {
  Object.keys(LISTS_CONFIG).forEach(renderSharedList);
};

// Add item
document.querySelectorAll(".list-add-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const key = btn.dataset.list;
    const cfg = LISTS_CONFIG[key];
    if (!cfg) return;
    const text = cfg.input.value.trim();
    if (!text || !myPseudo) return;

    const items = sharedDataLocal[key] || [];
    items.push({ text, author: myPseudo, done: false, id: Date.now() });
    socket.emit("set_shared", { [key]: items });
    cfg.input.value = "";
  });
});

// Enter key for list inputs
Object.values(LISTS_CONFIG).forEach((cfg) => {
  cfg.input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      cfg.input.closest(".list-add-row").querySelector(".list-add-btn").click();
    }
  });
});

// Toggle check and delete
document.addEventListener("click", (e) => {
  const checkBtn = e.target.closest(".list-item-check");
  if (checkBtn) {
    const key = checkBtn.dataset.list;
    const idx = Number(checkBtn.dataset.index);
    const items = sharedDataLocal[key] || [];
    if (idx >= 0 && idx < items.length) {
      items[idx].done = !items[idx].done;
      socket.emit("set_shared", { [key]: items });
    }
    return;
  }

  const delBtn = e.target.closest(".list-item-delete");
  if (delBtn) {
    const key = delBtn.dataset.list;
    const idx = Number(delBtn.dataset.index);
    const items = sharedDataLocal[key] || [];
    if (idx >= 0 && idx < items.length) {
      items.splice(idx, 1);
      socket.emit("set_shared", { [key]: items });
    }
  }
});

/* ── Journal partagé ───────────────────────────────────── */
let journalDate = new Date().toISOString().slice(0, 10);

const formatDateFr = (dateStr) => {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "long" });
};

const updateJournalUI = () => {
  journalDateLabel.textContent = formatDateFr(journalDate);
  journalMyAuthor.textContent = myPseudo || "Moi";

  const journal = sharedDataLocal.journal || {};
  const dayEntry = journal[journalDate] || {};

  // Mon texte
  const myEntry = dayEntry[myPseudo];
  journalMyText.value = myEntry || "";

  // Texte du partenaire
  const otherNames = Object.keys(dayEntry).filter((n) => n !== myPseudo);
  if (otherNames.length > 0) {
    const pName = otherNames[0];
    journalPartnerAuthor.textContent = pName;
    journalPartnerText.textContent = dayEntry[pName] || "Pas encore écrit…";
  } else {
    journalPartnerAuthor.textContent = "L'autre";
    journalPartnerText.textContent = "Pas encore écrit…";
  }

  // Disable next si c'est aujourd'hui
  const today = new Date().toISOString().slice(0, 10);
  journalNext.disabled = journalDate >= today;
};

journalPrev.addEventListener("click", () => {
  const d = new Date(journalDate + "T12:00:00");
  d.setDate(d.getDate() - 1);
  journalDate = d.toISOString().slice(0, 10);
  updateJournalUI();
});

journalNext.addEventListener("click", () => {
  const today = new Date().toISOString().slice(0, 10);
  if (journalDate >= today) return;
  const d = new Date(journalDate + "T12:00:00");
  d.setDate(d.getDate() + 1);
  journalDate = d.toISOString().slice(0, 10);
  updateJournalUI();
});

journalSave.addEventListener("click", () => {
  const text = journalMyText.value.trim();
  if (!myPseudo) return;

  const journal = sharedDataLocal.journal || {};
  if (!journal[journalDate]) journal[journalDate] = {};
  journal[journalDate][myPseudo] = text;

  socket.emit("set_shared", { journal });
  showToast("Journal enregistré 📖");
});

/* ── Map (Leaflet) ─────────────────────────────────────── */
let leafletMap = null;
let mapMarkers = [];
let pendingLatLng = null;
let mapInitialized = false;

const initMap = () => {
  if (mapInitialized || !window.L) return;
  mapInitialized = true;

  leafletMap = L.map(mapContainer, {
    center: [46.6, 2.3], // France centre
    zoom: 3,
    zoomControl: true,
    attributionControl: false,
  });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
  }).addTo(leafletMap);

  leafletMap.on("click", (e) => {
    pendingLatLng = e.latlng;
    mapPlaceName.value = "";
    mapPlaceEmoji.value = "📍";
    mapPlaceModal.classList.remove("hidden");
  });
};

mapPlaceSave.addEventListener("click", () => {
  if (!pendingLatLng) return;
  const name = mapPlaceName.value.trim();
  if (!name) { showToast("Donne un nom au lieu !"); return; }

  const places = sharedDataLocal.places || [];
  places.push({
    name,
    emoji: mapPlaceEmoji.value.trim() || "📍",
    lat: pendingLatLng.lat,
    lng: pendingLatLng.lng,
    author: myPseudo,
    id: Date.now(),
  });

  socket.emit("set_shared", { places });
  mapPlaceModal.classList.add("hidden");
  pendingLatLng = null;
  showToast("Lieu ajouté 🗺️");
});

mapPlaceCancel.addEventListener("click", () => {
  mapPlaceModal.classList.add("hidden");
  pendingLatLng = null;
});

const renderMapPlaces = () => {
  const places = sharedDataLocal.places || [];

  // Clear markers
  mapMarkers.forEach((m) => m.remove());
  mapMarkers = [];

  // Render markers
  if (leafletMap && window.L) {
    places.forEach((p) => {
      const icon = L.divIcon({
        html: `<span style="font-size:24px">${p.emoji}</span>`,
        className: "",
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });
      const marker = L.marker([p.lat, p.lng], { icon }).addTo(leafletMap);
      marker.bindPopup(`<b>${p.emoji} ${p.name}</b><br><small>par ${p.author}</small>`);
      mapMarkers.push(marker);
    });
  }

  // Render list
  mapPlacesList.innerHTML = "";
  places.forEach((p, i) => {
    const div = document.createElement("div");
    div.className = "map-place-item";
    div.innerHTML = `
      <span class="map-place-emoji">${p.emoji}</span>
      <span class="map-place-name">${escapeHtml(p.name)}</span>
      <button class="map-place-delete" data-index="${i}">✕</button>
    `;
    mapPlacesList.appendChild(div);
  });
};

mapPlacesList.addEventListener("click", (e) => {
  const btn = e.target.closest(".map-place-delete");
  if (!btn) return;
  const idx = Number(btn.dataset.index);
  const places = sharedDataLocal.places || [];
  if (idx >= 0 && idx < places.length) {
    places.splice(idx, 1);
    socket.emit("set_shared", { places });
  }
});

/* ── Alarme partagée ───────────────────────────────────── */
let alarmInterval = null;
let alarmRinging = false;

const updateAlarmUI = () => {
  const alarm = sharedDataLocal.alarm;
  if (!alarm || !alarm.time) {
    alarmTimeDisplay.textContent = "Pas d'alarme";
    alarmStatus.textContent = "";
    return;
  }

  alarmTimeDisplay.textContent = alarm.time;
  alarmTimeInput.value = alarm.time;

  // Calculate time remaining
  const now = new Date();
  const [h, m] = alarm.time.split(":").map(Number);
  const target = new Date(now);
  target.setHours(h, m, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);

  const diffMs = target - now;
  const diffH = Math.floor(diffMs / 3600000);
  const diffM = Math.floor((diffMs % 3600000) / 60000);

  if (diffH > 0) {
    alarmStatus.textContent = `Dans ${diffH}h${diffM.toString().padStart(2, "0")}`;
  } else {
    alarmStatus.textContent = `Dans ${diffM} min`;
  }
};

alarmSetBtn.addEventListener("click", () => {
  const time = alarmTimeInput.value;
  if (!time) { showToast("Choisis une heure !"); return; }
  socket.emit("set_shared", { alarm: { time, setBy: myPseudo } });
  showToast("Alarme définie ⏰");
});

alarmClearBtn.addEventListener("click", () => {
  socket.emit("set_shared", { alarm: null });
  showToast("Alarme supprimée");
});

const checkAlarm = () => {
  const alarm = sharedDataLocal.alarm;
  if (!alarm || !alarm.time || alarmRinging) return;

  const now = new Date();
  const [h, m] = alarm.time.split(":").map(Number);
  if (now.getHours() === h && now.getMinutes() === m) {
    triggerAlarm(alarm.time);
  }

  updateAlarmUI();
};

const triggerAlarm = (time) => {
  alarmRinging = true;

  if (navigator.vibrate) {
    navigator.vibrate([500, 200, 500, 200, 500, 200, 500]);
  }

  const overlay = document.createElement("div");
  overlay.className = "alarm-overlay";
  overlay.innerHTML = `
    <span class="alarm-overlay-emoji">⏰</span>
    <div class="alarm-overlay-time">${time}</div>
    <div class="alarm-overlay-text">C'est l'heure ! 🌅</div>
    <button class="alarm-dismiss-btn">Arrêter</button>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector(".alarm-dismiss-btn").addEventListener("click", () => {
    overlay.remove();
    alarmRinging = false;
  });

  // Auto-dismiss after 60s
  setTimeout(() => {
    if (overlay.parentNode) overlay.remove();
    alarmRinging = false;
  }, 60000);

  // Notification
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("⏰ Alarme !", { body: `C'est l'heure ! ${time}` });
  }
};

// Check alarm every 15 seconds
setInterval(checkAlarm, 15000);

/* ── Marcel la crevette 🦐 ─────────────────────────────── */
const marcelSprite = document.getElementById("marcel-sprite");
const marcelBubbles = document.getElementById("marcel-bubbles");
const marcelMood = document.getElementById("marcel-mood");
const marcelHungerBar = document.getElementById("marcel-hunger");
const marcelHappinessBar = document.getElementById("marcel-happiness");
const marcelEnergyBar = document.getElementById("marcel-energy");
const marcelLevel = document.getElementById("marcel-level");
const marcelPersonality = document.getElementById("marcel-personality");
const marcelFeedBtn = document.getElementById("marcel-feed");
const marcelPetBtn = document.getElementById("marcel-pet");
const marcelPlayBtn = document.getElementById("marcel-play");
const marcelSpeech = document.getElementById("marcel-speech");

const MARCEL_SPEECHES = {
  hungry: ["J'ai faim… 🥺", "Une petite algue ? 🌿", "Mon ventre gargouille…", "Psst… t'as pas un truc à manger ?"],
  happy: ["Je suis trop content ! 😄", "La vie est belle sous l'eau 🌊", "Vous êtes les meilleurs humains !", "Je fais des bulles de bonheur ✨"],
  sad: ["Je me sens seul… 😢", "Un câlin ? 🥺", "Vous m'avez oublié…", "L'eau est froide aujourd'hui…"],
  tired: ["*bâille* 😴", "Zzz… je fais une sieste…", "Tellement fatigué…", "5 minutes de plus…"],
  love: ["Je vous aime tous les deux ! 💕", "Merci de prendre soin de moi 🥰", "Vous êtes mon monde entier 🌍", "Câlin collectif ! 🫂"],
  fed: ["Miam miam ! 😋", "Délicieux ! Merci ! 🍕", "Mon plat préféré !", "Encore ! Encore ! 😋"],
  petted: ["Ronron… euh, blublub ! 💕", "J'adore les câlins ! 🥰", "Continue, continue…", "Oh oui, juste là… parfait !"],
  played: ["Trop fun ! 🎾", "Je suis le roi du ballon ! ⚽", "Encore une partie ! 🏓", "Je suis imbattable ! 🏆"],
  evolved: ["Je grandis ! 🌟", "Je me sens plus fort ! 💪", "Nouvelle forme débloquée ! ✨", "Marcel évolue ! 🦐✨"],
};

const MARCEL_STAGES = [
  { level: 1, name: "Bébé crevette 🥚", emoji: "🦐", minDays: 0 },
  { level: 2, name: "Petite crevette 🍤", emoji: "🦐", minDays: 3 },
  { level: 3, name: "Crevette curieuse 🔍", emoji: "🦐", minDays: 7 },
  { level: 4, name: "Crevette joyeuse 🎉", emoji: "🦐", minDays: 14 },
  { level: 5, name: "Super crevette ⭐", emoji: "🦐", minDays: 30 },
  { level: 6, name: "Crevette royale 👑", emoji: "🦐", minDays: 60 },
  { level: 7, name: "Crevette légendaire 🌟", emoji: "🦐", minDays: 100 },
  { level: 8, name: "Marcel le Magnifique ✨", emoji: "🦐", minDays: 200 },
];

const getMarcelDefault = () => ({
  hunger: 70,
  happiness: 70,
  energy: 80,
  born: new Date().toISOString(),
  lastFed: null,
  lastPetted: null,
  lastPlayed: null,
  lastDecay: new Date().toISOString(),
  totalInteractions: 0,
});

const getMarcelState = () => {
  if (!sharedDataLocal.marcel) {
    sharedDataLocal.marcel = getMarcelDefault();
  }
  return sharedDataLocal.marcel;
};

const getMarcelStage = (marcel) => {
  const bornDate = new Date(marcel.born);
  const daysSinceBorn = Math.floor((Date.now() - bornDate) / 86400000);
  let stage = MARCEL_STAGES[0];
  for (const s of MARCEL_STAGES) {
    if (daysSinceBorn >= s.minDays && marcel.totalInteractions >= s.minDays * 2) {
      stage = s;
    }
  }
  return stage;
};

const marcelSay = (category) => {
  const phrases = MARCEL_SPEECHES[category] || MARCEL_SPEECHES.happy;
  const phrase = phrases[Math.floor(Math.random() * phrases.length)];
  marcelSpeech.textContent = `"${phrase}"`;
};

const spawnBubble = () => {
  const bubble = document.createElement("div");
  bubble.className = "marcel-bubble";
  bubble.style.left = `${20 + Math.random() * 60}%`;
  bubble.style.bottom = `${Math.random() * 30}%`;
  bubble.style.animationDuration = `${2 + Math.random() * 3}s`;
  bubble.style.width = bubble.style.height = `${4 + Math.random() * 8}px`;
  marcelBubbles.appendChild(bubble);
  setTimeout(() => bubble.remove(), 4000);
};

// Spawn bubbles periodically
setInterval(spawnBubble, 2000);

const decayMarcel = (marcel) => {
  const lastDecay = new Date(marcel.lastDecay || marcel.born);
  const hoursSince = (Date.now() - lastDecay) / 3600000;
  if (hoursSince < 1) return false;

  const decaySteps = Math.min(Math.floor(hoursSince), 24);
  marcel.hunger = Math.max(0, marcel.hunger - decaySteps * 3);
  marcel.happiness = Math.max(0, marcel.happiness - decaySteps * 2);
  marcel.energy = Math.min(100, marcel.energy + decaySteps * 1); // Energy recovers with rest
  marcel.lastDecay = new Date().toISOString();
  return true;
};

const updateMarcelUI = () => {
  const marcel = getMarcelState();
  const decayed = decayMarcel(marcel);

  // Stats bars
  marcelHungerBar.style.width = `${marcel.hunger}%`;
  marcelHappinessBar.style.width = `${marcel.happiness}%`;
  marcelEnergyBar.style.width = `${marcel.energy}%`;

  // Stage
  const stage = getMarcelStage(marcel);
  marcelLevel.textContent = `Niveau ${stage.level}`;
  marcelPersonality.textContent = stage.name;

  // Mood indicator
  if (marcel.hunger < 20) {
    marcelMood.textContent = "😫";
    if (!marcelSpeech.textContent) marcelSay("hungry");
  } else if (marcel.happiness < 20) {
    marcelMood.textContent = "😢";
    if (!marcelSpeech.textContent) marcelSay("sad");
  } else if (marcel.energy < 20) {
    marcelMood.textContent = "😴";
    marcelSprite.classList.add("sleeping");
    if (!marcelSpeech.textContent) marcelSay("tired");
  } else if (marcel.happiness > 80 && marcel.hunger > 60) {
    marcelMood.textContent = "🥰";
    marcelSprite.classList.remove("sleeping");
  } else {
    marcelMood.textContent = "😊";
    marcelSprite.classList.remove("sleeping");
  }

  // Cooldowns (1 action per type every 30s)
  const now = Date.now();
  marcelFeedBtn.disabled = marcel.lastFed && (now - new Date(marcel.lastFed)) < 30000;
  marcelPetBtn.disabled = marcel.lastPetted && (now - new Date(marcel.lastPetted)) < 30000;
  marcelPlayBtn.disabled = marcel.lastPlayed && (now - new Date(marcel.lastPlayed)) < 30000 || marcel.energy < 10;

  if (decayed) {
    socket.emit("set_shared", { marcel });
  }
};

// Feed
marcelFeedBtn.addEventListener("click", () => {
  const marcel = getMarcelState();
  marcel.hunger = Math.min(100, marcel.hunger + 25);
  marcel.lastFed = new Date().toISOString();
  marcel.totalInteractions++;

  marcelSprite.classList.remove("happy", "playing", "sleeping");
  marcelSprite.classList.add("eating");
  setTimeout(() => marcelSprite.classList.remove("eating"), 1500);

  marcelSay("fed");
  spawnBubble(); spawnBubble(); spawnBubble();
  socket.emit("set_shared", { marcel });
});

// Pet
marcelPetBtn.addEventListener("click", () => {
  const marcel = getMarcelState();
  marcel.happiness = Math.min(100, marcel.happiness + 20);
  marcel.lastPetted = new Date().toISOString();
  marcel.totalInteractions++;

  marcelSprite.classList.remove("eating", "playing", "sleeping");
  marcelSprite.classList.add("happy");
  setTimeout(() => marcelSprite.classList.remove("happy"), 1800);

  marcelSay("petted");
  spawnBubble(); spawnBubble();
  socket.emit("set_shared", { marcel });
});

// Play
marcelPlayBtn.addEventListener("click", () => {
  const marcel = getMarcelState();
  marcel.happiness = Math.min(100, marcel.happiness + 15);
  marcel.energy = Math.max(0, marcel.energy - 15);
  marcel.lastPlayed = new Date().toISOString();
  marcel.totalInteractions++;

  marcelSprite.classList.remove("eating", "happy", "sleeping");
  marcelSprite.classList.add("playing");
  setTimeout(() => marcelSprite.classList.remove("playing"), 2000);

  marcelSay("played");
  spawnBubble(); spawnBubble(); spawnBubble(); spawnBubble();
  socket.emit("set_shared", { marcel });
});

// Update Marcel every 10s
setInterval(updateMarcelUI, 10000);

// Auto-speech every 45s
setInterval(() => {
  const marcel = getMarcelState();
  if (marcel.hunger < 20) marcelSay("hungry");
  else if (marcel.happiness < 20) marcelSay("sad");
  else if (marcel.happiness > 80) marcelSay("love");
  else marcelSay("happy");
}, 45000);

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
  menuBtn.classList.remove("hidden");
  heartbeatWidget.classList.remove("hidden");
  currentSessionCode = payload.code;
  myPseudo = pseudoInput.value.trim();
  strokes = payload.strokes || [];
  setUserList(payload.users || [], payload.count || 0, payload.limit || 2);

  // Charger les données partagées
  if (payload.shared) {
    sharedDataLocal = payload.shared;
    updateCounter();
    updateMoodUI();
    updateWordUI();
    renderPostits();
    renderAllLists();
    updateJournalUI();
    updateAlarmUI();
    updateMarcelUI();
  }

  // Présence initiale
  updatePresenceUI(payload.users || [], payload.count || 0);

  requestRedraw();

  // Montrer la bannière de demande de notifications (toujours sur mobile)
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (isMobile) {
    // iOS ne supporte pas les Web Notifications en PWA
    // On montre quand même la bannière pour expliquer Pushcut
    showNotifBanner();
  } else if ("Notification" in window && Notification.permission === "default") {
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

socket.on("shared_update", (data) => {
  if (data && typeof data === "object") {
    sharedDataLocal = data;
    updateCounter();
    updateMoodUI();
    updateWordUI();
    renderPostits();
    renderAllLists();
    updateJournalUI();
    renderMapPlaces();
    updateAlarmUI();
    updateMarcelUI();
  }
});

socket.on("presence", (data) => {
  updatePresenceUI(data.online || [], data.count || 0);
});

socket.on("heartbeat_ping", (data) => {
  // Flash le coeur quand on reçoit un ping
  if (data?.from && data.from !== myPseudo) {
    heartbeatIcon.style.transform = "scale(1.4)";
    setTimeout(() => { heartbeatIcon.style.transform = ""; }, 300);
  }
});

socket.on("miss_you", (data) => {
  if (data?.from) {
    showMissOverlay(data.from);
  }
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
