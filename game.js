import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

// ============================================================================
// 1. ASET 3D (.glb di folder proyek)
// ============================================================================
const KENNEY = 'kenney_watercraft-pack/Models/GLB format';
const MECH_FILE = 'Mech by Quaternius - tLs9mFVCSU.glb';
const POLE_FILE = 'Fishing Pole by Shawn Westphal - eyuCxAqI9er.glb';
const OCEAN_FILE = 'Ocean by Poly by Google - faUostvShTI.glb';
const PINEAPPLE_FILE = 'Pineapple by jeremy - 7B_hERcgTZW.glb';
const KIOSK_FILE = 'vape-box-kiosk 2.glb';
const CSTORE_FILE = 'c-store-logo.glb';
const BUOY_FILE = `${KENNEY}/buoy-flag.glb`;

// Model kapal berganti saat level Kapal mencapai fromLvl
const BOATS = [
  { name: 'Sampan Dayung', file: 'boat-row-small.glb', fromLvl: 1 },
  { name: 'Perahu Pancing', file: 'boat-fishing-small.glb', fromLvl: 4 },
  { name: 'Speedboat', file: 'boat-speed-a.glb', fromLvl: 7 },
  { name: 'Kapal Tunda', file: 'boat-tug-a.glb', fromLvl: 11 },
  { name: 'Kapal Derek', file: 'boat-tow-a.glb', fromLvl: 16 }
];

// len = panjang di layar (meter dunia game, sengaja dibesarkan agar terbaca di HP)
const FISH_MODELS = {
  milkfish: { file: 'Milkfish by Charlie - 9mqMckW8Tt.glb', len: 1.0 },
  trout: { file: 'Trout by Poly by Google - 0HCLwTdxvz5.glb', len: 1.1 },
  angler: { file: 'Angler Fish by Anonymous - 85n5_RiSeSf.glb', len: 1.2 },
  goblin: { file: 'Goblin Shark by Quaternius - JQrBevTzgD.glb', len: 1.7 },
  fishbone: { file: 'Fish Bone by Quaternius - bU5RLZnq6v.glb', len: 0.95 },
  sodacan: { file: 'Soda Can Crushed by Kenney - MWvBbxYzjJ.glb', len: 0.55 },
  toilet: { file: 'Toilet by Pat Siefring - 23BWsguAdkf.glb', len: 1.15 },
  trashbag: { file: 'trash bag black by Jens Kull - 9_gWQWhmmQv.glb', len: 0.85 }
};

const BOAT_SCALE = 1.3;
// Lambung kapal di Y≈0 setelah centering; positif = tenggelam, negatif = naik.
const BOAT_SINK = -0.05;
const MECH_HEIGHT = 1.3;
const WAVE_AMP = 0.035;
const WATER_SURFACE_Y = -0.08; // permukaan air di bawah lambung
const SWIM_MIN_R = 4.5; // ikan bawah laut tidak lewat di bawah kapal
const ROD_LENGTH = 2.4;
const ROD_FP_SCALE = 0.42; // di first person joran diperkecil biar proporsional

// Koordinat mentah di file joran (hasil inspeksi GLB): batang sepanjang +Z, melengkung ke -X
const POLE_GRIP = new THREE.Vector3(85.3, 105, 22);
const POLE_TIP = new THREE.Vector3(28.1, 105, 202);

const gltfLoader = new GLTFLoader();
const gltfCache = new Map();

function loadGltf(path) {
  if (!gltfCache.has(path)) {
    gltfCache.set(path, new Promise((resolve, reject) => gltfLoader.load(encodeURI(path), resolve, undefined, reject)));
  }
  return gltfCache.get(path);
}

function measure(obj) {
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  return { box, size: box.getSize(new THREE.Vector3()), center: box.getCenter(new THREE.Vector3()) };
}

// ============================================================================
// 2. DATA IKAN & RARITY
// ============================================================================
const RARITIES = [
  { id: 'Common', weight: 52, color: '#cbd5e1', bg: '#334155', manualOnly: false },
  { id: 'Uncommon', weight: 26, color: '#4ade80', bg: '#166534', manualOnly: false },
  { id: 'Rare', weight: 12, color: '#7dd3fc', bg: '#075985', manualOnly: false },
  { id: 'Epic', weight: 6, color: '#d8b4fe', bg: '#581c87', manualOnly: false },
  { id: 'Legendary', weight: 3, color: '#fcd34d', bg: '#92400e', manualOnly: true },
  { id: 'Mythic', weight: 1, color: '#fda4af', bg: '#881337', manualOnly: true },
  { id: 'Junk', weight: 0, color: '#d6d3d1', bg: '#44403c', manualOnly: false }
];
const RARITY_JUNK = 6;
const JUNK_CHANCE = 0.68; // sampah lebih sering daripada ikan

// Satu perairan untuk sementara
const WATERS = [
  {
    id: 0,
    name: 'Teluk Zamrud',
    mult: 1,
    waterColor: 0x1287a8,
    fishes: [
      { id: 'soda_can', name: 'Kaleng Soda Pipih', rarity: RARITY_JUNK, baseKg: 0.12, baseCoin: 0, glbKey: 'sodacan', junk: true },
      { id: 'toilet', name: 'Toilet', rarity: RARITY_JUNK, baseKg: 6.5, baseCoin: 0, glbKey: 'toilet', junk: true },
      { id: 'trashbag', name: 'Kantong Sampah', rarity: RARITY_JUNK, baseKg: 1.1, baseCoin: 0, glbKey: 'trashbag', junk: true },
      { id: 'milkfish', name: 'Milkfish', rarity: 0, baseKg: 0.7, baseCoin: 14, glbKey: 'milkfish' },
      { id: 'trout', name: 'Rainbow Trout', rarity: 0, baseKg: 1.4, baseCoin: 22, glbKey: 'trout' },
      { id: 'fishbone', name: 'Fish Bone', rarity: 1, baseKg: 0.4, baseCoin: 35, glbKey: 'fishbone' },
      { id: 'trout_big', name: 'Trout Jumbo', rarity: 1, baseKg: 3.5, baseCoin: 48, glbKey: 'trout' },
      { id: 'anglerfish', name: 'Angler Fish', rarity: 2, baseKg: 7.5, baseCoin: 120, glbKey: 'angler' },
      { id: 'goblin', name: 'Goblin Shark', rarity: 3, baseKg: 16, baseCoin: 280, glbKey: 'goblin' },
      { id: 'angler_trophy', name: 'Deep Angler', rarity: 4, baseKg: 22, baseCoin: 480, glbKey: 'angler' },
      { id: 'goblin_king', name: 'Goblin Apex', rarity: 4, baseKg: 32, baseCoin: 620, glbKey: 'goblin' },
      { id: 'goblin_myth', name: 'Goblin Mythic', rarity: 5, baseKg: 58, baseCoin: 1650, glbKey: 'goblin' }
    ]
  }
];

const ALL_FISH = WATERS.flatMap(w => w.fishes);
const REAL_FISH = ALL_FISH.filter(f => !f.junk);
const FISH_BY_ID = Object.fromEntries(ALL_FISH.map(f => [f.id, f]));

// ============================================================================
// 3. SAVE / LOAD & EKONOMI
// ============================================================================
const SAVE_KEY = 'reel_rich_3d_save_v1';
const AUTO_UNLOCK_LVL = 3;
const VOYAGE_BOAT_LVL = 6;

const defaultState = () => ({
  coins: 0,
  rodLvl: 1,
  anglerLvl: 1,
  boatLvl: 1,
  boatSkin: 0, // model kapal yang dipakai (bisa diganti ke yang sudah unlock)
  waterId: 0,
  autoEnabled: false,
  voyages: 0,
  voyageBonus: 1,
  book: {}, // { fishId: { count, maxKg, gilded, albino } }
  trophyTargetId: 'trout',
  lastSaveTime: Date.now()
});

function loadState() {
  const s = defaultState();
  try {
    Object.assign(s, JSON.parse(localStorage.getItem(SAVE_KEY)));
  } catch {}
  // Save lama bisa berisi lokasi/ikan yang sudah tidak ada
  s.waterId = 0;
  s.book = Object.fromEntries(Object.entries(s.book || {}).filter(([id]) => FISH_BY_ID[id]));
  if (!FISH_BY_ID[s.trophyTargetId] || FISH_BY_ID[s.trophyTargetId].junk) s.trophyTargetId = 'trout';
  const maxBoat = boatTier(s.boatLvl || 1);
  if (typeof s.boatSkin !== 'number' || s.boatSkin < 0 || s.boatSkin > maxBoat) s.boatSkin = maxBoat;
  return s;
}

const state = loadState();

function saveState() {
  state.lastSaveTime = Date.now();
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {}
}

const getRodCost = () => Math.floor(18 * Math.pow(1.42, state.rodLvl - 1));
const getAnglerCost = () => Math.floor(25 * Math.pow(1.48, state.anglerLvl - 1));
const getBoatCost = () => Math.floor(45 * Math.pow(1.62, state.boatLvl - 1));
const getMaxWeightCapacity = () => +(1.8 * Math.pow(1.32, state.rodLvl - 1)).toFixed(1);
const getBiteWaitSeconds = () => Math.max(1.1, 4.5 * Math.pow(0.91, state.anglerLvl - 1));
const getCatchValueMultiplier = () =>
  +((1 + (state.boatLvl - 1) * 0.38) * WATERS[state.waterId].mult * state.voyageBonus).toFixed(2);
const autoOn = () => state.autoEnabled && state.anglerLvl >= AUTO_UNLOCK_LVL;

function boatTier(lvl) {
  let tier = 0;
  BOATS.forEach((b, i) => { if (lvl >= b.fromLvl) tier = i; });
  return tier;
}

function currentBoatSkin() {
  const maxT = boatTier(state.boatLvl);
  return Math.max(0, Math.min(state.boatSkin ?? maxT, maxT));
}

