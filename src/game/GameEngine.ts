import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GameStats, GameStatus, Lane, PlayerCustomization, PowerupState, PowerupType } from '../types/game';
import { RobotModel } from './RobotModel';
import { LANES, TrackManager } from './TrackManager';
import { soundManager } from '../audio/soundManager';

export interface GameEngineCallbacks {
  onStatsUpdate: (stats: GameStats) => void;
  onPowerupsUpdate: (powerups: PowerupState[]) => void;
  onGameOver: (finalStats: GameStats) => void;
}

// Module-scope preallocated math helpers (Zero Garbage Collection in loop)
const _playerBox = new THREE.Box3();
const _obsBox = new THREE.Box3();
const _camTarget = new THREE.Vector3();
const _playerCenter = new THREE.Vector3();
const _playerBoxSize = new THREE.Vector3();
const _obsCenter = new THREE.Vector3();
const _obsSize = new THREE.Vector3();

interface PooledParticle {
  mesh: THREE.Mesh;
  active: boolean;
  life: number;
  maxLife: number;
  velX: number;
  velY: number;
  velZ: number;
  isGravity: boolean;
}

export class GameEngine {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private isSoftwareGl: boolean = false;
  private isMobile: boolean = false;
  private frameId: number = 0;
  private isDestroyed: boolean = false;

  // Game Systems
  private robot: RobotModel;
  private track: TrackManager;
  private callbacks: GameEngineCallbacks;

  // Game Loop State
  public status: GameStatus = 'idle';
  private clock: THREE.Clock;
  private score: number = 0;
  private coins: number = 0;
  private totalCoins: number = 0;
  private distance: number = 0;
  private baseSpeed: number = 26;
  private currentSpeed: number = 26;
  private scoreMultiplier: number = 1;

  // Player Physics & Kinematics
  private currentLane: Lane = 0;
  private playerX: number = 0;
  private playerY: number = 0;
  private playerZ: number = 0;
  private targetLaneX: number = 0;
  private velocityY: number = 0;
  private gravity: number = -46;
  private jumpForce: number = 17;
  private groundY: number = 0;
  private isGrounded: boolean = true;
  private isSliding: boolean = false;
  private slideTimer: number = 0;
  private slideDuration: number = 0.85;

  // Invulnerability
  private invulnerableTimer: number = 0;

  // Powerups Active Map
  private activePowerups: Map<PowerupType, { duration: number; timeLeft: number }> = new Map();

  // Pre-allocated Particle Pool
  private particleGroup: THREE.Group;
  private particlePool: PooledParticle[] = [];
  private maxParticles = 48;
  private particleGeo: THREE.SphereGeometry;
  private sparkMat: THREE.MeshBasicMaterial;
  private cyanParticleMat: THREE.MeshBasicMaterial;

  // Camera Settings
  private cameraOffset = new THREE.Vector3(0, 3.8, 7.8);
  private cameraLookOffset = new THREE.Vector3(0, 1.8, -4.5);
  private cameraShake: number = 0;

  // Performance & Dynamic Scaling Monitor
  private frameCount: number = 0;
  private fpsAccumulator: number = 0;
  private currentDpr: number = 1.0;
  private lowFpsCounter: number = 0;
  private dirLight: THREE.DirectionalLight | null = null;
  private lastUiNotifyTime: number = 0;

  constructor(container: HTMLElement, customization: PlayerCustomization, callbacks: GameEngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.clock = new THREE.Clock();

    // 1. Detect Mobile & Hardware Capabilities
    this.isMobile = (
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
    );

    // 2. Detect Software WebGL
    this.isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    // 3. Setup Three.js Renderer with Adaptive Pixel Ratio
    const maxAllowedDpr = this.isMobile ? 1.25 : 1.75;
    this.currentDpr = this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, maxAllowedDpr);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl && !this.isMobile,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(this.currentDpr);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    // Enable soft shadow mapping with mobile-appropriate shadow resolution
    const enableShadows = !this.isSoftwareGl;
    this.renderer.shadowMap.enabled = enableShadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    // 4. Scene & Camera Setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050714);
    this.scene.fog = new THREE.FogExp2(0x050714, 0.009);

    this.camera = new THREE.PerspectiveCamera(
      65,
      container.clientWidth / container.clientHeight,
      0.1,
      350
    );
    this.camera.position.set(0, 4, 8);

