import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import { RigidBody, RapierRigidBody } from '@react-three/rapier'
import * as THREE from 'three'

// 导入骰子图片
import dice1 from '../assets/dice_1.png'
import dice2 from '../assets/dice_2.png'
import dice3 from '../assets/dice_3.png'
import dice4 from '../assets/dice_4.png'
import dice5 from '../assets/dice_5.png'
import dice6 from '../assets/dice_6.png'

// Helper function to determine dice value from orientation
function getDiceValueFromRotation(rotation: {x: number, y: number, z: number, w: number}): number {
  // Create quaternion from dice rotation
  const quat = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
  
  // Define the six face normal vectors in dice local space
  const faces = [
    { normal: new THREE.Vector3(0, 0, 1), value: 1 },  // Front (Z+) = 1
    { normal: new THREE.Vector3(1, 0, 0), value: 2 },  // Right (X+) = 2
    { normal: new THREE.Vector3(0, 1, 0), value: 3 },  // Top (Y+) = 3
    { normal: new THREE.Vector3(0, 0, -1), value: 4 }, // Back (Z-) = 4
    { normal: new THREE.Vector3(-1, 0, 0), value: 5 }, // Left (X-) = 5
    { normal: new THREE.Vector3(0, -1, 0), value: 6 }  // Bottom (Y-) = 6
  ];
  
  // World up vector (the direction we're viewing from)
  const worldUp = new THREE.Vector3(0, 1, 0);
  
  // Find which face normal points most toward world up after rotation
  let maxAlignment = -Infinity;
  let upFaceValue = 1; // Default to 1 if something goes wrong
  
  faces.forEach(face => {
    // Apply dice rotation to the face normal
    const rotatedNormal = face.normal.clone().applyQuaternion(quat);
    
    // Compute alignment with world up (dot product)
    const alignment = rotatedNormal.dot(worldUp);
    
    // If this face is more aligned with up than previous best, update
    if (alignment > maxAlignment) {
      maxAlignment = alignment;
      upFaceValue = face.value;
    }
  });
  
  return upFaceValue;
}

// 骰子组件props的接口定义
interface PhysicsDiceProps {
  position?: [number, number, number];
  resetCount?: number;
  index?: number;
  startDelay?: number;
  onStable?: (index: number, value: number) => void;  // 修改回调函数接收骰子点数
}

