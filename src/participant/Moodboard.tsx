import styles from './Moodboard.module.css';

export type MoodboardImage = {
  src: string;
  alt: string;
  width: number;
  height: number;
};

export const NOIR_MOODBOARD_IMAGES: MoodboardImage[] = [
  { src: '/moodboard/noir-mood-07.jpg', alt: 'No Way Out film still', width: 1500, height: 900 },
  { src: '/moodboard/noir-mood-08.jpg', alt: 'Film noir still', width: 1280, height: 720 },
  { src: '/moodboard/noir-mood-06.jpg', alt: 'Classic noir poster portrait', width: 450, height: 681 },
  { src: '/moodboard/noir-mood-02.png', alt: 'Noir detective scene with dramatic lighting', width: 3840, height: 2160 },
  { src: '/moodboard/noir-mood-03.jpg', alt: 'Shadowed corridor with period costumes', width: 2373, height: 1350 },
  { src: '/moodboard/noir-mood-04.jpg', alt: 'Vintage stage scene with formal attire', width: 4000, height: 2792 },
  { src: '/moodboard/noir-mood-05.jpg', alt: 'Classic film noir close conversation', width: 450, height: 301 },
  { src: '/moodboard/noir-mood-16.jpeg', alt: 'Moonlit rooftop figure in a red coat', width: 480, height: 360 },
  { src: '/moodboard/noir-mood-09.jpg', alt: 'The Maltese Falcon still', width: 1280, height: 938 },
  { src: '/moodboard/noir-mood-01.jpg', alt: 'Noir interior with silhouetted figures', width: 1920, height: 1080 },
  { src: '/moodboard/noir-mood-12.jpg', alt: 'Gene Tierney in Laura', width: 960, height: 720 },
  { src: '/moodboard/noir-mood-13.jpg', alt: 'Dana Andrews and Gene Tierney in Laura', width: 592, height: 478 },
  { src: '/moodboard/noir-mood-14.jpg', alt: 'The Street with No Name still', width: 949, height: 717 },
  { src: '/moodboard/noir-mood-15.jpg', alt: 'The Man Who Cheated Himself still', width: 627, height: 423 },
];

type Props = {
  variant?: 'backdrop' | 'gallery';
  className?: string;
};

export default function Moodboard({ variant = 'backdrop', className = '' }: Props) {
  if (variant === 'gallery') {
    return (
      <div className={`${styles.gallery} ${className}`} aria-label="Event moodboard">
        {NOIR_MOODBOARD_IMAGES.map((image, index) => (
          <figure key={image.src} className={styles.galleryTile}>
            <img
              src={image.src}
              alt={image.alt}
              width={image.width}
              height={image.height}
              loading={index < 4 ? 'eager' : 'lazy'}
            />
          </figure>
        ))}
      </div>
    );
  }

  const columnCount = 4;
  const tilesPerColumn = 7;

  return (
    <div className={`${styles.backdrop} ${className}`}>
      <div className={styles.masonry} aria-hidden="true">
        {Array.from({ length: columnCount }, (_, col) => (
          <div key={col} className={`${styles.masonryColumn} ${styles[`masonryColumn${col + 1}`]}`}>
            {Array.from({ length: tilesPerColumn }, (_, i) => {
              const image = NOIR_MOODBOARD_IMAGES[(col * 2 + i * 3) % NOIR_MOODBOARD_IMAGES.length];
              return (
                <div key={`${image.src}-${col}-${i}`} className={styles.masonryTile}>
                  <img
                    src={image.src}
                    alt=""
                    width={image.width}
                    height={image.height}
                    loading={col < 3 && i < 2 ? 'eager' : 'lazy'}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className={styles.veil} aria-hidden="true" />
    </div>
  );
}
