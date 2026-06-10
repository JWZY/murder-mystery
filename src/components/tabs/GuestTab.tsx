import { type ReactNode, useEffect, useMemo, useState } from 'react';
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
  hostDeleteParticipant,
  hostUpdateParticipant,
  type CharacterFull,
  type HostUpdateParticipantPayload,
  type HostWorld,
  type ParticipantFull,
} from '../../lib/hostApi';
import type { ParticipantRecord, Rsvp } from '../../types/participant';
import { useHost } from '../../host/hostContext';
import { updateMyRecord } from '../../lib/api';
import { DISH_OPTIONS } from '../../lib/intakeSchema';
import {
  getIntakeReviewStatus,
  hasSubmittedIntake,
  initializeIntakeReviewStore,
  markParticipantReviewed,
} from '../../lib/participantReview';
import { characterConcept, isGeneratedArchetype } from '../../host/seedCharacter';
import s from '../../styles/ui.module.css';
import grid from '../../styles/agGrid.module.css';
import styles from './GuestTab.module.css';

type EditableGuestField = keyof Pick<
  ParticipantFull,
  | 'preferred_name'
  | 'contact'
  | 'rsvp'
  | 'dish_category'
  | 'dish_detail'
  | 'dietary'
  | 'roleplay_comfort'
  | 'trope_wishlist'
  | 'surprise_fact'
  | 'hard_limits'
  | 'public_bio'
  | 'notes'
  | 'host_notes'
>;

type GuestRow = {
  participant: ParticipantFull;
  character: CharacterFull | null;
  preferred_name: string;
  status: string;
  rsvp: Rsvp;
  contact: string;
  roleplay_comfort: number | null;
  trope_wishlist: string;
  surprise_fact: string;
  hard_limits: string;
  dietary: string;
  dish_category: string | null;
  dish_detail: string;
  public_bio: string;
  notes: string;
  host_notes: string;
  role: string;
  invite_link: string;
  created_at: string;
  updated_at: string;
};

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

const RSVP_VALUES: Rsvp[] = ['yes', 'maybe', 'no'];
const COMFORT_VALUES = [1, 2, 3, 4, 5];
const DISH_VALUES = ['', ...DISH_OPTIONS.map((option) => option.v)];
const HOST_UPDATE_FIELDS = new Set<EditableGuestField>([
  'preferred_name',
  'contact',
  'rsvp',
  'dish_category',
  'dish_detail',
  'dietary',
  'public_bio',
  'host_notes',
]);

