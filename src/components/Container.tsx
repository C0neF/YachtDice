import { useState, useRef, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import type { RapierRigidBody } from '@react-three/rapier'
import PhysicsDice from './Dice'
import Bowl from './Bowl'

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
  // 保存所有骰子的最终值
  const [diceValues, setDiceValues] = useState<number[]>([]);
  // 保存总点数
  const [totalPoints, setTotalPoints] = useState(0);

  // 处理骰子稳定的回调
  const handleDiceStable = useCallback((index: number, value: number) => {
    // 增加稳定骰子的计数
    stableDiceCountRef.current++;
    
    // 更新骰子值数组
    setDiceValues(prev => {
      const newValues = [...prev];
      newValues[index] = value;
      return newValues;
    });
    
    // 检查是否所有骰子都已稳定
    if (stableDiceCountRef.current === diceCount && !hasCalculatedPointsRef.current) {
      // 所有骰子都已稳定，可以计算点数
      hasCalculatedPointsRef.current = true;
      
      // 等待一小段时间确保所有骰子都完全锁定
      setTimeout(() => {
        // 计算总点数 - 使用存储的值而不是读取物理引擎
        setDiceValues(prev => {
          const sum = prev.reduce((acc, val) => acc + val, 0);
          setTotalPoints(sum);
          return prev;
        });
      }, 100);
    }
  }, []);

  // 重置函数 - 使用useCallback以确保函数引用稳定
  const handleReset = useCallback(() => {
    if (!isRolling) {
      // 如果已有计时器，先清除
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
        resetTimerRef.current = null;
      }

      // 重置稳定骰子计数和点数计算标记
      stableDiceCountRef.current = 0;
      hasCalculatedPointsRef.current = false;
      
      // 重置骰子值和总点数
      setDiceValues([]);
      setTotalPoints(0);

      setIsRolling(true);
      setResetCount(prevCount => prevCount + 1);
      
      // 延长等待时间确保整个过程完成
      resetTimerRef.current = setTimeout(() => {
        setIsRolling(false);
        resetTimerRef.current = null;
      }, 4000);
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

      {/* 点数统计组件 - 直接传递值而不是让组件读取物理引擎 */}
      <div style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        padding: '15px',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
        zIndex: 1000,
        fontFamily: 'Arial, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end'
      }}>
        <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '5px' }}>
          总点数: {isRolling ? '...' : totalPoints}
        </div>
        {!isRolling && diceValues.length > 0 && (
          <div style={{ fontSize: '14px', color: '#666' }}>
            {diceValues.filter(v => v > 0).join(' + ')} = {totalPoints}
          </div>
        )}
      </div>

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
