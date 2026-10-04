import './style.css'
import { createValley, LILY_COUNT } from './scene.js'

const EDIT_KEY = 'valley-edit-key'
const CHUNK = 3 * 1024 * 1024
const MAX_PARTS = 12

const $ = (s) => document.querySelector(s)
const editing = new URLSearchParams(location.search).has('edit')
document.body.classList.toggle('editing', editing)

const state = {
  cfg: { name: 'My Love', message: 'Happy birthday, my love ♡', memories: {}, playlist: [] },
  entered: false,
  wantsMusic: true,
  touring: false,
  current: -1,
}

/* ---------- API ---------- */

async function api(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: { ...(opts.headers || {}), 'x-owner-key': localStorage.getItem(EDIT_KEY) || '' },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(body.error || 'Something went wrong'), { status: res.status })
  return body
}

async function loadConfig() {
  const res = await fetch('/api/config')
  if (!res.ok) throw new Error('Could not load the valley')
  return res.json()
}

const jsonBody = (method, data) => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(data),
})

const photoUrl = (m) => (m ? `/api/photo/${m.photoKey.replace(/^photos\//, '')}` : null)

async function shrinkPhoto(file, max = 1600) {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise((ok, bad) => {
      const i = new Image()
      i.onload = () => ok(i)
      i.onerror = bad
      i.src = url
    })
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
    return await new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', 0.86))
  } finally {
    URL.revokeObjectURL(url)
  }
}

function saveMemory(slot, { photo, caption, date }) {
  const form = new FormData()
  if (photo) form.append('photo', photo, 'memory.jpg')
  form.append('caption', caption)
  form.append('date', date)
  return api(`/api/memory/${slot}`, { method: 'POST', body: form })
}

async function uploadSong(file, onProgress) {
  const parts = Math.ceil(file.size / CHUNK)
  if (parts > MAX_PARTS) throw new Error(`“${file.name}” is too large — please pick songs under 36 MB`)
  const uploadId = crypto.randomUUID()
  const title = file.name.replace(/\.[^.]+$/, '')
  let result
  for (let part = 0; part < parts; part++) {
    const q = new URLSearchParams({ total: String(parts), title, type: file.type || 'audio/mpeg' })
    result = await api(`/api/music/${uploadId}/${part}?${q}`, {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream' },
      body: file.slice(part * CHUNK, (part + 1) * CHUNK),
    })
    onProgress?.((part + 1) / parts)
  }
  return result
}

async function fetchSong(song) {
  const chunks = await Promise.all(
    Array.from({ length: song.parts }, (_, i) =>
      fetch(`/api/music/${song.uploadId}/${i}`).then((r) => {
        if (!r.ok) throw new Error('Song unavailable')
        return r.arrayBuffer()
      }),
    ),
  )
  return URL.createObjectURL(new Blob(chunks, { type: song.type }))
}

/* ---------- Toast ---------- */

let toastTimer
function toast(text, ms = 3200) {
  const el = $('#toast')
  el.textContent = text
  el.classList.add('show')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => el.classList.remove('show'), ms)
}

const errorText = (e) =>
  e.status === 403 ? 'Wrong passcode — tap the lock in the bottom-left corner and try again.' : e.message || 'Something went wrong'

/* ---------- Valley ---------- */

const valley = createValley($('#scene'), { onPick: pickLily })
valley.setIntroView()
valley.start()
valley.onUserMove = () => stopTour()

const filledLilies = () => Array.from({ length: LILY_COUNT }, (_, i) => i).filter((i) => state.cfg.memories[i])

function pickLily(i) {
  stopTour()
  if (!state.cfg.memories[i]) {
    return editing ? valley.flyTo(i, () => openEditor(i)) : toast('This lily is still blooming… ✿')
  }
  valley.flyTo(i, () => openMemory(i))
}

function applyConfig(cfg) {
  state.cfg = { ...cfg, playlist: cfg.playlist || [] }
  document.querySelectorAll('[data-name]').forEach((el) => (el.textContent = cfg.name))
  document.title = `Happy Birthday, ${cfg.name} ♡`
  $('#letter-body').textContent = cfg.message
  for (let i = 0; i < LILY_COUNT; i++) valley.setPhoto(i, photoUrl(cfg.memories[i]), editing)
  if (editing) {
    $('#cfg-name').value = cfg.name
    $('#cfg-message').value = cfg.message
  }
  syncPlaylist()
}

