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

// 骰子组件props的接口定义
interface PhysicsDiceProps {
  position?: [number, number, number];
  resetCount?: number;
  index?: number;
  startDelay?: number;
}

// 物理骰子组件
const PhysicsDice = forwardRef<RapierRigidBody, PhysicsDiceProps>((props, ref) => {
  // 使用正确的类型定义引用
  const diceRef = useRef<RapierRigidBody>(null)
  const { position = [0, 0, 0], resetCount = 0, index = 0, startDelay = 0 } = props

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

  // 当resetCount变化时重置骰子 - 所有骰子同时落下
  useEffect(() => {
    // 检查resetCount是否真的有变化，且大于上次处理的值
    if (resetCount > 0 && resetCount !== lastResetCountRef.current) {
      // 更新上次处理的重置计数
      lastResetCountRef.current = resetCount;
      
      // 清除任何现有计时器
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      
      // 所有骰子使用相同的延迟，实现同时落下
      timerRef.current = setTimeout(() => {
        if (diceRef.current) {
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

          // 应用轻微的初始力和扭矩 - 给每个骰子一点随机性
          const torque = {
            x: (Math.random() - 0.5) * 0.1,
            y: (Math.random() - 0.5) * 0.1,
            z: (Math.random() - 0.5) * 0.1
          };
          diceRef.current.applyTorqueImpulse(torque, true);
        }
      }, startDelay); // 所有骰子使用相同的延迟
    }
    
    // 组件卸载时清除计时器
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [resetCount, index, startDelay, position]);

  // ...剩余代码保持不变...
  
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
      linearDamping={0.5}
      angularDamping={0.5}
      rotation={randomRotation as [number, number, number]} 
      colliders="cuboid"
      mass={0.1}
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
