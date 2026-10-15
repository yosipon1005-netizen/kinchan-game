// きのちゃん Ver.4.7 — 葉っぱと花の旗をGitHub画像に変更
// きのちゃん Ver.4.3：GitHubのクレヨン素材で地面・階段・坂道の外観を統一
// きのちゃん Ver.4.2：GitHub画像でクレヨン絵本風（Ver.3.9の当たり判定・カメラ維持）
// きのちゃん Ver.3.7：階段ブロックの高さ・チェックポイント旗の地形追従修正版
// 手描きモンスター育成ゲーム Ver.2.4（彩度修正版）
// 機能別整理版：画像 / 背景編集 / 目 / 誕生 / 移動 / 食事 / 睡眠 / 感情・なでる / 保存
// HTML・CSSはVer.1.0のままで動作する設計です。

// ===== 01 基本設定 =====
const upload = document.getElementById('upload');
const canvas = document.getElementById('monsterCanvas');
const ctx = canvas.getContext('2d');
const monster = document.getElementById('monster');
const placeholder = document.getElementById('placeholder');
const nameplate = document.getElementById('nameplate');
const birthBtn = document.getElementById('birthBtn');
const nameInput = document.getElementById('monsterName');
const lifeSlider = document.getElementById('lifeSlider');
const lifeText = document.getElementById('lifeText');
const leftBtn = document.getElementById('leftBtn');
const rightBtn = document.getElementById('rightBtn');
const jumpBtn = document.getElementById('jumpBtn');
const masterCanvas = document.createElement('canvas');
const masterCtx = masterCanvas.getContext('2d');
let imageReady = false;
let born = false;
let position = 0;
let jumping = false;
let jumpTimer = null;
let walkInterval = null;
let walkingDirection = 0;
let hunger = 70;
let eating = false;
let eatingTimer = null;
let restoring = false;
let saveTimer = null;
const SAVE_KEY = 'handdrawn_monster_v1'; // 旧版のセーブデータも引き継ぐ
let happiness = 70;
let lastInteraction = Date.now();
let emotionTimer = null;
let petPointer = null;
const isAwake = () => born && Number(lifeSlider.value) > 0;
const displayName = () => nameInput.value.trim() || 'ななしのモンスター';

function updateMonsterImage() {
  if (!imageReady) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(masterCanvas, 0, 0);
}
function setPosition(value) {
  const world = document.querySelector('.world');
  const limit = Math.max(0, (world.clientWidth - 160) / 2);
  position = Math.max(-limit, Math.min(limit, Number(value) || 0));
  monster.style.left = `calc(50% - 80px + ${position}px)`;
}
function stopMotion() {
  stopWalking();
  clearTimeout(jumpTimer);
  clearTimeout(monster.walkTimer);
  clearTimeout(eatingTimer);
  jumping = false;
  eating = false;
  monster.classList.remove('alive', 'jump', 'walk-left', 'walk-right', 'eating');
}
function setRestingMotion() {
  stopMotion();
  if (isAwake()) monster.classList.add('alive');
}

// ===== 02 画像アップロード・背景自動除去 =====
function removeBackground() {
  const imageData = masterCtx.getImageData(0, 0, masterCanvas.width, masterCanvas.height);
  const data = imageData.data;
  const w = masterCanvas.width, h = masterCanvas.height;
  const visited = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let head = 0, tail = 0;
  function isBackground(p) {
    const i = p * 4;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    return Math.min(r, g, b) > 185 && Math.max(r, g, b) - Math.min(r, g, b) < 45;
  }
  function addPixel(x, y) {
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    const p = y * w + x;
    if (visited[p] || !isBackground(p)) return;
    visited[p] = 1;
    queue[tail++] = p;
  }
  for (let x = 0; x < w; x++) { addPixel(x, 0); addPixel(x, h - 1); }
  for (let y = 0; y < h; y++) { addPixel(0, y); addPixel(w - 1, y); }
  while (head < tail) {
    const p = queue[head++];
    data[p * 4 + 3] = 0;
    const x = p % w, y = Math.floor(p / w);
    addPixel(x - 1, y); addPixel(x + 1, y); addPixel(x, y - 1); addPixel(x, y + 1);
  }
  masterCtx.putImageData(imageData, 0, 0);
}
function resetForNewImage() {
  stopEyeBlink();
  stopMotion();
  imageReady = true;
  born = false;
  eyes = [];
  setPosition(0);
  canvas.style.display = 'block';
  placeholder.style.display = 'none';
  lifeSlider.value = 100;
  updateLifeDisplay();
  hunger = 70;
  updateHunger();
  nameplate.textContent = '✨ 誕生ボタンを押してね！';
  editor.hidden = true;
  eyeEditor.hidden = true;
  updateMonsterImage();
}
upload.addEventListener('change', function (event) {
  const file = event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { alert('画像を選んでね！'); return; }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = function () {
    const scale = Math.min(1, 500 / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    canvas.width = masterCanvas.width = w;
    canvas.height = masterCanvas.height = h;
    masterCtx.clearRect(0, 0, w, h);
    masterCtx.drawImage(img, 0, 0, w, h);
    removeBackground();
    resetForNewImage();
    URL.revokeObjectURL(url);
  };
  img.onerror = function () { URL.revokeObjectURL(url); alert('画像を読み込めなかったよ'); };
  img.src = url;
});

// ===== 03 背景の手動編集・ピンチズーム =====
const editBtn = document.getElementById('editBtn');
const editor = document.getElementById('editor');
const editCanvas = document.getElementById('editCanvas');
const editCtx = editCanvas.getContext('2d');
const zoomArea = document.getElementById('zoomArea');
const zoomText = document.getElementById('zoomText');
const resetZoomBtn = document.getElementById('resetZoomBtn');
const brushSize = document.getElementById('brushSize');
const undoBtn = document.getElementById('undoBtn');
const finishBtn = document.getElementById('finishBtn');
let editing = false, erasing = false, history = [];
let zoom = 1, offsetX = 0, offsetY = 0, baseScale = 1;
let activePointers = new Map(), lastPinchDistance = 0, lastPinchCenter = null, lastErasePoint = null;
editBtn.addEventListener('click', function () {
  if (!imageReady) { alert('先に絵をアップロードしてね！'); return; }
  stopEyeBlink();
  editCanvas.width = masterCanvas.width;
  editCanvas.height = masterCanvas.height;
  editCtx.clearRect(0, 0, editCanvas.width, editCanvas.height);
  editCtx.drawImage(masterCanvas, 0, 0);
  history = []; editing = true; erasing = false; activePointers.clear();
  editor.hidden = false;
  requestAnimationFrame(function () {
    baseScale = Math.min(zoomArea.clientWidth / editCanvas.width, zoomArea.clientHeight / editCanvas.height);
    resetZoom();
  });
});
function saveHistory() {
  if (history.length >= 10) history.shift();
  history.push(editCtx.getImageData(0, 0, editCanvas.width, editCanvas.height));
}
function updateTransform() {
  editCanvas.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${baseScale * zoom})`;
  zoomText.textContent = '🔍 ' + Math.round(zoom * 100) + '%';
}
function resetZoom() {
  zoom = 1;
  offsetX = (zoomArea.clientWidth - editCanvas.width * baseScale) / 2;
  offsetY = (zoomArea.clientHeight - editCanvas.height * baseScale) / 2;
  updateTransform();
}
resetZoomBtn.addEventListener('click', resetZoom);
function getLocalPoint(event) {
  const rect = zoomArea.getBoundingClientRect();
  return { x: event.clientX - rect.left - zoomArea.clientLeft, y: event.clientY - rect.top - zoomArea.clientTop };
}
function toImagePoint(point) {
  const scale = baseScale * zoom;
  return { x: (point.x - offsetX) / scale, y: (point.y - offsetY) / scale };
}
function eraseLine(from, to) {
  if (!from || !to) return;
  editCtx.save();
  editCtx.globalCompositeOperation = 'destination-out';
  editCtx.lineCap = 'round'; editCtx.lineJoin = 'round';
  editCtx.lineWidth = Number(brushSize.value) * 2;
  editCtx.beginPath(); editCtx.moveTo(from.x, from.y); editCtx.lineTo(to.x, to.y); editCtx.stroke();
  editCtx.restore();
}
function getPinchInfo() {
  const points = [...activePointers.values()];
  if (points.length < 2) return null;
  const [a, b] = points;
  return { distance: Math.hypot(b.x - a.x, b.y - a.y), center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
}
zoomArea.addEventListener('pointerdown', function (event) {
  if (!editing) return;
  event.preventDefault(); zoomArea.setPointerCapture(event.pointerId);
  const point = getLocalPoint(event);
  activePointers.set(event.pointerId, point);
  if (activePointers.size === 1) {
    erasing = true; saveHistory(); lastErasePoint = toImagePoint(point);
    eraseLine(lastErasePoint, lastErasePoint);
  }
  if (activePointers.size === 2) {
    erasing = false; lastErasePoint = null;
    const pinch = getPinchInfo();
    lastPinchDistance = pinch.distance; lastPinchCenter = pinch.center;
  }
});
zoomArea.addEventListener('pointermove', function (event) {
  if (!activePointers.has(event.pointerId)) return;
  event.preventDefault();
  const point = getLocalPoint(event);
  activePointers.set(event.pointerId, point);
  if (activePointers.size >= 2) {
    const pinch = getPinchInfo();
    if (!pinch || !lastPinchCenter) return;
    const oldScale = baseScale * zoom;
    const imageX = (lastPinchCenter.x - offsetX) / oldScale;
    const imageY = (lastPinchCenter.y - offsetY) / oldScale;
    if (lastPinchDistance > 0) zoom = Math.max(1, Math.min(5, zoom * pinch.distance / lastPinchDistance));
    const newScale = baseScale * zoom;
    offsetX = pinch.center.x - imageX * newScale;
    offsetY = pinch.center.y - imageY * newScale;
    updateTransform();
    lastPinchDistance = pinch.distance; lastPinchCenter = pinch.center;
  } else if (erasing) {
    const currentPoint = toImagePoint(point);
    eraseLine(lastErasePoint, currentPoint); lastErasePoint = currentPoint;
  }
});
function endPointer(event) {
  activePointers.delete(event.pointerId);
  erasing = false; lastErasePoint = null;
  if (activePointers.size >= 2) {
    const pinch = getPinchInfo();
    lastPinchDistance = pinch.distance; lastPinchCenter = pinch.center;
  } else { lastPinchDistance = 0; lastPinchCenter = null; }
}
zoomArea.addEventListener('pointerup', endPointer);
zoomArea.addEventListener('pointercancel', endPointer);
undoBtn.addEventListener('click', function () {
  if (history.length) editCtx.putImageData(history.pop(), 0, 0);
});
finishBtn.addEventListener('click', function () {
  masterCtx.clearRect(0, 0, masterCanvas.width, masterCanvas.height);
  masterCtx.drawImage(editCanvas, 0, 0);
  editing = false; erasing = false; activePointers.clear(); editor.hidden = true;
  eyes = []; stopEyeBlink(); updateMonsterImage(); requestSave();
  alert('背景の編集が完了したよ！🍄');
});

// ===== 04 目の設定・まばたき =====
const eyeEditBtn = document.getElementById('eyeEditBtn');
const eyeEditor = document.getElementById('eyeEditor');
const eyeCanvas = document.getElementById('eyeCanvas');
const eyeCtx = eyeCanvas.getContext('2d');
const eyeZoomArea = document.getElementById('eyeZoomArea');
const eyeSelection = document.getElementById('eyeSelection');
const eyeZoomText = document.getElementById('eyeZoomText');
const eyeStatus = document.getElementById('eyeStatus');
const eyeUndoBtn = document.getElementById('eyeUndoBtn');
const eyeResetZoomBtn = document.getElementById('eyeResetZoomBtn');
const eyeFinishBtn = document.getElementById('eyeFinishBtn');
let eyes = [];
let eyeZoom = 1, eyeBaseScale = 1, eyeOffsetX = 0, eyeOffsetY = 0;
let eyePointers = new Map(), eyeDragStart = null, eyeLastPinch = null;
let eyeBlinkInterval = null, eyeBlinkFrame = null;
eyeEditBtn.addEventListener('click', function () {
  if (!imageReady) { alert('先に絵をアップロードしてね！'); return; }
  stopEyeBlink();
  eyeCanvas.width = masterCanvas.width;
  eyeCanvas.height = masterCanvas.height;
  eyes = []; eyePointers.clear(); eyeDragStart = null;
  eyeEditor.hidden = false; eyeSelection.style.display = 'none';
  eyeStatus.textContent = '目を囲んでね'; drawEyeGuide();
  requestAnimationFrame(function () {
    eyeBaseScale = Math.min(eyeZoomArea.clientWidth / eyeCanvas.width, eyeZoomArea.clientHeight / eyeCanvas.height);
    eyeResetZoom();
  });
});
function drawEyeGuide() {
  eyeCtx.clearRect(0, 0, eyeCanvas.width, eyeCanvas.height);
  eyeCtx.drawImage(masterCanvas, 0, 0);
  eyes.forEach(function (eye, index) {
    eyeCtx.strokeStyle = '#ff477e'; eyeCtx.lineWidth = 2;
    eyeCtx.strokeRect(eye.x, eye.y, eye.w, eye.h);
    eyeCtx.fillStyle = '#ff477e'; eyeCtx.font = 'bold 18px sans-serif';
    eyeCtx.fillText(String(index + 1), eye.x, Math.max(18, eye.y - 5));
  });
  eyeStatus.textContent = eyes.length + '個の目を設定中';
}
function eyeUpdateTransform() {
  const scale = eyeBaseScale * eyeZoom;
  eyeCanvas.style.transform = 'none';
  eyeCanvas.style.width = eyeCanvas.width * scale + 'px';
  eyeCanvas.style.height = eyeCanvas.height * scale + 'px';
  eyeCanvas.style.left = eyeOffsetX + 'px';
  eyeCanvas.style.top = eyeOffsetY + 'px';
  eyeCanvas.style.display = 'block';
  eyeZoomText.textContent = '🔍 ' + Math.round(eyeZoom * 100) + '%';
}
function eyeResetZoom() {
  eyeZoom = 1;
  eyeOffsetX = (eyeZoomArea.clientWidth - eyeCanvas.width * eyeBaseScale) / 2;
  eyeOffsetY = (eyeZoomArea.clientHeight - eyeCanvas.height * eyeBaseScale) / 2;
  eyeUpdateTransform();
}
eyeResetZoomBtn.addEventListener('click', eyeResetZoom);
function eyeLocalPoint(event) {
  const rect = eyeZoomArea.getBoundingClientRect();
  return { x: event.clientX - rect.left - eyeZoomArea.clientLeft, y: event.clientY - rect.top - eyeZoomArea.clientTop };
}
function eyeImagePoint(point) {
  const scale = eyeBaseScale * eyeZoom;
  return { x: (point.x - eyeOffsetX) / scale, y: (point.y - eyeOffsetY) / scale };
}
function getEyePinch() {
  const points = [...eyePointers.values()];
  if (points.length < 2) return null;
  const [a, b] = points;
  return { distance: Math.hypot(b.x - a.x, b.y - a.y), center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
}
eyeZoomArea.addEventListener('pointerdown', function (event) {
  event.preventDefault(); eyeZoomArea.setPointerCapture(event.pointerId);
  const point = eyeLocalPoint(event); eyePointers.set(event.pointerId, point);
  if (eyePointers.size === 1) eyeDragStart = eyeImagePoint(point);
  if (eyePointers.size === 2) {
    eyeDragStart = null; eyeSelection.style.display = 'none'; eyeLastPinch = getEyePinch();
  }
});
eyeZoomArea.addEventListener('pointermove', function (event) {
  if (!eyePointers.has(event.pointerId)) return;
  event.preventDefault();
  const point = eyeLocalPoint(event); eyePointers.set(event.pointerId, point);
  if (eyePointers.size >= 2) {
    const pinch = getEyePinch();
    if (!pinch || !eyeLastPinch) return;
    const oldScale = eyeBaseScale * eyeZoom;
    const imageX = (eyeLastPinch.center.x - eyeOffsetX) / oldScale;
    const imageY = (eyeLastPinch.center.y - eyeOffsetY) / oldScale;
    if (eyeLastPinch.distance > 0) eyeZoom = Math.max(1, Math.min(5, eyeZoom * pinch.distance / eyeLastPinch.distance));
    const newScale = eyeBaseScale * eyeZoom;
    eyeOffsetX = pinch.center.x - imageX * newScale;
    eyeOffsetY = pinch.center.y - imageY * newScale;
    eyeUpdateTransform(); eyeLastPinch = pinch;
    return;
  }
  if (!eyeDragStart) return;
  const current = eyeImagePoint(point);
  const x = Math.min(eyeDragStart.x, current.x), y = Math.min(eyeDragStart.y, current.y);
  const w = Math.abs(current.x - eyeDragStart.x), h = Math.abs(current.y - eyeDragStart.y);
  const scale = eyeBaseScale * eyeZoom;
  eyeSelection.style.display = 'block';
  eyeSelection.style.left = eyeOffsetX + x * scale + 'px';
  eyeSelection.style.top = eyeOffsetY + y * scale + 'px';
  eyeSelection.style.width = w * scale + 'px';
  eyeSelection.style.height = h * scale + 'px';
});
function eyeEndPointer(event) {
  if (!eyePointers.has(event.pointerId)) return;
  const wasSingle = eyePointers.size === 1;
  const point = eyeLocalPoint(event);
  if (wasSingle && eyeDragStart) {
    const end = eyeImagePoint(point);
    const x = Math.max(0, Math.min(eyeDragStart.x, end.x));
    const y = Math.max(0, Math.min(eyeDragStart.y, end.y));
    const right = Math.min(eyeCanvas.width, Math.max(eyeDragStart.x, end.x));
    const bottom = Math.min(eyeCanvas.height, Math.max(eyeDragStart.y, end.y));
    const w = right - x, h = bottom - y;
    if (w >= 3 && h >= 3) { eyes.push({ x, y, w, h }); drawEyeGuide(); }
  }
  eyePointers.delete(event.pointerId);
  eyeDragStart = null; eyeLastPinch = null; eyeSelection.style.display = 'none';
}
eyeZoomArea.addEventListener('pointerup', eyeEndPointer);
eyeZoomArea.addEventListener('pointercancel', function (event) {
  eyePointers.delete(event.pointerId);
  eyeDragStart = null; eyeLastPinch = null; eyeSelection.style.display = 'none';
});
eyeUndoBtn.addEventListener('click', function () {
  if (eyes.length) { eyes.pop(); drawEyeGuide(); }
});
function drawEyeBlinkFrame(closedAmount) {
  updateMonsterImage();
  eyes.forEach(function (eye) {
    const x = Math.round(eye.x), y = Math.round(eye.y);
    const w = Math.round(eye.w), h = Math.round(eye.h);
    if (w <= 0 || h <= 0) return;
    const amount = Math.max(0, Math.min(1, closedAmount));
    if (amount < 0.01) return;
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    const stripH = Math.max(1, Math.round(h * 0.2));
    const topY = Math.max(0, y - stripH);
    const bottomY = Math.max(0, Math.min(masterCanvas.height - stripH, y + h));
    const coverH = h * amount / 2;
    ctx.drawImage(masterCanvas, x, topY, w, stripH, x, y, w, coverH);
    ctx.drawImage(masterCanvas, x, bottomY, w, stripH, x, y + h - coverH, w, coverH);
    ctx.restore();
  });
}
function stopEyeBlink() {
  clearInterval(eyeBlinkInterval);
  cancelAnimationFrame(eyeBlinkFrame);
  eyeBlinkInterval = null; eyeBlinkFrame = null;
  if (imageReady) updateMonsterImage();
}
function animateEyeBlink() {
  const duration = 360, start = performance.now();
  function frame(now) {
    if (!isAwake()) { updateMonsterImage(); return; }
    const progress = Math.min(1, (now - start) / duration);
    drawEyeBlinkFrame(Math.sin(progress * Math.PI));
    if (progress < 1) eyeBlinkFrame = requestAnimationFrame(frame);
    else { eyeBlinkFrame = null; updateMonsterImage(); }
  }
  eyeBlinkFrame = requestAnimationFrame(frame);
}
function startEyeBlink() {
  clearInterval(eyeBlinkInterval);
  if (!isAwake() || !eyes.length) { eyeBlinkInterval = null; return; }
  eyeBlinkInterval = setInterval(function () {
    if (isAwake()) animateEyeBlink();
  }, 3500);
}
eyeFinishBtn.addEventListener('click', function () {
  if (!eyes.length) { alert('目を1つ以上囲んでね！'); return; }
  eyeEditor.hidden = true;
  updateMonsterImage(); startEyeBlink(); requestSave();
  alert(eyes.length + '個の目がまばたきするようになったよ！👀');
});

// ===== 05 モンスター誕生 =====
birthBtn.addEventListener('click', function () {
  if (!imageReady) { alert('まず絵をアップロードしてね！'); return; }
  born = true;
  setPosition(0);
  hunger = 70;
  updateHunger();
  setRestingMotion();
  if (isAwake() && eyes.length) startEyeBlink();
  nameplate.textContent = '🐉 ' + displayName() + ' が誕生した！';
  lastInteraction = Date.now(); happiness = 70;
  refreshEmotion(); updateMonsterImage(); requestSave();
});

// ===== 06 ジャンプ・左右移動・長押し =====
function jump() {
  if (!isAwake() || jumping || eating) return;
  stopWalking();
  clearTimeout(monster.walkTimer);
  jumping = true;
  monster.classList.remove('walk-right', 'walk-left', 'alive', 'jump');
  void monster.offsetWidth;
  monster.classList.add('jump');
  clearTimeout(jumpTimer);
  jumpTimer = setTimeout(function () {
    monster.classList.remove('jump');
    jumping = false;
    if (isAwake() && !eating) monster.classList.add('alive');
  }, 650);
}
function move(direction) {
  if (!isAwake() || jumping || eating) return;
  setPosition(position + direction * 25);
  monster.classList.remove('alive', 'walk-right', 'walk-left');
  void monster.offsetWidth;
  monster.classList.add(direction > 0 ? 'walk-right' : 'walk-left');
  clearTimeout(monster.walkTimer);
  monster.walkTimer = setTimeout(function () {
    monster.classList.remove('walk-right', 'walk-left');
    if (isAwake() && !jumping && !eating) monster.classList.add('alive');
  }, 450);
}
function stopWalking() {
  if (walkInterval !== null) { clearInterval(walkInterval); walkInterval = null; }
  walkingDirection = 0;
}
function startWalking(direction) {
  stopWalking();
  if (!isAwake() || jumping || eating) return;
  walkingDirection = direction;
  move(direction);
  walkInterval = setInterval(function () {
    if (!isAwake() || jumping || eating) { stopWalking(); return; }
    move(walkingDirection);
  }, 220);
}
function setupWalkButton(button, direction) {
  button.addEventListener('pointerdown', function (event) {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    startWalking(direction);
  });
  button.addEventListener('pointerup', function () { stopWalking(); requestSave(); });
  button.addEventListener('pointercancel', function () { stopWalking(); requestSave(); });
  button.addEventListener('lostpointercapture', stopWalking);
  button.addEventListener('contextmenu', function (event) { event.preventDefault(); });
}
setupWalkButton(leftBtn, -1);
setupWalkButton(rightBtn, 1);
jumpBtn.onclick = jump;

// ===== 07 ごはん・満腹度 =====
const feedBtn = document.getElementById('feedBtn');
const hungerText = document.getElementById('hungerText');
const hungerFill = document.getElementById('hungerFill');
const foodMessage = document.getElementById('foodMessage');
function updateHunger() {
  hunger = Math.max(0, Math.min(100, hunger));
  hungerText.textContent = 'おなか：' + hunger + ' / 100';
  hungerFill.style.width = hunger + '%';
  if (hunger >= 80) foodMessage.textContent = '😋 おなかいっぱい！';
  else if (hunger >= 40) foodMessage.textContent = '😊 元気いっぱい！';
  else if (hunger > 0) foodMessage.textContent = '🥺 おなかがすいてきたよ';
  else foodMessage.textContent = '🎨 色をぬってほしいみたい！';
}
// Ver.2.2: 絵の具を筆で塗って食べさせるミニゲーム。
// 元の絵は masterCanvas に保存したまま。塗りは一時的な別レイヤー。
(function setupPaintFeeding(){
  const style=document.createElement('style');
  style.textContent=`#kinPaintModal{position:fixed;inset:0;background:rgba(34,35,47,.75);z-index:999999;display:none;align-items:center;justify-content:center;padding:12px;box-sizing:border-box}
  #kinPaintModal.show{display:flex}#kinPaintBox{width:min(94vw,470px);max-height:94dvh;overflow:auto;background:#fff8e9;border:5px solid #e4cba8;border-radius:20px;padding:14px;text-align:center;box-shadow:0 12px 50px #2228;box-sizing:border-box}
  #kinPaintCanvas{width:min(72vw,310px);height:min(72vw,310px);border-radius:12px;background:linear-gradient(#fffef9,#f9f1e2);touch-action:none;border:2px solid #e7d6bd;display:block;margin:10px auto}
  #kinPaintColors{display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin:8px auto}
  #kinPaintColors button{width:38px;height:38px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 1px #a99;cursor:pointer}
  #kinPaintColors button.active{box-shadow:0 0 0 3px #634e45}
  #kinPaintActions{display:flex;justify-content:center;gap:8px;flex-wrap:wrap}#kinPaintActions button{padding:9px 13px;border-radius:12px;border:0;background:#e5c99d;font-weight:bold}`;
  document.head.appendChild(style);
  const modal=document.createElement('div');modal.id='kinPaintModal';
  modal.innerHTML='<div id="kinPaintBox"><div style="font-weight:bold;font-size:20px">🎨 きのちゃんに色をぬろう！</div><div style="font-size:13px">色を選んで、指でなぞってね 🖌️</div><div id="kinPaintColors"></div><canvas id="kinPaintCanvas" width="320" height="320"></canvas><div id="kinPaintActions"><button id="kinPaintUndo" type="button">↩️ ぬり直す</button><button id="kinPaintDone" type="button">🍄 いただきます！</button><button id="kinPaintCancel" type="button">閉じる</button></div><div id="kinPaintStatus" style="margin-top:8px;min-height:20px">色を選んで塗ってみよう！</div></div>';
  document.body.appendChild(modal);
  const c=modal.querySelector('#kinPaintCanvas'),q=c.getContext('2d');
  const layer=document.createElement('canvas');layer.width=320;layer.height=320;
  const l=layer.getContext('2d');
  const status=modal.querySelector('#kinPaintStatus');
  const colors=['#f66a7b','#ffbe48','#5b9be6','#77c997','#bc86d9','#ff9cc5','#ffffff'];
  let color=colors[0],painting=false,strokeLength=0,lastPoint=null;
  const palette=modal.querySelector('#kinPaintColors');
  function render(){
    q.clearRect(0,0,320,320);
    q.drawImage(masterCanvas,0,0,320,320);
    q.save();q.globalAlpha=.7;q.drawImage(layer,0,0);q.restore();
  }
  colors.forEach((v,i)=>{const b=document.createElement('button');b.type='button';b.style.background=v;b.title='色 '+(i+1);if(!i)b.classList.add('active');
    b.onclick=()=>{color=v;palette.querySelectorAll('button').forEach(x=>x.classList.remove('active'));b.classList.add('active');};palette.appendChild(b);
  });
  function pos(e){const r=c.getBoundingClientRect();return{x:(e.clientX-r.left)*320/r.width,y:(e.clientY-r.top)*320/r.height};}
  function drawStroke(a,b){l.strokeStyle=color;l.lineWidth=19;l.lineCap='round';l.lineJoin='round';l.beginPath();l.moveTo(a.x,a.y);l.lineTo(b.x,b.y);l.stroke();
    // 塗りはモンスターの不透明な部分に限定。
    l.globalCompositeOperation='destination-in';l.drawImage(masterCanvas,0,0,320,320);l.globalCompositeOperation='source-over';render();
  }
  c.addEventListener('pointerdown',e=>{painting=true;c.setPointerCapture(e.pointerId);lastPoint=pos(e);drawStroke(lastPoint,lastPoint);strokeLength+=1;});
  c.addEventListener('pointermove',e=>{if(!painting)return;const p=pos(e);strokeLength+=Math.hypot(p.x-lastPoint.x,p.y-lastPoint.y);drawStroke(lastPoint,p);lastPoint=p;});
  ['pointerup','pointercancel','lostpointercapture'].forEach(name=>c.addEventListener(name,()=>painting=false));
  function hide(){modal.classList.remove('show');painting=false;}
  modal.querySelector('#kinPaintCancel').onclick=hide;
  modal.querySelector('#kinPaintUndo').onclick=()=>{l.clearRect(0,0,320,320);strokeLength=0;render();status.textContent='もう一度ぬってみよう！';};
  modal.querySelector('#kinPaintDone').onclick=()=>{
    if(strokeLength<12){status.textContent='🖌️ もう少し色を塗ってあげてね！';return;}
    hunger=Math.min(100,hunger+20);happiness=Math.min(100,happiness+18);lastInteraction=Date.now();
    updateHunger();showEmotion('🎨','色、おいしかった〜！');requestSave();
    status.textContent='🍄 ごちそうさま！';hide();
  };
  // キャプチャで旧🍎のワンタップ給餌処理を止める。
  feedBtn.addEventListener('click',e=>{
    e.stopImmediatePropagation();
    if(!imageReady||!born){alert('先にモンスターを誕生させてね！');return;}
    if(!isAwake()){foodMessage.textContent='🌙 おやすみ中だよ';return;}
    if(hunger>=100){foodMessage.textContent='😋 もうおなかいっぱい！';return;}
    l.clearRect(0,0,320,320);strokeLength=0;render();
    status.textContent='好きな色で、きのちゃんを塗ってね！';modal.classList.add('show');
  },true);
  feedBtn.textContent='🎨 絵の具をぬる';
})();

