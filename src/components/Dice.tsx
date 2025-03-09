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
  onStable?: (index: number) => void;  // 添加稳定回调函数
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
      // 不再使用setBodyType，因为这可能会导致重置问题
      // 而是将重力比例设为0并清除所有速度
      
      // 清除所有速度和力
      diceRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      diceRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
      
      // 完全禁用重力和其他力的影响
      diceRef.current.setGravityScale(0, true);
      
      // 设置超高阻尼以固定位置
      diceRef.current.setLinearDamping(100);
      diceRef.current.setAngularDamping(100);
      
      // 标记为已锁定
      isLockedRef.current = true;
      
      // 增加延迟确保物理状态完全稳定后再触发回调
      // 这能解决生产环境中的抖动问题
      setTimeout(() => {
        // 如果提供了稳定回调函数，调用它
        if (onStable) {
          onStable(index);
        }
      }, 50);
    }
  };

  // 检查骰子是否稳定
  const checkStability = () => {
    if (!diceRef.current || isLockedRef.current) return;
    
    // 确保重力比例为1.0，以防在检查稳定性过程中被异常修改
    if (diceRef.current.gravityScale() !== 1.0 && !isLockedRef.current) {
      diceRef.current.setGravityScale(1.0, true);
    }
    
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
    console.log(`Dice ${index}: resetCount = ${resetCount}, last = ${lastResetCountRef.current}`);
    
    // 检查resetCount是否真的有变化，且大于上次处理的值
    if (resetCount > 0 && resetCount !== lastResetCountRef.current) {
      console.log(`Dice ${index}: Resetting...`);
      
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
      
      // 所有骰子使用相同的延迟，实现同时落下
      timerRef.current = setTimeout(() => {
        if (diceRef.current) {
          try {
            console.log(`Dice ${index}: Executing reset`);
            
            // 强制设置为动态类型 - 重要：确保物理引擎重新激活
            diceRef.current.setBodyType(0, true); // 0 = 动态 (Dynamic), true = wake
            
            // 确保重置重力比例为正常值 - 修复慢动作问题
            diceRef.current.setGravityScale(1.0, true);
            
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

            // 重置物理参数
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
            
            // 强制唤醒确保物理引擎处理这个物体
            diceRef.current.wakeUp();
          } catch (error) {
            console.error(`Dice ${index}: Error resetting:`, error);
          }
          
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
          
          // 如果5秒后仍未锁定，强制锁定
          setTimeout(() => {
            if (!isLockedRef.current && diceRef.current) {
              lockDicePhysics();
            }
          }, 4000);
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
      linearDamping={currentDampingRef.current}  // 使用当前阻尼引用值
      angularDamping={currentDampingRef.current}  // 使用当前阻尼引用值
      rotation={randomRotation as [number, number, number]} 
      colliders="cuboid"
      mass={0.1}
      gravityScale={isLockedRef.current ? 0 : 1}  // 根据锁定状态动态设置重力比例
      type="dynamic"  // 始终保持为动态类型，由代码控制锁定状态
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
