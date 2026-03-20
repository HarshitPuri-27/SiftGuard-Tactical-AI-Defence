const canvas = document.getElementById("radar");
const ctx = canvas.getContext("2d");

    
// --- TACTICAL AUDIO ENGINE (Web Audio API) ---
const sfx = {
    ctx: null,
    activeOscillators: [], 

    init: function() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx.state === 'suspended') this.ctx.resume();
    },

    stopAll: function() {
        if (!this.ctx) return;
        this.activeOscillators.forEach(osc => {
            try { osc.stop(); } catch(e) {} 
        });
        this.activeOscillators = []; 
    },
    
    // EXACT "YOUTUBE DANGER EFFECT" SIREN (7 Seconds)
    playDetection: function() {
        if (!this.ctx) return;
        this.stopAll(); 
        let now = this.ctx.currentTime;

        const masterGain = this.ctx.createGain();
        masterGain.connect(this.ctx.destination);

        // This sound relies on heavily raspy, overlapping waveforms to sound like a physical horn
        const osc1 = this.ctx.createOscillator(); osc1.type = 'sawtooth';
        const osc2 = this.ctx.createOscillator(); osc2.type = 'square';
        const osc3 = this.ctx.createOscillator(); osc3.type = 'sawtooth'; // Sub-bass grit

        osc1.connect(masterGain);
        osc2.connect(masterGain);
        osc3.connect(masterGain);

        this.activeOscillators.push(osc1, osc2, osc3);

        masterGain.gain.setValueAtTime(0, now);

        // The iconic movie "Facility Danger" siren pattern
        for (let i = 0; i < 7; i++) {
            let start = now + (i * 1.1); // One heavy blast every 1.1 seconds
            
            // THE HARSH PITCH SLIDE
            // Starts low (300Hz) and slides up to a screaming 1050Hz in 0.25 seconds
            osc1.frequency.setValueAtTime(300, start);
            osc1.frequency.exponentialRampToValueAtTime(1050, start + 0.25); 
            
            // Slightly out of tune to make it sound mechanical and abrasive
            osc2.frequency.setValueAtTime(305, start);
            osc2.frequency.exponentialRampToValueAtTime(1060, start + 0.25);
            
            // Sub-octave grit (Exactly one octave lower to give it weight)
            osc3.frequency.setValueAtTime(150, start);
            osc3.frequency.exponentialRampToValueAtTime(525, start + 0.25);

            // VOLUME ENVELOPE: Fast attack, hold the scream, fast drop
            masterGain.gain.setValueAtTime(0, start);
            masterGain.gain.linearRampToValueAtTime(0.25, start + 0.05); // Snap to max volume
            masterGain.gain.setValueAtTime(0.25, start + 0.75);          // Hold the scream for 0.75s
            masterGain.gain.linearRampToValueAtTime(0, start + 0.85);    // Fast drop to silence
        }

        osc1.start(now); osc2.start(now); osc3.start(now);
        osc1.stop(now + 8.5); osc2.stop(now + 8.5); osc3.stop(now + 8.5);
    },

    // HEAVY KLAXON / BREACH BUZZER (3 Seconds)
    playBreach: function() {
        if (!this.ctx) return;
        this.stopAll(); 
        let now = this.ctx.currentTime;

        const masterGain = this.ctx.createGain();
        masterGain.connect(this.ctx.destination);

        const o1 = this.ctx.createOscillator(); o1.type = 'square'; o1.frequency.value = 110;
        const o2 = this.ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = 114;

        o1.connect(masterGain); o2.connect(masterGain);
        this.activeOscillators.push(o1, o2); 

        masterGain.gain.setValueAtTime(0, now);
        for (let i = 0; i < 8; i++) {
            let start = now + (i * 0.5);
            masterGain.gain.setValueAtTime(0.3, start); 
            masterGain.gain.setTargetAtTime(0.01, start + 0.2, 0.05); 
        }
        masterGain.gain.linearRampToValueAtTime(0, now + 3.0);

        o1.start(now); o2.start(now);
        o1.stop(now + 3.0); o2.stop(now + 3.0);
    }
};

const centerX = canvas.width / 2;
const centerY = canvas.height / 2;

