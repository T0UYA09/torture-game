/**
 * TORTUREGOTCHI - Motor del Juego en Pixel Art
 * Simulación de mascota virtual interactiva con física de sangre pixelada y herramientas de tortura.
 */

// Configuración del Lienzo y Renderizado
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

// Dimensiones lógicas de la pantalla LCD de 8-bit
const SCREEN_WIDTH = 240;
const SCREEN_HEIGHT = 200;
const FLOOR_Y = 175;

// Elementos de la interfaz de usuario (UI)
const hpText = document.getElementById('hpText');
const painText = document.getElementById('painText');
const avatarStatus = document.getElementById('avatarStatus');
const totalDamageText = document.getElementById('totalDamage');
const comboMultiplierText = document.getElementById('comboMultiplier');
const statusLed = document.getElementById('statusLed');
const ledLabel = document.getElementById('ledLabel');
const screenVignette = document.getElementById('screenVignette');
const screenCracks = document.getElementById('screenCracks');
const canvasContainer = document.getElementById('canvasContainer');
const tamagotchiBody = document.getElementById('tamagotchiBody');

// Estado Global del Juego
const GameState = {
  hp: 100,
  maxHp: 100,
  pain: 0,
  totalDamage: 0,
  comboCount: 0,
  comboTimer: 0,
  isDead: false,
  isDismembered: false,
  charredLevel: 0,     // 0 a 1 (quemado)
  acidCorrosion: 0,   // nivel de corrosión verde
  cuts: 0,             // marcas de cortes
  stuckNeedles: [],    // agujas clavadas [{ox, oy, angle, len}]
  bulletHoles: [],     // agujas y orificios de bala
  cracksVisible: false,
  mousePos: { x: SCREEN_WIDTH / 2, y: SCREEN_HEIGHT / 2 },
  heartbeatTimer: 0
};

// Canvas auxiliar para la sangre persistente en la pantalla
const bloodSurface = document.createElement('canvas');
bloodSurface.width = SCREEN_WIDTH;
bloodSurface.height = SCREEN_HEIGHT;
const bloodCtx = bloodSurface.getContext('2d');
bloodCtx.imageSmoothingEnabled = false;

// Listas de entidades
let bloodParticles = [];
let gibs = [];
let activeEffects = []; // animaciones activas (puños, rayos, sierras, etc.)

// Paletas de Colores de Sangre Dinámicas
const BLOOD_PALETTES = {
  crimson: ['#990000', '#d60000', '#b30000', '#ff2a2a', '#590000'],
  pink: ['#a8005b', '#ff3399', '#ff66b2', '#ff99cc', '#660033'],     // Danganronpa
  acid: ['#009933', '#00ff66', '#33ff77', '#b3ffcc', '#004d1a'],     // Xenomorfo / Ácido
  black: ['#111111', '#262626', '#3d3d3d', '#555555', '#050505']     // Petróleo
};
let currentBloodColorKey = 'crimson';
let bloodMultiplier = 1;

function getBloodColor() {
  const palette = BLOOD_PALETTES[currentBloodColorKey] || BLOOD_PALETTES.crimson;
  return palette[Math.floor(Math.random() * palette.length)];
}

// Sistema de Logros Retro
const ACHIEVEMENTS = [
  { id: 'first_blood', name: 'Primer Traumatismo', desc: 'Realiza tu primer ataque al sujeto.', icon: '🩸', unlocked: false },
  { id: 'shocked', name: 'Alto Voltaje', desc: 'Electrocuta al sujeto con relámpagos.', icon: '⚡', unlocked: false },
  { id: 'charred', name: 'Parrillada Humana', desc: 'Incinera al sujeto por completo.', icon: '🔥', unlocked: false },
  { id: 'gunner', name: 'Tiro al Blanco', desc: 'Dispara al avatar con la pistola.', icon: '🔫', unlocked: false },
  { id: 'freeze', name: 'Cero Absoluto', desc: 'Congela y quiebra al avatar.', icon: '❄️', unlocked: false },
  { id: 'anvil', name: 'Aplastado de Caricatura', desc: 'Déjale caer un yunque de hierro.', icon: '🪨', unlocked: false },
  { id: 'dismember', name: 'Picadillo Total', desc: 'Desmiembra el cuerpo en pedazos.', icon: '💀', unlocked: false },
  { id: 'revived', name: '¡Está Vivo!', desc: 'Resucita al sujeto tras su muerte.', icon: '💉', unlocked: false }
];

function unlockAchievement(id) {
  const ach = ACHIEVEMENTS.find(a => a.id === id);
  if (!ach || ach.unlocked) return;
  ach.unlocked = true;

  const unlockedCount = ACHIEVEMENTS.filter(a => a.unlocked).length;
  const achUnlockedBadge = document.getElementById('achUnlockedCount');
  if (achUnlockedBadge) achUnlockedBadge.textContent = `${unlockedCount} / ${ACHIEVEMENTS.length}`;

  window.retroAudio.playFanfare();
  const toast = document.getElementById('achievementToast');
  const desc = document.getElementById('achievementDesc');
  if (toast && desc) {
    desc.textContent = `${ach.icon} ${ach.name}`;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3500);
  }

  renderAchievementsList();
}

function renderAchievementsList() {
  const container = document.getElementById('achievementsListContainer');
  if (!container) return;
  container.innerHTML = '';
  ACHIEVEMENTS.forEach(ach => {
    const item = document.createElement('div');
    item.className = `ach-item ${ach.unlocked ? 'unlocked' : ''}`;
    item.innerHTML = `
      <span class="ach-icon">${ach.unlocked ? ach.icon : '🔒'}</span>
      <div class="ach-info">
        <span class="ach-name">${ach.name}</span>
        <span class="ach-desc">${ach.desc}</span>
      </div>
    `;
    container.appendChild(item);
  });
}

// Bocadillos de Diálogo (Speech Bubbles) de humor negro
const DIALOGUES = {
  idle: ['¿Eres mi amigo?', 'Tengo frío...', '¿Qué es ese botón?', 'No me pegues...', '¿Hola?'],
  hurt: ['¡Aaaay!', '¡Mis dientes!', '¡Duele mucho!', '¡¿Por qué a mí?!', '¡Piedad!'],
  shock: ['¡BZZZZT!', '¡Mis huesos!', '¡Aaaagh!'],
  fire: ['¡QUEMA, QUEMA!', '¡Cenizas!', '¡FUEGOOO!'],
  saw: ['¡Picadillo no!', '¡Mis brazos!', '¡Ay mamá!'],
  acid: ['¡Pica, pica!', '¡Me disuelvo!'],
  gun: ['¡Me disparaste!', '¡Agujeros no!'],
  frozen: ['¡B-b-brrr!', '¡Qué frío!'],
  anvil: ['¡M-mi cabeza!', '¡Aplastado!'],
  food: ['¡Comida!... ¡Espera!', '¡Mi barriga!'],
  critical: ['Veo la luz blanca...', 'Adiós mundo cruel...', 'Ya no siento nada...'],
  revive: ['¡¿Otra vez aquí?!', '¡Déjame descansar!', '¡Noooo!']
};

function triggerSpeech(category) {
  if (GameState.isDismembered || GameState.isDead) return;
  const list = DIALOGUES[category] || DIALOGUES.hurt;
  const text = list[Math.floor(Math.random() * list.length)];
  avatar.speech = { text, timer: 110 };
}

