// js/utils.js
export function escapeHTML(str) {
  if (!str) return '';
  return String(str).replace(/[&<>'"]/g, match => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[match]));
}

export function getNormalizedListType(lvl) {
  if (!lvl) return 'demon';
  const typeStr = String(lvl.listType || lvl.type || lvl.category || lvl.diff || lvl.difficulty || '').toLowerCase();
  if (typeStr.includes('challenge')) return 'challenge';
  if (typeStr.includes('platformer')) return 'platformer';
  return 'demon'; 
}

export function getRecordList(lvl) {
  if (!lvl) return [];
  if (Array.isArray(lvl.victorList)) return lvl.victorList;
  if (Array.isArray(lvl.records)) return lvl.records;
  if (Array.isArray(lvl.completions)) return lvl.completions;
  if (Array.isArray(lvl.victors)) return lvl.victors;
  if (Array.isArray(lvl.players)) return lvl.players;
  return [];
}

export function prepareEscapedDisplayValues(levels) {
  for (const lvl of levels) {
    lvl._escapedCampus = escapeHTML(
      String(lvl.campus || 'Main Campus').trim()
    );

    lvl._escapedName = escapeHTML(
      String(lvl.name || lvl.levelName || 'Unnamed')
    );

    for (const record of getRecordList(lvl)) {
      record._escapedUsername = escapeHTML(
        String(
          record.username ||
          record.name ||
          record.player ||
          record.user ||
          ''
        ).trim()
      );

      record._escapedCampus = escapeHTML(
        String(record.campus || 'Main Campus').trim()
      );

      record._escapedVideo = escapeHTML(record.video || '#');
    }
  }
}

export function calculateLevelPoints(rank) {
  if (isNaN(rank) || rank <= 0 || rank > 150) return 0;
  if (rank <= 20) return 350.00 - (rank - 1) * 12.51; 
  if (rank <= 75) return 112.23 - (rank - 20) * 1.30;
  return 40.60 - (rank - 75) * 0.29;
}