/* ---------- Music: playlist player ---------- */

const audio = new Audio()
audio.preload = 'auto'
audio.volume = Number(localStorage.getItem('valley-volume') ?? 0.9)
$('#volume').value = String(audio.volume)

const music = {
  index: -1, // position in playlist of the loaded song
  loadedId: null, // uploadId whose audio is in `audio.src`
  urls: new Map(), // uploadId -> object URL cache
  loading: null, // uploadId currently being fetched
  repeatOne: localStorage.getItem('valley-repeat') === '1',
  shuffle: localStorage.getItem('valley-shuffle') === '1',
  renaming: null,
}

const playlist = () => state.cfg.playlist
const currentSong = () => playlist()[music.index] || null

// A tiny silent WAV, played on the first tap so mobile browsers allow audio later.
function silentWav() {
  const v = new DataView(new ArrayBuffer(844))
  const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)))
  str(0, 'RIFF')
  v.setUint32(4, 836, true)
  str(8, 'WAVEfmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true)
  v.setUint16(22, 1, true)
  v.setUint32(24, 8000, true)
  v.setUint32(28, 8000, true)
  v.setUint16(32, 1, true)
  v.setUint16(34, 8, true)
  str(36, 'data')
  v.setUint32(40, 800, true)
  for (let i = 0; i < 800; i++) v.setUint8(44 + i, 128)
  return URL.createObjectURL(new Blob([v], { type: 'audio/wav' }))
}

const isPlaying = () => !audio.paused && music.loadedId && music.loadedId === currentSong()?.uploadId

function formatTime(sec) {
  if (!Number.isFinite(sec)) return '0:00'
  const m = Math.floor(sec / 60)
  return `${m}:${String(Math.floor(sec % 60)).padStart(2, '0')}`
}

async function loadSong(index, { autoplay = true } = {}) {
  const song = playlist()[index]
  if (!song) return
  music.index = index
  renderPlayer()
  if (music.loadedId === song.uploadId) {
    if (autoplay) audio.play().catch(() => {})
    return
  }
  audio.pause()
  music.loading = song.uploadId
  renderPlayer()
  try {
    let url = music.urls.get(song.uploadId)
    if (!url) {
      url = await fetchSong(song)
      music.urls.set(song.uploadId, url)
    }
    if (music.loading !== song.uploadId) return // another song was picked meanwhile
    music.loadedId = song.uploadId
    audio.src = url
    audio.loop = music.repeatOne
    if (autoplay) await audio.play().catch(() => {})
  } catch {
    if (music.loading === song.uploadId) toast(`“${song.title}” could not load`)
  } finally {
    if (music.loading === song.uploadId) music.loading = null
    renderPlayer()
  }
}

function play() {
  if (!playlist().length) {
    return toast(editing ? 'Add a song from the playlist ♫' : 'No song has been added yet ♫')
  }
  state.wantsMusic = true
  loadSong(music.index < 0 ? 0 : music.index)
}

function pause() {
  state.wantsMusic = false
  audio.pause()
}

function togglePlay() {
  isPlaying() ? pause() : play()
}

function step(dir) {
  const n = playlist().length
  if (!n) return
  let next
  if (music.shuffle && n > 1) {
    do {
      next = Math.floor(Math.random() * n)
    } while (next === music.index)
  } else {
    next = (Math.max(music.index, 0) + dir + n) % n
  }
  state.wantsMusic = true
  loadSong(next)
}

// Keep the player pointed at the right song after the playlist changes (upload, rename, reorder, remove).
function syncPlaylist() {
  const list = playlist()
  const ids = new Set(list.map((s) => s.uploadId))
  for (const [id, url] of music.urls) {
    if (!ids.has(id) && id !== music.loadedId) {
      URL.revokeObjectURL(url)
      music.urls.delete(id)
    }
  }
  if (music.loadedId && !ids.has(music.loadedId)) {
    // The playing song was removed: move on to whatever now sits in its place.
    const wasPlaying = !audio.paused
    audio.pause()
    audio.removeAttribute('src')
    URL.revokeObjectURL(music.urls.get(music.loadedId) || '')
    music.urls.delete(music.loadedId)
    music.loadedId = null
    music.index = list.length ? Math.min(music.index, list.length - 1) : -1
    if (wasPlaying && music.index >= 0) loadSong(music.index)
  } else if (music.loadedId) {
    music.index = list.findIndex((s) => s.uploadId === music.loadedId)
  } else if (music.index >= list.length) {
    music.index = list.length - 1
  }
  if (music.index < 0 && list.length) music.index = 0
  renderPlayer()
  renderPlaylist()
  if (state.entered && state.wantsMusic && !music.loadedId && list.length && !music.loading) loadSong(music.index)
}