// Objeto del Avatar Blanco
const avatar = {
  x: SCREEN_WIDTH / 2,
  y: FLOOR_Y - 45,
  vx: 0,
  vy: 0,
  width: 32,
  height: 48,
  grounded: true,
  rotation: 0,
  rotSpeed: 0,
  scaleX: 1,
  scaleY: 1,
  facing: 1,
  isDragging: false,
  dragOffsetX: 0,
  dragOffsetY: 0,
  lastMouseX: 0,
  lastMouseY: 0,
  idleTimer: 0,
  shiverTimer: 0,
  shockTimer: 0,
  bruiseLeft: false,
  bruiseRight: false,
  tearDrop: false,
  skeletonFlash: false,
  isFrozen: false,
  freezeTimer: 0,
  speech: null,

  reset() {
    this.x = SCREEN_WIDTH / 2;
    this.y = FLOOR_Y - 45;
    this.vx = 0;
    this.vy = 0;
    this.rotation = 0;
    this.rotSpeed = 0;
    this.scaleX = 1;
    this.scaleY = 1;
    this.isDragging = false;
    this.shockTimer = 0;
    this.shiverTimer = 0;
    this.bruiseLeft = false;
    this.bruiseRight = false;
    this.tearDrop = false;
    this.skeletonFlash = false;
    this.isFrozen = false;
    this.freezeTimer = 0;
    this.speech = null;
    GameState.hp = 100;
    GameState.pain = 0;
    GameState.isDead = false;
    GameState.isDismembered = false;
    GameState.charredLevel = 0;
    GameState.acidCorrosion = 0;
    GameState.cuts = 0;
    GameState.stuckNeedles = [];
    GameState.bulletHoles = [];
    gibs = [];
    updateStatusUI();
    triggerSpeech('revive');
  }
};

// Partículas de Sangre Pixel
class BloodParticle {
  constructor(x, y, vx, vy, size = null, color = null) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.size = size || (Math.random() < 0.7 ? 2 : (Math.random() < 0.8 ? 3 : 4));
    this.color = color || getBloodColor();
    this.life = 120 + Math.random() * 80;
    this.maxLife = this.life;
    this.stuck = false;
    this.isDripping = false;
  }

  update() {
    if (this.stuck) {
      // Ocasionalmente una gota estancada escurre lentamente hacia abajo
      if (this.isDripping && Math.random() < 0.08) {
        this.y += 1;
        if (this.y >= FLOOR_Y) this.isDripping = false;
      }
      return;
    }

    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.28; // Gravedad
    this.vx *= 0.98; // Fricción del aire

    // Colisión contra el suelo
    if (this.y >= FLOOR_Y - 2) {
      this.y = FLOOR_Y - Math.random() * 2;
      this.stuck = true;
      // Estampar en el canvas de sangre persistente
      stampBloodSplatter(this.x, this.y, this.size, this.color);
    }

    // Colisión contra paredes laterales
    if (this.x <= 10 || this.x >= SCREEN_WIDTH - 10) {
      this.stuck = true;
      if (Math.random() < 0.4) this.isDripping = true;
      stampBloodSplatter(this.x, this.y, this.size, this.color);
    }
  }

  draw(targetCtx) {
    if (this.stuck) return;
    targetCtx.fillStyle = this.color;
    targetCtx.fillRect(Math.floor(this.x), Math.floor(this.y), this.size, this.size);
  }
}

// Fragmentos Corporales (Gibs) tras desmembramiento o explosión
class Gib {
  constructor(x, y, type, vx, vy) {
    this.x = x;
    this.y = y;
    this.type = type; // 'head', 'arm', 'leg', 'torso', 'bone'
    this.vx = vx;
    this.vy = vy;
    this.angle = Math.random() * Math.PI * 2;
    this.angVel = (Math.random() - 0.5) * 0.4;
    this.bounce = 0.4;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.35;
    this.vx *= 0.98;
    this.angle += this.angVel;

    // Emisión de estela de sangre al volar
    if (Math.random() < 0.6) {
      bloodParticles.push(new BloodParticle(this.x, this.y, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, 2, getBloodColor()));
    }

    // Rebote con suelo
    if (this.y >= FLOOR_Y - 8) {
      this.y = FLOOR_Y - 8;
      this.vy = -this.vy * this.bounce;
      this.vx *= 0.7;
      this.angVel *= 0.5;
      stampBloodSplatter(this.x, this.y + 4, 4, getBloodColor());
    }

    // Rebote con paredes
    if (this.x <= 12) {
      this.x = 12;
      this.vx = -this.vx * this.bounce;
    } else if (this.x >= SCREEN_WIDTH - 12) {
      this.x = SCREEN_WIDTH - 12;
      this.vx = -this.vx * this.bounce;
    }
  }

  draw(targetCtx) {
    targetCtx.save();
    targetCtx.translate(Math.floor(this.x), Math.floor(this.y));
    targetCtx.rotate(this.angle);

    const charColor = GameState.charredLevel > 0.5 ? '#2f3542' : '#ffffff';
    const bloodC = getBloodColor();

    switch (this.type) {
      case 'head':
        targetCtx.fillStyle = charColor;
        targetCtx.fillRect(-7, -7, 14, 14);
        targetCtx.fillStyle = '#111';
        targetCtx.fillRect(-4, -3, 3, 3);
        targetCtx.fillRect(2, -3, 3, 3);
        targetCtx.fillStyle = bloodC;
        targetCtx.fillRect(-7, 6, 14, 4);
        break;

      case 'torso':
        targetCtx.fillStyle = charColor;
        targetCtx.fillRect(-6, -8, 12, 16);
        targetCtx.fillStyle = bloodC;
        targetCtx.fillRect(-4, -2, 8, 4);
        targetCtx.fillStyle = '#f1f2f6';
        targetCtx.fillRect(-2, -1, 4, 2);
        break;

      case 'arm':
        targetCtx.fillStyle = charColor;
        targetCtx.fillRect(-2, -6, 4, 12);
        targetCtx.fillStyle = bloodC;
        targetCtx.fillRect(-2, -7, 4, 3);
        break;

      case 'leg':
        targetCtx.fillStyle = charColor;
        targetCtx.fillRect(-2, -7, 4, 14);
        targetCtx.fillStyle = bloodC;
        targetCtx.fillRect(-2, -8, 4, 3);
        break;

      case 'bone':
        targetCtx.fillStyle = '#e4e7eb';
        targetCtx.fillRect(-2, -5, 4, 10);
        targetCtx.fillRect(-3, -6, 6, 2);
        targetCtx.fillRect(-3, 4, 6, 2);
        break;
    }

    targetCtx.restore();
  }
}

// Estampar mancha permanente en la pantalla
function stampBloodSplatter(x, y, radius = 3, color = null) {
  const c = color || getBloodColor();
  bloodCtx.fillStyle = c;

  const count = Math.floor(radius * 1.8 * bloodMultiplier);
  for (let i = 0; i < count; i++) {
    const px = Math.floor(x + (Math.random() - 0.5) * radius * 3.5);
    const py = Math.floor(y + (Math.random() - 0.5) * radius * 2.5);
    const sz = Math.random() < 0.6 ? 2 : 3;
    bloodCtx.fillRect(px, py, sz, sz);
  }
}

// Provocar brote de sangre en un punto con dirección
function spawnBloodBurst(x, y, count = 25, power = 5, dirX = 0, dirY = -1) {
  const finalCount = Math.floor(count * bloodMultiplier);
  for (let i = 0; i < finalCount; i++) {
    const angle = Math.atan2(dirY, dirX) + (Math.random() - 0.5) * 1.6;
    const speed = (0.5 + Math.random() * 1.5) * power;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed - (Math.random() * 2);
    bloodParticles.push(new BloodParticle(x, y, vx, vy, null, getBloodColor()));
  }
  window.retroAudio.playSplat();
}

// Sistema de Daño
function applyDamage(amount, reason = '') {
  if (GameState.isDead && !GameState.isDismembered && amount > 60) {
    triggerDismemberment();
    return;
  }
  if (GameState.isDismembered) return;

  unlockAchievement('first_blood');

  GameState.hp = Math.max(0, GameState.hp - amount);
  GameState.pain = Math.min(100, GameState.pain + (amount * 1.3));
  GameState.totalDamage += amount;

  // Contador de combo
  GameState.comboCount++;
  GameState.comboTimer = 180; // 3 segundos de combo

  // Efectos visuales de impacto en pantalla
  triggerScreenShake(amount > 30 ? 'heavy' : 'normal');
  flashVignette();

  // Fracturas de pantalla si el daño es catastrófico
  if (GameState.hp < 30 && !GameState.cracksVisible) {
    GameState.cracksVisible = true;
    screenCracks.classList.add('visible');
  }

  if (GameState.hp <= 0 && !GameState.isDead) {
    GameState.isDead = true;
    avatar.rotSpeed = 0.15;
    triggerSpeech('critical');
  }

  if (GameState.totalDamage >= 500) {
    unlockAchievement('blood_bath');
  }

  // Vibración háptica para dispositivos móviles Android
  if (navigator.vibrate) {
    try {
      navigator.vibrate(amount > 30 ? [40, 20, 50] : 25);
    } catch (e) {}
  }

  updateStatusUI();
}

