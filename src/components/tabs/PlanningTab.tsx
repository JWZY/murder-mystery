import { useState } from 'react';
import CharacterGraph from '../Graph/CharacterGraph';
import Inspector from '../Inspector/Inspector';
import StoryPanel from './StoryPanel';
import styles from './PlanningTab.module.css';

export default function PlanningTab() {
  const [storyOpen, setStoryOpen] = useState(false);

  return (
    <>
      <CharacterGraph />
      <Inspector />
      <StoryPanel open={storyOpen} onClose={() => setStoryOpen(false)} />
      {!storyOpen && (
        <button className={styles.storyToggle} data-ui onClick={() => setStoryOpen(true)}>
          📖 Story
        </button>
      )}
    </>
  );
}