feedBtn.addEventListener('click', function () {
  if (!imageReady || !born) { alert('先にモンスターを誕生させてね！'); return; }
  if (!isAwake()) { foodMessage.textContent = '🌙 おやすみ中だよ。起きてからごはんにしよう！'; return; }
  if (eating) return;
  if (hunger >= 100) { foodMessage.textContent = '😋 もうおなかいっぱい！'; return; }
  hunger = Math.min(100, hunger + 20);
  updateHunger();
  happiness = Math.min(100, happiness + 18);
  lastInteraction = Date.now();
  showEmotion('❤️', 'おいしかった〜！');
  requestSave();
  stopWalking();
  clearTimeout(monster.walkTimer);
  if (jumping) { clearTimeout(jumpTimer); jumping = false; }
  eating = true;
  monster.classList.remove('alive', 'jump', 'walk-left', 'walk-right', 'eating');
  void monster.offsetWidth;
  monster.classList.add('eating');
  clearTimeout(eatingTimer);
  eatingTimer = setTimeout(function () {
    monster.classList.remove('eating'); eating = false;
    if (isAwake()) monster.classList.add('alive');
  }, 600);
});
setInterval(function () {
  if (!isAwake()) return;
  hunger = Math.max(0, hunger - 1);
  updateHunger(); refreshEmotion(); requestSave();
}, 10000);
updateHunger();

// ===== 08 色彩・おやすみ・おはよう =====
function updateLifeDisplay() {
  const value = Number(lifeSlider.value);
  canvas.style.filter = `grayscale(${100 - value}%)`;
  if (value === 100) lifeText.textContent = 'フルカラー';
  else if (value === 0) lifeText.textContent = '🌙 おやすみ中';
  else lifeText.textContent = '色彩 ' + value + '%';
}
function applySleepState() {
  updateLifeDisplay();
  if (!born) return;
  if (!isAwake()) {
    stopEyeBlink();
    stopMotion();
    nameplate.textContent = '🌙 ' + displayName() + ' はおやすみ中…';
  } else {
    if (!jumping && !eating && walkInterval === null) monster.classList.add('alive');
    if (eyes.length && eyeBlinkInterval === null) startEyeBlink();
    refreshEmotion();
  }
}
lifeSlider.addEventListener('input', function () {
  applySleepState();
  requestSave();
});

// ===== 09 感情・なでる（Ver.1.2） =====
// HTML・CSSの編集不要。ハートと感情表示はJavaScriptで追加します。
const emotionStyle = document.createElement('style');
emotionStyle.textContent = `
  .kinoko-heart { position:fixed; pointer-events:none; z-index:9999;
    font-size:27px; animation:kinoko-float 1.1s ease-out forwards; }
  @keyframes kinoko-float { from {opacity:1;transform:translate(-50%,0) scale(.8)}
    to {opacity:0;transform:translate(-50%,-85px) scale(1.4)} }
  #monsterCanvas { touch-action:pan-y; }
`;
document.head.appendChild(emotionStyle);
let emotionMessageUntil = 0;
function currentEmotion() {
  if (!born || !imageReady) return '';
  if (!isAwake()) return '😴';
  if (hunger <= 20) return '😢';
  if (Date.now() - lastInteraction >= 10 * 60 * 1000) return '🥺';
  if (happiness >= 80) return '😆';
  return '😊';
}
function refreshEmotion() {
  if (!born || !imageReady || Date.now() < emotionMessageUntil) return;
  const mood = currentEmotion();
  const message = mood === '😴' ? 'おやすみ中…'
    : mood === '😢' ? 'おなかがすいたよ…'
    : mood === '🥺' ? 'いっしょに遊ぼう！'
    : mood === '😆' ? 'とってもうれしい！'
    : 'ごきげんだよ！';
  nameplate.textContent = mood + ' ' + displayName() + '：' + message;
}
function popHeart(x, y) {
  const heart = document.createElement('span');
  heart.className = 'kinoko-heart';
  heart.textContent = Math.random() < 0.5 ? '❤️' : '💕';
  heart.style.left = x + 'px';
  heart.style.top = y + 'px';
  document.body.appendChild(heart);
  setTimeout(function () { heart.remove(); }, 1150);
}
function showEmotion(symbol, message) {
  if (!isAwake()) return;
  nameplate.textContent = symbol + ' ' + displayName() + '：' + message;
  emotionMessageUntil = Date.now() + 1800;
  const rect = canvas.getBoundingClientRect();
  if (rect.width && rect.height) popHeart(rect.left + rect.width / 2, rect.top + rect.height / 3);
  clearTimeout(emotionTimer);
  emotionTimer = setTimeout(refreshEmotion, 1850);
}
function petMonster(x, y) {
  if (!isAwake() || editing || !eyeEditor.hidden) return;
  happiness = Math.min(100, happiness + 8);
  lastInteraction = Date.now();
  showEmotion('🥰', 'なでてくれてありがとう！');
  // 指の位置にもハートを表示
  popHeart(x, y);
  requestSave();
}
// タップでも、指を動かしてなでても反応。長いスワイプは連続発動を抑制。
canvas.addEventListener('pointerdown', function (event) {
  if (!isAwake() || editing || !eyeEditor.hidden) return;
  petPointer = { id:event.pointerId, x:event.clientX, y:event.clientY, last:0, moved:false };
});
canvas.addEventListener('pointermove', function (event) {
  if (!petPointer || event.pointerId !== petPointer.id) return;
  if (Math.hypot(event.clientX - petPointer.x, event.clientY - petPointer.y) > 18) {
    petPointer.moved = true;
    if (Date.now() - petPointer.last > 700) {
      petPointer.last = Date.now();
      petMonster(event.clientX, event.clientY);
    }
  }
});
canvas.addEventListener('pointerup', function (event) {
  if (petPointer && event.pointerId === petPointer.id) {
    if (!petPointer.moved) petMonster(event.clientX, event.clientY);
    petPointer = null;
  }
});
canvas.addEventListener('pointercancel', function () { petPointer = null; });
setInterval(function () {
  if (!isAwake()) return;
  if (Date.now() - lastInteraction >= 10 * 60 * 1000) {
    happiness = Math.max(0, happiness - 1);
  }
  refreshEmotion();
}, 30000);