// 物理骰子组件
const PhysicsDice = forwardRef<RapierRigidBody, PhysicsDiceProps>((props, ref) => {
  // 使用正确的类型定义引用
  const diceRef = useRef<RapierRigidBody>(null)
  const { position = [0, 0, 0], resetCount = 0, index = 0, startDelay = 0, onStable } = props
  // 使用useRef而不是useState来避免重新渲染
  const isResettingRef = useRef(false);
  // 保存当前应用的阻尼值
  const currentDampingRef = useRef(0.5);
  // 跟踪骰子是否已经锁定
  const isLockedRef = useRef(false);
  // 保存骰子最终的点数值
  const finalValueRef = useRef(1);

  // 向父组件公开rigidBody实例
  useImperativeHandle(ref, () => diceRef.current as RapierRigidBody);

  // 生成一个随机的初始旋转
  const randomRotation = [
    Math.random() * Math.PI,
    Math.random() * Math.PI,
    Math.random() * Math.PI
  ]

  // 定位计时器引用
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 跟踪上次处理的resetCount，防止重复处理
  const lastResetCountRef = useRef(0);
  // 添加一个稳定性计时器引用
  const stabilityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 添加一个渐进式增加阻尼的计时器引用
  const gradualDampingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // 添加检查稳定状态的计时器引用
  const stabilityCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // 添加位置历史数组，用于检测稳定性
  const positionHistoryRef = useRef<Array<{pos: THREE.Vector3, time: number}>>([]);

  // 锁定骰子物理状态的函数
  const lockDicePhysics = () => {
    if (diceRef.current && !isLockedRef.current) {
      // 获取最终骰子值
      const rotation = diceRef.current.rotation();
      finalValueRef.current = getDiceValueFromRotation(rotation);

      // 完全锁定骰子的物理属性 - 使用setBodyType需要额外的wake参数
      diceRef.current.setBodyType(2, true); // 2 = 固定/锁定 (Fixed), true = wake
      
      // 清除所有速度和力
      diceRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      diceRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
      
      // 标记为已锁定
      isLockedRef.current = true;
      
      // 如果提供了稳定回调函数，调用它并传递骰子的最终值
      if (onStable) {
        onStable(index, finalValueRef.current);
      }
    }
  };

  // 检查骰子是否稳定
  const checkStability = () => {
    if (!diceRef.current || isLockedRef.current) return;
    
    const currentPos = diceRef.current.translation();
    const currentTime = Date.now();
    
    // 创建一个Three.js向量以方便计算
    const posVector = new THREE.Vector3(currentPos.x, currentPos.y, currentPos.z);
    
    // 添加到历史记录
    positionHistoryRef.current.push({ pos: posVector, time: currentTime });
    
    // 只保留最近的10个历史记录
    if (positionHistoryRef.current.length > 10) {
      positionHistoryRef.current.shift();
    }
    
    // 如果我们有足够的历史记录，检查稳定性
    if (positionHistoryRef.current.length >= 5) {
      let isStable = true;
      
      // 检查最近5个位置的变化
      for (let i = 1; i < 5; i++) {
        const prev = positionHistoryRef.current[positionHistoryRef.current.length - i - 1];
        const curr = positionHistoryRef.current[positionHistoryRef.current.length - i];
        
        // 计算位移量
        const distance = prev.pos.distanceTo(curr.pos);
        
        // 如果移动太多，则不稳定
        if (distance > 0.0001) {
          isStable = false;
          break;
        }
      }
      
      // 检查线性和角速度
      if (isStable) {
        const linVel = diceRef.current.linvel();
        const angVel = diceRef.current.angvel();
        
        const linVelMagnitude = Math.sqrt(
          Math.pow(linVel.x, 2) + Math.pow(linVel.y, 2) + Math.pow(linVel.z, 2)
        );
        
        const angVelMagnitude = Math.sqrt(
          Math.pow(angVel.x, 2) + Math.pow(angVel.y, 2) + Math.pow(angVel.z, 2)
        );
        
        // 如果速度太大，则不稳定
        if (linVelMagnitude > 0.005 || angVelMagnitude > 0.005) {
          isStable = false;
        }
      }
      
      // 如果稳定，锁定骰子
      if (isStable) {
        lockDicePhysics();
      }
    }
  };

  // 当resetCount变化时重置骰子 - 所有骰子同时落下
  useEffect(() => {
    // 检查resetCount是否真的有变化，且大于上次处理的值
    if (resetCount > 0 && resetCount !== lastResetCountRef.current) {
      // 更新上次处理的重置计数
      lastResetCountRef.current = resetCount;
      
      // 清除任何现有计时器
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (stabilityTimerRef.current) {
        clearTimeout(stabilityTimerRef.current);
        stabilityTimerRef.current = null;
      }
      if (gradualDampingRef.current) {
        clearInterval(gradualDampingRef.current);
        gradualDampingRef.current = null;
      }
      if (stabilityCheckRef.current) {
        clearInterval(stabilityCheckRef.current);
        stabilityCheckRef.current = null;
      }

      // 重置历史记录
      positionHistoryRef.current = [];
      
      // 设置重置状态
      isResettingRef.current = true;
      // 重置阻尼值
      currentDampingRef.current = 0.5;
      // 重置锁定状态
      isLockedRef.current = false;
      // 重置骰子值
      finalValueRef.current = 1;
      
      // 所有骰子使用相同的延迟，实现同时落下
      timerRef.current = setTimeout(() => {
        if (diceRef.current) {
          // 重新激活物理 - 使用setBodyType需要额外的wake参数
          diceRef.current.setBodyType(0, true); // 0 = 动态 (Dynamic), true = wake
          
          // 获取从props传入的位置 - 骰子将排成一行
          const [posX, initialY, posZ] = position;
          
          // 设置初始位置 - 使用传入的位置，但添加一点点随机性防止完全重叠
          diceRef.current.setTranslation({ 
            x: posX + (Math.random() - 0.5) * 0.05, 
            y: initialY,
            z: posZ + (Math.random() - 0.5) * 0.05
          }, true);

          // 随机旋转 - 每个骰子有不同的初始旋转
          const eulerRot = new THREE.Euler(
            Math.random() * Math.PI, 
            Math.random() * Math.PI, 
            Math.random() * Math.PI
          );
          const quaternion = new THREE.Quaternion().setFromEuler(eulerRot);
          diceRef.current.setRotation(
            { x: quaternion.x, y: quaternion.y, z: quaternion.z, w: quaternion.w },
            true
          );

          // 清除现有速度
          diceRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
          diceRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true);

          // 设置初始阻尼值
          diceRef.current.setLinearDamping(currentDampingRef.current);
          diceRef.current.setAngularDamping(currentDampingRef.current);

          // 应用轻微的初始力和扭矩 - 给每个骰子一点随机性
          const torque = {
            x: (Math.random() - 0.5) * 0.1,
            y: (Math.random() - 0.5) * 0.1,
            z: (Math.random() - 0.5) * 0.1
          };
          diceRef.current.applyTorqueImpulse(torque, true);
          
          // 1.5秒后开始渐进增加阻尼，更自然地稳定骰子
          stabilityTimerRef.current = setTimeout(() => {
            if (diceRef.current) {
              // 设置一个逐渐增加阻尼的间隔
              gradualDampingRef.current = setInterval(() => {
                if (diceRef.current && currentDampingRef.current < 20.0 && !isLockedRef.current) {
                  // 逐渐增加阻尼，每次增加一点点
                  currentDampingRef.current += 0.5;
                  diceRef.current.setLinearDamping(currentDampingRef.current);
                  diceRef.current.setAngularDamping(currentDampingRef.current);
                  
                  // 达到最大阻尼后停止
                  if (currentDampingRef.current >= 20.0) {
                    if (gradualDampingRef.current) {
                      clearInterval(gradualDampingRef.current);
                      gradualDampingRef.current = null;
                    }
                    // 完全稳定后更新状态
                    isResettingRef.current = false;
                  }
                }
              }, 100); // 每100毫秒逐渐增加阻尼
              
              // 开始稳定性检查
              stabilityCheckRef.current = setInterval(() => {
                checkStability();
              }, 100); // 每100毫秒检查一次稳定性
            }
            stabilityTimerRef.current = null;
          }, 1500);
          
          // 如果3秒后仍未锁定，强制锁定
          setTimeout(() => {
            if (!isLockedRef.current && diceRef.current) {
              lockDicePhysics();
            }
          }, 3000);
        }
        timerRef.current = null;
      }, startDelay); // 所有骰子使用相同的延迟
    }
    
    // 组件卸载时清除计时器
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      if (stabilityTimerRef.current) {
        clearTimeout(stabilityTimerRef.current);
      }
      if (gradualDampingRef.current) {
        clearInterval(gradualDampingRef.current);
      }
      if (stabilityCheckRef.current) {
        clearInterval(stabilityCheckRef.current);
      }
    };
  }, [resetCount, index, startDelay, position, onStable]);

  // 骰子尺寸
  const diceSize = 0.6;
  const surfaceOffset = 0.003;

  // 预加载纹理
  const textures = {
    dice1: new THREE.TextureLoader().load(dice1),
    dice2: new THREE.TextureLoader().load(dice2),
    dice3: new THREE.TextureLoader().load(dice3),
    dice4: new THREE.TextureLoader().load(dice4),
    dice5: new THREE.TextureLoader().load(dice5),
    dice6: new THREE.TextureLoader().load(dice6)
  };

  // 渲染带图片的骰子面
  const renderFace = (posX: number, posY: number, posZ: number, rotation: [number, number, number], texture: THREE.Texture) => (
    <mesh position={[posX, posY, posZ]} rotation={rotation} userData={{ isCollider: false }} >
      <planeGeometry args={[diceSize * 0.9, diceSize * 0.9]} />
      <meshStandardMaterial map={texture} transparent={true} side={THREE.DoubleSide} />
    </mesh>
  );

  return (
    <RigidBody 
      ref={diceRef} 
      position={position} 
      restitution={0.6}
      friction={0.2}
      linearDamping={currentDampingRef.current}  // 使用当前阻尼引用值
      angularDamping={currentDampingRef.current}  // 使用当前阻尼引用值
      rotation={randomRotation as [number, number, number]} 
      colliders="cuboid"
      mass={0.1}
      type={isLockedRef.current ? "fixed" : "dynamic"}  // 基于锁定状态动态设置类型
    >
      {/* 主骰子 */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[diceSize, diceSize, diceSize]} />
        <meshStandardMaterial color="white" roughness={0.1} metalness={0.1} />
      </mesh>

      {/* 使用图片纹理替换点数 */}
      <group>
        {/* 1面 (前) - Z轴正方向 */}
        {renderFace(0, 0, diceSize/2 + surfaceOffset, [0, 0, 0], textures.dice1)}

        {/* 2面 (右) - X轴正方向 */}
        {renderFace(diceSize/2 + surfaceOffset, 0, 0, [0, Math.PI/2, 0], textures.dice2)}

        {/* 3面 (上) - Y轴正方向 */}
        {renderFace(0, diceSize/2 + surfaceOffset, 0, [-Math.PI/2, 0, 0], textures.dice3)}

        {/* 4面 (后) - Z轴负方向 */}
        {renderFace(0, 0, -diceSize/2 - surfaceOffset, [0, Math.PI, 0], textures.dice4)}

        {/* 5面 (左) - X轴负方向 */}
        {renderFace(-diceSize/2 - surfaceOffset, 0, 0, [0, -Math.PI/2, 0], textures.dice5)}

        {/* 6面 (下) - Y轴负方向 */}
        {renderFace(0, -diceSize/2 - surfaceOffset, 0, [Math.PI/2, 0, 0], textures.dice6)}
      </group>
    </RigidBody>
  )
});

export default PhysicsDice;
