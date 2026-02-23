const path = require("path");
const fs = require("fs");
const express = require("express");
const http = require("http");
const https = require("https");
const { Server } = require("socket.io");
const { Pool } = require("pg");

const SESSION_CODES = ["28473", "59016", "73142", "240125"];
const SESSION_LIMIT = 2;
const MAX_SERVER_SEGMENT = 1200;
const MAINTENANCE_MODE = ["true", "1", "yes"].includes(
  String(process.env.MAINTENANCE_MODE || "").toLowerCase()
);
const MAINTENANCE_CODE = String(process.env.MAINTENANCE_CODE || "78913").trim();
const ADMIN_BYPASS_CODE = "78913";
const MAINTENANCE_MESSAGE = String(
  process.env.MAINTENANCE_MESSAGE || "Maintenance en cours. Merci de réessayer plus tard."
).trim();

// Webhooks Pushcut pour notifications iOS (déclenchent les Raccourcis iOS)
const PUSHCUT_WEBHOOK_A = (process.env.PUSHCUT_WEBHOOK_A || "").trim();
const PUSHCUT_WEBHOOK_B = (process.env.PUSHCUT_WEBHOOK_B || "").trim();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 5 * 1024 * 1024, // 5 MB pour les images
});

app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

const dataDir = path.join(__dirname, "data");
const getSessionFile = (code) => path.join(dataDir, `strokes-${code}.json`);

const dbEnabled = Boolean(process.env.DATABASE_URL);
const pool = dbEnabled
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl:
        process.env.PGSSLMODE === "require" || process.env.NODE_ENV === "production"
          ? { rejectUnauthorized: false }
          : undefined,
    })
  : null;

const sessions = new Map();
for (const code of SESSION_CODES) {
  sessions.set(code, { users: new Map(), strokes: [] });
}

const ensureDataDir = () => {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
};

const loadStrokes = () => {
  for (const code of SESSION_CODES) {
    try {
      const filePath = getSessionFile(code);
      if (!fs.existsSync(filePath)) continue;
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      const session = sessions.get(code);
      if (session && Array.isArray(parsed)) {
        session.strokes = parsed;
      }
    } catch (error) {
      console.warn(`Failed to load strokes for ${code}:`, error.message);
    }
  }
};

const saveStrokes = (code) => {
  try {
    ensureDataDir();
    const session = sessions.get(code);
    const payload = session ? session.strokes : [];
    fs.writeFileSync(getSessionFile(code), JSON.stringify(payload));
  } catch (error) {
    console.warn(`Failed to save strokes for ${code}:`, error.message);
  }
};

const initDb = async () => {
  if (!pool) return;
  await pool.query(
    "CREATE TABLE IF NOT EXISTS strokes (" +
      "id BIGSERIAL PRIMARY KEY," +
      "session_code VARCHAR(10) NOT NULL," +
      "x1 DOUBLE PRECISION NOT NULL," +
      "y1 DOUBLE PRECISION NOT NULL," +
      "x2 DOUBLE PRECISION NOT NULL," +
      "y2 DOUBLE PRECISION NOT NULL," +
      "color TEXT NOT NULL," +
      "size DOUBLE PRECISION NOT NULL," +
      "opacity DOUBLE PRECISION NOT NULL," +
      "created_at TIMESTAMPTZ DEFAULT NOW()" +
      ");"
  );
  // Agrandir la colonne si elle existait déjà en VARCHAR(5)
  await pool.query(
    "ALTER TABLE strokes ALTER COLUMN session_code TYPE VARCHAR(10);"
  ).catch(() => {});
  await pool.query(
    "CREATE INDEX IF NOT EXISTS strokes_session_idx ON strokes (session_code);"
  );
};

const loadStrokesFromDb = async () => {
  if (!pool) return;
  for (const code of SESSION_CODES) {
    const session = sessions.get(code);
    if (!session) continue;
    const result = await pool.query(
      "SELECT x1, y1, x2, y2, color, size, opacity FROM strokes WHERE session_code = $1 ORDER BY id ASC",
      [code]
    );
    session.strokes = result.rows.map((row) => ({
      x1: Number(row.x1),
      y1: Number(row.y1),
      x2: Number(row.x2),
      y2: Number(row.y2),
      color: row.color,
      size: Number(row.size),
      opacity: Number(row.opacity),
    }));
  }
};

