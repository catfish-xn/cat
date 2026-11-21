// Offline SFNT cmap inspection. Glyph ID zero means missing, even in a covered range.
export const CHINESE_PROBE = '金币等级经验人口刷新出售锁定阶段战斗胜负羁绊装备强化选择淘汰排名帮助全屏音效匹配连接通缉';
export function fontCoverage(bytes) {
  const u16 = p => bytes.readUInt16BE(p), u32 = p => bytes.readUInt32BE(p);
  const bound = (p, n) => { if (p < 0 || n < 0 || p + n > bytes.length) throw new Error('font-table-bounds'); };
  bound(0, 12);
  const tables = u16(4); bound(12, tables * 16);
  let cmap;
  for (let i = 0; i < tables; i++) {
    const p = 12 + i * 16;
    if (bytes.toString('ascii', p, p + 4) === 'cmap') { cmap = u32(p + 8); bound(cmap, u32(p + 12)); }
  }
  if (cmap === undefined) throw new Error('font-cmap-missing');
  bound(cmap, 4); const count = u16(cmap + 2); bound(cmap + 4, count * 8);
  const subtables = [];
  for (let i = 0; i < count; i++) {
    const p = cmap + 4 + i * 8, platform = u16(p), encoding = u16(p + 2);
    if (platform !== 0 && !(platform === 3 && [1, 10].includes(encoding))) continue;
    const at = cmap + u32(p + 4); bound(at, 2); const format = u16(at);
    if (![4, 12].includes(format)) continue;
    bound(at, format === 4 ? 8 : 16);
    const length = format === 4 ? u16(at + 2) : u32(at + 4); bound(at, length);
    subtables.push({ at, format, end: at + length });
  }
  if (!subtables.length) throw new Error('font-unicode-cmap-missing');
  const has = code => subtables.some(({ at, format, end }) => {
    if (format === 12) {
      const groups = u32(at + 12); if (at + 16 + groups * 12 > end) throw new Error('font-cmap-bounds');
      for (let i = 0; i < groups; i++) {
        const p = at + 16 + i * 12, first = u32(p), last = u32(p + 4);
        if (code >= first && code <= last) return u32(p + 8) + code - first !== 0;
      }
      return false;
    }
    if (code > 65535) return false;
    const segments = u16(at + 6) / 2, ends = at + 14, starts = ends + segments * 2 + 2,
      deltas = starts + segments * 2, offsets = deltas + segments * 2;
    if (!Number.isInteger(segments) || offsets + segments * 2 > end) throw new Error('font-cmap-bounds');
    for (let i = 0; i < segments; i++) {
      if (code < u16(starts + i * 2) || code > u16(ends + i * 2)) continue;
      const offset = u16(offsets + i * 2), delta = u16(deltas + i * 2);
      if (!offset) return ((code + delta) & 65535) !== 0;
      const p = offsets + i * 2 + offset + (code - u16(starts + i * 2)) * 2;
      if (p + 2 > end) throw new Error('font-cmap-bounds');
      const glyph = u16(p); return glyph !== 0 && ((glyph + delta) & 65535) !== 0;
    }
    return false;
  });
  const probe = [...new Set(CHINESE_PROBE)], missing = probe.filter(c => !has(c.codePointAt(0)));
  let cjkUnifiedGlyphs = 0;
  for (let c = 0x4e00; c <= 0x9fff; c++) if (has(c)) cjkUnifiedGlyphs++;
  return { method: 'sfnt-unicode-cmap-4-12', formats: [...new Set(subtables.map(t => t.format))],
    latinPrintable: Array.from({ length: 95 }, (_, i) => i + 32).filter(has).length,
    cjkUnifiedGlyphs, chineseProbe: probe.join(''), missingChineseProbe: missing.join(''),
    chineseProbeCovered: missing.length === 0 };
}
