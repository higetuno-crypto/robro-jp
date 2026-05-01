import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * フェーズ10：creators / creator_games のDBヘルパ
 *
 * 設計：
 *  - 書き込みは API ルート経由（Service Role Key）。RLS により anon からの直接書き込み不可
 *  - SELECT は verified 行のみ public。未verified は本人のみ可
 */

export interface SocialLink {
  platform: 'x' | 'youtube' | 'tiktok' | 'twitch' | 'blog';
  url: string;
}

export interface Creator {
  id: number;
  account_id: string;
  display_name: string;
  self_introduction: string;
  avatar_url: string | null;
  social_links: SocialLink[];
  roblox_profile_url: string;
  roblox_user_id: number | null;
  verification_code: string | null;
  verification_expires_at: string | null;
  verified_at: string | null;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreatorPublic {
  id: number;
  display_name: string;
  self_introduction: string;
  avatar_url: string | null;
  social_links: SocialLink[];
  roblox_profile_url: string;
  roblox_user_id: number | null;
  verified_at: string | null;
}

export interface CreatorGameRow {
  creator_id: number;
  universe_id: number;
  is_primary: boolean;
  registered_at: string;
}

export const CREATOR_DISPLAY_NAME_MIN = 1;
export const CREATOR_DISPLAY_NAME_MAX = 40;
export const CREATOR_INTRO_MIN = 0;
export const CREATOR_INTRO_MAX = 800;
export const CREATOR_SOCIAL_LINK_MAX = 5;
export const CREATOR_VERIFICATION_TTL_HOURS = 24;
export const CREATOR_CODE_REGEN_LIMIT_PER_DAY = 5;

const SOCIAL_PLATFORMS: SocialLink['platform'][] = [
  'x',
  'youtube',
  'tiktok',
  'twitch',
  'blog',
];

export function validateSocialLinks(value: unknown): SocialLink[] | { error: string } {
  if (!Array.isArray(value)) return { error: 'social_links must be array' };
  if (value.length > CREATOR_SOCIAL_LINK_MAX) {
    return { error: `social_links must be ≤ ${CREATOR_SOCIAL_LINK_MAX}` };
  }
  const out: SocialLink[] = [];
  for (const it of value) {
    if (!it || typeof it !== 'object') return { error: 'invalid social_link' };
    const r = it as Record<string, unknown>;
    const platform = r.platform;
    const urlStr = r.url;
    if (typeof platform !== 'string' || !SOCIAL_PLATFORMS.includes(platform as SocialLink['platform'])) {
      return { error: `invalid platform: ${String(platform)}` };
    }
    if (typeof urlStr !== 'string' || urlStr.length === 0 || urlStr.length > 300) {
      return { error: 'invalid url' };
    }
    try {
      const u = new URL(urlStr);
      if (!['http:', 'https:'].includes(u.protocol)) {
        return { error: 'url must be http(s)' };
      }
    } catch {
      return { error: 'malformed url' };
    }
    out.push({ platform: platform as SocialLink['platform'], url: urlStr });
  }
  return out;
}

export async function getCreatorByAccountId(
  supabase: SupabaseClient,
  accountId: string
): Promise<Creator | null> {
  const { data, error } = await supabase
    .from('creators')
    .select('*')
    .eq('account_id', accountId)
    .maybeSingle();
  if (error) {
    console.error('[getCreatorByAccountId]', error);
    return null;
  }
  return (data as Creator | null) ?? null;
}

export async function getCreatorById(
  supabase: SupabaseClient,
  id: number
): Promise<Creator | null> {
  const { data, error } = await supabase
    .from('creators')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    console.error('[getCreatorById]', error);
    return null;
  }
  return (data as Creator | null) ?? null;
}

export function toPublic(c: Creator): CreatorPublic {
  return {
    id: c.id,
    display_name: c.display_name,
    self_introduction: c.self_introduction,
    avatar_url: c.avatar_url,
    social_links: c.social_links ?? [],
    roblox_profile_url: c.roblox_profile_url,
    roblox_user_id: c.roblox_user_id,
    verified_at: c.verified_at,
  };
}

export async function listVerifiedCreators(
  supabase: SupabaseClient,
  limit = 100
): Promise<CreatorPublic[]> {
  const { data, error } = await supabase
    .from('creators')
    .select(
      'id, display_name, self_introduction, avatar_url, social_links, roblox_profile_url, roblox_user_id, verified_at'
    )
    .eq('is_verified', true)
    .order('verified_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('[listVerifiedCreators]', error);
    return [];
  }
  return (data as CreatorPublic[]) ?? [];
}

export interface CreatorGameDetail {
  universe_id: number;
  is_primary: boolean;
  registered_at: string;
  name: string;
  thumbnail_url: string | null;
  creator_name: string | null;
  playing: number | null;
}

export async function listCreatorGames(
  supabase: SupabaseClient,
  creatorId: number
): Promise<CreatorGameDetail[]> {
  const { data, error } = await supabase
    .from('creator_games')
    .select(
      'universe_id, is_primary, registered_at, games:games!inner(universe_id, name, thumbnail_url, creator_name)'
    )
    .eq('creator_id', creatorId)
    .order('is_primary', { ascending: false })
    .order('registered_at', { ascending: false });
  if (error) {
    console.error('[listCreatorGames]', error);
    return [];
  }
  // 直近 playing も欲しい。代表作1件だけJOINするとクエリが増えるので別取りはしない
  // Supabase の !inner JOIN は配列で返ることもあるので両対応
  type GameRow = {
    universe_id: number;
    name: string;
    thumbnail_url: string | null;
    creator_name: string | null;
  };
  type Row = {
    universe_id: number;
    is_primary: boolean;
    registered_at: string;
    games: GameRow | GameRow[] | null;
  };
  const rows = (data as unknown as Row[]) ?? [];
  return rows
    .map((r) => {
      const g = Array.isArray(r.games) ? r.games[0] ?? null : r.games;
      if (!g) return null;
      return {
        universe_id: r.universe_id,
        is_primary: r.is_primary,
        registered_at: r.registered_at,
        name: g.name,
        thumbnail_url: g.thumbnail_url,
        creator_name: g.creator_name,
        playing: null as number | null,
      };
    })
    .filter((x): x is CreatorGameDetail => x !== null);
}

export function isVerificationCodeExpired(creator: Creator): boolean {
  if (!creator.verification_expires_at) return true;
  return new Date(creator.verification_expires_at).getTime() < Date.now();
}

export function expirationFromNow(): string {
  return new Date(Date.now() + CREATOR_VERIFICATION_TTL_HOURS * 3600_000).toISOString();
}
