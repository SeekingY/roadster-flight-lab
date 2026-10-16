# WebGPU replay lab

This separate entry reuses `car-v2.js`, `test-environment.js`, and `test-sequence.js` without changing the main renderer. It supports the complete 64-second ramp sequence and the 26-second Kickflip sequence, playback/pause, scrubbing, 1×/0.5×/0.25× speed, wide/chase/free cameras, and an exterior view.

Run the existing local HTTP server from this directory and open:

- `http://127.0.0.1:8767/webgpu-probe-roadster.html?mode=full`
- `http://127.0.0.1:8767/webgpu-probe-roadster.html?backend=webgl&mode=full`

The published page loads the locally bundled Three.js r170 module in webgpu.bundle.js. It requires a local server; it is not the self-contained main `roadster.html`. No runtime CDN or installed node_modules is required by the built page. A supported secure context is required for WebGPU; localhost qualifies. The footer shows the actual backend, and automatically uses WebGL 2 when WebGPU is unavailable. `?backend=webgl` explicitly selects the WebGL backend of WebGPURenderer.

Cold-gas plumes use instanced, camera-facing textured quads with standard `MeshBasicMaterial`. They contain no GLSL `ShaderMaterial` and render through both backends. These are simplified visual effects, not a fluid solver. The same observation-based replay and dimensional limitations as the main demo apply.

Verification: `node webgpu-probe-qa.mjs` uses the installed Chrome browser, checks 30 replay poses across the WebGPU and WebGL backends, exercises scrub/speed/playback/pause, and simulates a missing `navigator.gpu` to verify automatic fallback. Results and desktop/mobile screenshots are in `out/webgpu-probe.json` and `out/webgpu-probe-*.png`. The `?manual=1` option suppresses the automatic animation loop for deterministic, low-load screenshots; `window.__webgpuProbe` exposes `setMode`, `seek`, `advance`, and `render` for this purpose.

Primary references: [Three.js WebGPURenderer migration guide](https://threejs.org/manual/pages/webgpurenderer), [Chrome WebGPU overview](https://developer.chrome.com/docs/web-platform/webgpu/overview), [MDN WebGPU API](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API).