    // 5. Studio Environment Lighting
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // Directional Shadow Caster
    const shadowMapSize = this.isMobile ? 512 : 1024;
    this.dirLight = new THREE.DirectionalLight(0xffffff, 2.2);
    this.dirLight.position.set(12, 28, 15);
    if (enableShadows) {
      this.dirLight.castShadow = true;
      this.dirLight.shadow.mapSize.width = shadowMapSize;
      this.dirLight.shadow.mapSize.height = shadowMapSize;
      this.dirLight.shadow.camera.near = 0.5;
      this.dirLight.shadow.camera.far = 65;
      this.dirLight.shadow.camera.left = -14;
      this.dirLight.shadow.camera.right = 14;
      this.dirLight.shadow.camera.top = 18;
      this.dirLight.shadow.camera.bottom = -10;
      this.dirLight.shadow.bias = -0.0005;
      this.dirLight.shadow.normalBias = 0.02;
    }
    this.scene.add(this.dirLight);

    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x1e1b4b, 1.4);
    this.scene.add(hemiLight);

    // 6. Initialize Robot & Track
    this.robot = new RobotModel(customization);
    this.scene.add(this.robot.group);

    this.track = new TrackManager(this.scene);

    // 7. Pre-allocated Particle Pool
    this.particleGroup = new THREE.Group();
    this.scene.add(this.particleGroup);

    this.particleGeo = new THREE.SphereGeometry(0.08, 6, 6);
    this.sparkMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    this.cyanParticleMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });

    for (let i = 0; i < this.maxParticles; i++) {
      const mesh = new THREE.Mesh(this.particleGeo, this.cyanParticleMat);
      mesh.visible = false;
      this.particleGroup.add(mesh);
      this.particlePool.push({
        mesh,
        active: false,
        life: 0,
        maxLife: 0.3,
        velX: 0,
        velY: 0,
        velZ: 0,
        isGravity: false,
      });
    }

    // 8. Event Listeners
    window.addEventListener('resize', this.onResize);
    document.addEventListener('visibilitychange', this.onVisibilityChange);

    // Start render loop
    this.startLoop();
  }

  private onResize = () => {
    if (!this.container || this.isDestroyed) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private onVisibilityChange = () => {
    if (document.hidden) {
      if (this.status === 'playing') {
        soundManager.stopMusic();
      }
    } else {
      // Flush clock delta to prevent physics jumps after returning to tab
      this.clock.getDelta();
      if (this.status === 'playing') {
        soundManager.startMusic();
      }
    }
  };

  public setCustomization(cust: PlayerCustomization) {
    this.robot.setCustomization(cust);
  }

  public startGame() {
    this.reset();
    this.status = 'playing';
    this.clock.start();
    soundManager.startMusic();
    this.notifyUI(true);
  }

  public pauseGame() {
    if (this.status === 'playing') {
      this.status = 'paused';
      soundManager.stopMusic();
    } else if (this.status === 'paused') {
      this.status = 'playing';
      this.clock.getDelta();
      soundManager.startMusic();
    }
  }

  public reset() {
    this.status = 'idle';
    this.score = 0;
    this.coins = 0;
    this.distance = 0;
    this.currentSpeed = this.baseSpeed;
    this.currentLane = 0;
    this.playerX = 0;
    this.playerY = 0;
    this.playerZ = 0;
    this.targetLaneX = 0;
    this.velocityY = 0;
    this.groundY = 0;
    this.isGrounded = true;
    this.isSliding = false;
    this.slideTimer = 0;
    this.invulnerableTimer = 0;
    this.activePowerups.clear();

    this.robot.setHoverboard(false);
    this.robot.group.position.set(0, 0, 0);
    this.robot.group.rotation.set(0, 0, 0);

    this.track.reset();
    this.clearParticles();

    this.notifyUI(true);
  }

  // --- CONTROLS ---

  public moveLeft() {
    if (this.status !== 'playing') return;
    if (this.currentLane > -1) {
      this.currentLane = (this.currentLane - 1) as Lane;
      this.targetLaneX = LANES[this.currentLane + 1];
      soundManager.playLaneSwitch();
    }
  }

  public moveRight() {
    if (this.status !== 'playing') return;
    if (this.currentLane < 1) {
      this.currentLane = (this.currentLane + 1) as Lane;
      this.targetLaneX = LANES[this.currentLane + 1];
      soundManager.playLaneSwitch();
    }
  }

  public jump() {
    if (this.status !== 'playing') return;
    const hasJetpack = this.activePowerups.has('jetpack');
    if (hasJetpack) return;

    if (this.isGrounded || this.playerY <= this.groundY + 0.3) {
      const isSuperSneakers = this.activePowerups.has('super_sneakers');
      const force = isSuperSneakers ? this.jumpForce * 1.35 : this.jumpForce;
      this.velocityY = force;
      this.isGrounded = false;
      this.isSliding = false;
      this.robot.updateAnimation(0, false, true, false, this.currentSpeed);
      soundManager.playJump();
      this.spawnJumpBurst();
    }
  }

  public slide() {
    if (this.status !== 'playing') return;
    const hasJetpack = this.activePowerups.has('jetpack');
    if (hasJetpack) return;

    this.isSliding = true;
    this.slideTimer = this.slideDuration;
    soundManager.playSlide();

    if (!this.isGrounded) {
      this.velocityY = -28;
    }
  }

  public activateHoverboard() {
    if (this.status !== 'playing') return;
    if (this.activePowerups.has('hoverboard')) return;

    this.activePowerups.set('hoverboard', { duration: 15, timeLeft: 15 });
    this.robot.setHoverboard(true);
    soundManager.playHoverboardDeploy();
    this.cameraShake = 0.3;
    this.notifyPowerups();
  }

  // --- ZERO-ALLOCATION PARTICLE POOL METHODS ---

  private spawnJumpBurst() {
    let spawned = 0;
    for (let i = 0; i < this.particlePool.length && spawned < 6; i++) {
      const p = this.particlePool[i];
      if (!p.active) {
        p.active = true;
        p.life = 0.32;
        p.maxLife = 0.32;
        p.mesh.material = this.cyanParticleMat;
        p.mesh.position.set(
          this.playerX + (Math.random() - 0.5) * 0.4,
          this.playerY + 0.1,
          this.playerZ + 0.2
        );
        p.mesh.scale.set(1, 1, 1);
        p.mesh.visible = true;
        p.velX = (Math.random() - 0.5) * 2;
        p.velY = -Math.random() * 4 - 2;
        p.velZ = Math.random() * 3 + 2;
        p.isGravity = false;
        spawned++;
      }
    }
  }

  private spawnSlideSparks() {
    let spawned = 0;
    for (let i = 0; i < this.particlePool.length && spawned < 2; i++) {
      const p = this.particlePool[i];
      if (!p.active) {
        p.active = true;
        p.life = 0.22;
        p.maxLife = 0.22;
        p.mesh.material = this.sparkMat;
        p.mesh.position.set(
          this.playerX + (Math.random() - 0.5) * 0.5,
          this.playerY + 0.05,
          this.playerZ - 0.2
        );
        p.mesh.scale.set(1, 1, 1);
        p.mesh.visible = true;
        p.velX = (Math.random() - 0.5) * 4;
        p.velY = Math.random() * 2.5 + 1;
        p.velZ = Math.random() * 4 + 3;
        p.isGravity = true;
        spawned++;
      }
    }
  }

  private spawnCoinBurst(pos: THREE.Vector3) {
    let spawned = 0;
    for (let i = 0; i < this.particlePool.length && spawned < 5; i++) {
      const p = this.particlePool[i];
      if (!p.active) {
        p.active = true;
        p.life = 0.35;
        p.maxLife = 0.35;
        p.mesh.material = this.sparkMat;
        p.mesh.position.copy(pos);
        p.mesh.scale.set(1, 1, 1);
        p.mesh.visible = true;
        p.velX = (Math.random() - 0.5) * 5;
        p.velY = Math.random() * 4 + 2;
        p.velZ = (Math.random() - 0.5) * 5;
        p.isGravity = true;
        spawned++;
      }
    }
  }

  private updateParticles(dt: number) {
    for (let i = 0; i < this.particlePool.length; i++) {
      const p = this.particlePool[i];
      if (!p.active) continue;

      p.life -= dt;
      if (p.isGravity) {
        p.velY += this.gravity * 0.4 * dt;
      }

      p.mesh.position.x += p.velX * dt;
      p.mesh.position.y += p.velY * dt;
      p.mesh.position.z += p.velZ * dt;

      const scale = p.life / p.maxLife;
      p.mesh.scale.set(scale, scale, scale);

      if (p.life <= 0) {
        p.active = false;
        p.mesh.visible = false;
      }
    }
  }

  private clearParticles() {
    for (let i = 0; i < this.particlePool.length; i++) {
      this.particlePool[i].active = false;
      this.particlePool[i].mesh.visible = false;
    }
  }

  // --- GAME UPDATE TICK ---

  private update(dt: number) {
    if (this.status !== 'playing') {
      this.robot.updateAnimation(dt, false, false, false, 0);
      return;
    }

    // 1. Dynamic Speed & Distance Progression
    this.distance += this.currentSpeed * dt;
    this.score += Math.round(this.currentSpeed * dt * 2 * this.scoreMultiplier);
    this.playerZ -= this.currentSpeed * dt;

    this.currentSpeed = Math.min(52, this.baseSpeed + (this.distance / 200) * 1.5);

    // 2. Powerups Timers
    let hasJetpack = false;
    let hasMagnet = false;
    let hasHoverboard = false;
    let powerupsChanged = false;

    this.activePowerups.forEach((state, type) => {
      state.timeLeft -= dt;
      if (state.timeLeft <= 0) {
        this.activePowerups.delete(type);
        if (type === 'hoverboard') this.robot.setHoverboard(false);
        powerupsChanged = true;
      } else {
        if (type === 'jetpack') hasJetpack = true;
        if (type === 'magnet') hasMagnet = true;
        if (type === 'hoverboard') hasHoverboard = true;
      }
    });

    if (powerupsChanged || this.activePowerups.size > 0) {
      this.notifyPowerups();
    }

    this.scoreMultiplier = this.activePowerups.has('multiplier') ? 2 : 1;

    // 3. Invulnerability Flash Timer
    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer -= dt;
      this.robot.group.visible = Math.floor(Date.now() / 60) % 2 === 0;
    } else {
      this.robot.group.visible = true;
    }

    // 4. Lateral Lane Movement (Smooth damping)
    this.playerX = THREE.MathUtils.damp(this.playerX, this.targetLaneX, 15, dt);

    const laneDelta = this.targetLaneX - this.playerX;
    this.robot.group.rotation.z = THREE.MathUtils.damp(
      this.robot.group.rotation.z,
      -laneDelta * 0.12,
      12,
      dt
    );

    // 5. Vertical Physics & Platforming Ground Detection
    if (hasJetpack) {
      this.groundY = 8.5;
      this.playerY = THREE.MathUtils.damp(this.playerY, 8.5, 6, dt);
      this.velocityY = 0;
      this.isGrounded = false;
      this.spawnJumpBurst();
    } else {
      let detectedGround = 0;

      for (let i = 0; i < this.track.obstacles.length; i++) {
        const obs = this.track.obstacles[i];
        const xDist = Math.abs(this.playerX - LANES[obs.lane + 1]);
        const zDist = obs.z - this.playerZ;

        if (xDist < 1.3 && Math.abs(zDist) < obs.depth / 2 + 0.5) {
          if (obs.type === 'train_static' || obs.type === 'train_moving') {
            if (this.playerY >= 2.0) {
              detectedGround = Math.max(detectedGround, 2.4);
            }
          } else if (obs.type === 'ramp') {
            const progress = THREE.MathUtils.clamp((obs.depth / 2 - zDist) / obs.depth, 0, 1);
            detectedGround = Math.max(detectedGround, progress * 2.4);
          }
        }
      }

      this.groundY = detectedGround;

      this.velocityY += this.gravity * dt;
      this.playerY += this.velocityY * dt;

      if (this.playerY <= this.groundY) {
        this.playerY = this.groundY;
        this.velocityY = 0;
        this.isGrounded = true;
      } else {
        this.isGrounded = false;
      }
    }

    // 6. Slide Timer
    if (this.isSliding) {
      this.slideTimer -= dt;
      this.spawnSlideSparks();
      if (this.slideTimer <= 0) {
        this.isSliding = false;
      }
    }

    // 7. Update Robot Position & Kinematics
    this.robot.group.position.set(this.playerX, this.playerY, this.playerZ);
    this.robot.updateAnimation(
      dt,
      true,
      !this.isGrounded && !hasJetpack,
      this.isSliding,
      this.currentSpeed
    );

    // 8. Track Generation & Objects Update
    this.track.generateNextChunk(this.playerZ);
    this.track.update(dt, this.playerZ, hasMagnet, this.robot.group.position);

    // 9. Collisions: Coins & Powerups
    this.checkCollectibleCollisions();

    // 10. Collisions: Obstacles (Zero GC calculation)
    if (this.invulnerableTimer <= 0) {
      this.checkObstacleCollisions(hasHoverboard);
    }

    // 11. Update Particles
    this.updateParticles(dt);

    // 12. Camera Tracking
    this.updateCamera(dt, hasJetpack);

    // 13. UI Notification (Throttled for 60 FPS performance)
    this.notifyUI();
  }

  private checkCollectibleCollisions() {
    const playerPos = this.robot.group.position;

    // Coins check
    for (let i = 0; i < this.track.coins.length; i++) {
      const c = this.track.coins[i];
      if (c.collected) continue;
      const d = c.mesh.position.distanceTo(playerPos);
      if (d < 1.35) {
        c.collected = true;
        this.coins++;
        this.totalCoins++;
        this.score += 25 * this.scoreMultiplier;
        soundManager.playCoin();
        this.spawnCoinBurst(c.mesh.position);
      }
    }

    // Powerups check
    for (let i = 0; i < this.track.powerups.length; i++) {
      const p = this.track.powerups[i];
      if (p.collected) continue;
      const d = p.mesh.position.distanceTo(playerPos);
      if (d < 1.6) {
        p.collected = true;
        this.activatePowerup(p.type);
        soundManager.playPowerup();
        this.spawnCoinBurst(p.mesh.position);
      }
    }
  }

  private activatePowerup(type: PowerupType) {
    const duration = type === 'jetpack' ? 9 : type === 'hoverboard' ? 15 : 12;
    this.activePowerups.set(type, { duration, timeLeft: duration });
    if (type === 'hoverboard') {
      this.robot.setHoverboard(true);
    }
    this.notifyPowerups();
  }

  private checkObstacleCollisions(hasHoverboard: boolean) {
    // Reusing preallocated vectors to eliminate GC in collision check
    const pHeight = this.isSliding ? 0.65 : 1.7;
    const pCenterY = this.playerY + pHeight / 2;

    _playerCenter.set(this.playerX, pCenterY, this.playerZ);
    _playerBoxSize.set(1.05, pHeight, 0.85);
    _playerBox.setFromCenterAndSize(_playerCenter, _playerBoxSize);

    for (let i = 0; i < this.track.obstacles.length; i++) {
      const obs = this.track.obstacles[i];
      const obsX = LANES[obs.lane + 1];

      if (obs.type === 'low_barrier') {
        _obsCenter.set(obsX, 0.45, obs.z);
        _obsSize.set(obs.width, 0.9, obs.depth);
        _obsBox.setFromCenterAndSize(_obsCenter, _obsSize);
      } else if (obs.type === 'high_barrier') {
        _obsCenter.set(obsX, 1.9, obs.z);
        _obsSize.set(obs.width, 1.5, obs.depth);
        _obsBox.setFromCenterAndSize(_obsCenter, _obsSize);
      } else if (obs.type === 'train_static' || obs.type === 'train_moving') {
        if (this.playerY < 2.0) {
          _obsCenter.set(obsX, obs.height / 2, obs.z);
          _obsSize.set(obs.width * 0.9, obs.height, obs.depth);
          _obsBox.setFromCenterAndSize(_obsCenter, _obsSize);
        } else {
          continue;
        }
      } else if (obs.type === 'tall_column') {
        _obsCenter.set(obsX, obs.height / 2, obs.z);
        _obsSize.set(obs.width, obs.height, obs.depth);
        _obsBox.setFromCenterAndSize(_obsCenter, _obsSize);
      } else {
        continue;
      }

      if (_playerBox.intersectsBox(_obsBox)) {
        if (hasHoverboard) {
          this.activePowerups.delete('hoverboard');
          this.robot.setHoverboard(false);
          this.invulnerableTimer = 1.8;
          this.cameraShake = 0.5;
          soundManager.playCrash();
          this.spawnCoinBurst(this.robot.group.position);
          this.notifyPowerups();
          break;
        } else {
          this.handleGameOver();
          break;
        }
      }
    }
  }

  private handleGameOver() {
    this.status = 'gameover';
    soundManager.stopMusic();
    soundManager.playCrash();
    this.cameraShake = 0.8;
    this.robot.setExpression('crash');

    const finalStats: GameStats = {
      score: this.score,
      highScore: 0,
      coins: this.coins,
      totalCoins: this.totalCoins,
      distance: Math.round(this.distance),
      speed: Math.round(this.currentSpeed),
    };

    this.callbacks.onGameOver(finalStats);
  }

  private updateCamera(dt: number, hasJetpack: boolean) {
    const targetCamX = this.playerX * 0.45;
    const targetCamY = (hasJetpack ? 11 : this.playerY) + this.cameraOffset.y;
    const targetCamZ = this.playerZ + this.cameraOffset.z;

    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, targetCamX, 12, dt);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, targetCamY, 10, dt);
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, targetCamZ, 14, dt);

    if (this.cameraShake > 0) {
      this.camera.position.x += (Math.random() - 0.5) * this.cameraShake;
      this.camera.position.y += (Math.random() - 0.5) * this.cameraShake;
      this.cameraShake = Math.max(0, this.cameraShake - dt * 2.0);
    }

    const targetFov = hasJetpack ? 78 : THREE.MathUtils.lerp(65, 78, (this.currentSpeed - 24) / 30);
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 5, dt);
    this.camera.updateProjectionMatrix();

    _camTarget.set(
      this.playerX * 0.3,
      this.playerY + this.cameraLookOffset.y,
      this.playerZ + this.cameraLookOffset.z
    );
    this.camera.lookAt(_camTarget);
  }

  private notifyUI(force: boolean = false) {
    const now = performance.now();
    // Throttle React state updates to ~12 updates per second to avoid React 19 reconciliation overhead on mobile
    if (!force && now - this.lastUiNotifyTime < 80) return;
    this.lastUiNotifyTime = now;

    this.callbacks.onStatsUpdate({
      score: this.score,
      highScore: 0,
      coins: this.coins,
      totalCoins: this.totalCoins,
      distance: Math.round(this.distance),
      speed: Math.round(this.currentSpeed),
    });
  }

  private notifyPowerups() {
    const states: PowerupState[] = [];
    this.activePowerups.forEach((val, type) => {
      states.push({ type, duration: val.duration, timeLeft: val.timeLeft });
    });
    this.callbacks.onPowerupsUpdate(states);
  }

  // --- RENDER LOOP & DYNAMIC PERFORMANCE SCALING ---

  private startLoop() {
    let lastTime = performance.now();

    const tick = (now: number) => {
      if (this.isDestroyed) return;

      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      // Clamp dt to 50ms maximum so sudden lag or backgrounding never causes physics tunnel clipping
      const dt = Math.min(rawDt, 0.05);

      // Adaptive FPS Monitoring
      this.frameCount++;
      this.fpsAccumulator += rawDt;

      if (this.frameCount >= 60) {
        const avgFps = 60 / this.fpsAccumulator;
        this.frameCount = 0;
        this.fpsAccumulator = 0;

        // Graceful Dynamic Quality Scaling on low-end mobile devices
        if (avgFps < 45) {
          this.lowFpsCounter++;
          if (this.lowFpsCounter >= 2 && this.currentDpr > 0.85) {
            this.currentDpr = Math.max(0.85, this.currentDpr - 0.15);
            this.renderer.setPixelRatio(this.currentDpr);
            // Disable shadow mapping if device struggles
            if (this.renderer.shadowMap.enabled && this.isMobile) {
              this.renderer.shadowMap.enabled = false;
              if (this.dirLight) this.dirLight.castShadow = false;
            }
          }
        } else {
          this.lowFpsCounter = 0;
        }
      }

      this.update(dt);
      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    this.frameId = requestAnimationFrame(tick);
  }

  private afterDraw(cb: (t: number) => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.isDestroyed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(() => cb(performance.now()), 70);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  public dispose() {
    this.isDestroyed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);

    soundManager.stopMusic();
    this.robot.dispose();
    this.track.dispose();
    this.clearParticles();
    this.particleGeo.dispose();
    this.sparkMat.dispose();
    this.cyanParticleMat.dispose();
    this.renderer.dispose();

    if (this.container && this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
