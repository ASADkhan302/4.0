import React from 'react';
import { Borrower } from '../../types/library';
import { ULM_OFFICIAL_CREST_SRC } from '../../constants/ulmOfficialAssets';
import {
  UlmSmartIdCard,
  CardMemberData,
  borrowerToCardMemberData,
} from '../library/UlmSmartIdCard';

export interface MemberCardProps {
  member?: Partial<Borrower> | null;
  cardData?: CardMemberData;
  side?: 'front' | 'back' | 'both';
  scale?: number;
  watermarkAlpha?: number;
  className?: string;
  showLanyardSlot?: boolean;
}

export const MemberCard: React.FC<MemberCardProps> = ({
  member,
  cardData,
  side = 'front',
  scale = 1,
  watermarkAlpha = 6.5,
  className = '',
}) => {
  const resolvedData = cardData || borrowerToCardMemberData(member);

  const cardWidth = side === 'both' ? 428 * 2 + 32 : 428;
  const cardHeight = 270;

  const wrapperStyle: React.CSSProperties =
    scale !== 1
      ? {
          width: `${cardWidth * scale}px`,
          height: `${cardHeight * scale}px`,
          position: 'relative',
        }
      : {};

  const innerScaleStyle: React.CSSProperties =
    scale !== 1
      ? {
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          width: `${cardWidth}px`,
        }
      : {};

  return (
    <div
      className={`member-card-scalable relative select-none print:shadow-none ${className}`}
      style={wrapperStyle}
    >
      <div style={innerScaleStyle}>
        <UlmSmartIdCard
          data={resolvedData}
          crestUrl={ULM_OFFICIAL_CREST_SRC}
          watermarkAlpha={watermarkAlpha}
          side={side}
        />
      </div>
    </div>
  );
};

export default MemberCard;