let campaignWon = false; // NEW: Tracks if we should show the victory screen
let sweepAngle = 0; 
let drones = [];
let interceptors = [];
let explosions = [];
let running = false;
let totalNeutralizedScore = 0; // Fixed stats bug
// --- UTILITY FUNCTIONS ---

function log(msg) {
    const box = document.getElementById("log");
    if (box) {
        box.innerHTML += `> ${msg}<br>`;
        box.scrollTop = box.scrollHeight;
    }
}

function updateStats() {
    const activeDrones = drones.filter(d => d.active);
    const decoys = activeDrones.filter(d => d.type === "decoy").length;
    const threats = activeDrones.filter(d => d.type === "threat").length;

    document.getElementById("count").innerText = activeDrones.length;
    document.getElementById("decoys").innerText = decoys;
    document.getElementById("threats").innerText = threats;
    document.getElementById("neutralized").innerText = totalNeutralizedScore;
}
    

// --- DYNAMIC CAMPAIGN TRACKERS ---
let waveCount = 0;
let demoBreachesAllowed = 0; // Starts at 0. AI perfectly defends the base.
let breachWarningFrames = 0; // Timer for the massive HUD overlay
let breachDroneId = "";      // Remembers which drone hit you
let totalSpawns = 0;
let totalThreatsSpawned = 0;
let targetGlobalSpawns = 0;  // NEW: Will hold the random 200-250 target
let targetGlobalThreats = 0; // NEW: Will hold the 15-20% target

function spawnWave() {
    if (!running) return;

    // Check against the dynamically generated global target
    if (totalSpawns >= targetGlobalSpawns) {
        log(`<span style='color:#22c55e; font-weight:bold;'>[CAMPAIGN VICTORY] ${targetGlobalSpawns} objects processed. Airspace secured.</span>`);
        running = false; 
        return;
    }

    waveCount++;
    
    let swarmSize = Math.floor(Math.random() * 41) + 40; 
    
    // Clamp so we never exceed the random total target
    if (totalSpawns + swarmSize > targetGlobalSpawns) {
        swarmSize = targetGlobalSpawns - totalSpawns;
    }

    // Dynamic Threat Math: Ensures we perfectly hit the random threat goal by the end
    let remainingSpawns = targetGlobalSpawns - totalSpawns;
    let remainingThreats = targetGlobalThreats - totalThreatsSpawned;
    
    let waveThreats = Math.round((swarmSize / remainingSpawns) * remainingThreats);
    if (waveThreats > swarmSize) waveThreats = swarmSize; 
    if (waveThreats < 0) waveThreats = 0; 

    totalSpawns += swarmSize;
    totalThreatsSpawned += waveThreats;

    log(`<span style="color:#ef4444">--- WAVE ${waveCount} DETECTED ---</span>`);
    log(`Spawning ${swarmSize} drones (${waveThreats} high-threat). Campaign: ${totalSpawns}/${targetGlobalSpawns}`);

    fetch(`http://127.0.0.1:5000/stream_swarm?count=${swarmSize}&threats=${waveThreats}`)
        .then(res => res.json())
        .then(data => {
            data.targets.forEach(t => {
                let angle = Math.random() * Math.PI * 2;
                let startRadius = 380 + Math.random() * 150; 
                let startX = centerX + Math.cos(angle) * startRadius;
                let startY = centerY + Math.sin(angle) * startRadius;

                let angleToCenter = Math.atan2(centerY - startY, centerX - startX);
                let wobble = t.type === "decoy" ? (Math.random() - 0.5) * 0.6 : 0; 
                angleToCenter += wobble;

                let canvasSpeed = (t.speed / 150) * 0.35 + 0.15; 
                let dx = Math.cos(angleToCenter) * canvasSpeed;
                let dy = Math.sin(angleToCenter) * canvasSpeed;

                drones.push({
                    id: t.id, x: startX, y: startY, dx: dx, dy: dy,
                    trail: [], type: t.type, probability: t.prob, active: true,
                    targeted: false 
                });
            });
            updateStats();
        })
        .catch(err => log("<span style='color:red'>ERROR: Backend Offline.</span>"));
}

