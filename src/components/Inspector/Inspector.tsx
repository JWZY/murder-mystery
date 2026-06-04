import { AnimatePresence, motion } from 'framer-motion';
import { useCanvasStore } from '../../store/canvasStore';
import styles from './Inspector.module.css';

const COLORS = [
  '#c0392b', '#2980b9', '#27ae60', '#8e44ad',
  '#d35400', '#16a085', '#c2185b', '#7f8c8d',
];

export default function Inspector() {
  const selectedId = useCanvasStore((s) => s.selectedId);
  const characters = useCanvasStore((s) => s.characters);
  const relationships = useCanvasStore((s) => s.relationships);
  const guests = useCanvasStore((s) => s.guests);
  const guestOrder = useCanvasStore((s) => s.guestOrder);
  const update = useCanvasStore((s) => s.updateCharacter);
  const del = useCanvasStore((s) => s.deleteCharacter);
  const select = useCanvasStore((s) => s.select);
  const startConnecting = useCanvasStore((s) => s.startConnecting);
  const updateRel = useCanvasStore((s) => s.updateRelationship);
  const delRel = useCanvasStore((s) => s.deleteRelationship);

  const c = selectedId ? characters[selectedId] : null;

  const connections = c
    ? Object.values(relationships).filter((r) => r.from === c.id || r.to === c.id)
    : [];

  return (
    <AnimatePresence>
      {c && (
        <motion.aside
          className={styles.panel}
          data-ui
          initial={{ x: 360, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 360, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        >
          <header className={styles.header}>
            <div className={styles.swatchRow}>
              {COLORS.map((col) => (
                <button
                  key={col}
                  className={`${styles.swatch} ${c.color === col ? styles.swatchOn : ''}`}
                  style={{ background: col }}
                  onClick={() => update(c.id, { color: col })}
                  aria-label={`Set color ${col}`}
                />
              ))}
            </div>
            <button className={styles.close} onClick={() => select(null)} aria-label="Close">
              ×
            </button>
          </header>

          <label className={styles.field}>
            <span className={styles.label}>Name</span>
            <input
              className={styles.input}
              value={c.name}
              onChange={(e) => update(c.id, { name: e.target.value })}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Role / archetype</span>
            <input
              className={styles.input}
              placeholder="The Heiress, The Butler…"
              value={c.role}
              onChange={(e) => update(c.id, { role: e.target.value })}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Cast as</span>
            <select
              className={styles.input}
              value={c.guestId ?? ''}
              onChange={(e) => assignGuest(c.id, e.target.value || null)}
            >
              <option value="">— not cast —</option>
              {guestOrder.map((gid) => {
                const g = guests[gid];
                if (!g) return null;
                return (
                  <option key={gid} value={gid}>
                    {g.name || 'unnamed guest'}
                  </option>
                );
              })}
            </select>
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Public bio</span>
            <textarea
              className={styles.textarea}
              rows={3}
              placeholder="What guests will see about this character."
              value={c.bio}
              onChange={(e) => update(c.id, { bio: e.target.value })}
            />
          </label>

          <label className={styles.field}>
            <span className={`${styles.label} ${styles.secretLabel}`}>
              🔒 Secret / motive — host only
            </span>
            <textarea
              className={`${styles.textarea} ${styles.secret}`}
              rows={4}
              placeholder="The real story. Who they are, what they're hiding, their motive."
              value={c.secret}
              onChange={(e) => update(c.id, { secret: e.target.value })}
            />
          </label>

          <div className={styles.field}>
            <div className={styles.connHeader}>
              <span className={styles.label}>Connections</span>
              <button className={styles.connectBtn} onClick={() => startConnecting(c.id)}>
                + connect
              </button>
            </div>
            {connections.length === 0 && (
              <p className={styles.empty}>No connections yet. Hit “connect”, then click another node.</p>
            )}
            {connections.map((r) => {
              const otherId = r.from === c.id ? r.to : r.from;
              const other = characters[otherId];
              return (
                <div key={r.id} className={styles.conn}>
                  <span className={styles.connTo} style={{ color: other?.color }}>
                    {r.from === c.id ? '→' : '←'} {other?.name ?? '???'}
                  </span>
                  <input
                    className={styles.connInput}
                    placeholder="how they're connected"
                    value={r.label}
                    onChange={(e) => updateRel(r.id, e.target.value)}
                  />
                  <button className={styles.connDel} onClick={() => delRel(r.id)} aria-label="Remove">
                    ×
                  </button>
                </div>
              );
            })}
          </div>

          <button className={styles.delete} onClick={() => del(c.id)}>
            Delete character
          </button>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

/** Casting is owned by the guest record; route through updateGuest to keep both sides synced. */
function assignGuest(characterId: string, guestId: string | null) {
  const store = useCanvasStore.getState();
  // clear any guest currently cast as this character
  for (const g of Object.values(store.guests)) {
    if (g.characterId === characterId) store.updateGuest(g.id, { characterId: null });
  }
  if (guestId) store.updateGuest(guestId, { characterId });
  else store.updateCharacter(characterId, { guestId: null });
}
