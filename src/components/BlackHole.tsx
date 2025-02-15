import { useRef, useMemo } from 'react';
import { useFrame, useThree, createPortal } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

// Import all shaders
import discVertexShader from '../shaders/disc/vertex.glsl';
import discFragmentShader from '../shaders/disc/fragment.glsl';
import noisesVertexShader from '../shaders/noises/vertex.glsl';
import noisesFragmentShader from '../shaders/noises/fragment.glsl';
import starsVertexShader from '../shaders/stars/vertex.glsl';
import starsFragmentShader from '../shaders/stars/fragment.glsl';
import distortionHoleVertexShader from '../shaders/distortionHole/vertex.glsl';
import distortionHoleFragmentShader from '../shaders/distortionHole/fragment.glsl';
import compositionVertexShader from '../shaders/composition/vertex.glsl';
import compositionFragmentShader from '../shaders/composition/fragment.glsl';
import distortionDiscVertexShader from '../shaders/distortionDisc/vertex.glsl';
import distortionDiscFragmentShader from '../shaders/distortionDisc/fragment.glsl';

const BlackHole = () => {
  const discRef = useRef<THREE.Mesh>();
  const cameraGroupRef = useRef<THREE.Group>();
  const { camera, gl, size } = useThree();

  // Create noises scene and render target
  const noises = useMemo(() => {
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 5;

    const renderTarget = new THREE.WebGLRenderTarget(256, 256, {
      generateMipmaps: false,
      type: THREE.FloatType,
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.RepeatWrapping
    });

    const material = new THREE.ShaderMaterial({
      vertexShader: noisesVertexShader,
      fragmentShader: noisesFragmentShader
    });

    return { scene, camera, renderTarget, material };
  }, []);

  // Create composition render targets and material
  const composition = useMemo(() => {
    const defaultRenderTarget = new THREE.WebGLRenderTarget(
      size.width * gl.getPixelRatio(),
      size.height * gl.getPixelRatio(),
      { generateMipmaps: false }
    );

    const distortionRenderTarget = new THREE.WebGLRenderTarget(
      size.width * gl.getPixelRatio(),
      size.height * gl.getPixelRatio(),
      {
        generateMipmaps: false,
        format: THREE.RedFormat
      }
    );

    const material = new THREE.ShaderMaterial({
      vertexShader: compositionVertexShader,
      fragmentShader: compositionFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uDefaultTexture: { value: defaultRenderTarget.texture },
        uDistortionTexture: { value: distortionRenderTarget.texture },
        uConvergencePosition: { value: new THREE.Vector2() }
      }
    });

    return { defaultRenderTarget, distortionRenderTarget, material };
  }, [size, gl]);

  // Create gradient texture
  const gradientTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 128;
    const context = canvas.getContext('2d');
    const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#fffbf9');
    gradient.addColorStop(0.1, '#ffbc68');
    gradient.addColorStop(0.2, '#ff5600');
    gradient.addColorStop(0.4, '#ff0053');
    gradient.addColorStop(0.8, '#cc00ff');
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    return new THREE.CanvasTexture(canvas);
  }, []);

  // Create disc material
  const discMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: discVertexShader,
      fragmentShader: discFragmentShader,
      transparent: true,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uGradientTexture: { value: gradientTexture },
        uNoisesTexture: { value: noises.renderTarget.texture }
      }
    });
  }, [gradientTexture, noises.renderTarget.texture]);

  // Create distortion materials
  const distortionMaterials = useMemo(() => {
    const holeMaterial = new THREE.ShaderMaterial({
      vertexShader: distortionHoleVertexShader,
      fragmentShader: distortionHoleFragmentShader
    });

    const discMaterial = new THREE.ShaderMaterial({
      vertexShader: distortionDiscVertexShader,
      fragmentShader: distortionDiscFragmentShader,
      transparent: true,
      side: THREE.DoubleSide
    });

    return { holeMaterial, discMaterial };
  }, []);

  // Animation
  useFrame((state) => {
    const time = state.clock.getElapsedTime();

    // Update materials
    if (discRef.current) {
      discRef.current.material.uniforms.uTime.value = time;
    }

    // Camera animation
    if (cameraGroupRef.current) {
      const cameraTime = time * 0.2;
      const shakeAmplitude = 0.1;
      
      cameraGroupRef.current.position.x = 
        shakeAmplitude * 
        Math.sin(cameraTime) * 
        Math.sin(cameraTime * 2.1) * 
        Math.sin(cameraTime * 4.3);
      
      cameraGroupRef.current.position.y = 
        shakeAmplitude * 
        Math.sin(cameraTime * 1.23) * 
        Math.sin(cameraTime * 4.56) * 
        Math.sin(cameraTime * 7.89);
      
      cameraGroupRef.current.position.z = 
        shakeAmplitude * 
        Math.sin(cameraTime * 3.45) * 
        Math.sin(cameraTime * 6.78) * 
        Math.sin(cameraTime * 9.01);
    }

    // Render noises
    gl.setRenderTarget(noises.renderTarget);
    gl.render(noises.scene, noises.camera);

    // Render main scene to default render target
    gl.setRenderTarget(composition.defaultRenderTarget);
    gl.setClearColor('#130e16');
    gl.render(state.scene, camera);

    // Update composition uniforms
    const screenPosition = new THREE.Vector3(0, 0, 0);
    screenPosition.project(camera);
    composition.material.uniforms.uConvergencePosition.value.set(
      screenPosition.x * 0.5 + 0.5,
      screenPosition.y * 0.5 + 0.5
    );
    composition.material.uniforms.uTime.value = time;

    // Reset render target
    gl.setRenderTarget(null);
  });

  return (
    <>
      {/* Noises scene */}
      {createPortal(
        <mesh material={noises.material}>
          <planeGeometry args={[2, 2]} />
        </mesh>,
        noises.scene
      )}

      {/* Main scene */}
      <group ref={cameraGroupRef}>
        <PerspectiveCamera makeDefault position={[0, 0.8, 10]} fov={35} />
      </group>

      <OrbitControls enableDamping dampingFactor={0.05} zoomSpeed={0.4} />

      {/* Black Hole Disc */}
      <mesh ref={discRef} material={discMaterial}>
        <cylinderGeometry args={[1.5, 6, 0, 64, 8, true]} />
      </mesh>

      {/* Distortion */}
      <mesh material={distortionMaterials.holeMaterial}>
        <planeGeometry args={[4, 4]} />
      </mesh>

      <mesh 
        material={distortionMaterials.discMaterial}
        rotation-x={-Math.PI * 0.5}
      >
        <planeGeometry args={[12, 12]} />
      </mesh>

      {/* Stars */}
      <Stars />

      {/* Composition */}
      <mesh material={composition.material}>
        <planeGeometry args={[2, 2]} />
      </mesh>
    </>
  );
};

const Stars = () => {
  const count = 10000;
  const positions = useMemo(() => {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = 2 * Math.PI * Math.random();
      const phi = Math.acos(2 * Math.random() - 1.0);
      const radius = 400;

      positions[i * 3] = Math.cos(theta) * Math.sin(phi) * radius;
      positions[i * 3 + 1] = Math.sin(theta) * Math.sin(phi) * radius;
      positions[i * 3 + 2] = Math.cos(phi) * radius;
    }
    return positions;
  }, []);

  const colors = useMemo(() => {
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const hue = Math.random() * 360;
      const lightness = 80 + Math.random() * 20;
      const color = new THREE.Color(`hsl(${hue}, 100%, ${lightness}%)`);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    return colors;
  }, []);

  const sizes = useMemo(() => {
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      sizes[i] = 0.5 + Math.random() * 30;
    }
    return sizes;
  }, []);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={count}
          array={colors}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-size"
          count={count}
          array={sizes}
          itemSize={1}
        />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={starsVertexShader}
        fragmentShader={starsFragmentShader}
        transparent
        depthWrite={false}
      />
    </points>
  );
};

export default BlackHole;