const saveSegmentToDb = (code, segment) => {
  if (!pool) return;
  pool
    .query(
      "INSERT INTO strokes (session_code, x1, y1, x2, y2, color, size, opacity) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
      [
        code,
        segment.x1,
        segment.y1,
        segment.x2,
        segment.y2,
        segment.color,
        segment.size,
        segment.opacity,
      ]
    )
    .catch((error) => {
      console.warn(`Failed to save stroke for ${code}:`, error.message);
    });
};

/* ── Gestion des dessins envoyés ───────────────────────── */
const drawingsDir = path.join(__dirname, "data", "drawings");

/* ── Données partagées (compteur, humeur, etc.) ────────── */
const sharedDataFile = path.join(dataDir, "shared.json");

const loadSharedData = () => {
  try {
    if (fs.existsSync(sharedDataFile)) {
      return JSON.parse(fs.readFileSync(sharedDataFile, "utf-8"));
    }
  } catch (e) {
    console.warn("Failed to load shared data:", e.message);
  }
  return {};
};

const saveSharedData = () => {
  try {
    ensureDataDir();
    fs.writeFileSync(sharedDataFile, JSON.stringify(sharedData, null, 2));
  } catch (e) {
    console.warn("Failed to save shared data:", e.message);
  }
};

const getSessionShared = (code) => {
  if (!sharedData[code]) sharedData[code] = {};
  return sharedData[code];
};

let sharedData = loadSharedData();

const ensureDrawingsDir = () => {
  if (!fs.existsSync(drawingsDir)) {
    fs.mkdirSync(drawingsDir, { recursive: true });
  }
};

const saveDrawingImage = (code, base64Data) => {
  ensureDrawingsDir();
  // Retirer le préfixe data URL si présent
  const raw = base64Data.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(raw, "base64");
  const filePath = path.join(drawingsDir, `latest-${code}.png`);
  fs.writeFileSync(filePath, buffer);
  return filePath;
};

/* ── Webhook Pushcut / iOS Shortcuts ───────────────────── */
const triggerWebhook = (url, payload) => {
  if (!url) return;
  try {
    const urlObj = new URL(url);
    const body = JSON.stringify(payload);
    const mod = urlObj.protocol === "https:" ? https : http;
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === "https:" ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    };
    const req = mod.request(options, (res) => {
      console.log(`Webhook ${urlObj.hostname} → ${res.statusCode}`);
    });
    req.on("error", (err) => console.warn("Webhook error:", err.message));
    req.write(body);
    req.end();
  } catch (err) {
    console.warn("Webhook trigger failed:", err.message);
  }
};

/* ── API REST pour les dessins ─────────────────────────── */
app.get("/api/latest-drawing/:code", (req, res) => {
  const code = req.params.code;
  if (!SESSION_CODES.includes(code)) {
    return res.status(404).json({ error: "Session inconnue." });
  }
  const filePath = path.join(drawingsDir, `latest-${code}.png`);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Aucun dessin enregistré." });
  }
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "no-cache");
  res.sendFile(filePath);
});

const start = async () => {
  if (dbEnabled) {
    await initDb();
    await loadStrokesFromDb();
  } else {
    ensureDataDir();
    loadStrokes();
    setInterval(() => {
      SESSION_CODES.forEach((code) => saveStrokes(code));
    }, 3 * 60 * 1000);
  }

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
};

const getSession = (code) => sessions.get(code);

