import { useCanvasStore } from '../../store/canvasStore';
import type { Guest } from '../../types/canvas';
import f from './forms.module.css';

const RSVP: Guest['rsvp'][] = ['yes', 'maybe', 'no', 'invited'];

export default function GuestTab() {
  const guests = useCanvasStore((s) => s.guests);
  const order = useCanvasStore((s) => s.guestOrder);
  const characters = useCanvasStore((s) => s.characters);
  const itemOrder = useCanvasStore((s) => s.itemOrder);
  const add = useCanvasStore((s) => s.addGuest);
  const update = useCanvasStore((s) => s.updateGuest);
  const del = useCanvasStore((s) => s.deleteGuest);

  return (
    <div className={f.page}>
      <div className={f.inner}>
        <header className={f.head}>
          <h1 className={f.title}>Guest List</h1>
          <p className={f.subtitle}>
            Who’s coming, what they’re bringing to the potluck, and the character they’ll play.
            This is the shareable view — only public bios show here, never the secrets.
          </p>
        </header>

        {order.length === 0 && <div className={f.empty}>No guests yet. Add your first below.</div>}

        {order.map((id) => {
          const g = guests[id];
          if (!g) return null;
          const char = g.characterId ? characters[g.characterId] : null;
          return (
            <div key={id} className={f.card}>
              <button className={f.del} onClick={() => del(id)} aria-label="Remove guest">
                ×
              </button>

              <div className={f.row}>
                <div className={f.field}>
                  <span className={f.label}>Guest</span>
                  <input
                    className={f.input}
                    placeholder="Name"
                    value={g.name}
                    onChange={(e) => update(id, { name: e.target.value })}
                  />
                </div>
                <div className={f.field}>
                  <span className={f.label}>Bringing (potluck)</span>
                  <input
                    className={f.input}
                    placeholder="e.g. Lemon tart"
                    value={g.dish}
                    onChange={(e) => update(id, { dish: e.target.value })}
                  />
                </div>
              </div>

              <div className={f.row}>
                <div className={f.field}>
                  <span className={f.label}>Playing</span>
                  <select
                    className={f.select}
                    value={g.characterId ?? ''}
                    onChange={(e) => update(id, { characterId: e.target.value || null })}
                  >
                    <option value="">— not cast yet —</option>
                    {itemOrder.map((cid) => {
                      const c = characters[cid];
                      if (!c) return null;
                      const takenByOther = c.guestId && c.guestId !== id;
                      return (
                        <option key={cid} value={cid}>
                          {c.name}
                          {c.role ? ` · ${c.role}` : ''}
                          {takenByOther ? ' (cast)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div className={f.field} style={{ maxWidth: 160 }}>
                  <span className={f.label}>RSVP</span>
                  <select
                    className={f.select}
                    value={g.rsvp}
                    onChange={(e) => update(id, { rsvp: e.target.value as Guest['rsvp'] })}
                  >
                    {RSVP.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {char && (
                <div className={f.field}>
                  <span className={f.label} style={{ color: char.color }}>
                    {char.role || 'Character'} — public bio
                  </span>
                  <p style={{ fontSize: 'var(--text-md)', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                    {char.bio || <em>No public bio written yet (set it in Planning).</em>}
                  </p>
                </div>
              )}
            </div>
          );
        })}

        <button className={f.addBtn} onClick={() => add()}>
          + Add guest
        </button>
      </div>
    </div>
  );
}