function renderPlayer() {
  const list = playlist()
  const song = currentSong()
  const playing = isPlaying()
  $('#player').classList.toggle('playing', playing)
  $('#play').setAttribute('aria-label', playing ? 'Pause music' : 'Play music')
  $('#track-title').textContent = song
    ? music.loading === song.uploadId
      ? `Loading “${song.title}”…`
      : song.title
    : editing
      ? 'Open the playlist to add our songs'
      : 'No song yet'
  $('#track-count').textContent = list.length ? `${music.index + 1} / ${list.length}` : ''
  $('#prev').disabled = $('#next').disabled = list.length < 2
  $('#mode-repeat').setAttribute('aria-pressed', String(music.repeatOne))
  $('#mode-shuffle').setAttribute('aria-pressed', String(music.shuffle))
  document.querySelectorAll('.pl-item').forEach((li) => {
    const isCurrent = li.dataset.id === song?.uploadId
    li.classList.toggle('current', isCurrent)
    const btn = li.querySelector('.pl-toggle')
    const rowPlaying = isCurrent && playing
    btn.innerHTML = rowPlaying ? ICON.pause : ICON.play
    btn.setAttribute('aria-label', `${rowPlaying ? 'Pause' : 'Play'} ${li.dataset.title}`)
  })
}

const svg = (d) => `<svg viewBox="0 0 24 24"><path d="${d}" /></svg>`
const ICON = {
  play: svg('M8 5l11 7-11 7z'),
  pause: svg('M7 5h3v14H7z M14 5h3v14h-3z'),
  up: svg('M12 19V5 M6 11l6-6 6 6'),
  down: svg('M12 5v14 M6 13l6 6 6-6'),
  edit: svg('M4 20h4L19 9l-4-4L4 16z M13 7l4 4'),
  remove: svg('M6 6l12 12 M18 6L6 18'),
}

function toolButton(cls, icon, label, onClick) {
  const b = document.createElement('button')
  b.type = 'button'
  b.className = `pl-btn ${cls}`
  b.innerHTML = icon
  b.title = label
  b.setAttribute('aria-label', label)
  b.addEventListener('click', onClick)
  return b
}

function renderPlaylist() {
  const list = playlist()
  const ol = $('#pl-list')
  ol.replaceChildren()
  $('#pl-empty').hidden = list.length > 0
  $('#pl-empty').textContent = editing
    ? 'No songs yet — add the ones that remind you of her ♫'
    : 'No songs have been added yet ♫'

  list.forEach((song, i) => {
    const li = document.createElement('li')
    li.className = 'pl-item'
    li.dataset.id = song.uploadId
    li.dataset.title = song.title

    const toggle = toolButton('pl-toggle', ICON.play, `Play ${song.title}`, () => {
      if (i === music.index && isPlaying()) return pause()
      state.wantsMusic = true
      loadSong(i)
    })
    const num = document.createElement('span')
    num.className = 'pl-num'
    num.textContent = String(i + 1)
    li.append(num, toggle)

    if (music.renaming === song.uploadId) {
      li.append(renameInput(song))
    } else {
      const name = document.createElement('span')
      name.className = 'pl-name'
      name.textContent = song.title
      name.title = song.title
      name.addEventListener('click', () => toggle.click())
      if (editing) name.addEventListener('dblclick', () => startRename(song))
      li.append(name)
    }

    if (editing) {
      const tools = document.createElement('div')
      tools.className = 'pl-tools'
      const up = toolButton('', ICON.up, 'Move up', () => moveSong(i, -1))
      const down = toolButton('', ICON.down, 'Move down', () => moveSong(i, 1))
      up.disabled = i === 0
      down.disabled = i === list.length - 1
      tools.append(
        up,
        down,
        toolButton('', ICON.edit, `Rename ${song.title}`, () => startRename(song)),
        toolButton('pl-remove', ICON.remove, `Remove ${song.title}`, () => removeSong(song, li)),
      )
      li.append(tools)
    }
    ol.append(li)
  })
  renderPlayer()
}