export default function GuestTab() {
  const { secret } = useHost();
  const [world, setWorld] = useState<HostWorld | null>(null);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState('');
  const [, setReviewTick] = useState(0);

  useEffect(() => {
    hostBootstrap(secret).then(setWorld).catch(() => setError('Could not load the guest list.'));
  }, [secret]);

  useEffect(() => {
    if (!world) return;
    initializeIntakeReviewStore(world.participants);
    setReviewTick((tick) => tick + 1);
  }, [world]);

  const rows = useMemo(() => {
    if (!world) return [];
    const charactersById = Object.fromEntries(world.characters.map((c) => [c.id, c]));
    return [...world.participants].sort(sortGuests).map((participant): GuestRow => {
      const character = participant.character_id ? charactersById[participant.character_id] ?? null : null;
      return {
        participant,
        character,
        preferred_name: participant.preferred_name ?? '',
        status: hasSubmittedIntake(participant) ? 'Submitted' : 'Invited',
        rsvp: participant.rsvp,
        contact: participant.contact ?? '',
        roleplay_comfort: participant.roleplay_comfort,
        trope_wishlist: participant.trope_wishlist ?? '',
        surprise_fact: participant.surprise_fact ?? '',
        hard_limits: participant.hard_limits ?? '',
        dietary: participant.dietary ?? '',
        dish_category: participant.dish_category,
        dish_detail: participant.dish_detail ?? '',
        public_bio: participant.public_bio ?? '',
        notes: participant.notes ?? '',
        host_notes: participant.host_notes ?? '',
        role: character ? formatRole(character, participant) : 'Uncast',
        invite_link: inviteLink(participant),
        created_at: participant.created_at,
        updated_at: participant.updated_at ?? '',
      };
    });
  }, [world]);

  if (error) return <Shell><p className={s.body}>{error}</p></Shell>;
  if (!world) return <Shell><p className={`${s.body} ${s.muted}`}>Loading...</p></Shell>;

  const guests = world.participants;
  const submitted = guests.filter(hasSubmittedIntake).length;
  const invitedOnly = guests.length - submitted;
  const coming = guests.filter((g) => g.rsvp === 'yes').length;
  const rosterVisible = world.settings?.roster_visible ?? false;

  async function onDelete(row: GuestRow) {
    if (!confirm(`Delete "${displayName(row.participant)}" permanently?`)) return;
    setBusyId(row.participant.id);
    try {
      await hostDeleteParticipant(secret, row.participant.id);
      setWorld((prev) =>
        prev ? { ...prev, participants: prev.participants.filter((x) => x.id !== row.participant.id) } : prev
      );
    } finally {
      setBusyId(null);
    }
  }

  async function copyInviteLink(row: GuestRow) {
    try {
      await navigator.clipboard.writeText(row.invite_link);
      setCopiedId(row.participant.id);
      window.setTimeout(() => setCopiedId((current) => current === row.participant.id ? null : current), 1400);
    } catch {
      window.prompt('Copy invite link', row.invite_link);
    }
  }

  function updateParticipantInWorld(participant: ParticipantFull) {
    setWorld((prev) =>
      prev
        ? {
            ...prev,
            participants: prev.participants.map((existing) =>
              existing.id === participant.id ? participant : existing
            ),
          }
        : prev
    );
    markParticipantReviewed(participant);
    setReviewTick((tick) => tick + 1);
  }

  async function onCellValueChanged(event: CellValueChangedEvent<GuestRow>) {
    const row = event.data;
    const field = event.colDef.field;
    if (!row || !isEditableGuestField(field) || event.newValue === event.oldValue) return;

    const nextValue = normalizeCellValue(field, event.newValue);
    const nextParticipant = { ...row.participant, [field]: nextValue } as ParticipantFull;
    if (!displayName(nextParticipant).trim()) {
      setRowError('Keep a name or contact on the row.');
      event.node.setDataValue(field, event.oldValue);
      return;
    }

    setBusyId(row.participant.id);
    setRowError('');
    try {
      const participant = await updateParticipantCell(secret, row.participant, field, nextValue);
      updateParticipantInWorld(participant);
    } catch (e) {
      event.node.setDataValue(field, event.oldValue);
      setRowError(e instanceof Error ? e.message : 'Could not save that cell.');
    } finally {
      setBusyId(null);
    }
  }

  const columnDefs: ColDef<GuestRow>[] = [
    {
      headerName: 'Guest',
      field: 'preferred_name',
      pinned: 'left',
      width: 210,
      editable: true,
      cellClass: 'mm-strong-cell',
      cellRenderer: (params: ICellRendererParams<GuestRow>) => {
        const participant = params.data?.participant;
        if (!participant) return params.value;
        const reviewStatus = getIntakeReviewStatus(participant);
        return (
          <span className={styles.guestNameCell}>
            {displayName(participant)}
            {reviewStatus && <span className={styles.reviewMarker}> - {formatReviewLabel(reviewStatus.label)}</span>}
          </span>
        );
      },
    },
    {
      headerName: 'Status',
      field: 'status',
      width: 118,
      editable: false,
    },
    {
      headerName: 'RSVP',
      field: 'rsvp',
      width: 104,
      editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: { values: RSVP_VALUES },
      valueFormatter: (params) => humanRsvp(params.value as Rsvp),
    },
    { headerName: 'Contact', field: 'contact', width: 180, editable: true },
    {
      headerName: 'Comfort',
      field: 'roleplay_comfort',
      width: 112,
      editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: { values: COMFORT_VALUES },
      valueFormatter: (params) => params.value == null ? '-' : `${params.value}/5`,
    },
    largeTextColumn('Character/tropes', 'trope_wishlist', 260),
    largeTextColumn('You vs character', 'surprise_fact', 280),
    largeTextColumn('Avoid', 'hard_limits', 240),
    { headerName: 'Dietary', field: 'dietary', width: 170, editable: true, cellClass: 'mm-clamp-cell' },
    {
      headerName: 'Dish category',
      field: 'dish_category',
      width: 145,
      editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: { values: DISH_VALUES },
      valueFormatter: (params) => formatDishCategory(params.value),
    },
    largeTextColumn('Dish detail', 'dish_detail', 220),
    largeTextColumn('Public bio', 'public_bio', 240),
    largeTextColumn('Guest notes', 'notes', 240),
    largeTextColumn('Host notes', 'host_notes', 240),
    { headerName: 'Role', field: 'role', width: 220, editable: false, cellClass: 'mm-wrap-cell' },
    {
      headerName: 'Invite link',
      field: 'invite_link',
      width: 118,
      editable: false,
      cellRenderer: (params: ICellRendererParams<GuestRow>) => (
        <button className={styles.smallButton} onClick={() => params.data && copyInviteLink(params.data)}>
          {copiedId === params.data?.participant.id ? 'Copied' : 'Copy'}
        </button>
      ),
    },
    {
      headerName: 'Updated',
      field: 'updated_at',
      width: 118,
      editable: false,
      valueFormatter: (params) => formatDate(params.value),
    },
    {
      headerName: 'Created',
      field: 'created_at',
      width: 118,
      editable: false,
      valueFormatter: (params) => formatDate(params.value),
    },
    {
      headerName: 'Delete',
      field: 'status',
      width: 98,
      editable: false,
      cellRenderer: (params: ICellRendererParams<GuestRow>) => (
        <button
          className={`${styles.smallButton} ${styles.dangerButton}`}
          disabled={!params.data || busyId === params.data.participant.id}
          onClick={() => params.data && onDelete(params.data)}
        >
          Delete
        </button>
      ),
    },
  ];

  return (
    <Shell>
      <div className={s.titleRow}>
        <div>
          <h1 className={s.title}>Guests</h1>
          <p className={s.intro}>
            {guests.length} tracked · {submitted} submitted · {invitedOnly} invited · {coming} yes · roster {rosterVisible ? 'live' : 'hidden'}
          </p>
        </div>
      </div>

      {rowError && <p className={`${s.notice} ${styles.addError}`}>{rowError}</p>}

      <div className={`${grid.gridShell} ${styles.gridHeight}`}>
        <AgGridProvider modules={[AllCommunityModule]}>
          <AgGridReact<GuestRow>
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
            singleClickEdit
            stopEditingWhenCellsLoseFocus
            undoRedoCellEditing
            overlayNoRowsTemplate="No guests yet."
            onCellValueChanged={onCellValueChanged}
          />
        </AgGridProvider>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className={`${s.page} ${styles.pageScroll}`}>
      <div className={`${s.inner} ${styles.inner}`}>{children}</div>
    </div>
  );
}