function updateStatusUI() {
  hpText.textContent = `${Math.round(GameState.hp)}%`;
  painText.textContent = `${Math.round(GameState.pain)}%`;
  totalDamageText.textContent = GameState.totalDamage;
  comboMultiplierText.textContent = `x${(1 + GameState.comboCount * 0.1).toFixed(1)}`;

  // Estado del Avatar
  avatarStatus.className = 'stat-pill status-pill';
  statusLed.className = 'status-led';

  if (GameState.isDismembered) {
    avatarStatus.textContent = 'DESTRUIDO';
    avatarStatus.classList.add('dead');
    statusLed.classList.add('dead');
    ledLabel.textContent = 'FIN';
  } else if (GameState.isDead) {
    avatarStatus.textContent = 'CADÁVER';
    avatarStatus.classList.add('dead');
    statusLed.classList.add('dead');
    ledLabel.textContent = 'MUERTO';
  } else if (GameState.hp < 25) {
    avatarStatus.textContent = 'AGONIZANDO';
    avatarStatus.classList.add('dying');
    statusLed.classList.add('critical');
    ledLabel.textContent = 'CRÍTICO';
  } else if (GameState.hp < 65) {
    avatarStatus.textContent = 'HERIDO';
    avatarStatus.classList.add('hurt');
    statusLed.classList.add('danger');
    ledLabel.textContent = 'DOLOR';
  } else {
    avatarStatus.textContent = 'VIVO';
    ledLabel.textContent = 'ESTABLE';
  }
}

function triggerScreenShake(type = 'normal') {
  canvasContainer.classList.remove('shake-screen', 'heavy-shake');
  void canvasContainer.offsetWidth; // Reflow trigger
  canvasContainer.classList.add(type === 'heavy' ? 'heavy-shake' : 'shake-screen');
}

function flashVignette() {
  screenVignette.classList.remove('flash');
  void screenVignette.offsetWidth;
  screenVignette.classList.add('flash');
  setTimeout(() => screenVignette.classList.remove('flash'), 250);
}

// Desmembramiento / Explosión corporal
function triggerDismemberment() {
  if (GameState.isDismembered) return;
  GameState.isDismembered = true;
  GameState.isDead = true;
  GameState.hp = 0;
  GameState.pain = 100;

  // Generar fragmentos con impulsos explosivos
  gibs.push(new Gib(avatar.x, avatar.y - 16, 'head', (Math.random() - 0.5) * 8, -6 - Math.random() * 4));
  gibs.push(new Gib(avatar.x, avatar.y, 'torso', (Math.random() - 0.5) * 5, -5));
  gibs.push(new Gib(avatar.x - 10, avatar.y, 'arm', -4 - Math.random() * 4, -4));
  gibs.push(new Gib(avatar.x + 10, avatar.y, 'arm', 4 + Math.random() * 4, -4));
  gibs.push(new Gib(avatar.x - 6, avatar.y + 16, 'leg', -3 - Math.random() * 3, -2));
  gibs.push(new Gib(avatar.x + 6, avatar.y + 16, 'leg', 3 + Math.random() * 3, -2));
  gibs.push(new Gib(avatar.x, avatar.y + 6, 'bone', (Math.random() - 0.5) * 6, -6));

  spawnBloodBurst(avatar.x, avatar.y, 80, 8, 0, -1);
  triggerScreenShake('heavy');
  screenCracks.classList.add('visible');
  GameState.cracksVisible = true;
  updateStatusUI();
}

/* ========================================================
   HERRAMIENTAS DE TORTURA Y ANIMACIONES
   ======================================================== */

// 1. GOLPEAR (Punch / Slap)
function actionPunch() {
  if (GameState.isDismembered) return;
  window.retroAudio.playPunch(true);
  triggerSpeech('hurt');

  const fromLeft = Math.random() < 0.5;
  const punchX = fromLeft ? avatar.x - 30 : avatar.x + 30;
  const punchY = avatar.y - 10 + (Math.random() - 0.5) * 15;

  // Física de rechazo
  avatar.vx = fromLeft ? (8 + Math.random() * 4) : -(8 + Math.random() * 4);
  avatar.vy = -5 - Math.random() * 3;
  avatar.rotSpeed = fromLeft ? 0.3 : -0.3;
  avatar.scaleX = 0.7;
  avatar.scaleY = 1.3;

  if (fromLeft) avatar.bruiseRight = true;
  else avatar.bruiseLeft = true;

  // Sangre disparada del golpe
  spawnBloodBurst(avatar.x, avatar.y - 10, 20, 6, fromLeft ? 1 : -1, -0.5);

  // Animación del guante / puño pixel
  activeEffects.push({
    type: 'fist',
    x: punchX,
    y: punchY,
    targetX: avatar.x,
    targetY: avatar.y - 10,
    dir: fromLeft ? 1 : -1,
    life: 14,
    maxLife: 14
  });

  applyDamage(18, 'GOLPE');
}

// 2. RELÁMPAGO (Lightning)
function actionLightning() {
  if (GameState.isDismembered) return;
  window.retroAudio.playLightning();
  triggerSpeech('shock');
  unlockAchievement('shocked');

  avatar.shockTimer = 45;
  avatar.skeletonFlash = true;
  avatar.vy = -3;
  avatar.charredLevel = Math.min(1, GameState.charredLevel + 0.35);

  activeEffects.push({
    type: 'lightning',
    startX: avatar.x + (Math.random() - 0.5) * 20,
    targetX: avatar.x,
    targetY: avatar.y,
    life: 20,
    maxLife: 20
  });

  spawnBloodBurst(avatar.x, avatar.y, 18, 4, 0, -1);
  triggerScreenShake('heavy');
  applyDamage(26, 'RELÁMPAGO');
}

// 3. QUEMAR (Fire / Flame)
function actionFire() {
  if (GameState.isDismembered) return;
  window.retroAudio.playFire();
  window.retroAudio.playScream(0.4);
  triggerSpeech('fire');
  unlockAchievement('charred');

  avatar.charredLevel = Math.min(1, GameState.charredLevel + 0.5);
  avatar.shiverTimer = 35;
  avatar.vx = (Math.random() - 0.5) * 8;
  avatar.vy = -4;

  activeEffects.push({
    type: 'fire',
    x: avatar.x,
    y: avatar.y + 10,
    life: 30,
    maxLife: 30
  });

  spawnBloodBurst(avatar.x, avatar.y, 12, 3, 0, -1);
  applyDamage(22, 'FUEGO');
}

// 4. SIERRA (Saw)
function actionSaw() {
  if (GameState.isDismembered) return;
  window.retroAudio.playSaw();
  triggerSpeech('saw');

  GameState.cuts++;
  avatar.vx = (Math.random() - 0.5) * 6;
  avatar.scaleX = 0.6;
  avatar.scaleY = 1.4;

  activeEffects.push({
    type: 'saw',
    x: Math.random() < 0.5 ? -20 : SCREEN_WIDTH + 20,
    y: avatar.y - 10,
    targetX: avatar.x,
    life: 25,
    maxLife: 25
  });

  spawnBloodBurst(avatar.x, avatar.y - 8, 35, 7, (Math.random() - 0.5), -1);
  applyDamage(30, 'SIERRA');
}

// 5. ÁCIDO (Acid)
function actionAcid() {
  if (GameState.isDismembered) return;
  window.retroAudio.playAcid();
  triggerSpeech('acid');

  GameState.acidCorrosion = Math.min(1, GameState.acidCorrosion + 0.4);
  avatar.shiverTimer = 40;

  activeEffects.push({
    type: 'acid',
    x: avatar.x,
    y: 10,
    life: 30,
    maxLife: 30
  });

  spawnBloodBurst(avatar.x, avatar.y, 15, 3, 0, 1);
  applyDamage(20, 'ÁCIDO');
}

