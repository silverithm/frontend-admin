'use client';

import { Button } from '@astryxdesign/core/Button';
import { IconButton } from '@astryxdesign/core/IconButton';
import { DropdownMenu } from '@astryxdesign/core/DropdownMenu';
import { Icon } from '@astryxdesign/core/Icon';
import { FiPrinter } from 'react-icons/fi';

interface BlankFormPrintButtonProps {
  /** icon: 목록 줄의 아이콘 단추 / button: 글자가 있는 단추 */
  display: 'icon' | 'button';
  /**
   * 기관 직인 주소 — 있으면 누를 때 '직인 없이 / 직인 찍어'를 고르게 한다.
   * 직인이 없거나(미등록) 고를 권한이 없는 화면에서는 넘기지 않는다: 누르면 바로 인쇄한다.
   */
  sealUrl?: string | null;
  onPrint: (withSeal: boolean) => void;
}

const LABEL = '빈 서식 인쇄';

/**
 * '빈 서식 인쇄' 단추 — 종이에 손으로 채울 서식을 찍는다.
 *
 * 직인은 전자결재에서 최종 승인 때만 찍히지만, 종이로 받는 서식에는 따로 찍을 방법이 없어
 * 직인까지 찍힌 종이를 뽑을 수 있게 했다(2026-11-12). 다만 직인이 미리 찍힌 빈 종이는
 * 누가 무엇을 써넣어도 기관 문서처럼 보이므로, 기본은 '직인 없이'이고 고르는 것은 관리자뿐이다.
 */
export default function BlankFormPrintButton({ display, sealUrl, onPrint }: BlankFormPrintButtonProps) {
  const isIcon = display === 'icon';
  const icon = <Icon icon={FiPrinter} size={isIcon ? 'sm' : undefined} />;

  if (sealUrl) {
    return (
      <DropdownMenu
        hasChevron={!isIcon}
        button={
          isIcon
            ? { label: LABEL, tooltip: LABEL, variant: 'ghost', size: 'sm', icon, isIconOnly: true }
            : { label: LABEL, variant: 'secondary', icon }
        }
        items={[
          { label: '직인 없이 인쇄', onClick: () => onPrint(false) },
          { label: '직인 찍어 인쇄', onClick: () => onPrint(true) },
        ]}
      />
    );
  }

  return isIcon ? (
    <IconButton variant="ghost" size="sm" label={LABEL} tooltip={LABEL} icon={icon} onClick={() => onPrint(false)} />
  ) : (
    <Button label={LABEL} variant="secondary" icon={icon} onClick={() => onPrint(false)} />
  );
}
