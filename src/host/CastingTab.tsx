import { useEffect, useMemo, useState } from 'react';
import { AgGridProvider, AgGridReact } from 'ag-grid-react';
import {
  AllCommunityModule,
  type CellValueChangedEvent,
  type ColDef,
  type ICellRendererParams,
  themeQuartz,
} from 'ag-grid-community';
import {
  hostBootstrap,
  hostSetFlags,
  hostSaveCharacter,
  type HostWorld,
  type ParticipantFull,
  type CharacterFull,
  type TruthTag,
} from '../lib/hostApi';
import { useHost } from './hostContext';
import { characterConcept, isGeneratedArchetype, seedCharacter } from './seedCharacter';
import {
  getIntakeReviewStatus,
  initializeIntakeReviewStore,
  markParticipantReviewed,
} from '../lib/participantReview';
import s from '../styles/ui.module.css';
import grid from '../styles/agGrid.module.css';
import styles from './CastingTab.module.css';

type CharacterField = keyof Pick<
  CharacterFull,
  'name' | 'title' | 'background' | 'act1' | 'act2' | 'act3' | 'props' | 'recommended_meets' | 'secret'
>;

type CastingRow = {
  participant: ParticipantFull;
  character: CharacterFull | null;
  guest: string;
  comfort: string;
  submittedConcept: string;
  name: string;
  title: string;
  background: string;
  act1: string;
  act2: string;
  act3: string;
  props: string;
  recommended_meets: string;
  truth_tags_text: string;
  secret: string;
  is_murderer: boolean;
  release: string;
  link: string;
};

const ensuringCardsBySecret = new Map<string, Promise<void>>();

const agTheme = themeQuartz.withParams({
  backgroundColor: 'rgba(0, 0, 0, 0.78)',
  foregroundColor: '#f4eee4',
  headerBackgroundColor: 'rgba(0, 0, 0, 0.94)',
  headerTextColor: '#f4eee4',
  oddRowBackgroundColor: 'rgba(255, 255, 255, 0.025)',
  rowHoverColor: 'rgba(255, 255, 255, 0.07)',
  borderColor: 'rgba(244, 238, 228, 0.22)',
  accentColor: '#c0392b',
  fontFamily: 'inherit',
  fontSize: 12,
  headerHeight: 38,
});

