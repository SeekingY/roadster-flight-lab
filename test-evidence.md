# Roadster reveal — test evidence and reconstruction limits

Research scope: Tesla's Roadster reveal held on **October 15, 2026 (US Eastern date)**. This file records source-text findings. It does **not** claim that the research subagent visually watched the complete maneuver; the root agent is performing the frame-by-frame visual review separately.

## Primary sources located

1. **Tesla — Roadster Event (official full replay)**: https://www.youtube.com/watch?v=qt5p-_tE8d0
   - Browser UI identified the embedded publisher as Tesla, channel `UC5WjFrtBdufl6CZojX3D8dQ`.
   - The direct YouTube player reported a **30:35** runtime. The browser could open the player at `t=612s`; connection interruption prevented the subagent from inspecting the actual video pixels.
   - Exa successfully extracted the **full official video's transcript**, including the engineering statements below. This is direct text from the official video, with automatic-caption limitations.
   - Useful starting point for visual review: https://www.youtube.com/watch?v=qt5p-_tE8d0&t=612s
2. **Tesla — original X broadcast**: https://x.com/i/broadcasts/1yKAPwNggRaxb
3. **Tesla — “Real life, baby” demonstration clip**: https://x.com/Tesla/status/2110913438293647789
   - The official URL was obtained from the visible linked post embedded in the Electron Motion article. Direct X reading was blocked with HTTP 403; the clip's exact duration, cuts, and actions were not verified by this subagent.
4. **Tesla — COPV and new thruster hardware/control post**: https://x.com/Tesla/status/2110904290743402880
5. **Tesla — Track Mode / Optimus actuator post**: https://x.com/Tesla/status/2110905133785829671
6. **Tesla — configuration/reservation post**: https://x.com/Tesla/status/2110905588402295283
7. **Tesla — current product page**: https://www.tesla.com/roadster
   - The root agent previously read the full dynamic page. Its footnote says the page's features/specifications reflect the **Thrust augment**. Do not treat every displayed studio image or two-seat interior as a verified Rocket interior.

## Approximate event timeline

The sequence of spoken material below was cross-checked against the transcript extracted directly from Tesla's YouTube video. **The timestamps come from an edited third-party transcript, and are approximate:**

- Timestamp guide: https://electronmotion.com/wp-content/uploads/2026/10/tesla-roadster-reveal-transcript.txt
- Context/official embeds: https://electronmotion.com/2026/10/15/tesla-roadster-reveal/

| Replay time | Spoken or textual evidence | Reconstruction implication |
|---|---|---|
| 05:07–05:39 | Welcome at SpaceX's McGregor test/development center; presenters mention the pre-show Raptor static fire and the 4,000-acre site. | Nighttime rocket-test-site setting; do not invent a public-road setting. |
| 07:00–09:48 | Live audience introduction, Tesla/SpaceX collaboration, demonstration caveats. At about 09:16 Musk says the vehicle is autonomous for this demonstration. | The demo is not evidence of a human pilot manually operating the stunt. |
| 09:48–10:12 | Countdown and transition to the first demonstration. | Check the exact visual start within this interval. |
| **10:12–12:18** | Music/cheering span in the captions; at the end Musk says the demonstration worked and that flying cars are real. | This is the **first ramp/flight demonstration review window**. Captions alone do not reveal its internal movements or camera cuts. |
| 12:47–13:53 | Presenters describe a bottom fan-suction system that can pull up to 2 G and let the car stick upside down, plus SpaceX technology for the rest. | Keep suction adhesion separate from free-flight propulsion. |
| 13:53–14:32 | Starman appears; Musk explicitly identifies it as not a real human. | A visible occupant in this part of the demonstration should not be presented as a real stunt driver. |
| 14:32–15:12 | Musk describes attitude-control thrusters and main thrusters at the rear, and says the car can perform rolls. | Supports distinct attitude-control and forward-thrust systems, but not a precise nozzle map. |
| **15:32–16:04** | Second music/cheering demonstration span, followed by the presenters naming it the “kickflip” and mentioning clearing the fleet. | A **separate second demonstration**, not automatically part of the ramp stunt. Review its exact movement visually before recreating it. |
| **16:40–16:58** | Lars Moravy states two pressure vessels, a combined 600 L, about 250 kg of air, and 10 nozzles. | These are spoken claims about the demonstrated flying setup. They are not independently measured values or a universal specification for every trim. |
| 16:58–17:21 | Musk says the air tank is rechargeable and does not require special propellant. | Compressed-air system; do not depict an assumed chemical-fuel rocket engine. |
| 17:25–18:22 | Design inspiration and the stage vehicle arrival. SR-71 and transforming cars are explicitly mentioned. | New angular design; avoid substituting the 2017 red prototype. |
| 18:31–19:00 | Stage car is described as a two-seater, with seats molded into the chassis, steer-by-wire yoke, brake and throttle. | This stage car is not proof that the flying Rocket trim has two seats. |
| 19:00–20:34 | Rear diffuser area contains thrusters and fans; high-downforce/low-drag modes; suction system changes airflow openings; variable-pitch rear wing. | Model functional transformations only where visually documented. |
| 20:40–21:22 | Recorded acceleration test shown. | Distinguish this prerecorded run from the subsequent live run. |
| 21:30–22:11 | Request to perform a live run faster than one second; the limited pad length is mentioned afterward. | Separate live acceleration sequence. |
| **22:31–23:08** | Presenter says four rear thrusters exhaust faster than sound, yielding visible Mach diamonds, and generate **over 80 kN**; the live result is eventually reported as **0.81 s, 0–60 mph**. | Treat >80 kN as the reported rear thruster system total, **not 80 kN per nozzle**. Treat 0.81 s as the reported event result, not certified independently. |
| 23:19–25:23 | Forward-looking performance discussion, Snake River Canyon idea, >230 mph, and aspirational Mach 0.5 discussion. | Aspirations are not observed demo motion. Do not reproduce a canyon jump as an event that already happened. |
| 25:48 | Production expected in 2028. | A manufacturer plan, not proof of production delivery. |
| 26:05–30:35 | Final item introduced, followed by mostly music in the transcript. | **Requires visual review.** Do not invent a final stunt from the sparse captions. |

