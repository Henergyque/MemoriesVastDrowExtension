const entryEl = document.getElementById("entry");
const pseudoInput = document.getElementById("pseudo-input");
const codeInput = document.getElementById("code-input");
const joinBtn = document.getElementById("join-btn");

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");

const panel = document.getElementById("panel");
const panelToggle = document.getElementById("panel-toggle");
const panelHandle = document.getElementById("panel-handle");
const usersPanel = document.getElementById("users-panel");
const usersToggle = document.getElementById("users-toggle");
const usersHandle = document.getElementById("users-handle");
const helpBtn = document.getElementById("help-btn");
const tutorial = document.getElementById("tutorial");
const tutorialClose = document.getElementById("tutorial-close");

const sessionCodeEl = document.getElementById("session-code");
const userCountEl = document.getElementById("user-count");
const userListEl = document.getElementById("user-list");

const colorPicker = document.getElementById("color-picker");
const sizeRange = document.getElementById("size-range");
const opacityRange = document.getElementById("opacity-range");

const toasts = document.getElementById("toasts");
const connectionStatus = document.getElementById("connection-status");

const showToast = (message) => {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  toasts.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 2600);
};

const updateConnectionStatus = (text) => {
  if (connectionStatus) {
    connectionStatus.textContent = text;
  }
};

updateConnectionStatus("Serveur: script chargé");

const socket = window.io
  ? window.io()
  : {
      connected: false,
      emit: () => {},
      on: () => {},
    };

if (!window.io) {
  updateConnectionStatus("Serveur: script socket.io manquant");
  showToast("Ouvre l'app via localhost:3000 (pas en fichier local).");
} else {
  updateConnectionStatus("Serveur: connexion...");
}

let strokes = [];
let isDrawing = false;
let isPanning = false;
let lastPoint = null;
let lastPan = null;
let isSpacePressed = false;

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
let maintenanceActive = false;

const resizeCanvas = () => {
  const prevWidth = width;
  const prevHeight = height;
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;

  if (prevWidth && prevHeight) {
    offsetX += (width - prevWidth) / 2;
    offsetY += (height - prevHeight) / 2;
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

const drawSegment = (segment) => {
  applyTransform();
  ctx.strokeStyle = segment.color;
  ctx.globalAlpha = segment.opacity;
  ctx.lineWidth = segment.size / scale;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(segment.x1, segment.y1);
  ctx.lineTo(segment.x2, segment.y2);
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

const setUserList = (users, count, limit) => {
  userListEl.innerHTML = "";
  users.forEach((user) => {
    const li = document.createElement("li");
    li.textContent = user;
    userListEl.appendChild(li);
  });
  userCountEl.textContent = `${count}/${limit}`;
};

const togglePanel = (collapsed) => {
  if (collapsed) {
    panel.classList.add("collapsed");
    panelHandle.classList.add("visible");
  } else {
    panel.classList.remove("collapsed");
    panelHandle.classList.remove("visible");
  }
};

const toggleUsersPanel = (collapsed) => {
  if (collapsed) {
    usersPanel.classList.add("collapsed");
    usersHandle.classList.add("visible");
  } else {
    usersPanel.classList.remove("collapsed");
    usersHandle.classList.remove("visible");
  }
};

panelToggle.addEventListener("click", () => {
  togglePanel(!panel.classList.contains("collapsed"));
});

panelHandle.addEventListener("click", () => {
  togglePanel(false);
});

usersToggle.addEventListener("click", () => {
  toggleUsersPanel(!usersPanel.classList.contains("collapsed"));
});

usersHandle.addEventListener("click", () => {
  toggleUsersPanel(false);
});

helpBtn.addEventListener("click", () => {
  tutorial.classList.remove("hidden");
});

tutorialClose.addEventListener("click", () => {
  tutorial.classList.add("hidden");
});

document.addEventListener("contextmenu", (event) => {
  if (event.target === canvas) {
    event.preventDefault();
  }
});

window.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    isSpacePressed = true;
    if (!isPanning && !isDrawing) {
      canvas.style.cursor = "grab";
    }
  }
});

window.addEventListener("keyup", (event) => {
  if (event.code === "Space") {
    isSpacePressed = false;
    if (!isPanning && !isDrawing) {
      canvas.style.cursor = "crosshair";
    }
  }
});

const handlePointerDown = (event) => {
  if (event.button === 1 || (event.button === 0 && isSpacePressed) || event.button === 2) {
    isPanning = true;
    lastPan = { x: event.clientX, y: event.clientY };
    canvas.style.cursor = "grabbing";
    return;
  }

  if (event.button !== 0) return;

  if (scale < MIN_DRAW_SCALE) {
    const now = Date.now();
    if (now - lastScaleToast > 1200) {
      showToast("Trop dézoomé pour dessiner. Zoom un peu.");
      lastScaleToast = now;
    }
    return;
  }

  isDrawing = true;
  lastPoint = screenToWorld(event.clientX, event.clientY);
};