io.on("connection", (socket) => {
  socket.emit("maintenance_status", {
    enabled: MAINTENANCE_MODE,
    message: MAINTENANCE_MESSAGE,
  });

  socket.on("join", (payload) => {
    const rawCode = String(payload?.code || "").trim();
    const pseudo = String(payload?.pseudo || "").trim();
    const maintenanceCode = String(payload?.maintenanceCode || rawCode).trim();
    const isAdminBypass =
      pseudo.toLowerCase() === "admin" &&
      (maintenanceCode === MAINTENANCE_CODE || maintenanceCode === ADMIN_BYPASS_CODE);
    const code = isAdminBypass ? SESSION_CODES[0] : rawCode;

    if (MAINTENANCE_MODE && !isAdminBypass) {
      socket.emit("join_error", MAINTENANCE_MESSAGE);
      return;
    }

    if (!SESSION_CODES.includes(code)) {
      socket.emit("join_error", "Code de session invalide.");
      return;
    }

    if (!pseudo) {
      socket.emit("join_error", "Pseudo obligatoire.");
      return;
    }

    const session = getSession(code);
    if (!session) {
      socket.emit("join_error", "Session indisponible.");
      return;
    }

    if (session.users.size >= SESSION_LIMIT) {
      socket.emit("join_error", "Session pleine (2 personnes max).");
      return;
    }

    socket.data.code = code;
    socket.data.pseudo = pseudo;
    socket.data.bypass = !MAINTENANCE_MODE || isAdminBypass;
    socket.data.position = session.users.size + 1; // 1 ou 2

    session.users.set(socket.id, pseudo);
    socket.join(code);

    socket.emit("init", {
      code,
      limit: SESSION_LIMIT,
      users: Array.from(session.users.values()),
      count: session.users.size,
      strokes: session.strokes,
      shared: getSessionShared(code),
    });

    io.to(code).emit("user_list", {
      users: Array.from(session.users.values()),
      count: session.users.size,
      limit: SESSION_LIMIT,
    });

    // Notifier la présence
    io.to(code).emit("presence", {
      online: Array.from(session.users.values()),
      count: session.users.size,
    });
  });

  socket.on("heartbeat_ping", () => {
    const code = socket.data.code;
    if (!code) return;
    socket.to(code).emit("heartbeat_ping", { from: socket.data.pseudo });
  });

  socket.on("miss_you", () => {
    const code = socket.data.code;
    if (!code) return;
    socket.to(code).emit("miss_you", { from: socket.data.pseudo });

    // Pushcut : notifier l'autre personne même si l'app est fermée
    const notif = {
      title: "💕 Tu me manques",
      text: `${socket.data.pseudo} pense à toi !`,
      sound: "default",
      isTimeSensitive: true,
    };
    // position 1 = user A → notifier B, position 2 = user B → notifier A
    if (socket.data.position === 1 && PUSHCUT_WEBHOOK_B) {
      triggerWebhook(PUSHCUT_WEBHOOK_B, notif);
    } else if (socket.data.position === 2 && PUSHCUT_WEBHOOK_A) {
      triggerWebhook(PUSHCUT_WEBHOOK_A, notif);
    }
  });

  socket.on("draw", (segment) => {
    const code = socket.data.code;
    if (!code) return;
    const session = getSession(code);
    if (!session) return;

    if (MAINTENANCE_MODE && !socket.data.bypass) return;

    const safeSegment = {
      x1: Number(segment?.x1),
      y1: Number(segment?.y1),
      x2: Number(segment?.x2),
      y2: Number(segment?.y2),
      color: String(segment?.color || "#000000"),
      size: Number(segment?.size || 6),
      opacity: Number(segment?.opacity || 1),
    };

    if ([
      safeSegment.x1,
      safeSegment.y1,
      safeSegment.x2,
      safeSegment.y2,
      safeSegment.size,
      safeSegment.opacity,
    ].some((v) => Number.isNaN(v))) {
      return;
    }

    const dx = safeSegment.x2 - safeSegment.x1;
    const dy = safeSegment.y2 - safeSegment.y1;
    if (Math.hypot(dx, dy) > MAX_SERVER_SEGMENT) {
      return;
    }

    session.strokes.push(safeSegment);
    if (dbEnabled) {
      saveSegmentToDb(code, safeSegment);
    } else {
      saveStrokes(code);
    }
    socket.to(code).emit("draw", safeSegment);
  });

  socket.on("send_drawing", (payload) => {
    const code = socket.data.code;
    if (!code) return;
    const session = getSession(code);
    if (!session) return;

    const base64 = payload?.image;
    if (!base64 || typeof base64 !== "string") return;

    try {
      saveDrawingImage(code, base64);
    } catch (err) {
      console.warn("Failed to save drawing image:", err.message);
    }

    // Notifier l'autre utilisateur via socket
    socket.to(code).emit("receive_drawing", {
      image: base64,
      from: socket.data.pseudo,
      url: `/api/latest-drawing/${code}`,
    });

    // Déclencher les webhooks Pushcut pour les deux utilisateurs
    const notif = {
      title: "Nouveau dessin !",
      text: `${socket.data.pseudo} t'a envoyé un dessin`,
      input: `${process.env.PUBLIC_URL || ""}/api/latest-drawing/${code}`,
    };
    if (PUSHCUT_WEBHOOK_A) triggerWebhook(PUSHCUT_WEBHOOK_A, notif);
    if (PUSHCUT_WEBHOOK_B) triggerWebhook(PUSHCUT_WEBHOOK_B, notif);

    socket.emit("drawing_sent", { ok: true });
  });

  /* ── Données partagées ────────────────────────────────── */
  socket.on("set_shared", (payload) => {
    const code = socket.data.code;
    if (!code) return;
    const session = getSession(code);
    if (!session) return;
    const sd = getSessionShared(code);
    // Merge les clés envoyées
    if (payload && typeof payload === "object") {
      Object.assign(sd, payload);
      saveSharedData();
      io.to(code).emit("shared_update", sd);
    }
  });

  socket.on("clear_canvas", () => {
    const code = socket.data.code;
    if (!code) return;
    const session = getSession(code);
    if (!session) return;
    session.strokes = [];
    if (dbEnabled) {
      pool.query("DELETE FROM strokes WHERE session_code = $1", [code]).catch(() => {});
    } else {
      saveStrokes(code);
    }
    io.to(code).emit("canvas_cleared");
  });

  socket.on("disconnect", () => {
    const code = socket.data.code;
    if (!code) return;
    const session = getSession(code);
    if (!session) return;

    session.users.delete(socket.id);

    io.to(code).emit("user_list", {
      users: Array.from(session.users.values()),
      count: session.users.size,
      limit: SESSION_LIMIT,
    });

    // Notifier la présence (déconnexion)
    io.to(code).emit("presence", {
      online: Array.from(session.users.values()),
      count: session.users.size,
    });
  });
});