function largeTextColumn(headerName: string, field: EditableGuestField, width: number): ColDef<GuestRow> {
  return {
    headerName,
    field,
    width,
    editable: true,
    cellClass: 'mm-wrap-cell',
    cellEditor: 'agLargeTextCellEditor',
    cellEditorPopup: true,
    cellEditorParams: { rows: 8, cols: 48 },
  };
}

async function updateParticipantCell(
  secret: string,
  participant: ParticipantFull,
  field: EditableGuestField,
  value: ParticipantFull[EditableGuestField],
): Promise<ParticipantFull> {
  if (HOST_UPDATE_FIELDS.has(field)) {
    return hostUpdateParticipant(secret, participant.id, {
      [field]: value === '' && field === 'dish_category' ? null : value,
    } as HostUpdateParticipantPayload);
  }

  const payload = { [field]: value } as Partial<ParticipantRecord>;
  const saved = await updateMyRecord(participant.token, payload);
  if (!saved) throw new Error('Could not save participant record.');
  return {
    ...participant,
    [field]: value,
    updated_at: new Date().toISOString(),
  } as ParticipantFull;
}

function normalizeCellValue(field: EditableGuestField, value: unknown): ParticipantFull[EditableGuestField] {
  if (field === 'rsvp') return isRsvp(value) ? value : 'maybe';
  if (field === 'roleplay_comfort') {
    const parsed = typeof value === 'number' ? value : Number(value);
    return COMFORT_VALUES.includes(parsed) ? parsed : null;
  }
  if (field === 'dish_category') {
    const text = String(value ?? '').trim();
    return text || null;
  }
  return String(value ?? '').trim();
}

function isEditableGuestField(field: string | undefined): field is EditableGuestField {
  return Boolean(field && [
    'preferred_name',
    'contact',
    'rsvp',
    'dish_category',
    'dish_detail',
    'dietary',
    'roleplay_comfort',
    'trope_wishlist',
    'surprise_fact',
    'hard_limits',
    'public_bio',
    'notes',
    'host_notes',
  ].includes(field));
}

function displayName(p: ParticipantFull): string {
  return p.preferred_name?.trim() || p.contact?.trim() || 'unnamed';
}

function humanRsvp(rsvp: Rsvp): string {
  return rsvp === 'yes' ? 'Yes' : rsvp === 'no' ? 'No' : 'Maybe';
}

function isRsvp(value: unknown): value is Rsvp {
  return value === 'yes' || value === 'maybe' || value === 'no';
}

function inviteLink(p: ParticipantFull): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}?p=${p.token}`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

function formatReviewLabel(label: string): string {
  return label
    .replace(/^Guest /, '')
    .replace(/^New submission/, 'new')
    .replace(/^modified/, 'edited')
    .replace(/^Guest modified/, 'edited');
}

function formatRole(character: CharacterFull, participant: ParticipantFull): string {
  const title = character.title && isGeneratedArchetype(character.title)
    ? characterConcept(participant)
    : character.title;
  return `${character.name || 'Unnamed character'}${title ? ` - ${title}` : ''}${character.released ? '' : ' - unreleased'}`;
}

function formatDishCategory(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return 'TBD';
  const labels = Object.fromEntries(DISH_OPTIONS.map((option) => [option.v, option.label]));
  return raw
    .split(',')
    .map((part) => labels[part.trim()] ?? part.trim())
    .filter(Boolean)
    .join(', ');
}

function sortGuests(a: ParticipantFull, b: ParticipantFull): number {
  const aSubmitted = hasSubmittedIntake(a);
  const bSubmitted = hasSubmittedIntake(b);
  if (aSubmitted !== bSubmitted) return aSubmitted ? -1 : 1;
  return displayName(a).localeCompare(displayName(b), undefined, { sensitivity: 'base' });
}