function renameInput(song) {
  const input = document.createElement('input')
  input.className = 'pl-rename'
  input.maxLength = 120
  input.value = song.title
  input.setAttribute('aria-label', 'Song name')
  let done = false
  const finish = async (save) => {
    if (done) return
    done = true
    music.renaming = null
    const title = input.value.trim()
    if (!save || !title || title === song.title) return renderPlaylist()
    input.disabled = true
    try {
      applyConfig(await api(`/api/songs/${song.uploadId}`, jsonBody('PATCH', { title })))
      toast('Song renamed ♫')
    } catch (e) {
      toast(errorText(e), 5000)
      renderPlaylist()
    }
  }
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') finish(true)
    if (e.key === 'Escape') finish(false)
  })
  input.addEventListener('blur', () => finish(true))
  requestAnimationFrame(() => {
    input.focus()
    input.select()
  })
  return input
}

function startRename(song) {
  music.renaming = song.uploadId
  renderPlaylist()
}

async function moveSong(i, dir) {
  const list = [...playlist()]
  const j = i + dir
  if (j < 0 || j >= list.length) return
  ;[list[i], list[j]] = [list[j], list[i]]
  const previous = state.cfg.playlist
  state.cfg.playlist = list // optimistic reorder
  syncPlaylist()
  try {
    applyConfig(await api('/api/songs/order', jsonBody('PUT', { order: list.map((s) => s.uploadId) })))
  } catch (e) {
    state.cfg.playlist = previous
    syncPlaylist()
    toast(errorText(e), 5000)
  }
}

async function removeSong(song, li) {
  if (!confirm(`Remove “${song.title}” from the playlist?`)) return
  li.classList.add('busy')
  try {
    applyConfig(await api(`/api/songs/${song.uploadId}`, { method: 'DELETE' }))
    toast('Song removed')
  } catch (e) {
    li.classList.remove('busy')
    toast(errorText(e), 5000)
  }
}

async function addSongs(e) {
  const picked = [...e.target.files]
  e.target.value = ''
  if (!picked.length) return
  const label = $('.add-songs')
  label.classList.add('uploading')
  let added = 0
  try {
    for (const [n, file] of picked.entries()) {
      const prefix = picked.length > 1 ? `Uploading ${n + 1} of ${picked.length}…` : 'Uploading our song…'
      toast(`${prefix} 0%`, 60000)
      const cfg = await uploadSong(file, (p) => toast(`${prefix} ${Math.round(p * 100)}%`, 60000))
      applyConfig(cfg)
      added++
    }
    toast(added > 1 ? `${added} songs added ♫` : 'Song added ♫')
  } catch (err) {
    toast(errorText(err), 5000)
  } finally {
    label.classList.remove('uploading')
  }
}

function setPlaylistOpen(open) {
  $('#playlist').hidden = !open
  $('#btn-playlist').setAttribute('aria-expanded', String(open))
}

audio.addEventListener('play', renderPlayer)
audio.addEventListener('pause', renderPlayer)
audio.addEventListener('loadedmetadata', () => ($('#time-total').textContent = formatTime(audio.duration)))
audio.addEventListener('timeupdate', () => {
  if (!audio.duration || music.loadedId !== currentSong()?.uploadId) return
  const pct = (audio.currentTime / audio.duration) * 100
  const seek = $('#seek')
  if (!seek.matches(':active')) seek.value = String(Math.round(pct * 10))
  seek.style.setProperty('--pct', `${pct}%`)
  $('#time-now').textContent = formatTime(audio.currentTime)
})
audio.addEventListener('ended', () => {
  if (playlist().length === 1) {
    audio.currentTime = 0
    audio.play().catch(() => {})
  } else step(1)
})

