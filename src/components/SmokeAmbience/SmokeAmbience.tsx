import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import s from './SmokeAmbience.module.css';

/**
 * WebGL smoke ambience — adapted from Marco Biedermann's smoke-particles
 * (via the harry-potter-smoggy-intro reference). A single cloud sprite is
 * cloned into many slowly-rotating planes; additive overlap reads as
 * volumetric mist. Tuned here for noir: pure-white sprites on a transparent
 * canvas, weighted to the lower half of the viewport so it feels like fog
 * rising from below the page.
 */
const PARTICLE_COUNT = 90;
const TEXTURE_URL =
  'https://raw.githubusercontent.com/marcobiedermann/playground/master/three.js/smoke-particles/dist/assets/images/clouds.png';

export default function SmokeAmbience() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const container = containerRef.current;
    if (!container) return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(75, width / height, 1, 10000);
    camera.position.z = 1000;
    scene.add(camera);

    const light = new THREE.DirectionalLight(0xffffff, 0.85);
    light.position.set(-1, 0, 1);
    scene.add(light);

    const particles: THREE.Mesh[] = [];
    let disposed = false;
    let rafId = 0;
    const clock = new THREE.Clock();

    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    loader.load(TEXTURE_URL, (texture) => {
      if (disposed) {
        texture.dispose();
        return;
      }
      texture.minFilter = THREE.LinearFilter;
      const material = new THREE.MeshLambertMaterial({
        color: 0xffffff,
        map: texture,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      });
      const geometry = new THREE.PlaneGeometry(360, 360);

      // World-space viewport math: half-height at the particle plane = tan(fov/2) * |z - camZ|.
      // Cluster occupies roughly the bottom third of the viewport.
      const halfH = Math.tan((75 * Math.PI) / 180 / 2) * 1000;
      const halfW = halfH * (width / height);

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(
          (Math.random() - 0.5) * halfW * 2.4, // a little wider than viewport so edges feather
          -halfH * (0.33 + Math.random() * 0.7), // bottom ~third, with drift below the fold
          Math.random() * 800 - 100,
        );
        mesh.rotation.z = Math.random() * Math.PI * 2;
        scene.add(mesh);
        particles.push(mesh);
      }
    });

    const animate = () => {
      if (disposed) return;
      const delta = clock.getDelta();
      for (let i = 0; i < particles.length; i++) {
        particles[i].rotation.z += delta * 0.18;
      }
      renderer.render(scene, camera);
      rafId = requestAnimationFrame(animate);
    };
    animate();

    const onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      for (const p of particles) {
        scene.remove(p);
        const mat = p.material as THREE.Material & { map?: THREE.Texture };
        if (mat.map) mat.map.dispose();
        mat.dispose();
        (p.geometry as THREE.BufferGeometry).dispose();
      }
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={containerRef} className={s.layer} aria-hidden="true" />;
}
