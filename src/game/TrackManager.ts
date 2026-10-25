import * as THREE from 'three';
import { ObstacleType, PowerupType } from '../types/game';

export const LANE_WIDTH = 3.0;
export const LANES = [-LANE_WIDTH, 0, LANE_WIDTH] as const;

export interface ActiveObstacle {
  id: number;
  mesh: THREE.Group;
  type: ObstacleType;
  lane: -1 | 0 | 1;
  z: number;
  y: number;
  width: number;
  height: number;
  depth: number;
  isMoving?: boolean;
  speed?: number;
}

export interface ActiveCoin {
  id: number;
  mesh: THREE.Group;
  lane: -1 | 0 | 1;
  z: number;
  y: number;
  collected: boolean;
}

export interface ActivePowerup {
  id: number;
  mesh: THREE.Group;
  type: PowerupType;
  lane: -1 | 0 | 1;
  z: number;
  y: number;
  collected: boolean;
}

export class TrackManager {
  public scene: THREE.Scene;
  public trackGroup: THREE.Group;
  public obstacles: ActiveObstacle[] = [];
  public coins: ActiveCoin[] = [];
  public powerups: ActivePowerup[] = [];

  // Scenery & Roads
  private roadSegments: THREE.Group[] = [];
  private sceneryBuildings: THREE.InstancedMesh | null = null;
  private buildingCount = 50;
  private nextSpawnZ: number = -40;
  private nextObstacleId: number = 1;

  // Object Pools to eliminate GC stutter during gameplay
  private obstaclePool: Map<ObstacleType, THREE.Group[]> = new Map();
  private coinPool: THREE.Group[] = [];
  private powerupPool: Map<PowerupType, THREE.Group[]> = new Map();

  // Shared Static Geometries (Pre-allocated once, reused across entire game lifecycle)
  private coinGeo: THREE.CylinderGeometry;
  private coinCoreGeo: THREE.CylinderGeometry;
  private lowBarrierPostGeo: THREE.BoxGeometry;
  private lowBarrierBarGeo: THREE.BoxGeometry;
  private lowBarrierStripeGeo: THREE.BoxGeometry;
  private highBarrierPostGeo: THREE.BoxGeometry;
  private highBarrierBeamGeo: THREE.BoxGeometry;
  private highBarrierLaserGeo: THREE.BoxGeometry;
  private trainBodyGeo: THREE.BoxGeometry;
  private trainNoseGeo: THREE.ConeGeometry;
  private trainLightGeo: THREE.SphereGeometry;
  private trainWinGeo: THREE.BoxGeometry;
  private trainRoofGeo: THREE.BoxGeometry;
  private rampGeo: THREE.BufferGeometry;
  private rampArrowGeo: THREE.BoxGeometry;
  private columnGeo: THREE.BoxGeometry;
  private columnLightGeo: THREE.BoxGeometry;
  private powerupOrbGeo: THREE.OctahedronGeometry;
  private powerupRingGeo: THREE.TorusGeometry;

  // Shared Materials
  private coinMat: THREE.MeshStandardMaterial;
  private coinCoreMat: THREE.MeshStandardMaterial;
  private lowBarrierMat: THREE.MeshStandardMaterial;
  private highBarrierMat: THREE.MeshStandardMaterial;
  private trainBodyMat: THREE.MeshPhysicalMaterial;
  private trainWindowMat: THREE.MeshStandardMaterial;
  private neonCyanMat: THREE.MeshStandardMaterial;
  private neonMagentaMat: THREE.MeshStandardMaterial;
  private rampMat: THREE.MeshStandardMaterial;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.trackGroup = new THREE.Group();
    this.scene.add(this.trackGroup);