function formatNum(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e4) return (n / 1e3).toFixed(1) + 'K';
  return Math.floor(n).toLocaleString('id-ID');
}

// ============================================================================
// 4. AUDIO SYNTH + HAPTICS (tanpa file audio)
// ============================================================================
let audioCtx = null;
function unlockAudio() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch {}
}

function playTone(freq = 440, dur = 0.1, type = 'sine', slide = 0) {
  try {
    unlockAudio();
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), audioCtx.currentTime + dur);
    gain.gain.setValueAtTime(0.09, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + dur);
  } catch {}
}

function vibrate(pattern = 25) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

// Deteksi perangkat sentuh untuk performa & kontrol lebih longgar
const IS_TOUCH = matchMedia('(hover: none), (pointer: coarse)').matches
  || 'ontouchstart' in window
  || navigator.maxTouchPoints > 0;

// HP / layar sempit: sembunyikan panel upgrade biar lempar kail lebih lega
function syncFocusCast() {
  const narrow = Math.min(window.innerWidth, window.innerHeight) < 720
    || window.innerWidth <= 900;
  const focus = IS_TOUCH || narrow;
  document.body.classList.toggle('focus-cast', focus);
  if (!focus) document.body.classList.remove('shop-open');
  const menuBtn = document.getElementById('menu-btn');
  if (menuBtn) menuBtn.hidden = !focus;
}
syncFocusCast();
window.addEventListener('resize', syncFocusCast);
window.addEventListener('orientationchange', syncFocusCast);

// ============================================================================
// 5. ELEMEN UI
// ============================================================================
const $ = id => document.getElementById(id);
const wrap = $('canvas-wrap');
const playZone = $('play-zone');
const castBtn = $('cast-btn');
const statusHint = $('status-hint');
const tensionBox = $('tension-box');
const sweetZoneEl = $('sweet-zone');
const tensionCursorEl = $('tension-cursor');
const reelProgressEl = $('reel-progress');
const fightWeightEl = $('fight-weight');
const tensionHintEl = $('tension-hint');
const catchModal = $('catch-modal');
const autoBtn = $('auto-btn');
let pendingCatchFish = null; // tahan auto-cast sampai pemain klaim popup

// ============================================================================
// 6. ADEGAN 3D
// ============================================================================
const SKY = 0x8fd4f5;
const scene = new THREE.Scene();
scene.background = new THREE.Color(SKY);
scene.fog = new THREE.Fog(SKY, 30, 90);

const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 400);
const renderer = new THREE.WebGLRenderer({
  antialias: !IS_TOUCH, // antialias mahal di GPU mobile
  powerPreference: 'high-performance',
  alpha: false
});
// Cap DPR lebih agresif di HP supaya 60fps tetap nyaman
let pixelRatio = Math.min(window.devicePixelRatio || 1, IS_TOUCH ? 1.5 : 2);
renderer.setPixelRatio(pixelRatio);
renderer.outputColorSpace = THREE.SRGBColorSpace;
wrap.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xffffff, 0x1b6a86, 1.7));
const sun = new THREE.DirectionalLight(0xfff4d6, 2.1);
sun.position.set(8, 20, -12); // dari sisi kamera supaya sisi kapal yang terlihat terang
scene.add(sun);

// Air: plane cadangan + Ocean GLB (dipasang di init). Plane rendah supaya tidak menembus kapal.
const WATER_SEG = IS_TOUCH ? 20 : 32;
const waterGeo = new THREE.PlaneGeometry(180, 180, WATER_SEG, WATER_SEG);
waterGeo.rotateX(-Math.PI / 2);
const waterPos = waterGeo.attributes.position;
const waterBaseY = new Float32Array(waterPos.count);
for (let i = 0; i < waterPos.count; i++) waterBaseY[i] = waterPos.getY(i);
const waterMat = new THREE.MeshStandardMaterial({
  color: WATERS[state.waterId].waterColor,
  roughness: 0.28,
  metalness: 0.12,
  flatShading: true,
  transparent: false, // transparan + depthWrite=false = air “masuk” ke kapal
  opacity: 1
});
const waterMesh = new THREE.Mesh(waterGeo, waterMat);
waterMesh.position.y = WATER_SURFACE_Y;
waterMesh.renderOrder = -2;
scene.add(waterMesh);
const waterGroup = new THREE.Group(); // wadah Ocean GLB
waterGroup.position.y = WATER_SURFACE_Y;
scene.add(waterGroup);
let waterFrame = 0;
let oceanMesh = null;

// Latar: pulau, mercusuar, awan (semua di sisi depan/kiri, jauh dari jalur kamera)
const rockMat = new THREE.MeshStandardMaterial({ color: 0x4b5d73, flatShading: true });
const sandMat = new THREE.MeshStandardMaterial({ color: 0xfde68a, flatShading: true });
const treeMat = new THREE.MeshStandardMaterial({ color: 0x15803d, flatShading: true });
const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, flatShading: true });
const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, flatShading: true });
const redMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, flatShading: true });

function addAt(mesh, x, y, z) {
  mesh.position.set(x, y, z);
  scene.add(mesh);
  return mesh;
}

const ISLAND_COUNT = IS_TOUCH ? 5 : 7;
let pineappleIsland = { x: 12, z: 42 }; // diisi saat loop pulau (bekas mercusuar)
for (let i = 0; i < ISLAND_COUNT; i++) {
  const a = 0.5 + i * 0.42;
  const dist = 36 + (i % 2) * 9;
  const x = Math.cos(a) * dist;
  const z = Math.sin(a) * dist + 4;
  addAt(new THREE.Mesh(new THREE.DodecahedronGeometry(2.8 + (i % 3), 0), rockMat), x, 0.3, z).scale.set(1.5, 0.75, 1.3);
  addAt(new THREE.Mesh(new THREE.CylinderGeometry(3.4, 4.4, 0.4, 8), sandMat), x, 0.05, z);
  if (i === 3) {
    // Bekas mercusuar — diganti model nanas (mountPineapple)
    pineappleIsland = { x, z };
  } else if (i % 2 === 0) {
    addAt(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 1.4, 6), trunkMat), x, 1.6, z);
    addAt(new THREE.Mesh(new THREE.ConeGeometry(1.5, 2.6, 6), treeMat), x, 3.0, z);
    addAt(new THREE.Mesh(new THREE.ConeGeometry(1.1, 2.2, 6), treeMat), x, 4.1, z);
  }
}

// Landmark depan kapal (kiri→kanan di layar): Logo C-Store → Vape Box → Nanas
const landmarkZ = 28;
const landmarkGap = 7.2;
const kioskIsland = { x: 2.5, z: landmarkZ };
// Dari sudut pandang kapal, +X cenderung ke kiri layar → logo di +X
const cstoreIsland = { x: kioskIsland.x + landmarkGap, z: landmarkZ };
pineappleIsland = { x: kioskIsland.x - landmarkGap, z: landmarkZ + 1.5 };
function addLandmarkRock(x, z, scale = 1) {
  addAt(new THREE.Mesh(new THREE.DodecahedronGeometry(2.8 * scale, 0), rockMat), x, 0.3, z).scale.set(1.6, 0.7, 1.3);
  addAt(new THREE.Mesh(new THREE.CylinderGeometry(3.6 * scale, 4.5 * scale, 0.42, 8), sandMat), x, 0.05, z);
}
addLandmarkRock(cstoreIsland.x, cstoreIsland.z, 0.95);
addLandmarkRock(kioskIsland.x, kioskIsland.z, 1.15);
addLandmarkRock(pineappleIsland.x, pineappleIsland.z, 1.05);

const clouds = [];
const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
const CLOUD_COUNT = IS_TOUCH ? 4 : 6;
for (let c = 0; c < CLOUD_COUNT; c++) {
  const cloud = new THREE.Group();
  for (let p = 0; p < 3; p++) {
    const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(1.6 - p * 0.3, 0), cloudMat);
    puff.position.set((p - 1) * 1.6, (p % 2) * 0.4, 0);
    puff.scale.set(1.5, 0.7, 1);
    cloud.add(puff);
  }
  cloud.position.set(-40 + c * 15, 13 + (c % 2) * 3, 30 + (c % 3) * 8);
  scene.add(cloud);
  clouds.push(cloud);
}

// Kapal + pemancing (boatGroup bergoyang mengikuti ombak)
const boatGroup = new THREE.Group();
const boatSlot = new THREE.Group();
const anglerGroup = new THREE.Group();
const rodPivot = new THREE.Group();
const rodTipMarker = new THREE.Object3D();
anglerGroup.position.set(1.5, 0.4, 0);
rodPivot.position.set(0.4, 0.8, 0.1);
rodTipMarker.position.set(0, 1, 2.1);
rodPivot.add(rodTipMarker);
anglerGroup.add(rodPivot);
boatGroup.add(boatSlot, anglerGroup);
scene.add(boatGroup);

// Pelampung, riak, tali pancing
const bobberGroup = new THREE.Group();
const bobberBot = new THREE.Mesh(new THREE.SphereGeometry(0.23, 12, 10), whiteMat);
bobberBot.position.y = -0.12;
bobberGroup.add(new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), redMat), bobberBot);
bobberGroup.visible = false;
scene.add(bobberGroup);

const rippleGeo = new THREE.RingGeometry(0.25, 0.38, 24);
rippleGeo.rotateX(-Math.PI / 2);
const rippleMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
const rippleMesh = new THREE.Mesh(rippleGeo, rippleMat);
scene.add(rippleMesh);

const LINE_POINTS = 20;
const lineGeo = new THREE.BufferGeometry();
lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(LINE_POINTS * 3), 3));
const fishingLine = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xffffff }));
fishingLine.visible = false;
fishingLine.frustumCulled = false;
scene.add(fishingLine);

