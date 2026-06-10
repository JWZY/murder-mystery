export const PARTICIPANT_TOKEN_KEY = 'mm.participant.token';
export const INTAKE_DRAFT_KEY = 'mm.intake.draft';

export function getStoredParticipantToken(): string | null {
  return localStorage.getItem(PARTICIPANT_TOKEN_KEY);
}

export function saveParticipantToken(token: string): void {
  localStorage.setItem(PARTICIPANT_TOKEN_KEY, token);
}

export function clearParticipantSession(): void {
  localStorage.removeItem(PARTICIPANT_TOKEN_KEY);
}

export function clearIntakeDraft(): void {
  localStorage.removeItem(INTAKE_DRAFT_KEY);
}

export function clearParticipantSessionAndDraft(): void {
  clearParticipantSession();
  clearIntakeDraft();
}

export function removeParticipantTokenFromUrl(mode: 'push' | 'replace' = 'replace'): void {
  const url = new URL(window.location.href);
  url.searchParams.delete('p');
  url.searchParams.delete('submitted');

  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  if (mode === 'push') {
    window.history.pushState({}, '', nextUrl);
  } else {
    window.history.replaceState({}, '', nextUrl);
  }
}
