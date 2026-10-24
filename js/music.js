// BGMデータ（1トークン＝16分音符。"." は伸ばす、"-" は休符）
(function () {
  'use strict';
  const G = globalThis.G;

  // コード名 → 16分の分散和音1小節
  const CH = {
    Am: ['A3', 'C4', 'E4'], F: ['F3', 'A3', 'C4'], C: ['C4', 'E4', 'G4'], G: ['G3', 'B3', 'D4'], Dm: ['D4', 'F4', 'A4'],
    E: ['E3', 'G#3', 'B3'], Bb: ['Bb3', 'D4', 'F4'], Gm: ['G3', 'Bb3', 'D4'], A: ['A3', 'C#4', 'E4'], Em: ['E3', 'G3', 'B3'],
    D: ['D4', 'F#4', 'A4'], B: ['B3', 'D#4', 'F#4'], Cm: ['C4', 'Eb4', 'G4'], Ab: ['Ab3', 'C4', 'Eb4'], Fm: ['F3', 'Ab3', 'C4'],
  };
  const up = (n, o) => n.replace(/\d/, (d) => String(+d + o));
  function arp(chords, pat, oct) {
    // pat 例: [0,1,2,1] を4回で1小節
    return chords
      .map((c) => {
        const notes = CH[c].map((n) => up(n, oct || 0));
        notes.push(up(notes[0], 1));
        const bar = [];
        for (let i = 0; i < 16; i++) bar.push(notes[pat[i % pat.length]]);
        return bar.join(' ');
      })
      .join(' | ');
  }
  function bass(chords, pat, oct) {
    return chords
      .map((c) => {
        const root = up(CH[c][0], (oct == null ? -1 : oct));
        const hi = up(root, 1);
        return pat.replace(/R/g, root).replace(/H/g, hi);
      })
      .join(' | ');
  }

  G.SONGS = {
    title: {
      bpm: 88,
      ch: [
        {
          inst: 'sq12', vol: 0.09,
          seq: `A5 . . . C6 . . . E6 . . . D6 . C6 . | B5 . . . A5 . . . . . . . - - - - |
                G5 . . . A5 . . . C6 . . . E6 . . . | D6 . . . . . . . B5 . . . - - - - |
                A5 . . . C6 . . . E6 . . . A6 . . . | G6 . F6 . E6 . . . C6 . . . . . . . |
                D6 . . . E6 . . . F6 . . . E6 . D6 . | E6 . . . . . . . G#5 . . . . . . .`,
        },
        { inst: 'sq25', vol: 0.035, seq: arp(['Am', 'F', 'C', 'G', 'Am', 'F', 'Dm', 'E'], [0, 1, 2, 1], 1) },
        { inst: 'tri', vol: 0.16, seq: bass(['Am', 'F', 'C', 'G', 'Am', 'F', 'Dm', 'E'], 'R . . . . . . . R . . . . . . .', -1) },
      ],
    },
    grass: {
      bpm: 144,
      ch: [
        {
          inst: 'sq25', vol: 0.075,
          seq: `E5 . G5 . C6 . G5 . A5 . G5 . E5 . C5 . | D5 . G5 . B5 . . . A5 . G5 . D5 . . . |
                C5 . E5 . A5 . . . G5 . E5 . C5 . E5 . | F5 . . . A5 . . . G5 . F5 . E5 . D5 . |
                E5 . G5 . C6 . . . D6 . C6 . B5 . C6 . | D6 . . . B5 . G5 . A5 . B5 . D6 . . . |
                C6 . A5 . F5 . A5 . B5 . G5 . D5 . G5 . | C6 . . . G5 . E5 . C5 . . . - - - -`,
        },
        {
          inst: 'sq12', vol: 0.04,
          seq: `(- - E4 . - - G4 . - - E4 . - - G4 .)*1 | (- - D4 . - - G4 . - - D4 . - - B3 .)*1 |
                (- - C4 . - - E4 . - - C4 . - - E4 .)*1 | (- - C4 . - - F4 . - - C4 . - - A3 .)*1 |
                (- - E4 . - - G4 . - - E4 . - - G4 .)*1 | (- - D4 . - - G4 . - - D4 . - - B3 .)*1 |
                - - C4 . - - F4 . - - D4 . - - G4 . | - - E4 . - - G4 . - - C5 . - - - -`,
        },
        { inst: 'tri', vol: 0.18, seq: bass(['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'C'], 'R . H . R . H . R . H . R . H .', -1) },
        { inst: 'drum', vol: 0.16, seq: '(k - h - s - h - k - h k s - h -)*8' },
      ],
    },
    cave: {
      bpm: 112,
      ch: [
        { inst: 'sq12', vol: 0.045, seq: arp(['Dm', 'Bb', 'C', 'Dm', 'Dm', 'Bb', 'Gm', 'A'], [0, 1, 2, 3, 2, 1, 0, 1], 0) },
        {
          inst: 'tri', vol: 0.13,
          seq: `A5 . . . . . . . G5 . F5 . E5 . . . | F5 . . . . . . . D5 . . . . . . . |
                E5 . . . G5 . . . C6 . . . . . . . | A5 . . . . . . . . . . . . . . . |
                D6 . . . C6 . A5 . F5 . . . . . . . | G5 . . . F5 . D5 . . . . . . . . . |
                Bb5 . . . A5 . G5 . D5 . . . . . . . | C#5 . . . E5 . . . A5 . . . . . . .`,
        },
        { inst: 'tri', vol: 0.15, seq: bass(['Dm', 'Bb', 'C', 'Dm', 'Dm', 'Bb', 'Gm', 'A'], 'R . . . . . . . R . . . R . . .', -2) },
        { inst: 'drum', vol: 0.1, seq: '(k - - - - - - - s - - - - - h -)*8' },
      ],
    },
    boss: {
      bpm: 168,
      ch: [
        {
          inst: 'sq25', vol: 0.075,
          seq: `E5 . . . G5 . . . B5 . . . A5 . G5 . | E5 . . . . . . . C5 . D5 . E5 . . . |
                F#5 . . . A5 . . . D6 . . . C6 . A5 . | B5 . . . . . . . D#5 . F#5 . B5 . . . |
                E6 . . . D6 . B5 . G5 . . . B5 . . . | C6 . . . B5 . G5 . E5 . . . G5 . . . |
                A5 . C6 . E6 . . . D#6 . . . B5 . . . | E6 . . . . . . . E5 . F#5 . G5 . B5 .`,
        },
        { inst: 'sq12', vol: 0.04, seq: arp(['Em', 'C', 'D', 'B', 'Em', 'C', 'Am', 'Em'], [0, 3, 0, 2], 1) },
        { inst: 'tri', vol: 0.2, seq: bass(['Em', 'C', 'D', 'B', 'Em', 'C', 'Am', 'Em'], 'R . H . R . H . R . H . R H R H', -1) },
        { inst: 'drum', vol: 0.17, seq: '(k - h - s - h - k k h - s - h h)*8' },
      ],
    },
    castle: {
      bpm: 126,
      ch: [
        { inst: 'sq25', vol: 0.045, seq: arp(['Gm', 'D', 'Gm', 'D', 'Cm', 'Gm', 'D', 'Gm'], [0, 1, 2, 1], 0) },
        {
          inst: 'sq50', vol: 0.05,
          seq: `G5 . . . A5 . Bb5 . A5 . G5 . F#5 . G5 . | A5 . . . D5 . . . F#5 . . . A5 . . . |
                Bb5 . . . A5 . G5 . D6 . . . Bb5 . . . | A5 . . . . . . . F#5 . . . D5 . . . |
                C6 . . . Bb5 . A5 . G5 . . . Eb5 . . . | D5 . . . G5 . . . Bb5 . . . D6 . . . |
                C6 . Bb5 . A5 . G5 . F#5 . . . A5 . . . | G5 . . . . . . . - - - - D5 . . .`,
        },
        { inst: 'tri', vol: 0.17, seq: bass(['Gm', 'D', 'Gm', 'D', 'Cm', 'Gm', 'D', 'Gm'], 'R . . . R . . . R . . . H . R .', -1) },
        { inst: 'drum', vol: 0.11, seq: '(k - - - h - - - s - - - h - - -)*8' },
      ],
    },
    sky: {
      bpm: 116,
      ch: [
        {
          inst: 'sq25', vol: 0.07,
          seq: `A5 . . . . . D6 . . . C6 . . . A5 . | Bb5 . . . . . F5 . . . D5 . . . F5 . |
                A5 . . . . . C6 . . . F6 . . . E6 . | E6 . . . . . . . C6 . . . G5 . . . |
                A5 . . . D6 . . . E6 . . . F6 . . . | F6 . . . E6 . D6 . . . . . Bb5 . . . |
                C6 . . . . . D6 . . . E6 . . . G6 . | G6 . . . . . . . E6 . . . C6 . . .`,
        },
        { inst: 'sq12', vol: 0.04, seq: arp(['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'C', 'C'], [0, 2, 3, 2, 1, 2, 3, 2], 0) },
        { inst: 'tri', vol: 0.17, seq: bass(['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'C', 'C'], 'R . R . H . R . R . R . H . R .', -1) },
        { inst: 'drum', vol: 0.13, seq: '(k - - h s - - h k - k h s - h h)*8' },
      ],
    },
    final: {
      bpm: 176,
      ch: [
        {
          inst: 'sq25', vol: 0.08,
          seq: `C5 . Eb5 . G5 . C6 . Bb5 . G5 . Eb5 . G5 . | Ab5 . . . C6 . . . Eb6 . . . C6 . . . |
                Bb5 . . . D6 . . . F6 . . . D6 . Bb5 . | B5 . . . D6 . . . G6 . . . F6 . D6 . |
                Eb6 . . . D6 . C6 . G5 . . . C6 . Eb6 . | F6 . . . Eb6 . C6 . Ab5 . . . C6 . . . |
                Ab5 . C6 . F6 . . . G6 . . . B5 . D6 . | C6 . . . . . . . G5 . . . C6 . . .`,
        },
        { inst: 'sq12', vol: 0.045, seq: arp(['Cm', 'Ab', 'Bb', 'G', 'Cm', 'Ab', 'Fm', 'Cm'], [0, 1, 2, 3], 1) },
        { inst: 'tri', vol: 0.2, seq: bass(['Cm', 'Ab', 'Bb', 'G', 'Cm', 'Ab', 'Fm', 'Cm'], 'R H R H R H R H R H R H R H R H', -1) },
        { inst: 'drum', vol: 0.17, seq: '(k h s h k k s h k h s h k k s s)*8' },
      ],
    },
    ending: {
      bpm: 96,
      ch: [
        {
          inst: 'sq50', vol: 0.06,
          seq: `A5 . . . G5 . F5 . E5 . . . C5 . . . | D5 . . . E5 . F5 . G5 . . . . . . . |
                G5 . . . F5 . E5 . B4 . . . E5 . . . | C5 . . . D5 . E5 . A5 . . . . . . . |
                F5 . . . E5 . D5 . A5 . . . F5 . . . | G5 . . . A5 . B5 . D6 . . . . . . . |
                C6 . . . B5 . G5 . E5 . . . G5 . . . | C6 . . . . . . . - - - - - - - -`,
        },
        { inst: 'sq12', vol: 0.035, seq: arp(['F', 'G', 'Em', 'Am', 'Dm', 'G', 'C', 'C'], [0, 1, 2, 3, 2, 1, 0, 1], 1) },
        { inst: 'tri', vol: 0.15, seq: bass(['F', 'G', 'Em', 'Am', 'Dm', 'G', 'C', 'C'], 'R . . . . . . . H . . . . . . .', -1) },
        { inst: 'drum', vol: 0.08, seq: '(k - - - h - - - s - - - h - - -)*8' },
      ],
    },
  };
})();