    // 1. Initialize Shared Geometries
    this.coinGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.12, 12);
    this.coinGeo.rotateX(Math.PI / 2);
    this.coinCoreGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.14, 8);
    this.coinCoreGeo.rotateX(Math.PI / 2);

    this.lowBarrierPostGeo = new THREE.BoxGeometry(0.15, 0.9, 0.15);
    this.lowBarrierBarGeo = new THREE.BoxGeometry(2.3, 0.25, 0.15);
    this.lowBarrierStripeGeo = new THREE.BoxGeometry(2.2, 0.1, 0.18);

    this.highBarrierPostGeo = new THREE.BoxGeometry(0.15, 3.2, 0.15);
    this.highBarrierBeamGeo = new THREE.BoxGeometry(2.4, 0.7, 0.3);
    this.highBarrierLaserGeo = new THREE.BoxGeometry(2.2, 0.15, 0.2);

    this.trainBodyGeo = new THREE.BoxGeometry(2.5, 2.4, 16.0);
    this.trainNoseGeo = new THREE.ConeGeometry(1.2, 2.5, 4);
    this.trainNoseGeo.rotateX(Math.PI / 2);
    this.trainLightGeo = new THREE.SphereGeometry(0.2, 8, 8);
    this.trainWinGeo = new THREE.BoxGeometry(0.05, 0.6, 1.5);
    this.trainRoofGeo = new THREE.BoxGeometry(0.4, 0.06, 16.0);

    // Pre-calculate ramp geometry once
    const rampShape = new THREE.Shape();
    rampShape.moveTo(0, 0);
    rampShape.lineTo(8.0, 2.4);
    rampShape.lineTo(8.0, 0);
    rampShape.closePath();
    const extrudeSettings = { depth: 2.4, bevelEnabled: false };
    const rawRamp = new THREE.ExtrudeGeometry(rampShape, extrudeSettings);
    rawRamp.center();
    rawRamp.rotateY(Math.PI / 2);
    this.rampGeo = rawRamp;
    this.rampArrowGeo = new THREE.BoxGeometry(1.2, 0.04, 0.3);

    this.columnGeo = new THREE.BoxGeometry(2.2, 6.0, 1.5);
    this.columnLightGeo = new THREE.BoxGeometry(2.3, 0.4, 1.6);

    this.powerupOrbGeo = new THREE.OctahedronGeometry(0.65, 0);
    this.powerupRingGeo = new THREE.TorusGeometry(0.9, 0.04, 6, 16);
    this.powerupRingGeo.rotateX(Math.PI / 4);

    // 2. Initialize Shared Materials
    this.coinMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 1.5,
      metalness: 0.9,
      roughness: 0.2,
    });

    this.coinCoreMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 2.5,
    });

    this.lowBarrierMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xb91c1c,
      emissiveIntensity: 1.8,
      metalness: 0.5,
      roughness: 0.3,
    });

    this.highBarrierMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x0891b2,
      emissiveIntensity: 2.0,
      metalness: 0.4,
      roughness: 0.3,
    });

    this.trainBodyMat = new THREE.MeshPhysicalMaterial({
      color: 0x0f172a,
      metalness: 0.85,
      roughness: 0.2,
      clearcoat: 0.8,
    });

    this.trainWindowMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 2.2,
    });

    this.neonCyanMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00d2ff,
      emissiveIntensity: 2.8,
    });

    this.neonMagentaMat = new THREE.MeshStandardMaterial({
      color: 0xff007f,
      emissive: 0xff0055,
      emissiveIntensity: 2.8,
    });

    this.rampMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.6,
      roughness: 0.3,
    });

    // 3. Pools mapping
    const types: ObstacleType[] = ['low_barrier', 'high_barrier', 'train_static', 'train_moving', 'ramp', 'tall_column'];
    types.forEach((t) => this.obstaclePool.set(t, []));
    const ptypes: PowerupType[] = ['magnet', 'jetpack', 'hoverboard', 'super_sneakers', 'multiplier'];
    ptypes.forEach((pt) => this.powerupPool.set(pt, []));

    this.buildCitySkyline();
    this.buildInitialTrack();
  }

  private buildCitySkyline() {
    const buildingGeo = new THREE.BoxGeometry(12, 1, 12);
    const buildingMat = new THREE.MeshStandardMaterial({
      color: 0x080c18,
      metalness: 0.8,
      roughness: 0.3,
    });

    this.sceneryBuildings = new THREE.InstancedMesh(buildingGeo, buildingMat, this.buildingCount);
    const dummy = new THREE.Object3D();

    for (let i = 0; i < this.buildingCount; i++) {
      const isLeft = i % 2 === 0;
      const x = isLeft ? -22 - Math.random() * 20 : 22 + Math.random() * 20;
      const z = -i * 28 + 50;
      const height = 25 + Math.random() * 50;
      dummy.position.set(x, height / 2 - 2, z);
      dummy.scale.set(1 + Math.random() * 0.4, height, 1 + Math.random() * 0.4);
      dummy.updateMatrix();
      this.sceneryBuildings.setMatrixAt(i, dummy.matrix);
    }
    this.sceneryBuildings.instanceMatrix.needsUpdate = true;
    this.sceneryBuildings.frustumCulled = false;
    this.scene.add(this.sceneryBuildings);
  }

  private createRoadChunk(zOffset: number): THREE.Group {
    const chunk = new THREE.Group();
    chunk.position.z = zOffset;

    const CHUNK_LENGTH = 120;

    // Main Track Surface
    const roadGeo = new THREE.PlaneGeometry(14, CHUNK_LENGTH);
    roadGeo.rotateX(-Math.PI / 2);
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x040711,
      roughness: 0.4,
      metalness: 0.7,
    });
    const roadMesh = new THREE.Mesh(roadGeo, roadMat);
    roadMesh.receiveShadow = true;
    chunk.add(roadMesh);

    // 3 Glowing Lane Dividers / Magnetic Rails
    [-LANE_WIDTH, 0, LANE_WIDTH].forEach((lx) => {
      [-0.9, 0.9].forEach((rx) => {
        const railGeo = new THREE.BoxGeometry(0.08, 0.05, CHUNK_LENGTH);
        const railMesh = new THREE.Mesh(railGeo, this.neonCyanMat);
        railMesh.position.set(lx + rx, 0.03, 0);
        chunk.add(railMesh);
      });

      for (let tz = -CHUNK_LENGTH / 2; tz < CHUNK_LENGTH / 2; tz += 6) {
        const tieGeo = new THREE.BoxGeometry(1.8, 0.02, 0.4);
        const tieMesh = new THREE.Mesh(tieGeo, this.neonMagentaMat);
        tieMesh.position.set(lx, 0.02, tz);
        chunk.add(tieMesh);
      }
    });

    // Side Neon Guardrails
    [-7, 7].forEach((sx) => {
      const guardGeo = new THREE.BoxGeometry(0.2, 0.8, CHUNK_LENGTH);
      const guardMesh = new THREE.Mesh(guardGeo, this.highBarrierMat);
      guardMesh.position.set(sx, 0.4, 0);
      chunk.add(guardMesh);

      const stripGeo = new THREE.BoxGeometry(0.25, 0.1, CHUNK_LENGTH);
      const stripMesh = new THREE.Mesh(stripGeo, this.neonCyanMat);
      stripMesh.position.set(sx, 0.85, 0);
      chunk.add(stripMesh);
    });

    // Overhead Cyber Arches
    for (let az = -CHUNK_LENGTH / 2 + 15; az < CHUNK_LENGTH / 2; az += 30) {
      const arch = new THREE.Group();
      arch.position.set(0, 0, az);

      const postL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 5, 0.4), this.highBarrierMat);
      postL.position.set(-6.8, 2.5, 0);
      const postR = postL.clone();
      postR.position.x = 6.8;

      const beam = new THREE.Mesh(new THREE.BoxGeometry(14, 0.4, 0.4), this.highBarrierMat);
      beam.position.set(0, 4.8, 0);

      const signMesh = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.8, 0.1), this.neonCyanMat);
      signMesh.position.set(0, 4.8, 0.2);

      arch.add(postL, postR, beam, signMesh);
      chunk.add(arch);
    }

    return chunk;
  }

  private buildInitialTrack() {
    for (let i = 0; i < 4; i++) {
      const chunk = this.createRoadChunk(-i * 120);
      this.roadSegments.push(chunk);
      this.trackGroup.add(chunk);
    }
  }

  // --- MESH BUILDERS FOR OBJECT POOLING ---

  private createObstacleMesh(type: ObstacleType): THREE.Group {
    const group = new THREE.Group();

    if (type === 'low_barrier') {
      const postL = new THREE.Mesh(this.lowBarrierPostGeo, this.lowBarrierMat);
      postL.position.set(-1.0, 0, 0);
      const postR = postL.clone();
      postR.position.x = 1.0;

      const bar = new THREE.Mesh(this.lowBarrierBarGeo, this.lowBarrierMat);
      bar.position.y = 0.3;

      const stripe = new THREE.Mesh(this.lowBarrierStripeGeo, this.neonMagentaMat);
      stripe.position.y = 0.3;

      group.add(postL, postR, bar, stripe);
    } else if (type === 'high_barrier') {
      const postL = new THREE.Mesh(this.highBarrierPostGeo, this.highBarrierMat);
      postL.position.set(-1.1, -0.3, 0);
      const postR = postL.clone();
      postR.position.x = 1.1;

      const beam = new THREE.Mesh(this.highBarrierBeamGeo, this.highBarrierMat);
      beam.position.y = 0.2;

      const laser = new THREE.Mesh(this.highBarrierLaserGeo, this.neonCyanMat);
      laser.position.y = -0.2;

      group.add(postL, postR, beam, laser);
    } else if (type === 'train_static' || type === 'train_moving') {
      const trainBody = new THREE.Mesh(this.trainBodyGeo, this.trainBodyMat);
      const nose = new THREE.Mesh(this.trainNoseGeo, this.trainBodyMat);
      nose.position.set(0, 0, 8.0 + 1.2);

      const lightL = new THREE.Mesh(this.trainLightGeo, this.neonCyanMat);
      lightL.position.set(-0.7, -0.3, 8.0 + 1.3);
      const lightR = lightL.clone();
      lightR.position.x = 0.7;

      for (let wz = -6; wz < 6; wz += 3) {
        const winL = new THREE.Mesh(this.trainWinGeo, this.trainWindowMat);
        winL.position.set(-1.27, 0.3, wz);
        const winR = winL.clone();
        winR.position.x = 1.27;
        group.add(winL, winR);
      }

      const roofStrip = new THREE.Mesh(this.trainRoofGeo, this.neonMagentaMat);
      roofStrip.position.y = 1.23;

      group.add(trainBody, nose, lightL, lightR, roofStrip);
    } else if (type === 'ramp') {
      const rampMesh = new THREE.Mesh(this.rampGeo, this.rampMat);
      for (let rz = -3; rz < 4; rz += 2) {
        const arrow = new THREE.Mesh(this.rampArrowGeo, this.neonCyanMat);
        const progress = (rz + 4) / 8;
        arrow.position.set(0, progress * 2.3 + 0.05, rz);
        group.add(arrow);
      }
      group.add(rampMesh);
    } else if (type === 'tall_column') {
      const columnMesh = new THREE.Mesh(this.columnGeo, this.trainBodyMat);
      const pillarLight = new THREE.Mesh(this.columnLightGeo, this.neonMagentaMat);
      pillarLight.position.y = 1.5;
      group.add(columnMesh, pillarLight);
    }

    return group;
  }

  public spawnObstacle(type: ObstacleType, laneIdx: -1 | 0 | 1, z: number): ActiveObstacle {
    const laneX = LANES[laneIdx + 1];
    let width = 2.4;
    let height = 1.0;
    let depth = 1.0;
    let y = 0;

    if (type === 'low_barrier') {
      height = 0.9;
      depth = 0.4;
      y = 0.45;
    } else if (type === 'high_barrier') {
      height = 1.5;
      depth = 0.5;
      y = 1.9;
    } else if (type === 'train_static' || type === 'train_moving') {
      width = 2.5;
      height = 2.4;
      depth = 16.0;
      y = 1.2;
    } else if (type === 'ramp') {
      width = 2.4;
      height = 2.4;
      depth = 8.0;
      y = 1.2;
    } else if (type === 'tall_column') {
      width = 2.2;
      height = 6.0;
      depth = 1.5;
      y = 3.0;
    }

    // Retrieve from pool or create once
    const pool = this.obstaclePool.get(type) || [];
    let group = pool.pop();

    if (!group) {
      group = this.createObstacleMesh(type);
      this.trackGroup.add(group);
    } else {
      group.visible = true;
    }

    group.position.set(laneX, y, z);

    const obstacle: ActiveObstacle = {
      id: this.nextObstacleId++,
      mesh: group,
      type,
      lane: laneIdx,
      z,
      y,
      width,
      height,
      depth,
      isMoving: type === 'train_moving',
      speed: type === 'train_moving' ? 12 : 0,
    };

    this.obstacles.push(obstacle);
    return obstacle;
  }

  public spawnCoin(laneIdx: -1 | 0 | 1, y: number, z: number) {
    const laneX = LANES[laneIdx + 1];
    let group = this.coinPool.pop();

    if (!group) {
      group = new THREE.Group();
      const coinMesh = new THREE.Mesh(this.coinGeo, this.coinMat);
      const core = new THREE.Mesh(this.coinCoreGeo, this.coinCoreMat);
      group.add(coinMesh, core);
      this.trackGroup.add(group);
    } else {
      group.visible = true;
      group.scale.set(1, 1, 1);
    }

    group.position.set(laneX, y, z);

    this.coins.push({
      id: this.nextObstacleId++,
      mesh: group,
      lane: laneIdx,
      z,
      y,
      collected: false,
    });
  }

  public spawnCoinArc(laneIdx: -1 | 0 | 1, startZ: number, count: number = 5, apexHeight: number = 3.0) {
    const spacing = 3.5;
    for (let i = 0; i < count; i++) {
      const z = startZ - i * spacing;
      const t = i / (count - 1);
      const arcY = 1.0 + Math.sin(t * Math.PI) * (apexHeight - 1.0);
      this.spawnCoin(laneIdx, arcY, z);
    }
  }

  public spawnPowerup(type: PowerupType, laneIdx: -1 | 0 | 1, y: number, z: number) {
    const laneX = LANES[laneIdx + 1];
    const pool = this.powerupPool.get(type) || [];
    let group = pool.pop();

    if (!group) {
      group = new THREE.Group();
      let orbMat = this.neonCyanMat;
      if (type === 'magnet') orbMat = this.neonMagentaMat;
      else if (type === 'hoverboard') orbMat = this.neonCyanMat;
      else if (type === 'jetpack') orbMat = this.coinMat;
      else if (type === 'super_sneakers') orbMat = this.neonMagentaMat;
      else if (type === 'multiplier') orbMat = this.coinMat;

      const orb = new THREE.Mesh(this.powerupOrbGeo, orbMat);
      const ring = new THREE.Mesh(this.powerupRingGeo, orbMat);
      group.add(orb, ring);
      this.trackGroup.add(group);
    } else {
      group.visible = true;
      group.scale.set(1, 1, 1);
    }

    group.position.set(laneX, y, z);

    this.powerups.push({
      id: this.nextObstacleId++,
      mesh: group,
      type,
      lane: laneIdx,
      z,
      y,
      collected: false,
    });
  }

  public generateNextChunk(playerZ: number) {
    while (this.nextSpawnZ > playerZ - 200) {
      const z = this.nextSpawnZ;
      const patternChoice = Math.random();

      const lanes: (-1 | 0 | 1)[] = [-1, 0, 1];
      const blockedLane = lanes[Math.floor(Math.random() * lanes.length)];
      const otherLanes = lanes.filter((l) => l !== blockedLane);

      if (patternChoice < 0.28) {
        this.spawnObstacle('low_barrier', blockedLane, z);
        this.spawnCoinArc(blockedLane, z + 6, 5, 2.8);

        const coinLane = otherLanes[0];
        for (let cz = 0; cz < 4; cz++) {
          this.spawnCoin(coinLane, 1.0, z - cz * 4);
        }
      } else if (patternChoice < 0.52) {
        this.spawnObstacle('high_barrier', blockedLane, z);
        for (let cz = -2; cz <= 2; cz++) {
          this.spawnCoin(blockedLane, 0.45, z + cz * 3);
        }

        if (Math.random() < 0.35) {
          const ptypes: PowerupType[] = ['magnet', 'hoverboard', 'jetpack', 'super_sneakers', 'multiplier'];
          const ptype = ptypes[Math.floor(Math.random() * ptypes.length)];
          this.spawnPowerup(ptype, otherLanes[0], 1.2, z - 8);
        }
      } else if (patternChoice < 0.78) {
        this.spawnObstacle('ramp', blockedLane, z);
        this.spawnObstacle('train_static', blockedLane, z - 12);

        for (let cz = -5; cz <= 5; cz += 2.5) {
          this.spawnCoin(blockedLane, 3.2, z - 12 + cz);
        }

        const secLane = otherLanes[0];
        this.spawnObstacle('low_barrier', secLane, z - 6);
      } else {
        this.spawnObstacle('train_moving', blockedLane, z);
        const freeLane = otherLanes[0];
        for (let cz = 0; cz < 6; cz++) {
          this.spawnCoin(freeLane, 1.0, z - cz * 3.5);
        }
      }

      this.nextSpawnZ -= 38;
    }
  }

  public update(dt: number, playerZ: number, magnetActive: boolean, playerPos: THREE.Vector3) {
    // 1. Recycle road chunks
    for (const chunk of this.roadSegments) {
      if (chunk.position.z > playerZ + 80) {
        let minZ = 0;
        for (const c of this.roadSegments) {
          if (c.position.z < minZ) minZ = c.position.z;
        }
        chunk.position.z = minZ - 120;
      }
    }

    // 2. Animate and recycle obstacles to pool
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];

      if (obs.isMoving && obs.speed) {
        obs.z += obs.speed * dt;
        obs.mesh.position.z = obs.z;
      }

      // Recycle when behind player
      if (obs.z > playerZ + 25) {
        obs.mesh.visible = false;
        const pool = this.obstaclePool.get(obs.type);
        if (pool) pool.push(obs.mesh);
        this.obstacles.splice(i, 1);
      }
    }

    // 3. Animate coins & magnet attraction with zero-allocation pooling
    const coinSpin = dt * 4.5;
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];

      if (c.collected) {
        c.mesh.position.y += dt * 8;
        c.mesh.scale.multiplyScalar(0.85);
        if (c.mesh.scale.x < 0.1) {
          c.mesh.visible = false;
          this.coinPool.push(c.mesh);
          this.coins.splice(i, 1);
        }
        continue;
      }

      c.mesh.rotation.z += coinSpin;

      if (magnetActive) {
        const distSq = c.mesh.position.distanceToSquared(playerPos);
        if (distSq < 220) {
          c.mesh.position.lerp(playerPos, dt * 14);
          c.z = c.mesh.position.z;
          c.y = c.mesh.position.y;
        }
      }

      if (c.z > playerZ + 20) {
        c.mesh.visible = false;
        this.coinPool.push(c.mesh);
        this.coins.splice(i, 1);
      }
    }

    // 4. Animate powerups with zero-allocation pooling
    const pRot = dt * 2.5;
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const p = this.powerups[i];
      if (p.collected) {
        p.mesh.position.y += dt * 10;
        p.mesh.scale.multiplyScalar(0.85);
        if (p.mesh.scale.x < 0.1) {
          p.mesh.visible = false;
          const pool = this.powerupPool.get(p.type);
          if (pool) pool.push(p.mesh);
          this.powerups.splice(i, 1);
        }
        continue;
      }

      p.mesh.rotation.y += pRot;
      p.mesh.rotation.x += pRot * 0.5;

      if (p.z > playerZ + 20) {
        p.mesh.visible = false;
        const pool = this.powerupPool.get(p.type);
        if (pool) pool.push(p.mesh);
        this.powerups.splice(i, 1);
      }
    }

    // 5. Scenery loop
    if (this.sceneryBuildings) {
      this.sceneryBuildings.position.z = Math.floor(playerZ / 300) * 300;
    }
  }

  public reset() {
    for (const o of this.obstacles) {
      o.mesh.visible = false;
      const pool = this.obstaclePool.get(o.type);
      if (pool) pool.push(o.mesh);
    }
    for (const c of this.coins) {
      c.mesh.visible = false;
      this.coinPool.push(c.mesh);
    }
    for (const p of this.powerups) {
      p.mesh.visible = false;
      const pool = this.powerupPool.get(p.type);
      if (pool) pool.push(p.mesh);
    }

    this.obstacles.length = 0;
    this.coins.length = 0;
    this.powerups.length = 0;
    this.nextSpawnZ = -40;

    for (let i = 0; i < this.roadSegments.length; i++) {
      this.roadSegments[i].position.z = -i * 120;
    }
  }

  public dispose() {
    this.reset();
    this.scene.remove(this.trackGroup);
    if (this.sceneryBuildings) this.scene.remove(this.sceneryBuildings);

    // Dispose all shared geometries
    this.coinGeo.dispose();
    this.coinCoreGeo.dispose();
    this.lowBarrierPostGeo.dispose();
    this.lowBarrierBarGeo.dispose();
    this.lowBarrierStripeGeo.dispose();
    this.highBarrierPostGeo.dispose();
    this.highBarrierBeamGeo.dispose();
    this.highBarrierLaserGeo.dispose();
    this.trainBodyGeo.dispose();
    this.trainNoseGeo.dispose();
    this.trainLightGeo.dispose();
    this.trainWinGeo.dispose();
    this.trainRoofGeo.dispose();
    this.rampGeo.dispose();
    this.rampArrowGeo.dispose();
    this.columnGeo.dispose();
    this.columnLightGeo.dispose();
    this.powerupOrbGeo.dispose();
    this.powerupRingGeo.dispose();

    // Dispose shared materials
    this.coinMat.dispose();
    this.coinCoreMat.dispose();
    this.lowBarrierMat.dispose();
    this.highBarrierMat.dispose();
    this.trainBodyMat.dispose();
    this.trainWindowMat.dispose();
    this.neonCyanMat.dispose();
    this.neonMagentaMat.dispose();
    this.rampMat.dispose();
  }
}
