import * as THREE from 'three';
import { PlayerCustomization } from '../types/game';

export interface ColorSchemeConfig {
  primary: number;       // Main body (usually white/bright)
  accent: number;        // Colored trims (blue, magenta, etc.)
  neon: number;          // Emissive glow color
  visorBg: number;       // Dark visor background
}

export const COLOR_SCHEMES: Record<string, ColorSchemeConfig> = {
  original_blue: {
    primary: 0xf3f6fa,
    accent: 0x0284c7,
    neon: 0x00d2ff,
    visorBg: 0x070b14,
  },
  cyber_cyan: {
    primary: 0xecfeff,
    accent: 0x06b6d4,
    neon: 0x22d3ee,
    visorBg: 0x041318,
  },
  synth_magenta: {
    primary: 0xfdf2f8,
    accent: 0xdb2777,
    neon: 0xf472b6,
    visorBg: 0x180411,
  },
  matrix_green: {
    primary: 0xf0fdf4,
    accent: 0x16a34a,
    neon: 0x4ade80,
    visorBg: 0x031508,
  },
  solar_gold: {
    primary: 0xfffbeb,
    accent: 0xd97706,
    neon: 0xfbbf24,
    visorBg: 0x1a1202,
  },
};

export class RobotModel {
  public group: THREE.Group;
  public hoverboardGroup: THREE.Group;

  // Hierarchical body parts for kinematics
  private headGroup: THREE.Group;
  private torsoGroup: THREE.Group;
  private leftArmGroup: THREE.Group;
  private rightArmGroup: THREE.Group;
  private leftLegGroup: THREE.Group;
  private rightLegGroup: THREE.Group;
  private leftBoots: THREE.Mesh;
  private rightBoots: THREE.Mesh;
  private antennaLight: THREE.PointLight;
  private chestCoreMesh: THREE.Mesh;

  // Face Visor Canvas
  private faceCanvas: HTMLCanvasElement;
  private faceCtx: CanvasRenderingContext2D;
  private faceTexture: THREE.CanvasTexture;
  private blinkTimer: number = 0;
  private isBlinking: boolean = false;
  private expression: 'happy' | 'excited' | 'jump' | 'slide' | 'crash' = 'happy';

  // Materials for skinning
  private whiteChassisMat: THREE.MeshPhysicalMaterial;
  private accentMat: THREE.MeshStandardMaterial;
  private neonMat: THREE.MeshStandardMaterial;
  private darkMat: THREE.MeshStandardMaterial;
  private boardMat: THREE.MeshStandardMaterial;
  private boardNeonMat: THREE.MeshStandardMaterial;

  // Animation states
  private runCycleTime: number = 0;
  private isHoverboardActive: boolean = false;