$('#seek').addEventListener('input', (e) => {
  if (!audio.duration || !music.loadedId) return
  const pct = Number(e.target.value) / 10
  audio.currentTime = (pct / 100) * audio.duration
  e.target.style.setProperty('--pct', `${pct}%`)
})
$('#play').addEventListener('click', togglePlay)
$('#prev').addEventListener('click', () => {
  if (audio.currentTime > 4 && music.loadedId) audio.currentTime = 0
  else step(-1)
})
$('#next').addEventListener('click', () => step(1))
$('#btn-playlist').addEventListener('click', () => setPlaylistOpen($('#playlist').hidden))
$('#pl-close').addEventListener('click', () => setPlaylistOpen(false))
$('#song-input').addEventListener('change', addSongs)
$('#volume').addEventListener('input', (e) => {
  audio.volume = Number(e.target.value)
  localStorage.setItem('valley-volume', e.target.value)
})
$('#mode-repeat').addEventListener('click', () => {
  music.repeatOne = !music.repeatOne
  audio.loop = music.repeatOne
  localStorage.setItem('valley-repeat', music.repeatOne ? '1' : '0')
  renderPlayer()
})
$('#mode-shuffle').addEventListener('click', () => {
  music.shuffle = !music.shuffle
  localStorage.setItem('valley-shuffle', music.shuffle ? '1' : '0')
  renderPlayer()
})
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('#playlist').hidden && !document.querySelector('dialog[open]')) setPlaylistOpen(false)
  if (e.code === 'Space' && state.entered && !e.target.closest('input, textarea, button, dialog')) {
    e.preventDefault()
    togglePlay()
  }
})

/* ---------- Intro ---------- */

const enterBtn = $('#enter')
let sceneReady = false
let configReady = false
function maybeReady() {
  if (!sceneReady || !configReady) return
  enterBtn.disabled = false
  $('[data-enter-label]').textContent = 'Enter your valley ♡'
}
requestAnimationFrame(() =>
  requestAnimationFrame(() => {
    sceneReady = true
    maybeReady()
  }),
)

enterBtn.addEventListener('click', () => {
  state.entered = true
  if (playlist().length) play()
  else {
    audio.src = silentWav()
    audio.play().then(() => audio.pause()).catch(() => {})
  }
  $('#intro').classList.add('gone')
  $('.hud-top').hidden = false
  $('#player').hidden = false
  if (editing) $('#owner').hidden = false
  valley.introFly(() => {
    toast(editing ? 'Tap any glowing lily to plant a photo ✿' : 'Tap the glowing lilies to open our memories ✿', 4500)
  })
})

/* ---------- Dialogs ---------- */

document.querySelectorAll('dialog').forEach((d) => {
  d.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) return d.close()
    if (e.target !== d) return
    const r = d.getBoundingClientRect()
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close()
  })
})

function openMemory(i) {
  const m = state.cfg.memories[i]
  if (!m) return
  state.current = i
  $('#lb-img').src = photoUrl(m)
  $('#lb-img').alt = m.caption || 'A memory'
  $('#lb-caption').textContent = m.caption || ''
  $('#lb-date').textContent = m.date || ''
  const many = filledLilies().length > 1
  $('#lb-prev').hidden = !many
  $('#lb-next').hidden = !many
  if (!$('#lightbox').open) $('#lightbox').showModal()
}

function stepMemory(dir) {
  const list = filledLilies()
  const next = list[(list.indexOf(state.current) + dir + list.length) % list.length]
  $('#lightbox').close()
  valley.flyTo(next, () => openMemory(next))
}

$('#lb-prev').addEventListener('click', () => stepMemory(-1))
$('#lb-next').addEventListener('click', () => stepMemory(1))
$('#lb-edit').addEventListener('click', () => {
  $('#lightbox').close()
  openEditor(state.current)
})
$('#btn-letter').addEventListener('click', () => $('#letter').showModal())

$('#btn-memories').addEventListener('click', () => {
  const grid = $('#grid')
  grid.replaceChildren()
  const slots = editing ? Array.from({ length: LILY_COUNT }, (_, i) => i) : filledLilies()
  if (!slots.length) {
    const p = document.createElement('p')
    p.className = 'empty-note'
    p.textContent = 'The lilies are still waiting for their memories…'
    grid.append(p)
  }
  for (const i of slots) {
    const m = state.cfg.memories[i]
    const tile = document.createElement('button')
    tile.className = 'tile'
    if (m) {
      const img = document.createElement('img')
      img.src = photoUrl(m)
      img.alt = m.caption || 'A memory'
      img.loading = 'lazy'
      tile.append(img)
      if (m.caption) {
        const span = document.createElement('span')
        span.textContent = m.caption
        tile.append(span)
      }
    } else tile.textContent = `+ Lily ${i + 1}`
    tile.addEventListener('click', () => {
      $('#gallery').close()
      pickLily(i)
    })
    grid.append(tile)
  }
  $('#gallery').showModal()
})

/* ---------- Tour & fullscreen ---------- */

let tourTimer
function stopTour() {
  if (!state.touring) return
  state.touring = false
  clearTimeout(tourTimer)
  $('#btn-tour').classList.remove('on')
}