// Ikan berenang di bawah permukaan — diisi dari model GLB setelah load
const swimShadows = [];
const SWIM_COUNT = IS_TOUCH ? 5 : 8;

// Ikan tangkapan: model GLB dipasang ke grup ini saat melompat (fallback: bola pipih)
const caughtFishGroup = new THREE.Group();
const fallbackFish = new THREE.Mesh(
  new THREE.SphereGeometry(0.5, 10, 8),
  new THREE.MeshStandardMaterial({ color: 0x38bdf8, flatShading: true })
);
fallbackFish.scale.set(0.5, 0.8, 1.5);
caughtFishGroup.visible = false;
scene.add(caughtFishGroup);

// ----- Pemasangan model GLB -----
const boatCache = new Map();
const fishModels = {};
let mountedTier = -1;
let mechMixer = null;
let assetsReady = false;
let boatBox = new THREE.Box3(new THREE.Vector3(-2.5, 0, -1.2), new THREE.Vector3(2.5, 2, 1.2));
let reelEndZ = 2;
let castNear = 4.6;
let castFar = 6.8;

// Cari lantai dek di tengah kapal (bukan buritan)
function findDeck(boat, box) {
  const ray = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);
  const hits = [];
  const midX = (box.min.x + box.max.x) * 0.5;
  const midZ = (box.min.z + box.max.z) * 0.5;
  for (let dx = -0.55; dx <= 0.55; dx += 0.12) {
    for (let dz = -0.35; dz <= 0.35; dz += 0.12) {
      ray.set(new THREE.Vector3(midX + dx, 50, midZ + dz), down);
      const hit = ray.intersectObject(boat, true)[0];
      if (hit) hits.push(hit.point);
    }
  }
  if (!hits.length) return new THREE.Vector3(midX, 0.45, midZ);
  const minY = Math.min(...hits.map(p => p.y));
  const floor = hits.filter(p => p.y < minY + 0.08);
  floor.sort((a, b) => {
    const da = (a.x - midX) ** 2 + (a.z - midZ) ** 2;
    const db = (b.x - midX) ** 2 + (b.z - midZ) ** 2;
    return da - db;
  });
  return floor[0].clone();
}

async function mountBoat() {
  const tier = currentBoatSkin();
  if (tier === mountedTier) return;
  mountedTier = tier;
  let boat = boatCache.get(tier);
  if (!boat) {
    boat = (await loadGltf(`${KENNEY}/${BOATS[tier].file}`)).scene;
    boat.rotation.y = -Math.PI / 2; // haluan ke -X; mancing ke samping (+Z)
    boat.scale.setScalar(BOAT_SCALE);
    const m = measure(boat);
    boat.position.set(-m.center.x, -m.box.min.y - BOAT_SINK, -m.center.z);
    boat.userData.box = measure(boat).box;
    boat.userData.deck = findDeck(boat, boat.userData.box);
    boat.userData.deckCentered = true;
    boatCache.set(tier, boat);
  } else if (!boat.userData.deckCentered) {
    // Refresh posisi dek lama (sebelumnya buritan) → tengah kapal
    boat.userData.deck = findDeck(boat, boat.userData.box);
    boat.userData.deckCentered = true;
  }
  if (tier !== mountedTier) return; // sudah ada upgrade yang lebih baru saat menunggu unduhan
  boatSlot.clear();
  boatSlot.add(boat);
  boatBox = boat.userData.box;
  anglerGroup.position.copy(boat.userData.deck);
  reelEndZ = boatBox.max.z + 0.8;
  castNear = reelEndZ + 2.6;
  castFar = reelEndZ + 4.8;
  updateCameraLayout();
}

let mechRoot = null;

async function mountMech() {
  const gltf = await loadGltf(MECH_FILE);
  const mech = gltf.scene; // dipakai langsung (clone biasa memutus kerangka SkinnedMesh)
  mech.traverse(o => { if (o.isSkinnedMesh) o.frustumCulled = false; });
  const m = measure(mech);
  const s = MECH_HEIGHT / m.size.y;
  mech.scale.setScalar(s);
  mech.position.set(-m.center.x * s, -m.box.min.y * s, -m.center.z * s);
  anglerGroup.add(mech);
  mechRoot = mech;
  rodPivot.position.set(m.size.x * s * 0.45, MECH_HEIGHT * 0.62, m.size.z * s * 0.15);
  const idle = gltf.animations.find(a => /idle/i.test(a.name));
  if (idle) {
    mechMixer = new THREE.AnimationMixer(mech);
    mechMixer.clipAction(idle).play();
  }
  applyCameraMode();
}

let rodHolder = null;
let rodBaseScale = 1;

async function mountPole() {
  const pole = (await loadGltf(POLE_FILE)).scene;
  const holder = new THREE.Group();
  pole.position.copy(POLE_GRIP).negate(); // genggaman di titik pivot
  rodTipMarker.position.copy(POLE_TIP).sub(POLE_GRIP);
  holder.add(pole, rodTipMarker);
  rodBaseScale = ROD_LENGTH / POLE_TIP.distanceTo(POLE_GRIP);
  holder.scale.setScalar(rodBaseScale);
  holder.rotation.set(-0.75, 0, Math.PI / 2); // putar lengkungan ke bawah, lalu dongakkan ~43°
  rodPivot.add(holder);
  rodHolder = holder;
  applyCameraMode();
}

function prepareFishHolder(model, targetLen) {
  model.traverse(o => { if (o.isSkinnedMesh) o.frustumCulled = false; });
  // Orientasikan badan sepanjang sumbu Z
  let m = measure(model);
  if (m.size.x > m.size.z) model.rotation.y = Math.PI / 2;
  m = measure(model);
  model.position.copy(m.center).negate();
  const holder = new THREE.Group();
  holder.add(model);
  holder.userData.baseScale = targetLen / Math.max(m.size.x, m.size.y, m.size.z, 0.0001);
  return holder;
}

async function loadFishModels() {
  await Promise.all(Object.entries(FISH_MODELS).map(async ([key, meta]) => {
    const model = (await loadGltf(meta.file)).scene;
    fishModels[key] = prepareFishHolder(model, meta.len);
  }));
  spawnSwimFish();
}

function spawnSwimFish() {
  for (const s of swimShadows) scene.remove(s.mesh);
  swimShadows.length = 0;

  // Ikan hidup di bawah laut (bukan tulang / sampah)
  const junkKeys = new Set(['fishbone', 'sodacan', 'toilet', 'trashbag']);
  const keys = Object.keys(fishModels).filter(k => !junkKeys.has(k));
  if (!keys.length) return;

  for (let i = 0; i < SWIM_COUNT; i++) {
    const key = keys[i % keys.length];
    const src = fishModels[key];
    // SkeletonUtils agar Quaternius (armature scale 100) tidak meledak ukurannya
    const fish = cloneSkinned(src);
    const swimLen = 0.5 + Math.random() * 0.35;
    const s = (src.userData.baseScale || 1) * (swimLen / (FISH_MODELS[key]?.len || 1));
    fish.scale.setScalar(s);
    fish.traverse(o => {
      if (!o.isMesh) return;
      const mats = [].concat(o.material).map(mat => {
        const m = mat.clone();
        m.transparent = false;
        m.depthWrite = true;
        if (m.color) m.color.multiplyScalar(0.55);
        return m;
      });
      o.material = mats.length === 1 ? mats[0] : mats;
      o.frustumCulled = false;
    });

    // Jauh dari kapal supaya tidak tembus lambung
    let x = 0;
    let z = 0;
    for (let t = 0; t < 12; t++) {
      x = -10 + Math.random() * 20;
      z = 3 + Math.random() * 12;
      if (Math.hypot(x, z) >= SWIM_MIN_R) break;
    }
    if (Math.hypot(x, z) < SWIM_MIN_R) {
      x = (x || 1) > 0 ? SWIM_MIN_R + 1 : -(SWIM_MIN_R + 1);
    }
    const depth = WATER_SURFACE_Y - 0.7 - Math.random() * 0.5;
    fish.position.set(x, depth, z);
    scene.add(fish);
    swimShadows.push({
      mesh: fish,
      speed: 0.65 + Math.random() * 1.2,
      dir: Math.random() > 0.5 ? 1 : -1,
      offset: Math.random() * 6.28,
      baseY: depth
    });
  }
}

async function mountOcean() {
  try {
    const ocean = (await loadGltf(OCEAN_FILE)).scene;
    // Ocean Poly: XZ ~2000, Y gelombang ~111 → pipihkan & taruh di bawah lambung
    const m0 = measure(ocean);
    const xz = Math.max(m0.size.x, m0.size.z, 1);
    const sXZ = 160 / xz;
    const targetH = 0.06; // tinggi gelombang visual maks
    const sY = targetH / Math.max(m0.size.y, 0.001);
    ocean.scale.set(sXZ, sY, sXZ);

    const m1 = measure(ocean);
    // waterGroup sudah di WATER_SURFACE_Y; lokal: puncak ombak ≈ 0
    ocean.position.set(-m1.center.x, -m1.box.max.y, -m1.center.z);

    ocean.traverse(o => {
      if (!o.isMesh) return;
      const mats = [].concat(o.material).map(mat => {
        const m = mat.clone();
        m.transparent = false;
        m.depthWrite = true;
        m.roughness = 0.32;
        m.metalness = 0.08;
        if (m.color) m.color.setHex(WATERS[state.waterId].waterColor);
        return m;
      });
      o.material = mats.length === 1 ? mats[0] : mats;
      o.renderOrder = -1;
    });

    waterGroup.clear();
    waterGroup.add(ocean);
    oceanMesh = ocean;
    // Plane jadi lapisan dalam (lebih gelap), sedikit lebih dalam
    waterMesh.position.y = WATER_SURFACE_Y - 0.04;
    waterMat.color.setHex(0x0a5570);
  } catch (err) {
    console.warn('Gagal memuat Ocean GLB, pakai plane:', err);
  }
}

