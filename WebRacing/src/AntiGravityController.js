import * as THREE from 'three';

export class AntiGravityController {
  constructor(shipGroup, trackMeshes, obstacles, vehicleData) {
    this.ship = shipGroup;
    this.trackMeshes = trackMeshes;
    this.obstacles = obstacles; // Array of meshes to avoid
    this.data = vehicleData;

    this.velocity = new THREE.Vector3();

    this.baseHoverHeight = 1.0 + (this.data.hoverHeight * 1.5);
    this.springStrength = 15.0; 
    this.damping = 3.0;         

    this.maxSpeed = 50 + (this.data.topSpeed * 100);
    this.acceleration = 30 + (this.data.accelerationRate * 50);
    this.turnSpeed = 1.5 + (this.data.handlingSensitivity * 2.0);

    this.inputs = { forward: 0, turn: 0, drift: false };
    
    this.raycaster = new THREE.Raycaster();
    this.downVector = new THREE.Vector3(0, -1, 0);

    this.hoverOffsets = [
      new THREE.Vector3(1, 0, 1),
      new THREE.Vector3(-1, 0, 1),
      new THREE.Vector3(1, 0, -1),
      new THREE.Vector3(-1, 0, -1)
    ];

    this.shipRadius = 2.5; // Collision radius for obstacles
  }

  update(dt) {
    if(dt > 0.1) dt = 0.1; 

    // --- 1. Hover Physics ---
    let averageNormal = new THREE.Vector3();
    let hits = 0;
    let avgYCorrection = 0;

    for (let offset of this.hoverOffsets) {
      let worldPos = offset.clone().applyMatrix4(this.ship.matrixWorld);
      worldPos.y += this.baseHoverHeight;

      this.raycaster.set(worldPos, this.downVector);
      let intersects = this.raycaster.intersectObjects(this.trackMeshes);

      if (intersects.length > 0) {
        let hit = intersects[0];
        let distanceError = this.baseHoverHeight - hit.distance;
        
        let springForce = distanceError * this.springStrength;
        
        // ONLY apply upward spring force (do not pull the ship down through the floor)
        if (springForce > 0) {
            avgYCorrection += springForce * dt;
        }

        // Always count the normal for surface alignment
        averageNormal.add(hit.face.normal);
        hits++;
      }
    }

    if (hits > 0) {
      averageNormal.normalize();
      this.velocity.y += (avgYCorrection / hits) - (this.velocity.y * this.damping * dt);
    } else {
      this.velocity.y -= 20 * dt; 
    }

    if (hits > 0) {
        let currentUp = new THREE.Vector3(0, 1, 0).applyQuaternion(this.ship.quaternion);
        let alignQuat = new THREE.Quaternion().setFromUnitVectors(currentUp, averageNormal);
        
        let slerpFactor = 5.0 * dt;
        let identity = new THREE.Quaternion();
        alignQuat.slerp(identity, 1.0 - slerpFactor); 
        this.ship.quaternion.premultiply(alignQuat);
    }

    // --- 2. Input Forces ---
    let forwardDir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.ship.quaternion);
    let currentForwardSpeed = this.velocity.dot(forwardDir);
    
    if (this.inputs.forward > 0 && currentForwardSpeed < this.maxSpeed) {
      this.velocity.add(forwardDir.multiplyScalar(this.acceleration * dt));
    } else if (this.inputs.forward < 0) {
      this.velocity.add(forwardDir.multiplyScalar(-this.acceleration * 0.8 * dt)); 
    }

    if (Math.abs(this.inputs.turn) > 0.01) {
      this.ship.rotateY(-this.inputs.turn * this.turnSpeed * dt);
    }

    let rightDir = new THREE.Vector3(1, 0, 0).applyQuaternion(this.ship.quaternion);
    let lateralVelocityMag = this.velocity.dot(rightDir);
    
    let friction = this.inputs.drift ? 0.5 : 5.0; 
    let lateralCounter = rightDir.multiplyScalar(-lateralVelocityMag * friction * dt);
    this.velocity.add(lateralCounter);
    
    this.velocity.multiplyScalar(0.99);

    // --- 3. Collision Detection (Obstacles) ---
    // Simple 2D circle vs box check (ignoring Y for gameplay simplicity)
    for (let obs of this.obstacles) {
        let dx = this.ship.position.x - obs.position.x;
        let dz = this.ship.position.z - obs.position.z;
        let distSq = dx*dx + dz*dz;
        
        // 4 is obstacle width (Box 4x15x4), ship radius is 2.5
        let minRadiusSq = (this.shipRadius + 2.0) * (this.shipRadius + 2.0);
        
        if (distSq < minRadiusSq) {
            // Collision detected! Bounce ship away and penalize speed
            let normal = new THREE.Vector3(dx, 0, dz).normalize();
            
            // Reflect velocity and slash speed
            this.velocity.reflect(normal).multiplyScalar(0.4); 
            
            // Push out of collision volume to prevent getting stuck
            let dist = Math.sqrt(distSq);
            let penetration = Math.sqrt(minRadiusSq) - dist;
            this.ship.position.add(normal.multiplyScalar(penetration));
        }
    }

    // Apply Final Velocity to Position
    this.ship.position.addScaledVector(this.velocity, dt);
  }
}