  constructor(customization: PlayerCustomization = { colorScheme: 'original_blue', boardSkin: 'neon_stream' }) {
    this.group = new THREE.Group();

    // 1. Visor Screen Setup (Procedural 2D Canvas)
    this.faceCanvas = document.createElement('canvas');
    this.faceCanvas.width = 256;
    this.faceCanvas.height = 256;
    this.faceCtx = this.faceCanvas.getContext('2d')!;
    this.faceTexture = new THREE.CanvasTexture(this.faceCanvas);
    this.faceTexture.colorSpace = THREE.SRGBColorSpace;

    // 2. Materials Setup
    const theme = COLOR_SCHEMES[customization.colorScheme] || COLOR_SCHEMES.original_blue;

    this.whiteChassisMat = new THREE.MeshPhysicalMaterial({
      color: theme.primary,
      roughness: 0.18,
      metalness: 0.15,
      clearcoat: 0.9,
      clearcoatRoughness: 0.1,
    });

    this.accentMat = new THREE.MeshStandardMaterial({
      color: theme.accent,
      roughness: 0.25,
      metalness: 0.5,
    });

    this.neonMat = new THREE.MeshStandardMaterial({
      color: theme.neon,
      emissive: theme.neon,
      emissiveIntensity: 2.2,
      roughness: 0.1,
    });

    this.darkMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.5,
      metalness: 0.8,
    });

    this.boardMat = new THREE.MeshPhysicalMaterial({
      color: 0x0f172a,
      roughness: 0.2,
      metalness: 0.8,
      clearcoat: 1.0,
    });

    this.boardNeonMat = new THREE.MeshStandardMaterial({
      color: theme.neon,
      emissive: theme.neon,
      emissiveIntensity: 3.0,
    });

    // 3. Assemble Hierarchical Parts
    this.headGroup = new THREE.Group();
    this.torsoGroup = new THREE.Group();
    this.leftArmGroup = new THREE.Group();
    this.rightArmGroup = new THREE.Group();
    this.leftLegGroup = new THREE.Group();
    this.rightLegGroup = new THREE.Group();
    this.hoverboardGroup = new THREE.Group();

    // Attach to group
    this.group.add(this.torsoGroup);
    this.torsoGroup.add(this.headGroup);
    this.torsoGroup.add(this.leftArmGroup);
    this.torsoGroup.add(this.rightArmGroup);
    this.group.add(this.leftLegGroup);
    this.group.add(this.rightLegGroup);
    this.group.add(this.hoverboardGroup);

    // Build the 3D geometry matching the image
    const { leftBoot, rightBoot, chestCore, light } = this.buildCharacterParts();
    this.leftBoots = leftBoot;
    this.rightBoots = rightBoot;
    this.chestCoreMesh = chestCore;
    this.antennaLight = light;

    // Hoverboard hidden by default
    this.buildHoverboard();
    this.hoverboardGroup.visible = false;

    // Initial face render
    this.updateFace(0);

    // Shadow flags
    this.group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });

    // Pivot robot at bottom-center so position.y=0 is grounded
    this.group.position.set(0, 0, 0);
  }

  private buildCharacterParts() {
    // --- TORSO ---
    // Torso position (Y center ~ 0.85)
    this.torsoGroup.position.set(0, 0.72, 0);

    // Main torso shell (rounded chamfered body)
    const torsoGeo = new THREE.CylinderGeometry(0.3, 0.24, 0.46, 24);
    const torsoMesh = new THREE.Mesh(torsoGeo, this.whiteChassisMat);
    torsoMesh.position.y = 0.23;
    torsoMesh.scale.set(1.1, 1, 0.85);
    this.torsoGroup.add(torsoMesh);

    // Chest blue collar / shoulder rings
    const shoulderGeo = new THREE.TorusGeometry(0.32, 0.04, 12, 24);
    shoulderGeo.rotateX(Math.PI / 2);
    const shoulderTrim = new THREE.Mesh(shoulderGeo, this.accentMat);
    shoulderTrim.position.y = 0.44;
    this.torsoGroup.add(shoulderTrim);

    // Blue belt / waist ring
    const beltGeo = new THREE.CylinderGeometry(0.25, 0.26, 0.07, 24);
    const beltMesh = new THREE.Mesh(beltGeo, this.accentMat);
    beltMesh.position.y = 0.04;
    this.torsoGroup.add(beltMesh);

    // Arc Reactor / Chest Core (Circular glowing blue device in center)
    const chestCoreGroup = new THREE.Group();
    chestCoreGroup.position.set(0, 0.26, 0.27);
    
    // Outer blue rim
    const coreRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.1, 0.022, 12, 24),
      this.accentMat
    );
    // Glowing neon center
    const coreGlow = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 0.02, 24),
      this.neonMat
    );
    coreGlow.rotateX(Math.PI / 2);
    // Inner bright dot
    const coreDot = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 12, 12),
      this.neonMat
    );
    coreDot.position.z = 0.02;

    chestCoreGroup.add(coreRim, coreGlow, coreDot);
    this.torsoGroup.add(chestCoreGroup);

    // Backpack / Thruster nozzles for jumping
    const packMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.3, 0.14),
      this.accentMat
    );
    packMesh.position.set(0, 0.25, -0.24);
    const jetNozzleL = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.07, 0.12, 12),
      this.darkMat
    );
    jetNozzleL.position.set(-0.1, 0.12, -0.27);
    const jetNozzleR = jetNozzleL.clone();
    jetNozzleR.position.x = 0.1;

    // Glowing thruster interior
    const thrusterGlowL = new THREE.Mesh(
      new THREE.CircleGeometry(0.06, 16),
      this.neonMat
    );
    thrusterGlowL.position.set(-0.1, 0.06, -0.27);
    thrusterGlowL.rotateX(Math.PI / 2);
    const thrusterGlowR = thrusterGlowL.clone();
    thrusterGlowR.position.x = 0.1;

    this.torsoGroup.add(packMesh, jetNozzleL, jetNozzleR, thrusterGlowL, thrusterGlowR);

    // --- HEAD ---
    // Head pivot at neck (Y = 0.48 above torso)
    this.headGroup.position.set(0, 0.48, 0);

    // Dark neck ring
    const neckMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.14, 0.08, 16),
      this.darkMat
    );
    neckMesh.position.y = 0.04;
    this.headGroup.add(neckMesh);

    // Outer helmet: cute rounded sphere/capsule shell
    const helmetGeo = new THREE.SphereGeometry(0.42, 32, 24);
    helmetGeo.scale(1.15, 0.95, 1.05);
    const helmetMesh = new THREE.Mesh(helmetGeo, this.whiteChassisMat);
    helmetMesh.position.y = 0.38;
    this.headGroup.add(helmetMesh);

    // Visor faceplate (front of head)
    const visorGeo = new THREE.SphereGeometry(0.39, 32, 16, 0, Math.PI, 0, Math.PI);
    visorGeo.scale(1.08, 0.88, 1.0);
    visorGeo.rotateY(-Math.PI / 2);

    const visorMat = new THREE.MeshStandardMaterial({
      map: this.faceTexture,
      roughness: 0.1,
      metalness: 0.4,
    });
    const visorMesh = new THREE.Mesh(visorGeo, visorMat);
    visorMesh.position.set(0, 0.38, 0.08);
    this.headGroup.add(visorMesh);

    // Ear cups / Headphones (Left and Right)
    const earCupGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.12, 24);
    earCupGeo.rotateZ(Math.PI / 2);

    const leftEar = new THREE.Mesh(earCupGeo, this.whiteChassisMat);
    leftEar.position.set(-0.5, 0.38, 0);
    const leftEarRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.11, 0.02, 12, 24),
      this.neonMat
    );
    leftEarRing.rotateY(Math.PI / 2);
    leftEarRing.position.set(-0.56, 0.38, 0);
    this.headGroup.add(leftEar, leftEarRing);

    const rightEar = new THREE.Mesh(earCupGeo, this.whiteChassisMat);
    rightEar.position.set(0.5, 0.38, 0);
    const rightEarRing = leftEarRing.clone();
    rightEarRing.position.x = 0.56;
    this.headGroup.add(rightEar, rightEarRing);

    // Top Antenna
    const antennaStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.025, 0.16, 12),
      this.darkMat
    );
    antennaStem.position.set(0, 0.83, 0);

    const antennaBulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.065, 16, 16),
      this.neonMat
    );
    antennaBulb.position.set(0, 0.94, 0);

    const antennaLight = new THREE.PointLight(this.neonMat.color, 0.8, 2.5);
    antennaLight.position.set(0, 0.94, 0);

    this.headGroup.add(antennaStem, antennaBulb, antennaLight);

    // --- ARMS ---
    // Left Arm
    this.leftArmGroup.position.set(-0.4, 0.36, 0);
    const leftShoulder = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 16), this.whiteChassisMat);
    const leftUpperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.06, 0.2, 16), this.whiteChassisMat);
    leftUpperArm.position.y = -0.1;
    const leftElbow = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.015, 12, 16), this.accentMat);
    leftElbow.rotateX(Math.PI / 2);
    leftElbow.position.y = -0.2;
    const leftForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.18, 16), this.whiteChassisMat);
    leftForearm.position.y = -0.3;
    const leftHand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 14), this.darkMat);
    leftHand.position.y = -0.42;
    this.leftArmGroup.add(leftShoulder, leftUpperArm, leftElbow, leftForearm, leftHand);

    // Right Arm
    this.rightArmGroup.position.set(0.4, 0.36, 0);
    const rightShoulder = leftShoulder.clone();
    const rightUpperArm = leftUpperArm.clone();
    const rightElbow = leftElbow.clone();
    const rightForearm = leftForearm.clone();
    const rightHand = leftHand.clone();
    this.rightArmGroup.add(rightShoulder, rightUpperArm, rightElbow, rightForearm, rightHand);

    // --- LEGS ---
    // Left Leg
    this.leftLegGroup.position.set(-0.18, 0.72, 0);
    const leftThigh = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.28, 16), this.whiteChassisMat);
    leftThigh.position.y = -0.16;
    const leftKnee = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.02, 12, 16), this.accentMat);
    leftKnee.rotateX(Math.PI / 2);
    leftKnee.position.y = -0.32;
    const leftShin = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.26, 16), this.whiteChassisMat);
    leftShin.position.y = -0.46;

    // Left Boot (chunky white with blue glowing neon sole)
    const bootGeo = new THREE.BoxGeometry(0.2, 0.16, 0.34);
    const leftBootMesh = new THREE.Mesh(bootGeo, this.whiteChassisMat);
    leftBootMesh.position.set(0, -0.63, 0.05);

    const bootSoleGeo = new THREE.BoxGeometry(0.21, 0.04, 0.35);
    const leftSole = new THREE.Mesh(bootSoleGeo, this.neonMat);
    leftSole.position.set(0, -0.71, 0.05);

    this.leftLegGroup.add(leftThigh, leftKnee, leftShin, leftBootMesh, leftSole);

    // Right Leg
    this.rightLegGroup.position.set(0.18, 0.72, 0);
    const rightThigh = leftThigh.clone();
    const rightKnee = leftKnee.clone();
    const rightShin = leftShin.clone();
    const rightBootMesh = leftBootMesh.clone();
    const rightSole = leftSole.clone();

    this.rightLegGroup.add(rightThigh, rightKnee, rightShin, rightBootMesh, rightSole);

    return {
      leftBoot: leftBootMesh,
      rightBoot: rightBootMesh,
      chestCore: coreDot,
      light: antennaLight,
    };
  }

  private buildHoverboard() {
    // Sleek aerodynamic surfboard design
    const boardShape = new THREE.Shape();
    boardShape.moveTo(0, 0.7);
    boardShape.quadraticCurveTo(0.35, 0.4, 0.35, -0.6);
    boardShape.quadraticCurveTo(0.2, -0.8, 0, -0.85);
    boardShape.quadraticCurveTo(-0.2, -0.8, -0.35, -0.6);
    boardShape.quadraticCurveTo(-0.35, 0.4, 0, 0.7);

    const extrudeSettings = {
      depth: 0.08,
      bevelEnabled: true,
      bevelSegments: 4,
      steps: 1,
      bevelSize: 0.04,
      bevelThickness: 0.04,
    };

    const boardGeo = new THREE.ExtrudeGeometry(boardShape, extrudeSettings);
    boardGeo.rotateX(Math.PI / 2);
    boardGeo.scale(1.2, 1, 1.2);

    const boardMesh = new THREE.Mesh(boardGeo, this.boardMat);
    boardMesh.position.y = 0.05;
    this.hoverboardGroup.add(boardMesh);

    // Glowing Neon Edge Strip
    const stripGeo = new THREE.TorusGeometry(0.38, 0.02, 8, 32);
    stripGeo.scale(0.8, 1.9, 1);
    stripGeo.rotateX(Math.PI / 2);
    const stripMesh = new THREE.Mesh(stripGeo, this.boardNeonMat);
    stripMesh.position.y = 0.07;
    this.hoverboardGroup.add(stripMesh);

    // Rear Dual Neon Jets
    const jetGeo = new THREE.CylinderGeometry(0.08, 0.06, 0.25, 16);
    jetGeo.rotateX(Math.PI / 2);
    const jetL = new THREE.Mesh(jetGeo, this.darkMat);
    jetL.position.set(-0.22, 0.05, -0.7);
    const jetR = jetL.clone();
    jetR.position.x = 0.22;

    const jetFlameL = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.4, 12), this.boardNeonMat);
    jetFlameL.rotateX(-Math.PI / 2);
    jetFlameL.position.set(-0.22, 0.05, -0.95);
    const jetFlameR = jetFlameL.clone();
    jetFlameR.position.x = 0.22;

    this.hoverboardGroup.add(jetL, jetR, jetFlameL, jetFlameR);
  }

  public setCustomization(customization: PlayerCustomization) {
    const theme = COLOR_SCHEMES[customization.colorScheme] || COLOR_SCHEMES.original_blue;
    this.whiteChassisMat.color.set(theme.primary);
    this.accentMat.color.set(theme.accent);
    this.neonMat.color.set(theme.neon);
    this.neonMat.emissive.set(theme.neon);
    this.boardNeonMat.color.set(theme.neon);
    this.boardNeonMat.emissive.set(theme.neon);
    this.antennaLight.color.set(theme.neon);
    this.drawFace();
  }

  public setHoverboard(active: boolean) {
    this.isHoverboardActive = active;
    this.hoverboardGroup.visible = active;
  }

  public setExpression(exp: 'happy' | 'excited' | 'jump' | 'slide' | 'crash') {
    if (this.expression !== exp) {
      this.expression = exp;
      this.drawFace();
    }
  }

  private drawFace() {
    const ctx = this.faceCtx;
    const w = 256;
    const h = 256;

    // Dark sleek glossy background
    ctx.fillStyle = '#060b14';
    ctx.fillRect(0, 0, w, h);

    // Eye glow styling
    const glowColor = '#' + this.neonMat.color.getHexString();
    ctx.shadowBlur = 18;
    ctx.shadowColor = glowColor;
    ctx.fillStyle = glowColor;

    if (this.isBlinking && this.expression !== 'crash') {
      // Blinking: horizontal neon slit lines
      ctx.lineWidth = 6;
      ctx.strokeStyle = glowColor;
      ctx.beginPath();
      ctx.moveTo(65, 115);
      ctx.lineTo(105, 115);
      ctx.moveTo(151, 115);
      ctx.lineTo(191, 115);
      ctx.stroke();
    } else if (this.expression === 'crash') {
      // Dizzy X-eyes
      ctx.lineWidth = 7;
      ctx.strokeStyle = '#ef4444';
      ctx.shadowColor = '#ef4444';
      // Left X
      ctx.beginPath();
      ctx.moveTo(65, 95); ctx.lineTo(105, 135);
      ctx.moveTo(105, 95); ctx.lineTo(65, 135);
      ctx.stroke();
      // Right X
      ctx.beginPath();
      ctx.moveTo(151, 95); ctx.lineTo(191, 135);
      ctx.moveTo(191, 95); ctx.lineTo(151, 135);
      ctx.stroke();
      // O-mouth
      ctx.strokeStyle = '#ef4444';
      ctx.beginPath();
      ctx.ellipse(128, 175, 14, 18, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // Big friendly oval eyes like in the photo!
      const eyeWidth = 26;
      const eyeHeight = 34;

      // Left Eye
      ctx.beginPath();
      ctx.ellipse(85, 112, eyeWidth, eyeHeight, 0, 0, Math.PI * 2);
      ctx.fill();

      // Right Eye
      ctx.beginPath();
      ctx.ellipse(171, 112, eyeWidth, eyeHeight, 0, 0, Math.PI * 2);
      ctx.fill();

      // Highlights / Reflections (White dots in upper right of eyes)
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(92, 102, 8, 0, Math.PI * 2);
      ctx.arc(178, 102, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(80, 122, 4, 0, Math.PI * 2);
      ctx.arc(166, 122, 4, 0, Math.PI * 2);
      ctx.fill();

      // Cute Smile mouth
      ctx.shadowBlur = 10;
      ctx.shadowColor = glowColor;
      ctx.fillStyle = glowColor;

      ctx.beginPath();
      ctx.arc(128, 155, 20, 0.15 * Math.PI, 0.85 * Math.PI, false);
      ctx.lineWidth = 5;
      ctx.strokeStyle = glowColor;
      ctx.stroke();

      // Pink tongue inside smile
      ctx.fillStyle = '#f43f5e';
      ctx.shadowColor = '#f43f5e';
      ctx.beginPath();
      ctx.arc(128, 166, 8, 0, Math.PI, false);
      ctx.fill();
    }

    this.faceTexture.needsUpdate = true;
  }

  private updateFace(dt: number) {
    this.blinkTimer += dt;
    if (this.blinkTimer > 3.2) {
      this.isBlinking = true;
      this.drawFace();
      if (this.blinkTimer > 3.4) {
        this.isBlinking = false;
        this.blinkTimer = 0;
        this.drawFace();
      }
    }
  }

  /**
   * Kinematic Animation Update
   * @param dt Delta time in seconds
   * @param isRunning True if moving forward
   * @param isJumping True if in air
   * @param isSliding True if ducking/sliding
   * @param speed Current run speed
   */
  public updateAnimation(
    dt: number,
    isRunning: boolean,
    isJumping: boolean,
    isSliding: boolean,
    speed: number = 24
  ) {
    this.updateFace(dt);

    // Pulse chest core emissive
    const pulse = 1.8 + Math.sin(Date.now() * 0.005) * 0.6;
    this.neonMat.emissiveIntensity = pulse;

    // Reset base rotations for blending
    if (isSliding) {
      // Sliding pose: lean low, crouch, forward knees
      this.setExpression('slide');
      this.torsoGroup.position.y = 0.35;
      this.torsoGroup.rotation.x = 0.55;
      this.headGroup.rotation.x = -0.4;
      this.leftArmGroup.rotation.x = -1.2;
      this.rightArmGroup.rotation.x = -1.2;
      this.leftLegGroup.position.y = 0.35;
      this.rightLegGroup.position.y = 0.35;
      this.leftLegGroup.rotation.x = -1.3;
      this.rightLegGroup.rotation.x = -0.4;
      this.group.rotation.z = THREE.MathUtils.damp(this.group.rotation.z, 0, 10, dt);
      return;
    }

    if (isJumping) {
      // Jumping pose: arms raised high, legs tucked or extended
      this.setExpression('jump');
      this.torsoGroup.position.y = 0.72;
      this.torsoGroup.rotation.x = -0.15;
      this.headGroup.rotation.x = 0.2;
      this.leftArmGroup.rotation.x = -2.6;
      this.leftArmGroup.rotation.z = -0.5;
      this.rightArmGroup.rotation.x = -2.6;
      this.rightArmGroup.rotation.z = 0.5;
      this.leftLegGroup.position.y = 0.72;
      this.rightLegGroup.position.y = 0.72;
      this.leftLegGroup.rotation.x = 0.5;
      this.rightLegGroup.rotation.x = 0.3;
      return;
    }

    if (this.isHoverboardActive) {
      // Surfing pose: side angled, knees slightly bent, arms balancing
      this.setExpression('excited');
      this.torsoGroup.position.y = 0.76;
      this.torsoGroup.rotation.y = THREE.MathUtils.damp(this.torsoGroup.rotation.y, 0.45, 10, dt);
      this.torsoGroup.rotation.x = 0.05;
      this.headGroup.rotation.y = THREE.MathUtils.damp(this.headGroup.rotation.y, -0.45, 10, dt);
      this.leftArmGroup.rotation.x = -0.4;
      this.leftArmGroup.rotation.z = -0.8;
      this.rightArmGroup.rotation.x = 0.4;
      this.rightArmGroup.rotation.z = 0.8;
      this.leftLegGroup.rotation.x = -0.2;
      this.rightLegGroup.rotation.x = 0.2;
      this.hoverboardGroup.rotation.z = Math.sin(Date.now() * 0.008) * 0.1;
      this.hoverboardGroup.position.y = 0.05 + Math.sin(Date.now() * 0.006) * 0.03;
      return;
    }

    // Default Running Animation
    this.setExpression('happy');
    this.torsoGroup.position.y = 0.72;
    this.torsoGroup.rotation.set(0.08, 0, 0);
    this.headGroup.rotation.set(0, 0, 0);

    if (isRunning) {
      // Frequency scales with run speed
      const freq = speed * 0.45;
      this.runCycleTime += dt * freq;

      const legAngle = Math.sin(this.runCycleTime) * 0.75;
      const armAngle = -legAngle * 0.85;

      // Legs swing opposite
      this.leftLegGroup.rotation.x = legAngle;
      this.rightLegGroup.rotation.x = -legAngle;

      // Arms swing opposite to legs
      this.leftArmGroup.rotation.x = armAngle;
      this.leftArmGroup.rotation.z = -0.15;
      this.rightArmGroup.rotation.x = -armAngle;
      this.rightArmGroup.rotation.z = 0.15;

      // Subtle torso bob & head counter-bob
      this.torsoGroup.position.y = 0.72 + Math.abs(Math.sin(this.runCycleTime * 2)) * 0.06;
      this.headGroup.position.y = 0.48 - Math.abs(Math.sin(this.runCycleTime * 2)) * 0.02;
    } else {
      // Idle Animation: gentle breathing and waving
      const idleTime = Date.now() * 0.003;
      this.torsoGroup.position.y = 0.72 + Math.sin(idleTime) * 0.02;
      this.leftArmGroup.rotation.x = Math.sin(idleTime) * 0.1;
      this.leftArmGroup.rotation.z = -0.2;

      // Cute wave with right arm
      this.rightArmGroup.rotation.x = -2.2 + Math.sin(idleTime * 2) * 0.2;
      this.rightArmGroup.rotation.z = 0.8 + Math.cos(idleTime * 4) * 0.25;
      this.headGroup.rotation.z = Math.sin(idleTime) * 0.08;
      this.leftLegGroup.rotation.x = 0;
      this.rightLegGroup.rotation.x = 0;
    }
  }

  public dispose() {
    this.faceTexture.dispose();
    this.whiteChassisMat.dispose();
    this.accentMat.dispose();
    this.neonMat.dispose();
    this.darkMat.dispose();
    this.boardMat.dispose();
    this.boardNeonMat.dispose();
  }
}