// ===== 10 セーブ・自動復活 =====
function saveMonster() {
  if (!imageReady || !born || restoring) return;
  try {
    const data = {
      version: 1,
      name: nameInput.value.trim(),
      image: masterCanvas.toDataURL('image/png'),
      eyes: eyes.map(eye => ({ x: eye.x, y: eye.y, w: eye.w, h: eye.h })),
      hunger: hunger,
      life: Number(lifeSlider.value),
      position: position,
      happiness: happiness,
      lastInteraction: lastInteraction
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (error) { console.error('セーブ失敗:', error); }
}
function requestSave() {
  if (restoring || !born) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveMonster, 500);
}
function loadMonster() {
  let data;
  try {
    const saved = localStorage.getItem(SAVE_KEY);
    if (!saved) return;
    data = JSON.parse(saved);
    if (!data || !data.image) return;
  } catch (error) { console.error('セーブデータ読み込み失敗:', error); return; }
  restoring = true;
  const img = new Image();
  img.onload = function () {
    try {
      stopEyeBlink(); stopMotion();
      const w = img.naturalWidth, h = img.naturalHeight;
      canvas.width = masterCanvas.width = w;
      canvas.height = masterCanvas.height = h;
      masterCtx.clearRect(0, 0, w, h);
      masterCtx.drawImage(img, 0, 0);
      imageReady = true;
      nameInput.value = data.name || '';
      eyes = Array.isArray(data.eyes) ? data.eyes.filter(eye =>
        eye && [eye.x, eye.y, eye.w, eye.h].every(Number.isFinite)
      ) : [];
      hunger = Number.isFinite(Number(data.hunger)) ? Number(data.hunger) : 70;
      happiness = Number.isFinite(Number(data.happiness)) ? Math.max(0, Math.min(100, Number(data.happiness))) : 70;
      lastInteraction = Number.isFinite(Number(data.lastInteraction)) ? Number(data.lastInteraction) : Date.now();
      const life = Number.isFinite(Number(data.life)) ? Number(data.life) : 100;
      lifeSlider.value = life;
      setPosition(data.position);
      canvas.style.display = 'block';
      placeholder.style.display = 'none';
      editor.hidden = true; eyeEditor.hidden = true;
      born = true; jumping = false; eating = false;
      updateMonsterImage(); updateHunger(); updateLifeDisplay();
      if (isAwake()) {
        monster.classList.add('alive');
        if (eyes.length) startEyeBlink();
        refreshEmotion();
      } else {
        nameplate.textContent = '🌙 ' + displayName() + ' はおやすみ中…';
      }
    } catch (error) { console.error('復活失敗:', error); }
    finally { restoring = false; }
  };
  img.onerror = function () { restoring = false; console.error('保存画像を読み込めなかったよ'); };
  img.src = data.image;
}
setInterval(function () { if (born) saveMonster(); }, 10000);
document.addEventListener('visibilitychange', function () {
  if (document.visibilityState === 'hidden') { clearTimeout(saveTimer); saveMonster(); }
});
nameInput.addEventListener('change', function () { refreshEmotion(); requestSave(); });
loadMonster();


// ===== 11 Ver.1.5 横スクロールアクション＋敵＋ハテナブロック =====
// Ver.1.4から更新。HTML/CSSの変更は不要。
(function setupAdventure() {
  'use strict';
  const playBtn = document.createElement('button');
  playBtn.type = 'button';
  playBtn.id = 'adventurePlayBtn';
  playBtn.textContent = '🎮 あそぶ（アクション）';
  playBtn.style.cssText = 'display:block;margin:12px auto;padding:13px 20px;border:0;border-radius:14px;background:#2d8659;color:white;font-weight:bold;font-size:16px;cursor:pointer;';
  birthBtn.insertAdjacentElement('afterend', playBtn);

  const style = document.createElement('style');
  style.textContent = `
    #adventureOverlay{position:fixed;inset:0;z-index:99999;background:#10223c;color:#fff;display:none;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:8px;box-sizing:border-box;overflow:auto}
    #adventureOverlay.open{display:flex}
    #adventureTop{display:flex;justify-content:space-between;align-items:center;width:min(100%,960px);gap:5px;font-weight:bold;font-size:13px;flex-wrap:wrap}
    #adventureBack,#adventureRetry,#adventureEnemyUploadBtn{background:#fff;color:#173d52;border:0;border-radius:10px;padding:9px 13px;font-size:15px;font-weight:bold}
    #adventureScreen{display:block;width:min(100%,960px);max-height:calc(100dvh - 125px);aspect-ratio:16/9;object-fit:contain;border:3px solid #fff;border-radius:10px;box-sizing:border-box;background:#8ad7f7;touch-action:none}
    #adventureControls{display:flex;justify-content:space-between;align-items:center;width:min(100%,960px);gap:10px;user-select:none;-webkit-user-select:none;touch-action:none}
    #adventureControls .adventureGroup{display:flex;gap:12px}
    #adventureControls button{min-width:64px;min-height:48px;border:2px solid #fff;border-radius:14px;background:#2863a2;color:white;font-size:23px;font-weight:bold;touch-action:none;-webkit-touch-callout:none}
    #adventureControls #adventureJump{background:#da6538;min-width:96px;font-size:17px}
    #adventureMessage{font-size:14px;text-align:center;min-height:20px}
    @media (orientation:portrait){#adventureRotate{display:block}} 
    @media (orientation:landscape){#adventureRotate{display:none}}
    @media (max-height:400px) and (orientation:landscape){#adventureOverlay{gap:3px;padding:3px}#adventureScreen{max-height:calc(100dvh - 91px)}#adventureControls button{min-height:39px}#adventureTop{font-size:12px}#adventureMessage{font-size:12px}}
  `;
  document.head.appendChild(style);

  const overlay = document.createElement('section');
  overlay.id = 'adventureOverlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', 'きのちゃんのアクションゲーム');
  overlay.innerHTML = `
    <div id="adventureTop"><button id="adventureBack" type="button">🏠 もどる</button><span id="adventureScore">🍄 0 / 5</span><span id="adventureCoinCount">🪙 0</span><span id="adventureLives">❤️❤️❤️　⭐ 0</span><button id="adventureEnemyUploadBtn" type="button">🎨 敵の絵</button><input id="adventureEnemyFile" type="file" accept="image/*" hidden><button id="adventureRetry" type="button">🔄 やり直す</button></div>
    <div id="adventureRotate">📱 iPhoneを横向きにすると遊びやすいよ！</div>
    <canvas id="adventureScreen" width="960" height="540" aria-label="横スクロールステージ"></canvas>
    <div id="adventureControls"><div class="adventureGroup"><button id="adventureLeft" type="button" aria-label="左へ">◀</button><button id="adventureRight" type="button" aria-label="右へ">▶</button></div><button id="adventureJump" type="button">ジャンプ ⤴</button></div>
    <div id="adventureMessage" aria-live="polite">右に進んでゴールを目指そう！</div>
  `;
  document.body.appendChild(overlay);

  const screen = document.getElementById('adventureScreen');
  const g = screen.getContext('2d');
  const scoreText = document.getElementById('adventureScore');
  const coinCountText = document.getElementById('adventureCoinCount');
  const message = document.getElementById('adventureMessage');
  const W = 960, H = 540, groundY = 460;
  let stageEnd = 3600; // 花咲く丘は長い冒険コース
  // Ver.2.1: ライフに応じた彩度（3=100%, 2=50%, 1=0%）
  let visibleSaturation=1;
  const flowerArt=new Image();let flowerReady=false;
  flowerArt.onload=()=>{flowerReady=true;};
  flowerArt.onerror=()=>{flowerReady=false;};
  // GitHubに画像を置けば、自動でステージ2に表示される。
  flowerArt.src='https://raw.githubusercontent.com/yosipon1005-netizen/kinchan-game/main/kinchan_flower_hill_background.png';
  // Ver.3.0: GitHubに5枚の背景画像をアップロードすると自動で読み込み。
  const HILL_IMAGE_BASE='https://raw.githubusercontent.com/yosipon1005-netizen/kinchan-game/main/';
  // Ver.4.3: GitHubにアップロードした本物のクレヨン素材を読み込む。
  // 画像が読み込めないときは元の描画に自動で戻す。
  const crayonAssets={};
  // Ver.5.4: 葉っぱの絵はJSに直接内蔵。GitHub/CDNキャッシュや読み込み失敗を回避。
  const embeddedLeafImages={
    'leaf_01':'data:image/png;base64,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',
    'leaf_08':'data:image/png;base64,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'
  };

  ['ground_long','flower_box','step_low','step_mid','step_high','slope_up','cloud_plain','cloud_small','bee','snail','sprout_enemy','sprout_box','star','leaf_01','leaf_08','flag_02','flag_04','flag_03'].forEach(name=>{
    const img=new Image();
    const item={img,ready:false};
    crayonAssets[name]=item;
    img.onload=()=>{item.ready=true;};
    img.onerror=()=>{item.ready=false;console.warn('画像読み込み失敗:',name);};
    img.src=embeddedLeafImages[name] || ('https://raw.githubusercontent.com/yosipon1005-netizen/kinchan-game/main/'+name+'.png');
  });
  // Ver.4.3: 地形の描画だけを画像に置き換える。衝突判定は一切変更しない。
  // 地面の上部は一枚の画像を繰り返し、下部も同じ画像の土色で埋める。
  const soilSwatch=document.createElement('canvas');
  soilSwatch.width=192;soilSwatch.height=192;
  const soilCtx=soilSwatch.getContext('2d');
  let soilPattern=null;
  function crayonSoil(){
    const art=crayonAssets.ground_long;
    if(!art||!art.ready||!art.img.naturalWidth)return false;
    if(!soilPattern){
      // 土の小さな領域を、元画像の縦横比のまま敷き詰める。
      // 細長い土片を縦に拡大すると縦筋になるため、拡大はしない。
      const im=art.img,iw=im.naturalWidth,ih=im.naturalHeight;
      soilCtx.fillStyle='#d99052';soilCtx.fillRect(0,0,192,192);
      for(let yy=0;yy<192;yy+=28){
        for(let xx=0;xx<192;xx+=48){
          const seed=(xx*17+yy*31)%127;
          const sx=iw*(.12+((seed%37)/100));
          soilCtx.globalAlpha=.84;
          soilCtx.drawImage(im,sx,ih*.72,Math.min(95,iw-sx),ih*.16,xx,yy,50,29);
        }
      }
      soilCtx.globalAlpha=1;
      soilPattern=g.createPattern(soilSwatch,'repeat');
    }
    return true;
  }
  function paintSoil(x,y,w,h){
    if(w<=0||h<=0)return;
    g.fillStyle=crayonSoil()&&soilPattern?soilPattern:'#ad805e';
    g.fillRect(x,y,w,h);
  }
  function drawCrayonGroundOverlay(){
    const art=crayonAssets.ground_long;
    if(!art||!art.ready||!art.img.naturalWidth)return;
    const step=12,tileW=340,tileH=76;
    const left=Math.max(0,Math.floor((camera-80)/step)*step);
    const right=Math.min(stageEnd,camera+W/viewZoom()+120);
    // 描画する地形の上端だけを細かくクリップ。画像の横方向の位置は固定し、
    // 各スライスで同じ絵を参照するため画像がぶつ切りにならない。
    for(let x=left;x<right;x+=step){
      const nx=Math.min(right,x+step);
      const y1=terrainHeight(x+0.1),y2=terrainHeight(nx-.1);
      if(!Number.isFinite(y1)||!Number.isFinite(y2))continue;
      const top=Math.min(y1,y2)-13;
      g.save();g.beginPath();g.moveTo(x,y1-13);g.lineTo(nx,y2-13);
      g.lineTo(nx,H+360);g.lineTo(x,H+360);g.closePath();g.clip();
      // 土部分は画像由来のテクスチャ。旧バージョンの茶色い下地を覆う。
      paintSoil(x,top,nx-x,H+360-top);
      // 草の絵を地表から描く。地面の上端が動いても各区間で高さを合わせる。
      const imageTop=(y1+y2)/2-22;
      const base=Math.floor(x/tileW)*tileW;
      g.drawImage(art.img,base,imageTop,tileW,tileH);
      // 両端の一部が切れている素材を横方向に隙間なく並べる。
      g.drawImage(art.img,base+tileW,imageTop,tileW,tileH);
      g.restore();
    }
  }
  function drawCrayonStair(a){
    const names=['step_low','step_mid','step_high'];
    const n=a.stepNumber||1;
    const asset=crayonAssets[names[Math.min(2,Math.floor((n-1)/2))]];
    if(!asset||!asset.ready||!asset.img.naturalWidth)return false;
    const bottom=H+200,top=a.y-10;
    g.save();g.beginPath();g.rect(a.x,top,a.w,bottom-top);g.clip();
    paintSoil(a.x,top,a.w,bottom-top);
    // 柱全体に絵を引き伸ばさず、草と土の上部だけを重ねる。
    // 残りの深い土はタイル状のテクスチャで埋める。
    const im=asset.img,iw=im.naturalWidth,ih=im.naturalHeight;
    const capH=Math.min(82,Math.max(50,a.w*.86));
    g.drawImage(im,0,0,iw,ih*.57,a.x-2,a.y-14,a.w+4,capH);
    g.restore();
    return true;
  }
  function drawCrayonHighway(a){
    const asset=crayonAssets.ground_long;
    if(!asset||!asset.ready||!asset.img.naturalWidth)return false;
    g.save();g.beginPath();g.rect(a.x,a.y-10,a.w,a.h+10);g.clip();
    paintSoil(a.x,a.y,a.w,a.h);
    const tile=210;
    for(let x=a.x;x<a.x+a.w;x+=tile){
      g.drawImage(asset.img,x,a.y-17,tile,77);
    }
    g.restore();return true;
  }

  const hillSceneryNames=['kinchan_hill_01_sakura.jpg','kinchan_hill_02_sky.jpg','kinchan_hill_03_wind.jpg','kinchan_hill_04_stream.jpg','kinchan_hill_05_sunset.jpg'];
  const hillScenery=hillSceneryNames.map(()=>new Image());
  const hillSceneryReady=hillSceneryNames.map(()=>false);
  hillScenery.forEach((img,i)=>{
    img.onload=()=>{hillSceneryReady[i]=true;};
    img.onerror=()=>{hillSceneryReady[i]=false;};
    img.src=HILL_IMAGE_BASE+hillSceneryNames[i];
  });
  // Ver.2.9: 花咲く丘は約2倍の長さ。5つのエリアで遊びが変わる。
  // Ver.5.3: 葉っぱ01/08を併用。アイテムの寄り道用に5か所、雲2か所。
  const hillPlatforms=[];
  const extraLeafPlatforms=[
    {x:680,y:328,w:142,h:22,leafVariant:1},        // 序盤：細長い葉っぱ01
    {x:1950,y:325,w:142,h:22,leafVariant:8},       // 序盤後半：丸い葉っぱ08
    {x:5320,y:305,w:142,h:22,leafVariant:1},       // 終盤：細長い葉っぱ01
    {x:6080,y:340,w:142,h:22,leafVariant:8}        // 終盤後半：丸い葉っぱ08
  ];
  const extraCloudPlatforms=[
    {x:2430,y:325,w:150,h:22,moving:true,range:0,speed:0} // 中盤：雲から星へ
  ];
  const SKY_CHALLENGE={
    // 中盤の平地に1か所。穴(3510～3635)や階段を避ける。
    leaf:{x:3920,y:357,w:142,h:22,leafVariant:8},
    cloud:{x:4060,y:257,w:150,h:22,moving:true,range:0,speed:0},
    block:{x:4200,y:153},
    treasure:{x:4229,y:92}
  };
  function addRewardPlatforms(){
    for(const v of [...extraCloudPlatforms,SKY_CHALLENGE.leaf,SKY_CHALLENGE.cloud]){
      platforms.push({...v,baseX:v.x,baseY:v.y,prevX:v.x,prevY:v.y});
    }
    // 各足場の上に報酬を置く。足場を使わないと届きにくい高さ。
    blockStarts.push({...SKY_CHALLENGE.block});
    coins.push({x:755,y:220,reward:true});
    coins.push({x:2020,y:222,reward:true});
    coins.push({x:2510,y:222,reward:true});
    coins.push({x:5390,y:195,reward:true});
    coins.push({x:6150,y:235,reward:true});
    coins.push({...SKY_CHALLENGE.treasure,reward:true});
  }
  const hillWindZones=[
    {x:2220,w:500,power:1.65,phase:0},
    {x:2950,w:440,power:-1.55,phase:1.2},
    {x:4580,w:420,power:1.85,phase:2.3},
    {x:5900,w:460,power:-1.35,phase:1.5},
    {x:6460,w:420,power:1.75,phase:2.1}
  ];
  let windParticles=[];
  function currentWind(){
    if(pageIndex!==1)return 0;
    const center=p.x+p.w/2;
    const z=hillWindZones.find(v=>center>=v.x&&center<=v.x+v.w);
    if(!z)return 0;
    return z.power*(0.72+0.28*Math.sin(gameTime*.002+z.phase));
  }
  // Ver.3.1: 地面を高さの異なる点で結ぶ。水平=平地、斜め=坂、同じX=段差。
  // Ver.3.3: 階段の土柱を実体のある障害物として扱い、めり込みを防止。
  // 地面の坂はなめらかに、階段は独立した足場として描画する。
  const hillTerrain=[
    [0,460],[360,460],[620,430],[920,430],[1100,460],[1370,460],
    [1550,450],[1820,450],[2060,480],[2360,480],[2560,435],
    [2830,435],[3000,470],[3290,470],[3500,420],[3730,420],
    [3940,485],[4200,485],[4430,450],[4700,450],[4910,485],
    [5200,485],[5400,440],[5640,440],[5880,480],[6150,480],
    [6400,450],[6660,450],[6850,415],[7200,415]
  ];
  function terrainHeight(x){
    if(pageIndex!==1)return groundY;
    if(!isSolidGround(x))return Infinity;
    for(let i=1;i<hillTerrain.length;i++){
      const a=hillTerrain[i-1],b=hillTerrain[i];
      if(x<=b[0])return a[1]+(b[1]-a[1])*Math.max(0,(x-a[0])/(b[0]-a[0]));
    }
    return hillTerrain[hillTerrain.length-1][1];
  }
  // Ver.3.5: 分岐道で下の道を見失わないための広角カメラ。
  const HILL_VIEW_ZOOM = 0.88;
  const viewZoom = () => pageIndex === 1 ? HILL_VIEW_ZOOM : 1;
  function applyWorldCamera(ctx) {
    const z = viewZoom();
    ctx.translate(W/2, H/2);
    ctx.scale(z, z);
    ctx.translate(-W/2-camera, -H/2-cameraY);
  }
  let cameraY=0;
  // ===== Ver.4.0 クレヨン絵本タッチ（描画だけ変更） =====
  // 物理判定・カメラ・配置・セーブ処理には触れない。
  const crayonTile=document.createElement('canvas');
  crayonTile.width=112;crayonTile.height=112;
  const cr=crayonTile.getContext('2d');
  let crSeed=27491;
  function crRand(){crSeed=(Math.imul(crSeed,1664525)+1013904223)>>>0;return crSeed/4294967296;}
  for(let i=0;i<1000;i++){
    const x=crRand()*112,y=crRand()*112;
    cr.strokeStyle=crRand()>.55?'rgba(255,255,255,.17)':'rgba(61,40,49,.10)';
    cr.lineWidth=.5+crRand()*1.9;cr.lineCap='round';
    cr.beginPath();cr.moveTo(x,y);cr.lineTo(x+3+crRand()*11,y-2-crRand()*5);cr.stroke();
  }
  const crayonPattern=g.createPattern(crayonTile,'repeat');
  function crayonSurface(x,y,w,h,alpha=.48){
    g.save();g.globalAlpha=alpha;g.fillStyle=crayonPattern;g.fillRect(x,y,w,h);g.restore();
  }
  function crayonEdge(x1,y1,x2,y2,color='#6d7652'){
    g.save();g.lineCap='round';
    for(let i=0;i<3;i++){
      g.strokeStyle=color;g.globalAlpha=[.30,.19,.13][i];g.lineWidth=[3,2,1.5][i];
      g.beginPath();g.moveTo(x1,y1+i*1.5);g.lineTo(x2,y2+i*1.5);g.stroke();
    }g.restore();
  }
  function crayonGroundDetails(x,y,w,bottom){
    g.save();g.beginPath();g.rect(x,y,w,bottom-y);g.clip();
    crayonSurface(x,y,w,bottom-y,.58);
    for(let j=0;j<Math.ceil(w/43);j++){
      const xx=x+12+j*43,yy=y+22+(j*17)%68;
      g.strokeStyle=j%2?'rgba(255,227,180,.34)':'rgba(104,64,56,.28)';
      g.lineWidth=2+(j%3);g.lineCap='round';g.beginPath();
      g.moveTo(xx,yy);g.lineTo(xx+13,yy-5);g.moveTo(xx+5,yy+8);g.lineTo(xx+19,yy+3);g.stroke();
    }g.restore();
  }
  function drawAdventureTerrain(){
    const left=Math.max(0,Math.floor(camera/12)*12-24),right=Math.min(stageEnd,camera+W+36);
    for(let x=left;x<right;x+=12){
      const nx=Math.min(right,x+12),h1=terrainHeight(x+1),h2=terrainHeight(nx-1);
      if(!Number.isFinite(h1)||!Number.isFinite(h2))continue;
      g.fillStyle=crayonSoil()&&soilPattern?soilPattern:'#aa8060';g.beginPath();g.moveTo(x,h1);g.lineTo(nx,h2);g.lineTo(nx,H+360);g.lineTo(x,H+360);g.closePath();g.fill();
      if(!crayonSoil())crayonGroundDetails(x,Math.min(h1,h2),nx-x,H+360);
      g.strokeStyle=crayonSoil()?'rgba(65,123,64,.32)':'#579451';g.lineWidth=11;g.beginPath();g.moveTo(x,h1);g.lineTo(nx,h2);g.stroke();
      if(!crayonSoil())crayonEdge(x,h1,nx,h2,'#345e40');
      g.strokeStyle=crayonSoil()?'rgba(173,221,120,.20)':'#b4da83';g.lineWidth=5;g.beginPath();g.moveTo(x,h1-3);g.lineTo(nx,h2-3);g.stroke();
      if(Math.floor(x/12)%4===0){g.fillStyle='rgba(92,63,48,.20)';g.beginPath();g.ellipse(x+8,Math.max(h1,h2)+25,7,4,0,0,Math.PI*2);g.fill();}
    }
    drawCrayonGroundOverlay();
    for(const hole of pits){
      g.fillStyle='#24283b';g.fillRect(hole.x,Math.min(terrainHeight(hole.x-2),terrainHeight(hole.x+hole.w+2))-5,hole.w,H+380);
      g.fillStyle='#f0b24b';g.font='bold 22px sans-serif';g.textAlign='center';g.fillText('⚠',hole.x+hole.w/2,Math.min(terrainHeight(hole.x-2),terrainHeight(hole.x+hole.w+2))-18);
    }
    // 高台の足場は葉っぱではなく草つきの土ブロックで描く。
    for(const a of platforms){
      if(!a.highway)continue;
      if(drawCrayonHighway(a))continue;
      g.fillStyle='#9e7658';g.fillRect(a.x,a.y,a.w,a.h);crayonGroundDetails(a.x,a.y,a.w,a.y+a.h);
      g.fillStyle='#82b961';g.fillRect(a.x,a.y-7,a.w,9);
      g.strokeStyle='#6a4c3b';g.lineWidth=2;g.strokeRect(a.x,a.y,a.w,a.h);
    }
    // Ver.3.4: 分かれ道の目印。上はボーナス、下は通常ルート。
    g.save();
    for(const sx of [1845,4890]){
      const sy=terrainHeight(sx);
      if(!Number.isFinite(sy))continue;
      g.fillStyle='#8b6548';g.fillRect(sx,sy-91,7,91);
      g.fillStyle='#fff4d8';g.strokeStyle='#a67b55';g.lineWidth=3;
      g.fillRect(sx-45,sy-112,142,43);g.strokeRect(sx-45,sy-112,142,43);
      g.fillStyle='#76543a';g.font='bold 17px sans-serif';g.textAlign='center';
      g.fillText('↑ ボーナス',sx+26,sy-85);
      g.fillStyle='#fff4d8';g.fillRect(sx-28,sy-66,124,34);g.strokeRect(sx-28,sy-66,124,34);
      g.fillStyle='#76543a';g.font='bold 15px sans-serif';g.fillText('→ ゴール',sx+33,sy-44);
    }
    g.restore();
    // ブロックの階段: 上に乗れる固定足場と土の支柱
    for(const a of platforms){
      if(!a.stair)continue;
      if(drawCrayonStair(a))continue;
      g.fillStyle='#a77c5e';g.fillRect(a.x,a.y,a.w,H+200-a.y);crayonGroundDetails(a.x,a.y,a.w,H+200);
      g.fillStyle='#78ad61';g.fillRect(a.x,a.y-7,a.w,9);
      g.strokeStyle='#537746';g.lineWidth=2;g.strokeRect(a.x,a.y-7,a.w,9);
      g.strokeStyle='rgba(90,62,43,.30)';g.lineWidth=2;
      for(let sy=a.y+27;sy<H+200;sy+=30){g.beginPath();g.moveTo(a.x,sy);g.lineTo(a.x+a.w,sy);g.stroke();}
      g.fillStyle='#fff6db';g.font='bold 17px sans-serif';g.textAlign='center';g.fillText(String(a.stepNumber||''),a.x+a.w/2,a.y+22);
    }
  }
  const hillPits=[
    {x:1080,w:110},{x:1750,w:115}, {x:2650,w:120},
    {x:3510,w:125}, {x:4450,w:120}, {x:5650,w:125}, {x:6560,w:115}
  ];
  const hillEnemies=[
    {type:'caterpillar',x:590,min:520,max:735,dir:1},
    {type:'bee',x:1420,y:230,min:1350,max:1630,dir:-1},
    {type:'caterpillar',x:2340,min:2250,max:2510,dir:1},
    {type:'bee',x:2910,y:240,min:2820,max:3130,dir:1},
    {type:'snail',x:3830,min:3770,max:3990,dir:-1},
    {type:'snail',x:4240,min:4180,max:4390,dir:1},
    {type:'caterpillar',x:4870,min:4820,max:5020,dir:-1},
    {type:'bee',x:5340,y:225,min:5240,max:5550,dir:1},
    {type:'snail',x:6080,min:6030,max:6240,dir:-1},
    {type:'bee',x:6440,y:250,min:6360,max:6610,dir:-1},
    {type:'caterpillar',x:6770,min:6690,max:6900,dir:1}
  ];
  const hillBlocks=[
    {x:280,y:275},{x:970,y:265},{x:1710,y:295},{x:2800,y:285},
    {x:3380,y:290},{x:3880,y:260},{x:5040,y:305},{x:5990,y:305},{x:6750,y:290}
  ];
  const hillCoins=[
    {x:490,y:335},{x:890,y:275},{x:1340,y:310},{x:1640,y:275},
    {x:2440,y:315},{x:2880,y:275},{x:3350,y:325},{x:3760,y:275},
    {x:4690,y:265},{x:5510,y:265},{x:6390,y:265},{x:6870,y:330}
  ];
  const hillCheckpoints=[2180,4650];
  let checkpoints=[1690];
  let petalClock=0;
  // Ver.2.0: 絵本のページ管理。保存は育成データとは別キー。
  const BOOK_KEY = 'kinchan_storybook_progress_v2';
  const pages = [{name:'はじまりの森',tab:'🌳 森',color:'#b5df9e'},
                 {name:'花咲く丘',tab:'🌸 丘',color:'#f8c4d9'}];
  let pageIndex = 0, unlocked = 0, turning = false, turnStart = 0;
  try { unlocked = Math.min(pages.length-1,Math.max(0,Number(localStorage.getItem(BOOK_KEY))||0)); } catch(e) {}
  const bookStyle = document.createElement('style');
  bookStyle.textContent = `#bookTabs{display:flex;gap:7px;align-items:center;width:min(100%,960px);overflow-x:auto;flex-shrink:0;padding:2px 0}
    #bookTabs button{border:0;border-radius:7px 7px 3px 3px;padding:7px 14px;font-weight:bold;color:#28372f;white-space:nowrap;cursor:pointer}
    #bookTabs button.selected{outline:2px solid white;outline-offset:-2px}
    #bookTabs button:disabled{opacity:.55;cursor:default}
    #pageTurnBtn{display:none;background:#f5e6c9;color:#614329;border:0;border-radius:10px;padding:9px 15px;font-weight:bold;font-size:15px;cursor:pointer}
    #pageTurnBtn.visible{display:inline-block}
    #adventureScreen{touch-action:none}`;
  document.head.appendChild(bookStyle);
  const bookTabs=document.createElement('div');bookTabs.id='bookTabs';
  const turnBtn=document.createElement('button');turnBtn.id='pageTurnBtn';turnBtn.type='button';
  turnBtn.textContent='📖 次のページへ 〈スワイプ〉';
  screen.insertAdjacentElement('beforebegin',bookTabs);
  screen.insertAdjacentElement('afterend',turnBtn);
  function updateTabs(){
    bookTabs.replaceChildren();
    pages.forEach((page,i)=>{
      const b=document.createElement('button');
      b.type='button';b.textContent=i<=unlocked?page.tab:'🔒 '+page.name;
      b.style.background=page.color;b.disabled=i>unlocked;
      if(i===pageIndex)b.classList.add('selected');
      b.addEventListener('click',()=>{if(i<=unlocked&&!turning)selectPage(i);});
      bookTabs.appendChild(b);
    });
  }
  function selectPage(index){
    pageIndex=index;turning=false;turnBtn.classList.remove('visible');
    reset();updateTabs();
    message.textContent='📖 '+pages[pageIndex].name+'：右へ進んでゴールを目指そう！';
  }
  function startTurn(){
    if(!won||turning||pageIndex>=pages.length-1)return;
    turning=true;turnStart=performance.now();turnBtn.classList.remove('visible');
    message.textContent='📖 ページをめくっているよ…';
  }
  turnBtn.addEventListener('click',startTurn);
  let swipeStart=null;
  screen.addEventListener('pointerdown',e=>{if(won)swipeStart={x:e.clientX,y:e.clientY};});
  screen.addEventListener('pointerup',e=>{
    if(!swipeStart)return;
    if(won&&swipeStart.x-e.clientX>55&&Math.abs(swipeStart.y-e.clientY)<130)startTurn();
    swipeStart=null;
  });
  screen.addEventListener('pointercancel',()=>{swipeStart=null;});
  updateTabs();
  // Ver.1.6: 落とし穴とチェックポイント（ステージ座標）
  let pits = [{x:1030,w:125},{x:1960,w:130}];
  let checkpointX = 1690;
  let checkpointActive = false;
  const activatedCheckpoints = new Set();
  let respawnX = 90;
  function isSolidGround(x){
    return !pits.some(hole=>x>=hole.x&&x<=hole.x+hole.w);
  }
  let platforms = [
    {x:420,y:380,w:180,h:22},{x:820,y:320,w:180,h:22},
    {x:1270,y:380,w:190,h:22},{x:1730,y:320,w:190,h:22},
    {x:2260,y:370,w:190,h:22},{x:2750,y:315,w:190,h:22}
  ];
  // ハテナブロック：下から頭で叩くとコインが1枚飛び出す。
  let blockStarts = [
    {x:280,y:275},{x:1090,y:275},{x:2100,y:275},{x:3100,y:275}
  ];
  let blocks = [], coinBursts = [], coinCount = 0;
  let surpriseSprouts=[]; // ブロックから飛び出す芽むし
  let coins = [
    {x:490,y:335},{x:895,y:275},{x:1340,y:335},
    {x:1800,y:275},{x:2320,y:325}
  ];
  const p = {x:90,y:groundY-95,w:85,h:95,vx:0,vy:0,onGround:false};
  const keys = {left:false,right:false,jump:false};
  let running = false, won = false, camera = 0, last = 0, raf = null;
  let collected = new Set();
  // 敵の絵は主人公とは別の保存場所に記録する。
  const ENEMY_KEY = 'kinchan_enemy_image_v1';
  const enemyPicture = new Image();
  let enemyPictureReady = false;
  let enemyStart = [
    {x:650,y:groundY-60,min:575,max:765,dir:1},
    {x:1550,y:groundY-60,min:1490,max:1660,dir:-1},
    {x:2510,y:groundY-60,min:2450,max:2650,dir:1}
  ];
  let enemies = [], lives = 3, points = 0, invulnerableUntil = 0;
  let gameOver = false, gameTime = 0;
  let paintPickupTaken=false;
  let lastHillArea=-1;
  let lastBranch=-1;
  const livesText = document.getElementById('adventureLives');
  const enemyFile = document.getElementById('adventureEnemyFile');
  const enemyUploadBtn = document.getElementById('adventureEnemyUploadBtn');
  enemyUploadBtn.addEventListener('click',()=>enemyFile.click());
  function loadEnemyPicture(src){
    enemyPictureReady=false;
    enemyPicture.onload=()=>{enemyPictureReady=true;};
    enemyPicture.onerror=()=>{enemyPictureReady=false;};
    enemyPicture.src=src;
  }
  try {const saved=localStorage.getItem(ENEMY_KEY);if(saved)loadEnemyPicture(saved);}catch(e){console.warn('敵画像の読み込み:',e);}
  enemyFile.addEventListener('change',function(){
    const file=this.files&&this.files[0];
    if(!file)return;
    if(!file.type.startsWith('image/')){alert('画像を選んでね！');return;}
    const url=URL.createObjectURL(file),img=new Image();
    img.onload=function(){
      const c=document.createElement('canvas');
      const scale=Math.min(1,256/Math.max(img.naturalWidth,img.naturalHeight));
      c.width=Math.max(1,Math.round(img.naturalWidth*scale));
      c.height=Math.max(1,Math.round(img.naturalHeight*scale));
      c.getContext('2d').drawImage(img,0,0,c.width,c.height);
      const png=c.toDataURL('image/png');
      loadEnemyPicture(png);
      try{localStorage.setItem(ENEMY_KEY,png);}catch(e){console.warn('敵画像を保存できませんでした',e);}
      message.textContent='🎨 敵キャラの絵を変更したよ！';
      URL.revokeObjectURL(url);
    };
    img.onerror=()=>{URL.revokeObjectURL(url);alert('画像を読み込めなかったよ');};
    img.src=url;
    this.value='';
  });
  function updateHud(){
    livesText.textContent='❤️'.repeat(lives)+'🖤'.repeat(3-lives)+'　⭐ '+points;
  }

  // Ver.3.8: 復活位置の足元を「地形＋階段」の最上面から計算する。
  // 地面の高さだけを使うと、階段の土柱の内部に復活してしまう。
  function safeSpawnAt(targetX){
    p.x=Math.max(0,Math.min(stageEnd-p.w,targetX));
    const mid=p.x+p.w/2;
    let floor=terrainHeight(mid);
    if(pageIndex===1){
      for(const a of platforms){
        if(!a.stair)continue;
        if(p.x+p.w>a.x+8&&p.x<a.x+a.w-8){
          floor=Math.min(floor,a.y-7);
        }
      }
    }
    if(!Number.isFinite(floor)){
      // 穴の真上に復活地点があれば安全な地面を探す。
      for(let d=15;d<320;d+=15){
        const x=mid+d;
        const y=terrainHeight(x);
        if(Number.isFinite(y)){p.x=Math.min(stageEnd-p.w,x-p.w/2);floor=y;break;}
      }
    }
    if(!Number.isFinite(floor))floor=groundY;
    p.y=floor-p.h-2;
    p.vx=0;p.vy=0;p.onGround=true;
  }
  function checkpointSpawnX(cx){
    if(pageIndex!==1)return cx+45;
    // 旗が階段の途中にある場合、最上段の天面に復活させる。
    const stair=platforms.filter(a=>a.stair&&cx>=a.x-20&&cx<a.x+a.w+20);
    if(stair.length){
      const setEnd=Math.max(...platforms.filter(a=>a.stair&&Math.abs(a.x-cx)<430).map(a=>a.x));
      return setEnd+8;
    }
    return cx+45;
  }
  function reset() {
    stageEnd=pageIndex===1?7200:3600;
    checkpoints=pageIndex===1?[...hillCheckpoints]:[1690];
    checkpointX=checkpoints[0];
    blockStarts=pageIndex===1?hillBlocks.map(v=>({...v})):[{x:280,y:275},{x:1090,y:275},{x:2100,y:275},{x:3100,y:275}];
    coins=pageIndex===1?hillCoins.map(v=>({...v})):[{x:490,y:335},{x:895,y:275},{x:1340,y:335},{x:1800,y:275},{x:2320,y:325}];
    pits=pageIndex===1?hillPits.map(v=>({...v})):[{x:1030,w:125},{x:1960,w:130}];
    platforms=pageIndex===1?hillPlatforms.map(v=>({...v,baseX:v.x,baseY:v.y,prevX:v.x,prevY:v.y})):[{x:420,y:380,w:180,h:22},{x:820,y:320,w:180,h:22},{x:1270,y:380,w:190,h:22},{x:1730,y:320,w:190,h:22},{x:2260,y:370,w:190,h:22},{x:2750,y:315,w:190,h:22}];
    if(pageIndex===1){
      platforms.push(...extraLeafPlatforms.map(v=>({...v,baseX:v.x,baseY:v.y,prevX:v.x,prevY:v.y})));
    }
    enemyStart=pageIndex===1?hillEnemies.map(v=>({...v})):[{x:650,y:groundY-60,min:575,max:765,dir:1},{x:1550,y:groundY-60,min:1490,max:1660,dir:-1},{x:2510,y:groundY-60,min:2450,max:2650,dir:1}];
    flowerDust=[];windParticles=[];lastWindZone=-1;lastHillArea=0;lastBranch=-1;visibleSaturation=1;paintPickupTaken=false;
    safeSpawnAt(90);
    camera=0; cameraY=0; won=false; gameOver=false; turning=false;turnBtn.classList.remove('visible');collected=new Set();
    checkpointActive=false;respawnX=90;activatedCheckpoints.clear();
    if(pageIndex===1){
      // 明確な階段: 低い段から順にジャンプで登れる。
      const stairSets=[
        {x:1230,y:420},{x:2820,y:435},{x:4500,y:415},
        {x:6180,y:445}
      ];
      for(const set of stairSets){
        for(let i=0;i<6;i++){
          const x=set.x+i*65, y=set.y-i*38;
          platforms.push({x,y,w:67,h:24,stair:true,stepNumber:i+1,baseX:x,baseY:y,prevX:x,prevY:y});
        }
      }
      // Ver.5.2: 序盤・終盤の葉っぱ、単独の雲、中盤の3段階チャレンジ。
      addRewardPlatforms();
    }
    // Ver.3.9: 階段上の通路を確保し、復活位置を安全な足場に。
    // Ver.3.6: 配置チェック。土の壁・階段の柱にアイテムが埋まらないようにする。
    // カメラ・操作感・ジャンプ力はVer.3.5のまま。
    if(pageIndex===1){
      const stairs=platforms.filter(a=>a.stair);
      const solidTop=(x)=>{
        let top=terrainHeight(x);
        for(const a of stairs){
          if(x>=a.x-3&&x<=a.x+a.w+3)top=Math.min(top,a.y);
        }
        return top;
      };
      const overlapsStair=(x,w)=>stairs.some(a=>x<a.x+a.w+5&&x+w>a.x-5);
      // Ver.3.9: 階段近くのブロックは、土柱の中・進路上ではなく頭上へ。
      // 以前は階段の終端へ水平移動させたため、次の段の正面に残ることがあった。
      blockStarts=blockStarts.map(src=>{
        let x=src.x, y=src.y;
        const nearby=stairs.filter(a=>x<a.x+a.w+75 && x+58>a.x-75);
        if(nearby.length){
          // 一番高い段の天面を基準に、きのちゃん(高さ95)が下を通れる余裕を確保。
          const top=Math.min(...nearby.map(a=>a.y));
          y=Math.min(y,top-58-112);
        }
        // 階段以外の地面でも、最低限の通行空間を確保。
        const floor=terrainHeight(x+29);
        if(Number.isFinite(floor))y=Math.min(y,floor-58-112);
        for(const a of platforms){
          if(a.stair)continue;
          if(x<a.x+a.w && x+58>a.x && y<a.y+a.h && y+58>a.y){
            // 固定足場と重なったら上へ。下へ動かして通路を塞がない。
            y=a.y-58-12;
          }
        }
        return {...src,x,y};
      });
      coins=coins.map(src=>{
        let x=src.x,y=src.y;
        // 地面と階段の土柱に隠れたコインは、地表より上へ移動。
        const top=solidTop(x);
        if(Number.isFinite(top)&&y+19>top-10)y=top-54;
        // ハテナブロックの内部にコインを置かない。
        for(const b of blockStarts){
          if(Math.abs(x-(b.x+29))<48&&y>b.y-24&&y<b.y+82){
            y=b.y-45;
          }
        }
        // 足場の内部に重なるコインは足場の上へ。
        for(const a of platforms){
          if(x>a.x-15&&x<a.x+a.w+15&&y+19>a.y&&y-19<a.y+a.h){
            y=Math.min(y,a.y-42);
          }
        }
        return {...src,x,y};
      });
    }
    enemies=enemyStart.map(e=>({...e,w:e.type==='bee'?62:64,h:e.type==='bee'?48:60,
      y:e.y??groundY-60,baseY:e.y??groundY-60,alive:true,shellUntil:0}));
    lives=3;points=0;invulnerableUntil=0;gameTime=0;
    blocks=blockStarts.map((b,i)=>({...b,w:58,h:58,used:false,bump:0,
      surprise:pageIndex===1&&[3,5,7].includes(i)}));
    surpriseSprouts=[];
    coinBursts=[];coinCount=0;coinCountText.textContent='🪙 0';
    updateHud();
    keys.left=false; keys.right=false; keys.jump=false;
    scoreText.textContent=`🍄 0 / ${coins.length}`;
    message.textContent=pageIndex===1?'🌸 葉っぱや雲はお宝への寄り道！ 中盤には葉っぱ→雲→ブロックもあるよ！':'右に進んで、キラキラを5つ集めよう！';
  }
  function close() {
    running=false;
    if(raf!==null) cancelAnimationFrame(raf);
    raf=null;
    keys.left=keys.right=keys.jump=false;
    overlay.classList.remove('open');
    accentCanvas.style.display='none';
    document.body.style.overflow=overlay.dataset.oldOverflow||'';
  }
  function open() {
    if(!imageReady || !born) {
      alert('まずモンスターを誕生させてね！🍄');
      return;
    }
    if(running)return;
    overlay.dataset.oldOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    overlay.classList.add('open');
    selectPage(unlocked); running=true; last=performance.now();
    raf=requestAnimationFrame(loop);
  }
  playBtn.addEventListener('click',open);
  document.getElementById('adventureBack').addEventListener('click',close);
  document.getElementById('adventureRetry').addEventListener('click',()=>selectPage(pageIndex));

  function bindHold(id, key) {
    const b=document.getElementById(id);
    b.addEventListener('pointerdown', e=>{
      e.preventDefault();
      try{b.setPointerCapture(e.pointerId);}catch(_){}
      keys[key]=true;
    });
    for(const type of ['pointerup','pointercancel','lostpointercapture']){
      b.addEventListener(type,()=>{keys[key]=false;});
    }
    b.addEventListener('contextmenu',e=>e.preventDefault());
  }
  bindHold('adventureLeft','left');
  bindHold('adventureRight','right');
  bindHold('adventureJump','jump');
  document.addEventListener('keydown',e=>{
    if(!running)return;
    if(['ArrowLeft','ArrowRight','ArrowUp','Space'].includes(e.code))e.preventDefault();
    if(e.code==='ArrowLeft')keys.left=true;
    if(e.code==='ArrowRight')keys.right=true;
    if(e.code==='ArrowUp'||e.code==='Space')keys.jump=true;
    if(e.code==='Escape')close();
  });
  document.addEventListener('keyup',e=>{
    if(e.code==='ArrowLeft')keys.left=false;
    if(e.code==='ArrowRight')keys.right=false;
    if(e.code==='ArrowUp'||e.code==='Space')keys.jump=false;
  });
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden&&running)close();
  });

  function update(dt) {
    if(won||gameOver||turning)return;
    const t=Math.min(2,dt/16.667);
    gameTime+=dt;
    flowerDust=flowerDust.filter(d=>{d.age+=dt;d.x+=d.vx*t;d.y+=d.vy*t;d.vy+=.012*t;return d.age<850;});
    for(const a of platforms){
      if(pageIndex!==1)break;
      a.bloom=Math.max(0,(a.bloom||0)-dt/1100);
      a.spring=Math.max(0,(a.spring||0)-dt/650);
      a.springAge=(a.springAge||0)+dt;
    }
    // 花咲く丘：風に運ばれる雲の足場。前フレームからの移動量も保持。
    if(pageIndex===1){
      for(const a of platforms){
        if(!a.moving)continue;
        a.prevX=a.x;a.prevY=a.y;
        if(a.vertical)a.y=a.baseY+Math.sin(gameTime*a.speed)*a.range;
        else a.x=a.baseX+Math.sin(gameTime*a.speed)*a.range;
      }
    }
    // 上下ルートへの案内（エリアに入ったときだけ表示）
    if(pageIndex===1){
      const branch=p.x>=1810&&p.x<2670?0:p.x>=4840&&p.x<5720?1:-1;
      if(branch!==lastBranch){
        lastBranch=branch;
        if(branch>=0)message.textContent='🌟 葉っぱや雲からジャンプして、高い星を集めよう！';
      }
    }
    const dir=(keys.right?1:0)-(keys.left?1:0);
    const wind=currentWind();
    // 空中では風の影響が少し大きく、地面では操作しやすいように抑える。
    p.vx=dir*5.5+wind*(p.onGround?.65:1);
    if(pageIndex===1&&Math.abs(wind)>.1&&Math.random()<.35){
      const zone=hillWindZones.find(z=>p.x+p.w/2>=z.x&&p.x+p.w/2<=z.x+z.w);
      if(zone)windParticles.push({x:camera+(wind>0?-20:W+20),y:70+Math.random()*320,
        vx:wind>0?3.3:-3.3,age:0,length:18+Math.random()*28});
    }
    windParticles=windParticles.filter(v=>{v.x+=v.vx*t;v.age+=dt;return v.age<3800;});
    if(keys.jump&&p.onGround){p.vy=-15;p.onGround=false;}
    const previousBottom=p.y+p.h;
    p.wasGrounded=p.onGround;
    // 動く足場に立っている間は、足場と一緒に運ばれる。
    if(pageIndex===1&&p.onGround){
      for(const a of platforms){
        if(a.moving&&Math.abs(previousBottom-(a.prevY??a.y))<5&&p.x+p.w>a.prevX+8&&p.x<a.prevX+a.w-8){
          p.x+=a.x-a.prevX;p.y+=a.y-(a.prevY??a.y);break;
        }
      }
    }
    const previousTop=p.y;
    const previousX=p.x;
    p.x=Math.max(0,Math.min(stageEnd-p.w,p.x+p.vx*t));
    // Ver.3.3: 階段は見た目だけの土柱ではなく、左右から入れない固体。
    // 頭上まで飛び越えた場合は横移動を妨げない。
    if(pageIndex===1){
      const stairWalls=platforms.filter(a=>a.stair);
      if(p.x>previousX){
        let stopX=p.x;
        for(const a of stairWalls){
          if(previousX+p.w<=a.x+2 && stopX+p.w>a.x &&
             previousTop+p.h>a.y+6 && previousTop<H+200){
            stopX=Math.min(stopX,a.x-p.w);
          }
        }
        p.x=Math.max(previousX,stopX);
      }else if(p.x<previousX){
        let stopX=p.x;
        for(const a of stairWalls){
          if(previousX>=a.x+a.w-2 && stopX<a.x+a.w &&
             previousTop+p.h>a.y+6 && previousTop<H+200){
            stopX=Math.max(stopX,a.x+a.w);
          }
        }
        p.x=Math.min(previousX,stopX);
      }
    }
    p.vy=Math.min(20,p.vy+0.7*t);
    p.y+=p.vy*t;
    p.onGround=false;
    // 上昇中にブロックの下面を叩いたらコインを出す。
    if(p.vy<0){
      for(const b of blocks){
        const horizontal=p.x+p.w>b.x+5&&p.x<b.x+b.w-5;
        const crossed=previousTop>=b.y+b.h-5&&p.y<=b.y+b.h;
        if(horizontal&&crossed){
          p.y=b.y+b.h;p.vy=2;
          b.bump=10;
          if(!b.used){
            b.used=true;
            if(b.surprise){
              // 芽むしは上に飛び出し、重力で落ちてから地面を歩き回る。
              surpriseSprouts.push({x:b.x+b.w/2-30,y:b.y-56,w:60,h:58,
                vy:-12,dir:(p.x<b.x?1:-1),alive:true,landed:false,age:0});
              message.textContent='🌱 びっくり！ ブロックから芽むしが飛び出した！';
            }else{
              coinCount++;points+=50;
              coinCountText.textContent='🪙 '+coinCount;
              coinBursts.push({x:b.x+b.w/2,y:b.y-5,age:0});
              message.textContent='🪙 コインが出た！ +50点';
              updateHud();
            }
          }else{
            message.textContent='🟫 このブロックはもう空っぽ！';
          }
          break;
        }
      }
    }
    for(const b of blocks){b.bump=Math.max(0,b.bump-dt*.07);}
    coinBursts=coinBursts.filter(c=>{c.age+=dt;return c.age<700;});
    if(p.vy>=0){
      let landing=Infinity;
      // 足元の中央が穴の上なら地面には着地できない。
      const floor=terrainHeight(p.x+p.w/2);
      // 坂道は接地中に自然に登れる。ジャンプ中は上から横切ったときのみ着地。
      if(Number.isFinite(floor)&&p.y+p.h>=floor&&
        (previousBottom<=floor+Math.max(5,Math.abs(p.vx*t)*.65+8)|| (p.wasGrounded&&p.vy>=0&&p.y+p.h<floor+32)))landing=floor;
      for(const a of [...platforms,...blocks]){
        if(p.x+p.w>a.x+7&&p.x<a.x+a.w-7&&previousBottom<=a.y+4&&p.y+p.h>=a.y){
          landing=Math.min(landing,a.y);
        }
      }
      if(landing!==Infinity){
        // 葉っぱ・雲に着地した瞬間、ふわっと沈み小さな光が舞う。
        if(pageIndex===1 && previousBottom<landing-2){
          const landingPlatform=platforms.find(a=>Math.abs(a.y-landing)<.5 && p.x+p.w>a.x+7 && p.x<a.x+a.w-7);
          if(landingPlatform){
            landingPlatform.bloom=1;landingPlatform.spring=1;landingPlatform.springAge=0;
            for(let i=0;i<13;i++){
              const angle=(i/13)*Math.PI*2;
              flowerDust.push({x:landingPlatform.x+landingPlatform.w/2+(i%5-2)*7,y:landingPlatform.y+5,
                vx:Math.cos(angle)*(0.4+(i%4)*.23),vy:-.65-Math.abs(Math.sin(angle))*.7,
                age:0,size:2.5+(i%3),color:i%2?'#fff1a1':(landingPlatform.moving?'#c6f2ff':'#b4ec9b')});
            }
          }
        }
        p.y=landing-p.h;p.vy=0;p.onGround=true;
      }
    }
    // チェックポイントに触れたら復活地点を更新。
    for(const cx of checkpoints){
      if(p.x+p.w>=cx&&p.x<=cx+22&&cx+45>respawnX){
        checkpointActive=true;respawnX=checkpointSpawnX(cx);
        activatedCheckpoints.add(cx);
        message.textContent='🚩 チェックポイント通過！次はここから再開！';
      }
    }
    // 穴に落ちた場合はライフを1つ減らして復活。
    if(p.y>H+65){
      lives=Math.max(0,lives-1);updateHud();
      if(lives===0){
        gameOver=true;message.textContent='💔 落とし穴！ゲームオーバー！「やり直す」で再挑戦！';
      }else{
        safeSpawnAt(respawnX);
        invulnerableUntil=gameTime+2000;keys.jump=false;
        message.textContent=checkpointActive?'🚩 穴に落ちた！チェックポイントから再開！':'🕳️ 穴に落ちた！スタートから再開！';
      }
      camera=Math.max(0,Math.min(stageEnd-W,p.x-W*0.33));
      return;
    }
    // Ver.5.5: ブロックから出た芽むし。空中では衝突判定をせず、着地後に歩く。
    for(const e of surpriseSprouts){
      if(!e.alive)continue;
      e.age+=dt;
      if(!e.landed){
        e.vy=Math.min(17,e.vy+.68*t);
        e.y+=e.vy*t;
        const center=e.x+e.w/2;
        let floor=terrainHeight(center);
        // 階段の上にも着地できる。
        for(const a of platforms){
          if(a.stair&&center>=a.x&&center<=a.x+a.w)floor=Math.min(floor,a.y-7);
        }
        if(e.vy>=0&&Number.isFinite(floor)&&e.y+e.h>=floor){
          e.y=floor-e.h;e.vy=0;e.landed=true;
        }
        if(e.y>H+100)e.alive=false;
      }else{
        // Ver.5.6: 体の前端で穴・急な壁・階段の側面を検出する。
        // 中心点だけの地面判定だと階段の壁をすり抜けてしまう。
        const next=e.x+e.dir*.95*t;
        const center=e.x+e.w/2;
        const front=next+(e.dir>0?e.w-5:5);
        const currentFoot=e.y+e.h;
        const nextFloor=terrainHeight(front);
        let blocked=next<0||next+e.w>stageEnd||!Number.isFinite(nextFloor);
        if(!blocked && (nextFloor<currentFoot-15 || nextFloor>currentFoot+28))blocked=true;
        // 階段は足場上面だけでなく側面も壁として扱う。
        for(const a of platforms){
          if(!a.stair)continue;
          const crossing=next<a.x+a.w-5 && next+e.w>a.x+5;
          if(!crossing)continue;
          const standingOnTop=Math.abs(currentFoot-a.y)<13 &&
            center>a.x+5 && center<a.x+a.w-5;
          if(!standingOnTop && currentFoot>a.y+13 && e.y<a.y+a.h+8){
            blocked=true;break;
          }
        }
        if(blocked){e.dir*=-1;}
        else{
          e.x=next;
          let floor=terrainHeight(e.x+e.w/2);
          // 既に階段の上に乗っている場合は、段の上を歩く。
          for(const a of platforms){
            if(a.stair&&e.x+e.w/2>a.x+6&&e.x+e.w/2<a.x+a.w-6&&
               Math.abs(currentFoot-a.y)<16)floor=Math.min(floor,a.y);
          }
          if(Number.isFinite(floor))e.y=floor-e.h;
        }
        const overlap=p.x<e.x+e.w-8&&p.x+p.w>e.x+8&&
          p.y<e.y+e.h-7&&p.y+p.h>e.y+7;
        if(overlap){
          if(p.vy>=0&&previousBottom<=e.y+18){
            e.alive=false;points+=100;p.vy=-11;p.onGround=false;
            message.textContent='🌱 芽むしを踏んだ！ +100点';updateHud();
          }else if(gameTime>=invulnerableUntil){
            lives=Math.max(0,lives-1);invulnerableUntil=gameTime+2000;
            p.vy=-7;p.onGround=false;
            p.x=Math.max(0,previousX+(p.x<e.x?-45:45));updateHud();
            if(lives===0){gameOver=true;message.textContent='💔 ゲームオーバー！「やり直す」で再挑戦！';}
            else message.textContent='💔 芽むしにぶつかった！ 2秒間は無敵だよ';
          }
        }
      }
    }
    // Ver.2.9: イモムシ・飛ぶミツバチ・殻に隠れるカタツムリ。
    for(const e of enemies){
      if(!e.alive)continue;
      const snail=pageIndex===1&&e.type==='snail';
      const bee=pageIndex===1&&e.type==='bee';
      const hidden=snail&&gameTime<e.shellUntil;
      if(!hidden){
        e.x+=e.dir*(snail?.62:bee?1.45:1.15)*t;
        if(e.x<=e.min){e.x=e.min;e.dir=1;}
        if(e.x>=e.max){e.x=e.max;e.dir=-1;}
      }
      if(bee)e.y=e.baseY+Math.sin(gameTime*.003+e.min*.01)*24;
      if(hidden)continue; // 殻の中は安全。少し経つとまた歩き出す。
      const overlap=p.x<e.x+e.w-8&&p.x+p.w>e.x+8&&p.y<e.y+e.h-7&&p.y+p.h>e.y+7;
      if(!overlap)continue;
      const stomp=p.vy>=0&&previousBottom<=e.y+18&&p.y+p.h>=e.y+7;
      if(stomp){
        if(snail){
          e.shellUntil=gameTime+3500;
          points+=50;message.textContent='🐌 カタツムリが殻に隠れた！ +50点';
        }else{
          e.alive=false;points+=100;
          message.textContent=bee?'🐝 ミツバチを踏んだ！ +100点':
            (pageIndex===1?'🐛 イモムシを踏んだ！ +100点':'💥 スライムを踏んだ！ +100点');
        }
        p.vy=-11;p.onGround=false;updateHud();
      }else if(gameTime>=invulnerableUntil){
        lives=Math.max(0,lives-1);invulnerableUntil=gameTime+2000;
        p.vy=-7;p.onGround=false;
        p.x=Math.max(0,previousX+(p.x<e.x?-45:45));
        updateHud();
        if(lives===0){gameOver=true;message.textContent='💔 ゲームオーバー！「やり直す」で再挑戦！';}
        else{message.textContent='💔 ぶつかった！ 2秒間は無敵だよ';}
      }
    }
    if(pageIndex===1&&!paintPickupTaken&&Math.abs(p.x+40-1830)<54&&Math.abs(p.y+50-275)<75){
      paintPickupTaken=true;
      if(lives<3){lives++;updateHud();message.textContent='🎨 絵の具を拾った！ライフと色が戻った！';}
      else{points+=100;updateHud();message.textContent='🎨 絵の具を拾った！ +100点';}
    }
    coins.forEach((c,i)=>{
      if(!collected.has(i)&&Math.abs((p.x+p.w/2)-c.x)<55&&Math.abs((p.y+p.h/2)-c.y)<70){
        collected.add(i);
        scoreText.textContent=`🍄 ${collected.size} / ${coins.length}`;
      }
    });
    // 少し引いた画角で上下の分岐を同時に見せる。
    const z=viewZoom(), visibleW=W/z;
    const desiredX=p.x-(W*.34)/z;
    camera=Math.max(0,Math.min(Math.max(0,stageEnd-visibleW),desiredX));
    if(pageIndex===1){
      // 主人公を画面のやや上に配置し、下の道を広く見せる。
      const desired=Math.max(-200,Math.min(145,p.y+p.h/2-H*.40/z));
      // 細かいジャンプには追従せず、ゆっくり上下する。
      if(Math.abs(desired-cameraY)>18)cameraY+=(desired-cameraY)*.032;
    }else cameraY=0;
    // 花咲く丘は最後に地面に降りてゴール。空中の足場から通過するだけでは不可。
    const finishGround=terrainHeight(p.x+p.w/2);
    const groundedAtFinish=pageIndex!==1 ||
      (Number.isFinite(finishGround) && p.onGround &&
       Math.abs((p.y+p.h)-finishGround)<18);
    if(p.x+p.w>=stageEnd-110 && groundedAtFinish){
      won=true;
      if(pageIndex+1<pages.length){
        unlocked=Math.max(unlocked,pageIndex+1);
        try{localStorage.setItem(BOOK_KEY,String(unlocked));}catch(e){console.warn('ふせん保存に失敗',e);}
        updateTabs();turnBtn.classList.add('visible');
        message.textContent='🏁 '+pages[pageIndex].name+' クリア！右から左へスワイプしてページをめくろう 📖';
      }else{
        message.textContent='🎉 '+pages[pageIndex].name+' クリア！絵本の続きは制作中。ふせんで戻れるよ！';
      }
    }
  }
  // Ver.1.7: 絵本「はじまりの森」明るい水彩背景（画像＋JSアニメーション）
  // 軽量版：画像埋め込みを使わず、絵本風の森をCanvasで描画
  function drawLightForest() {
    const sky=g.createLinearGradient(0,0,0,H);
    sky.addColorStop(0,'#c8e9f1');sky.addColorStop(.68,'#f5f4df');sky.addColorStop(1,'#d8e6c4');
    g.fillStyle=sky;g.fillRect(0,0,W,H);
    const hill=(offset,color,base,amp)=>{
      g.fillStyle=color;g.beginPath();g.moveTo(0,H);
      for(let x=0;x<=W+12;x+=12){
        const world=x+camera*offset;
        const y=base+Math.sin(world/155)*amp+Math.sin(world/69)*amp*.23;
        g.lineTo(x,y);
      }
      g.lineTo(W,H);g.closePath();g.fill();
    };
    hill(.07,'#cbdcbf',260,32);hill(.14,'#b6d5b0',318,27);
    // 遠景の木：スクロール速度を抑えたパララックス
    for(let i=-2;i<19;i++){
      const x=i*85-(camera*.19%85),y=300+(i%3)*13;
      g.fillStyle='#b9ad91';g.fillRect(x-4,y-55,8,75);
      for(let j=0;j<3;j++){
        g.fillStyle=['#b5d1a6','#9ec69c','#c5d8ae'][((i+j)%3+3)%3];
        g.beginPath();g.ellipse(x+(j-1)*16,y-58-j*9,27,43,-.14,0,Math.PI*2);g.fill();
      }
    }
    // 紙のような淡い斑点
    for(let i=0;i<65;i++){
      const x=(i*173+37)%W,y=(i*89+11)%H;
      g.fillStyle='rgba(255,255,255,.075)';g.beginPath();g.arc(x,y,8+i%19,0,Math.PI*2);g.fill();
    }
  }
  const flowerSeeds = Array.from({length:95},(_,i)=>({
    x:((i*137+53)%stageEnd), h:7+(i*11)%15, phase:i*1.9,
    color:['#f8a5a9','#f6d88b','#e4b3ec','#fff8e5'][i%4]
  }));
  // Ver.1.9: GitHub上の背景画像を利用（画像アップロード不要）。
  // 未設定でも従来の森が表示される安全設計。
  const STORYBOOK_BACKGROUND_URL = 'https://raw.githubusercontent.com/yosipon1005-netizen/kinchan-game/main/kinchan_storybook_background.jpg';
  const storybookArt = new Image();
  let storybookReady = false;
  if (STORYBOOK_BACKGROUND_URL.startsWith('https://')) {
    storybookArt.onload = () => { storybookReady = true; };
    storybookArt.onerror = () => { storybookReady = false; };
    storybookArt.src = STORYBOOK_BACKGROUND_URL;
  }
  function paintForestBackground() {
    if(pageIndex===1 && flowerReady){
      // Ver.3.1: 地形が主役なので背景を淡くして遠景にする。
      // 画像が未アップロードの場合は従来の花咲く丘背景にフォールバック。
      const progress=Math.max(0,Math.min(4,camera/Math.max(1,stageEnd-W)*5));
      const area=Math.min(4,Math.floor(progress));
      const fraction=progress-area;
      const drawScene=(index,alpha)=>{
        const art=hillScenery[index];
        const pic=art&&hillSceneryReady[index]?art:flowerArt;
        const sw=Math.min(pic.naturalWidth,1080);
        const left=Math.max(0,pic.naturalWidth-sw)*camera/Math.max(1,stageEnd-W);
        g.save();g.globalAlpha=alpha*.33;
        g.drawImage(pic,left,0,sw,pic.naturalHeight,0,0,W,H);
        g.restore();
      };
      drawScene(area,1);
      // エリアの後半だけ緩やかに次の景色へ。切り替わりの瞬間を目立たせない。
      if(area<4 && fraction>.60){drawScene(area+1,(fraction-.60)/.40);}
      // 風に舞う花びら
      const tick=performance.now()*.00024;
      for(let i=0;i<44;i++){
        const x=((i*131+tick*80-camera*.025)%(W+60)+W+60)%(W+60)-30;
        const y=(i*73+tick*55*(1+i%3*.2))%(H+40)-20;
        g.fillStyle=i%2?'rgba(255,191,218,.75)':'rgba(255,255,245,.8)';
        g.beginPath();g.ellipse(x,y,6+(i%4),3+(i%3),i*.9,0,Math.PI*2);g.fill();
      }
      return;
    }
    if (storybookReady) {
      // 画像の一部をゆっくりずらして、奥の森をパララックス表示。
      const sw = Math.min(storybookArt.naturalWidth, 1080);
      const maxLeft = Math.max(0, storybookArt.naturalWidth - sw);
      const left = Math.min(maxLeft, camera / Math.max(1, stageEnd-W) * maxLeft);
      g.drawImage(storybookArt, left, 0, sw, storybookArt.naturalHeight, 0, 0, W, H);
      // 地面の境界付近を薄く明るくして、キャラクターを見やすく。
      const haze = g.createLinearGradient(0, 275, 0, groundY);
      haze.addColorStop(0, 'rgba(255,250,225,0)');
      haze.addColorStop(1, 'rgba(255,252,230,.16)');
      g.fillStyle=haze;g.fillRect(0,275,W,groundY-275);
    } else {
      drawLightForest();
    }
    if(pageIndex===1){
      // 2ページ目：同じ絵本画像を薄い桃色で染め、花びらを重ねて別の画風に。
      g.fillStyle='rgba(255,205,225,.25)';g.fillRect(0,0,W,H);
      const t2=performance.now()*.00035;
      for(let i=0;i<65;i++){
        const x=((i*179+Math.sin(t2+i)*35-camera*.045)%(W+50)+W+50)%(W+50)-25;
        const y=((i*83+t2*45*(1+i%3*.25))%(H+40))-20;
        g.fillStyle=i%3===0?'rgba(255,255,245,.75)':'rgba(246,151,187,.65)';
        g.beginPath();g.ellipse(x,y,7+(i%4),4+(i%3),i*.6,0,Math.PI*2);g.fill();
      }
    }
    const t=performance.now()*.008;
    for(let i=0;i<5;i++){
      const x=((i*245+t*(.4+i*.1)-camera*.07)%(W+280)+W+280)%(W+280)-110;
      const y=42+(i*41)%112;
      g.fillStyle='rgba(255,255,255,.27)';
      for(let k=0;k<4;k++){g.beginPath();g.ellipse(x+k*25,y+Math.sin(k)*8,44,15,0,0,Math.PI*2);g.fill();}
    }
  }
  function paintForestFlowers() {
    const t=performance.now()*.001;
    for(const f of flowerSeeds){
      if(f.x<camera-30||f.x>camera+W+30||!isSolidGround(f.x))continue;
      const sway=Math.sin(t*1.6+f.phase)*3;
      g.strokeStyle='#558d56';g.lineWidth=2.5;
      g.beginPath();g.moveTo(f.x,groundY+3);g.quadraticCurveTo(f.x+sway,groundY-f.h/2,f.x+sway,groundY-f.h);g.stroke();
      g.fillStyle=f.color;
      for(let a=0;a<5;a++){const ang=a*Math.PI*2/5;g.beginPath();g.arc(f.x+sway+Math.cos(ang)*4,groundY-f.h+Math.sin(ang)*4,4,0,Math.PI*2);g.fill();}
      g.fillStyle='#efc46e';g.beginPath();g.arc(f.x+sway,groundY-f.h,2.5,0,Math.PI*2);g.fill();
    }
  }
  // Ver.2.7.3: 当たり判定・移動処理は変更せず、足場の見た目だけ改善。
  let flowerDust=[];
  function drawLeafCloud(ctx,a){
    const cx=a.x+a.w/2;
    const time=gameTime*.001;
    const impact=(a.spring||0)*Math.sin((a.springAge||0)*.035)*3;
    const y=a.y+impact;
    ctx.save();
    ctx.lineJoin='round';
    ctx.lineCap='round';
    if(a.moving){
      const cloudArt=crayonAssets[a.w<135?'cloud_small':'cloud_plain'];
      const fallbackArt=crayonAssets.cloud_plain;
      const cloud=cloudArt&&cloudArt.ready?cloudArt:(fallbackArt&&fallbackArt.ready?fallbackArt:null);
      if(cloud){
        const bob=Math.sin(time*1.7+a.baseX*.012)*1.3;
        // a.y の足場判定はそのまま、見た目だけ画像に変更。
        ctx.drawImage(cloud.img,a.x-8,y-43+bob,a.w+16,66);
        ctx.restore();return;
      }
      // 雲：丸い輪郭を複数つなげた、ふっくらしたシルエット。
      // 乗る高さ a.y は変えない（見た目だけ）。
      const bob=Math.sin(time*1.7+a.baseX*.012)*1.3;
      const top=y+bob;
      ctx.fillStyle='rgba(44,102,138,.18)';
      ctx.beginPath();ctx.ellipse(cx,top+21,a.w*.43,8,0,0,Math.PI*2);ctx.fill();
      const grad=ctx.createLinearGradient(0,top-42,0,top+20);
      grad.addColorStop(0,'#ffffff');grad.addColorStop(.62,'#f5fdff');grad.addColorStop(1,'#a9dff3');
      ctx.fillStyle=grad;ctx.strokeStyle='#4b9fc4';ctx.lineWidth=3.3;
      ctx.beginPath();
      ctx.moveTo(a.x+17,top+15);
      ctx.bezierCurveTo(a.x-1,top+13,a.x+1,top-5,a.x+18,top-9);
      ctx.bezierCurveTo(a.x+13,top-23,a.x+29,top-33,a.x+43,top-26);
      ctx.bezierCurveTo(a.x+48,top-46,cx+13,top-47,cx+22,top-27);
      ctx.bezierCurveTo(a.x+a.w-28,top-37,a.x+a.w-12,top-24,a.x+a.w-14,top-12);
      ctx.bezierCurveTo(a.x+a.w+5,top-9,a.x+a.w+2,top+11,a.x+a.w-18,top+15);
      ctx.quadraticCurveTo(cx,top+25,a.x+17,top+15);
      ctx.closePath();ctx.fill();ctx.stroke();
      ctx.save();ctx.globalAlpha=.19;ctx.fillStyle=crayonPattern;ctx.beginPath();ctx.ellipse(cx,top-2,a.w*.44,20,0,0,Math.PI*2);ctx.fill();ctx.restore();
      // ふんわりした光と、雲の内側の柔らかい陰影。
      ctx.fillStyle='rgba(255,255,255,.68)';
      ctx.beginPath();ctx.ellipse(cx-12,top-15,a.w*.23,8,-.12,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='rgba(112,185,219,.65)';ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(a.x+26,top+10);
      ctx.quadraticCurveTo(cx,top+19,a.x+a.w-24,top+10);ctx.stroke();
      // 風の線は雲の外に小さく表示。
      ctx.strokeStyle='#75b9d7';ctx.lineWidth=2;
      for(let i=0;i<2;i++){
        const yy=top+1+i*10;
        ctx.beginPath();ctx.moveTo(a.x-16-i*5,yy);
        ctx.lineTo(a.x-5-i*5,yy);ctx.stroke();
      }
    }else{
      // Ver.4.6: GitHubの手描き葉っぱを使用。足場の当たり判定 a.y はそのまま。
      const leafName=a.leafVariant===8?'leaf_08':'leaf_01'; // Ver.5.4: 01/08を明示的に選択
      const leafArt=crayonAssets[leafName];
      if(pageIndex===1&&leafArt&&leafArt.ready&&leafArt.img.naturalWidth){
        const sway=Math.sin(time*1.4+a.baseX*.013)*1.2;
        // 元画像の縦横比を維持。以前は横に引き伸ばされ、旧葉っぱに見えていた。
        const iw=leafArt.img.naturalWidth,ih=leafArt.img.naturalHeight;
        const dw=Math.min(a.w+10,leafName==='leaf_08'?142:132),dh=dw*ih/iw;
        ctx.drawImage(leafArt.img,cx-dw/2,y+18-dh+sway,dw,dh);
        ctx.restore();return;
      }
      // 葉っぱ：先の尖った輪郭、緩やかなうねり、自然な葉脈。
      const sway=Math.sin(time*1.4+a.baseX*.013)*2;
      ctx.strokeStyle='#427d4b';ctx.lineWidth=4;
      ctx.beginPath();ctx.moveTo(cx+3,y+10);
      ctx.quadraticCurveTo(cx+sway+7,y+26,cx+17,y+36);ctx.stroke();
      ctx.fillStyle='rgba(45,90,47,.20)';
      ctx.beginPath();ctx.ellipse(cx,y+17,a.w*.40,7,0,0,Math.PI*2);ctx.fill();
      const grad=ctx.createLinearGradient(a.x,y-26,a.x+a.w,y+24);
      grad.addColorStop(0,'#c5ed9b');grad.addColorStop(.42,'#8ed66f');
      grad.addColorStop(.75,'#59b56a');grad.addColorStop(1,'#388a58');
      ctx.fillStyle=grad;ctx.strokeStyle='#337c49';ctx.lineWidth=3.3;
      ctx.beginPath();
      ctx.moveTo(a.x+5,y+6);
      ctx.bezierCurveTo(a.x+25,y-18,cx-28,y-23,cx+4,y-17);
      ctx.bezierCurveTo(cx+30,y-24,a.x+a.w-22,y-16,a.x+a.w-3,y+2);
      ctx.bezierCurveTo(a.x+a.w-16,y+9,cx+33,y+23,cx+2,y+21);
      ctx.bezierCurveTo(cx-25,y+23,a.x+22,y+15,a.x+5,y+6);
      ctx.closePath();ctx.fill();ctx.stroke();
      ctx.save();ctx.globalAlpha=.24;ctx.fillStyle=crayonPattern;ctx.beginPath();ctx.ellipse(cx,y+2,a.w*.44,17,0,0,Math.PI*2);ctx.fill();ctx.restore();
      // 葉の縁のハイライトと、中央の曲線的な主脈。
      ctx.strokeStyle='rgba(230,255,193,.85)';ctx.lineWidth=2.5;
      ctx.beginPath();ctx.moveTo(a.x+13,y+5);
      ctx.quadraticCurveTo(cx-2,y-3,a.x+a.w-13,y+3);ctx.stroke();
      ctx.strokeStyle='#e3f6af';ctx.lineWidth=2.4;
      ctx.beginPath();ctx.moveTo(a.x+14,y+8);
      ctx.quadraticCurveTo(cx,y+10,a.x+a.w-12,y+3);ctx.stroke();
      for(let i=1;i<=4;i++){
        const t=i/5;
        const xx=a.x+14+(a.w-27)*t;
        const yy=y+8-5*t+Math.sin(t*Math.PI)*2;
        ctx.strokeStyle='rgba(229,250,185,.85)';ctx.lineWidth=1.5;
        ctx.beginPath();ctx.moveTo(xx,yy);
        ctx.quadraticCurveTo(xx-9,yy-9,xx-17,yy-12-(i%2)*2);
        ctx.moveTo(xx,yy);
        ctx.quadraticCurveTo(xx+5,yy+7,xx+12,yy+11);ctx.stroke();
      }
      // 小さな露のしずく。
      ctx.fillStyle='rgba(244,255,255,.8)';
      ctx.beginPath();ctx.ellipse(cx-16,y-9,3.2,2, -.3,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }
  function drawFlowerDust(ctx){
    if(pageIndex!==1)return;
    ctx.save();
    for(const d of flowerDust){
      ctx.globalAlpha=Math.max(0,1-d.age/850);
      ctx.fillStyle=d.color;
      ctx.beginPath();ctx.arc(d.x,d.y,Math.max(.5,d.size*(1-d.age/1100)),0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }
  // Ver.2.5: 背景を白黒にしたまま、遊ぶための物体だけ色を残す透明レイヤー。
  // Canvas.filter に依存せず iPhone Safari でも動く。
  const accentCanvas=document.createElement('canvas');
  accentCanvas.width=W;accentCanvas.height=H;
  accentCanvas.setAttribute('aria-hidden','true');
  accentCanvas.style.cssText='position:fixed;pointer-events:none;z-index:100000;display:none;transform:none;';
  document.body.appendChild(accentCanvas);
  const accentCtx=accentCanvas.getContext('2d');
  function syncAccentPosition(){
    const r=screen.getBoundingClientRect();
    accentCanvas.style.left=r.left+'px';accentCanvas.style.top=r.top+'px';
    accentCanvas.style.width=r.width+'px';accentCanvas.style.height=r.height+'px';
    accentCanvas.style.borderRadius=getComputedStyle(screen).borderRadius;
  }
  // Ver.2.9: 両描画レイヤーで同じ敵を描く（ライフ1でも色が残る）。
  function drawEnemyV29(g,e){
    if(!e.alive)return;
    if(pageIndex===1&&e.type==='bee'){
      const art=crayonAssets.bee;
      if(art&&art.ready){
        g.save();
        const flutter=Math.sin(gameTime*.034+e.x*.03)*2;
        g.drawImage(art.img,e.x-4,e.y-10+flutter,e.w+8,e.h+18);
        g.restore();return;
      }
      g.save();g.translate(e.x,e.y);
      const flap=Math.sin(gameTime*.034+e.x*.03)*7;
      g.fillStyle='rgba(232,250,255,.88)';g.strokeStyle='#6b9ba8';g.lineWidth=2;
      for(const side of [-1,1]){
        g.beginPath();g.ellipse(31+side*13,14+flap*.25,14,10+Math.abs(flap)*.3,side*.4,0,Math.PI*2);g.fill();g.stroke();
      }
      g.fillStyle='#f7c952';g.strokeStyle='#9c7339';g.lineWidth=2.5;
      g.beginPath();g.ellipse(31,31,27,19,0,0,Math.PI*2);g.fill();g.stroke();
      g.save();g.beginPath();g.ellipse(31,31,26,18,0,0,Math.PI*2);g.clip();crayonSurface(5,13,53,38,.47);g.restore();
      g.save();g.beginPath();g.ellipse(31,31,27,19,0,0,Math.PI*2);g.clip();
      g.fillStyle='#76563e';g.fillRect(22,12,8,42);g.fillRect(42,12,8,42);g.restore();
      g.fillStyle='#fff';g.beginPath();g.arc(15,26,6,0,Math.PI*2);g.fill();
      g.fillStyle='#293b40';g.beginPath();g.arc(15,26,2.6,0,Math.PI*2);g.fill();
      g.strokeStyle='#5a4c3a';g.beginPath();g.moveTo(12,11);g.lineTo(8,4);g.stroke();
      g.restore();return;
    }
    if(pageIndex===1&&e.type==='snail'){
      const hiding=gameTime<e.shellUntil;
      const art=crayonAssets.snail;
      if(art&&art.ready){
        g.save();
        // 殻にこもる状態も残し、画像を少し小さくして表現。
        if(hiding){
          g.drawImage(art.img,e.x+8,e.y+14,e.w-12,e.h-12);
        }else{
          g.drawImage(art.img,e.x-4,e.y-8,e.w+8,e.h+12);
        }
        g.restore();return;
      }
      g.save();g.translate(e.x,e.y);
      g.fillStyle='#8acb9b';g.strokeStyle='#548c72';g.lineWidth=2.5;
      g.beginPath();g.ellipse(33,50,30,10,0,0,Math.PI*2);g.fill();g.stroke();
      if(!hiding){
        g.fillStyle='#9ad6a0';g.beginPath();g.ellipse(15,31,12,23,0,0,Math.PI*2);g.fill();
        g.strokeStyle='#5c8b63';g.beginPath();g.moveTo(8,16);g.lineTo(4,6);g.moveTo(19,16);g.lineTo(24,5);g.stroke();
        g.fillStyle='#283e37';g.beginPath();g.arc(4,6,3,0,Math.PI*2);g.arc(24,5,3,0,Math.PI*2);g.fill();
      }
      g.fillStyle=hiding?'#c99b7d':'#d8b08c';g.strokeStyle='#9b735b';g.lineWidth=3;
      g.beginPath();g.arc(39,30,22,0,Math.PI*2);g.fill();g.stroke();
      g.save();g.beginPath();g.arc(39,30,21,0,Math.PI*2);g.clip();crayonSurface(18,9,42,42,.52);g.restore();
      g.strokeStyle='#a17661';g.lineWidth=3;g.beginPath();g.arc(40,29,12,.4,Math.PI*2.15);g.stroke();
      g.fillStyle='#fff8db';g.font='bold 11px sans-serif';
      if(hiding)g.fillText('Z',45,7);
      g.restore();return;
    }
    // Ver.4.5: 芋虫の見た目だけを芽のクレヨン画像に変更（挙動・当たり判定はそのまま）。
    if(pageIndex===1&&e.type==='caterpillar'){
      const art=crayonAssets.sprout_enemy;
      if(art&&art.ready&&art.img.naturalWidth){
        g.save();
        // 歩くと軽く上下する。描画サイズのみ変更する。
        const bob=Math.sin(gameTime*.012+e.x*.035)*1.5;
        g.drawImage(art.img,e.x-3,e.y-7+bob,e.w+6,e.h+9);
        g.restore();return;
      }
    }
    if(pageIndex===1&&!enemyPictureReady){
      g.save();g.translate(e.x,e.y);
      for(let j=0;j<4;j++){
        g.fillStyle=['#a8d984','#8fcf83','#b2dd8e','#91c67d'][j];
        g.beginPath();g.arc(14+j*13,40-(j%2)*5,17,0,Math.PI*2);g.fill();
        g.save();g.beginPath();g.arc(14+j*13,40-(j%2)*5,16,0,Math.PI*2);g.clip();crayonSurface(j*13,19,34,38,.43);g.restore();
      }
      g.fillStyle='#5c7850';g.beginPath();g.arc(12,29,3,0,Math.PI*2);g.arc(25,29,3,0,Math.PI*2);g.fill();
      g.strokeStyle='#64895d';g.lineWidth=2;g.beginPath();g.moveTo(14,19);g.lineTo(8,10);
      g.moveTo(26,19);g.lineTo(33,10);g.stroke();g.restore();return;
    }
    if(enemyPictureReady){g.drawImage(enemyPicture,e.x,e.y,e.w,e.h);return;}
    g.save();g.translate(e.x,e.y);
    g.fillStyle='#83c99c';g.beginPath();g.ellipse(32,38,30,25,0,0,Math.PI*2);g.fill();
    g.fillStyle='#fff';g.beginPath();g.arc(33,30,13,0,Math.PI*2);g.fill();
    g.fillStyle='#354c45';g.beginPath();g.arc(34+e.dir*3,31,6,0,Math.PI*2);g.fill();g.restore();
  }
  function drawColoredEssentials(){
    if(lives!==1||!overlay.classList.contains('open')){
      accentCanvas.style.display='none';return;
    }
    syncAccentPosition();accentCanvas.style.display='block';
    const g=accentCtx;
    g.clearRect(0,0,W,H);
    g.save();applyWorldCamera(g);
    // 穴の縁は危険を見落とさないよう、色つきの警告で示す。
    for(const hole of pits){
      g.fillStyle='#e87e38';g.fillRect(hole.x-8,groundY-7,8,32);
      g.fillRect(hole.x+hole.w,groundY-7,8,32);
      g.fillStyle='#ffbb35';g.font='bold 26px sans-serif';g.textAlign='center';
      g.fillText('⚠',hole.x+hole.w/2,groundY-20);
    }
    // 足場：木の幹と草の筆跡を重ねた水彩タッチ。
    for(const a of platforms){
      if(pageIndex===1){
        if(a.moving){g.fillStyle='rgba(255,255,255,.8)';g.font='20px sans-serif';g.fillText('〰',a.x+a.w/2-12,a.y-25);}
        if(a.stair||a.highway)continue;
        drawLeafCloud(g,a);
        continue;
      }
      const wood=g.createLinearGradient(0,a.y,0,a.y+a.h);
      wood.addColorStop(0,'#c8ab84');wood.addColorStop(1,'#967a61');
      g.fillStyle=wood;g.beginPath();
      g.moveTo(a.x+3,a.y+4);g.lineTo(a.x+a.w-3,a.y+3);
      g.lineTo(a.x+a.w-6,a.y+a.h);g.lineTo(a.x+5,a.y+a.h-2);g.closePath();g.fill();
      for(let i=0;i<8;i++){
        const xx=a.x+13+i*(a.w-26)/8;
        g.strokeStyle=i%2?'rgba(255,240,208,.30)':'rgba(94,75,53,.20)';g.lineWidth=2;
        g.beginPath();g.moveTo(xx,a.y+11);g.lineTo(xx+16,a.y+16+(i%3));g.stroke();
      }
      g.fillStyle='#88af75';g.fillRect(a.x+3,a.y,a.w-6,5);
      for(let x=a.x+6;x<a.x+a.w-5;x+=12){
        const seed=Math.floor(x/12);
        g.fillStyle=['#a4c78c','#7da86d','#bed49d'][seed%3];
        g.beginPath();g.ellipse(x,a.y+1,10,4+(seed%3)*2,0,0,Math.PI*2);g.fill();
      }
    }
    drawFlowerDust(g);
    // 風の流れを半透明の筆跡で可視化。危険な穴の輪郭を隠さないよう上空だけに描く。
    if(pageIndex===1){
      g.save();g.lineWidth=3;g.lineCap='round';
      for(const v of windParticles){
        g.strokeStyle='rgba(244,255,255,.75)';g.beginPath();
        g.moveTo(v.x,v.y);g.quadraticCurveTo(v.x+v.length*.45,v.y-7,v.x+v.length,v.y);g.stroke();
      }
      g.restore();
    }
    // Ver.4.2: 花の木箱（GitHub PNG）。当たり判定・使用済み処理はそのまま。
    for(const b of blocks){
      const yy=b.y-b.bump;
      const art=(b.surprise?crayonAssets.sprout_box:crayonAssets.flower_box)||crayonAssets.flower_box;
      if(art.ready && art.img.naturalWidth){
        g.save();
        if(b.used){g.globalAlpha=.58;}
        g.drawImage(art.img,b.x,yy,b.w,b.h);
        g.restore();
      }else{
        // 読み込み前の仮表示にも「?」は出さない。
        g.save();g.fillStyle=b.used?'#b8a08a':'#e5b87c';
        g.fillRect(b.x,yy,b.w,b.h);
        g.strokeStyle='#8c6949';g.lineWidth=4;g.strokeRect(b.x+2,yy+2,b.w-4,b.h-4);
        g.font='31px sans-serif';g.textAlign='center';g.fillText('🌸',b.x+b.w/2,yy+b.h*.72);
        g.restore();
      }
    }
    // ブロックから飛び出したコインの短い演出。
    for(const c of coinBursts){
      const rise=Math.sin(Math.min(1,c.age/700)*Math.PI)*80;
      g.fillStyle='#ffd44b';g.beginPath();g.ellipse(c.x,c.y-rise,17,22,0,0,Math.PI*2);g.fill();
      g.strokeStyle='#fff1a0';g.lineWidth=4;g.stroke();
      g.fillStyle='#9a650e';g.font='bold 21px sans-serif';g.textAlign='center';
      g.fillText('1',c.x,c.y-rise+7);
    }
    if(pageIndex===1&&!paintPickupTaken){
      g.font='38px sans-serif';g.textAlign='center';g.fillText('🎨',1830,286);
    }
    coins.forEach((c,i)=>{
      if(collected.has(i))return;
      // Ver.4.5: 星の取得条件はそのまま、描画のみクレヨンPNGへ。
      const starArt=crayonAssets.star;
      if(pageIndex===1&&starArt&&starArt.ready&&starArt.img.naturalWidth){
        g.drawImage(starArt.img,c.x-22,c.y-22,44,44);
      }else{
        g.fillStyle='#ffd347';g.beginPath();g.arc(c.x,c.y,19,0,Math.PI*2);g.fill();
        g.strokeStyle='#fff5b0';g.lineWidth=5;g.stroke();
        g.fillStyle='#8e6112';g.font='bold 22px sans-serif';g.textAlign='center';g.fillText('★',c.x,c.y+8);
      }
    });
    // Ver.2.9: 3種類の敵を描画
    for(const e of enemies)drawEnemyV29(g,e);
    for(const e of surpriseSprouts){
      if(!e.alive)continue;
      const art=crayonAssets.sprout_enemy;
      if(art&&art.ready&&art.img.naturalWidth){
        g.drawImage(art.img,e.x,e.y+(e.landed?Math.sin(gameTime*.012)*1.5:0),e.w,e.h);
      }else{
        g.save();g.fillStyle='#9fdc72';g.beginPath();g.arc(e.x+30,e.y+30,27,0,Math.PI*2);g.fill();
        g.font='26px sans-serif';g.fillText('🌱',e.x+14,e.y+34);g.restore();
      }
    }
    // きのちゃんは色を残し、背景から浮くように薄い縁取りを加える。
    if(gameTime>=invulnerableUntil||Math.floor(gameTime/100)%2===0){
      g.save();g.shadowColor='rgba(255,255,255,.95)';g.shadowBlur=14;
      if(masterCanvas.width>0&&masterCanvas.height>0){
        g.drawImage(masterCanvas,p.x,p.y,p.w,p.h);
      }else{g.fillStyle='#fa8b55';g.fillRect(p.x,p.y,p.w,p.h);}
      g.restore();
    }
    g.restore();
  }
  // Ver.2.6: 視認性を優先した前景地面。背景画像はそのまま使用できる。
  function drawReadableTerrain(){
    const hill=pageIndex===1;
    // 背景の手前に描かれた崖・川岸を柔らかな帯で隠す。
    // ゲーム側の地面と背景側の崖が二重に見えないようにする。
    if(hill){
      const veil=g.createLinearGradient(0,groundY-56,0,groundY+9);
      veil.addColorStop(0,'rgba(251,246,235,0)');
      veil.addColorStop(.63,'rgba(251,246,235,.72)');
      veil.addColorStop(1,'rgba(251,246,235,.98)');
      g.fillStyle=veil;
      g.fillRect(camera,groundY-56,W,75);
    }
    let from=0;
    for(const hole of [...pits,{x:stageEnd,w:0}]){
      const to=hole.x;
      if(to>from){
        // はっきりした崖の側面。透明にしないことで背景と混ざらない。
        const soil=g.createLinearGradient(0,groundY,0,H);
        soil.addColorStop(0,hill?'#b98560':'#a88a68');
        soil.addColorStop(.55,hill?'#a57255':'#94765d');
        soil.addColorStop(1,hill?'#8a604d':'#866e59');
        g.fillStyle=soil;g.fillRect(from,groundY,to-from,H-groundY);crayonGroundDetails(from,groundY,to-from,H);
        g.save();g.beginPath();g.rect(from,groundY,to-from,H-groundY);g.clip();
        // 土の模様は淡く、遊べる輪郭の邪魔をしない。
        for(let x=from+18;x<to;x+=54){
          const seed=Math.floor(x/54);
          g.fillStyle=seed%2?'rgba(255,229,188,.12)':'rgba(68,45,37,.10)';
          g.beginPath();g.ellipse(x,groundY+28+(seed*17)%47,22,10,.12,0,Math.PI*2);g.fill();
        }
        g.restore();
        // 当たり判定と一致する水平な芝のライン。
        g.fillStyle=hill?'#386c47':'#477a4b';g.fillRect(from,groundY-6,to-from,7);
        g.fillStyle=hill?'#94c66c':'#83b870';g.fillRect(from,groundY-12,to-from,8);
        for(let x=from+5;x<to;x+=18){
          g.fillStyle=x%3===0?'#b8d985':'#6da65c';
          g.beginPath();g.ellipse(x,groundY-10,11,5,0,0,Math.PI*2);g.fill();
          if(hill&&Math.floor(x/18)%6===0){
            g.fillStyle='#fff1d2';g.beginPath();g.arc(x,groundY-13,3.2,0,Math.PI*2);g.fill();
          }
        }
        // 草の境界線で「ここに着地できる」を強調。
        g.strokeStyle='rgba(37,72,46,.85)';g.lineWidth=2;
        g.beginPath();g.moveTo(from,groundY-4);g.lineTo(to,groundY-4);g.stroke();
      }
      from=hole.x+hole.w;
    }
    for(const hole of pits){
      // 川の背景とは異なる、明確な暗い落とし穴。
      const pit=g.createLinearGradient(0,groundY-12,0,H);
      pit.addColorStop(0,'#392f41');pit.addColorStop(.3,'#211f30');pit.addColorStop(1,'#0c1525');
      g.fillStyle=pit;g.fillRect(hole.x,groundY-7,hole.w,H-groundY+7);
      // 崖の切り口とオレンジの危険表示。
      g.fillStyle='#6a493a';g.fillRect(hole.x-8,groundY-4,8,H-groundY+4);
      g.fillRect(hole.x+hole.w,groundY-4,8,H-groundY+4);
      g.fillStyle='#ed8e37';g.fillRect(hole.x-8,groundY-15,8,22);
      g.fillRect(hole.x+hole.w,groundY-15,8,22);
      g.fillStyle='#ffca5a';g.font='bold 24px sans-serif';g.textAlign='center';
      g.fillText('⚠',hole.x+hole.w/2,groundY-23);
    }
  }
  const windBadge=document.createElement('div');
  windBadge.setAttribute('aria-live','off');
  windBadge.style.cssText='position:absolute;left:50%;top:3px;transform:translateX(-50%);z-index:3;background:rgba(255,255,255,.9);color:#24618b;border:2px solid #86c6e4;border-radius:18px;padding:3px 12px;font:bold 14px sans-serif;pointer-events:none;display:none;white-space:nowrap;';
  // canvas の親が相対配置でなくても位置がずれないよう、画面上の説明はメッセージ欄に出す。
  let lastWindZone=-1;
  function updateWindMessage(){
    if(pageIndex!==1||won||gameOver)return;
    const idx=hillWindZones.findIndex(z=>p.x+p.w/2>=z.x&&p.x+p.w/2<=z.x+z.w);
    if(idx!==lastWindZone){
      lastWindZone=idx;
      if(idx>=0)message.textContent=hillWindZones[idx].power>0?'🌬️ 追い風！ジャンプすると遠くまで飛べるよ！':'🌬️ 向かい風！風に負けずに進もう！';
    }
  }
  function draw() {
    updateWindMessage();
    // 背景は彩度を失い、ライフ1では操作対象を別レイヤーに再描画する。
    const target=lives>=3?1:lives===2?.5:0;
    visibleSaturation+=(target-visibleSaturation)*.075;
    if(Math.abs(target-visibleSaturation)<.002)visibleSaturation=target;
    // iPhone Safari では CanvasRenderingContext2D.filter が反映されない場合があるため、
    // Canvas 要素そのものに CSS filter を適用する。背景画像・足場・敵・主人公を一括で変色。
    screen.style.filter='saturate('+Math.round(visibleSaturation*100)+'%)';
    g.clearRect(0,0,W,H);
    paintForestBackground();
    g.save();applyWorldCamera(g);
    // Ver.2.6: 背景の地面と実際に乗れる地面を明確に分離。
    // 当たり判定・穴の位置は従来どおり（描画のみ変更）。
    if(pageIndex===1)drawAdventureTerrain();else drawReadableTerrain();
    if(pageIndex!==1)paintForestFlowers();
    // 長いステージには2か所のチェックポイント。
    for(const cx of checkpoints){
      // 地面ではなく、旗の位置にある最上段の足場を基準に描画する。
      // これで階段の土柱の中に旗が埋まらない。
      let flagBase=pageIndex===1?terrainHeight(cx+4):groundY;
      if(pageIndex===1){
        for(const a of platforms){
          if(a.stair&&cx+7>a.x&&cx<a.x+a.w){
            flagBase=Math.min(flagBase,a.y-7);
          }
        }
      }
      if(!Number.isFinite(flagBase))flagBase=groundY;
      // Ver.4.6: 花のチェックポイント旗。接触判定・復活位置は従来どおり。
      const checkpointArt=crayonAssets[cx===checkpoints[0]?'flag_02':'flag_04'];
      const checkpointReached=activatedCheckpoints.has(cx);
      g.save();
      if(!checkpointReached)g.filter='grayscale(1)';
      if(pageIndex===1&&checkpointArt&&checkpointArt.ready&&checkpointArt.img.naturalWidth){
        g.drawImage(checkpointArt.img,cx-22,flagBase-135,109,135);
        if(checkpointReached){
          g.save();g.fillStyle='#247d4b';g.font='bold 17px sans-serif';g.textAlign='center';
          g.fillText('✓',cx+31,flagBase-143);g.restore();
        }
      }else if(pageIndex===1){
        // 画像の読み込みに失敗しても、緑の仮旗には戻さず花の旗を描く。
        const first=cx===checkpoints[0];
        const cloth=first?'#f48eaa':'#65bde9';
        g.save();
        g.fillStyle='#b77834';g.strokeStyle='#85501d';g.lineWidth=2;
        g.fillRect(cx,flagBase-111,6,111);g.strokeRect(cx,flagBase-111,6,111);
        g.fillStyle='#f3c75c';g.beginPath();g.arc(cx+3,flagBase-113,8,0,Math.PI*2);g.fill();g.stroke();
        g.fillStyle=cloth;g.strokeStyle=first?'#d15b81':'#378bc5';g.lineWidth=3;
        g.beginPath();g.moveTo(cx+7,flagBase-105);
        g.quadraticCurveTo(cx+34,flagBase-116,cx+73,flagBase-102);
        g.lineTo(cx+70,flagBase-65);
        g.quadraticCurveTo(cx+37,flagBase-79,cx+7,flagBase-70);
        g.closePath();g.fill();g.stroke();
        const fx=cx+39,fy=flagBase-88;
        g.fillStyle='#fff9ee';
        for(let i=0;i<5;i++){const t=i*Math.PI*2/5;g.beginPath();g.ellipse(fx+Math.cos(t)*10,fy+Math.sin(t)*10,7,9,t,0,Math.PI*2);g.fill();}
        g.fillStyle='#f9c94d';g.beginPath();g.arc(fx,fy,6,0,Math.PI*2);g.fill();
        g.restore();
      }else{
        g.fillStyle='#f7f8fc';g.fillRect(cx,flagBase-115,7,115);
        g.fillStyle=checkpointReached?'#45db76':'#ffb344';
        g.beginPath();g.moveTo(cx+7,flagBase-112);
        g.lineTo(cx+75,flagBase-91);g.lineTo(cx+7,flagBase-70);g.closePath();g.fill();
        g.fillStyle='#1e4a39';g.font='bold 18px sans-serif';g.textAlign='center';
        g.fillText(checkpointReached?'CHECK ✓':'CHECK',cx+32,flagBase-130);
      }
      g.restore(); // 未到達の旗だけ白黒にする（他の絵には影響させない）
    }
    // 足場：木の幹と草の筆跡を重ねた水彩タッチ。
    for(const a of platforms){
      if(pageIndex===1){
        if(a.moving){g.fillStyle='rgba(255,255,255,.8)';g.font='20px sans-serif';g.fillText('〰',a.x+a.w/2-12,a.y-25);}
        if(a.stair||a.highway)continue;
        drawLeafCloud(g,a);
        continue;
      }
      const wood=g.createLinearGradient(0,a.y,0,a.y+a.h);
      wood.addColorStop(0,'#c8ab84');wood.addColorStop(1,'#967a61');
      g.fillStyle=wood;g.beginPath();
      g.moveTo(a.x+3,a.y+4);g.lineTo(a.x+a.w-3,a.y+3);
      g.lineTo(a.x+a.w-6,a.y+a.h);g.lineTo(a.x+5,a.y+a.h-2);g.closePath();g.fill();
      for(let i=0;i<8;i++){
        const xx=a.x+13+i*(a.w-26)/8;
        g.strokeStyle=i%2?'rgba(255,240,208,.30)':'rgba(94,75,53,.20)';g.lineWidth=2;
        g.beginPath();g.moveTo(xx,a.y+11);g.lineTo(xx+16,a.y+16+(i%3));g.stroke();
      }
      g.fillStyle='#88af75';g.fillRect(a.x+3,a.y,a.w-6,5);
      for(let x=a.x+6;x<a.x+a.w-5;x+=12){
        const seed=Math.floor(x/12);
        g.fillStyle=['#a4c78c','#7da86d','#bed49d'][seed%3];
        g.beginPath();g.ellipse(x,a.y+1,10,4+(seed%3)*2,0,0,Math.PI*2);g.fill();
      }
    }
    drawFlowerDust(g);
    // 風の流れを半透明の筆跡で可視化。危険な穴の輪郭を隠さないよう上空だけに描く。
    if(pageIndex===1){
      g.save();g.lineWidth=3;g.lineCap='round';
      for(const v of windParticles){
        g.strokeStyle='rgba(244,255,255,.75)';g.beginPath();
        g.moveTo(v.x,v.y);g.quadraticCurveTo(v.x+v.length*.45,v.y-7,v.x+v.length,v.y);g.stroke();
      }
      g.restore();
    }
    // Ver.4.2: 花の木箱（GitHub PNG）。当たり判定・使用済み処理はそのまま。
    for(const b of blocks){
      const yy=b.y-b.bump;
      const art=(b.surprise?crayonAssets.sprout_box:crayonAssets.flower_box)||crayonAssets.flower_box;
      if(art.ready && art.img.naturalWidth){
        g.save();
        if(b.used){g.globalAlpha=.58;}
        g.drawImage(art.img,b.x,yy,b.w,b.h);
        g.restore();
      }else{
        // 読み込み前の仮表示にも「?」は出さない。
        g.save();g.fillStyle=b.used?'#b8a08a':'#e5b87c';
        g.fillRect(b.x,yy,b.w,b.h);
        g.strokeStyle='#8c6949';g.lineWidth=4;g.strokeRect(b.x+2,yy+2,b.w-4,b.h-4);
        g.font='31px sans-serif';g.textAlign='center';g.fillText('🌸',b.x+b.w/2,yy+b.h*.72);
        g.restore();
      }
    }
    // ブロックから飛び出したコインの短い演出。
    for(const c of coinBursts){
      const rise=Math.sin(Math.min(1,c.age/700)*Math.PI)*80;
      g.fillStyle='#ffd44b';g.beginPath();g.ellipse(c.x,c.y-rise,17,22,0,0,Math.PI*2);g.fill();
      g.strokeStyle='#fff1a0';g.lineWidth=4;g.stroke();
      g.fillStyle='#9a650e';g.font='bold 21px sans-serif';g.textAlign='center';
      g.fillText('1',c.x,c.y-rise+7);
    }
    if(pageIndex===1&&!paintPickupTaken){
      g.font='38px sans-serif';g.textAlign='center';g.fillText('🎨',1830,286);
    }
    coins.forEach((c,i)=>{
      if(collected.has(i))return;
      // Ver.4.5: 星の取得条件はそのまま、描画のみクレヨンPNGへ。
      const starArt=crayonAssets.star;
      if(pageIndex===1&&starArt&&starArt.ready&&starArt.img.naturalWidth){
        g.drawImage(starArt.img,c.x-22,c.y-22,44,44);
      }else{
        g.fillStyle='#ffd347';g.beginPath();g.arc(c.x,c.y,19,0,Math.PI*2);g.fill();
        g.strokeStyle='#fff5b0';g.lineWidth=5;g.stroke();
        g.fillStyle='#8e6112';g.font='bold 22px sans-serif';g.textAlign='center';g.fillText('★',c.x,c.y+8);
      }
    });
    // Ver.2.9: 3種類の敵を描画
    for(const e of enemies)drawEnemyV29(g,e);
    for(const e of surpriseSprouts){
      if(!e.alive)continue;
      const art=crayonAssets.sprout_enemy;
      if(art&&art.ready&&art.img.naturalWidth){
        g.drawImage(art.img,e.x,e.y+(e.landed?Math.sin(gameTime*.012)*1.5:0),e.w,e.h);
      }else{
        g.save();g.fillStyle='#9fdc72';g.beginPath();g.arc(e.x+30,e.y+30,27,0,Math.PI*2);g.fill();
        g.font='26px sans-serif';g.fillText('🌱',e.x+14,e.y+34);g.restore();
      }
    }
    // Ver.4.6: 花のゴールバナー。クリア条件は変更しない。
    const goalArt=crayonAssets.flag_03;
    if(pageIndex===1&&goalArt&&goalArt.ready&&goalArt.img.naturalWidth){
      const finishY=terrainHeight(stageEnd-120);
      const base=Number.isFinite(finishY)?finishY:groundY;
      g.drawImage(goalArt.img,stageEnd-210,base-164,175,164);
    }else{
      g.fillStyle='#fefefe';g.fillRect(stageEnd-125,160,7,groundY-160);
      g.fillStyle='#e95555';g.beginPath();g.moveTo(stageEnd-118,165);g.lineTo(stageEnd-20,190);g.lineTo(stageEnd-118,215);g.fill();
      g.fillStyle='#233a44';g.font='bold 24px sans-serif';g.fillText('GOAL',stageEnd-160,150);
    }
    if(gameTime>=invulnerableUntil||Math.floor(gameTime/100)%2===0){
    if(masterCanvas.width>0&&masterCanvas.height>0){
      g.drawImage(masterCanvas,p.x,p.y,p.w,p.h);
    }else{
      g.fillStyle='#fa8b55';g.fillRect(p.x,p.y,p.w,p.h);
    }
    }
    g.restore();
    if(won||gameOver){
      g.fillStyle='rgba(0,0,0,.48)';g.fillRect(225,172,510,165);
      g.fillStyle='#fff';g.font='bold 45px sans-serif';g.textAlign='center';
      g.fillText(won?'📖 PAGE CLEAR!':'GAME OVER',480,250);
      if(won){g.font='bold 22px sans-serif';g.fillText(pageIndex<pages.length-1?'← スワイプして次のページへ':'ふせんで好きなページへ',480,298);}
    }
    if(turning){
      const progress=Math.min(1,(performance.now()-turnStart)/820);
      // 右から左へ、紙が弧を描いてめくれる簡易アニメーション。
      const edge=W*(1-progress);
      g.save();
      g.fillStyle='#f9f0d9';g.fillRect(edge,0,W-edge,H);
      const shade=g.createLinearGradient(Math.max(0,edge-80),0,Math.min(W,edge+40),0);
      shade.addColorStop(0,'rgba(40,35,25,0)');shade.addColorStop(.68,'rgba(75,55,40,.25)');shade.addColorStop(1,'rgba(255,255,255,.5)');
      g.fillStyle=shade;g.fillRect(Math.max(0,edge-80),0,120,H);
      g.strokeStyle='#ad9374';g.lineWidth=3;g.beginPath();
      g.moveTo(edge,0);g.bezierCurveTo(edge-42,H*.25,edge+30,H*.7,edge,H);g.stroke();
      g.fillStyle='#876e54';g.textAlign='center';g.font='bold 25px sans-serif';
      if(progress>.2)g.fillText('🌸 '+pages[Math.min(pageIndex+1,pages.length-1)].name,edge+(W-edge)/2,H/2);
      g.restore();
    }
  }
  function loop(now) {
    if(!running)return;
    const dt=Math.min(40,now-last);last=now;
    update(dt);draw();drawColoredEssentials();
    if(turning&&now-turnStart>=820)selectPage(Math.min(pageIndex+1,pages.length-1));
    raf=requestAnimationFrame(loop);
  }
})();