function launchInterceptor(target) {
    let dist = Math.hypot(target.x - centerX, target.y - centerY);
    
    // --- REALISTIC MISSILE VELOCITY ---
    // Drastically slowed down so the audience can watch the interception
    let missileSpeed = 1.2; // Standard cruise (1.2 pixels per frame)

    if (dist < 150) missileSpeed = 2.5;  // High speed intercept
    if (dist < 75) missileSpeed = 4.0;   // PANIC OVERDRIVE (Still visible to the eye)

    interceptors.push({
        x: centerX,
        y: centerY,
        target: target,
        speed: missileSpeed 
    });
    
    log("Fox 3 Launched: Intercepting " + target.id);
}

function AIdefense() {
    if (!running) return;

    const activeThreats = drones.filter(d => d.type === "threat" && d.active);
    const untargetedThreats = activeThreats.filter(d => !d.targeted);

    // --- THE FIX: DON'T WAIT FOR SLOW DECOYS ---
    if (activeThreats.length === 0) {
        
        // 1. Is this the very LAST wave of the entire campaign?
        if (totalSpawns >= targetGlobalSpawns) {
            // For the grand finale, wait for every single dot to leave the screen
            const allActiveDrones = drones.filter(d => d.active); 
            if (allActiveDrones.length > 0) {
                setTimeout(AIdefense, 500); 
                return;
            }
            if (!campaignWon) { 
                log("<span style='color:#22c55e; font-weight:bold;'>[CAMPAIGN COMPLETE] All objects cleared. Airspace secured.</span>");
                triggerVictoryFlares();
            }
            return;
        }
        
        // 2. For normal waves: Instantly call the next shift!
        log("<span style='color:#38bdf8'>Lethal threats neutralized. Scanning for next wave...</span>");
        
        // Triggers the next wave of drones in just 2 seconds!
        setTimeout(() => { if (running) spawnWave(); }, 2000);
        setTimeout(AIdefense, 2500); 
        return;
    }

    // --- SECRET DEMO BLIND SPOT ---
    let threatsToEngage = untargetedThreats;
    if (demoBreachesAllowed > 0 && untargetedThreats.length > 0) {
        threatsToEngage = untargetedThreats.sort((a, b) => {
            return Math.hypot(a.x - centerX, a.y - centerY) - Math.hypot(b.x - centerX, b.y - centerY);
        });
        threatsToEngage.shift(); 
    }

    // --- STAGGERED RIPPLE FIRE LOGIC ---
    const engagingThreats = threatsToEngage.filter(t => {
        let dist = Math.hypot(t.x - centerX, t.y - centerY);
        return dist < 280;
    });

    if (engagingThreats.length > 0) {
        log(`System Link: Firing ${engagingThreats.length} interceptors in sequence.`);
        
        engagingThreats.forEach((target, index) => {
            target.targeted = true; 
            setTimeout(() => {
                if (target.active) { 
                    launchInterceptor(target);
                }
            }, index * 300); 
        });
    }

    setTimeout(AIdefense, 500);
}

// --- DRAWING FUNCTIONS (MODERN TACTICAL) ---

function drawRadarGrid() {
    ctx.strokeStyle = "rgba(20, 83, 45, 0.5)";
    ctx.lineWidth = 1;
    
    // Engagement rings
    for (let r = 80; r < 400; r += 80) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
        ctx.stroke();
    }
    
    // Tactical Crosshairs
    ctx.beginPath();
    ctx.moveTo(centerX, 0); ctx.lineTo(centerX, canvas.height);
    ctx.moveTo(0, centerY); ctx.lineTo(canvas.width, centerY);
    ctx.stroke();
    
    // Inner Base Ring
    ctx.beginPath();
    ctx.arc(centerX, centerY, 20, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(56, 189, 248, 0.4)"; // Cyan base ring
    ctx.stroke();
}


function drawSweep() {
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(sweepAngle);
    
    // The fading green trail behind the sweep
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 450, 0, -Math.PI / 4, true); 
    ctx.lineTo(0, 0);
    ctx.fillStyle = "rgba(34, 197, 94, 0.15)";
    ctx.fill();
    
    // The hard leading edge of the radar beam
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(450, 0);
    ctx.strokeStyle = "rgba(74, 222, 128, 0.8)";
    ctx.lineWidth = 2;
    ctx.shadowBlur = 15;
    ctx.shadowColor = "#4ade80"; // Glowing laser effect
    ctx.stroke();
    
    ctx.restore();
    sweepAngle += 0.03; // Speed of the radar rotation
}