export default function CastingTab() {
  const { secret } = useHost();
  const [world, setWorld] = useState<HostWorld | null>(null);
  const [error, setError] = useState('');
  const [ensuringCards, setEnsuringCards] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [releaseReviewId, setReleaseReviewId] = useState<string | null>(null);
  const [, setReviewTick] = useState(0);

  async function reload() {
    try {
      setWorld(await hostBootstrap(secret));
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? '';
      setError(
        /host_bootstrap|does not exist|schema cache/i.test(msg)
          ? 'Casting backend not installed yet — run supabase/casting.sql in the Supabase SQL Editor, then reload.'
          : 'Could not load casting data.',
      );
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secret]);

  useEffect(() => {
    if (!world) return;
    initializeIntakeReviewStore(world.participants);
    setReviewTick((tick) => tick + 1);
  }, [world]);

  useEffect(() => {
    if (!world) return;
    const characterIds = new Set(world.characters.map((character) => character.id));
    const missing = world.participants.filter((participant) => (
      !participant.character_id || !characterIds.has(participant.character_id)
    ));
    if (!missing.length) return;

    let cancelled = false;
    let job = ensuringCardsBySecret.get(secret);
    if (!job) {
      job = (async () => {
        for (const participant of missing) {
          const seed = seedCharacter(participant, world.participants.indexOf(participant));
          await hostSaveCharacter(secret, { ...seed, participant_id: participant.id });
          markParticipantReviewed(participant);
        }
      })().finally(() => {
        ensuringCardsBySecret.delete(secret);
      });
      ensuringCardsBySecret.set(secret, job);
    }

    setEnsuringCards(true);
    job
      .then(async () => {
        if (!cancelled) await reload();
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Could not prepare character rows.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setEnsuringCards(false);
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, secret]);
  const rows = useMemo(() => {
    if (!world) return [];
    const byId = (id: string | null) => world.characters.find((x) => x.id === id) ?? null;
    return world.participants.map((participant): CastingRow => {
      const character = byId(participant.character_id);
      const title = character?.title && isGeneratedArchetype(character.title)
        ? characterConcept(participant)
        : character?.title ?? '';
      const reviewStatus = getIntakeReviewStatus(participant);
      const guest = [
        displayName(participant),
        reviewStatus ? `- ${formatReviewLabel(reviewStatus.label)}` : null,
      ].filter(Boolean).join(' ');
      const link = `${window.location.origin}${import.meta.env.BASE_URL}?p=${participant.token}`;
      return {
        participant,
        character,
        guest,
        comfort: participant.roleplay_comfort == null ? '-' : `${participant.roleplay_comfort}/5`,
        submittedConcept: characterConcept(participant),
        name: character?.name ?? '',
        title,
        background: character?.background ?? '',
        act1: character?.act1 ?? '',
        act2: character?.act2 ?? '',
        act3: character?.act3 ?? '',
        props: character?.props ?? '',
        recommended_meets: character?.recommended_meets ?? '',
        truth_tags_text: character ? truthTagsToText(character.truth_tags) : '',
        secret: character?.secret ?? '',
        is_murderer: participant.is_murderer,
        release: character?.released ? 'Released' : 'Private',
        link,
      };
    });
  }, [world]);

  if (error) return <Shell><p className={s.body}>{error}</p></Shell>;
  if (!world) return <Shell><p className={`${s.body} ${s.muted}`}>Loading...</p></Shell>;

  const participants = world.participants;
  const released = world.characters.filter((character) => character.released).length;
  const killers = participants.filter((p) => p.is_murderer).length;

  async function saveField(row: CastingRow, field: CharacterField, raw: unknown) {
    if (!row.character) return;
    const value = String(raw ?? '');
    const nextValue = field === 'title' && isGeneratedArchetype(value) ? characterConcept(row.participant) : value;
    if (String(row.character[field] ?? '') === nextValue) return;
    setBusyId(row.participant.id);
    try {
      await hostSaveCharacter(secret, { id: row.character.id, [field]: nextValue });
      setWorld((prev) => prev ? updateCharacterInWorld(prev, row.character!.id, { [field]: nextValue }) : prev);
    } finally {
      setBusyId(null);
    }
  }

  async function saveTruthTags(row: CastingRow, raw: unknown) {
    if (!row.character) return;
    const next = parseTruthTags(String(raw ?? ''));
    if (truthTagsToText(row.character.truth_tags) === truthTagsToText(next)) return;
    setBusyId(row.character.id);
    try {
      await hostSaveCharacter(secret, { id: row.character.id, truth_tags: next });
      setWorld((prev) => prev ? updateCharacterInWorld(prev, row.character!.id, { truth_tags: next }) : prev);
    } finally {
      setBusyId(null);
    }
  }

  async function toggleMurderer(row: CastingRow) {
    setBusyId(row.participant.id);
    try {
      await hostSetFlags(secret, row.participant.id, { is_murderer: !row.participant.is_murderer });
      setWorld((prev) =>
        prev
          ? {
              ...prev,
              participants: prev.participants.map((item) =>
                item.id === row.participant.id ? { ...item, is_murderer: !item.is_murderer } : item,
              ),
            }
          : prev,
      );
    } finally {
      setBusyId(null);
    }
  }

  async function setReleased(row: CastingRow, released: boolean) {
    if (!row.character) return;
    setBusyId(row.character.id);
    try {
      await hostSaveCharacter(secret, { id: row.character.id, released });
      setWorld((prev) => prev ? updateCharacterInWorld(prev, row.character!.id, { released }) : prev);
      if (released) setReleaseReviewId(null);
    } finally {
      setBusyId(null);
    }
  }

  const columnDefs: ColDef<CastingRow>[] = [
    {
      headerName: 'Guest',
      field: 'guest',
      pinned: 'left',
      width: 190,
      editable: false,
      cellClass: 'mm-strong-cell',
      cellRenderer: (params: ICellRendererParams<CastingRow>) => (
        <div className={styles.guestCell}>
          <span>{params.value}</span>
        </div>
      ),
    },
    { headerName: 'Comfort', field: 'comfort', width: 110, editable: false },
    { headerName: 'Submitted concept', field: 'submittedConcept', width: 240, editable: false, cellClass: 'mm-wrap-cell' },
    { headerName: 'Persona name', field: 'name', width: 180, editable: hasCharacter },
    { headerName: 'Title / concept', field: 'title', width: 220, editable: hasCharacter },
    largeTextColumn('Background', 'background', 300),
    largeTextColumn('Act I', 'act1', 300),
    largeTextColumn('Act II', 'act2', 300),
    largeTextColumn('Act III', 'act3', 300),
    largeTextColumn('Props', 'props', 220),
    largeTextColumn('People', 'recommended_meets', 220),
    largeTextColumn('Truth tags', 'truth_tags_text', 260),
    largeTextColumn('Secret', 'secret', 300),
    {
      headerName: 'Murderer',
      field: 'is_murderer',
      width: 120,
      editable: false,
      cellRenderer: (params: ICellRendererParams<CastingRow>) => (
        <label className={styles.checkLabel}>
          <input
            type="checkbox"
            checked={Boolean(params.data?.is_murderer)}
            disabled={!params.data || busyId === params.data.participant.id}
            onChange={() => params.data && toggleMurderer(params.data)}
          />
          <span>{params.data?.is_murderer ? 'Yes' : 'No'}</span>
        </label>
      ),
    },
    {
      headerName: 'Release',
      field: 'release',
      width: 150,
      editable: false,
      cellRenderer: (params: ICellRendererParams<CastingRow>) => {
        const row = params.data;
        if (!row?.character) return <span className={styles.quiet}>Preparing</span>;
        const reviewing = releaseReviewId === row.character.id;
        if (row.character.released) {
          return (
            <div className={styles.releaseCell}>
              <span className={`${styles.status} ${styles.statusLive}`}>Released</span>
              <button className={styles.smallButton} disabled={busyId === row.character.id} onClick={() => setReleased(row, false)}>
                Hide
              </button>
            </div>
          );
        }
        if (reviewing) {
          return (
            <div className={styles.releaseCell}>
              <span>Visible immediately.</span>
              <button className={styles.smallButton} disabled={busyId === row.character.id} onClick={() => setReleased(row, true)}>
                Confirm
              </button>
              <button className={styles.smallButton} onClick={() => setReleaseReviewId(null)}>Cancel</button>
            </div>
          );
        }
        return (
          <div className={styles.releaseCell}>
            <span className={`${styles.status} ${styles.statusPrivate}`}>Private</span>
            <button className={styles.smallButton} disabled={busyId === row.character.id} onClick={() => setReleaseReviewId(row.character!.id)}>
              Review
            </button>
          </div>
        );
      },
    },
    {
      headerName: 'Link',
      field: 'link',
      width: 110,
      editable: false,
      cellRenderer: (params: ICellRendererParams<CastingRow>) => (
        <button className={styles.smallButton} onClick={() => params.value && navigator.clipboard?.writeText(String(params.value))}>
          Copy
        </button>
      ),
    },
  ];

  async function onCellValueChanged(event: CellValueChangedEvent<CastingRow>) {
    const row = event.data;
    if (!row || event.newValue === event.oldValue) return;
    const field = event.colDef.field;
    if (isCharacterField(field)) await saveField(row, field, event.newValue);
    else if (field === 'truth_tags_text') await saveTruthTags(row, event.newValue);
  }

  return (
    <Shell>
      <h1 className={s.title}>Casting</h1>
      <p className={`${s.body} ${s.muted}`} style={{ marginTop: 'var(--space-2)' }}>
        Build and release each player's card directly in the grid. Double-click a cell to edit.
      </p>
      <p className={`${s.body} ${s.muted}`} style={{ marginTop: 'var(--space-2)' }}>
        {world.participants.length} players · {released} released · {killers} murderer{killers === 1 ? '' : 's'} flagged
      </p>
      {ensuringCards && <p className={`${s.body} ${styles.syncNote}`}>Preparing private character rows...</p>}

      <div className={`${grid.gridShell} ${styles.gridHeight}`}>
        <AgGridProvider modules={[AllCommunityModule]}>
          <AgGridReact<CastingRow>
            theme={agTheme}
            rowData={rows}
            columnDefs={columnDefs}
            domLayout="autoHeight"
            defaultColDef={{
              sortable: true,
              filter: true,
              resizable: true,
              wrapText: true,
              autoHeight: true,
            }}
            getRowId={(params) => params.data.participant.id}
            singleClickEdit={false}
            stopEditingWhenCellsLoseFocus
            onCellValueChanged={onCellValueChanged}
          />
        </AgGridProvider>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${s.page} ${styles.pageScroll}`}>
      <div className={`${s.inner} ${styles.inner}`}>{children}</div>
    </div>
  );
}

function largeTextColumn(headerName: string, field: keyof CastingRow, width: number): ColDef<CastingRow> {
  return {
    headerName,
    field,
    width,
    editable: hasCharacter,
    cellClass: 'mm-wrap-cell',
    cellEditor: 'agLargeTextCellEditor',
    cellEditorPopup: true,
    cellEditorParams: { rows: 8, cols: 48 },
  };
}

function hasCharacter(params: { data?: CastingRow | null }): boolean {
  return Boolean(params.data?.character);
}

function isCharacterField(field: string | undefined): field is CharacterField {
  return Boolean(field && ['name', 'title', 'background', 'act1', 'act2', 'act3', 'props', 'recommended_meets', 'secret'].includes(field));
}

function formatReviewLabel(label: string): string {
  return label.replace(/^Guest /, '').replace(/^New submission/, 'new submission').replace(/^modified/, 'edited');
}

function updateCharacterInWorld(world: HostWorld, id: string, patch: Partial<CharacterFull>): HostWorld {
  return {
    ...world,
    characters: world.characters.map((char) => (char.id === id ? { ...char, ...patch } : char)),
  };
}

function displayName(p: ParticipantFull): string {
  return p.preferred_name?.trim() || p.contact?.trim() || 'unnamed';
}

function truthTagsToText(tags: TruthTag[]): string {
  return tags
    .map((tag) => [tag.beat, tag.truth].filter(Boolean).join(': '))
    .filter(Boolean)
    .join('\n');
}

function parseTruthTags(value: string): TruthTag[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const index = line.indexOf(':');
      if (index === -1) return { truth: line };
      return {
        beat: line.slice(0, index).trim(),
        truth: line.slice(index + 1).trim(),
      };
    });
}
