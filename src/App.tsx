import { useCanvasStore } from './store/canvasStore';
import { useTheme } from './hooks/useTheme';
import TabBar from './components/TabBar/TabBar';
import ThemePicker from './components/ThemePicker/ThemePicker';
import IntakeTab from './components/tabs/IntakeTab';
import GuestTab from './components/tabs/GuestTab';
import PlanningTab from './components/tabs/PlanningTab';
import ResponsesTab from './host/ResponsesTab';
import CastingTab from './host/CastingTab';
import SettingsTab from './host/SettingsTab';
import { HostGate } from './host/hostContext';
import ParticipantApp from './participant/ParticipantApp';

/**
 * Routing:
 *   #host  → the host planning workspace (responses, casting, story, settings)
 *   else   → the participant experience (intake form / personal home)
 *
 * Kept deliberately simple — a static-site hash check, no router dependency.
 */
export default function App() {
  const isHost = window.location.hash.startsWith('#host');
  return isHost ? <HostApp /> : <ParticipantApp />;
}

// Tabs backed by live Supabase data sit behind the host passcode gate; the
// legacy localStorage canvas tabs (brainstorming scratchpads) do not.
const LIVE_TABS = new Set(['responses', 'casting', 'settings']);

function HostApp() {
  useTheme();
  const activeTab = useCanvasStore((s) => s.activeTab);
  return (
    <>
      <TabBar />
      {LIVE_TABS.has(activeTab) ? (
        <HostGate>
          {activeTab === 'responses' && <ResponsesTab />}
          {activeTab === 'casting' && <CastingTab />}
          {activeTab === 'settings' && <SettingsTab />}
        </HostGate>
      ) : (
        <>
          {activeTab === 'planning' && <PlanningTab />}
          {activeTab === 'guests' && <GuestTab />}
          {activeTab === 'intake' && <IntakeTab />}
        </>
      )}
      <ThemePicker />
    </>
  );
}