$('#btn-tour').addEventListener('click', () => {
  if (state.touring) {
    stopTour()
    return valley.goHome()
  }
  const stops = filledLilies().length ? filledLilies() : Array.from({ length: LILY_COUNT }, (_, i) => i)
  state.touring = true
  $('#btn-tour').classList.add('on')
  toast('Wandering through the valley… tap anywhere to stop')
  let n = 0
  const next = () => {
    if (!state.touring) return
    const i = stops[n++ % stops.length]
    valley.flyTo(i, () => {
      if (!state.touring) return
      const m = state.cfg.memories[i]
      if (m?.caption) toast(m.caption, 5000)
      tourTimer = setTimeout(next, 5500)
    })
  }
  next()
})
$('#scene').addEventListener('pointerdown', () => {
  stopTour()
  setPlaylistOpen(false)
})

const root = document.documentElement
const requestFs = root.requestFullscreen || root.webkitRequestFullscreen
if (!requestFs) $('#btn-fullscreen').hidden = true
$('#btn-fullscreen').addEventListener('click', () => {
  if (document.fullscreenElement || document.webkitFullscreenElement) {
    ;(document.exitFullscreen || document.webkitExitFullscreen).call(document)
  } else requestFs.call(root)
})

/* ---------- Memory editor ---------- */

let editSlot = -1
let editPhoto = null

function openEditor(i) {
  editSlot = i
  editPhoto = null
  const m = state.cfg.memories[i]
  const form = $('#ed-form')
  $('#ed-title').textContent = `Lily ${i + 1}`
  form.caption.value = m?.caption ?? ''
  form.date.value = m?.date ?? ''
  $('#ed-file').value = ''
  const preview = $('#ed-preview')
  preview.hidden = !m
  if (m) preview.src = photoUrl(m)
  $('#ed-drop-label').hidden = !!m
  $('#ed-remove').hidden = !m
  $('#editor').showModal()
}

$('#ed-file').addEventListener('change', (e) => {
  editPhoto = e.target.files[0] || null
  if (!editPhoto) return
  const preview = $('#ed-preview')
  preview.src = URL.createObjectURL(editPhoto)
  preview.hidden = false
  $('#ed-drop-label').hidden = true
})

$('#ed-form').addEventListener('submit', async (e) => {
  e.preventDefault()
  const form = e.target
  if (!editPhoto && !state.cfg.memories[editSlot]) return toast('Choose a photo first ✿')
  const save = $('#ed-save')
  save.disabled = true
  save.textContent = 'Planting…'
  try {
    const photo = editPhoto ? await shrinkPhoto(editPhoto) : null
    applyConfig(await saveMemory(editSlot, { photo, caption: form.caption.value, date: form.date.value }))
    $('#editor').close()
    toast('Memory planted ✿')
  } catch (err) {
    toast(errorText(err), 5000)
  } finally {
    save.disabled = false
    save.textContent = 'Plant memory'
  }
})

$('#ed-remove').addEventListener('click', async () => {
  if (!confirm('Remove this memory from the lily?')) return
  try {
    applyConfig(await api(`/api/memory/${editSlot}`, { method: 'DELETE' }))
    $('#editor').close()
    toast('Memory removed')
  } catch (err) {
    toast(errorText(err), 5000)
  }
})

/* ---------- Owner panel ---------- */

if (editing) {
  const setOwnerOpen = (open) => {
    $('#owner').classList.toggle('collapsed', !open)
    $('#owner-toggle').setAttribute('aria-expanded', String(open))
  }
  $('#owner-toggle').addEventListener('click', () => setOwnerOpen($('#owner').classList.contains('collapsed')))
  $('#owner-close').addEventListener('click', () => setOwnerOpen(false))
  // Fold the decorate panel away so it doesn't cover the playlist editor.
  $('#owner-playlist').addEventListener('click', () => {
    setOwnerOpen(false)
    setPlaylistOpen(true)
  })
  $('#cfg-save').addEventListener('click', async () => {
    try {
      applyConfig(await api('/api/config', jsonBody('POST', { name: $('#cfg-name').value, message: $('#cfg-message').value })))
      toast('Saved ♡')
    } catch (err) {
      toast(errorText(err), 5000)
    }
  })
}

/* ---------- Boot ---------- */

loadConfig()
  .then(applyConfig)
  .catch(() => applyConfig(state.cfg))
  .finally(() => {
    configReady = true
    maybeReady()
  })
