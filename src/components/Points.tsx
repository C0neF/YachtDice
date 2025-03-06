import { useState, useEffect, useRef } from 'react';
import type { RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';

// Points component props interface
interface PointsProps {
  diceRefs: React.MutableRefObject<(RapierRigidBody | null)[]>;
  resetCount: number;
  isRolling: boolean;
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

export default function Points({ diceRefs, resetCount, isRolling }: PointsProps) {
  const [totalPoints, setTotalPoints] = useState(0);
  const [diceValues, setDiceValues] = useState<number[]>([]);
  // 添加引用来跟踪上次处理的resetCount
  const lastProcessedResetRef = useRef(0);
  // 添加计时器引用
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Calculate dice points after they've settled
  useEffect(() => {
    // 只有当resetCount改变且大于之前处理的值时才处理
    if (resetCount > 0 && resetCount !== lastProcessedResetRef.current) {
      // 更新为当前处理的resetCount
      lastProcessedResetRef.current = resetCount;
      
      // 清除现有计时器
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      
      // Initially reset points when rolling starts
      setTotalPoints(0);
      setDiceValues([]);
      
      // Wait for dice to settle before calculating points
      timerRef.current = setTimeout(() => {
        const values: number[] = [];
        let sum = 0;
        
        // Check each dice's orientation
        diceRefs.current.forEach(dice => {
          if (dice) {
            const rotation = dice.rotation();
            const value = getDiceValueFromRotation(rotation);
            values.push(value);
            sum += value;
          }
        });
        
        setDiceValues(values);
        setTotalPoints(sum);
        timerRef.current = null;
      }, 3000); // 3 seconds after roll initiated
    }
    
    // 组件卸载时清理
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [resetCount, diceRefs]);

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