// 6. AGUJAS (Spikes)
function actionSpikes() {
  if (GameState.isDismembered) return;
  window.retroAudio.playSpikes();
  triggerSpeech('hurt');

  const ox = (Math.random() - 0.5) * 20;
  const oy = -25 + Math.random() * 35;
  const angle = (Math.random() - 0.5) * 1.2;
  GameState.stuckNeedles.push({ ox, oy, angle, len: 18 });

  avatar.vy = -3;
  avatar.scaleY = 0.8;
  spawnBloodBurst(avatar.x + ox, avatar.y + oy, 22, 5, 0, -1);
  applyDamage(19, 'AGUJAS');
}

// 7. PISTOLA (Gun / Bullets)
function actionGun() {
  if (GameState.isDismembered) return;
  unlockAchievement('gunner');
  triggerSpeech('gun');

  for (let b = 0; b < 3; b++) {
    setTimeout(() => {
      if (GameState.isDismembered) return;
      window.retroAudio.playGunshot();

      const fromLeft = Math.random() < 0.5;
      const holeY = -22 + Math.random() * 30;
      const holeX = (Math.random() - 0.5) * 14;
      GameState.bulletHoles.push({ ox: holeX, oy: holeY });

      avatar.vx = fromLeft ? 7 : -7;
      avatar.vy = -2;
      spawnBloodBurst(avatar.x + holeX, avatar.y + holeY, 18, 6, fromLeft ? 1 : -1, -0.3);

      activeEffects.push({
        type: 'bullet',
        startX: fromLeft ? 0 : SCREEN_WIDTH,
        targetX: avatar.x + holeX,
        targetY: avatar.y + holeY,
        life: 6,
        maxLife: 6
      });

      applyDamage(10, 'BALAZO');
    }, b * 100);
  }
}

// 8. CONGELAR (Freeze / Ice block)
function actionFreeze() {
  if (GameState.isDismembered || avatar.isFrozen) return;
  window.retroAudio.playFreeze();
  triggerSpeech('frozen');
  unlockAchievement('freeze');

  avatar.isFrozen = true;
  avatar.freezeTimer = 65;
  avatar.vx = 0;
  avatar.vy = 0;

  activeEffects.push({
    type: 'freeze_hammer',
    x: avatar.x,
    y: -30,
    targetY: avatar.y - 20,
    life: 65,
    maxLife: 65
  });
}

// 9. YUNQUE (Heavy Anvil Drop)
function actionAnvil() {
  if (GameState.isDismembered) return;
  unlockAchievement('anvil');
  triggerSpeech('anvil');

  activeEffects.push({
    type: 'anvil',
    x: avatar.x,
    y: -40,
    targetY: FLOOR_Y - 26,
    hasHit: false,
    life: 40,
    maxLife: 40
  });
}

// 10. COMIDA TÓXICA (Toxic Food)
function actionFood() {
  if (GameState.isDismembered) return;
  triggerSpeech('food');

  activeEffects.push({
    type: 'food',
    x: avatar.x - 40,
    y: avatar.y - 10,
    targetX: avatar.x,
    targetY: avatar.y - 15,
    life: 30,
    maxLife: 30
  });

  setTimeout(() => {
    if (GameState.isDismembered) return;
    window.retroAudio.playEat();
    avatar.scaleX = 1.4;
    avatar.scaleY = 1.3;

    setTimeout(() => {
      if (GameState.isDismembered) return;
      window.retroAudio.playAcid();
      GameState.acidCorrosion = 0.8;
      spawnBloodBurst(avatar.x, avatar.y - 12, 30, 5, 0, -1);
      applyDamage(26, 'VENENO');
    }, 400);
  }, 250);
}

// 11. MUERTE INSTANTÁNEA (Instant Death / Nuke)
function actionInstantDeath() {
  window.retroAudio.playExplosion();

  activeEffects.push({
    type: 'nuke',
    x: avatar.x,
    y: avatar.y,
    life: 35,
    maxLife: 35
  });

  triggerDismemberment();
}

// 12. REVIVIR (Revive / Defibrillator)
function actionRevive() {
  window.retroAudio.playRevive();
  unlockAchievement('revived');

  activeEffects.push({
    type: 'heal',
    x: avatar.x,
    y: avatar.y,
    life: 30,
    maxLife: 30
  });

  avatar.reset();
}

// 9. LIMPIAR PANTALLA (Clean blood)
function actionCleanScreen() {
  window.retroAudio.playClick();
  bloodCtx.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  bloodParticles = [];
  screenCracks.classList.remove('visible');
  GameState.cracksVisible = false;
}

// 10. BOTÓN A: ABOFETEAR
function actionSlap() {
  if (GameState.isDismembered) return;
  window.retroAudio.playPunch(false);

  avatar.vx = (Math.random() < 0.5 ? -1 : 1) * 6;
  avatar.vy = -3;
  avatar.rotSpeed = (Math.random() - 0.5) * 0.4;
  spawnBloodBurst(avatar.x, avatar.y - 12, 10, 4, avatar.vx > 0 ? 1 : -1, -0.5);
  applyDamage(8, 'BOFETADA');
}

// 11. BOTÓN B: AGITAR DISPOSITIVO
function actionShake() {
  window.retroAudio.playPunch(true);
  triggerScreenShake('heavy');

  if (!GameState.isDismembered) {
    avatar.vx = (Math.random() - 0.5) * 14;
    avatar.vy = -7 - Math.random() * 5;
    avatar.rotSpeed = (Math.random() - 0.5) * 0.8;
    spawnBloodBurst(avatar.x, avatar.y, 16, 5, 0, -1);
    applyDamage(12, 'AGITADO');
  }
}

/* ========================================================
   FÍSICA DEL AVATAR Y BUCLE PRINCIPAL
   ======================================================== */