const handlePointerMove = (event) => {
  if (isPanning && lastPan) {
    const dx = event.clientX - lastPan.x;
    const dy = event.clientY - lastPan.y;
    offsetX += dx;
    offsetY += dy;
    lastPan = { x: event.clientX, y: event.clientY };
    requestRedraw();
    return;
  }

  if (!isDrawing || !lastPoint) return;
  if (scale < MIN_DRAW_SCALE) return;

  const samples = event.getCoalescedEvents ? event.getCoalescedEvents() : [event];

  samples.forEach((sample) => {
    if (!lastPoint) return;
    const current = screenToWorld(sample.clientX, sample.clientY);
    const dx = current.x - lastPoint.x;
    const dy = current.y - lastPoint.y;
    if (dx * dx + dy * dy < MIN_DISTANCE * MIN_DISTANCE) {
      return;
    }

    const dist = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(dist / MAX_SEGMENT_LENGTH));
    const stepX = dx / steps;
    const stepY = dy / steps;

    for (let i = 0; i < steps; i += 1) {
      const nextPoint = {
        x: lastPoint.x + stepX,
        y: lastPoint.y + stepY,
      };

      const segment = {
        x1: lastPoint.x,
        y1: lastPoint.y,
        x2: nextPoint.x,
        y2: nextPoint.y,
        color: colorPicker.value,
        size: Number(sizeRange.value),
        opacity: Number(opacityRange.value),
      };

      strokes.push(segment);
      drawSegment(segment);
      socket.emit("draw", segment);
      lastPoint = nextPoint;
    }
    lastPoint = current;
  });
};

const handlePointerUp = () => {
  isDrawing = false;
  isPanning = false;
  lastPoint = null;
  lastPan = null;
  canvas.style.cursor = isSpacePressed ? "grab" : "crosshair";
};

const handleWheel = (event) => {
  event.preventDefault();
  const zoomIntensity = 0.1;
  const direction = event.deltaY < 0 ? 1 : -1;
  const zoom = 1 + zoomIntensity * direction;

  const mouseX = event.clientX;
  const mouseY = event.clientY;
  const worldBefore = screenToWorld(mouseX, mouseY);

  scale = Math.min(500, Math.max(0.0025, scale * zoom));

  offsetX = mouseX - worldBefore.x * scale;
  offsetY = mouseY - worldBefore.y * scale;

  requestRedraw();
};

joinBtn.addEventListener("click", () => {
  const pseudo = pseudoInput.value.trim();
  const code = codeInput.value.trim();
  const maintenanceCode = code;

  if (!socket.connected) {
    showToast("Connexion au serveur impossible. Vérifie localhost:3000.");
    return;
  }

  if (!pseudo) {
    showToast("Pseudo obligatoire.");
    return;
  }

  if (!/^\d{5}$/.test(code)) {
    showToast("Code à 5 chiffres requis.");
    return;
  }

  if (maintenanceActive && !(pseudo.toLowerCase() === "admin" && maintenanceCode)) {
    showToast("Maintenance en cours.");
    return;
  }

  socket.emit("join", { pseudo, code, maintenanceCode });
});

socket.on("join_error", (message) => {
  if (typeof message === "string" && message.toLowerCase().includes("maintenance")) {
    maintenanceActive = true;
    updateConnectionStatus("Serveur: maintenance");
  }
  showToast(message);
});

socket.on("connect", () => {
  updateConnectionStatus("Serveur: connecté");
});

socket.on("disconnect", () => {
  updateConnectionStatus("Serveur: déconnecté");
});

socket.on("connect_error", () => {
  updateConnectionStatus("Serveur: erreur de connexion");
  showToast("Impossible de joindre le serveur.");
});

socket.on("maintenance_status", (payload) => {
  maintenanceActive = Boolean(payload?.enabled);
  if (maintenanceActive) {
    updateConnectionStatus("Serveur: maintenance");
    if (payload?.message) {
      showToast(payload.message);
    }
  } else {
    updateConnectionStatus("Serveur: connecté");
  }
});

socket.on("init", (payload) => {
  entryEl.classList.add("hidden");
  sessionCodeEl.textContent = `Code: ${payload.code}`;
  strokes = payload.strokes || [];
  setUserList(payload.users || [], payload.count || 0, payload.limit || 100);
  requestRedraw();
});

socket.on("user_list", (payload) => {
  setUserList(payload.users || [], payload.count || 0, payload.limit || 100);
});

socket.on("draw", (segment) => {
  strokes.push(segment);
  drawSegment(segment);
});

window.addEventListener("resize", resizeCanvas);
canvas.addEventListener("pointerdown", handlePointerDown);
canvas.addEventListener("pointermove", handlePointerMove);
canvas.addEventListener("pointerup", handlePointerUp);
canvas.addEventListener("pointerleave", handlePointerUp);
canvas.addEventListener("wheel", handleWheel, { passive: false });

resizeCanvas();

if (window.location.protocol === "file:") {
  showToast("Ouvre l'app via localhost:3000, pas en fichier local.");
}

setTimeout(() => {
  if (!socket.connected) {
    showToast("Toujours pas connecté. Vérifie que le serveur tourne.");
  }
}, 1500);
