'use client';

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import { Button } from '@astryxdesign/core/Button';
import { HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';

export interface SignatureCanvasHandle {
  clear: () => void;
  isEmpty: () => boolean;
  /** 투명 배경 PNG data URL. 비어 있으면 null. */
  toDataURL: () => string | null;
}

interface SignatureCanvasProps {
  width?: number;
  height?: number;
  strokeColor?: string;
  onChange?: (isEmpty: boolean) => void;
}

/**
 * 결재 서명 그리기 캔버스. 마우스/터치 공용(pointer events), 투명 배경 PNG로 내보낸다.
 */
const SignatureCanvas = forwardRef<SignatureCanvasHandle, SignatureCanvasProps>(
  ({ width = 320, height = 160, strokeColor = '#111827', onChange }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isDrawingRef = useRef(false);
    const hasInkRef = useRef(false);
    const lastPointRef = useRef<{ x: number; y: number } | null>(null);

    // 고해상도 디스플레이 대응 (2x 백킹 스토어)
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const scale = 2;
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(scale, scale);
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = strokeColor;
      }
    }, [width, height, strokeColor]);

    const getPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    };

    const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
      event.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.setPointerCapture(event.pointerId);
      isDrawingRef.current = true;
      lastPointRef.current = getPoint(event);
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawingRef.current) return;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      const lastPoint = lastPointRef.current;
      if (!canvas || !ctx || !lastPoint) return;

      const point = getPoint(event);
      ctx.beginPath();
      ctx.moveTo(lastPoint.x, lastPoint.y);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
      lastPointRef.current = point;

      if (!hasInkRef.current) {
        hasInkRef.current = true;
        onChange?.(false);
      }
    };

    const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      const lastPoint = lastPointRef.current;

      // 탭만 하고 이동이 없어도 점 하나는 찍는다
      if (isDrawingRef.current && canvas && ctx && lastPoint) {
        const point = getPoint(event);
        if (point.x === lastPoint.x && point.y === lastPoint.y) {
          ctx.beginPath();
          ctx.arc(point.x, point.y, 1.25, 0, Math.PI * 2);
          ctx.fillStyle = strokeColor;
          ctx.fill();
          if (!hasInkRef.current) {
            hasInkRef.current = true;
            onChange?.(false);
          }
        }
      }

      isDrawingRef.current = false;
      lastPointRef.current = null;
    };

    const clear = useCallback(() => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      hasInkRef.current = false;
      onChange?.(true);
    }, [onChange]);

    useImperativeHandle(ref, () => ({
      clear,
      isEmpty: () => !hasInkRef.current,
      toDataURL: () => {
        if (!hasInkRef.current) return null;
        return canvasRef.current?.toDataURL('image/png') ?? null;
      },
    }), [clear]);

    return (
      <div>
        <canvas
          ref={canvasRef}
          className="carev-signature-canvas"
          style={{
            width,
            height,
            border: '1px dashed var(--color-border)',
            borderRadius: 'var(--radius-inner)',
            background: 'var(--color-background-card)',
            touchAction: 'none',
            display: 'block',
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
        <HStack gap={2} vAlign="center" hAlign="between" style={{ marginTop: 'var(--spacing-1)' }}>
          <Text type="supporting" color="secondary">위 영역에 서명을 그려주세요</Text>
          <Button label="지우기" variant="ghost" size="sm" onClick={clear} />
        </HStack>
      </div>
    );
  }
);

SignatureCanvas.displayName = 'SignatureCanvas';

export default SignatureCanvas;