function drawDrones() {
    for (let i = drones.length - 1; i >= 0; i--) {
        let d = drones[i];
        
        // --- FIX 1: GHOST DRONE CLEANUP ---
        // If a missile killed this drone, permanently delete it from memory!
        if (!d.active) {
            drones.splice(i, 1);
            continue; 
        }

        d.x += d.dx;
        d.y += d.dy;

        let distToCenter = Math.hypot(d.x - centerX, d.y - centerY);
        let hitBox = d.type === "threat" ? 20 : 40; 
        
        // Inside drawDrones()...
        if (distToCenter < hitBox) {
            d.active = false;
            if (d.type === "threat") {
                if (demoBreachesAllowed > 0) demoBreachesAllowed--; 
                breachWarningFrames = 180; 
                breachDroneId = d.id;      
                
                // --- NEW: SOUND THE BREACH ALARM ---
                sfx.playBreach();
                
                explosions.push({ x: centerX, y: centerY, size: 40, isThreat: true }); 
                log(`<span class="log-critical">[!] CRITICAL BREACH: Payload detonated by ${d.id}!</span>`);
                document.body.classList.add("breach-alert");
                setTimeout(() => { document.body.classList.remove("breach-alert"); }, 3000);
            } else {
                explosions.push({ x: centerX, y: centerY, size: 15, isThreat: false }); 
                log(`<span style="color:#facc15">[WARNING] Kinetic Impact: Decoy ${d.id} crashed on perimeter fence.</span>`);
            }
            drones.splice(i, 1); 
            updateStats();
            continue;
        }

        // ... (Keep the hitBox and distToCenter < hitBox collision logic the same!)

        // --- NEW: OUTER BOUNDARY CRASH LOGIC ---
        // Math to check if the drone is moving AWAY from the center base
        let isMovingAway = ((d.x - centerX) * d.dx + (d.y - centerY) * d.dy) > 0;

        // If it missed the base, is moving away, and crosses the 400px radar boundary...
        if (distToCenter > 400 && isMovingAway) {
            d.active = false;
            
            // Create a cool gray explosion exactly where it hit the edge
            explosions.push({ x: d.x, y: d.y, size: 15, isThreat: false }); 
            
            if (d.type === "decoy") {
                log(`<span style="color:#94a3b8">[INFO] Decoy ${d.id} exhausted fuel at sector edge.</span>`);
            } else {
                // Just in case a threat somehow escapes the missiles!
                log(`<span style="color:#f97316">[WARN] Threat ${d.id} escaped sector perimeter.</span>`);
            }
            
            drones.splice(i, 1);
            updateStats();
            continue;
        }

        // ... (Keep the trail drawing logic below this the same!)

        // Draw Ghost Trail
        d.trail.push({ x: d.x, y: d.y });
        if (d.trail.length > 8) d.trail.shift();
        ctx.beginPath();
        d.trail.forEach(pos => ctx.lineTo(pos.x, pos.y));
        ctx.strokeStyle = "rgba(100, 116, 139, 0.3)";
        ctx.stroke();

        // --- NEW: TACTICAL TARGET LOCK BRACKETS ---
        if (d.targeted) {
            ctx.strokeStyle = "#ef4444";
            ctx.lineWidth = 1;
            ctx.strokeRect(d.x - 6, d.y - 6, 12, 12); // Draws a hard red box around locked targets
        }

        // Draw drone body
        ctx.beginPath();
        if (d.type === "decoy") {
            ctx.fillStyle = "rgba(100, 116, 139, 0.8)";
            ctx.arc(d.x, d.y, 2.5, 0, Math.PI * 2);
        } else {
            ctx.fillStyle = "#ef4444";
            ctx.font = "bold 10px Consolas";
            // Adds a cool data tag to threats
            ctx.fillText(`ID:${d.id.split('-')[1]}`, d.x + 10, d.y - 4); 
            ctx.arc(d.x, d.y, 3.5, 0, Math.PI * 2);
        }
        ctx.fill();
    }
}

