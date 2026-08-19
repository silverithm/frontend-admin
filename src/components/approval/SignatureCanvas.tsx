'use client';

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
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
  /** 지정하면 그 폭으로 고정한다. 없으면 부모 폭을 재서 채운다 (카드 오른쪽이 남지 않게) */
  width?: number;
  height?: number;
  strokeColor?: string;
  onChange?: (isEmpty: boolean) => void;
}

/**
 * 결재 서명 그리기 캔버스. 마우스/터치 공용(pointer events), 투명 배경 PNG로 내보낸다.
 */
const SignatureCanvas = forwardRef<SignatureCanvasHandle, SignatureCanvasProps>(
  ({ width, height = 160, strokeColor = '#111827', onChange }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const boxRef = useRef<HTMLDivElement>(null);
    /**
     * 실제로 그릴 폭. 고정 폭을 받으면 그대로 쓰고, 아니면 부모를 재서 채운다.
     * 캔버스는 백킹 스토어를 픽셀로 잡아야 해서 CSS만으로 늘리면 획이 뭉갠다.
     */
    const [measuredWidth, setMeasuredWidth] = useState(320);
    const drawWidth = width ?? measuredWidth;

    useEffect(() => {
      if (width) return;
      const box = boxRef.current;
      if (!box) return;
      setMeasuredWidth(box.clientWidth || 320);
      const observer = new ResizeObserver((entries) => {
        const next = entries[0]?.contentRect.width;
        // 폭이 바뀌면 백킹 스토어를 다시 잡아야 하고 그 과정에서 그리던 획이 지워진다.
        // 1px 떨림으로 서명이 사라지지 않게 의미 있는 변화만 반영한다.
        if (typeof next === 'number' && Math.abs(next - measuredWidth) > 8) {
          setMeasuredWidth(next);
        }
      });
      observer.observe(box);
      return () => observer.disconnect();
    }, [width, measuredWidth]);

    const isDrawingRef = useRef(false);
    const hasInkRef = useRef(false);
    const lastPointRef = useRef<{ x: number; y: number } | null>(null);

    // 고해상도 디스플레이 대응 (2x 백킹 스토어)
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const scale = 2;
      // width/height를 다시 대입하면 캔버스가 통째로 비워진다. 창 크기가 바뀌는 순간
      // 그려둔 서명이 조용히 사라지고 hasInkRef만 true로 남아 '빈 서명'이 저장되는
      // 사고가 났었다 — 스냅숏을 떠서 새 크기에 옮겨 담는다.
      let snapshot: HTMLCanvasElement | null = null;
      if (hasInkRef.current && canvas.width > 0 && canvas.height > 0) {
        snapshot = document.createElement('canvas');
        snapshot.width = canvas.width;
        snapshot.height = canvas.height;
        snapshot.getContext('2d')?.drawImage(canvas, 0, 0);
      }
      canvas.width = drawWidth * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        if (snapshot) {
          ctx.drawImage(
            snapshot,
            0, 0, snapshot.width, snapshot.height,
            0, 0, canvas.width, canvas.height,
          );
        }
        ctx.scale(scale, scale);
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = strokeColor;
      }
    }, [drawWidth, height, strokeColor]);

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
      <div ref={boxRef}>
        <canvas
          ref={canvasRef}
          className="carev-signature-canvas"
          style={{
            width: drawWidth,
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
