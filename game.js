// ============================================================
// RESCUE MY VALENTINE - 16-bit Platformer
// Vanilla HTML5 Canvas Game
// ============================================================

(function () {
  "use strict";

  // ── CONSTANTS ──────────────────────────────────────────────
  const GAME_W = 480;
  const GAME_H = 270;
  const TILE = 16;
  const GRAVITY = 0.55;
  const JUMP_VEL = -8.5;
  const MOVE_SPEED = 2.5;
  const MAX_FALL = 10;

  // Colors for keys / cages
  const KEY_COLORS = [
    { name: "Red", fill: "#e74c3c", dark: "#c0392b" },
    { name: "Blue", fill: "#3498db", dark: "#2980b9" },
    { name: "Green", fill: "#2ecc71", dark: "#27ae60" },
    { name: "Yellow", fill: "#f1c40f", dark: "#d4ac0f" },
    { name: "Purple", fill: "#9b59b6", dark: "#8e44ad" },
    { name: "Orange", fill: "#e67e22", dark: "#d35400" },
  ];

  // Animal data
  const ANIMALS = [
    { name: "Awice", desc: "King Charles Spaniel", colors: { body: "#fff", patches: "#222", ear: "#222", nose: "#222" } },
    { name: "Ella", desc: "Tuxedo Cat", colors: { body: "#222", chest: "#fff", ear: "#222", nose: "#ffaaaa" } },
    { name: "Malmoo", desc: "German Shepherd", colors: { body: "#c8a24e", patches: "#3d2b1f", ear: "#3d2b1f", nose: "#222" } },
    { name: "Parm", desc: "Australian Shepherd", colors: { body: "#8B5E3C", patches: "#fff", ear: "#6b3a2a", nose: "#222" } },
    { name: "Frito", desc: "French Bulldog", colors: { body: "#d4a76a", patches: "#c8955a", ear: "#d4a76a", nose: "#333" } },
    { name: "Lil Lady", desc: "Tortoiseshell Cat", colors: { body: "#000", patches: "#e67e22", ear: "#333", nose: "#ffaaaa" } },
  ];

  // Tile types
  const T = {
    EMPTY: 0,
    GROUND: 1,
    PLATFORM: 2,
    SPIKE: 3,
    LAVA: 4,
    CAGE_0: 10, // cages 10-15
    KEY_0: 20,  // keys 20-25
    DOOR_FINAL: 30,
    CHECKPOINT: 31,
    DECO_FLOWER: 32,
    DECO_GRASS: 33,
    BRICK: 34,
    BRIDGE: 35,
    LAVA_TOP: 36,
  };

  // ── CANVAS SETUP ───────────────────────────────────────────
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;
  let dpr = 1; // device pixel ratio for crisp rendering

  let isPortrait = false;
  let portraitControlsHeight = 0;  // Height reserved for controls in portrait mode
  let portraitSkyHeight = 0;       // Sky extension above game area
  let portraitGroundHeight = 0;    // Ground extension below game area
  let cssWidth = 0;
  let cssHeight = 0;
  // Visible game area in game-coordinate space (accounts for zoom cropping)
  let visibleLeft = 0;
  let visibleRight = GAME_W;
  let visibleWidth = GAME_W;
  let visibleTop = 0;
  let visibleBottom = GAME_H;
  
  function resizeCanvas() {
    dpr = window.devicePixelRatio || 1;
    cssWidth = window.innerWidth;
    cssHeight = window.innerHeight;
    
    // Size canvas backing store at native resolution for crisp pixels
    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;
    canvas.style.width = cssWidth + "px";
    canvas.style.height = cssHeight + "px";
    
    isPortrait = cssHeight > cssWidth;
    
    if (isPortrait) {
      // Portrait mode: zoom in for a closer, crisper feel
      const controlButtonSize = 70;
      const controlPadding = 20;
      portraitControlsHeight = (controlButtonSize + controlPadding * 2) * dpr;
      
      // Available height for game + extensions (excluding controls)
      const availableHeight = canvas.height - portraitControlsHeight;
      
      // Zoom in 1.4x beyond filling width — crops sides slightly
      // but makes sprites bigger and crisper
      const PORTRAIT_ZOOM = 1.4;
      scale = (canvas.width / GAME_W) * PORTRAIT_ZOOM;
      const gameDisplayWidth = GAME_W * scale;
      const gameDisplayHeight = GAME_H * scale;
      
      // Center horizontally (negative offset crops the sides)
      offsetX = (canvas.width - gameDisplayWidth) / 2;
      
      // Position game area in vertical space
      const extraSpace = availableHeight - gameDisplayHeight;
      portraitSkyHeight = Math.max(0, extraSpace * 0.35);
      portraitGroundHeight = Math.max(0, extraSpace * 0.65);
      offsetY = portraitSkyHeight;
      
      // Compute visible area in game coordinates
      visibleWidth = canvas.width / scale;
      visibleLeft = (GAME_W - visibleWidth) / 2;
      visibleRight = visibleLeft + visibleWidth;
      visibleTop = -portraitSkyHeight / scale;
      visibleBottom = (canvas.height - portraitControlsHeight - offsetY) / scale;
    } else {
      // Landscape mode: fit to screen maintaining aspect ratio
      const sx = canvas.width / GAME_W;
      const sy = canvas.height / GAME_H;
      scale = Math.min(sx, sy);
      offsetX = (canvas.width - GAME_W * scale) / 2;
      offsetY = (canvas.height - GAME_H * scale) / 2;
      portraitControlsHeight = 0;
      portraitSkyHeight = 0;
      portraitGroundHeight = 0;
      visibleLeft = 0;
      visibleRight = GAME_W;
      visibleWidth = GAME_W;
      visibleTop = 0;
      visibleBottom = GAME_H;
    }
  }
  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  // ── GAME STATE ─────────────────────────────────────────────
  const STATE = { TITLE: 0, PLAYING: 1, ROOM: 2, PROPOSAL: 3, WIN: 4 };
  let gameState = STATE.TITLE;
  let player, camera, level, keys_collected, cages_opened, heldKey, checkpointX, checkpointY;
  let freedAnimals = [];
  let rescueMessage = "";
  let rescueMessageTimer = 0;
  let wrongKeyTimer = 0;
  let doorOpen = false;
  let roomProposalTriggered = false;
  let proposalChoice = -1;
  let winTimer = 0;
  let titleBlink = 0;
  let particles = [];
  let lavaFrame = 0;
  let animFrame = 0;
  let frameCount = 0;
  let jumpBufferTimer = 0;
  let coyoteTimer = 0;
  let dustCooldown = 0;
  const JUMP_BUFFER = 8;
  const COYOTE_TIME = 6;
  const DUST_COOLDOWN = 10;

  // Background decoration arrays (generated once per level)
  let bgClouds = [];
  let bgTrees = [];
  let bgMountains = [];
  let bgFlowers = [];
  let bgButterflies = [];

  // ── INPUT ──────────────────────────────────────────────────
  const input = { left: false, right: false, jump: false, jumpPressed: false };
  let touches = {};
  const BTN_SIZE = 52;
  const BTN_PAD = 12;

  function getTouchButtons() {
    if (isPortrait) {
      // Portrait mode: controls positioned in canvas/device-pixel coordinates
      const b = 70 * dpr;
      const p = 20 * dpr;
      const controlsY = canvas.height - portraitControlsHeight + p;
      return {
        left: { x: p, y: controlsY, w: b, h: b, screenCoords: true },
        right: { x: p + b + 12 * dpr, y: controlsY, w: b, h: b, screenCoords: true },
        jump: { x: canvas.width - b - p, y: controlsY, w: b, h: b, screenCoords: true },
      };
    } else {
      // Landscape mode: controls in game coordinates
      const b = BTN_SIZE;
      const p = BTN_PAD;
      const yPos = GAME_H - b - p;
      return {
        left: { x: p, y: yPos, w: b, h: b, screenCoords: false },
        right: { x: p + b + 8, y: yPos, w: b, h: b, screenCoords: false },
        jump: { x: GAME_W - b - p, y: yPos, w: b, h: b, screenCoords: false },
      };
    }
  }

  function gameXY(tx, ty) {
    // Convert CSS-pixel touch coords to game coords
    return {
      x: (tx * dpr - offsetX) / scale,
      y: (ty * dpr - offsetY) / scale,
    };
  }

  canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    const btns = getTouchButtons();
    for (const t of e.changedTouches) {
      const p = gameXY(t.clientX, t.clientY);
      const screenX = t.clientX;
      const screenY = t.clientY;
      touches[t.identifier] = { game: p, screen: { x: screenX, y: screenY } };
      if (gameState === STATE.TITLE) {
        gameState = STATE.PLAYING;
        initGame();
        return;
      }
      if (gameState === STATE.WIN) { return; }
      if (gameState === STATE.PROPOSAL) {
        handleProposalClick(p.x, p.y);
        return;
      }
      if (checkButtonHit(screenX, screenY, btns.left)) input.left = true;
      if (checkButtonHit(screenX, screenY, btns.right)) input.right = true;
      if (checkButtonHit(screenX, screenY, btns.jump)) { input.jump = true; input.jumpPressed = true; }
    }
  }, { passive: false });

  canvas.addEventListener("touchmove", (e) => {
    e.preventDefault();
    const btns = getTouchButtons();
    input.left = false;
    input.right = false;
    input.jump = false;
    for (const t of e.touches) {
      const p = gameXY(t.clientX, t.clientY);
      const screenX = t.clientX;
      const screenY = t.clientY;
      touches[t.identifier] = { game: p, screen: { x: screenX, y: screenY } };
      if (checkButtonHit(screenX, screenY, btns.left)) input.left = true;
      if (checkButtonHit(screenX, screenY, btns.right)) input.right = true;
      if (checkButtonHit(screenX, screenY, btns.jump)) input.jump = true;
    }
  }, { passive: false });

  canvas.addEventListener("touchend", (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      delete touches[t.identifier];
    }
    const btns = getTouchButtons();
    input.left = false;
    input.right = false;
    input.jump = false;
    for (const id in touches) {
      const touch = touches[id];
      if (checkButtonHit(touch.screen.x, touch.screen.y, btns.left)) input.left = true;
      if (checkButtonHit(touch.screen.x, touch.screen.y, btns.right)) input.right = true;
      if (checkButtonHit(touch.screen.x, touch.screen.y, btns.jump)) input.jump = true;
    }
  }, { passive: false });

  canvas.addEventListener("touchcancel", (e) => {
    e.preventDefault();
    touches = {};
    input.left = false;
    input.right = false;
    input.jump = false;
  }, { passive: false });

  canvas.addEventListener("mousedown", (e) => {
    const p = gameXY(e.clientX, e.clientY);
    if (gameState === STATE.TITLE) {
      gameState = STATE.PLAYING;
      initGame();
      return;
    }
    if (gameState === STATE.PROPOSAL) {
      handleProposalClick(p.x, p.y);
      return;
    }
    if (gameState === STATE.WIN) { return; }
  });

  function inBtn(p, btn) {
    return p.x >= btn.x && p.x <= btn.x + btn.w && p.y >= btn.y && p.y <= btn.y + btn.h;
  }

  // Check if point hits a button, using correct coordinate space
  function checkButtonHit(screenX, screenY, btn) {
    if (btn.screenCoords) {
      // Button is in canvas/device-pixel coords, convert CSS touch coords
      const cx = screenX * dpr;
      const cy = screenY * dpr;
      return cx >= btn.x && cx <= btn.x + btn.w && 
             cy >= btn.y && cy <= btn.y + btn.h;
    } else {
      // Button position is in game coordinates
      const p = gameXY(screenX, screenY);
      return p.x >= btn.x && p.x <= btn.x + btn.w && 
             p.y >= btn.y && p.y <= btn.y + btn.h;
    }
  }

  window.addEventListener("keydown", (e) => {
    if (gameState === STATE.TITLE) {
      gameState = STATE.PLAYING;
      initGame();
      return;
    }
    if (e.code === "ArrowLeft" || e.code === "KeyA") input.left = true;
    if (e.code === "ArrowRight" || e.code === "KeyD") input.right = true;
    if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
      input.jump = true;
      input.jumpPressed = true;
    }
    if (gameState === STATE.PROPOSAL) {
      if (e.code === "Digit1") { proposalChoice = 0; goToWin(); }
      if (e.code === "Digit2") { proposalChoice = 1; goToWin(); }
    }
  });

  window.addEventListener("keyup", (e) => {
    if (e.code === "ArrowLeft" || e.code === "KeyA") input.left = false;
    if (e.code === "ArrowRight" || e.code === "KeyD") input.right = false;
    if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") input.jump = false;
  });

  // ── LEVEL MAP ──────────────────────────────────────────────
  function buildLevel() {
    const W = 180;
    const H = 17;
    const m = [];
    for (let y = 0; y < H; y++) {
      m[y] = [];
      for (let x = 0; x < W; x++) {
        m[y][x] = T.EMPTY;
      }
    }

    function fillRow(y, x1, x2, t) { for (let x = x1; x <= x2; x++) m[y][x] = t; }
    function fillRect(y1, x1, y2, x2, t) { for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) m[y][x] = t; }

    // Ground floor across entire level (row 16)
    fillRow(16, 0, W - 1, T.GROUND);
    fillRow(15, 0, 4, T.GROUND);

    // ─── SECTION 1: Start Area + Red Key + Alice (tiles 0-28) ───
    fillRow(15, 0, 28, T.GROUND);
    // Wider, well-spaced platforms to learn jumping
    fillRow(12, 5, 9, T.PLATFORM);   // wider: 5 tiles
    fillRow(10, 11, 15, T.PLATFORM);  // wider: 5 tiles
    // Red key floating
    m[9][13] = T.KEY_0 + 0;
    // Cage for Alice
    m[13][24] = T.CAGE_0 + 0;
    fillRow(14, 22, 26, T.GROUND);
    fillRow(15, 22, 26, T.GROUND);
    // Checkpoint
    m[14][27] = T.CHECKPOINT;
    // Decorations
    m[14][2] = T.DECO_FLOWER;
    m[14][4] = T.DECO_GRASS;
    m[14][7] = T.DECO_FLOWER;
    m[14][18] = T.DECO_GRASS;
    m[14][20] = T.DECO_FLOWER;

    // ─── SECTION 2: Spike Section + Blue Key + Ella (tiles 29-55) ───
    fillRow(15, 29, 55, T.GROUND);
    // Spike gauntlet on ground
    fillRow(14, 33, 35, T.SPIKE);
    // Wider platforms above spikes - good spacing, no head-bonking
    fillRow(11, 31, 35, T.PLATFORM);  // 5 tiles wide, row 11 (5 rows above ground)
    fillRow(11, 37, 41, T.PLATFORM);  // 5 tiles wide
    // More spikes
    fillRow(14, 39, 41, T.SPIKE);
    // Blue key on high platform - plenty of room
    fillRow(8, 43, 47, T.PLATFORM);   // 5 tiles wide, row 8
    m[7][45] = T.KEY_0 + 1;
    // Step-up platform to reach the high one
    fillRow(11, 43, 46, T.PLATFORM);
    // Ella cage
    m[13][51] = T.CAGE_0 + 1;
    fillRow(14, 49, 53, T.GROUND);
    // Checkpoint
    m[14][54] = T.CHECKPOINT;
    // Decorations
    m[14][30] = T.DECO_GRASS;
    m[14][48] = T.DECO_FLOWER;

    // ─── SECTION 3: Lava Pit + Green Key + Malibu (tiles 56-85) ───
    fillRow(15, 56, 62, T.GROUND);
    // Lava pit - flush with ground (LAVA_TOP at row 15, same as ground surface)
    fillRow(16, 63, 72, T.LAVA);
    fillRow(15, 63, 72, T.LAVA_TOP);
    // Platforms over lava - lowered for easier access
    fillRow(13, 61, 62, T.PLATFORM);  // stepping stone to help reach first platform
    fillRow(12, 63, 67, T.PLATFORM);  // 5 tiles wide, row 12 (lower, easier to reach)
    fillRow(12, 69, 73, T.PLATFORM);  // 5 tiles wide, same height – easy hop
    // Green key above lava
    m[10][71] = T.KEY_0 + 2;
    // Landing after lava
    fillRow(15, 73, 85, T.GROUND);
    // Malibu cage
    m[13][80] = T.CAGE_0 + 2;
    fillRow(14, 78, 82, T.GROUND);
    // Checkpoint
    m[14][84] = T.CHECKPOINT;
    // Decorations
    m[14][57] = T.DECO_GRASS;
    m[14][59] = T.DECO_FLOWER;
    m[14][75] = T.DECO_GRASS;
    m[14][77] = T.DECO_FLOWER;

    // ─── SECTION 4: Vertical Climb + Yellow Key + Carma (tiles 86-112) ───
    fillRow(15, 86, 112, T.GROUND);
    // Staircase of wide platforms – each offset so you never bonk your head
    fillRow(13, 88, 92, T.PLATFORM);   // row 13, 5 wide
    fillRow(11, 94, 98, T.PLATFORM);   // row 11, 5 wide (offset right)
    fillRow(9, 88, 92, T.PLATFORM);    // row 9, 5 wide (back left)
    fillRow(7, 94, 98, T.PLATFORM);    // row 7, 5 wide (offset right)
    fillRow(5, 89, 93, T.PLATFORM);    // row 5, 5 wide
    // Yellow key at top
    m[4][91] = T.KEY_0 + 3;
    // Spikes at bottom to punish falls
    fillRow(14, 93, 97, T.SPIKE);
    // Carma cage
    m[13][106] = T.CAGE_0 + 3;
    fillRow(14, 104, 108, T.GROUND);
    // Checkpoint
    m[14][111] = T.CHECKPOINT;
    // Decorations
    m[14][87] = T.DECO_FLOWER;
    m[14][100] = T.DECO_GRASS;
    m[14][102] = T.DECO_FLOWER;

    // ─── SECTION 5: Mixed Hazards + Purple Key + Frito (tiles 113-142) ───
    fillRow(15, 113, 121, T.GROUND);
    // Spikes on ground
    fillRow(14, 119, 121, T.SPIKE);
    // Small lava pit - flush with ground (LAVA_TOP at row 15)
    fillRow(16, 122, 126, T.LAVA);
    fillRow(15, 122, 126, T.LAVA_TOP);
    // Stepping stone to help reach first platform
    fillRow(13, 116, 118, T.PLATFORM);
    // Wider platforms – same height so no head bonk issues
    fillRow(11, 118, 121, T.PLATFORM);  // 4 wide, row 11
    fillRow(11, 123, 126, T.PLATFORM);  // 4 wide, same row – easy lateral jump
    // Purple key
    m[9][124] = T.KEY_0 + 4;
    // Landing
    fillRow(15, 127, 142, T.GROUND);
    fillRow(14, 130, 132, T.SPIKE);
    fillRow(11, 130, 134, T.PLATFORM);  // wide bypass platform
    // Frito cage
    m[13][137] = T.CAGE_0 + 4;
    fillRow(14, 135, 139, T.GROUND);
    // Checkpoint
    m[14][141] = T.CHECKPOINT;
    // Decorations
    m[14][114] = T.DECO_GRASS;
    m[14][116] = T.DECO_FLOWER;
    m[14][128] = T.DECO_GRASS;

    // ─── SECTION 6: Final Challenge + Orange Key + Molly (tiles 143-170) ───
    fillRow(15, 143, 150, T.GROUND);
    // Spikes on ground
    fillRow(14, 149, 150, T.SPIKE);
    // Lava pit - flush with ground (LAVA_TOP at row 15)
    fillRow(16, 151, 155, T.LAVA);
    fillRow(15, 151, 155, T.LAVA_TOP);
    // Wider platforms at consistent heights for fair jumps
    fillRow(12, 148, 151, T.PLATFORM); // 4 wide
    fillRow(12, 153, 156, T.PLATFORM); // 4 wide, same height
    fillRow(10, 154, 158, T.PLATFORM);  // 5 wide, lowered for easier access
    // Orange key at highest point
    m[9][156] = T.KEY_0 + 5;
    fillRow(14, 156, 158, T.SPIKE);
    fillRow(15, 156, 170, T.GROUND);
    fillRow(11, 158, 161, T.PLATFORM); // landing platform
    // Molly cage
    m[13][164] = T.CAGE_0 + 5;
    fillRow(14, 162, 166, T.GROUND);
    // Decorations
    m[14][144] = T.DECO_FLOWER;
    m[14][146] = T.DECO_GRASS;
    m[14][167] = T.DECO_FLOWER;
    m[14][169] = T.DECO_GRASS;

    // ─── FINAL DOOR (tile 172) ───
    m[13][172] = T.DOOR_FINAL;
    m[14][172] = T.DOOR_FINAL;
    fillRow(15, 168, 179, T.GROUND);

    return { map: m, width: W, height: H };
  }

  // ── GENERATE BACKGROUND DECORATIONS ────────────────────────
  function generateBgDecorations() {
    bgClouds = [];
    bgTrees = [];
    bgMountains = [];
    bgFlowers = [];
    bgButterflies = [];

    // Clouds at various depths
    for (let i = 0; i < 20; i++) {
      bgClouds.push({
        x: Math.random() * 180 * TILE,
        y: 10 + Math.random() * 60,
        w: 30 + Math.random() * 50,
        h: 12 + Math.random() * 10,
        speed: 0.1 + Math.random() * 0.15,
        depth: 0.1 + Math.random() * 0.3,
        opacity: 0.4 + Math.random() * 0.4,
      });
    }

    // Mountains (far background)
    for (let i = 0; i < 12; i++) {
      bgMountains.push({
        x: i * 250 + Math.random() * 80,
        w: 120 + Math.random() * 100,
        h: 50 + Math.random() * 40,
        color: i % 3 === 0 ? "#5a7a9a" : i % 3 === 1 ? "#4a6a8a" : "#6a8aaa",
        snowCap: Math.random() > 0.4,
      });
    }

    // Trees (mid background)
    for (let i = 0; i < 30; i++) {
      bgTrees.push({
        x: i * 100 + Math.random() * 60,
        type: Math.floor(Math.random() * 3), // 0=pine, 1=oak, 2=bush
        h: 20 + Math.random() * 25,
        shade: Math.random() * 0.3,
      });
    }

    // Butterflies
    for (let i = 0; i < 8; i++) {
      bgButterflies.push({
        x: Math.random() * 180 * TILE,
        y: 100 + Math.random() * 100,
        color: ["#e74c3c", "#ff69b4", "#f1c40f", "#9b59b6", "#3498db"][Math.floor(Math.random() * 5)],
        phase: Math.random() * Math.PI * 2,
        speed: 0.3 + Math.random() * 0.5,
      });
    }
  }

  // ── INIT GAME ──────────────────────────────────────────────
  function initGame() {
    level = buildLevel();
    player = {
      x: 85, y: 200,
      vx: 0, vy: 0,
      w: 12, h: 20,
      onGround: false,
      facing: 1,
      walkFrame: 0,
      walkTimer: 0,
    };
    camera = { x: 0, y: 0 };
    heldKey = -1;
    keys_collected = [false, false, false, false, false, false];
    cages_opened = [false, false, false, false, false, false];
    freedAnimals = [];
    checkpointX = 85;
    checkpointY = 200;
    doorOpen = false;
    roomProposalTriggered = false;
    proposalChoice = -1;
    winTimer = 0;
    rescueMessage = "";
    rescueMessageTimer = 0;
    wrongKeyTimer = 0;
    particles = [];
    jumpBufferTimer = 0;
    coyoteTimer = 0;
    dustCooldown = 0;
    generateBgDecorations();
  }

  // ── COLLISION HELPERS ──────────────────────────────────────
  // Platforms are ONE-WAY: only solid when landing on top
  function isSolid(tx, ty) {
    if (tx < 0 || tx >= level.width || ty < 0 || ty >= level.height) return true;
    const t = level.map[ty][tx];
    return t === T.GROUND || t === T.BRICK || t === T.BRIDGE;
    // NOTE: T.PLATFORM removed – handled specially as one-way
  }

  function isPlatform(tx, ty) {
    if (tx < 0 || tx >= level.width || ty < 0 || ty >= level.height) return false;
    return level.map[ty][tx] === T.PLATFORM;
  }

  function isHazard(tx, ty) {
    if (tx < 0 || tx >= level.width || ty < 0 || ty >= level.height) return false;
    const t = level.map[ty][tx];
    return t === T.SPIKE || t === T.LAVA || t === T.LAVA_TOP;
  }

  function tileAt(tx, ty) {
    if (tx < 0 || tx >= level.width || ty < 0 || ty >= level.height) return T.EMPTY;
    return level.map[ty][tx];
  }

  // ── PARTICLE SYSTEM ────────────────────────────────────────
  function spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      particles.push({
        x: x, y: y,
        vx: (Math.random() - 0.5) * 4,
        vy: -Math.random() * 5 - 1,
        life: 40 + Math.random() * 30,
        maxLife: 70,
        color: color,
        size: 2 + Math.random() * 3,
      });
    }
  }

  function spawnHearts(x, y, count) {
    for (let i = 0; i < count; i++) {
      particles.push({
        x: x, y: y,
        vx: (Math.random() - 0.5) * 3,
        vy: -Math.random() * 3 - 1,
        life: 50 + Math.random() * 40,
        maxLife: 90,
        color: "#e74c3c",
        size: 4,
        isHeart: true,
      });
    }
  }

  // Dust particles when landing
  function spawnDust(x, y) {
    for (let i = 0; i < 4; i++) {
      particles.push({
        x: x + (Math.random() - 0.5) * 8,
        y: y,
        vx: (Math.random() - 0.5) * 2,
        vy: -Math.random() * 1.5,
        life: 15 + Math.random() * 10,
        maxLife: 25,
        color: "#c8b898",
        size: 1 + Math.random() * 2,
      });
    }
  }

  // Confetti popper when reaching checkpoint
  function spawnCheckpointPopper(x, y) {
    const colors = ["#ff6b6b", "#4ecdc4", "#45b7d1", "#f7b731", "#5f27cd", "#00d2d3", "#ff9ff3", "#feca57"];
    for (let i = 0; i < 25; i++) {
      const angle = (Math.random() * Math.PI * 2);
      const speed = 2 + Math.random() * 4;
      particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        life: 40 + Math.random() * 30,
        maxLife: 70,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 2 + Math.random() * 2,
      });
    }
  }

  function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.1;
      p.life--;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  // ── UPDATE ─────────────────────────────────────────────────
  let wasOnGround = false;

  function update() {
    frameCount++;
    animFrame = Math.floor(frameCount / 8) % 4;
    lavaFrame = Math.floor(frameCount / 10) % 3;

    if (gameState === STATE.TITLE) {
      titleBlink = Math.floor(frameCount / 30) % 2;
      return;
    }

    if (gameState === STATE.WIN) {
      winTimer++;
      if (winTimer % 5 === 0) {
        spawnHearts(Math.random() * GAME_W, -5, 1);
      }
      updateParticles();
      return;
    }

    if (gameState === STATE.PROPOSAL) {
      if (frameCount % 8 === 0) {
        spawnHearts(GAME_W / 2 + (Math.random() - 0.5) * 100, GAME_H / 2, 1);
      }
      updateParticles();
      return;
    }

    if (gameState === STATE.ROOM) {
      // In the room, check if player is near the boy to trigger proposal
      const boyX = visibleRight - 50;
      const boyY = GAME_H - 40 - 28;
      const pl = player;
      
      // Player can still move in the room
      const prevVx = pl.vx;
      pl.vx = 0;
      if (input.left) pl.vx = -MOVE_SPEED;
      if (input.right) pl.vx = MOVE_SPEED;
      if (pl.vx !== 0) pl.facing = pl.vx > 0 ? 1 : -1;

      // Walk animation
      if (Math.abs(pl.vx) > 0.3) {
        pl.walkTimer++;
        if (pl.walkTimer > 6) {
          pl.walkTimer = 0;
          pl.walkFrame = (pl.walkFrame + 1) % 4;
        }
      } else {
        pl.walkFrame = 0;
        pl.walkTimer = 0;
      }

      // Move player
      pl.x += pl.vx;
      // Clamp to room bounds (visible area)
      if (pl.x < visibleLeft + 10) pl.x = visibleLeft + 10;
      if (pl.x > visibleRight - 30) pl.x = visibleRight - 30;

      // Check if player is in front of boy
      if (Math.abs(pl.x - (boyX - 20)) < 25 && !roomProposalTriggered) {
        roomProposalTriggered = true;
        gameState = STATE.PROPOSAL;
      }
      
      updateParticles();
      return;
    }

    // ── PLAYING STATE ──
    const pl = player;
    wasOnGround = pl.onGround;

    // Horizontal movement
    if (input.left) {
      pl.vx = -MOVE_SPEED;
      pl.facing = -1;
    } else if (input.right) {
      pl.vx = MOVE_SPEED;
      pl.facing = 1;
    } else {
      pl.vx *= 0.6;
      if (Math.abs(pl.vx) < 0.2) pl.vx = 0;
    }

    // Jump buffering
    if (input.jumpPressed) {
      jumpBufferTimer = JUMP_BUFFER;
      input.jumpPressed = false;
    }
    if (jumpBufferTimer > 0) jumpBufferTimer--;

    // Coyote time
    if (pl.onGround) {
      coyoteTimer = COYOTE_TIME;
    } else {
      if (coyoteTimer > 0) coyoteTimer--;
    }

    // Execute jump
    if (jumpBufferTimer > 0 && coyoteTimer > 0) {
      pl.vy = JUMP_VEL;
      pl.onGround = false;
      jumpBufferTimer = 0;
      coyoteTimer = 0;
    }

    // Variable jump height
    if (!input.jump && pl.vy < -2) {
      pl.vy *= 0.7;
    }

    // Gravity
    pl.vy += GRAVITY;
    if (pl.vy > MAX_FALL) pl.vy = MAX_FALL;

    // Walk animation
    if (Math.abs(pl.vx) > 0.3 && pl.onGround) {
      pl.walkTimer++;
      if (pl.walkTimer > 6) {
        pl.walkTimer = 0;
        pl.walkFrame = (pl.walkFrame + 1) % 4;
      }
    } else if (pl.onGround) {
      pl.walkFrame = 0;
      pl.walkTimer = 0;
    }

    // Move X with collision (only solid tiles, NOT platforms)
    pl.x += pl.vx;
    resolveCollisionX(pl);

    // Move Y with collision
    const oldY = pl.y;
    const preCollisionVy = pl.vy;  // Save velocity before collision
    pl.y += pl.vy;
    pl.onGround = false;
    resolveCollisionY(pl);

    // Landing dust effect (with cooldown to prevent particle spam)
    // Only spawn dust on actual landing with significant downward velocity (not micro-bouncing)
    if (dustCooldown > 0) dustCooldown--;
    if (pl.onGround && !wasOnGround && dustCooldown === 0 && preCollisionVy >= 2) {
      spawnDust(pl.x + pl.w / 2, pl.y + pl.h);
      dustCooldown = DUST_COOLDOWN;
    }

    // Clamp to level bounds
    if (pl.x < 0) pl.x = 0;
    if (pl.x > level.width * TILE - pl.w) pl.x = level.width * TILE - pl.w;
    if (pl.y > level.height * TILE + 32) {
      respawnPlayer();
    }

    // Check hazards
    const cx = Math.floor((pl.x + pl.w / 2) / TILE);
    const cyTop = Math.floor(pl.y / TILE);
    const cyBot = Math.floor((pl.y + pl.h - 1) / TILE);
    const cxL = Math.floor(pl.x / TILE);
    const cxR = Math.floor((pl.x + pl.w - 1) / TILE);
    for (let ty = cyTop; ty <= cyBot; ty++) {
      for (let tx = cxL; tx <= cxR; tx++) {
        if (isHazard(tx, ty)) {
          respawnPlayer();
          return;
        }
      }
    }

    // Check pickups
    checkPickups(cx, cyTop, cyBot, cxL, cxR);

    // Update camera
    camera.x = pl.x + pl.w / 2 - GAME_W / 2;
    camera.y = pl.y + pl.h / 2 - GAME_H / 2;
    if (camera.x < 0) camera.x = 0;
    if (camera.x > level.width * TILE - GAME_W) camera.x = level.width * TILE - GAME_W;
    if (camera.y < 0) camera.y = 0;
    if (camera.y > level.height * TILE - GAME_H) camera.y = level.height * TILE - GAME_H;

    if (rescueMessageTimer > 0) rescueMessageTimer--;
    if (wrongKeyTimer > 0) wrongKeyTimer--;

    updateFreedAnimals();
    updateParticles();

    // Update butterflies
    for (const b of bgButterflies) {
      b.x += Math.sin(frameCount * 0.03 + b.phase) * b.speed;
      b.y += Math.cos(frameCount * 0.02 + b.phase) * 0.3;
    }
  }

  function resolveCollisionX(pl) {
    const left = Math.floor(pl.x / TILE);
    const right = Math.floor((pl.x + pl.w - 1) / TILE);
    const top = Math.floor(pl.y / TILE);
    const bottom = Math.floor((pl.y + pl.h - 1) / TILE);

    for (let ty = top; ty <= bottom; ty++) {
      for (let tx = left; tx <= right; tx++) {
        if (isSolid(tx, ty)) {
          if (pl.vx > 0) {
            pl.x = tx * TILE - pl.w;
          } else if (pl.vx < 0) {
            pl.x = (tx + 1) * TILE;
          }
          pl.vx = 0;
        }
        // Platforms do NOT block horizontal movement
      }
    }
  }

  function resolveCollisionY(pl) {
    const left = Math.floor(pl.x / TILE);
    const right = Math.floor((pl.x + pl.w - 1) / TILE);
    const top = Math.floor(pl.y / TILE);
    const bottom = Math.floor((pl.y + pl.h - 1) / TILE);

    for (let ty = top; ty <= bottom; ty++) {
      for (let tx = left; tx <= right; tx++) {
        if (isSolid(tx, ty)) {
          if (pl.vy > 0) {
            pl.y = ty * TILE - pl.h;
            pl.vy = 0;
            pl.onGround = true;
          } else if (pl.vy < 0) {
            pl.y = (ty + 1) * TILE;
            pl.vy = 0;
          }
        }
        // One-way platform: only collide when falling DOWN onto the top
        if (isPlatform(tx, ty) && pl.vy > 0) {
          const platTop = ty * TILE;
          const playerBottom = pl.y + pl.h;
          const prevBottom = playerBottom - pl.vy;
          // Only land if feet were above or at platform top last frame
          if (prevBottom <= platTop + 2) {
            pl.y = platTop - pl.h;
            pl.vy = 0;
            pl.onGround = true;
          }
        }
      }
    }
  }

  function respawnPlayer() {
    player.x = checkpointX;
    player.y = checkpointY;
    player.vx = 0;
    player.vy = 0;
    jumpBufferTimer = 0;
    coyoteTimer = 0;
    spawnParticles(player.x + player.w / 2, player.y + player.h / 2, "#fff", 8);
  }

  function checkPickups(cx, cyTop, cyBot, cxL, cxR) {
    for (let ty = cyTop; ty <= cyBot; ty++) {
      for (let tx = cxL; tx <= cxR; tx++) {
        const tile = tileAt(tx, ty);

        if (tile >= T.KEY_0 && tile < T.KEY_0 + 6) {
          const keyIdx = tile - T.KEY_0;
          if (!keys_collected[keyIdx] || heldKey === -1) {
            heldKey = keyIdx;
            keys_collected[keyIdx] = true;
            level.map[ty][tx] = T.EMPTY;
            spawnParticles(tx * TILE + 8, ty * TILE + 8, KEY_COLORS[keyIdx].fill, 10);
          }
        }

        if (tile >= T.CAGE_0 && tile < T.CAGE_0 + 6) {
          const cageIdx = tile - T.CAGE_0;
          if (!cages_opened[cageIdx]) {
            if (heldKey === cageIdx) {
              cages_opened[cageIdx] = true;
              heldKey = -1;
              level.map[ty][tx] = T.EMPTY;
              freedAnimals.push({
                idx: cageIdx,
                x: tx * TILE,
                y: ty * TILE - 4,
                targetX: player.x,
                targetY: player.y,
              });
              rescueMessage = ANIMALS[cageIdx].name + " rescued!";
              rescueMessageTimer = 120;
              spawnHearts(tx * TILE + 8, ty * TILE + 8, 12);
              spawnParticles(tx * TILE + 8, ty * TILE + 8, KEY_COLORS[cageIdx].fill, 15);
              if (freedAnimals.length >= 6) {
                doorOpen = true;
              }
            } else {
              if (wrongKeyTimer <= 0) {
                wrongKeyTimer = 60;
              }
            }
          }
        }

        if (tile === T.CHECKPOINT) {
          // Only activate checkpoint once per touch
          const prevCheckX = checkpointX;
          const prevCheckY = checkpointY;
          checkpointX = tx * TILE;
          checkpointY = ty * TILE - player.h + TILE;
          // Spawn confetti popper if this is a new checkpoint
          if (prevCheckX !== checkpointX || prevCheckY !== checkpointY) {
            spawnCheckpointPopper(tx * TILE + 8, ty * TILE);
          }
        }

        if (tile === T.DOOR_FINAL && doorOpen) {
          gameState = STATE.ROOM;
          // Position player at left side of visible room
          player.x = visibleLeft + 30;
          player.y = GAME_H - 40 - 22;
          player.vy = 0;
          player.vx = 0;
          player.facing = 1;
          player.walkFrame = 0;
          roomProposalTriggered = false;
        }
      }
    }
  }

  function updateFreedAnimals() {
    for (let i = 0; i < freedAnimals.length; i++) {
      const a = freedAnimals[i];
      let targetX, targetY;
      if (i === 0) {
        targetX = player.x - 18;
        targetY = player.y + 4;
      } else {
        targetX = freedAnimals[i - 1].x - 14;
        targetY = freedAnimals[i - 1].y;
      }
      a.x += (targetX - a.x) * 0.08;
      a.y += (targetY - a.y) * 0.12;
    }
  }

  // ── PROPOSAL HANDLING ──────────────────────────────────────
  function handleProposalClick(mx, my) {
    const vc = visibleLeft + visibleWidth / 2;
    const btn1 = { x: vc - 90, y: 165, w: 80, h: 30 };
    const btn2 = { x: vc + 10, y: 165, w: 80, h: 30 };

    if (mx >= btn1.x && mx <= btn1.x + btn1.w && my >= btn1.y && my <= btn1.y + btn1.h) {
      proposalChoice = 0;
      goToWin();
    }
    if (mx >= btn2.x && mx <= btn2.x + btn2.w && my >= btn2.y && my <= btn2.y + btn2.h) {
      proposalChoice = 1;
      goToWin();
    }
  }

  function goToWin() {
    gameState = STATE.WIN;
    winTimer = 0;
    particles = [];
  }

  // ── DRAWING ────────────────────────────────────────────────
  function draw() {
    ctx.save();
    // Fill background based on game state to avoid harsh black borders
    if (isPortrait) {
      if (gameState === STATE.PLAYING) {
        ctx.fillStyle = "#1a0a02"; // deep earth tone for bottom fade
      } else if (gameState === STATE.TITLE || gameState === STATE.ROOM || gameState === STATE.PROPOSAL) {
        ctx.fillStyle = "#050015";
      } else if (gameState === STATE.WIN) {
        ctx.fillStyle = "#8B0000";
      } else {
        ctx.fillStyle = "#000";
      }
    } else {
      ctx.fillStyle = "#000";
    }
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
    ctx.imageSmoothingEnabled = false;

    if (gameState === STATE.TITLE) {
      drawTitle();
    } else if (gameState === STATE.PLAYING) {
      drawGame();
    } else if (gameState === STATE.ROOM) {
      drawRoom();
    } else if (gameState === STATE.PROPOSAL) {
      drawProposal();
    } else if (gameState === STATE.WIN) {
      drawWin();
    }

    ctx.restore();

    // Portrait mode: draw controls overlay and buttons
    if (isPortrait) {
      ctx.save();
      // Semi-transparent overlay on controls area for readability
      const controlsTop = canvas.height - portraitControlsHeight;
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(0, controlsTop, canvas.width, portraitControlsHeight);
      ctx.restore();
      
      drawPortraitControls();
    }
  }

  // Draw controls for portrait mode (in screen coordinates)
  function drawPortraitControls() {
    const b = 70 * dpr;  // Button size
    const p = 20 * dpr;  // Padding
    const controlsY = canvas.height - portraitControlsHeight + p;
    
    ctx.save();
    
    // Left button
    const leftBtn = { x: p, y: controlsY, w: b, h: b };
    // Right button
    const rightBtn = { x: p + b + 12 * dpr, y: controlsY, w: b, h: b };
    // Jump button
    const jumpBtn = { x: canvas.width - b - p, y: controlsY, w: b, h: b };
    
    const r = 14 * dpr;
    function drawBtn(btn, icon, isActive) {
      // Button shadow
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = "#000";
      roundRect(ctx, btn.x + 2 * dpr, btn.y + 2 * dpr, btn.w, btn.h, r);
      ctx.fill();
      // Button background
      ctx.globalAlpha = isActive ? 0.5 : 0.3;
      ctx.fillStyle = isActive ? "#333" : "#000";
      roundRect(ctx, btn.x, btn.y, btn.w, btn.h, r);
      ctx.fill();
      // Button border
      ctx.globalAlpha = isActive ? 0.7 : 0.4;
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2 * dpr;
      roundRect(ctx, btn.x, btn.y, btn.w, btn.h, r);
      ctx.stroke();
      // Icon
      ctx.globalAlpha = isActive ? 0.9 : 0.65;
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${28 * dpr}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(icon, btn.x + btn.w / 2, btn.y + btn.h / 2);
    }
    
    drawBtn(leftBtn, "\u25C0", input.left);
    drawBtn(rightBtn, "\u25B6", input.right);
    drawBtn(jumpBtn, "\u25B2", input.jump);
    
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ── DRAW TITLE ─────────────────────────────────────────────
  function drawTitle() {
    // Rich gradient background — fill full visible area
    const gradient = ctx.createLinearGradient(0, visibleTop, 0, visibleBottom);
    gradient.addColorStop(0, "#0a0020");
    gradient.addColorStop(0.3, "#1a0533");
    gradient.addColorStop(0.7, "#2d1b4e");
    gradient.addColorStop(1, "#1a0a30");
    ctx.fillStyle = gradient;
    ctx.fillRect(visibleLeft - 10, visibleTop, visibleWidth + 20, visibleBottom - visibleTop);

    // Twinkling stars with size variation
    for (let i = 0; i < 80; i++) {
      const sx = (i * 97 + 13) % GAME_W;
      const sy = (i * 53 + 7) % (GAME_H - 60);
      const brightness = (Math.sin(frameCount * 0.05 + i) + 1) * 0.5;
      const size = (i % 3 === 0) ? 2 : 1;
      ctx.fillStyle = `rgba(255,255,255,${0.2 + brightness * 0.8})`;
      ctx.fillRect(sx, sy, size, size);
      // Cross sparkle on some stars
      if (i % 5 === 0 && brightness > 0.7) {
        ctx.fillStyle = `rgba(255,255,255,${brightness * 0.4})`;
        ctx.fillRect(sx - 1, sy, 3, 1);
        ctx.fillRect(sx, sy - 1, 1, 3);
      }
    }

    // Shooting star
    const shootX = ((frameCount * 2) % (GAME_W + 100)) - 50;
    const shootY = 30 + Math.sin(frameCount * 0.01) * 20;
    if (frameCount % 300 < 60) {
      ctx.fillStyle = `rgba(255,255,255,${1 - (frameCount % 300) / 60})`;
      ctx.fillRect(shootX, shootY, 3, 1);
      ctx.fillRect(shootX - 5, shootY + 1, 3, 1);
      ctx.fillRect(shootX - 10, shootY + 2, 2, 1);
    }

    // Moon glow
    const moonX = GAME_W - 80;
    const moonY = 40;
    const moonGlow = ctx.createRadialGradient(moonX, moonY, 8, moonX, moonY, 50);
    moonGlow.addColorStop(0, "rgba(255,255,200,0.15)");
    moonGlow.addColorStop(1, "rgba(255,255,200,0)");
    ctx.fillStyle = moonGlow;
    ctx.fillRect(moonX - 50, moonY - 50, 100, 100);
    // Moon
    ctx.fillStyle = "#fffde8";
    ctx.beginPath();
    ctx.arc(moonX, moonY, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e8e0c0";
    ctx.beginPath();
    ctx.arc(moonX - 3, moonY - 2, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(moonX + 4, moonY + 3, 2, 0, Math.PI * 2);
    ctx.fill();

    // Title with glow effect
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Glow behind title
    ctx.shadowColor = "#ff69b4";
    ctx.shadowBlur = 20;
    ctx.fillStyle = "#e74c3c";
    ctx.font = "bold 28px monospace";
    ctx.fillText("Rescue My", GAME_W / 2, 65);
    ctx.fillStyle = "#ff6b8a";
    ctx.font = "bold 36px monospace";
    ctx.fillText("Valentine", GAME_W / 2, 105);
    ctx.shadowBlur = 0;

    // Hearts around title (animated)
    const heartFloat = Math.sin(frameCount * 0.04) * 3;
    drawPixelHeart(GAME_W / 2 - 115, 72 + heartFloat, 3, "#e74c3c");
    drawPixelHeart(GAME_W / 2 + 95, 72 - heartFloat, 3, "#e74c3c");
    drawPixelHeart(GAME_W / 2 - 95, 100 - heartFloat, 2, "#ff69b4");
    drawPixelHeart(GAME_W / 2 + 80, 100 + heartFloat, 2, "#ff69b4");

    // Ground with grass
    ctx.fillStyle = "#2a1a40";
    ctx.fillRect(0, GAME_H - 40, GAME_W, 40);
    ctx.fillStyle = "#3a6a3a";
    ctx.fillRect(0, GAME_H - 42, GAME_W, 4);
    ctx.fillStyle = "#4a8a4a";
    for (let x = 0; x < GAME_W; x += 8) {
      ctx.fillRect(x + 2, GAME_H - 44 - (x % 3), 1, 3 + (x % 3));
      ctx.fillRect(x + 5, GAME_H - 43, 1, 2);
    }

    // Character + animals on ground
    drawGirlSprite(GAME_W / 2 - 45, GAME_H - 100, 1, Math.floor(frameCount / 12) % 4, false, 1.5);
    drawAnimalSprite(GAME_W / 2 - 5, GAME_H - 90, 0, 1.3);
    drawAnimalSprite(GAME_W / 2 + 18, GAME_H - 90, 1, 1.3);
    drawAnimalSprite(GAME_W / 2 + 40, GAME_H - 90, 2, 1.3);

    // Small flowers on ground
    for (let x = 20; x < GAME_W - 20; x += 30) {
      const flowerColor = x % 60 === 0 ? "#e74c3c" : "#ff69b4";
      ctx.fillStyle = flowerColor;
      ctx.fillRect(x, GAME_H - 46, 3, 3);
      ctx.fillStyle = "#ff9";
      ctx.fillRect(x + 1, GAME_H - 45, 1, 1);
      ctx.fillStyle = "#3a6";
      ctx.fillRect(x + 1, GAME_H - 43, 1, 3);
    }

    // "Tap to start" with pulsing effect
    if (titleBlink === 0) {
      ctx.shadowColor = "#fff";
      ctx.shadowBlur = 8;
      ctx.fillStyle = "#fff";
      ctx.font = "14px monospace";
      ctx.fillText("Tap to Start", GAME_W / 2, 140);
      ctx.shadowBlur = 0;
    }

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  // ── DRAW GAME ──────────────────────────────────────────────
  function drawGame() {
    // Pink sunset sky — extend to fill the entire visible area (including portrait extensions)
    const timeOfDay = Math.sin(camera.x * 0.0005) * 0.15;
    const skyTop = visibleTop;
    const skyBottom = visibleBottom;
    const gradient = ctx.createLinearGradient(0, skyTop, 0, GAME_H);
    gradient.addColorStop(0, lerpColor("#ff5070", "#ff6b8a", 0.5 + timeOfDay));
    gradient.addColorStop(0.15, lerpColor("#ff6b8a", "#ff8fa3", 0.5 + timeOfDay));
    gradient.addColorStop(0.35, "#ffb0c0");
    gradient.addColorStop(0.55, "#ffd4a8");
    gradient.addColorStop(0.75, "#ffe4b5");
    gradient.addColorStop(1, "#a8d8a8");
    ctx.fillStyle = gradient;
    ctx.fillRect(visibleLeft - 10, skyTop, visibleWidth + 20, skyBottom - skyTop);

    // Sun with glow
    const sunX = GAME_W - 60;
    const sunY = 35;
    const sunGlow = ctx.createRadialGradient(sunX, sunY, 6, sunX, sunY, 50);
    sunGlow.addColorStop(0, "rgba(255,240,150,0.4)");
    sunGlow.addColorStop(0.5, "rgba(255,220,100,0.1)");
    sunGlow.addColorStop(1, "rgba(255,200,50,0)");
    ctx.fillStyle = sunGlow;
    ctx.fillRect(sunX - 50, sunY - 50, 100, 100);
    ctx.fillStyle = "#ffe87c";
    ctx.beginPath();
    ctx.arc(sunX, sunY, 10, 0, Math.PI * 2);
    ctx.fill();
    // Sun rays
    ctx.strokeStyle = "rgba(255,240,150,0.15)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + frameCount * 0.005;
      ctx.beginPath();
      ctx.moveTo(sunX + Math.cos(angle) * 12, sunY + Math.sin(angle) * 12);
      ctx.lineTo(sunX + Math.cos(angle) * 22, sunY + Math.sin(angle) * 22);
      ctx.stroke();
    }

    // Draw clouds (far layer)
    drawBgClouds();

    // Draw mountains
    drawBgMountains();

    // Draw trees
    drawBgTrees();

    // Draw background hills (nearer)
    drawBgHills();

    ctx.save();
    ctx.translate(-camera.x, -camera.y);

    // Draw level tiles
    drawTiles();

    // Draw seamless ground extension below the level (fills portrait bottom area)
    if (isPortrait) {
      const levelBottom = level.height * TILE; // bottom of level in world coords
      const worldVisibleBottom = camera.y + visibleBottom;
      if (worldVisibleBottom > levelBottom) {
        // Tile the underground dirt pattern seamlessly below the level
        const worldVisibleLeft = camera.x + visibleLeft;
        const tileStartX = Math.floor(worldVisibleLeft / TILE) - 1;
        const tileEndX = Math.ceil((worldVisibleLeft + visibleWidth) / TILE) + 1;
        const tileStartY = Math.floor(levelBottom / TILE);
        const tileEndY = Math.ceil(worldVisibleBottom / TILE) + 1;
        for (let ty = tileStartY; ty <= tileEndY; ty++) {
          for (let tx = tileStartX; tx <= tileEndX; tx++) {
            const px = tx * TILE;
            const py = ty * TILE;
            // Underground dirt — same as drawGroundTile underground branch
            ctx.fillStyle = "#4a2a12";
            ctx.fillRect(px, py, TILE, TILE);
            ctx.fillStyle = "#5a3a1a";
            ctx.fillRect(px + 2, py + 2, 5, 4);
            ctx.fillRect(px + 9, py + 8, 4, 3);
            ctx.fillStyle = "#3a1a08";
            ctx.fillRect(px + 4, py + 6, 2, 2);
            ctx.fillRect(px + 11, py + 3, 2, 2);
            ctx.fillStyle = "#6a5a4a";
            ctx.fillRect(px + 7, py + 12, 3, 2);
            ctx.fillRect(px + 1, py + 10, 2, 1);
            ctx.fillStyle = "rgba(0,0,0,0.08)";
            ctx.fillRect(px, py, 1, TILE);
            ctx.fillRect(px, py, TILE, 1);
          }
        }
      }
    }

    // Draw butterflies
    drawButterflies();

    // Draw freed animals
    for (const a of freedAnimals) {
      drawAnimalSprite(a.x, a.y, a.idx, 1);
    }

    // Draw player
    drawGirlSprite(player.x - 2, player.y, player.facing, player.walkFrame, !player.onGround, 1);

    // Draw particles
    drawParticles();

    ctx.restore();

    // Vignette
    drawVignette();

    // HUD
    drawHUD();

    // Touch controls
    drawTouchControls();

    // Rescue message
    if (rescueMessageTimer > 0) {
      const alpha = Math.min(1, rescueMessageTimer / 30);
      const mc = visibleLeft + visibleWidth / 2;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.textAlign = "center";
      // Background pill
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      roundRect(ctx, mc - 85, 46, 170, 24, 6);
      ctx.fill();
      ctx.fillStyle = "#ffe";
      ctx.font = "bold 14px monospace";
      ctx.fillText(rescueMessage, mc, 62);
      ctx.textAlign = "left";
      ctx.restore();
    }

    // Wrong key message
    if (wrongKeyTimer > 0) {
      const alpha = Math.min(1, wrongKeyTimer / 20);
      const mc = visibleLeft + visibleWidth / 2;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      roundRect(ctx, mc - 55, 70, 110, 20, 4);
      ctx.fill();
      ctx.fillStyle = "#ff6666";
      ctx.font = "bold 11px monospace";
      ctx.fillText("Wrong key!", mc, 84);
      ctx.textAlign = "left";
      ctx.restore();
    }
  }

  // ── COLOR UTILITY ──────────────────────────────────────────
  function lerpColor(a, b, t) {
    const ah = parseInt(a.replace("#", ""), 16);
    const bh = parseInt(b.replace("#", ""), 16);
    const ar = (ah >> 16) & 0xff, ag = (ah >> 8) & 0xff, ab = ah & 0xff;
    const br = (bh >> 16) & 0xff, bg = (bh >> 8) & 0xff, bb = bh & 0xff;
    const rr = Math.round(ar + (br - ar) * t);
    const rg = Math.round(ag + (bg - ag) * t);
    const rb = Math.round(ab + (bb - ab) * t);
    return `rgb(${rr},${rg},${rb})`;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // ── VIGNETTE ───────────────────────────────────────────────
  function drawVignette() {
    const grd = ctx.createRadialGradient(GAME_W / 2, GAME_H / 2, GAME_W * 0.35, GAME_W / 2, GAME_H / 2, GAME_W * 0.75);
    grd.addColorStop(0, "rgba(0,0,0,0)");
    grd.addColorStop(1, "rgba(0,0,0,0.25)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, GAME_W, GAME_H);
  }

  // ── BACKGROUND LAYERS ─────────────────────────────────────
  function drawBgClouds() {
    for (const c of bgClouds) {
      const scrollX = camera.x * c.depth + frameCount * c.speed;
      const cx = c.x - scrollX;
      // Wrap
      const wx = ((cx % (GAME_W + c.w * 2)) + GAME_W + c.w) % (GAME_W + c.w * 2) - c.w;
      ctx.fillStyle = `rgba(255,255,255,${c.opacity})`;
      // Draw puffy cloud shape
      ctx.beginPath();
      ctx.ellipse(wx + c.w * 0.3, c.y + c.h * 0.5, c.w * 0.25, c.h * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(wx + c.w * 0.55, c.y + c.h * 0.35, c.w * 0.3, c.h * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(wx + c.w * 0.75, c.y + c.h * 0.5, c.w * 0.22, c.h * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawBgMountains() {
    const scrollX = camera.x * 0.08;
    for (const m of bgMountains) {
      const mx = m.x - scrollX;
      if (mx + m.w < -50 || mx > GAME_W + 50) continue;

      // Mountain body
      ctx.fillStyle = m.color;
      ctx.beginPath();
      ctx.moveTo(mx, GAME_H - 15);
      ctx.lineTo(mx + m.w * 0.5, GAME_H - 15 - m.h);
      ctx.lineTo(mx + m.w, GAME_H - 15);
      ctx.closePath();
      ctx.fill();

      // Snow cap
      if (m.snowCap) {
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.beginPath();
        ctx.moveTo(mx + m.w * 0.4, GAME_H - 15 - m.h * 0.65);
        ctx.lineTo(mx + m.w * 0.5, GAME_H - 15 - m.h);
        ctx.lineTo(mx + m.w * 0.6, GAME_H - 15 - m.h * 0.65);
        ctx.closePath();
        ctx.fill();
      }

      // Mountain shading
      ctx.fillStyle = "rgba(0,0,0,0.08)";
      ctx.beginPath();
      ctx.moveTo(mx + m.w * 0.5, GAME_H - 15 - m.h);
      ctx.lineTo(mx + m.w, GAME_H - 15);
      ctx.lineTo(mx + m.w * 0.5, GAME_H - 15);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawBgTrees() {
    const scrollX = camera.x * 0.15;
    for (const t of bgTrees) {
      const tx = t.x - scrollX;
      const wy = GAME_H - 18;
      if (tx < -30 || tx > GAME_W + 30) continue;

      if (t.type === 0) {
        // Pine tree
        ctx.fillStyle = `rgba(40,80,40,${0.7 - t.shade})`;
        // Trunk
        ctx.fillRect(tx + 3, wy - t.h * 0.3, 3, t.h * 0.3);
        // Layers of foliage
        for (let ly = 0; ly < 3; ly++) {
          const layerY = wy - t.h + ly * (t.h * 0.25);
          const layerW = 6 + ly * 4;
          ctx.beginPath();
          ctx.moveTo(tx + 4.5 - layerW / 2, layerY + t.h * 0.25);
          ctx.lineTo(tx + 4.5, layerY);
          ctx.lineTo(tx + 4.5 + layerW / 2, layerY + t.h * 0.25);
          ctx.closePath();
          ctx.fill();
        }
      } else if (t.type === 1) {
        // Rounded oak tree
        ctx.fillStyle = `rgba(60,50,30,${0.6 - t.shade})`;
        ctx.fillRect(tx + 4, wy - t.h * 0.4, 4, t.h * 0.4);
        ctx.fillStyle = `rgba(50,100,50,${0.7 - t.shade})`;
        ctx.beginPath();
        ctx.arc(tx + 6, wy - t.h * 0.55, t.h * 0.35, 0, Math.PI * 2);
        ctx.fill();
        // Highlight
        ctx.fillStyle = `rgba(80,140,60,${0.3 - t.shade})`;
        ctx.beginPath();
        ctx.arc(tx + 4, wy - t.h * 0.6, t.h * 0.2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Bush
        ctx.fillStyle = `rgba(50,110,50,${0.6 - t.shade})`;
        ctx.beginPath();
        ctx.ellipse(tx + 5, wy - 4, 8, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(70,130,60,${0.3 - t.shade})`;
        ctx.beginPath();
        ctx.ellipse(tx + 3, wy - 5, 5, 4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawBgHills() {
    // Far hills
    const scrollX1 = camera.x * 0.12;
    ctx.fillStyle = "rgba(100,160,100,0.5)";
    for (let i = 0; i < 10; i++) {
      const hx = i * 100 - (scrollX1 % 100) - 50;
      const hw = 120;
      const hh = 30 + (i % 3) * 12;
      ctx.beginPath();
      ctx.ellipse(hx + hw / 2, GAME_H - 12, hw / 2, hh, 0, Math.PI, 0);
      ctx.fill();
    }

    // Near hills
    const scrollX2 = camera.x * 0.2;
    ctx.fillStyle = "rgba(80,140,80,0.6)";
    for (let i = 0; i < 8; i++) {
      const hx = i * 130 - (scrollX2 % 130) - 65;
      const hw = 150;
      const hh = 35 + (i % 3) * 15;
      ctx.beginPath();
      ctx.ellipse(hx + hw / 2, GAME_H - 8, hw / 2, hh, 0, Math.PI, 0);
      ctx.fill();
    }

    // Nearest bushes
    const scrollX3 = camera.x * 0.25;
    ctx.fillStyle = "rgba(60,120,60,0.4)";
    for (let i = 0; i < 6; i++) {
      const hx = i * 160 + 40 - (scrollX3 % 160) - 80;
      ctx.beginPath();
      ctx.ellipse(hx, GAME_H - 5, 30, 18, 0, Math.PI, 0);
      ctx.fill();
    }
  }

  function drawButterflies() {
    for (const b of bgButterflies) {
      const bx = b.x;
      const by = b.y + Math.sin(frameCount * 0.05 + b.phase) * 10;
      if (bx < camera.x - 10 || bx > camera.x + GAME_W + 10) continue;

      const wingAngle = Math.sin(frameCount * 0.15 + b.phase) * 0.5;
      ctx.fillStyle = b.color;
      // Left wing
      ctx.fillRect(bx - 2 - wingAngle, by - 1, 2, 2);
      ctx.fillRect(bx - 3 - wingAngle, by, 2, 1);
      // Right wing
      ctx.fillRect(bx + 1 + wingAngle, by - 1, 2, 2);
      ctx.fillRect(bx + 2 + wingAngle, by, 2, 1);
      // Body
      ctx.fillStyle = "#333";
      ctx.fillRect(bx, by - 1, 1, 3);
    }
  }

  function drawTiles() {
    const startX = Math.max(0, Math.floor(camera.x / TILE) - 1);
    const endX = Math.min(level.width, Math.ceil((camera.x + GAME_W) / TILE) + 1);
    const startY = Math.max(0, Math.floor(camera.y / TILE) - 1);
    const endY = Math.min(level.height, Math.ceil((camera.y + GAME_H) / TILE) + 1);

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const tile = level.map[y][x];
        const px = x * TILE;
        const py = y * TILE;

        if (tile === T.GROUND) {
          drawGroundTile(px, py, x, y);
        } else if (tile === T.PLATFORM) {
          drawPlatformTile(px, py, x, y);
        } else if (tile === T.SPIKE) {
          drawSpikeTile(px, py);
        } else if (tile === T.LAVA || tile === T.LAVA_TOP) {
          drawLavaTile(px, py, tile === T.LAVA_TOP);
        } else if (tile >= T.CAGE_0 && tile < T.CAGE_0 + 6) {
          drawCage(px, py, tile - T.CAGE_0);
        } else if (tile >= T.KEY_0 && tile < T.KEY_0 + 6) {
          drawKey(px, py, tile - T.KEY_0);
        } else if (tile === T.DOOR_FINAL) {
          drawFinalDoor(px, py);
        } else if (tile === T.CHECKPOINT) {
          drawCheckpointFlag(px, py);
        } else if (tile === T.DECO_FLOWER) {
          drawFlower(px, py);
        } else if (tile === T.DECO_GRASS) {
          drawGrass(px, py);
        }
      }
    }
  }

  // ── TILE DRAWING ───────────────────────────────────────────
  function drawGroundTile(px, py, tx, ty) {
    const above = ty > 0 ? level.map[ty - 1][tx] : T.EMPTY;
    const isSurface = above !== T.GROUND && above !== T.BRICK;

    if (isSurface) {
      // Rich grass surface with multiple shades
      // Dark soil base
      ctx.fillStyle = "#5a3820";
      ctx.fillRect(px, py + 5, TILE, TILE - 5);

      // Grass top layers
      ctx.fillStyle = "#3d8a30";
      ctx.fillRect(px, py, TILE, 6);
      ctx.fillStyle = "#4a9a3f";
      ctx.fillRect(px, py, TILE, 3);
      // Light grass highlight
      ctx.fillStyle = "#5aaa4f";
      ctx.fillRect(px + 1, py, 3, 2);
      ctx.fillRect(px + 8, py, 4, 1);

      // Grass blades on top
      ctx.fillStyle = "#5cb850";
      ctx.fillRect(px + 1, py - 2, 1, 3);
      ctx.fillRect(px + 4, py - 1, 1, 2);
      ctx.fillRect(px + 7, py - 2, 1, 3);
      ctx.fillRect(px + 10, py - 1, 1, 2);
      ctx.fillRect(px + 13, py - 2, 1, 3);

      // Darker grass blades
      ctx.fillStyle = "#3a7a2a";
      ctx.fillRect(px + 3, py - 1, 1, 2);
      ctx.fillRect(px + 9, py - 2, 1, 2);
      ctx.fillRect(px + 14, py - 1, 1, 2);

      // Soil texture dots
      ctx.fillStyle = "#4a2815";
      ctx.fillRect(px + 3, py + 7, 2, 2);
      ctx.fillRect(px + 10, py + 9, 2, 1);
      // Pebbles
      ctx.fillStyle = "#7a6a5a";
      ctx.fillRect(px + 6, py + 10, 2, 1);
      ctx.fillRect(px + 12, py + 7, 1, 1);
    } else {
      // Underground dirt with richer texture
      ctx.fillStyle = "#4a2a12";
      ctx.fillRect(px, py, TILE, TILE);
      // Lighter dirt patches
      ctx.fillStyle = "#5a3a1a";
      ctx.fillRect(px + 2, py + 2, 5, 4);
      ctx.fillRect(px + 9, py + 8, 4, 3);
      // Dark spots
      ctx.fillStyle = "#3a1a08";
      ctx.fillRect(px + 4, py + 6, 2, 2);
      ctx.fillRect(px + 11, py + 3, 2, 2);
      // Stones
      ctx.fillStyle = "#6a5a4a";
      ctx.fillRect(px + 7, py + 12, 3, 2);
      ctx.fillRect(px + 1, py + 10, 2, 1);
      // Grid lines for tile borders
      ctx.fillStyle = "rgba(0,0,0,0.08)";
      ctx.fillRect(px, py, 1, TILE);
      ctx.fillRect(px, py, TILE, 1);
    }
  }

  function drawPlatformTile(px, py, tx, ty) {
    // Check neighbors for connected drawing
    const hasLeft = tx > 0 && level.map[ty][tx - 1] === T.PLATFORM;
    const hasRight = tx < level.width - 1 && level.map[ty][tx + 1] === T.PLATFORM;

    // Main platform body - thinner wood plank look
    ctx.fillStyle = "#9a7a55";
    ctx.fillRect(px, py, TILE, 5);

    // Top highlight
    ctx.fillStyle = "#b8976a";
    ctx.fillRect(px, py, TILE, 1);

    // Wood grain detail
    ctx.fillStyle = "#8a6a45";
    ctx.fillRect(px + 2, py + 2, 4, 1);
    ctx.fillRect(px + 9, py + 3, 5, 1);

    // Bottom edge shadow
    ctx.fillStyle = "#6a5235";
    ctx.fillRect(px, py + 4, TILE, 1);

    // Nail/bolt details
    ctx.fillStyle = "#c0b0a0";
    ctx.fillRect(px + 2, py + 1, 1, 1);
    ctx.fillRect(px + 13, py + 1, 1, 1);

    // End caps if at edge
    if (!hasLeft) {
      ctx.fillStyle = "#7a5a3a";
      ctx.fillRect(px, py, 1, 5);
    }
    if (!hasRight) {
      ctx.fillStyle = "#7a5a3a";
      ctx.fillRect(px + 15, py, 1, 5);
    }

    // One-way indicator (small arrows/dots to show you can pass through from below)
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(px + 7, py + 1, 2, 1);
  }

  function drawSpikeTile(px, py) {
    // Grass/ground base to blend with terrain
    ctx.fillStyle = "#5a9a4a";
    ctx.fillRect(px, py + TILE - 4, TILE, 4);
    ctx.fillStyle = "#4a8a3a";
    ctx.fillRect(px, py + TILE - 2, TILE, 2);
    
    // Metallic spikes with better shading
    for (let i = 0; i < 3; i++) {
      const sx = px + 1 + i * 5;
      // Shadow
      ctx.fillStyle = "#555";
      ctx.beginPath();
      ctx.moveTo(sx + 1, py + TILE - 3);
      ctx.lineTo(sx + 3, py + 3);
      ctx.lineTo(sx + 5, py + TILE - 3);
      ctx.fill();
      // Main spike
      ctx.fillStyle = "#999";
      ctx.beginPath();
      ctx.moveTo(sx, py + TILE - 3);
      ctx.lineTo(sx + 2.5, py + 3);
      ctx.lineTo(sx + 5, py + TILE - 3);
      ctx.fill();
      // Highlight edge
      ctx.fillStyle = "#ccc";
      ctx.beginPath();
      ctx.moveTo(sx, py + TILE - 3);
      ctx.lineTo(sx + 2.5, py + 3);
      ctx.lineTo(sx + 1.5, py + TILE - 3);
      ctx.fill();
      // Tip glint
      ctx.fillStyle = "#fff";
      ctx.fillRect(sx + 2, py + 4, 1, 1);
    }
  }

  function drawLavaTile(px, py, isTop) {
    if (isTop) {
      // Animated lava surface with rich color
      ctx.fillStyle = "#ff3800";
      ctx.fillRect(px, py, TILE, TILE);

      // Molten core glow
      ctx.fillStyle = "#ff6633";
      ctx.fillRect(px + 2, py + 4, TILE - 4, TILE - 6);

      // Surface bubbles
      const bubbleOffset = (lavaFrame * 5 + px) % TILE;
      ctx.fillStyle = "#ff8844";
      ctx.beginPath();
      ctx.arc(px + bubbleOffset + 4, py + 5, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffaa33";
      ctx.beginPath();
      ctx.arc(px + (bubbleOffset + 10) % TILE, py + 8, 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Surface glow wave
      ctx.fillStyle = "#ffcc00";
      const waveX = Math.sin((frameCount * 0.1 + px * 0.3)) * 3;
      ctx.fillRect(px + 3 + waveX, py, 8, 2);
      ctx.fillStyle = "#ffee66";
      ctx.fillRect(px + 5 + waveX, py, 4, 1);

      // Glow above lava
      ctx.fillStyle = `rgba(255,100,0,${0.1 + Math.sin(frameCount * 0.08 + px) * 0.05})`;
      ctx.fillRect(px, py - 8, TILE, 8);
    } else {
      ctx.fillStyle = "#cc2200";
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = "#ee3300";
      ctx.fillRect(px + 3, py + 3, 5, 5);
      ctx.fillRect(px + 10, py + 7, 4, 4);
      ctx.fillStyle = "#ff5500";
      ctx.fillRect(px + 5, py + 10, 3, 3);
    }
  }

  function drawCage(px, py, idx) {
    const col = KEY_COLORS[idx];

    // Cage background with depth
    ctx.fillStyle = "#2a2a2a";
    ctx.fillRect(px - 5, py - 5, 26, 26);
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(px - 3, py - 3, 22, 22);

    // Animal inside (small)
    drawAnimalSprite(px, py, idx, 0.8);

    // Cage bars (foreground) - spacing adjusted so bars fit within cage bounds
    ctx.fillStyle = col.dark;
    ctx.fillRect(px - 5, py - 5, 26, 3);
    ctx.fillRect(px - 5, py + 18, 26, 3);
    for (let i = 0; i < 7; i++) {
      ctx.fillRect(px - 5 + i * 4, py - 5, 2, 26);
    }
    // Bar highlights
    ctx.fillStyle = col.fill;
    ctx.fillRect(px - 5, py - 5, 26, 1);
    for (let i = 0; i < 7; i++) {
      ctx.fillRect(px - 5 + i * 4, py - 5, 1, 26);
    }

    // Lock icon
    ctx.fillStyle = "#ffd700";
    ctx.fillRect(px + 5, py + 18, 6, 4);
    ctx.fillStyle = "#daa520";
    ctx.beginPath();
    ctx.arc(px + 8, py + 18, 3, Math.PI, 0);
    ctx.stroke();

    // Label with background
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(px - 4, py + 24, 24, 10);
    ctx.fillStyle = col.fill;
    ctx.font = "bold 7px monospace";
    ctx.textAlign = "center";
    ctx.fillText(ANIMALS[idx].name, px + 8, py + 32);
    ctx.textAlign = "left";
  }

  function drawKey(px, py, idx) {
    const col = KEY_COLORS[idx];
    const bob = Math.sin(frameCount * 0.08 + idx * 2) * 3;
    const ky = py + bob;

    // Glow effect
    ctx.fillStyle = `rgba(${parseInt(col.fill.slice(1, 3), 16)},${parseInt(col.fill.slice(3, 5), 16)},${parseInt(col.fill.slice(5, 7), 16)},${0.15 + Math.sin(frameCount * 0.06 + idx) * 0.1})`;
    ctx.beginPath();
    ctx.arc(px + 8, ky + 8, 10, 0, Math.PI * 2);
    ctx.fill();

    // Key shadow
    ctx.fillStyle = col.dark;
    ctx.beginPath();
    ctx.arc(px + 9, ky + 5, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(px + 7, ky + 8, 4, 8);

    // Key shape
    ctx.fillStyle = col.fill;
    ctx.beginPath();
    ctx.arc(px + 8, ky + 4, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(px + 6, ky + 7, 4, 8);
    ctx.fillRect(px + 4, ky + 12, 3, 2);
    ctx.fillRect(px + 4, ky + 9, 3, 2);

    // Inner circle
    ctx.fillStyle = col.dark;
    ctx.beginPath();
    ctx.arc(px + 8, ky + 4, 2, 0, Math.PI * 2);
    ctx.fill();

    // Sparkle animation
    const sparklePhase = (frameCount + idx * 15) % 40;
    if (sparklePhase < 10) {
      ctx.fillStyle = "#fff";
      const sp = sparklePhase / 10;
      ctx.globalAlpha = 1 - sp;
      ctx.fillRect(px + 2 - sp * 2, ky + 1, 2, 2);
      ctx.fillRect(px + 12 + sp * 2, ky + 3, 1, 1);
      ctx.globalAlpha = 1;
    }
  }

  function drawFinalDoor(px, py) {
    if (doorOpen) {
      // Open door - magical glow
      const pulse = Math.sin(frameCount * 0.08) * 0.15;

      // Outer glow
      ctx.fillStyle = `rgba(255,220,0,${0.2 + pulse})`;
      ctx.fillRect(px - 6, py - 6, TILE + 12, TILE + 12);

      // Door frame
      ctx.fillStyle = "#daa520";
      ctx.fillRect(px - 1, py - 1, TILE + 2, TILE + 2);

      // Inner light
      ctx.fillStyle = "#fff8dc";
      ctx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);

      // Sparkle rays
      ctx.fillStyle = `rgba(255,255,200,${0.4 + pulse})`;
      ctx.fillRect(px + 4, py - 3, 2, 3);
      ctx.fillRect(px + 10, py - 3, 2, 3);
      ctx.fillRect(px - 3, py + 6, 3, 2);
      ctx.fillRect(px + TILE, py + 6, 3, 2);
    } else {
      // Closed door with more detail
      ctx.fillStyle = "#543210";
      ctx.fillRect(px - 1, py - 1, TILE + 2, TILE + 2);
      ctx.fillStyle = "#654321";
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = "#7a5a30";
      ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
      // Wood grain
      ctx.fillStyle = "#6a4a20";
      ctx.fillRect(px + 3, py + 4, TILE - 6, 1);
      ctx.fillRect(px + 3, py + 8, TILE - 6, 1);
      ctx.fillRect(px + 3, py + 12, TILE - 6, 1);
      // Lock
      ctx.fillStyle = "#c0c0c0";
      ctx.fillRect(px + 6, py + 8, 4, 4);
      ctx.fillStyle = "#a0a0a0";
      ctx.beginPath();
      ctx.arc(px + 8, py + 7, 3, Math.PI, 0);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Keyhole
      ctx.fillStyle = "#222";
      ctx.fillRect(px + 7, py + 9, 2, 2);
    }
  }

  function drawCheckpointFlag(px, py) {
    // Pole with gradient
    ctx.fillStyle = "#bbb";
    ctx.fillRect(px + 7, py - 10, 2, TILE + 10);
    ctx.fillStyle = "#ddd";
    ctx.fillRect(px + 7, py - 10, 1, TILE + 10);

    // Flag with wave animation
    const wave = Math.sin(frameCount * 0.1) * 1.5;
    ctx.fillStyle = "#e74c3c";
    ctx.beginPath();
    ctx.moveTo(px + 9, py - 10);
    ctx.lineTo(px + 18 + wave, py - 7);
    ctx.lineTo(px + 9, py - 3);
    ctx.closePath();
    ctx.fill();

    // Pole ball top
    ctx.fillStyle = "#ffd700";
    ctx.fillRect(px + 6, py - 12, 4, 3);
  }

  function drawFlower(px, py) {
    // Stem
    ctx.fillStyle = "#2a8a2a";
    ctx.fillRect(px + 7, py + 7, 2, 7);
    // Leaf
    ctx.fillStyle = "#3aa63a";
    ctx.fillRect(px + 5, py + 9, 3, 2);
    // Petals
    const flowerColors = ["#e74c3c", "#ff69b4", "#f1c40f", "#e67e22"];
    const fc = flowerColors[(px / TILE | 0) % flowerColors.length];
    ctx.fillStyle = fc;
    ctx.fillRect(px + 5, py + 3, 3, 3);
    ctx.fillRect(px + 9, py + 3, 3, 3);
    ctx.fillRect(px + 5, py + 6, 3, 2);
    ctx.fillRect(px + 9, py + 6, 3, 2);
    ctx.fillRect(px + 6, py + 2, 5, 2);
    // Center
    ctx.fillStyle = "#ff9";
    ctx.fillRect(px + 7, py + 4, 3, 3);
    // Bobbing animation
    if (animFrame === 0) {
      ctx.fillStyle = "#fff";
      ctx.fillRect(px + 7, py + 4, 1, 1);
    }
  }

  function drawGrass(px, py) {
    ctx.fillStyle = "#4a9a40";
    ctx.fillRect(px + 1, py + 7, 1, 7);
    ctx.fillRect(px + 3, py + 5, 1, 9);
    ctx.fillRect(px + 5, py + 4, 1, 10);
    ctx.fillRect(px + 7, py + 6, 1, 8);
    ctx.fillRect(px + 9, py + 5, 1, 9);
    ctx.fillRect(px + 11, py + 7, 1, 7);
    ctx.fillRect(px + 13, py + 6, 1, 8);
    // Lighter blades
    ctx.fillStyle = "#5cb850";
    ctx.fillRect(px + 2, py + 6, 1, 5);
    ctx.fillRect(px + 6, py + 5, 1, 4);
    ctx.fillRect(px + 10, py + 4, 1, 5);
    ctx.fillRect(px + 14, py + 6, 1, 4);
    // Wind sway
    const sway = Math.sin(frameCount * 0.04 + px * 0.2) > 0 ? 1 : 0;
    ctx.fillStyle = "#5cb850";
    ctx.fillRect(px + 5 + sway, py + 3, 1, 2);
  }

  // ── SPRITE DRAWING ─────────────────────────────────────────
  function drawGirlSprite(x, y, facing, walkFrame, jumping, drawScale) {
    ctx.save();
    const s = drawScale || 1;
    const cx = x + 8;
    ctx.translate(cx, y);
    ctx.scale(facing * s, s);
    ctx.translate(-8, 0);

    // Hair (darker brown) with cute wavy style
    ctx.fillStyle = "#8B4513";
    ctx.fillRect(1, 0, 14, 6);
    ctx.fillStyle = "#654321";
    ctx.fillRect(0, 2, 2, 13);
    ctx.fillRect(14, 2, 2, 13);
    // Wavy hair ends
    ctx.fillStyle = "#8B4513";
    ctx.fillRect(-1, 12, 2, 3);
    ctx.fillRect(15, 11, 2, 4);
    // Hair highlight (shiny)
    ctx.fillStyle = "#A0522D";
    ctx.fillRect(3, 0, 3, 1);
    ctx.fillRect(10, 1, 2, 1);
    ctx.fillStyle = "#8B6914";
    ctx.fillRect(4, 1, 4, 2);

    // Cute hair bow (pink)
    ctx.fillStyle = "#ff69b4";
    ctx.fillRect(10, -1, 5, 3);
    ctx.fillRect(9, 0, 1, 2);
    ctx.fillRect(15, 0, 1, 2);
    // Bow center
    ctx.fillStyle = "#ff1493";
    ctx.fillRect(12, 0, 2, 2);
    // Bow shine
    ctx.fillStyle = "#ffb6d9";
    ctx.fillRect(10, -1, 1, 1);

    // Head (skin) - rounder face
    ctx.fillStyle = "#fdbcb4";
    ctx.fillRect(3, 2, 10, 8);
    ctx.fillRect(2, 4, 1, 4);
    ctx.fillRect(13, 4, 1, 4);
    
    // Big cheek blush (cuter)
    ctx.fillStyle = "rgba(255,120,150,0.5)";
    ctx.fillRect(2, 6, 3, 2);
    ctx.fillRect(11, 6, 3, 2);
    ctx.fillStyle = "rgba(255,100,130,0.3)";
    ctx.fillRect(3, 5, 2, 1);
    ctx.fillRect(11, 5, 2, 1);

    // Smaller eyes
    ctx.fillStyle = "#89CFF0"; // light blue
    ctx.fillRect(5, 4, 2, 3);
    ctx.fillRect(10, 4, 2, 3);
    // Eye outline
    ctx.fillStyle = "#1a5276";
    ctx.fillRect(5, 4, 2, 1);
    ctx.fillRect(10, 4, 2, 1);
    ctx.fillRect(5, 6, 2, 1);
    ctx.fillRect(10, 6, 2, 1);
    // Pupils
    ctx.fillStyle = "#154360";
    ctx.fillRect(5, 5, 2, 1);
    ctx.fillRect(10, 5, 2, 1);
    // Eye sparkles
    ctx.fillStyle = "#fff";
    ctx.fillRect(5, 4, 1, 1);
    ctx.fillRect(10, 4, 1, 1);
    // Cute eyelashes
    ctx.fillStyle = "#333";
    ctx.fillRect(5, 3, 1, 1);
    ctx.fillRect(10, 3, 1, 1);

    // Cute small mouth (cat smile)
    ctx.fillStyle = "#e74c3c";
    ctx.fillRect(7, 8, 2, 1);
    // Mouth highlight
    ctx.fillStyle = "#ff9999";
    ctx.fillRect(7, 8, 1, 1);

    // Body (thinner frilly pink dress)
    ctx.fillStyle = "#ff69b4";
    ctx.fillRect(4, 10, 8, 7);
    // Dress gradient/shading
    ctx.fillStyle = "#ff85c1";
    ctx.fillRect(5, 10, 6, 2);
    ctx.fillStyle = "#ff5aa5";
    ctx.fillRect(4, 10, 2, 7);
    ctx.fillRect(10, 10, 2, 7);
    // Cute heart on dress
    ctx.fillStyle = "#ff1493";
    ctx.fillRect(7, 11, 2, 1);
    ctx.fillRect(6, 12, 4, 1);
    ctx.fillRect(7, 13, 2, 1);
    // Dress ruffle (lacy bottom)
    ctx.fillStyle = "#ffb6d9";
    ctx.fillRect(3, 16, 10, 1);
    ctx.fillStyle = "#fff";
    ctx.fillRect(4, 16, 1, 1);
    ctx.fillRect(6, 16, 1, 1);
    ctx.fillRect(8, 16, 1, 1);
    ctx.fillRect(10, 16, 1, 1);

    // Arms - only move when walking (walkFrame increments only when moving)
    ctx.fillStyle = "#fdbcb4";
    if (jumping) {
      ctx.fillRect(2, 8, 2, 2);
      ctx.fillRect(12, 8, 2, 2);
      // Hands
      ctx.fillStyle = "#fac8c0";
      ctx.fillRect(1, 7, 2, 2);
      ctx.fillRect(13, 7, 2, 2);
    } else if (walkFrame > 0) {
      // Only animate arms when actively walking (walkFrame cycles when moving)
      const armBob = (walkFrame % 2 === 0) ? 0 : 1;
      ctx.fillRect(2, 10 + armBob, 2, 4);
      ctx.fillRect(12, 10 + (1 - armBob), 2, 4);
    } else {
      // Standing still - arms at rest (walkFrame === 0)
      ctx.fillRect(2, 10, 2, 4);
      ctx.fillRect(12, 10, 2, 4);
    }

    // Legs
    ctx.fillStyle = "#fdbcb4";
    if (jumping) {
      ctx.fillRect(4, 17, 3, 3);
      ctx.fillRect(9, 17, 3, 3);
    } else {
      const legOff = [0, 1, 0, -1][walkFrame];
      ctx.fillRect(4, 17 + legOff, 3, 3);
      ctx.fillRect(9, 17 - legOff, 3, 3);
    }

    // Cute Mary Jane shoes with bows
    ctx.fillStyle = "#ff69b4";
    if (jumping) {
      ctx.fillRect(4, 19, 3, 1);
      ctx.fillRect(9, 19, 3, 1);
      ctx.fillStyle = "#ff1493";
      ctx.fillRect(5, 19, 1, 1);
      ctx.fillRect(10, 19, 1, 1);
    } else {
      const legOff = [0, 1, 0, -1][walkFrame];
      ctx.fillRect(4, 19 + legOff, 3, 1);
      ctx.fillRect(9, 19 - legOff, 3, 1);
      ctx.fillStyle = "#ff1493";
      ctx.fillRect(5, 19 + legOff, 1, 1);
      ctx.fillRect(10, 19 - legOff, 1, 1);
    }

    ctx.restore();
  }

  function drawAnimalSprite(x, y, idx, animalScale) {
    ctx.save();
    const s = animalScale || 1;
    ctx.translate(x, y);
    ctx.scale(s, s);
    const a = ANIMALS[idx];

    switch (idx) {
      case 0: drawDogKingCharles(a.colors); break;
      case 1: drawCatTuxedo(a.colors); break;
      case 2: drawDogGermanShepherd(a.colors); break;
      case 3: drawDogAustralianShepherd(a.colors); break;
      case 4: drawFrenchBulldog(a.colors); break;
      case 5: drawCatTortoiseshell(a.colors); break;
    }

    ctx.restore();
  }

  // ── ANIMAL SPRITES ─────────────────────────────────────────
  function drawDogKingCharles(c) {
    ctx.fillStyle = c.body;
    ctx.fillRect(2, 6, 12, 8);
    ctx.fillStyle = c.patches;
    ctx.fillRect(3, 7, 4, 4);
    ctx.fillRect(10, 8, 3, 3);
    ctx.fillStyle = c.body;
    ctx.fillRect(4, 1, 8, 6);
    ctx.fillStyle = c.ear;
    ctx.fillRect(2, 2, 3, 6);
    ctx.fillRect(11, 2, 3, 6);
    ctx.fillStyle = "#222";
    ctx.fillRect(6, 3, 2, 2);
    ctx.fillRect(9, 3, 2, 2);
    // Eye shine
    ctx.fillStyle = "#fff";
    ctx.fillRect(6, 3, 1, 1);
    ctx.fillRect(9, 3, 1, 1);
    ctx.fillStyle = c.nose;
    ctx.fillRect(7, 5, 2, 1);
    // Tongue
    ctx.fillStyle = "#ff8888";
    ctx.fillRect(8, 6, 1, 1);
    ctx.fillStyle = c.body;
    ctx.fillRect(3, 13, 2, 3);
    ctx.fillRect(7, 13, 2, 3);
    ctx.fillRect(11, 13, 2, 3);
    ctx.fillStyle = c.patches;
    ctx.fillRect(13, 6, 2, 2);
    // Tail wag
    const tailWag = Math.sin(frameCount * 0.15) > 0 ? 1 : 0;
    ctx.fillRect(14, 5 + tailWag, 1, 2);
  }

  function drawCatTuxedo(c) {
    ctx.fillStyle = c.body;
    ctx.fillRect(3, 5, 10, 8);
    ctx.fillStyle = c.chest;
    ctx.fillRect(5, 6, 6, 6);
    ctx.fillStyle = c.body;
    ctx.fillRect(4, 0, 8, 6);
    ctx.fillRect(4, -2, 2, 3);
    ctx.fillRect(10, -2, 2, 3);
    ctx.fillStyle = "#ff9999";
    ctx.fillRect(5, -1, 1, 2);
    ctx.fillRect(11, -1, 1, 2);
    // Yellow eyes for Ella
    ctx.fillStyle = "#ffd700";
    ctx.fillRect(5, 2, 2, 2);
    ctx.fillRect(9, 2, 2, 2);
    ctx.fillStyle = "#222";
    ctx.fillRect(6, 3, 1, 1);
    ctx.fillRect(10, 3, 1, 1);
    // Eye shine
    ctx.fillStyle = "#fff";
    ctx.fillRect(5, 2, 1, 1);
    ctx.fillRect(9, 2, 1, 1);
    ctx.fillStyle = c.nose;
    ctx.fillRect(7, 4, 2, 1);
    // Whiskers
    ctx.fillStyle = "#888";
    ctx.fillRect(3, 4, 2, 1);
    ctx.fillRect(11, 4, 2, 1);
    ctx.fillStyle = c.body;
    ctx.fillRect(4, 12, 2, 3);
    ctx.fillRect(10, 12, 2, 3);
    ctx.fillStyle = c.chest;
    ctx.fillRect(4, 14, 2, 1);
    ctx.fillRect(10, 14, 2, 1);
    ctx.fillStyle = c.body;
    ctx.fillRect(13, 7, 2, 1);
    ctx.fillRect(14, 5, 1, 3);
    // Tail animation
    const tailSwish = Math.sin(frameCount * 0.1) > 0 ? 0 : 1;
    ctx.fillRect(14 + tailSwish, 4, 1, 2);
  }

  function drawDogGermanShepherd(c) {
    ctx.fillStyle = c.body;
    ctx.fillRect(2, 6, 12, 8);
    ctx.fillStyle = c.patches;
    ctx.fillRect(4, 6, 8, 4);
    ctx.fillStyle = c.body;
    ctx.fillRect(3, 0, 10, 7);
    ctx.fillStyle = "#d4a76a";
    ctx.fillRect(5, 4, 6, 3);
    ctx.fillStyle = c.ear;
    ctx.fillRect(3, -2, 3, 4);
    ctx.fillRect(10, -2, 3, 4);
    ctx.fillStyle = "#5a3a1a";
    ctx.fillRect(5, 2, 2, 2);
    ctx.fillRect(9, 2, 2, 2);
    ctx.fillStyle = "#fff";
    ctx.fillRect(5, 2, 1, 1);
    ctx.fillRect(9, 2, 1, 1);
    ctx.fillStyle = c.nose;
    ctx.fillRect(7, 5, 2, 1);
    ctx.fillStyle = c.body;
    ctx.fillRect(3, 13, 2, 3);
    ctx.fillRect(7, 13, 2, 3);
    ctx.fillRect(11, 13, 2, 3);
    ctx.fillStyle = c.patches;
    ctx.fillRect(13, 5, 1, 3);
    ctx.fillRect(14, 4, 1, 2);
    const tailWag = Math.sin(frameCount * 0.12) > 0 ? 1 : 0;
    ctx.fillRect(14, 3 + tailWag, 1, 2);
  }

  function drawDogAustralianShepherd(c) {
    ctx.fillStyle = c.body;
    ctx.fillRect(2, 6, 12, 8);
    ctx.fillStyle = c.patches;
    ctx.fillRect(5, 7, 4, 4);
    ctx.fillRect(10, 9, 3, 2);
    ctx.fillStyle = c.body;
    ctx.fillRect(3, 0, 10, 7);
    ctx.fillStyle = c.patches;
    ctx.fillRect(6, 1, 4, 5);
    ctx.fillStyle = c.ear;
    ctx.fillRect(2, 1, 3, 5);
    ctx.fillRect(11, 1, 3, 5);
    // Brown eyes for Carma
    ctx.fillStyle = "#8B4513";
    ctx.fillRect(5, 3, 2, 2);
    ctx.fillRect(9, 3, 2, 2);
    ctx.fillStyle = "#222";
    ctx.fillRect(6, 3, 1, 1);
    ctx.fillRect(10, 3, 1, 1);
    ctx.fillStyle = "#fff";
    ctx.fillRect(5, 3, 1, 1);
    ctx.fillRect(9, 3, 1, 1);
    ctx.fillStyle = c.nose;
    ctx.fillRect(7, 5, 2, 1);
    ctx.fillStyle = c.body;
    ctx.fillRect(3, 13, 2, 3);
    ctx.fillRect(7, 13, 2, 3);
    ctx.fillRect(11, 13, 2, 3);
    ctx.fillStyle = c.patches;
    ctx.fillRect(3, 15, 2, 1);
    ctx.fillRect(11, 15, 2, 1);
    ctx.fillStyle = c.body;
    ctx.fillRect(13, 4, 3, 4);
    const tailWag = Math.sin(frameCount * 0.13) > 0 ? 1 : -1;
    ctx.fillRect(14, 3 + tailWag, 2, 2);
  }

  function drawFrenchBulldog(c) {
    ctx.fillStyle = c.body;
    ctx.fillRect(2, 6, 12, 8);
    ctx.fillStyle = c.body;
    ctx.fillRect(2, 0, 12, 7);
    ctx.fillRect(1, -3, 3, 5);
    ctx.fillRect(12, -3, 3, 5);
    ctx.fillStyle = "#ffaa88";
    ctx.fillRect(2, -2, 1, 3);
    ctx.fillRect(13, -2, 1, 3);
    ctx.fillStyle = c.patches;
    ctx.fillRect(4, 3, 8, 4);
    ctx.fillStyle = "#333";
    ctx.fillRect(4, 2, 3, 2);
    ctx.fillRect(9, 2, 3, 2);
    ctx.fillStyle = "#fff";
    ctx.fillRect(5, 2, 1, 1);
    ctx.fillRect(10, 2, 1, 1);
    ctx.fillStyle = c.nose;
    ctx.fillRect(6, 4, 4, 2);
    // Nostrils
    ctx.fillStyle = "#111";
    ctx.fillRect(7, 5, 1, 1);
    ctx.fillRect(9, 5, 1, 1);
    ctx.fillStyle = c.body;
    ctx.fillRect(3, 13, 3, 3);
    ctx.fillRect(10, 13, 3, 3);
    ctx.fillRect(13, 8, 2, 2);
    // Tiny tail wag
    const tailWag = Math.sin(frameCount * 0.2) > 0 ? 1 : 0;
    ctx.fillRect(14, 7 + tailWag, 1, 2);
  }

  function drawCatTortoiseshell(c) {
    ctx.fillStyle = c.body;
    ctx.fillRect(3, 5, 10, 8);
    ctx.fillStyle = c.patches;
    ctx.fillRect(4, 6, 3, 4);
    ctx.fillRect(9, 8, 3, 3);
    ctx.fillStyle = "#222";
    ctx.fillRect(7, 7, 2, 3);
    ctx.fillStyle = c.body;
    ctx.fillRect(4, 0, 8, 6);
    ctx.fillStyle = c.patches;
    ctx.fillRect(4, 0, 4, 3);
    ctx.fillStyle = "#222";
    ctx.fillRect(9, 1, 3, 2);
    ctx.fillStyle = c.ear;
    ctx.fillRect(4, -2, 2, 3);
    ctx.fillRect(10, -2, 2, 3);
    ctx.fillStyle = "#ff9999";
    ctx.fillRect(5, -1, 1, 2);
    ctx.fillRect(11, -1, 1, 2);
    ctx.fillStyle = "#f0c040";
    ctx.fillRect(5, 2, 2, 2);
    ctx.fillRect(9, 2, 2, 2);
    ctx.fillStyle = "#222";
    ctx.fillRect(6, 3, 1, 1);
    ctx.fillRect(10, 3, 1, 1);
    ctx.fillStyle = "#fff";
    ctx.fillRect(5, 2, 1, 1);
    ctx.fillRect(9, 2, 1, 1);
    ctx.fillStyle = c.nose;
    ctx.fillRect(7, 4, 2, 1);
    // Whiskers
    ctx.fillStyle = "#888";
    ctx.fillRect(3, 4, 2, 1);
    ctx.fillRect(11, 4, 2, 1);
    ctx.fillStyle = c.body;
    ctx.fillRect(4, 12, 2, 3);
    ctx.fillRect(10, 12, 2, 3);
    ctx.fillStyle = c.patches;
    ctx.fillRect(13, 7, 1, 1);
    ctx.fillRect(14, 5, 1, 3);
    ctx.fillStyle = c.body;
    ctx.fillRect(14, 4, 1, 2);
    const tailSwish = Math.sin(frameCount * 0.1) > 0 ? 0 : 1;
    ctx.fillRect(14 + tailSwish, 3, 1, 2);
  }

  // ── BOY SPRITE ─────────────────────────────────────────────
  function drawBoySprite(x, y, drawScale) {
    ctx.save();
    const s = drawScale || 1;
    ctx.translate(x, y);
    ctx.scale(s, s);

    // Longer hair (brown) with stylish flow and highlights
    ctx.fillStyle = "#5a3a1a";
    ctx.fillRect(2, -1, 12, 7);
    // Longer sides flowing down and over face sides
    ctx.fillRect(1, 1, 2, 8);
    ctx.fillRect(13, 1, 2, 8);
    ctx.fillRect(0, 4, 1, 4);
    ctx.fillRect(15, 4, 1, 4);
    // Hair covering more of face sides
    ctx.fillRect(2, 6, 1, 3);
    ctx.fillRect(13, 6, 1, 3);
    // Hair back/volume
    ctx.fillRect(3, 5, 2, 2);
    ctx.fillRect(11, 5, 2, 2);
    // Hair highlights
    ctx.fillStyle = "#7a5a3a";
    ctx.fillRect(4, -1, 4, 2);
    ctx.fillRect(9, 0, 3, 2);
    ctx.fillRect(2, 3, 3, 2);
    // Hair shine
    ctx.fillStyle = "#8a6a4a";
    ctx.fillRect(5, -1, 2, 1);
    ctx.fillRect(10, 1, 2, 1);
    // Hair texture/flow
    ctx.fillStyle = "#4a2a0a";
    ctx.fillRect(1, 6, 1, 2);
    ctx.fillRect(14, 6, 1, 2);

    // Head (better proportions, more tan)
    ctx.fillStyle = "#ebbd8f";
    ctx.fillRect(3, 1, 10, 9);
    ctx.fillRect(2, 3, 1, 5);
    ctx.fillRect(13, 3, 1, 5);
    
    // Face shading (chin definition)
    ctx.fillStyle = "rgba(180,120,80,0.2)";
    ctx.fillRect(4, 8, 8, 2);

    // Eyes (more expressive)
    ctx.fillStyle = "#3d2817";
    ctx.fillRect(5, 4, 2, 3);
    ctx.fillRect(9, 4, 2, 3);
    // Eye whites
    ctx.fillStyle = "#fff";
    ctx.fillRect(5, 4, 2, 2);
    ctx.fillRect(9, 4, 2, 2);
    // Pupils
    ctx.fillStyle = "#1a0f08";
    ctx.fillRect(5, 5, 2, 1);
    ctx.fillRect(9, 5, 2, 1);
    // Eye shine
    ctx.fillStyle = "#fff";
    ctx.fillRect(6, 4, 1, 1);
    ctx.fillRect(10, 4, 1, 1);
    // Eyebrows
    ctx.fillStyle = "#4a2a0a";
    ctx.fillRect(5, 3, 2, 1);
    ctx.fillRect(9, 3, 2, 1);

    // Nose (subtle)
    ctx.fillStyle = "rgba(180,120,80,0.35)";
    ctx.fillRect(7, 6, 2, 1);

    // Confident smile
    ctx.fillStyle = "#e74c3c";
    ctx.fillRect(6, 8, 4, 1);
    ctx.fillStyle = "#c0392b";
    ctx.fillRect(6, 8, 1, 1);
    ctx.fillRect(9, 8, 1, 1);

    // Full beard (matching hair color)
    ctx.fillStyle = "#5a3a1a"; // Main beard color (same as hair)
    // Chin beard base
    ctx.fillRect(4, 9, 8, 3);
    // Sides of beard extending from jaw
    ctx.fillRect(3, 8, 1, 2);
    ctx.fillRect(12, 8, 1, 2);
    ctx.fillRect(2, 8, 1, 3);
    ctx.fillRect(13, 8, 1, 3);
    // Full coverage under chin
    ctx.fillRect(3, 10, 10, 2);
    // Beard texture and depth
    ctx.fillStyle = "#4a2a0a"; // Darker areas (hair texture color)
    ctx.fillRect(4, 10, 1, 2);
    ctx.fillRect(6, 11, 1, 1);
    ctx.fillRect(9, 11, 1, 1);
    ctx.fillRect(11, 10, 1, 2);
    // Beard highlights
    ctx.fillStyle = "#7a5a3a"; // Lighter highlights (same as hair highlights)
    ctx.fillRect(5, 9, 2, 1);
    ctx.fillRect(9, 9, 2, 1);
    ctx.fillRect(6, 10, 2, 1);

    // Neck (tan)
    ctx.fillStyle = "#ebbd8f";
    ctx.fillRect(5, 10, 6, 2);
    ctx.fillStyle = "rgba(180,120,80,0.2)";
    ctx.fillRect(5, 10, 2, 1);
    ctx.fillRect(9, 10, 2, 1);

    // White dress shirt
    ctx.fillStyle = "#f5f5f5";
    ctx.fillRect(4, 12, 8, 3);
    // Shirt collar
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(5, 12, 2, 1);
    ctx.fillRect(9, 12, 2, 1);
    // Shirt shading
    ctx.fillStyle = "#e8e8e8";
    ctx.fillRect(4, 12, 1, 3);
    ctx.fillRect(11, 12, 1, 3);

    // Tie (elegant red)
    ctx.fillStyle = "#8b0000";
    ctx.fillRect(7, 12, 2, 1);
    ctx.fillRect(7, 13, 2, 6);
    ctx.fillRect(6, 19, 4, 1);
    ctx.fillRect(7, 20, 2, 1);
    // Tie knot
    ctx.fillStyle = "#a00000";
    ctx.fillRect(7, 12, 2, 2);
    // Tie highlight
    ctx.fillStyle = "#b00000";
    ctx.fillRect(7, 13, 1, 5);

    // Black suit jacket
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(3, 15, 10, 6);
    ctx.fillRect(2, 16, 1, 4);
    ctx.fillRect(13, 16, 1, 4);
    // Jacket lapels
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(3, 15, 2, 4);
    ctx.fillRect(11, 15, 2, 4);
    // Jacket highlights/structure
    ctx.fillStyle = "#2a2a2a";
    ctx.fillRect(5, 15, 1, 5);
    ctx.fillRect(10, 15, 1, 5);
    // Jacket buttons
    ctx.fillStyle = "#888";
    ctx.fillRect(6, 16, 1, 1);
    ctx.fillRect(6, 18, 1, 1);

    // Suit jacket sleeves
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 14, 3, 6);
    ctx.fillRect(13, 14, 3, 6);
    // Sleeve shading
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 14, 1, 6);
    ctx.fillRect(15, 14, 1, 6);
    // Hands (tan)
    ctx.fillStyle = "#c49968";
    ctx.fillRect(0, 19, 3, 2);
    ctx.fillRect(13, 19, 3, 2);

    // Rose in left hand
    // Rose stem
    ctx.fillStyle = "#228b22";
    ctx.fillRect(-2, 17, 1, 5);
    ctx.fillRect(-1, 16, 1, 1);
    // Rose leaves
    ctx.fillStyle = "#2e8b2e";
    ctx.fillRect(-3, 18, 2, 1);
    ctx.fillRect(-2, 19, 1, 1);
    // Rose bloom (red)
    ctx.fillStyle = "#dc143c";
    ctx.fillRect(-2, 14, 3, 3);
    ctx.fillRect(-1, 13, 2, 1);
    ctx.fillRect(-1, 17, 1, 1);
    // Rose center/petals detail
    ctx.fillStyle = "#ff1744";
    ctx.fillRect(-1, 14, 2, 2);
    // Rose highlight
    ctx.fillStyle = "#ff6b7a";
    ctx.fillRect(-1, 14, 1, 1);

    // Suit pants (matching black)
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(4, 21, 3, 6);
    ctx.fillRect(9, 21, 3, 6);
    // Pants crease/shading
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(4, 21, 1, 6);
    ctx.fillRect(11, 21, 1, 6);
    ctx.fillRect(5, 21, 1, 6);
    ctx.fillRect(10, 21, 1, 6);

    // Dress shoes (polished black)
    ctx.fillStyle = "#000";
    ctx.fillRect(3, 26, 4, 2);
    ctx.fillRect(9, 26, 4, 2);
    // Shoe shine/highlights
    ctx.fillStyle = "#444";
    ctx.fillRect(4, 26, 2, 1);
    ctx.fillRect(10, 26, 2, 1);
    ctx.fillStyle = "#666";
    ctx.fillRect(4, 26, 1, 1);
    ctx.fillRect(10, 26, 1, 1);

    ctx.restore();
  }

  // ── PIXEL HEART ────────────────────────────────────────────
  function drawPixelHeart(x, y, s, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x + s, y, s, s);
    ctx.fillRect(x + 2 * s, y, s, s);
    ctx.fillRect(x + 4 * s, y, s, s);
    ctx.fillRect(x + 5 * s, y, s, s);
    ctx.fillRect(x, y + s, s, s);
    ctx.fillRect(x + s, y + s, s, s);
    ctx.fillRect(x + 2 * s, y + s, s, s);
    ctx.fillRect(x + 3 * s, y + s, s, s);
    ctx.fillRect(x + 4 * s, y + s, s, s);
    ctx.fillRect(x + 5 * s, y + s, s, s);
    ctx.fillRect(x + 6 * s, y + s, s, s);
    ctx.fillRect(x, y + 2 * s, s, s);
    ctx.fillRect(x + s, y + 2 * s, s, s);
    ctx.fillRect(x + 2 * s, y + 2 * s, s, s);
    ctx.fillRect(x + 3 * s, y + 2 * s, s, s);
    ctx.fillRect(x + 4 * s, y + 2 * s, s, s);
    ctx.fillRect(x + 5 * s, y + 2 * s, s, s);
    ctx.fillRect(x + 6 * s, y + 2 * s, s, s);
    ctx.fillRect(x + s, y + 3 * s, s, s);
    ctx.fillRect(x + 2 * s, y + 3 * s, s, s);
    ctx.fillRect(x + 3 * s, y + 3 * s, s, s);
    ctx.fillRect(x + 4 * s, y + 3 * s, s, s);
    ctx.fillRect(x + 5 * s, y + 3 * s, s, s);
    ctx.fillRect(x + 2 * s, y + 4 * s, s, s);
    ctx.fillRect(x + 3 * s, y + 4 * s, s, s);
    ctx.fillRect(x + 4 * s, y + 4 * s, s, s);
    ctx.fillRect(x + 3 * s, y + 5 * s, s, s);
  }

  // ── HUD ────────────────────────────────────────────────────
  function drawHUD() {
    // Use visible area bounds so HUD stays on screen when zoomed
    const hudL = visibleLeft + 4;
    const hudR = visibleRight - 4;
    const hudCenter = visibleLeft + visibleWidth / 2;
    
    // Rescued counter with styled background
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    roundRect(ctx, hudL, 4, 95, 20, 4);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    roundRect(ctx, hudL, 4, 95, 20, 4);
    ctx.stroke();

    // Heart icon
    drawPixelHeart(hudL + 4, 8, 1.5, "#e74c3c");

    ctx.fillStyle = "#fff";
    ctx.font = "bold 10px monospace";
    ctx.fillText(" " + freedAnimals.length + "/6 Rescued", hudL + 18, 17);

    // Key held
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    roundRect(ctx, hudR - 68, 4, 68, 20, 4);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    roundRect(ctx, hudR - 68, 4, 68, 20, 4);
    ctx.stroke();

    if (heldKey >= 0) {
      ctx.fillStyle = KEY_COLORS[heldKey].fill;
      ctx.font = "bold 10px monospace";
      ctx.fillText("Key:", hudR - 64, 17);
      drawMiniKey(hudR - 26, 7, heldKey);
    } else {
      ctx.fillStyle = "#888";
      ctx.font = "10px monospace";
      ctx.fillText("Key: ---", hudR - 64, 17);
    }
  }

  function drawMiniKey(x, y, idx) {
    const col = KEY_COLORS[idx];
    ctx.fillStyle = col.fill;
    ctx.beginPath();
    ctx.arc(x + 4, y + 3, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x + 2, y + 5, 4, 6);
    ctx.fillRect(x, y + 8, 3, 2);
  }

  // ── TOUCH CONTROLS ─────────────────────────────────────────
  function drawTouchControls() {
    // In portrait mode, controls are drawn separately in screen coordinates
    if (isPortrait) return;
    
    const btns = getTouchButtons();
    ctx.save();

    // Stylish semi-transparent buttons
    function drawBtn(btn, icon) {
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = "#000";
      roundRect(ctx, btn.x, btn.y, btn.w, btn.h, 8);
      ctx.fill();
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      roundRect(ctx, btn.x, btn.y, btn.w, btn.h, 8);
      ctx.stroke();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = "#fff";
      ctx.font = "bold 22px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(icon, btn.x + btn.w / 2, btn.y + btn.h / 2);
    }

    drawBtn(btns.left, "\u25C0");
    drawBtn(btns.right, "\u25B6");
    drawBtn(btns.jump, "\u25B2");

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.restore();
  }

  // ── DRAW PARTICLES ─────────────────────────────────────────
  function drawParticles() {
    for (const p of particles) {
      const alpha = Math.min(1, p.life / (p.maxLife * 0.3));
      ctx.save();
      ctx.globalAlpha = alpha;
      if (p.isHeart) {
        drawPixelHeart(p.x, p.y, 1, p.color);
      } else {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
      }
      ctx.restore();
    }
  }

  // ── DRAW ROOM SCENE ────────────────────────────────────────
  function drawRoom() {
    // Romantic room background — fill full visible area
    const gradient = ctx.createLinearGradient(0, visibleTop, 0, visibleBottom);
    gradient.addColorStop(0, "#1a0a30");
    gradient.addColorStop(0.5, "#2d1b4e");
    gradient.addColorStop(1, "#1a0533");
    ctx.fillStyle = gradient;
    ctx.fillRect(visibleLeft - 10, visibleTop, visibleWidth + 20, visibleBottom - visibleTop);

    // Stars twinkling
    for (let i = 0; i < 30; i++) {
      const sx = (i * 97 + 13) % GAME_W;
      const sy = (i * 53 + 7) % (GAME_H - 60);
      const brightness = (Math.sin(frameCount * 0.03 + i) + 1) * 0.5;
      ctx.fillStyle = `rgba(255,255,255,${0.2 + brightness * 0.6})`;
      ctx.fillRect(sx, sy, 1, 1);
    }

    // Floor
    ctx.fillStyle = "#3a2050";
    ctx.fillRect(0, GAME_H - 40, GAME_W, 40);
    ctx.fillStyle = "#4a2a60";
    for (let x = 0; x < GAME_W; x += 24) {
      ctx.fillRect(x, GAME_H - 40, 12, 40);
    }
    ctx.fillStyle = "#5a3a70";
    ctx.fillRect(0, GAME_H - 40, GAME_W, 1);

    // Boy standing on the right side (within visible area)
    const boyX = visibleRight - 50;
    drawBoySprite(boyX, GAME_H - 40 - 28, 1);

    // Pulsing heart above boy
    const heartScale = 2 + Math.sin(frameCount * 0.08) * 0.5;
    drawPixelHeart(boyX + 6, GAME_H - 40 - 50 + Math.sin(frameCount * 0.05) * 3, heartScale, "#e74c3c");

    // Draw player
    drawGirlSprite(player.x - 2, player.y, player.facing, player.walkFrame, false, 1);

    // Draw freed animals following
    for (let i = 0; i < freedAnimals.length; i++) {
      const a = freedAnimals[i];
      drawAnimalSprite(player.x - 18 - i * 16, player.y + 4, a.idx, 0.8);
    }

    // Draw particles
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const alpha = p.life / p.maxLife;
      if (p.isHeart) {
        ctx.globalAlpha = alpha;
        drawPixelHeart(p.x, p.y, 2, p.color);
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.fillRect(p.x | 0, p.y | 0, p.size, p.size);
        ctx.globalAlpha = 1;
      }
    }

    // Instruction text (subtle)
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    const roomCenter = visibleLeft + visibleWidth / 2;
    ctx.fillText("Walk up to him...", roomCenter, 30);
  }

  // ── DRAW PROPOSAL SCENE ────────────────────────────────────
  function drawProposal() {
    // Use visible center for layout
    const vc = visibleLeft + visibleWidth / 2;
    
    // Romantic background — fill full visible area
    const gradient = ctx.createLinearGradient(0, visibleTop, 0, visibleBottom);
    gradient.addColorStop(0, "#0a0020");
    gradient.addColorStop(0.3, "#2d1b4e");
    gradient.addColorStop(0.6, "#4a2060");
    gradient.addColorStop(1, "#1a0533");
    ctx.fillStyle = gradient;
    ctx.fillRect(visibleLeft - 10, visibleTop, visibleWidth + 20, visibleBottom - visibleTop);

    // Stars with twinkle
    for (let i = 0; i < 50; i++) {
      const sx = (i * 97 + 13) % GAME_W;
      const sy = (i * 53 + 7) % 80;
      const brightness = (Math.sin(frameCount * 0.03 + i) + 1) * 0.5;
      ctx.fillStyle = `rgba(255,255,255,${0.2 + brightness * 0.6})`;
      const sz = i % 4 === 0 ? 2 : 1;
      ctx.fillRect(sx, sy, sz, sz);
      // Sparkle cross on bright stars
      if (brightness > 0.8 && i % 3 === 0) {
        ctx.fillStyle = `rgba(255,255,255,${brightness * 0.3})`;
        ctx.fillRect(sx - 1, sy, 3, 1);
        ctx.fillRect(sx, sy - 1, 1, 3);
      }
    }

    // Floor with tiles
    ctx.fillStyle = "#3a2050";
    ctx.fillRect(0, GAME_H - 40, GAME_W, 40);
    ctx.fillStyle = "#4a2a60";
    for (let x = 0; x < GAME_W; x += 24) {
      ctx.fillRect(x, GAME_H - 40, 12, 40);
    }
    // Floor highlight line
    ctx.fillStyle = "#5a3a70";
    ctx.fillRect(0, GAME_H - 40, GAME_W, 1);

    // Floating hearts decoration
    for (let i = 0; i < 10; i++) {
      const hx = (i * 50 + 15) % GAME_W;
      const hy = 25 + Math.sin(frameCount * 0.02 + i * 1.3) * 15;
      drawPixelHeart(hx, hy, 2, i % 3 === 0 ? "#e74c3c" : i % 3 === 1 ? "#ff69b4" : "#ff9999");
    }

    // Boy character in center
    drawBoySprite(vc - 8, GAME_H - 40 - 28, 1);

    // Pulsing heart above boy
    const heartScale = 2 + Math.sin(frameCount * 0.08) * 0.5;
    drawPixelHeart(vc - 6, GAME_H - 40 - 50 + Math.sin(frameCount * 0.05) * 3, heartScale, "#e74c3c");

    // Girl approaches from left
    const girlX = Math.min(vc - 50, visibleLeft + 20 + frameCount * 0.5);
    drawGirlSprite(girlX, GAME_H - 40 - 20, 1, Math.floor(frameCount / 8) % 4, false, 1);

    // Freed animals behind girl
    for (let i = 0; i < freedAnimals.length; i++) {
      drawAnimalSprite(girlX - 18 - i * 16, GAME_H - 40 - 14, freedAnimals[i].idx, 0.8);
    }

    // Dialog box with richer style
    ctx.fillStyle = "rgba(0,0,0,0.88)";
    roundRect(ctx, vc - 132, 88, 264, 124, 8);
    ctx.fill();
    ctx.strokeStyle = "#ff69b4";
    ctx.lineWidth = 2;
    roundRect(ctx, vc - 132, 88, 264, 124, 8);
    ctx.stroke();

    // Inner border
    ctx.strokeStyle = "#e74c3c";
    ctx.lineWidth = 1;
    roundRect(ctx, vc - 128, 92, 256, 116, 6);
    ctx.stroke();

    // Question text
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.font = "bold 16px monospace";
    ctx.fillText("Will you be my", vc, 125);
    ctx.shadowColor = "#e74c3c";
    ctx.shadowBlur = 10;
    ctx.fillStyle = "#e74c3c";
    ctx.font = "bold 20px monospace";
    ctx.fillText("Valentine?", vc, 150);
    ctx.shadowBlur = 0;

    // Heart decorations on dialog
    drawPixelHeart(vc - 122, 95, 2, "#e74c3c");
    drawPixelHeart(vc + 108, 95, 2, "#e74c3c");

    // Buttons with hover-like styling
    const btn1 = { x: vc - 90, y: 165, w: 80, h: 30 };
    const btn2 = { x: vc + 10, y: 165, w: 80, h: 30 };

    // "Yes" button
    ctx.fillStyle = "#1a401a";
    roundRect(ctx, btn1.x, btn1.y, btn1.w, btn1.h, 4);
    ctx.fill();
    ctx.strokeStyle = "#2ecc71";
    ctx.lineWidth = 2;
    roundRect(ctx, btn1.x, btn1.y, btn1.w, btn1.h, 4);
    ctx.stroke();
    ctx.fillStyle = "#2ecc71";
    ctx.font = "bold 14px monospace";
    ctx.fillText("Yes", btn1.x + btn1.w / 2, btn1.y + 20);

    // "Yes but in Red" button
    ctx.fillStyle = "#401a1a";
    roundRect(ctx, btn2.x, btn2.y, btn2.w, btn2.h, 4);
    ctx.fill();
    ctx.strokeStyle = "#e74c3c";
    ctx.lineWidth = 2;
    roundRect(ctx, btn2.x, btn2.y, btn2.w, btn2.h, 4);
    ctx.stroke();
    ctx.fillStyle = "#e74c3c";
    ctx.font = "bold 11px monospace";
    ctx.fillText("Yes but", btn2.x + btn2.w / 2, btn2.y + 13);
    ctx.fillText("in Red", btn2.x + btn2.w / 2, btn2.y + 24);

    ctx.textAlign = "left";

    // Particles
    drawParticlesScreen();
  }

  // ── DRAW WIN SCREEN ────────────────────────────────────────
  function drawWin() {
    // Use visible bounds for layout
    const vc = visibleLeft + visibleWidth / 2;
    
    // Background with richer gradient — fill full visible area
    const gradient = ctx.createLinearGradient(0, visibleTop, 0, visibleBottom);
    gradient.addColorStop(0, "#ff69b4");
    gradient.addColorStop(0.4, "#e74c3c");
    gradient.addColorStop(0.7, "#c0392b");
    gradient.addColorStop(1, "#8B0000");
    ctx.fillStyle = gradient;
    ctx.fillRect(visibleLeft - 10, visibleTop, visibleWidth + 20, visibleBottom - visibleTop);

    // Stars overlay
    for (let i = 0; i < 30; i++) {
      const sx = (i * 47 + 23) % GAME_W;
      const sy = (i * 31 + 11) % GAME_H;
      const brightness = (Math.sin(frameCount * 0.04 + i * 0.8) + 1) * 0.5;
      ctx.fillStyle = `rgba(255,255,255,${brightness * 0.3})`;
      ctx.fillRect(sx, sy, 1, 1);
    }

    // "You Win!" text with shadow
    ctx.textAlign = "center";
    ctx.shadowColor = "#8B0000";
    ctx.shadowBlur = 15;
    ctx.fillStyle = "#8B0000";
    ctx.font = "bold 42px monospace";
    ctx.fillText("You Win!", vc + 2, 72);
    ctx.fillStyle = "#fff";
    ctx.fillText("You Win!", vc, 70);
    ctx.shadowBlur = 0;

    // Hearts orbiting
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + frameCount * 0.02;
      const hx = vc + Math.cos(angle) * 80 - 6;
      const hy = 65 + Math.sin(angle) * 30;
      drawPixelHeart(hx, hy, 2, "#fff");
    }

    // Rescued animals panel - fit within visible width
    const panelW = Math.min(visibleWidth - 20, GAME_W - 70);
    const panelX = vc - panelW / 2;
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    roundRect(ctx, panelX, 98, panelW, 72, 6);
    ctx.fill();

    ctx.fillStyle = "#ffe";
    ctx.font = "bold 11px monospace";
    ctx.fillText("Your rescued friends:", vc, 115);

    const animalSpacing = Math.min(50, (panelW - 30) / 6);
    const startAnimalX = vc - (6 * animalSpacing) / 2 + 15;
    for (let i = 0; i < 6; i++) {
      const ax = startAnimalX + i * animalSpacing;
      drawAnimalSprite(ax, 125, i, 1.2);
      ctx.fillStyle = KEY_COLORS[i].fill;
      ctx.font = "bold 8px monospace";
      ctx.fillText(ANIMALS[i].name, ax + 8, 155);
    }

    // Girl + Boy together
    drawGirlSprite(vc - 25, 185, 1, 0, false, 1.2);
    drawBoySprite(vc + 5, 185, 1.2);
    const heartBob = Math.sin(frameCount * 0.08) * 3;
    drawPixelHeart(vc - 6, 173 + heartBob, 2, "#e74c3c");

    // Subtitle
    ctx.fillStyle = "#ffe";
    ctx.font = "bold 12px monospace";
    ctx.fillText("Happy Valentine's Day!", vc, 240);

    ctx.font = "10px monospace";
    ctx.fillStyle = "#ffd";
    if (Math.floor(frameCount / 40) % 2 === 0) {
      ctx.fillText("Tap to play again", vc, 258);
    }

    ctx.textAlign = "left";

    drawParticlesScreen();
  }

  function drawParticlesScreen() {
    for (const p of particles) {
      const alpha = Math.min(1, p.life / (p.maxLife * 0.3));
      ctx.save();
      ctx.globalAlpha = alpha;
      if (p.isHeart) {
        drawPixelHeart(p.x, p.y, 1, p.color);
      } else {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
      }
      ctx.restore();
    }
  }

  // ── REPLAY HANDLERS ────────────────────────────────────────
  canvas.addEventListener("touchstart", function replayHandler(e) {
    if (gameState === STATE.WIN && winTimer > 90) {
      gameState = STATE.TITLE;
      winTimer = 0;
    }
  });
  canvas.addEventListener("mousedown", function replayHandler(e) {
    if (gameState === STATE.WIN && winTimer > 90) {
      gameState = STATE.TITLE;
      winTimer = 0;
    }
  });

  // ── GAME LOOP ──────────────────────────────────────────────
  let lastTime = 0;
  const TIMESTEP = 1000 / 60;
  let accumulator = 0;

  function gameLoop(time) {
    const delta = time - lastTime;
    lastTime = time;
    accumulator += delta;

    if (accumulator > TIMESTEP * 5) accumulator = TIMESTEP * 5;

    while (accumulator >= TIMESTEP) {
      update();
      accumulator -= TIMESTEP;
    }

    draw();
    requestAnimationFrame(gameLoop);
  }

  requestAnimationFrame(gameLoop);
})();