function drawInterceptors() {
    for (let i = interceptors.length - 1; i >= 0; i--) {
        let m = interceptors[i];

        if (!m.target.active) {
            interceptors.splice(i, 1);
            continue;
        }

        let oldX = m.x;
        let oldY = m.y;

        // --- FIX 3: CONSTANT THRUST MATH (TRIGONOMETRY) ---
        // Instead of slowing down, the missile calculates the angle and drives straight through the target.
        let angleToTarget = Math.atan2(m.target.y - m.y, m.target.x - m.x);
        m.x += Math.cos(angleToTarget) * m.speed;
        m.y += Math.sin(angleToTarget) * m.speed;

        // Missile Thrust Exhaust
        ctx.beginPath();
        ctx.moveTo(oldX, oldY);
        ctx.lineTo(m.x, m.y);
        ctx.strokeStyle = "#f97316"; 
        ctx.lineWidth = 2;
        ctx.stroke();

        // Missile Warhead
        ctx.beginPath();
        ctx.arc(m.x, m.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = m.speed > 5 ? "#ffffff" : "#38bdf8"; // Turns white if going fast
        ctx.shadowBlur = 10;
        ctx.shadowColor = ctx.fillStyle; 
        ctx.fill();
        ctx.shadowBlur = 0; 

        // If the missile gets within 8 pixels of the drone, it detonates!
        if (Math.hypot(m.x - m.target.x, m.y - m.target.y) < 8) {
            m.target.active = false;
            explosions.push({ x: m.target.x, y: m.target.y, size: 10, isThreat: true });
            interceptors.splice(i, 1);
            totalNeutralizedScore++; 

            log(`<span style="color:#22c55e">IMPACT: Target neutralized.</span>`);
            if (typeof interceptTarget === "function") interceptTarget(m.target.id);
            updateStats();
        }
    }
}

function drawExplosions() {
    for (let i = explosions.length - 1; i >= 0; i--) {
        let e = explosions[i];
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
        
        let maxSize;
        if (e.isVictory) {
            // VICTORY FLARE: Massive expanding green rings
            ctx.strokeStyle = "rgba(34, 197, 94, " + (1 - e.size/100) + ")"; 
            e.size += 2;
            maxSize = 100;
        } else if (e.isThreat || e.isThreat === undefined) {
            // THREAT EXPLOSION: Yellow/Red
            ctx.strokeStyle = "rgba(250, 204, 21, " + (1 - e.size/40) + ")"; 
            e.size += 1.5;
            maxSize = 40;
        } else {
            // DECOY CRASH: Dull Gray
            ctx.strokeStyle = "rgba(148, 163, 184, " + (1 - e.size/20) + ")"; 
            e.size += 0.5; 
            maxSize = 20;
        }
        
        ctx.lineWidth = 3;
        ctx.stroke();
        
        if (e.size > maxSize) explosions.splice(i, 1);
    }
}

function triggerVictoryFlares() {
    campaignWon = true;
    let flareCount = 0;
    
    // Launch a green victory flare every 300ms
    let flareInterval = setInterval(() => {
        explosions.push({
            x: centerX + (Math.random() - 0.5) * 400,
            y: centerY + (Math.random() - 0.5) * 400,
            size: 5,
            isVictory: true // This tells the explosion function to make it green
        });
        flareCount++;
        if(flareCount > 15) clearInterval(flareInterval); // Stop after 15 flares
    }, 300);
}

function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.globalCompositeOperation = "screen"; 
    drawRadarGrid();
    drawSweep(); // Assuming you added the radar sweep!
    drawDrones();
    drawInterceptors();
    drawExplosions();
    ctx.globalCompositeOperation = "source-over"; 

    // --- 1. CINEMATIC VICTORY OVERLAY ---
    if (campaignWon) {
        // Dark tactical wash over the radar
        ctx.fillStyle = "rgba(2, 6, 23, 0.6)"; 
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Cinematic Letterboxing (Black bars at top and bottom)
        ctx.fillStyle = "#020617";
        ctx.fillRect(0, 0, canvas.width, 80);
        ctx.fillRect(0, canvas.height - 80, canvas.width, 80);

        // Heavy Glowing Neon Text
        ctx.fillStyle = "#4ade80"; // Bright green
        ctx.shadowColor = "#22c55e";
        ctx.shadowBlur = 30; // Massive glow effect
        ctx.font = "bold 46px Consolas";
        ctx.textAlign = "center";
        ctx.fillText("MISSION ACCOMPLISHED", centerX, centerY - 15);
        ctx.shadowBlur = 0; // Turn off glow for the subtext
        
        // Subtext
        ctx.fillStyle = "#f8fafc";
        ctx.font = "18px Consolas";
        ctx.fillText(`Airspace Secured. ${totalNeutralizedScore} Lethal Threats Neutralized.`, centerX, centerY + 30);
        ctx.textAlign = "left"; 
    }

    // --- 2. MASSIVE BREACH WARNING OVERLAY ---
    if (breachWarningFrames > 0) {
        // Pulsing Red Siren Effect
        let pulse = Math.abs(Math.sin(breachWarningFrames * 0.1));
        ctx.fillStyle = `rgba(220, 38, 38, ${0.1 + pulse * 0.25})`; 
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw Military Hazard Stripes (Top and Bottom)
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, canvas.width, 40);
        ctx.fillRect(0, canvas.height - 40, canvas.width, 40);
        
        ctx.fillStyle = "#ef4444"; // Red stripes
        for(let i = -50; i < canvas.width; i += 60) {
            // Top stripes
            ctx.beginPath();
            ctx.moveTo(i, 0); ctx.lineTo(i + 30, 0);
            ctx.lineTo(i + 10, 40); ctx.lineTo(i - 20, 40);
            ctx.fill();
            // Bottom stripes
            ctx.beginPath();
            ctx.moveTo(i, canvas.height - 40); ctx.lineTo(i + 30, canvas.height - 40);
            ctx.lineTo(i + 10, canvas.height); ctx.lineTo(i - 20, canvas.height);
            ctx.fill();
        }

        // Giant Red Text with Shadow
        ctx.fillStyle = "#ef4444";
        ctx.shadowColor = "#b91c1c";
        ctx.shadowBlur = 20;
        ctx.font = "bold 48px Consolas";
        ctx.textAlign = "center";
        ctx.fillText("CRITICAL BREACH DETECTED", centerX, centerY - 50);
        ctx.shadowBlur = 0;

        // Specific Drone Details
        ctx.fillStyle = "#f8fafc";
        ctx.font = "bold 18px Consolas";
        ctx.fillText(`ASSET COMPROMISED BY: ${breachDroneId}`, centerX, centerY - 10);
        
        // --- NEW: Typewriter Effect for Damage Control ---
        ctx.fillStyle = "#facc15";
        ctx.font = "16px Consolas";
        let warningText = "INITIATING DAMAGE CONTROL PROTOCOLS...";
        
        // Calculates how many letters to show based on the frame timer
        let showChars = Math.floor((180 - breachWarningFrames) / 2);
        if (showChars > warningText.length) showChars = warningText.length;
        
        ctx.fillText(warningText.substring(0, showChars), centerX, centerY + 30);
        
        ctx.textAlign = "left"; 
        
        breachWarningFrames--; 
    }

    requestAnimationFrame(animate);
}

