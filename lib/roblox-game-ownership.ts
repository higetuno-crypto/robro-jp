import 'server-only';

/**
 * Roblox ゲームのオーナー判定（フェーズ10：自薦登録のなりすまし対策）
 *
 * 判定ルール（厳密モード・MVP）：
 *  - creator.type='User' かつ creator.id === Roblox本人ID → 自動許可
 *  - creator.type='Group' かつ group.owner.userId === Roblox本人ID → 自動許可
 *  - それ以外 → 拒否（他人のゲーム、共同開発者・元メンバーは現状非対応）
 */

const PLACE_TO_UNIVERSE_URL =
  'https://apis.roblox.com/universes/v1/places';
const GROUPS_URL = 'https://groups.roblox.com/v1/groups';
const DEVELOP_UNIVERSE_URL = 'https://develop.roblox.com/v1/universes';
const UA = 'robro-jp/0.2 (+https://robro-jp.vercel.app/) creator-game-verify';

/**
 * games.roblox.com/v1/games が空を返した場合のフォールバック。
 * develop.roblox.com/v1/universes/{id} は Private ゲームでも creator + 名前を返す。
 */
export interface DevelopUniverseInfo {
  id: number;
  name: string;
  description: string | null;
  rootPlaceId: number | null;
  privacyType: 'Public' | 'Private' | string;
  isActive: boolean;
  creator: { id: number; name: string; type: 'User' | 'Group' };
}

export async function fetchDevelopUniverseInfo(
  universeId: number
): Promise<DevelopUniverseInfo | null> {
  try {
    const res = await fetch(`${DEVELOP_UNIVERSE_URL}/${universeId}`, {
      headers: { 'User-Agent': UA },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const d = (await res.json()) as {
      id?: number;
      name?: string;
      description?: string | null;
      rootPlaceId?: number | null;
      privacyType?: string;
      isActive?: boolean;
      creatorType?: string;
      creatorTargetId?: number;
      creatorName?: string;
    };
    if (
      typeof d.id !== 'number' ||
      typeof d.name !== 'string' ||
      typeof d.creatorTargetId !== 'number' ||
      (d.creatorType !== 'User' && d.creatorType !== 'Group')
    ) {
      return null;
    }
    return {
      id: d.id,
      name: d.name,
      description: d.description ?? null,
      rootPlaceId: d.rootPlaceId ?? null,
      privacyType: d.privacyType ?? 'Public',
      isActive: !!d.isActive,
      creator: {
        id: d.creatorTargetId,
        name: d.creatorName ?? '',
        type: d.creatorType,
      },
    };
  } catch (e) {
    console.error('[fetchDevelopUniverseInfo]', e);
    return null;
  }
}

export async function resolvePlaceIdToUniverseId(
  placeId: number
): Promise<number | null> {
  try {
    const res = await fetch(`${PLACE_TO_UNIVERSE_URL}/${placeId}/universe`, {
      headers: { 'User-Agent': UA },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { universeId?: number };
    return typeof data.universeId === 'number' && data.universeId > 0
      ? data.universeId
      : null;
  } catch (e) {
    console.error('[resolvePlaceIdToUniverseId]', e);
    return null;
  }
}

interface RobloxGroup {
  id: number;
  name: string;
  owner?: { userId?: number; username?: string } | null;
}

export async function fetchGroupOwnerUserId(
  groupId: number
): Promise<number | null> {
  try {
    const res = await fetch(`${GROUPS_URL}/${groupId}`, {
      headers: { 'User-Agent': UA },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as RobloxGroup;
    const uid = data.owner?.userId;
    return typeof uid === 'number' && uid > 0 ? uid : null;
  } catch (e) {
    console.error('[fetchGroupOwnerUserId]', e);
    return null;
  }
}

export type OwnershipDecision =
  | { kind: 'allow'; reason: 'user_match' | 'group_owner_match' }
  | {
      kind: 'deny';
      reason:
        | 'user_mismatch'
        | 'group_owner_mismatch'
        | 'group_owner_unknown'
        | 'unknown_creator_type';
      creatorName?: string;
    };

/**
 * 取得済みの creator 情報と本人 Roblox userId からオーナー判定。
 * Roblox API への追加 fetch は Group の場合のみ発生。
 */
export async function decideGameOwnership(
  creator: { id: number; name: string; type: 'User' | 'Group' } | null,
  robloxUserId: number
): Promise<OwnershipDecision> {
  if (!creator) {
    return { kind: 'deny', reason: 'unknown_creator_type' };
  }
  if (creator.type === 'User') {
    if (creator.id === robloxUserId) {
      return { kind: 'allow', reason: 'user_match' };
    }
    return { kind: 'deny', reason: 'user_mismatch', creatorName: creator.name };
  }
  if (creator.type === 'Group') {
    const ownerUid = await fetchGroupOwnerUserId(creator.id);
    if (ownerUid === null) {
      return { kind: 'deny', reason: 'group_owner_unknown', creatorName: creator.name };
    }
    if (ownerUid === robloxUserId) {
      return { kind: 'allow', reason: 'group_owner_match' };
    }
    return { kind: 'deny', reason: 'group_owner_mismatch', creatorName: creator.name };
  }
  return { kind: 'deny', reason: 'unknown_creator_type' };
}

export function denyMessageJa(d: Extract<OwnershipDecision, { kind: 'deny' }>): string {
  switch (d.reason) {
    case 'user_mismatch':
      return `このゲームの作者（${d.creatorName ?? '不明'}）は、あなたの Roblox アカウントと一致しません。本人の作品のみ登録できます。`;
    case 'group_owner_mismatch':
      return `このゲームのグループ（${d.creatorName ?? '不明'}）のオーナーは、あなたの Roblox アカウントではありません。グループオーナーのみ登録できます。`;
    case 'group_owner_unknown':
      return `このゲームのグループ情報を Roblox から取得できませんでした。しばらく待って再試行してください。`;
    case 'unknown_creator_type':
      return `このゲームの作者情報を Roblox から取得できませんでした。`;
  }
}
