// Сохранение прогресса: личное хранилище артефакта (db, приватно для пользователя) + localStorage как резерв
const { useState, useEffect, useRef } = React;

const LS_PREFIX = 'rta_v1_';
const KEYS = ['progress', 'cases', 'sim', 'live'];

function lsGet(k) { try { const s = localStorage.getItem(LS_PREFIX + k); return s ? JSON.parse(s) : null; } catch (_) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(LS_PREFIX + k, JSON.stringify(v)); } catch (_) {} }

let dbState = { db: null, uid: null, ready: false, status: 'local' };
const dbWaiters = [];
async function initDb() {
  try {
    if (!window.claude || !window.claude.use) { dbState.ready = true; return; }
    const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
    if (db && user) {
      const id = await user.id();
      if (id) { dbState.db = db; dbState.uid = id; dbState.status = 'cloud'; }
    }
  } catch (_) {}
  dbState.ready = true;
  dbWaiters.splice(0).forEach(f => f());
}
initDb();
function whenDb() { return dbState.ready ? Promise.resolve() : new Promise(r => dbWaiters.push(r)); }
export function storageStatus() { return dbState.status; }

function docRef(key) { return dbState.db.doc(`data/users/${dbState.uid}/${key}`); }

// usePersistent(key, init): значение + сеттер; сохраняет с задержкой, по одной записи за раз
export function usePersistent(key, init) {
  const [val, setVal] = useState(() => {
    const v = lsGet(key);
    return v != null ? v : (typeof init === 'function' ? init() : init);
  });
  const latest = useRef(val);
  const timer = useRef(null);
  const writing = useRef(false);
  const dirty = useRef(false);
  const loadedRemote = useRef(false);
  const touched = useRef(false);

  useEffect(() => {
    let alive = true;
    whenDb().then(async () => {
      if (!dbState.db) { loadedRemote.current = true; return; }
      const t = setTimeout(() => { loadedRemote.current = true; }, 10000);
      try {
        const snap = await docRef(key).get();
        clearTimeout(t);
        if (!alive) return;
        if (snap.exists) {
          const d = snap.data();
          const local = latest.current;
          const remoteT = d && d._t || 0, localT = local && local._t || 0;
          if (d && d.v != null && remoteT > localT && !touched.current) {
            const v = { ...d.v, _t: remoteT };
            latest.current = v; setVal(v); lsSet(key, v);
          }
        }
      } catch (_) {}
      loadedRemote.current = true;
      if (dirty.current) flush();
    });
    return () => { alive = false; };
  }, []);

  async function flush() {
    if (!dbState.db || !loadedRemote.current) { dirty.current = true; return; }
    if (writing.current) { dirty.current = true; return; }
    writing.current = true; dirty.current = false;
    try {
      const v = latest.current;
      await docRef(key).set({ v: JSON.parse(JSON.stringify(v)), _t: v._t || Date.now() });
    } catch (_) {}
    writing.current = false;
    if (dirty.current) flush();
  }

  const set = upd => {
    touched.current = true;
    setVal(prev => {
      const nx = typeof upd === 'function' ? upd(prev) : upd;
      if (nx === prev) return prev;
      const v = { ...nx, _t: Date.now() };
      latest.current = v;
      lsSet(key, v);
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, 1500);
      return v;
    });
  };
  return [val, set];
}
