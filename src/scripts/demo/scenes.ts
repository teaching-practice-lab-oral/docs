import type { Ctx, ScriptMap } from './player';

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** Record → stop → send, shared by shadowing and role play. */
async function record(c: Ctx, seconds: number) {
  await c.click('#rec');
  c.hide('#recIdle');
  await c.reveal('#recOn');
  const timer = c.$('#timer');
  await c.tween(2200, (p) => { timer.textContent = mmss(p * seconds); });
  await c.click('#stop');
  c.hide('#recOn');
  await c.reveal('#recDone');
  await c.wait(600);
  await c.click('#send');
  c.hide('#recDone');
}

export const scripts: ScriptMap = {
  // ---------- Student ----------
  'student:job': async (c) => {
    await c.wait(600);
    await c.type('#pos', { cps: 8 });
    await c.type('#desc', { cps: 90 });
    await c.type('#comp', { cps: 90 });
    await c.click('#save');
    await c.toast('職位資料已儲存，正在建立四題不同的個人化提示。', 2600);
  },

  'student:draft1': async (c) => {
    await c.wait(800);
    await c.type('#ans', { cps: 60 });
    await c.click('#save');
    await c.reveal('#saved', { follow: false });
    await c.wait(600);
    await c.click('#getFb');
    await c.reveal('#proc');
    await c.wait(2500);
  },

  'student:feedback': async (c) => {
    await c.wait(700);
    for (const card of c.$$('.cc')) {
      await c.reveal(card);
      await c.wait(1600);
    }
    await c.reveal('#pol');
    await c.wait(1800);
    await c.reveal('#final');
    // The system fills Final Draft with the suggested sample; the student edits and saves.
    const box = c.$('#finalText');
    box.textContent = (c.$('#polishedText') as HTMLTemplateElement).content.textContent;
    box.classList.add('filled-flash');
    await c.follow(box);
    await c.wait(1400);
    await c.click('#save');
    await c.reveal('#saved', { follow: false });
    await c.wait(800);
  },

  'student:shadow': async (c) => {
    const words = c.$$('#sub .w');
    const end = Number(words[words.length - 1].dataset.e);
    const time = c.$('#time');
    const bar = c.$('#bar');
    await c.wait(600);
    await c.click('#play');
    const rate = 1.25;
    await c.tween((end * 1000) / rate, (p) => {
      const t = p * end;
      bar.style.width = `${p * 100}%`;
      time.textContent = `${mmss(t)} / ${mmss(end)}`;
      for (const w of words) {
        const s = Number(w.dataset.s);
        const e = Number(w.dataset.e);
        w.classList.toggle('now', t >= s && t < e);
        w.classList.toggle('past', t >= e && p < 1);
      }
    });
    words.forEach((w) => w.classList.remove('now', 'past'));
    await c.wait(500);
    await record(c, 36);
    await c.reveal('#result');
    await c.wait(1500);
  },

  'student:roleplay': async (c) => {
    const prog = c.$('#prog');
    const turns = c.$$('[id^="q"]').length;
    await c.wait(500);
    // Turn 1 in full, turns 2–4 briefly, then the follow-up question.
    for (let i = 0; i < turns; i++) {
      await c.reveal(`#q${i}`);
      const full = i === 0 || i === turns - 1;
      if (full) {
        await c.wait(1600);
        await c.reveal('#recIdle', { follow: false });
        await c.follow('#recIdle');
        await record(c, 40);
        await c.reveal('#recIdle', { follow: false });
      } else {
        await c.wait(700);
      }
      await c.reveal(`#a${i}`);
      const core = Math.min(i + 1, turns - 1);
      prog.textContent = `核心題 ${core}/${turns - 1}・追問 ${i === turns - 1 ? 1 : 0}/1`;
      await c.wait(full ? 1500 : 500);
    }
    c.hide('#recIdle');
  },

  'student:report': async (c) => {
    await c.wait(600);
    for (const card of c.$$('.an-card')) {
      await c.reveal(card);
      await c.wait(1100);
    }
    await c.reveal('#good');
    await c.wait(1500);
    await c.reveal('#improve');
    await c.wait(1500);
    await c.click('#next');
  },

  'student:reflection': async (c) => {
    await c.wait(600);
    await c.type('#r0', { cps: 45 });
    await c.type('#r1', { cps: 70 });
    // The remaining answers are filled in quickly.
    for (const id of ['#r2', '#r3', '#r4']) {
      const box = c.$(id);
      box.textContent = box.dataset.text ?? '';
      await c.follow(box);
      await c.wait(400);
    }
    await c.click('#submit');
    await c.toast('心得已正式送出，本次作業完成。', 2600);
  },

  // ---------- Teacher ----------
  'teacher:rubrics': async (c) => {
    await c.wait(700);
    await c.click('#ver');
    c.$('#ver').classList.add('on');
    c.hide('#rbEmpty');
    await c.reveal('#rbEditor', { follow: false });
    await c.wait(900);
    await c.follow('#rbNotes', 'top');
    await c.wait(2200);
    for (const d of c.$$('.dim')) {
      await c.follow(d, 'top');
      await c.wait(d.id === 'dim0' ? 3200 : 1300);
    }
    await c.follow('#rbFoot');
    await c.wait(1600);
  },

  'teacher:create': async (c) => {
    const step = (n: number) => {
      c.$$('.wz-i').forEach((s, i) => {
        s.classList.toggle('on', i === n);
        s.classList.toggle('done', i < n);
      });
    };
    const pick = (sel: string) => {
      const box = c.$(sel);
      box.classList.add('set');
      box.firstElementChild!.textContent = box.dataset.v ?? '';
    };
    await c.wait(1000);
    await c.type('#t', { cps: 10 });
    await c.type('#d', { cps: 80 });
    await c.type('#ctx', { cps: 90 });
    await c.click('#qs');
    pick('#qs');
    c.hide('#qp0');
    await c.reveal('#qp');
    await c.wait(1600);
    await c.click('#n2');
    c.hide('#w2'); step(1);
    await c.reveal('#w3', { follow: false });
    await c.follow('.wz', 'top');
    await c.wait(1400);
    await c.click('#n3');
    c.hide('#w3'); step(2);
    await c.reveal('#w4', { follow: false });
    await c.wait(2400);
    await c.follow('#submit');
    await c.click('#submit');
    await c.toast('作業已建立，學生登入後即可開始練習。', 2400);
  },

  'teacher:assignments': async (c) => {
    await c.wait(400);
    for (const card of c.$$('.adm-card')) {
      await c.reveal(card, { follow: false });
      await c.wait(250);
    }
    await c.wait(1200);
    await c.click('#open');
    await c.wait(600);
  },

  'teacher:overview': async (c) => {
    await c.wait(500);
    c.$$('.prog i').forEach((i) => { i.style.width = `${i.dataset.w}%`; });
    await c.wait(1600);
    await c.click('#fWait');
    c.$('#fAll').classList.remove('on');
    c.$('#fWait').classList.add('on');
    c.$$('tbody tr').forEach((tr) => { if (tr.dataset.status !== 'wait') tr.classList.add('is-hidden'); });
    await c.wait(1000);
    await c.click('#grade');
    await c.wait(500);
  },

  'teacher:detail': async (c) => {
    await c.wait(1200);
    for (const id of ['#s1', '#s2', '#s3', '#s4']) {
      await c.follow(id, 'top');
      await c.wait(id === '#s3' ? 2600 : 1600);
    }
    await c.follow('#s5', 'top');
    await c.click('#loadRec');
    c.hide('#loadRec');
    await c.reveal('#aud', { follow: false });
    const bar = c.$('#audBar');
    const t = c.$('#audT');
    await c.tween(3200, (p) => { bar.style.width = `${p * 100}%`; t.textContent = mmss(p * 24.4); });
    await c.wait(600);
    for (const id of ['#s6', '#s7', '#s8']) {
      await c.follow(id, 'top');
      await c.wait(2000);
    }
    await c.follow('#hist', 'top');
    await c.wait(800);
  },

  'teacher:grading': async (c) => {
    await c.wait(1000);
    const selects = c.$$('.select');
    let sum = 0;
    for (const [i, sel] of selects.entries()) {
      await c.click(sel);
      sel.classList.add('set');
      sel.firstElementChild!.textContent = sel.dataset.v ?? '';
      sum += Number(sel.dataset.p);
      if (i === selects.length - 1) c.$('#sum').textContent = sum.toFixed(2);
      await c.wait(350);
    }
    await c.follow('#sum');
    await c.wait(800);
    await c.type('#final', { cps: 6 });
    await c.type('#comment', { cps: 40 });
    await c.type('#fb', { cps: 50 });
    await c.click('#save');
    const badge = c.$('#badge');
    badge.textContent = '已批改';
    badge.className = 'pill done';
    await c.follow(badge, 'top');
    await c.wait(1800);
  },
};
