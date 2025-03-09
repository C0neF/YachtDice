import { useState, useRef, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import type { RapierRigidBody } from '@react-three/rapier'
import PhysicsDice from './Dice'
import Bowl from './Bowl'
import Points from '../utils/Points'

// 固定位置的重置按钮样式
const resetButtonStyle = {
  position: 'fixed' as 'fixed',
  top: '20px',
  left: '20px',
  zIndex: 1000,
  padding: '12px 24px',
  borderRadius: '6px',
  backgroundColor: '#4a2982',
  color: 'white',
  fontSize: '16px',
  fontWeight: 'bold',
  border: 'none',
  cursor: 'pointer',
  boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
  transition: 'all 0.2s ease'
};

// 创建5个骰子的数组
const diceCount = 5;

// 主场景容器组件
export default function DiceContainer() {
  // 骰子重置计数器
  const [resetCount, setResetCount] = useState(0);
  // 是否正在投掷中
  const [isRolling, setIsRolling] = useState(false);
  // 创建一个引用数组来跟踪所有骰子
  const diceRefs = useRef<(RapierRigidBody | null)[]>([]);
  // 添加一个计时器引用来防止重复触发
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 添加一个引用来跟踪已稳定的骰子
  const stableDiceCountRef = useRef(0);
  // 添加一个引用来跟踪是否已经计算过点数
  const hasCalculatedPointsRef = useRef(false);
  // 添加一个更新点数的触发器状态
  const [updatePointsTrigger, setUpdatePointsTrigger] = useState(0);

  // 处理骰子稳定的回调
  const handleDiceStable = useCallback(() => {
    // 增加稳定骰子的计数
    stableDiceCountRef.current++;
    
    // 检查是否所有骰子都已稳定
    if (stableDiceCountRef.current === diceCount && !hasCalculatedPointsRef.current) {
      // 所有骰子都已稳定，可以计算点数
      hasCalculatedPointsRef.current = true;
      
      // 延长等待时间，确保所有骰子都完全锁定并且在生产环境中不会产生抖动
      setTimeout(() => {
        // 触发点数计算
        setUpdatePointsTrigger(prev => prev + 1);
      }, 200);
    }
  }, []);

  // 重置函数 - 使用useCallback以确保函数引用稳定
  const handleReset = useCallback(() => {
    console.log("Reset button clicked, isRolling:", isRolling);
    
    if (!isRolling) {
      // 如果已有计时器，先清除
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
        resetTimerRef.current = null;
      }

      // 重置稳定骰子计数和点数计算标记
      stableDiceCountRef.current = 0;
      hasCalculatedPointsRef.current = false;

      // 确保所有的骰子都正确重置
      diceRefs.current.forEach((dice, idx) => {
        if (dice) {
          console.log(`Preparing dice ${idx} for reset`);
          try {
            // 重新激活物理
            dice.setBodyType(0, true); // 0 = 动态 (Dynamic), true = wake
            // 确保骰子有正确的物理状态
            dice.setGravityScale(1.0, true);
            // 重新唤醒骰子
            dice.wakeUp();
          } catch (error) {
            console.error(`Error resetting dice ${idx}:`, error);
          }
        }
      });

      console.log("Updating isRolling and resetCount");
      setIsRolling(true);
      // 确保resetCount变化，即使是同一值也要强制刷新
      setResetCount(Date.now());
      
      // 增加等待时间确保整个过程完成
      resetTimerRef.current = setTimeout(() => {
        console.log("Reset complete, setting isRolling to false");
        setIsRolling(false);
        resetTimerRef.current = null;
      }, 4500);
    }
  }, [isRolling]);

  const diceArray = Array(diceCount).fill(null);
  
  // 计算骰子的起始位置 - 在容器上方水平排列
  const calculateDicePosition = (index: number): [number, number, number] => {
    // 骰子之间的水平间距
    const spacing = 1.0;
    
    // 水平排列在一条直线上，中间的骰子在容器中心上方
    const xPos = (index - (diceCount - 1) / 2) * spacing;
    
    // 所有骰子在相同高度
    const yPos = 4.0;
    
    // 所有骰子在同一Z平面上
    const zPos = 0;
    
    return [xPos, yPos, zPos];
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* 固定在左上角的重置按钮 */}
      <button
        onClick={handleReset}
        style={{
          ...resetButtonStyle,
          backgroundColor: isRolling ? '#888888' : '#4a2982',
          cursor: isRolling ? 'not-allowed' : 'pointer'
        }}
        onMouseOver={(e) => {
          if (!isRolling) {
            e.currentTarget.style.backgroundColor = '#5c3499';
          }
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.backgroundColor = isRolling ? '#888888' : '#4a2982';
        }}
        disabled={isRolling}
      >
        {isRolling ? '骰子投掷中...' : '重新投掷骰子'}
      </button>

      {/* 点数统计组件 */}
      <Points 
        diceRefs={diceRefs} 
        resetCount={resetCount} 
        isRolling={isRolling} 
        updateTrigger={updatePointsTrigger}
      />

      <Canvas 
        shadows 
        camera={{ 
          position: [0, 21, 0],
          fov: 30,
          near: 0.1,
          far: 100,
          rotation: [-Math.PI/2, 0, 0],
          up: [0, 0, -1]
        }} 
        style={{ width: '100%', height: '100%' }}
      >
        <color attach="background" args={['#ffffff']} />
        <ambientLight intensity={0.8} />
        
        <Physics gravity={[0, -9.81, 0]} debug={false}>
          {/* 渲染5个骰子在容器上方，水平排列 */}
          {diceArray.map((_, index) => (
            <PhysicsDice 
              key={`dice-${index}`}
              position={calculateDicePosition(index)} 
              resetCount={resetCount}
              index={index}
              startDelay={100} // 所有骰子使用相同的延迟，实现同时落下
              onStable={handleDiceStable} // 添加稳定回调
              ref={(el: RapierRigidBody | null) => {
                // 确保数组有足够空间
                while (diceRefs.current.length <= index) {
                  diceRefs.current.push(null);
                }
                // 更新引用
                diceRefs.current[index] = el;
              }}
            />
          ))}

          <Bowl position={[0, 0, 0]} />
        </Physics>
      </Canvas>
    </div>
  )
}