function updateAvatar() {
  if (GameState.isDismembered) return;

  // Estado de congelación
  if (avatar.isFrozen) {
    avatar.freezeTimer--;
    if (avatar.freezeTimer <= 0) {
      avatar.isFrozen = false;
      window.retroAudio.playShatter();
      spawnBloodBurst(avatar.x, avatar.y, 30, 5, 0, -1);
      applyDamage(22, 'ROTURA HIELO');
    }
    return;
  }

  // Si el usuario lo está arrastrando con el ratón
  if (avatar.isDragging) {
    avatar.vx = (avatar.x - avatar.lastMouseX) * 0.6;
    avatar.vy = (avatar.y - avatar.lastMouseY) * 0.6;
    avatar.lastMouseX = avatar.x;
    avatar.lastMouseY = avatar.y;
    return;
  }

  // Fricción y gravedad
  avatar.x += avatar.vx;
  avatar.y += avatar.vy;
  avatar.vy += 0.45;
  avatar.vx *= 0.94;
  avatar.rotation += avatar.rotSpeed;
  avatar.rotSpeed *= 0.95;

  avatar.scaleX += (1 - avatar.scaleX) * 0.15;
  avatar.scaleY += (1 - avatar.scaleY) * 0.15;

  // Suelo
  if (avatar.y >= FLOOR_Y - 24) {
    if (avatar.vy > 6) {
      window.retroAudio.playPunch(false);
      spawnBloodBurst(avatar.x, FLOOR_Y, Math.min(25, Math.floor(avatar.vy * 2.5)), 4, 0, -1);
      applyDamage(Math.floor(avatar.vy * 1.5), 'IMPACTO SUELO');
      avatar.scaleX = 1.3;
      avatar.scaleY = 0.7;
    }
    avatar.y = FLOOR_Y - 24;
    avatar.vy = 0;
    avatar.grounded = true;

    if (!GameState.isDead) {
      avatar.rotation += (0 - avatar.rotation) * 0.15;
    }
  } else {
    avatar.grounded = false;
  }

  // Paredes
  if (avatar.x <= 20) {
    avatar.x = 20;
    if (Math.abs(avatar.vx) > 4) {
      window.retroAudio.playPunch(false);
      spawnBloodBurst(20, avatar.y, 12, 3, 1, 0);
      applyDamage(Math.floor(Math.abs(avatar.vx)), 'PARED');
    }
    avatar.vx = -avatar.vx * 0.5;
  } else if (avatar.x >= SCREEN_WIDTH - 20) {
    avatar.x = SCREEN_WIDTH - 20;
    if (Math.abs(avatar.vx) > 4) {
      window.retroAudio.playPunch(false);
      spawnBloodBurst(SCREEN_WIDTH - 20, avatar.y, 12, 3, -1, 0);
      applyDamage(Math.floor(Math.abs(avatar.vx)), 'PARED');
    }
    avatar.vx = -avatar.vx * 0.5;
  }

  // Techo
  if (avatar.y <= 24) {
    avatar.y = 24;
    avatar.vy = -avatar.vy * 0.5;
  }

  // Temporizadores
  if (avatar.shockTimer > 0) {
    avatar.shockTimer--;
    avatar.skeletonFlash = avatar.shockTimer % 4 < 2;
    avatar.x += (Math.random() - 0.5) * 4;
  } else {
    avatar.skeletonFlash = false;
  }

  if (avatar.shiverTimer > 0) {
    avatar.shiverTimer--;
    avatar.x += (Math.random() - 0.5) * 2;
  }

  // Temporizador de bocadillos de diálogo
  if (avatar.speech && avatar.speech.timer > 0) {
    avatar.speech.timer--;
  }

  // Frases de ocio aleatorias si está vivo y tranquilo
  if (Math.random() < 0.002 && !GameState.isDead && GameState.pain < 15 && (!avatar.speech || avatar.speech.timer <= 0)) {
    triggerSpeech('idle');
  }

  // Latido del corazón en estado crítico
  if (!GameState.isDead && !GameState.isDismembered && GameState.hp < 35) {
    GameState.heartbeatTimer = (GameState.heartbeatTimer || 0) + 1;
    const rate = GameState.hp < 15 ? 40 : 75;
    if (GameState.heartbeatTimer % rate === 0) {
      window.retroAudio.playHeartbeat();
    }
  }

  avatar.idleTimer += 0.05;

  if (GameState.pain > 0) {
    GameState.pain = Math.max(0, GameState.pain - 0.04);
    painText.textContent = `${Math.round(GameState.pain)}%`;
  }

  if (GameState.comboTimer > 0) {
    GameState.comboTimer--;
    if (GameState.comboTimer <= 0) {
      GameState.comboCount = 0;
      comboMultiplierText.textContent = 'x1.0';
    }
  }
}

// Renderizado del Avatar Blanco en estilo Pixel Art
function drawAvatar(targetCtx) {
  if (GameState.isDismembered) return;

  targetCtx.save();
  targetCtx.translate(Math.floor(avatar.x), Math.floor(avatar.y));
  targetCtx.rotate(avatar.rotation);
  targetCtx.scale(avatar.scaleX, avatar.scaleY);

  const isShocked = avatar.skeletonFlash;
  const isCharred = GameState.charredLevel > 0.4;
  const isCorroded = GameState.acidCorrosion > 0.3;

  let bodyColor = '#ffffff';
  let outlineColor = '#1e272e';

  if (isShocked) {
    bodyColor = '#00f7ff';
    outlineColor = '#ffffff';
  } else if (isCharred) {
    bodyColor = '#2f3542';
    outlineColor = '#000000';
  } else if (isCorroded) {
    bodyColor = '#88d49e';
    outlineColor = '#1b4332';
  }

  const breathY = avatar.grounded && !GameState.isDead ? Math.sin(avatar.idleTimer) * 1.5 : 0;

  // Piernas
  targetCtx.fillStyle = bodyColor;
  targetCtx.fillRect(-8, 8 + breathY, 5, 14);
  targetCtx.fillRect(3, 8 + breathY, 5, 14);

  // Brazos
  if (avatar.shockTimer > 0) {
    targetCtx.fillRect(-16, -10 + (Math.random() - 0.5) * 3, 5, 12);
    targetCtx.fillRect(11, -10 + (Math.random() - 0.5) * 3, 5, 12);
  } else {
    targetCtx.fillRect(-13, -2 + breathY, 4, 12);
    targetCtx.fillRect(9, -2 + breathY, 4, 12);
  }

  // Torso
  targetCtx.fillRect(-9, -4 + breathY, 18, 16);

  // Cabeza
  targetCtx.fillRect(-11, -26 + breathY, 22, 20);
  targetCtx.fillRect(-9, -28 + breathY, 18, 24);

  // Esqueleto X-Ray
  if (isShocked) {
    targetCtx.fillStyle = '#ffffff';
    targetCtx.fillRect(-7, -23 + breathY, 14, 12);
    targetCtx.fillStyle = '#000000';
    targetCtx.fillRect(-5, -20 + breathY, 3, 4);
    targetCtx.fillRect(2, -20 + breathY, 3, 4);
    targetCtx.fillStyle = '#ffffff';
    targetCtx.fillRect(-6, -1 + breathY, 12, 2);
    targetCtx.fillRect(-6, 3 + breathY, 12, 2);
    targetCtx.fillRect(-4, 7 + breathY, 8, 2);
    targetCtx.restore();
    drawSpeechBubble(targetCtx);
    return;
  }

  // Cortes
  if (GameState.cuts > 0) {
    targetCtx.fillStyle = getBloodColor();
    for (let i = 0; i < Math.min(6, GameState.cuts); i++) {
      targetCtx.fillRect(-7 + (i * 2.5), -1 + (i * 2) + breathY, 8, 2);
    }
  }

  // Agujeros de bala
  if (GameState.bulletHoles && GameState.bulletHoles.length > 0) {
    for (const hole of GameState.bulletHoles) {
      targetCtx.fillStyle = getBloodColor();
      targetCtx.fillRect(hole.ox - 2, hole.oy - 2 + breathY, 4, 4);
      targetCtx.fillStyle = '#111';
      targetCtx.fillRect(hole.ox - 1, hole.oy - 1 + breathY, 2, 2);
    }
  }

  // Moretones
  if (avatar.bruiseLeft) {
    targetCtx.fillStyle = '#574b90';
    targetCtx.fillRect(-8, -22 + breathY, 5, 5);
  }
  if (avatar.bruiseRight) {
    targetCtx.fillStyle = '#574b90';
    targetCtx.fillRect(3, -22 + breathY, 5, 5);
  }

  // Seguimiento ocular del cursor
  const dx = GameState.mousePos.x - avatar.x;
  const dy = GameState.mousePos.y - (avatar.y - 20);
  const lookX = Math.max(-1, Math.min(1, Math.round(dx / 35)));
  const lookY = Math.max(-1, Math.min(1, Math.round(dy / 35)));

  targetCtx.fillStyle = outlineColor;

  if (GameState.isDead) {
    // Ojos X
    targetCtx.fillRect(-7, -21 + breathY, 4, 2);
    targetCtx.fillRect(-6, -22 + breathY, 2, 4);
    targetCtx.fillRect(3, -21 + breathY, 4, 2);
    targetCtx.fillRect(4, -22 + breathY, 2, 4);
    targetCtx.fillRect(-4, -13 + breathY, 8, 2);
    targetCtx.fillStyle = getBloodColor();
    targetCtx.fillRect(2, -11 + breathY, 2, 6);
  } else if (GameState.pain > 40) {
    // Ojos apretados de dolor ( > < )
    targetCtx.fillRect(-7, -21 + breathY, 4, 2);
    targetCtx.fillRect(-5, -19 + breathY, 2, 2);
    targetCtx.fillRect(3, -21 + breathY, 4, 2);
    targetCtx.fillRect(3, -19 + breathY, 2, 2);

    targetCtx.fillRect(-4, -15 + breathY, 8, 5);
    targetCtx.fillStyle = '#ff4757';
    targetCtx.fillRect(-2, -12 + breathY, 4, 2);

    targetCtx.fillStyle = '#70a1ff';
    targetCtx.fillRect(-9, -17 + breathY, 2, 3);
    targetCtx.fillRect(7, -17 + breathY, 2, 3);
  } else if (GameState.hp < 75) {
    // Asustado
    targetCtx.fillRect(-6 + lookX, -22 + lookY + breathY, 3, 3);
    targetCtx.fillRect(3 + lookX, -22 + lookY + breathY, 3, 3);
    targetCtx.fillRect(-7, -25 + breathY, 4, 1);
    targetCtx.fillRect(3, -25 + breathY, 4, 1);
    targetCtx.fillRect(-3, -14 + breathY, 6, 2);
  } else {
    // Ojos que siguen el cursor
    targetCtx.fillRect(-6 + lookX, -21 + lookY + breathY, 3, 3);
    targetCtx.fillRect(3 + lookX, -21 + lookY + breathY, 3, 3);
    targetCtx.fillRect(-2, -13 + breathY, 4, 2);
  }

  // Agujas clavadas
  if (GameState.stuckNeedles.length > 0) {
    targetCtx.strokeStyle = '#ced6e0';
    targetCtx.lineWidth = 2;
    for (const needle of GameState.stuckNeedles) {
      targetCtx.save();
      targetCtx.translate(needle.ox, needle.oy + breathY);
      targetCtx.rotate(needle.angle);
      targetCtx.beginPath();
      targetCtx.moveTo(-needle.len, 0);
      targetCtx.lineTo(0, 0);
      targetCtx.stroke();
      targetCtx.fillStyle = '#ff4757';
      targetCtx.fillRect(-needle.len - 3, -2, 3, 4);
      targetCtx.restore();
    }
  }

  // Cubo de hielo si está congelado
  if (avatar.isFrozen) {
    targetCtx.fillStyle = 'rgba(112, 161, 255, 0.7)';
    targetCtx.strokeStyle = '#ffffff';
    targetCtx.lineWidth = 2;
    targetCtx.fillRect(-18, -34 + breathY, 36, 60);
    targetCtx.strokeRect(-18, -34 + breathY, 36, 60);
    targetCtx.fillStyle = '#ffffff';
    targetCtx.fillRect(-14, -30 + breathY, 4, 16);
  }

  targetCtx.restore();

  drawSpeechBubble(targetCtx);
}

