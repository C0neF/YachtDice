import React from 'react';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import * as THREE from 'three';

export default function Bowl({ position = [0, -1.5, 0] }: { position?: [number, number, number] }) {
  // 增加容器尺寸参数
  const containerRadius = 4.0;    // 增加容器半径，从2.5到4.0
  const containerHeight = 2.2;    // 增加容器高度以容纳更多骰子
  const wallThickness = 0.15;     // 保持壁厚
  const segments = 32;            // 分段数使圆更平滑
  const bottomThickness = 0.2;    // 底部厚度

  // 容器材质
  const containerMaterial = {
    color: '#825b36',
    metalness: 0.1,
    roughness: 0.5,
    clearcoat: 0.5,
    clearcoatRoughness: 0.4,
    transparent: true,
    opacity: 0.9,
  };

  // 创建墙壁碰撞器 - 使用分离的立方体
  const numColliders = 32; // 增加碰撞体数量以确保无缝墙壁
  const wallColliders = [];
  
  for (let i = 0; i < numColliders; i++) {
    const angle = (i / numColliders) * Math.PI * 2;
    const x = Math.cos(angle) * (containerRadius - wallThickness/2);
    const z = Math.sin(angle) * (containerRadius - wallThickness/2);
    wallColliders.push({ x, z, angle });
  }

  return (
    <group position={position}>
      {/* 视觉表示 */}
      <mesh receiveShadow castShadow position={[0, 0, 0]}>
        <cylinderGeometry 
          args={[containerRadius, containerRadius, bottomThickness, segments]} 
        />
        <meshPhysicalMaterial {...containerMaterial} />
      </mesh>
      
      <mesh receiveShadow castShadow position={[0, containerHeight/2, 0]}>
        <cylinderGeometry
          args={[
            containerRadius,
            containerRadius,
            containerHeight,
            segments,
            1,
            true
          ]}
        />
        <meshPhysicalMaterial
          {...containerMaterial}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* 物理碰撞体 - 使用分离的刚体 */}
      {/* 底部碰撞体 */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider 
          args={[containerRadius - wallThickness/2, bottomThickness/2, containerRadius - wallThickness/2]}
          position={[0, 0, 0]}
        />
      </RigidBody>

      {/* 墙壁碰撞体 - 使用单独的刚体确保更准确的物理效果 */}
      {wallColliders.map((collider, index) => (
        <RigidBody key={`wall-${index}`} type="fixed" colliders={false}>
          <CuboidCollider
            args={[wallThickness, containerHeight/2, wallThickness]}
            position={[collider.x, containerHeight/2, collider.z]}
            rotation={[0, collider.angle, 0]}
          />
        </RigidBody>
      ))}
    </group>
  );
}