## Newly supported engineering statements

The current official-video transcript adds facts that were not available during the earlier research pass. The earlier “unknown nozzle count/COPV volume” limitation should therefore be refined, not repeated blindly:

- **10 nozzles**: spoken at about 16:40 about the demonstrated configuration; positions and orientation of every nozzle remain unverified.
- **Two pressure vessels, 600 L combined, roughly 250 kg of stored air**: spoken at the same point. Exact pressure, vessel internal structure, dimensions, pipe routing, mass of vessel hardware, and usable flight duration remain unverified.
- **Four rear thrusters, greater than 80 kN reported thrust**: discussed at about 22:31. There is no basis to assign this force to each of the ten individual nozzles.
- **0.81 s to 60 mph**: stated after the live acceleration run. Differentiate an event announcement from independent timing certification and from future production targets.
- **Fan suction up to 2 G**, and **cornering greater than 2 G**: distinct spoken claims. Do not combine them into an invented lift-thrust specification.

## Visual reconstruction questions still open in this subagent's work

These require actual video frames and timing, not article narration:

1. Does the first demonstration contain an initial climb to an upside-down stop, a retreat to the starting point, and then a second ascent? Road & Track describes that sequence, but it is **secondary evidence only** until the root agent verifies the video.
2. Exact inverted dwell duration, pause onset, release moment, and whether the vehicle reverses or drives forward along each portion.
3. Ramp profile, crest curvature, exposed end, supporting steel structure, lane width, ground run-up, and direction of travel.
4. Roll versus pitch rotation, number of rotations, rotation direction, maximum height, and lateral displacement.
5. Which downward or lateral nozzles fire at each moment; how many are actually visible in each view.
6. Camera-cut boundaries: rear-following, side, overhead, and wide aerial are mentioned in the secondary article, but must be mapped to actual replay frames.
7. Landing attitude, wheel contact order, suspension compression, ground plume/dust behavior, and drive-away path.

## Source traps and exclusions

- The YouTube ID `9H5y9Uag8AA` linked by an early discussion opens as **Tesla Q2 2026 Financial Results and Q&A Webcast**; do not use it as the reveal.
- Search snippets may still show the old 2017 **four seats / 620-mile range / red rounded body / 1.9 s** product page. These are not evidence for the new reveal vehicle.
- Dimensions such as **3946 mm length and 2352 mm wheelbase** belong to the original Roadster, not this vehicle.
- An article describing blue jets is not enough to prove a combustion mechanism. Reproduce observed color/lighting when visually verified, while identifying the official system as compressed-air/cold-gas propulsion.
- Do not claim a fully accurate internal cutaway: public imagery and spoken data do not expose the full internal engineering layout.