async function mountBuoy() {
  const buoy = (await loadGltf(BUOY_FILE)).scene;
  const m = measure(buoy);
  buoy.scale.setScalar(1.5 / m.size.y);
  buoy.position.set(-5, 0.05, 9.5); // di atas garis air
  scene.add(buoy);
}

function placeGroundProp(root, x, z, targetH, yaw = 0) {
  const m0 = measure(root);
  const s = targetH / Math.max(m0.size.y, 0.001);
  root.scale.setScalar(s);
  root.rotation.y = yaw;
  const m1 = measure(root);
  root.position.set(x - m1.center.x, -m1.box.min.y + 0.08, z - m1.center.z);
  root.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
  scene.add(root);
  return root;
}

async function mountPineapple() {
  const pineapple = (await loadGltf(PINEAPPLE_FILE)).scene;
  // Ganti mercusuar: nanas tinggi supaya kebaca dari kapal
  placeGroundProp(pineapple, pineappleIsland.x, pineappleIsland.z, 9.5, 0.4);
}

async function mountKiosk() {
  const kiosk = (await loadGltf(KIOSK_FILE)).scene;
  // Di depan scene (pulau +Z) — cukup besar biar kelihatan dari jauh
  placeGroundProp(kiosk, kioskIsland.x, kioskIsland.z, 7.2, Math.PI + 0.35);
}

async function mountCStore() {
  const logo = (await loadGltf(CSTORE_FILE)).scene;
  const targetH = 5.8;
  const m0 = measure(logo);
  // Orientasi seperti referensi: teks tegak kebaca, hadap kapal (tanpa mirror)
  const s = targetH / Math.max(m0.size.y, 0.001);
  logo.scale.setScalar(s);
  logo.rotation.order = 'YXZ';
  logo.rotation.set(0, Math.PI, 0);
  const m1 = measure(logo);
  logo.position.set(
    cstoreIsland.x - m1.center.x,
    -m1.box.min.y + 0.08,
    cstoreIsland.z - m1.center.z
  );
  logo.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
  scene.add(logo);
}

function tintFish(model, hex) {
  model.traverse(o => {
    if (!o.isMesh) return;
    for (const mat of [].concat(o.material)) {
      if (mat.emissive) {
        mat.emissive.setHex(hex || 0x000000);
        mat.emissiveIntensity = hex ? 0.55 : 0;
      }
    }
  });
}

function showCaughtFish(fish) {
  caughtFishGroup.clear();
  const model = fishModels[fish.glbKey] || fallbackFish;
  const sizeByKg = 0.8 + Math.min(1, Math.log10(fish.kg + 1) / 2) * 0.8;
  model.scale.setScalar((model.userData.baseScale || 1) * sizeByKg);
  tintFish(model, fish.variant === 'Gilded' ? 0xb8860b : fish.variant === 'Albino' ? 0xb4b4b4 : 0x000000);
  caughtFishGroup.add(model);
  caughtFishGroup.visible = true;
}

// Preview 3D kecil di popup tangkapan
const catchPreviewHost = $('catch-preview');
const previewScene = new THREE.Scene();
previewScene.background = new THREE.Color(0x07182c);
const previewCam = new THREE.PerspectiveCamera(35, 1, 0.1, 20);
previewCam.position.set(0, 0.35, 3.2);
previewCam.lookAt(0, 0, 0);
const previewLight = new THREE.HemisphereLight(0xffffff, 0x1e3a5f, 1.5);
const previewSun = new THREE.DirectionalLight(0xfff1c7, 1.6);
previewSun.position.set(2, 4, 3);
previewScene.add(previewLight, previewSun);
const previewPivot = new THREE.Group();
previewScene.add(previewPivot);
const previewRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
previewRenderer.outputColorSpace = THREE.SRGBColorSpace;
catchPreviewHost.appendChild(previewRenderer.domElement);

function resizeCatchPreview() {
  const w = catchPreviewHost.clientWidth || 300;
  const h = catchPreviewHost.clientHeight || 170;
  previewCam.aspect = w / h;
  previewCam.updateProjectionMatrix();
  previewRenderer.setSize(w, h, false);
}

function setCatchPreviewFish(fish) {
  // Pakai model yang sama (tanpa clone) supaya SkinnedMesh / armature tetap utuh
  while (previewPivot.children.length) previewPivot.remove(previewPivot.children[0]);
  caughtFishGroup.clear();
  const model = fishModels[fish.glbKey] || fallbackFish;
  const sizeByKg = 1.15 + Math.min(0.4, Math.log10(fish.kg + 1) / 3);
  model.scale.setScalar((model.userData.baseScale || 1) * sizeByKg);
  tintFish(model, fish.variant === 'Gilded' ? 0xb8860b : fish.variant === 'Albino' ? 0xb4b4b4 : 0x000000);
  previewPivot.add(model);
  previewPivot.rotation.set(0.2, Math.random() * 0.6, 0);
  resizeCatchPreview();
}

// ----- Kamera: First Person + beberapa sudut Third Person -----
const CAM_MODES = [
  { id: 'fp', label: 'First Person', fp: true },
  { id: 'back', label: 'Belakang', yaw: 0.28, pitch: 0.48 },
  { id: 'side', label: 'Samping', yaw: 1.05, pitch: 0.34 },
  { id: 'front', label: 'Depan', yaw: 2.85, pitch: 0.42 },
  { id: 'top', label: 'Atas', yaw: 0.2, pitch: 1.08 }
];
let camPreset = 0; // default: First Person
let lookYaw = 0;   // geser kamera FP (rad)
let lookPitch = 0;
const lookTarget = new THREE.Vector3();
const eyeWorld = new THREE.Vector3();
const focusPts = Array.from({ length: 11 }, () => new THREE.Vector3());
const camTarget = new THREE.Vector3();
const camDir = new THREE.Vector3();
const _v = new THREE.Vector3();
const _focusBox = new THREE.Box3();

function currentCam() {
  return CAM_MODES[camPreset] || CAM_MODES[0];
}

function isFirstPerson() {
  return !!currentCam().fp;
}

function applyCameraMode() {
  const fp = isFirstPerson();
  if (mechRoot) mechRoot.visible = !fp; // sembunyikan badan di FP supaya tidak menembus kamera

  if (fp) {
    // Joran kecil di kanan-bawah pandangan (seperti FPS), tidak menutupi layar
    rodPivot.position.set(0.18, 0.92, 0.35);
    if (rodHolder) {
      rodHolder.scale.setScalar(rodBaseScale * ROD_FP_SCALE);
      rodHolder.rotation.set(-0.55, 0.08, Math.PI / 2);
    }
  } else {
    if (mechRoot) {
      const m = measure(mechRoot);
      rodPivot.position.set(m.size.x * 0.22, MECH_HEIGHT * 0.62, m.size.z * 0.12);
    }
    if (rodHolder) {
      rodHolder.scale.setScalar(rodBaseScale);
      rodHolder.rotation.set(-0.75, 0, Math.PI / 2);
    }
  }
  updateCameraLayout();
}

function updateFocusPoints() {
  let i = 0;
  for (const x of [boatBox.min.x, boatBox.max.x]) {
    for (const y of [0, boatBox.max.y]) {
      for (const z of [boatBox.min.z, boatBox.max.z]) focusPts[i++].set(x, y, z);
    }
  }
  const ax = anglerGroup.position.x;
  focusPts[i++].set(ax, anglerGroup.position.y + 3.2, 1.6);
  focusPts[i++].set(ax - 1.7, 0, castFar + 0.8);
  focusPts[i++].set(ax + 1.7, 0, castFar + 0.8);
}

function projectFocus(d, w, h) {
  camera.position.copy(camTarget).addScaledVector(camDir, d);
  camera.lookAt(camTarget);
  camera.updateMatrixWorld();
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of focusPts) {
    _v.copy(p).applyMatrix4(camera.matrixWorldInverse);
    if (_v.z > -camera.near) return null;
    _v.applyMatrix4(camera.projectionMatrix);
    const sx = (_v.x * 0.5 + 0.5) * w;
    const sy = (0.5 - _v.y * 0.5) * h;
    minX = Math.min(minX, sx); maxX = Math.max(maxX, sx);
    minY = Math.min(minY, sy); maxY = Math.max(maxY, sy);
  }
  return { w: maxX - minX, h: maxY - minY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}

function updateFirstPersonCamera() {
  const w = wrap.clientWidth;
  const h = wrap.clientHeight;
  if (!w || !h) return;

  camera.fov = h >= w ? 70 : 62;
  camera.aspect = w / h;
  camera.near = 0.08;
  camera.clearViewOffset();
  camera.updateProjectionMatrix();

  // Mata di atas bahu pemancing (dunia)
  anglerGroup.getWorldPosition(eyeWorld);
  eyeWorld.y += 1.18;
  eyeWorld.z += 0.12;
  eyeWorld.x += 0.05;

  // Arah pandang default: ke area pancing (+Z lokal kapal), bisa digeser
  const baseYaw = lookYaw;
  const basePitch = -0.12 + lookPitch;
  lookTarget.set(
    eyeWorld.x + Math.sin(baseYaw) * 8,
    eyeWorld.y + Math.sin(basePitch) * 6 - 0.4,
    eyeWorld.z + Math.cos(baseYaw) * 8
  );

  // Saat mancing, sedikit mengunci ke pelampung / ikan
  if (bobberGroup.visible || (caughtFishGroup.visible && fishState === 'JUMP')) {
    const aim = caughtFishGroup.visible && fishState === 'JUMP' ? caughtFishGroup.position : bobberGroup.position;
    lookTarget.lerp(aim, 0.55);
    lookTarget.y += 0.15;
  }

  camera.position.copy(eyeWorld);
  camera.lookAt(lookTarget);

  scene.fog.near = 12;
  scene.fog.far = 70;
}