// --- CONTROLS ---

function startSimulation() {
    if (running) return;
    
    // --- NEW: START AUDIO ENGINE AND SOUND ALARM ---
   if (running) return;
    
    // --- FIXED: Use the new function name! ---
    sfx.init(); 
    sfx.playDetection(); 

    running = true;
    waveCount = 0;
    totalSpawns = 0;
    totalThreatsSpawned = 0;

    // 1. Pick a random total campaign size between 200 and 250
    targetGlobalSpawns = Math.floor(Math.random() * 51) + 200; 
    
    // 2. Calculate a threat percentage between 15% (0.15) and 20% (0.20)
    let threatPercent = (Math.random() * 0.05) + 0.15;
    
    // 3. Set the exact number of threats for the entire campaign
    targetGlobalThreats = Math.floor(targetGlobalSpawns * threatPercent); 

    log(`<span style="color:#94a3b8">>> INIT COMMAND: Defense Campaign Generated.</span>`);
    log(`<span style="color:#94a3b8">>> INTELLIGENCE: Expecting ${targetGlobalSpawns} inbound targets (~${targetGlobalThreats} lethal).</span>`);
    
    spawnWave(); 
    
    setTimeout(() => {
        log("Perimeter active. AI set to Auto-Engage at 280km.");
        AIdefense();
    }, 3500);
}

