-- 0020 の追補：tip_disclosure_logs.ip_address を NULL 許容にする。
--
-- 理由：x-forwarded-for / x-real-ip が取得できない稀なリクエストで、
--       無効値（'unknown' 等）を INET にキャストすると失敗するため。
--       有効な IP が取れた時だけ記録し、取れなければ NULL を入れる
--       （IP が無ければそもそも発信者特定に使えないので NULL で問題ない）。
ALTER TABLE tip_disclosure_logs ALTER COLUMN ip_address DROP NOT NULL;