/* ── Vérification serveur des alarmes (Pushcut) ────────── */
const alarmFiredToday = new Set(); // "code:HH:MM:YYYY-MM-DD"

setInterval(() => {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const today = now.toISOString().slice(0, 10);
  const currentTime = `${hh}:${mm}`;

  // Parcourir toutes les sessions pour check les alarmes
  const sharedData = loadSharedData();
  for (const [code, sd] of Object.entries(sharedData)) {
    if (!sd.alarm || !sd.alarm.time) continue;
    if (sd.alarm.time !== currentTime) continue;

    const key = `${code}:${sd.alarm.time}:${today}`;
    if (alarmFiredToday.has(key)) continue;
    alarmFiredToday.add(key);

    // Notifier les deux utilisateurs via Pushcut
    const notif = {
      title: "⏰ Alarme Memories !",
      text: `C'est l'heure ! ${sd.alarm.time} — définie par ${sd.alarm.setBy || "?"}`,
      sound: "alarm",
      isTimeSensitive: true,
    };
    if (PUSHCUT_WEBHOOK_A) triggerWebhook(PUSHCUT_WEBHOOK_A, notif);
    if (PUSHCUT_WEBHOOK_B) triggerWebhook(PUSHCUT_WEBHOOK_B, notif);

    console.log(`Alarm triggered for session ${code} at ${currentTime}`);
  }

  // Nettoyer les anciennes entrées (garder seulement aujourd'hui)
  for (const key of alarmFiredToday) {
    if (!key.endsWith(today)) alarmFiredToday.delete(key);
  }
}, 30000); // Vérifier toutes les 30 secondes

start().catch((error) => {
  console.error("Failed to start server:", error.message);
  process.exit(1);
});