function updateThirdPersonCamera() {
  const w = wrap.clientWidth;
  const h = wrap.clientHeight;
  if (!w || !h) return;

  const portrait = h >= w;
  const preset = currentCam();
  camera.fov = portrait ? 56 : 42;
  camera.near = 0.5;
  camera.aspect = w / h;
  camera.clearViewOffset();
  camera.updateProjectionMatrix();

  updateFocusPoints();
  _focusBox.setFromPoints(focusPts).getCenter(camTarget);
  camDir.set(
    Math.sin(preset.yaw) * Math.cos(preset.pitch),
    Math.sin(preset.pitch),
    -Math.cos(preset.yaw) * Math.cos(preset.pitch)
  );

  const zone = playZone.getBoundingClientRect();
  const freeW = Math.max(60, zone.width - 16);
  const freeH = Math.max(60, zone.height - 40);
  const freeCx = zone.left + zone.width / 2;
  const freeCy = zone.top + 32 + freeH / 2;

  let lo = 2;
  let hi = 150;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    const midR = projectFocus(mid, w, h);
    if (midR && midR.w <= freeW && midR.h <= freeH) hi = mid;
    else lo = mid;
  }
  const r = projectFocus(hi, w, h);
  if (r) camera.setViewOffset(w, h, r.cx - freeCx, r.cy - freeCy, w, h);
  else camera.clearViewOffset();

  scene.fog.near = hi + 12;
  scene.fog.far = hi + 75;
}

function updateCameraLayout() {
  const w = wrap.clientWidth;
  const h = wrap.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h);
  if (isFirstPerson()) updateFirstPersonCamera();
  else updateThirdPersonCamera();
}

let camResizeTimer = 0;
function scheduleCameraLayout() {
  clearTimeout(camResizeTimer);
  camResizeTimer = setTimeout(updateCameraLayout, 80);
}

window.addEventListener('resize', scheduleCameraLayout);
window.addEventListener('orientationchange', () => {
  // iOS butuh jeda setelah rotasi supaya getBoundingClientRect sudah benar
  setTimeout(updateCameraLayout, 120);
  setTimeout(updateCameraLayout, 420);
});
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', scheduleCameraLayout);
}
new ResizeObserver(scheduleCameraLayout).observe(playZone);

// ============================================================================
// 7. STATE MACHINE MEMANCING: IDLE -> CAST -> WAITING -> BITE -> REELING -> JUMP
// ============================================================================
const CAST_TIME = 0.55;
const BITE_WINDOW = IS_TOUCH ? 2.4 : 2.0;
const REEL_START = 18; // mulai lebih rendah = lebih lama & riskan

let fishState = 'IDLE';
let stateTimer = 0;
let castIsAuto = false;
let activeFish = null;
let isHoldingReel = false;
let tension = 0; // 0..100
let reelProgress = 0; // 0..100
let sweetMin = 0;
let sweetMax = 0;
let sweetWidth = 28;
let sweetCenter = 50;
let zoneDriftDir = 1;
let zoneDriftSpeed = 12;
let yankTimer = 0;
let jumpProgress = 0;
const castFrom = new THREE.Vector3();
const castTarget = new THREE.Vector3();
const jumpFrom = new THREE.Vector3();
const jumpTo = new THREE.Vector3();

function pickWeighted(pool) {
  let rnd = Math.random() * pool.reduce((sum, item) => sum + item.w, 0);
  for (const item of pool) {
    if (rnd < item.w) return item.fish;
    rnd -= item.w;
  }
  return pool[0].fish;
}

function rollFish(isAutoCast) {
  const waterFishes = WATERS[state.waterId].fishes;
  const junkPool = waterFishes.filter(f => f.junk).map(f => ({ fish: f, w: 1 }));
  // Sampah lebih sering; Legendary/Mythic tetap manual-only
  let chosen;
  if (junkPool.length && Math.random() < JUNK_CHANCE) {
    chosen = pickWeighted(junkPool);
  } else {
    const maxKg = getMaxWeightCapacity();
    const eligible = waterFishes.filter(f => !f.junk && !(isAutoCast && RARITIES[f.rarity].manualOnly));
    const pool = eligible.map(f => ({
      fish: f,
      w: RARITIES[f.rarity].weight * (f.baseKg > maxKg * 1.6 ? 0.25 : 1)
    }));
    chosen = pickWeighted(pool);
  }

  const kg = +(chosen.baseKg * (0.75 + Math.random() * 0.75 + state.rodLvl * 0.04)).toFixed(2);
  if (chosen.junk) {
    return { ...chosen, kg, coins: 0, variant: null, isTrophy: false, rarityObj: RARITIES[RARITY_JUNK] };
  }

  // Varian langka: Albino 2% (x5, manual saja), Gilded 5% (x3)
  const vRoll = Math.random();
  const variant = !isAutoCast && vRoll < 0.02 ? 'Albino' : vRoll < 0.07 ? 'Gilded' : null;
  const variantMult = variant === 'Albino' ? 5 : variant === 'Gilded' ? 3 : 1;
  const isTrophy = chosen.id === state.trophyTargetId;
  const coins = Math.max(1, Math.round(
    chosen.baseCoin * (kg / chosen.baseKg) * getCatchValueMultiplier() * variantMult * (isTrophy ? 2.5 : 1)
  ));
  return { ...chosen, kg, coins, variant, isTrophy, rarityObj: RARITIES[chosen.rarity] };
}

function startCast(isAuto) {
  if (fishState !== 'IDLE' || pendingCatchFish) return;
  castIsAuto = isAuto;
  fishState = 'CAST';
  stateTimer = 0;
  castTarget.set(anglerGroup.position.x + (Math.random() - 0.5) * 2.4, 0.05, castNear + Math.random() * (castFar - castNear));
  rodTipMarker.getWorldPosition(castFrom);
  bobberGroup.position.copy(castFrom);
  bobberGroup.visible = true;
  fishingLine.visible = true;
  playTone(320, 0.14, 'triangle', 180);
  vibrate(15);
  updateActionUI();
}

function landBobber() {
  fishState = 'WAITING';
  stateTimer = getBiteWaitSeconds() * (0.7 + Math.random() * 0.6);
  rippleMesh.position.set(castTarget.x, 0.1, castTarget.z);
  rippleMesh.scale.setScalar(0.5);
  rippleMat.opacity = 0.85;
  playTone(190, 0.08, 'sine', -70);
  updateActionUI();
}

function triggerBite() {
  fishState = 'BITE';
  stateTimer = BITE_WINDOW;
  activeFish = rollFish(castIsAuto);
  playTone(580, 0.16, 'square', 220);
  vibrate([30, 40, 30]);
  updateActionUI();
}

function startReeling() {
  fishState = 'REELING';
  isHoldingReel = true; // jari masih menempel dari ketukan "sentak"
  tension = 40;
  reelProgress = REEL_START;
  // Zona hijau sempit + bergerak; ikan langka = lebih susah (sampah = mudah)
  const r = activeFish.junk ? 0 : activeFish.rarity;
  sweetWidth = Math.max(14, 30 - r * 3.2 - (IS_TOUCH ? 0 : 2));
  sweetCenter = 42 + Math.random() * 16;
  sweetMin = sweetCenter - sweetWidth / 2;
  sweetMax = sweetCenter + sweetWidth / 2;
  zoneDriftDir = Math.random() > 0.5 ? 1 : -1;
  zoneDriftSpeed = 10 + r * 3.5 + Math.random() * 4;
  yankTimer = 0.8 + Math.random() * 0.8;
  sweetZoneEl.style.left = `${sweetMin}%`;
  sweetZoneEl.style.width = `${sweetWidth}%`;
  fightWeightEl.textContent = '';
  tensionHintEl.textContent = 'TARIKKK MANNGGG';
  tensionBox.classList.add('show');
  tensionBox.classList.remove('danger');
  playTone(440, 0.1, 'sine', 120);
  updateActionUI();
}

function completeCatch(fish) {
  fishState = 'JUMP';
  jumpProgress = 0;
  isHoldingReel = false;
  tensionBox.classList.remove('show');

  jumpFrom.copy(bobberGroup.position);
  anglerGroup.getWorldPosition(jumpTo);
  jumpTo.y += 0.9;
  jumpTo.z += 0.7;
  showCaughtFish(fish);

  state.coins += fish.coins; // sampah = 0
  const prev = state.book[fish.id] || { count: 0, maxKg: 0, gilded: false, albino: false };
  state.book[fish.id] = {
    count: prev.count + 1,
    maxKg: Math.max(prev.maxKg, fish.kg),
    gilded: prev.gilded || fish.variant === 'Gilded',
    albino: prev.albino || fish.variant === 'Albino'
  };
  if (fish.isTrophy && REAL_FISH.length) {
    state.trophyTargetId = REAL_FISH[Math.floor(Math.random() * REAL_FISH.length)].id;
  }

  saveState();
  playTone(520, 0.12, 'triangle', 260);
  setTimeout(() => playTone(780, 0.22, 'triangle', 180), 110);
  vibrate(45);
  updateHUD();
  updateUpgrades();
  renderFishBook();
  updateActionUI();
  // Popup muncul setelah animasi lompat selesai (lihat JUMP)
  pendingCatchFish = fish;
}

function loseFish(reason) {
  fishState = 'IDLE';
  stateTimer = 1; // jeda sebelum lemparan auto berikutnya
  isHoldingReel = false;
  bobberGroup.visible = false;
  fishingLine.visible = false;
  tensionBox.classList.remove('show');
  tensionBox.classList.remove('danger');
  playTone(210, 0.25, 'sawtooth', -90);
  updateActionUI();
  statusHint.textContent = reason;
}