// Dibujar bocadillo de diálogo pixel art
function drawSpeechBubble(targetCtx) {
  if (!avatar.speech || avatar.speech.timer <= 0) return;
  targetCtx.save();

  const bubbleX = Math.max(35, Math.min(SCREEN_WIDTH - 35, Math.floor(avatar.x)));
  const bubbleY = Math.max(22, Math.floor(avatar.y - 46));

  targetCtx.font = "7px 'Press Start 2P', monospace";
  const metrics = targetCtx.measureText(avatar.speech.text);
  const bw = Math.min(SCREEN_WIDTH - 20, Math.max(64, metrics.width + 12));
  const bh = 16;
  const bx = Math.max(10, Math.min(SCREEN_WIDTH - bw - 10, bubbleX - bw / 2));
  const by = bubbleY - bh;

  targetCtx.fillStyle = '#ffffff';
  targetCtx.strokeStyle = '#000000';
  targetCtx.lineWidth = 2;
  targetCtx.fillRect(bx, by, bw, bh);
  targetCtx.strokeRect(bx, by, bw, bh);

  // Pico
  targetCtx.fillStyle = '#ffffff';
  targetCtx.beginPath();
  targetCtx.moveTo(bubbleX - 3, by + bh);
  targetCtx.lineTo(bubbleX, by + bh + 4);
  targetCtx.lineTo(bubbleX + 3, by + bh);
  targetCtx.fill();

  targetCtx.fillStyle = '#000000';
  targetCtx.textAlign = 'center';
  targetCtx.textBaseline = 'middle';
  targetCtx.fillText(avatar.speech.text, bx + bw / 2, by + bh / 2 + 1);

  targetCtx.restore();
}

/* ========================================================
   RENDERIZADO DE EFECTOS ESPECIALES DE TORTURA
   ======================================================== */
function updateAndDrawEffects(targetCtx) {
  for (let i = activeEffects.length - 1; i >= 0; i--) {
    const fx = activeEffects[i];
    fx.life--;

    if (fx.life <= 0) {
      activeEffects.splice(i, 1);
      continue;
    }

    targetCtx.save();

    switch (fx.type) {
      case 'fist': {
        // Puño gigante de boxeo pixelado
        const progress = 1 - (fx.life / fx.maxLife);
        const currentX = fx.x + (fx.targetX - fx.x) * Math.sin(progress * Math.PI);
        const currentY = fx.targetY;

        targetCtx.fillStyle = '#d63031';
        targetCtx.fillRect(Math.floor(currentX - 10), Math.floor(currentY - 10), 20, 20);
        targetCtx.fillStyle = '#ffffff'; // Nudillos / vendas
        targetCtx.fillRect(Math.floor(currentX - 6), Math.floor(currentY - 12), 12, 4);
        break;
      }

      case 'lightning': {
        // Relámpago en zigzag desde el cielo
        targetCtx.strokeStyle = fx.life % 2 === 0 ? '#ffffff' : '#00d2d3';
        targetCtx.lineWidth = 3;
        targetCtx.beginPath();
        let curX = fx.startX;
        let curY = 0;
        targetCtx.moveTo(curX, curY);

        while (curY < fx.targetY) {
          curX += (Math.random() - 0.5) * 24;
          curY += 20;
          targetCtx.lineTo(curX, curY);
        }
        targetCtx.lineTo(fx.targetX, fx.targetY);
        targetCtx.stroke();
        break;
      }

      case 'fire': {
        // Llamas pixeladas ascendiendo
        const flameCount = 14;
        for (let j = 0; j < flameCount; j++) {
          const flameX = fx.x + (Math.random() - 0.5) * 36;
          const flameY = fx.y - Math.random() * 40;
          const sz = 3 + Math.floor(Math.random() * 4);
          targetCtx.fillStyle = Math.random() < 0.4 ? '#fffa65' : (Math.random() < 0.7 ? '#ff9f1a' : '#ff3838');
          targetCtx.fillRect(Math.floor(flameX), Math.floor(flameY), sz, sz);
        }
        break;
      }

      case 'saw': {
        // Sierra circular giratoria
        const progress = 1 - (fx.life / fx.maxLife);
        const sawX = fx.x + (fx.targetX - fx.x) * progress;
        const sawY = fx.y;
        const rot = fx.life * 0.8;

        targetCtx.translate(sawX, sawY);
        targetCtx.rotate(rot);
        targetCtx.fillStyle = '#718093';
        targetCtx.fillRect(-14, -14, 28, 28);
        targetCtx.fillStyle = '#f1f2f6';
        targetCtx.fillRect(-10, -10, 20, 20);
        targetCtx.fillStyle = '#b30000';
        targetCtx.fillRect(-4, -4, 8, 8);
        break;
      }

      case 'acid': {
        // Gotas de ácido verde fosforescente
        for (let k = 0; k < 6; k++) {
          const dropY = (1 - (fx.life / fx.maxLife)) * (FLOOR_Y - 10) + (k * 10);
          const dropX = fx.x + (Math.sin(k + fx.life) * 12);
          targetCtx.fillStyle = '#2ed573';
          targetCtx.fillRect(Math.floor(dropX), Math.floor(dropY), 3, 5);
        }
        break;
      }

      case 'nuke': {
        // Anillo de explosión expansiva
        const radius = (1 - (fx.life / fx.maxLife)) * 100;
        targetCtx.strokeStyle = fx.life % 2 === 0 ? '#ff4757' : '#ffa502';
        targetCtx.lineWidth = 4;
        targetCtx.beginPath();
        targetCtx.arc(fx.x, fx.y, radius, 0, Math.PI * 2);
        targetCtx.stroke();
        break;
      }

      case 'heal': {
        // Cruces verdes curativas subiendo
        const healY = fx.y - ((1 - (fx.life / fx.maxLife)) * 35);
        targetCtx.fillStyle = '#2ed573';
        targetCtx.fillRect(fx.x - 2, healY - 6, 4, 12);
        targetCtx.fillRect(fx.x - 6, healY - 2, 12, 4);
        break;
      }

      case 'bullet': {
        const progress = 1 - (fx.life / fx.maxLife);
        const curX = fx.startX + (fx.targetX - fx.startX) * progress;
        const curY = fx.targetY;
        targetCtx.fillStyle = '#f39c12';
        targetCtx.fillRect(curX - 4, curY - 1, 8, 3);
        targetCtx.fillStyle = '#ffffff';
        targetCtx.fillRect(curX, curY - 1, 3, 3);
        break;
      }

      case 'freeze_hammer': {
        if (fx.life <= 14) {
          const dropProgress = 1 - (fx.life / 14);
          const hammerY = -30 + (fx.targetY + 30) * dropProgress;
          targetCtx.fillStyle = '#747d8c';
          targetCtx.fillRect(fx.x - 12, hammerY - 16, 24, 16);
          targetCtx.fillStyle = '#8b572a';
          targetCtx.fillRect(fx.x - 2, hammerY - 40, 4, 26);
        }
        break;
      }

      case 'anvil': {
        const progress = Math.min(1, (1 - fx.life / fx.maxLife) * 1.5);
        const curY = -40 + (fx.targetY + 40) * Math.min(1, progress * 1.2);
        targetCtx.fillStyle = '#2f3542';
        targetCtx.fillRect(fx.x - 16, curY, 32, 14);
        targetCtx.fillRect(fx.x - 10, curY + 14, 20, 10);
        targetCtx.fillRect(fx.x - 20, curY + 22, 40, 6);

        if (!fx.hasHit && curY >= fx.targetY - 4) {
          fx.hasHit = true;
          window.retroAudio.playAnvil();
          avatar.scaleX = 2.4;
          avatar.scaleY = 0.2;
          avatar.vy = 0;
          spawnBloodBurst(avatar.x - 20, FLOOR_Y - 4, 25, 6, -1, -0.2);
          spawnBloodBurst(avatar.x + 20, FLOOR_Y - 4, 25, 6, 1, -0.2);
          applyDamage(40, 'YUNQUE');
        }
        break;
      }

      case 'food': {
        const progress = 1 - (fx.life / fx.maxLife);
        const curX = fx.x + (fx.targetX - fx.x) * progress;
        const curY = fx.y + (fx.targetY - fx.y) * progress;
        targetCtx.fillStyle = '#e58e26';
        targetCtx.fillRect(curX - 6, curY - 4, 12, 3);
        targetCtx.fillStyle = '#00ff66';
        targetCtx.fillRect(curX - 7, curY - 1, 14, 2);
        targetCtx.fillStyle = '#2f3542';
        targetCtx.fillRect(curX - 6, curY + 1, 12, 3);
        targetCtx.fillStyle = '#e58e26';
        targetCtx.fillRect(curX - 6, curY + 4, 12, 2);
        break;
      }
    }

    targetCtx.restore();
  }
}

