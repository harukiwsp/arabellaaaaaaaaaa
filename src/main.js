import './style.css'
import { createValley, LILY_COUNT } from './scene.js'

const EDIT_KEY = 'valley-edit-key'
const CHUNK = 3 * 1024 * 1024
const MAX_PARTS = 12
const DEFAULT_LILY_COUNT = 12
const MAX_LILY_COUNT = 48

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

function getCurrentLilyCount() {
  const stored = Number(localStorage.getItem('valley-lily-count') || DEFAULT_LILY_COUNT)
  return Math.min(Math.max(Number.isFinite(stored) ? stored : DEFAULT_LILY_COUNT, DEFAULT_LILY_COUNT), MAX_LILY_COUNT)
}

function addMoreLilies() {
  const current = getCurrentLilyCount()
  const next = Math.min(current + 12, MAX_LILY_COUNT)
  localStorage.setItem('valley-lily-count', String(next))
  window.location.reload()
}

/* ---------- API ---------- */