function openCatchModal(fish) {
  const tag = $('catch-rarity');
  tag.textContent = fish.junk ? 'Zonk' : ((fish.variant ? `${fish.variant} ` : '') + fish.rarityObj.id);
  tag.style.background = fish.rarityObj.bg;
  tag.style.color = fish.rarityObj.color;
  $('catch-name').textContent = fish.name;
  $('catch-meta').textContent = fish.junk
    ? 'Sampah · +0 koin'
    : `${fish.kg} kg · +${formatNum(fish.coins)} koin`;
  const bonusBits = [];
  if (fish.junk) bonusBits.push('Sayang, bukan ikan');
  if (fish.isTrophy) bonusBits.push('Bonus Trofi x2.5');
  if (fish.variant === 'Gilded') bonusBits.push('Varian Gilded x3');
  if (fish.variant === 'Albino') bonusBits.push('Varian Albino x5');
  $('catch-bonus').textContent = bonusBits.join(' · ');
  setCatchPreviewFish(fish);
  catchModal.classList.add('show');
}

function closeCatchModal() {
  catchModal.classList.remove('show');
  pendingCatchFish = null;
  while (previewPivot.children.length) previewPivot.remove(previewPivot.children[0]);
  fishState = 'IDLE';
  stateTimer = 0.55;
  updateActionUI();
}

$('catch-claim-btn').addEventListener('click', () => {
  playTone(680, 0.14, 'triangle', 180);
  vibrate(18);
  closeCatchModal();
});
catchModal.addEventListener('click', e => {
  if (e.target === catchModal) closeCatchModal();
});

function setShopOpen(open) {
  document.body.classList.toggle('shop-open', !!open);
  const btn = $('menu-btn');
  if (btn) btn.setAttribute('aria-pressed', open ? 'true' : 'false');
  const scrim = $('shop-scrim');
  if (scrim) {
    scrim.hidden = !open;
    scrim.setAttribute('aria-hidden', open ? 'false' : 'true');
  }
}
$('menu-btn').addEventListener('click', e => {
  e.stopPropagation();
  unlockAudio();
  setShopOpen(!document.body.classList.contains('shop-open'));
  playTone(360, 0.08, 'triangle', 200);
});
$('shop-scrim').addEventListener('pointerdown', e => {
  e.preventDefault();
  e.stopPropagation();
  setShopOpen(false);
});
// Jangan biarkan klik di panel menutup shop / tembus ke cast
$('bottom-panel').addEventListener('pointerdown', e => e.stopPropagation());
$('bottom-panel').addEventListener('click', e => e.stopPropagation());

// ============================================================================
// 8. INPUT: tombol, ketuk layar (kanvas), dan Spasi
// ============================================================================
const ACTION_UI = {
  IDLE: ['', 'LEMPAR KAIL', ''],
  CAST: ['state-waiting', 'MELEMPAR…', 'Kail dilempar…'],
  WAITING: ['state-waiting', 'MENUNGGU…', 'Tunggu sampai pelampung disambar'],
  BITE: ['state-bite', 'SENTAK!', 'Ada yang nyambar! Ketuk sekarang!'],
  REELING: ['state-reeling', 'TARIKKK MANNGGG', 'Tahan untuk menarik, lepas untuk mengulur'],
  JUMP: ['', 'DAPAT!', 'Tangkapan naik ke kapal!'],
  SHOWCASE: ['', 'DAPAT!', 'Lihat hasil tangkapanmu']
};

function updateActionUI() {
  const [cls, label, hint] = ACTION_UI[fishState];
  castBtn.className = `interactive ${cls}`;
  castBtn.textContent = label;
  statusHint.textContent = hint || (autoOn()
    ? 'Auto-pancing aktif · ketuk untuk lempar manual'
    : 'Ketuk tombol atau layar untuk melempar kail');
}

function onPrimaryDown(e) {
  if (e) {
    e.preventDefault();
    unlockAudio();
    // Capture supaya jari bisa geser keluar tombol tanpa putus "tahan tarik" di HP
    if (e.pointerId != null && e.currentTarget?.setPointerCapture) {
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    }
  }
  if (catchModal.classList.contains('show') || fishState === 'SHOWCASE') return;
  if (fishState === 'IDLE') startCast(false);
  else if (fishState === 'BITE') startReeling();
  else if (fishState === 'REELING') isHoldingReel = true;
  // Ketukan saat CAST/WAITING/JUMP sengaja diabaikan
}

function onPrimaryUp() {
  isHoldingReel = false;
}

castBtn.addEventListener('pointerdown', onPrimaryDown);
window.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('touchstart', unlockAudio, { once: true, passive: true });
document.addEventListener('pointerdown', unlockAudio, { once: true });

window.addEventListener('keydown', e => {
  if (e.code === 'Space' && !e.repeat && !e.target.closest('#bottom-panel')) onPrimaryDown(e);
});
window.addEventListener('keyup', e => {
  if (e.code === 'Space') onPrimaryUp();
});

// Kanvas: FP = seret lihat sekitar / ketuk singkat = aksi; TP = ketuk langsung aksi
let fpDrag = null;
renderer.domElement.addEventListener('pointerdown', e => {
  e.preventDefault();
  unlockAudio();
  if (catchModal.classList.contains('show') || fishState === 'SHOWCASE') return;

  if (isFirstPerson()) {
    fpDrag = { x: e.clientX, y: e.clientY, yaw: lookYaw, pitch: lookPitch, moved: false };
    try { renderer.domElement.setPointerCapture(e.pointerId); } catch {}
    if (fishState === 'BITE') startReeling();
    else if (fishState === 'REELING') isHoldingReel = true;
    return;
  }

  onPrimaryDown(e);
});

renderer.domElement.addEventListener('pointermove', e => {
  if (!fpDrag || !isFirstPerson()) return;
  const dx = e.clientX - fpDrag.x;
  const dy = e.clientY - fpDrag.y;
  if (Math.abs(dx) + Math.abs(dy) > 10) fpDrag.moved = true;
  if (!fpDrag.moved) return;
  lookYaw = THREE.MathUtils.clamp(fpDrag.yaw - dx * 0.0045, -1.15, 1.15);
  lookPitch = THREE.MathUtils.clamp(fpDrag.pitch - dy * 0.0035, -0.55, 0.45);
});

function endPointer() {
  if (fpDrag && isFirstPerson() && !fpDrag.moved && fishState === 'IDLE') startCast(false);
  fpDrag = null;
  onPrimaryUp();
}
window.addEventListener('pointerup', endPointer);
window.addEventListener('pointercancel', endPointer);
window.addEventListener('lostpointercapture', endPointer);

// ============================================================================
// 9. PANEL UI
// ============================================================================
function updateHUD() {
  $('coins-txt').textContent = formatNum(state.coins);
  $('mult-txt').textContent = `Nilai x${getCatchValueMultiplier()}`;
  $('trophy-chip').textContent = `Trofi: ${FISH_BY_ID[state.trophyTargetId].name} · koin x2.5`;

  const unlocked = state.anglerLvl >= AUTO_UNLOCK_LVL;
  autoBtn.classList.toggle('active', autoOn());
  autoBtn.setAttribute('aria-pressed', autoOn());
  $('auto-dot').style.background = !unlocked ? '#64748b' : state.autoEnabled ? '#10b981' : '#f59e0b';
  $('auto-label').textContent = !unlocked ? 'AUTO' : state.autoEnabled ? 'AUTO ON' : 'AUTO OFF';
}

// Tombol upgrade dibuat sekali, lalu hanya teksnya yang diperbarui
const UPGRADES = [
  {
    title: 'Joran',
    lvl: () => state.rodLvl,
    cost: getRodCost,
    desc: () => `Kuat ${getMaxWeightCapacity()} kg`,
    buy: () => { state.rodLvl++; }
  },
  {
    title: 'Mech',
    lvl: () => state.anglerLvl,
    cost: getAnglerCost,
    desc: () => `Gigit ${getBiteWaitSeconds().toFixed(1)} dtk${state.anglerLvl < AUTO_UNLOCK_LVL ? ` · Auto Lv.${AUTO_UNLOCK_LVL}` : ''}`,
    buy: () => {
      state.anglerLvl++;
      if (state.anglerLvl === AUTO_UNLOCK_LVL) state.autoEnabled = true;
    }
  },
  {
    title: 'Kapal',
    lvl: () => state.boatLvl,
    cost: getBoatCost,
    desc: () => `Nilai ikan +${Math.round((state.boatLvl - 1) * 38)}%`,
    buy: () => {
      state.boatLvl++;
      state.boatSkin = boatTier(state.boatLvl); // otomatis pakai kapal baru
    }
  }
];

const upgradeEls = UPGRADES.map(u => {
  const btn = document.createElement('button');
  btn.className = 'upg-btn';
  btn.innerHTML = `<span class="upg-title">${u.title} <span class="lvl-badge"></span></span><span class="upg-desc"></span><span class="upg-cost"></span>`;
  btn.addEventListener('click', () => {
    const cost = u.cost();
    if (state.coins < cost) return;
    state.coins -= cost;
    u.buy();
    playTone(640, 0.1, 'triangle', 160);
    vibrate(12);
    saveState();
    refreshAllPanels();
    mountBoat().catch(err => console.warn('Gagal memuat kapal:', err));
  });
  $('tab-upgrades').appendChild(btn);
  return { u, btn, lvl: btn.querySelector('.lvl-badge'), desc: btn.querySelector('.upg-desc'), cost: btn.querySelector('.upg-cost') };
});

function updateUpgrades() {
  for (const el of upgradeEls) {
    const cost = el.u.cost();
    el.lvl.textContent = `Lv.${el.u.lvl()}`;
    el.desc.textContent = el.u.desc();
    el.cost.textContent = formatNum(cost);
    el.btn.disabled = state.coins < cost;
  }
}