// Bucle de Animación y Renderizado
function gameLoop() {
  // Limpiar lienzo principal
  ctx.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  // 1. Dibujar suelo cuadriculado retro de Tamagotchi
  ctx.fillStyle = '#617860';
  ctx.fillRect(0, FLOOR_Y, SCREEN_WIDTH, SCREEN_HEIGHT - FLOOR_Y);
  ctx.fillStyle = '#4c5e4b';
  for (let x = 0; x < SCREEN_WIDTH; x += 16) {
    ctx.fillRect(x, FLOOR_Y, 1, SCREEN_HEIGHT - FLOOR_Y);
  }
  ctx.fillRect(0, FLOOR_Y, SCREEN_WIDTH, 2);

  // 2. Estampar la capa persistente de sangre del suelo y paredes
  ctx.drawImage(bloodSurface, 0, 0);

  // 3. Actualizar y dibujar partículas de sangre activas
  for (let i = bloodParticles.length - 1; i >= 0; i--) {
    const bp = bloodParticles[i];
    bp.update();
    bp.draw(ctx);
    if (bp.stuck && !bp.isDripping) {
      bloodParticles.splice(i, 1);
    }
  }

  // 4. Actualizar y dibujar fragmentos corporales (Gibs)
  for (let i = 0; i < gibs.length; i++) {
    gibs[i].update();
    gibs[i].draw(ctx);
  }

  // 5. Actualizar y dibujar el Avatar
  updateAvatar();
  drawAvatar(ctx);

  // 6. Efectos especiales activos (puños, rayos, etc.)
  updateAndDrawEffects(ctx);

  requestAnimationFrame(gameLoop);
}

// Iniciar bucle de juego
requestAnimationFrame(gameLoop);

/* ========================================================
   CONTROL DE EVENTOS Y ENTRADAS (TOUCH / MOUSE / BOTONES)
   ======================================================== */

// Coordenadas proporcionales en el canvas
function getCanvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  const scaleX = SCREEN_WIDTH / rect.width;
  const scaleY = SCREEN_HEIGHT / rect.height;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY
  };
}

// Arrastrar y lanzar al avatar
let dragHistory = [];

function startDrag(e) {
  if (GameState.isDismembered) return;
  const pos = getCanvasPos(e);
  const dist = Math.hypot(pos.x - avatar.x, pos.y - avatar.y);

  if (dist < 32) {
    avatar.isDragging = true;
    avatar.dragOffsetX = avatar.x - pos.x;
    avatar.dragOffsetY = avatar.y - pos.y;
    dragHistory = [{ x: avatar.x, y: avatar.y, time: performance.now() }];
    window.retroAudio.playClick();
  }
}

function moveDrag(e) {
  if (!avatar.isDragging) return;
  const pos = getCanvasPos(e);
  const newX = Math.max(16, Math.min(SCREEN_WIDTH - 16, pos.x + avatar.dragOffsetX));
  const newY = Math.max(16, Math.min(FLOOR_Y - 24, pos.y + avatar.dragOffsetY));

  avatar.x = newX;
  avatar.y = newY;

  dragHistory.push({ x: newX, y: newY, time: performance.now() });
  if (dragHistory.length > 5) dragHistory.shift();
}

function endDrag() {
  if (avatar.isDragging) {
    avatar.isDragging = false;

    // Calcular velocidad de lanzamiento si el jugador lo arrojó con fuerza
    if (dragHistory.length >= 2) {
      const first = dragHistory[0];
      const last = dragHistory[dragHistory.length - 1];
      const dt = Math.max(1, last.time - first.time) / 1000;
      const vx = (last.x - first.x) / dt / 60;
      const vy = (last.y - first.y) / dt / 60;

      avatar.vx = Math.max(-14, Math.min(14, vx * 1.2));
      avatar.vy = Math.max(-14, Math.min(14, vy * 1.2));
      avatar.rotSpeed = (avatar.vx / 10);

      // Si fue arrojado con fuerza, gemir
      if (Math.abs(avatar.vx) > 4 || Math.abs(avatar.vy) > 4) {
        window.retroAudio.playPunch(false);
      }
    }
  }
}

// Eventos de ratón y táctiles en el canvas
canvas.addEventListener('mousedown', startDrag);
window.addEventListener('mousemove', moveDrag);
window.addEventListener('mouseup', endDrag);

canvas.addEventListener('mousemove', (e) => {
  GameState.mousePos = getCanvasPos(e);
});

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  startDrag(e);
}, { passive: false });

window.addEventListener('touchmove', (e) => {
  if (avatar.isDragging) {
    e.preventDefault();
    moveDrag(e);
  }
}, { passive: false });

window.addEventListener('touchend', endDrag);

// Mapeo de botones de herramientas clásicas
document.getElementById('btnPunch').addEventListener('click', actionPunch);
document.getElementById('btnLightning').addEventListener('click', actionLightning);
document.getElementById('btnFire').addEventListener('click', actionFire);
document.getElementById('btnSaw').addEventListener('click', actionSaw);
document.getElementById('btnAcid').addEventListener('click', actionAcid);
document.getElementById('btnSpikes').addEventListener('click', actionSpikes);
document.getElementById('btnInstantDeath').addEventListener('click', actionInstantDeath);
document.getElementById('btnRevive').addEventListener('click', actionRevive);

