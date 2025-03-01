import React, { memo, useMemo, useRef } from '../../../../lib/teact/teact';
import { withGlobal } from '../../../../global';

import type { ApiMessage, ApiPeer } from '../../../../api/types';
import type { ApiMessageActionStarGift } from '../../../../api/types/messageActions';

import { getPeerTitle, isChatChannel } from '../../../../global/helpers';
import { isApiPeerChat } from '../../../../global/helpers/peers';
import {
  selectCanPlayAnimatedEmojis,
  selectPeer,
  selectSender,
} from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { formatStarsAsText } from '../../../../util/localization/format';
import { getServerTime } from '../../../../util/serverTime';
import { formatIntegerCompact } from '../../../../util/textFormat';
import { getStickerFromGift } from '../../../common/helpers/gifts';
import { renderTextWithEntities } from '../../../common/helpers/renderTextWithEntities';
import { renderPeerLink, translateWithOutgoing } from '../helpers/messageActions';

import useDynamicColorListener from '../../../../hooks/stickers/useDynamicColorListener';
import { type ObserveFn } from '../../../../hooks/useIntersectionObserver';
import useLang from '../../../../hooks/useLang';

import GiftRibbon from '../../../common/gift/GiftRibbon';
import Sparkles from '../../../common/Sparkles';
import StickerView from '../../../common/StickerView';

import styles from '../ActionMessage.module.scss';

type OwnProps = {
  message: ApiMessage;
  action: ApiMessageActionStarGift;
  observeIntersectionForLoading?: ObserveFn;
  observeIntersectionForPlaying?: ObserveFn;
  onClick?: NoneToVoidFunction;
};

type StateProps = {
  canPlayAnimatedEmojis: boolean;
  sender?: ApiPeer;
  recipient?: ApiPeer;
  starGiftMaxConvertPeriod?: number;
};

const STICKER_SIZE = 120;

const StarGiftAction = ({
  action,
  message,
  canPlayAnimatedEmojis,
  sender,
  recipient,
  starGiftMaxConvertPeriod,
  onClick,
  observeIntersectionForLoading,
  observeIntersectionForPlaying,
}: OwnProps & StateProps) => {
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const stickerRef = useRef<HTMLDivElement>(null);
  const lang = useLang();

  const { isOutgoing } = message;

  const sticker = getStickerFromGift(action.gift)!;

  const peer = isOutgoing ? recipient : sender;
  const isChannel = peer && isApiPeerChat(peer) && isChatChannel(peer);

  const backgroundColor = useDynamicColorListener(ref, 'background-color', !action.gift.availabilityTotal);

  const fallbackPeerTitle = lang('ActionFallbackSomeone');
  const peerTitle = peer && getPeerTitle(lang, peer);
  const isSelf = sender?.id === recipient?.id;

  const giftDescription = useMemo(() => {
    const peerLink = renderPeerLink(peer?.id, peerTitle || fallbackPeerTitle);
    const starsAmount = action.starsToConvert !== undefined
      ? formatStarsAsText(lang, action.starsToConvert) : undefined;

    if (action.isUpgraded) {
      return lang('ActionStarGiftUpgraded');
    }

    if (action.alreadyPaidUpgradeStars) {
      return translateWithOutgoing(
        lang, 'ActionStarGiftUpgradeText', !isOutgoing, { peer: peerLink },
      );
    }

    if (action.isConverted) {
      return translateWithOutgoing(
        lang, 'ActionStarGiftConvertedText', !isOutgoing, { peer: peerLink, amount: starsAmount },
      );
    }

    if (starGiftMaxConvertPeriod && getServerTime() < message.date + starGiftMaxConvertPeriod) {
      return translateWithOutgoing(
        lang, 'ActionStarGiftConvertText', !isOutgoing, { peer: peerLink, amount: starsAmount },
      );
    }

    if (isChannel) {
      return lang(
        'ActionStarGiftChannelText', { amount: starsAmount }, { withNodes: true },
      );
    }

    return translateWithOutgoing(
      lang, 'ActionStarGiftNoConvertText', !isOutgoing, { peer: peerLink },
    );
  }, [
    action, fallbackPeerTitle, isChannel, isOutgoing, lang, message.date, peer?.id, peerTitle, starGiftMaxConvertPeriod,
  ]);

  return (
    <div
      ref={ref}
      className={buildClassName(styles.contentBox, styles.starGift)}
      tabIndex={0}
      role="button"
      onClick={onClick}
    >
      <div
        ref={stickerRef}
        className={styles.stickerWrapper}
        style={`width: ${STICKER_SIZE}px; height: ${STICKER_SIZE}px`}
      >
        {sticker && (
          <StickerView
            containerRef={stickerRef}
            sticker={sticker}
            size={STICKER_SIZE}
            observeIntersectionForLoading={observeIntersectionForLoading}
            observeIntersectionForPlaying={observeIntersectionForPlaying}
            noLoad={!canPlayAnimatedEmojis}
          />
        )}
      </div>
      {action.gift.availabilityTotal && (
        <GiftRibbon
          color={backgroundColor || 'blue'}
          text={lang('ActionStarGiftLimitedRibbon', { total: formatIntegerCompact(action.gift.availabilityTotal) })}
        />
      )}
      <div className={styles.info}>
        <h3 className={styles.title}>
          {isSelf ? lang('ActionStarGiftSelf') : lang(
            isOutgoing ? 'ActionStarGiftTo' : 'ActionStarGiftFrom',
            {
              peer: renderPeerLink(peer?.id, peerTitle || fallbackPeerTitle),
            },
            {
              withNodes: true,
            },
          )}
        </h3>
        <div className={styles.subtitle}>
          {action.message && renderTextWithEntities(action.message)}
          {!action.message && giftDescription}
        </div>
      </div>
      <div className={styles.actionButton}>
        <Sparkles preset="button" />
        {action.alreadyPaidUpgradeStars && !action.isUpgraded && !isOutgoing
          ? lang('ActionStarGiftUnpack') : lang('ActionViewButton')}
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { message, action }): StateProps => {
    const canPlayAnimatedEmojis = selectCanPlayAnimatedEmojis(global);
    const messageSender = selectSender(global, message);
    const giftSender = action.fromId ? selectPeer(global, action.fromId) : undefined;
    const messageRecipient = selectPeer(global, message.chatId);
    const giftRecipient = action.peerId ? selectPeer(global, action.peerId) : undefined;

    return {
      canPlayAnimatedEmojis,
      sender: giftSender || messageSender,
      recipient: giftRecipient || messageRecipient,
      starGiftMaxConvertPeriod: global.appConfig?.starGiftMaxConvertPeriod,
    };
  },
)(StarGiftAction));