function renderBoats() {
  const unlocked = boatTier(state.boatLvl);
  const active = currentBoatSkin();
  $('tab-boats').innerHTML = BOATS.map((b, i) => {
    const locked = i > unlocked;
    const using = i === active;
    const action = locked
      ? `<span class="lvl-badge">TERKUNCI</span>`
      : using
        ? `<span class="lvl-badge">DIPAKAI</span>`
        : `<button class="buy-btn boat-pick" data-boat="${i}">PAKAI</button>`;
    return `
    <div class="row-card ${using ? 'current' : locked ? 'locked' : ''}">
      <div>
        <div class="upg-title">${b.name}</div>
        <div class="upg-desc">Unlock Kapal Lv.${b.fromLvl}</div>
      </div>
      ${action}
    </div>`;
  }).join('');

  $('tab-boats').querySelectorAll('.boat-pick').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const i = +btn.dataset.boat;
      if (i > boatTier(state.boatLvl) || i === currentBoatSkin()) return;
      state.boatSkin = i;
      saveState();
      playTone(420, 0.09, 'triangle', 180);
      vibrate(10);
      renderBoats();
      mountBoat().catch(err => console.warn('Gagal ganti kapal:', err));
    });
  });
}

function renderFishBook() {
  $('book-tab-btn').textContent = `IKAN ${Object.keys(state.book).length}/${ALL_FISH.length}`;
  $('book-grid').innerHTML = ALL_FISH.map(f => {
    const entry = state.book[f.id];
    const r = RARITIES[f.rarity];
    const tagLabel = f.junk ? 'Zonk' : r.id;
    const tag = `<span class="rarity-tag" style="background:${r.bg};color:${r.color};">${tagLabel}</span>`;
    if (!entry) return `<div class="fish-card locked">${tag}<b class="name">???</b><span>Belum tertangkap</span></div>`;
    if (f.junk) return `<div class="fish-card">${tag}<b class="name">${f.name}</b><span>Sampah · ${entry.count}x · 0 koin</span></div>`;
    const variants = [entry.gilded && 'Gilded', entry.albino && 'Albino'].filter(Boolean).join(' · ');
    return `<div class="fish-card">${tag}<b class="name">${f.name}</b><span>Rekor ${entry.maxKg} kg · ${entry.count}x</span>${variants ? `<span style="color:#fcd34d;">${variants}</span>` : ''}</div>`;
  }).join('');
}

$('tab-voyage').innerHTML = `
  <div class="row-card">
    <div>
      <div class="upg-title">Pelayaran Baru <span class="lvl-badge" id="voyage-no"></span></div>
      <div class="upg-desc" id="voyage-desc"></div>
    </div>
    <button class="buy-btn" id="voyage-btn"></button>
  </div>`;

const nextVoyageBonus = () => +(state.voyageBonus + 0.5).toFixed(1);

function updateVoyage() {
  const can = state.boatLvl >= VOYAGE_BOAT_LVL;
  $('voyage-no').textContent = `#${state.voyages + 1}`;
  $('voyage-desc').textContent = `Ulang dari awal dengan bonus koin permanen x${nextVoyageBonus()} (sekarang x${state.voyageBonus}). Buku ikan tetap tersimpan.`;
  $('voyage-btn').textContent = can ? 'BERLAYAR' : `Kapal Lv.${VOYAGE_BOAT_LVL}`;
  $('voyage-btn').disabled = !can;
}

function doVoyage() {
  Object.assign(state, {
    coins: 0, rodLvl: 1, anglerLvl: 1, boatLvl: 1, boatSkin: 0,
    voyages: state.voyages + 1, voyageBonus: nextVoyageBonus()
  });
  playTone(520, 0.25, 'triangle', 320);
  saveState();
  refreshAllPanels();
  updateActionUI();
  mountBoat().catch(err => console.warn('Gagal memuat kapal:', err));
}

$('voyage-btn').addEventListener('click', () => {
  if (state.boatLvl < VOYAGE_BOAT_LVL) return;
  // Modal in-game (bukan confirm browser) supaya nyaman di HP & PWA
  $('modal-tag').textContent = 'Pelayaran baru';
  $('offline-desc').textContent =
    `Mulai pelayaran baru? Koin & level kembali ke awal. Buku ikan tetap. Bonus jadi x${nextVoyageBonus()}.`;
  $('offline-coins').textContent = 'KONFIRMASI';
  $('claim-offline-btn').textContent = 'YA, BERLAYAR';
  $('modal-backdrop').dataset.mode = 'voyage';
  $('modal-backdrop').classList.add('show');
});

function refreshAllPanels() {
  updateHUD();
  updateUpgrades();
  renderBoats();
  renderFishBook();
  updateVoyage();
}

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    const target = btn.dataset.tab;
    if (!target || !$(target)) return;
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    btn.classList.add('active');
    $(target).classList.add('active');
  });
});

autoBtn.addEventListener('click', () => {
  if (state.anglerLvl < AUTO_UNLOCK_LVL) {
    statusHint.textContent = `Auto-pancing terbuka di Mech Lv.${AUTO_UNLOCK_LVL}`;
    return;
  }
  state.autoEnabled = !state.autoEnabled;
  saveState();
  updateHUD();
  updateActionUI();
});

function refreshCamButton() {
  const mode = currentCam();
  $('cam-btn').title = `Kamera: ${mode.label} (ketuk untuk ganti)`;
  const label = $('cam-label');
  if (label) label.textContent = mode.fp ? 'FP' : mode.id === 'back' ? '3P' : mode.id === 'side' ? 'SIDE' : mode.id === 'front' ? 'DEPAN' : 'ATAS';
}

$('cam-btn').addEventListener('click', () => {
  camPreset = (camPreset + 1) % CAM_MODES.length;
  lookYaw = 0;
  lookPitch = 0;
  applyCameraMode();
  refreshCamButton();
  statusHint.textContent = `Kamera: ${currentCam().label}${currentCam().fp ? ' · seret layar untuk lihat sekitar' : ''}`;
});


// Layar penuh hanya ditampilkan jika browser mendukung (iPhone Safari tidak)
if (document.documentElement.requestFullscreen) {
  $('full-btn').hidden = false;
  $('full-btn').addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  });
}

// ============================================================================
// 10. PENGHASILAN SAAT PERGI (maks 4 jam, perlu auto-pancing terbuka)
// ============================================================================
function checkOfflineEarnings() {
  const elapsedSec = (Date.now() - state.lastSaveTime) / 1000;
  if (state.anglerLvl < AUTO_UNLOCK_LVL || elapsedSec < 45) return;

  const cappedSec = Math.min(elapsedSec, 4 * 3600);
  const catches = Math.max(1, Math.floor((cappedSec / (getBiteWaitSeconds() + 2.5)) * 0.65));
  const avgCoin = REAL_FISH[0]?.baseCoin || 14;
  const earned = Math.round(catches * avgCoin * 1.4 * getCatchValueMultiplier());

  state.coins += earned; // langsung masuk: tidak hilang kalau popup tertutup
  saveState();
  refreshAllPanels();
  $('modal-tag').textContent = 'Hasil selama pergi';
  $('offline-desc').textContent = `Selama ${Math.round(cappedSec / 60)} menit pergi, mech-mu menangkap sekitar ${catches} ikan.`;
  $('offline-coins').textContent = `+${formatNum(earned)} koin`;
  $('claim-offline-btn').textContent = 'OKE';
  $('modal-backdrop').dataset.mode = 'offline';
  $('modal-backdrop').classList.add('show');
}

function closeModal() {
  $('modal-backdrop').classList.remove('show');
  $('modal-backdrop').dataset.mode = '';
  $('claim-offline-btn').textContent = 'OKE';
  $('modal-tag').textContent = 'Hasil selama pergi';
}

$('claim-offline-btn').addEventListener('click', () => {
  const mode = $('modal-backdrop').dataset.mode;
  closeModal();
  if (mode === 'voyage') {
    doVoyage();
    return;
  }
  playTone(680, 0.18, 'triangle', 220);
});

$('modal-cancel').addEventListener('click', closeModal);

// Ketuk luar kartu = tutup (batal voyage, atau tutup hasil offline)
$('modal-backdrop').addEventListener('click', e => {
  if (e.target === $('modal-backdrop')) closeModal();
});

// Di HP, pindah aplikasi = tab tersembunyi: simpan saat pergi, hitung hasil saat kembali
document.addEventListener('visibilitychange', () => {
  if (document.hidden) saveState();
  else checkOfflineEarnings();
});

// ============================================================================
// 11. GAME LOOP
// ============================================================================
const clock = new THREE.Clock();
const rodTipWorld = new THREE.Vector3();
let perfFrames = 0;
let perfTime = 0;

