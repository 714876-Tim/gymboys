'use strict';
/* ============ 3D effects ============
   1. A liquid-chrome blob rendered in WebGL with three.js, behind the glass blocks.
      - Chrome look: a "matcap" texture (a painted picture of a chrome ball) that
        three.js maps onto the shape based on which way each point faces.
      - Liquid motion: every frame the sphere's points are pushed in and out with
        overlapping sine waves, then the lighting (normals) is recalculated.
   2. Glass blocks that tilt in 3D toward the mouse (desktop), with a glare that follows it.
   Everything has a fallback: no WebGL or no internet -> the soft CSS blobs stay. */

(function () {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 1. Liquid chrome blob ---------- */
  function startBlob() {
    const canvas = document.getElementById('bg3d');
    if (!canvas || typeof THREE === 'undefined') return;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
    } catch (e) { return; } // no WebGL -> keep CSS fallback

    const isPhone = matchMedia('(max-width: 700px)').matches;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, isPhone ? 1.5 : 2));
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0, 0, 10);

    // Paint a chrome-ball "matcap": bright sky on top, dark horizon band, warm ember glow at the bottom.
    function chromeMatcap() {
      const s = 512, c = document.createElement('canvas');
      c.width = c.height = s;
      const g = c.getContext('2d');
      g.fillStyle = '#000'; g.fillRect(0, 0, s, s);
      g.save();
      g.beginPath(); g.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2); g.clip();
      const v = g.createLinearGradient(0, 0, 0, s);
      v.addColorStop(0.00, '#ffffff');
      v.addColorStop(0.18, '#e9ecef');
      v.addColorStop(0.38, '#9aa1a8');
      v.addColorStop(0.47, '#2a2d31');
      v.addColorStop(0.53, '#0c0d0f');
      v.addColorStop(0.62, '#5d636a');
      v.addColorStop(0.78, '#c9ced4');
      v.addColorStop(0.90, '#ffb46e');
      v.addColorStop(1.00, '#ff7a26');
      g.fillStyle = v; g.fillRect(0, 0, s, s);
      // specular highlight top-left
      const h = g.createRadialGradient(s * .32, s * .26, 0, s * .32, s * .26, s * .22);
      h.addColorStop(0, 'rgba(255,255,255,1)'); h.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = h; g.fillRect(0, 0, s, s);
      // darker rim so the edges read as a rounded 3D surface
      const r = g.createRadialGradient(s / 2, s / 2, s * .3, s / 2, s / 2, s / 2);
      r.addColorStop(0, 'rgba(0,0,0,0)'); r.addColorStop(1, 'rgba(0,0,0,.55)');
      g.fillStyle = r; g.fillRect(0, 0, s, s);
      g.restore();
      const tex = new THREE.CanvasTexture(c);
      tex.encoding = THREE.sRGBEncoding;
      return tex;
    }
    const chrome = new THREE.MeshMatcapMaterial({ matcap: chromeMatcap() });

    // Main liquid blob
    const segs = isPhone ? [96, 72] : [144, 108];
    const geo = new THREE.SphereGeometry(1, segs[0], segs[1]);
    const pos = geo.attributes.position;
    const base = Float32Array.from(pos.array); // original sphere points
    const blob = new THREE.Mesh(geo, chrome);
    scene.add(blob);

    // Thin copper orbit ring (from the "world you choose" design)
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.55, 0.007, 8, 160),
      new THREE.MeshBasicMaterial({ color: 0xc07a45, transparent: true, opacity: .8 })
    );
    ring.rotation.set(1.25, 0.15, 0.2);
    scene.add(ring);

    // Small chrome sphere floating elsewhere
    const moon = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 36), chrome);
    scene.add(moon);

    function deform(t) {
      const a = pos.array;
      for (let i = 0; i < a.length; i += 3) {
        const x = base[i], y = base[i + 1], z = base[i + 2];
        const n =
          Math.sin(x * 2.1 + t * 0.9) * Math.sin(y * 2.6 + t * 1.15) * 0.16 +
          Math.sin(z * 3.3 - t * 0.7 + x * 1.2) * 0.08 +
          Math.sin((x + y + z) * 4.2 + t * 1.6) * 0.035;
        const k = 1 + n;
        a[i] = x * k; a[i + 1] = y * k; a[i + 2] = z * k;
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
    }

    // Layout: place the objects relative to the visible area so phones and desktops both look right.
    let view = { w: 1, h: 1 };
    function layout() {
      const w = innerWidth, h = innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      const vh = 2 * Math.tan((camera.fov * Math.PI) / 360) * camera.position.z;
      view = { w: vh * camera.aspect, h: vh };
      const size = Math.min(view.w, view.h) * (isPhone ? 0.34 : 0.26);
      blob.scale.setScalar(size); ring.scale.setScalar(size);
      blob.userData.home = new THREE.Vector3(view.w * (isPhone ? 0.30 : 0.30), view.h * 0.24, 0);
      moon.scale.setScalar(size * 0.16);
      moon.userData.home = new THREE.Vector3(-view.w * 0.36, -view.h * 0.22, 1);
    }
    layout();
    addEventListener('resize', layout);

    // Interaction: pointer (desktop), phone tilt (Android) and scrolling move the 3D scene.
    const target = { x: 0, y: 0 }, cur = { x: 0, y: 0 };
    addEventListener('pointermove', (e) => { target.x = e.clientX / innerWidth - 0.5; target.y = e.clientY / innerHeight - 0.5; }, { passive: true });
    addEventListener('deviceorientation', (e) => {
      if (e.gamma == null) return;
      target.x = Math.max(-0.5, Math.min(0.5, e.gamma / 60));
      target.y = Math.max(-0.5, Math.min(0.5, (e.beta - 45) / 60));
    }, { passive: true });

    let t = 0, last = performance.now(), running = true;
    function frame(now) {
      if (!running) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      t += dt;
      cur.x += (target.x - cur.x) * 0.05; cur.y += (target.y - cur.y) * 0.05;
      const scroll = scrollY / Math.max(1, innerHeight);

      deform(t);
      const hb = blob.userData.home;
      blob.position.set(hb.x + cur.x * 0.4, hb.y - cur.y * 0.3 + scroll * view.h * 0.12, 0);
      blob.rotation.set(t * 0.12 + cur.y * 0.6, t * 0.18 + cur.x * 0.8 + scroll * 0.8, 0);
      ring.position.copy(blob.position);
      ring.rotation.z = 0.2 + t * 0.15;

      const hm = moon.userData.home;
      moon.position.set(hm.x - cur.x * 0.6, hm.y + Math.sin(t * 0.8) * 0.15 + scroll * view.h * 0.2, hm.z);
      moon.rotation.y = t * 0.3;

      renderer.render(scene, camera);
      if (!reduceMotion) requestAnimationFrame(frame);
    }
    document.addEventListener('visibilitychange', () => {
      running = !document.hidden;
      if (running && !reduceMotion) { last = performance.now(); requestAnimationFrame(frame); }
    });

    requestAnimationFrame(frame);
    document.documentElement.classList.add('has-3d');
  }

  /* ---------- 2. Glass blocks tilt toward the pointer (mouse only) ---------- */
  function startTilt() {
    if (reduceMotion || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    let active = null;
    const reset = (el) => { el.style.transform = ''; el.style.removeProperty('--gx'); el.style.removeProperty('--gy'); };
    document.addEventListener('pointermove', (e) => {
      const card = e.target.closest('.card');
      if (active && active !== card) { reset(active); active = null; }
      if (!card) return;
      active = card;
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      const max = r.height > 500 ? 1.5 : 4; // big blocks tilt less
      card.style.transform = `perspective(1000px) rotateX(${(0.5 - y) * max}deg) rotateY(${(x - 0.5) * max}deg) translateZ(4px)`;
      card.style.setProperty('--gx', `${x * 100}%`);
      card.style.setProperty('--gy', `${y * 100}%`);
    }, { passive: true });
    document.addEventListener('pointerleave', () => { if (active) reset(active); active = null; });
  }

  startBlob();
  startTilt();
})();