// Mapeo de nuevas armas y caos
const btnGun = document.getElementById('btnGun');
if (btnGun) btnGun.addEventListener('click', actionGun);

const btnFreeze = document.getElementById('btnFreeze');
if (btnFreeze) btnFreeze.addEventListener('click', actionFreeze);

const btnAnvil = document.getElementById('btnAnvil');
if (btnAnvil) btnAnvil.addEventListener('click', actionAnvil);

const btnFood = document.getElementById('btnFood');
if (btnFood) btnFood.addEventListener('click', actionFood);

// Pestañas de Categoría (Tortura, Armas, Gore)
const tabTorture = document.getElementById('tabTorture');
const tabWeapons = document.getElementById('tabWeapons');
const tabGore = document.getElementById('tabGore');

const panelTorture = document.getElementById('panelTorture');
const panelWeapons = document.getElementById('panelWeapons');
const panelGore = document.getElementById('panelGore');

function selectCategory(cat) {
  window.retroAudio.playClick();
  [tabTorture, tabWeapons, tabGore].forEach(t => t && t.classList.remove('active'));
  [panelTorture, panelWeapons, panelGore].forEach(p => {
    if (p) {
      p.style.display = 'none';
      p.classList.remove('active');
    }
  });

  if (cat === 'torture' && tabTorture && panelTorture) {
    tabTorture.classList.add('active');
    panelTorture.style.display = 'grid';
  } else if (cat === 'weapons' && tabWeapons && panelWeapons) {
    tabWeapons.classList.add('active');
    panelWeapons.style.display = 'grid';
  } else if (cat === 'gore' && tabGore && panelGore) {
    tabGore.classList.add('active');
    panelGore.style.display = 'flex';
  }
}

if (tabTorture) tabTorture.addEventListener('click', () => selectCategory('torture'));
if (tabWeapons) tabWeapons.addEventListener('click', () => selectCategory('weapons'));
if (tabGore) tabGore.addEventListener('click', () => selectCategory('gore'));

// Selector de Colores de Sangre
document.querySelectorAll('.color-dot').forEach(dot => {
  dot.addEventListener('click', () => {
    window.retroAudio.playClick();
    document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
    dot.classList.add('active');
    currentBloodColorKey = dot.getAttribute('data-color') || 'crimson';
  });
});

// Selector de Multiplicador de Gore
document.querySelectorAll('.gore-mult-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    window.retroAudio.playClick();
    document.querySelectorAll('.gore-mult-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    bloodMultiplier = parseInt(btn.getAttribute('data-mult'), 10) || 1;
  });
});

// Modal de Logros
const achievementsModal = document.getElementById('achievementsModal');
const btnToggleAchList = document.getElementById('btnToggleAchList');
const btnCloseAchModal = document.getElementById('btnCloseAchModal');

if (btnToggleAchList && achievementsModal) {
  btnToggleAchList.addEventListener('click', () => {
    window.retroAudio.playClick();
    renderAchievementsList();
    achievementsModal.style.display = 'block';
  });
}
if (btnCloseAchModal && achievementsModal) {
  btnCloseAchModal.addEventListener('click', () => {
    window.retroAudio.playClick();
    achievementsModal.style.display = 'none';
  });
}

// Acciones del D-PAD Direccional
function dpadAction(direction) {
  if (GameState.isDismembered) return;
  window.retroAudio.playPunch(false);

  switch (direction) {
    case 'up':
      avatar.vy = -11;
      avatar.rotSpeed = (Math.random() - 0.5) * 0.4;
      spawnBloodBurst(avatar.x, avatar.y, 12, 4, 0, 1);
      applyDamage(6, 'IMPULSO ARRIBA');
      break;
    case 'down':
      avatar.vy = 13;
      spawnBloodBurst(avatar.x, avatar.y, 14, 5, 0, -1);
      applyDamage(10, 'AZOTE SUELO');
      break;
    case 'left':
      avatar.vx = -12;
      avatar.vy = -3;
      avatar.rotSpeed = -0.35;
      spawnBloodBurst(avatar.x, avatar.y, 14, 5, 1, 0);
      applyDamage(8, 'IMPACTO IZQ');
      break;
    case 'right':
      avatar.vx = 12;
      avatar.vy = -3;
      avatar.rotSpeed = 0.35;
      spawnBloodBurst(avatar.x, avatar.y, 14, 5, -1, 0);
      applyDamage(8, 'IMPACTO DER');
      break;
  }
}

const btnDpadUp = document.getElementById('btnDpadUp');
if (btnDpadUp) btnDpadUp.addEventListener('click', () => dpadAction('up'));

const btnDpadDown = document.getElementById('btnDpadDown');
if (btnDpadDown) btnDpadDown.addEventListener('click', () => dpadAction('down'));

const btnDpadLeft = document.getElementById('btnDpadLeft');
if (btnDpadLeft) btnDpadLeft.addEventListener('click', () => dpadAction('left'));

const btnDpadRight = document.getElementById('btnDpadRight');
if (btnDpadRight) btnDpadRight.addEventListener('click', () => dpadAction('right'));

// Botones retro físicos de Tamagotchi
document.getElementById('btnActionA').addEventListener('click', actionSlap);
document.getElementById('btnActionB').addEventListener('click', actionShake);
document.getElementById('btnActionC').addEventListener('click', actionCleanScreen);

// Controles auxiliares
const btnFullscreen = document.getElementById('btnFullscreen');
if (btnFullscreen) {
  btnFullscreen.addEventListener('click', () => {
    window.retroAudio.playClick();
    if (!document.fullscreenElement) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else if (document.documentElement.webkitRequestFullscreen) {
        document.documentElement.webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }
  });
}

const btnSoundToggle = document.getElementById('btnSoundToggle');
const soundIcon = document.getElementById('soundIcon');
btnSoundToggle.addEventListener('click', () => {
  const isMuted = window.retroAudio.toggleMute();
  soundIcon.textContent = isMuted ? '🔇' : '🔊';
});

// Selector de Colores de Carcasa
const themes = ['', 'theme-obsidian', 'theme-toxic', 'theme-cute', 'theme-bloodlcd'];
let currentThemeIdx = 0;
document.getElementById('btnThemeToggle').addEventListener('click', () => {
  window.retroAudio.playClick();
  document.body.className = '';
  currentThemeIdx = (currentThemeIdx + 1) % themes.length;
  if (themes[currentThemeIdx]) {
    document.body.classList.add(themes[currentThemeIdx]);
  }
});

document.getElementById('btnResetAll').addEventListener('click', () => {
  window.retroAudio.playClick();
  actionCleanScreen();
  avatar.reset();
  GameState.totalDamage = 0;
  GameState.comboCount = 0;
  totalDamageText.textContent = '0';
  comboMultiplierText.textContent = 'x1.0';
});

// Controles por Teclado (Atajos rápidos)
window.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();

  // Flechas del teclado para el D-PAD
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    dpadAction('up');
    return;
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    dpadAction('down');
    return;
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    dpadAction('left');
    return;
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    dpadAction('right');
    return;
  }

  switch (key) {
    case '1':
    case 'g':
      actionPunch();
      break;
    case '2':
    case 'r':
      actionLightning();
      break;
    case '3':
    case 'f':
      actionFire();
      break;
    case '4':
    case 's':
      actionSaw();
      break;
    case '5':
    case 'a':
      actionAcid();
      break;
    case '6':
    case 'n':
      actionSpikes();
      break;
    case '7':
    case 'k':
    case 'm':
      actionInstantDeath();
      break;
    case '8':
    case 'v':
    case 'h':
      actionRevive();
      break;
    case 'p':
      actionGun();
      break;
    case 'i':
      actionFreeze();
      break;
    case 'y':
      actionAnvil();
      break;
    case 't':
      actionFood();
      break;
    case 'c':
      actionCleanScreen();
      break;
    case 'z':
      actionSlap();
      break;
    case ' ':
      e.preventDefault();
      actionShake();
      break;
  }
});

// Render inicial de lista de logros
renderAchievementsList();
