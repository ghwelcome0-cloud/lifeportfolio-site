// tools/production_kit/templates/render_helpers.js
// Common HTML rendering helpers (escape, table, mv-card, etc.)

const fs = require('fs');
const path = require('path');

function esc(s){
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderTable(headers, rows, opts){
  opts = opts || {};
  var ths = headers.map(function(h, i){
    var cls = (opts.center && opts.center.indexOf(i) >= 0) ? ' class="center"' : '';
    return '<th' + cls + '>' + esc(h) + '</th>';
  }).join('');
  var trs = rows.map(function(row){
    var tds = row.map(function(cell, i){
      var classes = [];
      if (opts.center && opts.center.indexOf(i) >= 0) classes.push('center');
      if (opts.mono   && opts.mono.indexOf(i) >= 0)   classes.push('mono');
      var cls = classes.length ? ' class="' + classes.join(' ') + '"' : '';
      return '<td' + cls + '>' + (cell == null ? '' : (typeof cell === 'string' ? esc(cell) : cell)) + '</td>';
    }).join('');
    return '<tr>' + tds + '</tr>';
  }).join('\n');
  return '<table class="tbl"><thead><tr>' + ths + '</tr></thead><tbody>' + trs + '</tbody></table>';
}

function renderMvCard(kind, headline, subline, diary){
  var emoji = kind === 'vision' ? '🌅' : '🎯';
  var cls = kind === 'vision' ? 'mv-card vision' : 'mv-card';
  return '<div class="' + cls + '">' +
         '  <div class="mv-tier1"><span class="mv-emoji">' + emoji + '</span>' + esc(headline || '') + '</div>' +
         (subline ? '  <div class="mv-tier2">' + esc(subline) + '</div>' : '') +
         (diary ? '  <div class="mv-tier3">' + esc(diary) + '</div>' : '') +
         '</div>';
}

function toneChip(tone){
  return '<span class="tone-chip" style="background:' + tone.color + '">' + tone.emoji + ' ' + esc(tone.label) + '</span>';
}

function axisPill(axisId, label){
  var clsMap = { self_understanding:'su', self_expression:'se', self_design:'sd', self_execution:'sx' };
  var cls = clsMap[axisId] || '';
  return '<span class="axis-pill ' + cls + '">' + esc(label) + '</span>';
}

function loadCss(){
  return fs.readFileSync(path.join(__dirname, 'theme.css'), 'utf8');
}

function pageWrap(html){ return '<section class="page">' + html + '</section>'; }

module.exports = { esc, renderTable, renderMvCard, toneChip, axisPill, loadCss, pageWrap };
