import { useState, useEffect } from 'react';
import type { RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';

// Points component props interface
interface PointsProps {
  diceRefs: React.MutableRefObject<(RapierRigidBody | null)[]>;
  resetCount: number;
  isRolling: boolean;
  updateTrigger?: number; // 添加触发器属性
}

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

export default function Points({ diceRefs, resetCount, isRolling, updateTrigger = 0 }: PointsProps) {
  const [totalPoints, setTotalPoints] = useState(0);
  const [diceValues, setDiceValues] = useState<number[]>([]);
  
  // 当骰子被重置时重置点数
  useEffect(() => {
    if (resetCount > 0) {
      setTotalPoints(0);
      setDiceValues([]);
    }
  }, [resetCount]);
  
  // 当所有骰子都稳定后（通过updateTrigger触发），计算点数
  useEffect(() => {
    if (updateTrigger > 0 && !isRolling) {
      // 计算点数
      const values: number[] = [];
      let sum = 0;
      
      // 检查每个骰子的方向
      diceRefs.current.forEach(dice => {
        if (dice) {
          const rotation = dice.rotation();
          const value = getDiceValueFromRotation(rotation);
          values.push(value);
          sum += value;
        }
      });
      
      // 这里直接使用setState，因为已经确保骰子完全锁定，
      // 不会引起任何物理计算干扰
      setDiceValues(values);
      setTotalPoints(sum);
    }
  }, [updateTrigger, diceRefs, isRolling]);

  // Render the points display
  return (
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
          {diceValues.join(' + ')} = {totalPoints}
        </div>
      )}
    </div>
  );
}