function updateFishingLine(target, sag) {
  rodTipMarker.getWorldPosition(rodTipWorld);
  const pos = lineGeo.attributes.position;
  for (let i = 0; i < LINE_POINTS; i++) {
    const t = i / (LINE_POINTS - 1);
    pos.setXYZ(
      i,
      THREE.MathUtils.lerp(rodTipWorld.x, target.x, t),
      THREE.MathUtils.lerp(rodTipWorld.y, target.y, t) - Math.sin(t * Math.PI) * sag,
      THREE.MathUtils.lerp(rodTipWorld.z, target.z, t)
    );
  }
  pos.needsUpdate = true;
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);
  const elapsed = clock.elapsedTime;

  // ponytail: resolusi render diturunkan kalau rata-rata di bawah ~40 fps; tidak pernah dinaikkan lagi
  if (assetsReady && pixelRatio > 1) {
    perfTime += dt;
    if (++perfFrames === 90) {
      if (perfTime / 90 > 0.024) {
        pixelRatio = Math.max(1, +(pixelRatio - 0.25).toFixed(2));
        renderer.setPixelRatio(pixelRatio);
      }
      perfFrames = 0;
      perfTime = 0;
    }
  }

  if (mechMixer) mechMixer.update(dt);

  // Gelombang lembut di plane cadangan (Ocean GLB sudah punya relief sendiri)
  waterFrame++;
  if (!oceanMesh && (!IS_TOUCH || waterFrame % 2 === 0)) {
    for (let i = 0; i < waterPos.count; i++) {
      const wave = Math.sin(waterPos.getX(i) * 0.18 + elapsed * 1.6) * WAVE_AMP
        + Math.cos(waterPos.getZ(i) * 0.2 + elapsed * 1.3) * (WAVE_AMP * 0.85);
      waterPos.setY(i, waterBaseY[i] + wave);
    }
    waterPos.needsUpdate = true;
  }
  if (oceanMesh) {
    // Goyangan sangat kecil — jangan sampai puncak ombak masuk lambung
    waterGroup.position.y = WATER_SURFACE_Y + Math.sin(elapsed * 1.1) * 0.012;
  }

  // Kapal mengambang di atas permukaan air
  boatGroup.position.y = 0.02 + Math.sin(elapsed * 1.55) * 0.015;
  boatGroup.rotation.x = Math.sin(elapsed * 1.2) * 0.01;
  boatGroup.rotation.z = Math.cos(elapsed * 1.35) * 0.008;

  // FP mengikuti goyangan kapal tiap frame; TP cukup saat resize
  if (isFirstPerson()) updateFirstPersonCamera();

  for (const c of clouds) {
    c.position.x += dt * 0.5;
    if (c.position.x > 50) c.position.x = -50;
  }

  for (const s of swimShadows) {
    s.mesh.position.x += s.speed * s.dir * dt;
    s.mesh.position.z += Math.sin(elapsed * 1.6 + s.offset) * 0.55 * dt;
    // Tolak dari kapal kalau mendekat
    const r = Math.hypot(s.mesh.position.x, s.mesh.position.z);
    if (r < SWIM_MIN_R && r > 0.01) {
      s.mesh.position.x *= SWIM_MIN_R / r;
      s.mesh.position.z *= SWIM_MIN_R / r;
      s.dir *= -1;
    }
    s.mesh.position.y = s.baseY + Math.sin(elapsed * 2.2 + s.offset) * 0.08;
    s.mesh.rotation.y = s.dir > 0 ? 0 : Math.PI;
    s.mesh.rotation.z = Math.sin(elapsed * 5 + s.offset) * 0.1;
    if (Math.abs(s.mesh.position.x) > 12) s.dir *= -1;
  }

  if (rippleMat.opacity > 0) {
    rippleMesh.scale.addScalar(dt * 2.4);
    rippleMat.opacity = Math.max(0, rippleMat.opacity - dt * 0.9);
  }

  if (catchModal.classList.contains('show')) {
    previewPivot.rotation.y += dt * 1.15;
    previewRenderer.render(previewScene, previewCam);
  }

  if (fishState === 'IDLE') {
    rodPivot.rotation.x = THREE.MathUtils.lerp(rodPivot.rotation.x, 0, dt * 6);
    if (autoOn() && !pendingCatchFish) {
      stateTimer -= dt;
      if (stateTimer <= 0) startCast(true);
    }
  } else if (fishState === 'CAST') {
    stateTimer += dt;
    const t = Math.min(1, stateTimer / CAST_TIME);
    rodPivot.rotation.x = THREE.MathUtils.lerp(-0.7, 0.15, Math.min(1, t * 2.2)); // ayunan joran
    bobberGroup.position.lerpVectors(castFrom, castTarget, t);
    bobberGroup.position.y += Math.sin(t * Math.PI) * 2.2;
    updateFishingLine(bobberGroup.position, 0.15);
    if (t >= 1) landBobber();
  } else if (fishState === 'WAITING') {
    rodPivot.rotation.x = THREE.MathUtils.lerp(rodPivot.rotation.x, 0, dt * 6);
    bobberGroup.position.y = 0.05 + Math.sin(elapsed * 3.5) * 0.06;
    updateFishingLine(bobberGroup.position, 0.7);
    stateTimer -= dt;
    if (stateTimer <= 0) triggerBite();
  } else if (fishState === 'BITE') {
    bobberGroup.position.y = -0.2 + Math.sin(elapsed * 22) * 0.14;
    rodPivot.rotation.x = 0.2 + Math.sin(elapsed * 18) * 0.07;
    updateFishingLine(bobberGroup.position, 0.15);
    stateTimer -= dt;
    if (castIsAuto && stateTimer <= BITE_WINDOW - 0.3) completeCatch(activeFish);
    else if (stateTimer <= 0) loseFish('Terlambat! Ikan kabur membawa umpan');
  } else if (fishState === 'REELING') {
    const r = activeFish.junk ? 0 : activeFish.rarity;
    // Zona hijau bergeser terus (ikan berontak)
    sweetCenter += zoneDriftDir * zoneDriftSpeed * dt;
    if (sweetCenter - sweetWidth / 2 < 8) {
      sweetCenter = 8 + sweetWidth / 2;
      zoneDriftDir = 1;
    } else if (sweetCenter + sweetWidth / 2 > 92) {
      sweetCenter = 92 - sweetWidth / 2;
      zoneDriftDir = -1;
    }
    // Kadang balik arah mendadak
    if (Math.random() < 0.012 + r * 0.004) zoneDriftDir *= -1;
    sweetMin = sweetCenter - sweetWidth / 2;
    sweetMax = sweetCenter + sweetWidth / 2;
    sweetZoneEl.style.left = `${sweetMin}%`;
    sweetZoneEl.style.width = `${sweetWidth}%`;

    // Tarikan mendadak dari ikan
    yankTimer -= dt;
    let yank = 0;
    if (yankTimer <= 0) {
      yank = (18 + r * 7) * (Math.random() > 0.45 ? 1 : -1);
      yankTimer = 0.55 + Math.random() * (1.1 - r * 0.08);
      vibrate(20);
      playTone(260, 0.06, 'sawtooth', -40);
    }

    const struggle = Math.sin(elapsed * (7.2 + r * 0.6)) * (18 + r * 7) * 0.42;
    const pullUp = IS_TOUCH ? 68 : 74;
    const pullDown = IS_TOUCH ? -58 : -64;
    const failRate = IS_TOUCH ? -22 : -26;
    const gainRate = 18 + Math.min(10, state.rodLvl * 0.45); // lebih lambat dari sebelumnya
    tension = THREE.MathUtils.clamp(
      tension + ((isHoldingReel ? pullUp : pullDown) + struggle + yank) * dt,
      0,
      100
    );
    const inZone = tension >= sweetMin && tension <= sweetMax;
    reelProgress += (inZone ? gainRate : failRate) * dt;

    tensionCursorEl.style.left = `${tension}%`;
    reelProgressEl.style.width = `${THREE.MathUtils.clamp(reelProgress, 0, 100)}%`;
    tensionBox.classList.toggle('danger', !inZone);

    const pull = Math.max(-0.15, (reelProgress - REEL_START) / (100 - REEL_START));
    bobberGroup.position.set(
      castTarget.x + Math.sin(elapsed * 11) * (0.55 + r * 0.08),
      Math.sin(elapsed * 17) * 0.12,
      THREE.MathUtils.lerp(castTarget.z, reelEndZ, pull)
    );
    rodPivot.rotation.x = THREE.MathUtils.lerp(rodPivot.rotation.x, isHoldingReel ? -0.38 : 0.18, dt * 12);
    updateFishingLine(bobberGroup.position, isHoldingReel ? 0.05 : 0.45);

    if (reelProgress >= 100) completeCatch(activeFish);
    else if (reelProgress <= 0) loseFish('Ikan lepas! Zona hijau bergerak — ikuti ritmenya');
  } else if (fishState === 'JUMP') {
    jumpProgress += dt * 1.15;
    const t = Math.min(1, jumpProgress);
    caughtFishGroup.position.lerpVectors(jumpFrom, jumpTo, t);
    caughtFishGroup.position.y += Math.sin(t * Math.PI) * 2.4;
    caughtFishGroup.rotation.x = t * Math.PI * 2;
    bobberGroup.visible = false;
    updateFishingLine(caughtFishGroup.position, 0.1);

    if (t >= 1) {
      fishingLine.visible = false;
      caughtFishGroup.visible = false;
      fishState = 'SHOWCASE';
      updateActionUI();
      if (pendingCatchFish) openCatchModal(pendingCatchFish);
      else {
        fishState = 'IDLE';
        stateTimer = 0.55;
        updateActionUI();
      }
    }
  }

  renderer.render(scene, camera);
}

// ============================================================================
// 12. MULAI
// ============================================================================
async function initAssets() {
  const results = await Promise.allSettled([
    mountBoat(), mountMech(), mountPole(), loadFishModels(),
    mountOcean(), mountBuoy(), mountPineapple(), mountKiosk(), mountCStore()
  ]);
  const failed = results.filter(r => r.status === 'rejected');
  failed.forEach(r => console.warn('Gagal memuat aset:', r.reason));
  updateCameraLayout();
  assetsReady = true;
  $('loading').classList.add('done');
  if (failed.length) statusHint.textContent = 'Sebagian model 3D gagal dimuat';
}

refreshAllPanels();
updateActionUI();
refreshCamButton();
applyCameraMode();
checkOfflineEarnings();
initAssets();
animate();

// Self-check data & rumus ekonomi
console.assert(ALL_FISH.every(f => FISH_MODELS[f.glbKey] && RARITIES[f.rarity]), 'Data ikan tidak cocok dengan model/rarity');
console.assert(getRodCost() > 0 && getMaxWeightCapacity() >= 1.8, 'Rumus joran tidak valid');
console.assert(boatTier(1) === 0 && boatTier(16) === BOATS.length - 1, 'Tier kapal tidak valid');
