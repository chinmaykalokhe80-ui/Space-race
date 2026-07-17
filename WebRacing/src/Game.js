import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { AntiGravityController } from './AntiGravityController.js';

export class Game {
  constructor() {
    this.container = document.getElementById('game-container');
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x050510, 0.005);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.baseFov = 75;
    
    this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false }); // Antialias off for postprocessing
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.container.appendChild(this.renderer.domElement);

    // Setup Post-Processing (Bloom for Cyberpunk effect)
    const renderScene = new RenderPass(this.scene, this.camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    bloomPass.threshold = 0.2;
    bloomPass.strength = 1.8; // High intensity bloom
    bloomPass.radius = 0.5;

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(renderScene);
    this.composer.addPass(bloomPass);

    // Lighting Setup
    const ambient = new THREE.AmbientLight(0x202030, 2);
    this.scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 2);
    dirLight.position.set(10, 20, 10);
    this.scene.add(dirLight);

    // Spotlight to illuminate the rotating ship on the pedestal
    const showcaseLight = new THREE.SpotLight(0xffffff, 40);
    showcaseLight.position.set(0, 10, 0);
    showcaseLight.angle = Math.PI / 4;
    showcaseLight.penumbra = 0.5;
    showcaseLight.target.position.set(0, 2, 0);
    this.scene.add(showcaseLight);
    this.scene.add(showcaseLight.target);

    // Headlight on the camera so the player can always see their ship in dark areas
    const headlight = new THREE.PointLight(0xffffff, 15, 100);
    this.camera.add(headlight);
    this.scene.add(this.camera);

    this.trackMeshes = [];
    this.obstacles = [];
    this.buildEnvironment();

    this.state = 'preview'; 
    this.activeShip = null;
    this.controller = null;

    this.clock = new THREE.Clock();

    // Input bindings
    this.keys = { w: false, a: false, s: false, d: false, space: false };
    window.addEventListener('keydown', (e) => this.handleKey(e.code, true));
    window.addEventListener('keyup', (e) => this.handleKey(e.code, false));
    window.addEventListener('resize', () => this.onResize());

    this.hudSpeed = document.getElementById('hud-speed');

    this.animate();
  }

  buildEnvironment() {
    // 1. Starfield Background
    const starsGeo = new THREE.BufferGeometry();
    const starsCount = 2000;
    const posArray = new Float32Array(starsCount * 3);
    for(let i=0; i<starsCount*3; i++) {
        posArray[i] = (Math.random() - 0.5) * 800; // Scatter randomly
    }
    starsGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const starsMat = new THREE.PointsMaterial({size: 1.5, color: 0xffffff});
    this.starfield = new THREE.Points(starsGeo, starsMat);
    this.scene.add(this.starfield);

    // 2. Neon Track (Extremely long to prevent falling off)
    const trackLength = 40000;
    const geo = new THREE.PlaneGeometry(1000, trackLength, 100, 2000);
    geo.rotateX(-Math.PI / 2); 
    geo.translate(0, 0, -trackLength / 2 + 500); // Shift track forward along -Z

    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        let x = pos.getX(i);
        let z = pos.getZ(i);
        if(Math.abs(x) < 80) {
            let height = Math.sin(z / 30) * 4 + Math.cos(x / 15) * 2; 
            pos.setY(i, height); 
        } else {
            pos.setY(i, 20 + Math.random() * 10); // Jagged walls
        }
    }
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({ 
        color: 0x050510, 
        wireframe: true, 
        emissive: 0x0088ff,
        emissiveIntensity: 0.15
    });
    const track = new THREE.Mesh(geo, mat);
    this.scene.add(track);
    this.trackMeshes.push(track);

    // 3. Obstacles
    const obsGeo = new THREE.BoxGeometry(4, 15, 4);
    const obsMat = new THREE.MeshStandardMaterial({
        color: 0xff0055,
        emissive: 0xff0055, // Glowing red pillars
        emissiveIntensity: 0.8
    });

    for(let i=0; i<1500; i++) {
        const obs = new THREE.Mesh(obsGeo, obsMat);
        let x = (Math.random() - 0.5) * 140; // Within track bounds
        let z = -Math.random() * (trackLength - 1000) - 100; // Scatter far down the track
        obs.position.set(x, 7.5, z);
        this.scene.add(obs);
        this.obstacles.push(obs);
    }
  }

  setPreviewVehicle(data) {
    if(this.activeShip) {
        this.scene.remove(this.activeShip);
    }

    this.activeShip = new THREE.Group();

    // Main Body
    const bodyGeo = new THREE.ConeGeometry(1.2, 5, 4);
    bodyGeo.rotateX(Math.PI / 2); 
    const mat = new THREE.MeshStandardMaterial({ 
        color: data.color, 
        metalness: 0.8, 
        roughness: 0.2
    });
    const body = new THREE.Mesh(bodyGeo, mat);
    
    // Wings
    const wingGeo = new THREE.BoxGeometry(6, 0.2, 2);
    wingGeo.translate(0, -0.3, 1);
    const wings = new THREE.Mesh(wingGeo, mat);
    
    // Cockpit Canopy
    const cockpitGeo = new THREE.BoxGeometry(1, 0.8, 2);
    cockpitGeo.translate(0, 0.5, -0.5);
    const cockpitMat = new THREE.MeshStandardMaterial({ color: 0x000000, metalness: 1.0, roughness: 0.0 });
    const cockpit = new THREE.Mesh(cockpitGeo, cockpitMat);

    // Thruster Engine Visuals
    const engineGeo = new THREE.CylinderGeometry(0.5, 0.3, 1, 8);
    engineGeo.rotateX(Math.PI / 2);
    engineGeo.translate(0, 0, 2.5);
    const engineMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const engine = new THREE.Mesh(engineGeo, engineMat);

    // Thruster Flame Glow (Neon)
    const flameGeo = new THREE.CylinderGeometry(0.4, 0.1, 2, 8);
    flameGeo.rotateX(Math.PI / 2);
    const flameMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.8 });
    this.thrusterFlame = new THREE.Mesh(flameGeo, flameMat);
    this.thrusterFlame.position.set(0, 0, 4); // Placed slightly behind engine
    
    this.activeShip.add(body);
    this.activeShip.add(wings);
    this.activeShip.add(cockpit);
    this.activeShip.add(engine);
    this.activeShip.add(this.thrusterFlame);

    this.activeShip.position.set(0, 2, 0); 
    this.scene.add(this.activeShip);
    
    this.currentData = data;
  }

  startRace() {
    this.state = 'race';
    this.activeShip.position.set(0, 10, 0);
    this.activeShip.rotation.set(0, 0, 0);
    
    // Pass obstacles to controller for collision
    this.controller = new AntiGravityController(this.activeShip, this.trackMeshes, this.obstacles, this.currentData);
  }

  handleKey(code, isDown) {
    if(code === 'KeyW' || code === 'ArrowUp') this.keys.w = isDown;
    if(code === 'KeyS' || code === 'ArrowDown') this.keys.s = isDown;
    if(code === 'KeyA' || code === 'ArrowLeft') this.keys.a = isDown;
    if(code === 'KeyD' || code === 'ArrowRight') this.keys.d = isDown;
    if(code === 'Space') this.keys.space = isDown;
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer.setSize(window.innerWidth, window.innerHeight); // Update Composer size
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    let dt = this.clock.getDelta();

    // Rotate starfield
    if(this.starfield) {
        this.starfield.rotation.y += 0.05 * dt;
    }

    if (this.state === 'preview' && this.activeShip) {
        // Menu presentation rotation
        this.activeShip.rotation.y += 0.5 * dt;
        this.activeShip.position.y = 2 + Math.sin(this.clock.getElapsedTime() * 2) * 0.2;
        
        this.camera.position.x = Math.sin(this.clock.getElapsedTime() * 0.3) * 8;
        this.camera.position.z = Math.cos(this.clock.getElapsedTime() * 0.3) * 8;
        this.camera.position.y = 4;
        this.camera.lookAt(0, 2, 0);

        // Idle pulse thruster
        let pulse = 1.0 + Math.sin(this.clock.getElapsedTime() * 10) * 0.2;
        this.thrusterFlame.scale.set(pulse, 1, pulse);
    } 
    else if (this.state === 'race' && this.controller) {
        let forward = 0;
        if(this.keys.w) forward = 1;
        if(this.keys.s) forward = -1;
        let turn = 0;
        if(this.keys.a) turn = -1; // -1 maps to positive Y rotation (Left)
        if(this.keys.d) turn = 1;  // 1 maps to negative Y rotation (Right)

        this.controller.inputs = { forward: forward, turn: turn, drift: this.keys.space };
        this.controller.update(dt);

        let speed = this.controller.velocity.length();
        let maxSpeed = this.controller.maxSpeed;
        let speedRatio = Math.min(speed / maxSpeed, 1.0);

        // 1. Dynamic Engine Trail based on speed
        let targetFlameScale = 0.5 + (forward > 0 ? 1.5 : 0.0) + (speedRatio * 3.0);
        this.thrusterFlame.scale.z += (targetFlameScale - this.thrusterFlame.scale.z) * 10 * dt;

        // 2. Dynamic FOV Warp (Stretches the screen at high speeds)
        this.camera.fov = this.baseFov + (speedRatio * 35); // Huge stretch for speed feeling
        this.camera.updateProjectionMatrix();

        // 3. Update HUD
        let speedKmH = Math.floor(speed * 3.6);
        this.hudSpeed.innerText = speedKmH;

        // 4. Advanced Chase Camera with Shake
        let relativeCameraOffset = new THREE.Vector3(0, 4, 12);
        let cameraOffset = relativeCameraOffset.applyMatrix4(this.activeShip.matrixWorld);
        
        let shake = new THREE.Vector3();
        if (speedRatio > 0.8 || this.keys.space) {
            let intensity = (speedRatio - 0.8) * 0.8 + (this.keys.space ? 0.3 : 0);
            shake.x = (Math.random() - 0.5) * intensity;
            shake.y = (Math.random() - 0.5) * intensity;
        }

        // Lerp towards target and add raw shake
        this.camera.position.lerp(cameraOffset, 5 * dt).add(shake);
        
        let lookTarget = new THREE.Vector3(0, 0, -10).applyMatrix4(this.activeShip.matrixWorld);
        this.camera.lookAt(lookTarget);
    }

    // Use Composer for Bloom Rendering
    this.composer.render();
  }
}
