import { VehicleData } from './VehicleData.js';
import { Game } from './Game.js';

export class VehicleSelectManager {
  constructor() {
    this.currentIndex = 0;
    
    // UI Elements
    this.nameEl = document.getElementById('vehicle-name');
    this.descEl = document.getElementById('vehicle-desc');
    this.speedBar = document.getElementById('stat-speed');
    this.accelBar = document.getElementById('stat-accel');
    this.handlingBar = document.getElementById('stat-handling');
    this.hoverBar = document.getElementById('stat-hover');
    
    // Buttons
    document.getElementById('btn-prev').addEventListener('click', () => this.previousVehicle());
    document.getElementById('btn-next').addEventListener('click', () => this.nextVehicle());
    document.getElementById('btn-start').addEventListener('click', () => this.launchGame());

    // Initialize Game engine in background for showcase
    this.game = new Game();
    
    // Select first vehicle
    this.selectVehicle(0);
  }

  selectVehicle(index) {
    this.currentIndex = index;
    const data = VehicleData[this.currentIndex];

    // Update UI
    this.nameEl.innerText = data.name;
    this.descEl.innerText = data.description;
    
    // Convert 0.0 - 1.0 to percentage
    this.speedBar.style.width = `${data.topSpeed * 100}%`;
    this.accelBar.style.width = `${data.accelerationRate * 100}%`;
    this.handlingBar.style.width = `${data.handlingSensitivity * 100}%`;
    this.hoverBar.style.width = `${data.hoverHeight * 100}%`;
    
    // Update Theme Color
    const cssColor = '#' + data.color.toString(16).padStart(6, '0');
    document.documentElement.style.setProperty('--accent', cssColor);
    document.documentElement.style.setProperty('--accent-glow', `${cssColor}66`); // 40% opacity hex

    // Update 3D Preview
    this.game.setPreviewVehicle(data);
  }

  nextVehicle() {
    let nextIndex = (this.currentIndex + 1) % VehicleData.length;
    this.selectVehicle(nextIndex);
  }

  previousVehicle() {
    let prevIndex = (this.currentIndex - 1 + VehicleData.length) % VehicleData.length;
    this.selectVehicle(prevIndex);
  }

  launchGame() {
    // Hide UI
    document.getElementById('ui-layer').classList.add('hidden');
    // Show HUD
    document.getElementById('hud-layer').classList.remove('hidden');
    
    // Tell game to transition to race mode
    this.game.startRace();
  }
}
