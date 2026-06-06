import { useEffect, useState } from 'react';
import { Users, Drama, Network, Settings as SettingsIcon } from 'lucide-react';
import { useCanvasStore } from './store/canvasStore';
import { useTheme } from './hooks/useTheme';
import TabBar from './components/TabBar/TabBar';
import GuestTab from './components/tabs/GuestTab';
import PlanningTab from './components/tabs/PlanningTab';
import CastingTab from './host/CastingTab';
import SettingsTab from './host/SettingsTab';
import { HostGate } from './host/hostContext';
import ParticipantApp from './participant/ParticipantApp';
import SmokeAmbience from './components/SmokeAmbience/SmokeAmbience';
import AmbientAudio from './components/AmbientAudio/AmbientAudio';
import type { TabId } from './types/canvas';

/**
 * Routing:
 *   #host  → the host planning workspace (responses, casting, story, settings)
 *   else   → the participant experience (intake form / personal home)
 *
 * Kept deliberately simple — a static-site hash check, no router dependency.
 */
type Route = 'host' | 'participant';

function routeFromHash(): Route {
  return window.location.hash.startsWith('#host') ? 'host' : 'participant';
}

export default function App() {
  useTheme();
  const [route, setRoute] = useState<Route>(routeFromHash);
  useEffect(() => {
    const onHashChange = () => setRoute(routeFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  return (
    <>
      <SmokeAmbience />
      <AmbientAudio />
      {route === 'host' && <HostApp />}
      {route === 'participant' && <ParticipantApp />}
    </>
  );
}

function HostApp() {
  return (
    <HostGate>
      <HostShell />
    </HostGate>
  );
}

const HOST_TABS = [
  { id: 'guests' as const, label: 'Guests', Icon: Users },
  { id: 'casting' as const, label: 'Casting', Icon: Drama },
  { id: 'planning' as const, label: 'Canvas', Icon: Network },
  { id: 'settings' as const, label: 'Settings', Icon: SettingsIcon },
];

function HostShell() {
  const activeTab = useCanvasStore((s) => s.activeTab);
  const setActiveTab = useCanvasStore((s) => s.setActiveTab);
  return (
    <>
      <TabBar<TabId> tabs={HOST_TABS} activeId={activeTab} onChange={setActiveTab} />
      {activeTab === 'casting' && <CastingTab />}
      {activeTab === 'settings' && <SettingsTab />}
      {activeTab === 'planning' && <PlanningTab />}
      {activeTab === 'guests' && <GuestTab />}
    </>
  );
}
