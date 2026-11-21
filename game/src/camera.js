// SOLENA BAY — third-person camera rig: follow + orbit, smooth-lerped.
import * as THREE from 'three';

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.yaw = Math.PI; // behind player looking north
    this.pitch = 0.32;
    this.dist = 8.5;
    this.target = new THREE.Vector3();
    this.smoothed = new THREE.Vector3(0, 6, 20);
  }

  addLook(dx, dy) {
    this.yaw -= dx * 0.0026;
    this.pitch = Math.max(-0.15, Math.min(1.1, this.pitch + dy * 0.0022));
  }

  // Snap behind a heading (used when entering a car / staging shots).
  snapBehind(headingYaw) {
    this.yaw = headingYaw + Math.PI;
    this.pitch = 0.3;
  }

  update(dt, focus, inCar) {
    const wantDist = inCar ? 10.5 : 8.0;
    this.dist += (wantDist - this.dist) * Math.min(1, dt * 3);
    this.target.lerp(focus, Math.min(1, dt * 8));
    const cx = this.target.x + Math.sin(this.yaw) * Math.cos(this.pitch) * this.dist;
    const cz = this.target.z + Math.cos(this.yaw) * Math.cos(this.pitch) * this.dist;
    const cy = this.target.y + Math.sin(this.pitch) * this.dist + 1.2;
    this.smoothed.lerp(new THREE.Vector3(cx, Math.max(cy, 1.6), cz), Math.min(1, dt * 10));
    this.camera.position.copy(this.smoothed);
    this.camera.lookAt(this.target.x, this.target.y + 1.4, this.target.z);
  }
}
