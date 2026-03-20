# SiftGuard-Tactical-AI-Defence

# SiftGuard: Psychoacoustic Airspace Defense

**Built for HackIndia 2026 — Open Innovation Track**

##  The Problem We're Solving
We've got a massive drone problem. Cheap commercial drones are everywhere, creating a nightmare for security at airports, military bases, and crowded public events. But the actual bottleneck isn't the radar hardware catching them—it's the human sitting in front of the screen.

* **Who it affects:** Tactical radar operators and security personnel working under extreme pressure.
* **The Pain Point:** Right now, operators have to stare at a cluttered screen, manually trying to figure out if a blip is a flock of birds, a kid's toy, or an actual payload threat. It's overwhelming and delays response times when every second matters.
* **Why current tech fails:** Legacy systems rely on two broken concepts: 
    1) **100% Visual Dependency:** You have to stare at a monitor constantly. 
    2) **Alarm Fatigue:** When a system does find a threat, it triggers a loud, generic siren. Because a minor perimeter breach sounds exactly the same as a critical swarm attack, operators get "alarm fatigue." They end up panicked and stressed instead of focused and analytical.

## What is SiftGuard?
Instead of making the operator stare harder at a screen, we shifted the heavy lifting to their ears. We call it **Psychoacoustic Threat Triage**. 

SiftGuard is a lightweight, high-performance tactical dashboard. Instead of relying solely on visual dots, it uses mathematically synthesized audio to instantly tell the operator what's happening. A soft sonar ping means passive monitoring. A fast, high-pitch lock-on means a threat is close. A chaotic, accelerating strobe means a swarm breach. You know the exact threat level before you even look at the monitor.

##  How We Built It (Architecture)
We wanted this to be brutally fast and lightweight. No heavy desktop apps, no massive `.mp3` files.
* **Frontend:** Vanilla JavaScript and HTML5 Canvas. We needed raw performance for drawing radar sweeps and tracking hundreds of targets in real-time without framework bloat.
* **Audio Engine:** The native Web Audio API (`OscillatorNode`, `GainNode`, etc.). All of those military-grade sirens are being generated mathematically in your browser in real-time.
* **UI/UX:** A "Dark Mode" tactical interface designed to minimize eye strain in dark Command and Control (C2) environments.

##  Real-World Feasibility
Because SiftGuard runs entirely in the browser, it can be deployed instantly to any standard laptop or tablet at a forward operating base or a local police command center. Zero installation required. 

**Next Steps:** Our immediate next milestone is to hook the dashboard up via WebSockets to ingest live telemetry data from actual physical SDR (Software Defined Radio) drone scanners.

##  How to Run It
No complex server setup needed. Just open it and go.

1. Clone this repo: `git clone https://github.com/HarshitPuri-27/siftguard.git`
2. Open the project folder.
3. Open `index.html` in Chrome, Edge, or Safari.
4. **CRITICAL STEP:** Browsers block audio by default. You *must* click anywhere on the dark dashboard background first to wake up the audio engine. 
5. Click **"Initialize Swarm"** to see (and hear) the simulation.

## The Team
* **Harshit Puri** - Backend Controller
* **Ashwini Singh** - Front & Documentation Controller
* **Priyanshi Sharma** - Front & Documentation Controller 