function resetSimulation() {
    // --- FIXED: ADD THE AUDIO KILL SWITCH HERE ---
    sfx.stopAll();

    drones = [];
    interceptors = [];
    explosions = [];
    running = false;
    totalNeutralizedScore = 0;
    waveCount = 0;
    totalSpawns = 0; 
    campaignWon = false;
    
    document.getElementById("log").innerHTML = "> System Reset. Sector Clear.<br>";
    
    // Safety check just in case history-list doesn't exist in your HTML
    const historyList = document.getElementById("history-list");
    if (historyList) {
        historyList.innerHTML = "<li>Waiting for engagement...</li>";
    }
    
    updateStats();
}


// Trigger 1: Pressing the 'B' key on your keyboard
// --- SECRET PRESENTATION COMMANDS ---

document.addEventListener("keydown", (e) => {
    let key = e.key.toLowerCase();

    // The Breach Command
    if (key === 'b') {
        demoBreachesAllowed++;
        console.log(`[SYS] Secret Override: ${demoBreachesAllowed} payload(s) will bypass perimeter.`);
    }
    
    // THE NEW CANCEL COMMAND
    else if (key === 'c') {
        demoBreachesAllowed = 0; // Resets the blind spot back to zero!
        console.log("[SYS] Secret Override CANCELED: Perimeter defense restored to 100%.");
    }
});

// Trigger 2: Secretly clicking the main "SiftGuard" Title at the top of the page
const dashboardTitle = document.querySelector("h1");
if (dashboardTitle) {
    dashboardTitle.style.cursor = "default"; 
    dashboardTitle.addEventListener("click", () => {
        demoBreachesAllowed++;
        console.log(`[SYS] Secret Override: ${demoBreachesAllowed} payload(s) will bypass perimeter.`);
    });
}

animate();

// --- AUDIO ENGINE UNLOCKER ---
// Forces the browser to unlock the audio the moment you click anywhere on the page
document.body.addEventListener('click', function() {
    if (!sfx.ctx) sfx.init();
    else if (sfx.ctx.state === 'suspended') sfx.ctx.resume();
}, { once: true });


// ==========================================
// 📡 IOT SENSOR INTEGRATION (WEBSOCKETS)
// ==========================================
// In a production environment, SiftGuard connects to Edge IoT devices 
// (SDRs, Acoustic Sensors) via a WebSocket server.

const IOT_SERVER_URL = 'ws://localhost:8080'; // The address of our app.py backend
let ioTSocket = null;

function connectIoTSensors() {
    try {
        ioTSocket = new WebSocket(IOT_SERVER_URL);

        ioTSocket.onopen = function() {
            console.log("📡 SiftGuard: Successfully connected to IoT Sensor Network.");
            document.getElementById('statusText').innerText = "IOT SENSORS: ONLINE";
        };

        // When a physical IoT sensor detects a drone, it sends data here instantly
        ioTSocket.onmessage = function(event) {
            // 1. Parse the incoming JSON data from the hardware sensor
            const droneData = JSON.parse(event.data); 
            // Example data: { id: "UAV-99", x: 150, y: -80, threatLevel: "high" }

            // 2. Push the real data into our radar's tracking array
            advancedTargets.push({
                x: droneData.x,
                y: droneData.y,
                threatLevel: droneData.threatLevel,
                color: droneData.threatLevel === 'high' ? '#ff0000' : '#00ff00'
            });

            // 3. Trigger Psychoacoustic Audio Triage based on the real hardware data
            if (droneData.threatLevel === 'high') {
                sfx.playDetection(); // Play the high-speed tactical lock-on
            }
        };

        ioTSocket.onerror = function(error) {
            console.log("⚠️ IoT Network Error. Falling back to simulation mode.");
        };

    } catch (e) {
        console.log("IoT connection bypassed. Running tactical simulation.");
    }
}

// Call this to start listening for hardware
// connectIoTSensors();