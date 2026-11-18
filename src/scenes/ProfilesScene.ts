// Pick a profile card or create a new player (name, grade, scarf).
import Phaser from 'phaser';
import { ANIM, SCARF_COLOURS, TEX, bgKey, juniperAnim, juniperKey } from '../art/keys';
import { ensureZoneArt, releaseZoneArt } from '../art';
import { addHeroFigure } from '../core/heroArt';
import { Grade, Profile } from '../types';
import { createProfile, deleteProfile, MAX_NAME, MAX_PROFILES, save } from '../core/save';
import { session } from '../core/session';
import { audio } from '../core/audio';
import { addPanel, addText, makeButton, makeIconButton, makeMuteButton, starBurst, textStyle, wobble } from '../core/ui';

const GRADE_LABEL = ['1st', '2nd', '3rd', '4th'];

export class ProfilesScene extends Phaser.Scene {
  private layer!: Phaser.GameObjects.Container;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor() {
    super('Profiles');
  }

  create() {
    audio.setMusic('menu');
    ensureZoneArt(this, 0);
    releaseZoneArt(this, 0, [0]);
    this.add.image(640, 480, bgKey(0, 'sky'));
    this.add.image(640, 480, bgKey(0, 'far')).setAlpha(0.8);
    makeMuteButton(this).root.setDepth(100);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.setKeys(null));
    this.showList();
  }

  private reset() {
    this.layer?.destroy();
    this.layer = this.add.container(0, 0);
    this.setKeys(null);
  }

  private setKeys(h: ((e: KeyboardEvent) => void) | null) {
    if (this.keyHandler) this.input.keyboard?.off('keydown', this.keyHandler);
    this.keyHandler = h;
    if (h) this.input.keyboard?.on('keydown', h);
  }

  // ---------- list ----------

  private showList() {
    this.reset();
    this.layer.add(addText(this, 640, 80, 'Who is playing?', 64));
    const back = makeIconButton(this, 80, 80, TEX.iconBack, () => this.scene.start('Title'), 100);
    this.layer.add(back.root);
    const slots = [...save.profiles];
    const n = Math.min(MAX_PROFILES, slots.length + (slots.length < MAX_PROFILES ? 1 : 0));
    for (let i = 0; i < n; i++) {
      const x = 260 + (i % 3) * 380;
      const y = 340 + Math.floor(i / 3) * 380;
      const p = slots[i];
      if (p) this.profileCard(x, y, p);
      else this.newCard(x, y);
    }
  }

  private profileCard(x: number, y: number, p: Profile) {
    const card = addPanel(this, x, y, 340, 340);
    card.setInteractive({ useHandCursor: true });
    card.on('pointerup', () => {
      audio.sfx('click');
      session.select(p.id);
      this.scene.start('Map');
    });
    const goat = addHeroFigure(this, x, y + 40, p.hero, p.scarf, 0.85);
    const name = addText(this, x, y + 80, p.name, 44);
    if (name.width > 300) name.setScale(300 / name.width);
    const gems = p.zones.reduce((a, z) => a + z.gems.filter(Boolean).length, 0);
    const badge: Phaser.GameObjects.GameObject[] = [];
    const lead = p.dadMode ? `Dad Lv ${p.dad?.level ?? 1}` : `${GRADE_LABEL[p.grade - 1]} grade`;
    const info = addText(this, x, y + 130, `${lead} · ${gems} gems`, 36, { color: '#eec07a' });
    if (info.width > 310) info.setScale(310 / info.width);
    if (p.dadMode) {
      // small "Dad mode" badge in the card's top-left corner
      const bg = this.add.graphics();
      bg.fillStyle(0x040a06, 1).fillRoundedRect(x - 150, y - 160, 150, 40, 10);
      bg.lineStyle(3, 0x55ff88, 1).strokeRoundedRect(x - 150, y - 160, 150, 40, 10);
      const t = this.add.text(x - 75, y - 140, 'Dad mode', { fontFamily: '"Consolas","Menlo","Courier New",monospace', fontSize: '24px', color: '#7dff9a', resolution: 2 }).setOrigin(0.5);
      badge.push(bg, t);
    }
    const del = this.add.container(x + 140, y - 140);
    const delFace = this.add.image(0, 0, TEX.buttonRound, 0).setDisplaySize(76, 76).setTint(0xd86a8a);
    del.add([delFace, addText(this, 0, -3, '✕', 36)]);
    delFace.setInteractive({ useHandCursor: true });
    delFace.on('pointerup', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      audio.sfx('click');
      this.confirmDelete(p);
    });
    this.layer.add([card, goat, name, info, del, ...badge]);
  }

  private newCard(x: number, y: number) {
    const card = addPanel(this, x, y, 340, 340).setAlpha(0.9);
    card.setInteractive({ useHandCursor: true });
    card.on('pointerup', () => {
      audio.sfx('click');
      this.showCreate();
    });
    this.layer.add([card, addText(this, x, y - 30, '+', 140, { color: '#ffc93c' }), addText(this, x, y + 100, 'New player', 40)]);
  }

  private confirmDelete(p: Profile) {
    const box = this.add.container(0, 0).setDepth(200);
    const dim = this.add.rectangle(640, 480, 1280, 960, 0x1d1a3a, 0.7).setInteractive();
    const panel = addPanel(this, 640, 480, 760, 420);
    const msg = addText(this, 640, 400, `Delete ${p.name}?\nThis can't be undone.`, 46);
    const yes = makeButton(this, 470, 560, 300, 120, 'Delete', () => {
      deleteProfile(p.id);
      if (session.profile === undefined) session.clear();
      box.destroy();
      this.showList();
    }, 48, 0xd86a8a);
    const no = makeButton(this, 810, 560, 300, 120, 'Keep', () => box.destroy(), 48, 0x8fd18a);
    box.add([dim, panel, msg, yes.root, no.root]);
  }

  // ---------- create ----------

  private showCreate() {
    this.reset();
    let name = '';
    let grade: Grade = 1;
    let scarf = save.profiles.length % SCARF_COLOURS.length;
    const L = this.layer;
    L.add(makeIconButton(this, 80, 80, TEX.iconBack, () => this.showList(), 100).root);
    L.add(addText(this, 420, 66, 'New player', 52));

    // name field
    const field = this.add.container(440, 180);
    const fg = this.add.graphics();
    fg.fillStyle(0xfff8ea, 1).fillRoundedRect(-330, -55, 660, 110, 26);
    fg.lineStyle(6, 0x1d1a3a, 1).strokeRoundedRect(-330, -55, 660, 110, 26);
    const nameText = this.add.text(-300, -2, '', textStyle(60, { color: '#1d1a3a', stroke: '#fff8ea', strokeThickness: 2 })).setOrigin(0, 0.5);
    const placeholder = this.add.text(-300, -2, 'Type your name', textStyle(44, { color: '#9a94b8', stroke: '#fff8ea', strokeThickness: 2 })).setOrigin(0, 0.5);
    const caret = this.add.rectangle(-296, 0, 6, 64, 0x1d1a3a);
    this.tweens.add({ targets: caret, alpha: 0, duration: 450, yoyo: true, repeat: -1 });
    field.add([fg, placeholder, nameText, caret]);
    L.add(field);
    const refresh = () => {
      nameText.setText(name);
      placeholder.setVisible(!name);
      caret.x = -296 + nameText.width;
      go.setEnabled(name.length > 0);
      showDad(name.trim().toLowerCase() === 'dad');
    };
    const typeLetter = (ch: string) => {
      if (name.length >= MAX_NAME) return wobble(this, field);
      name += name.length === 0 ? ch.toUpperCase() : ch.toLowerCase();
      refresh();
    };
    const backspace = () => {
      name = name.slice(0, -1);
      refresh();
    };

    // preview
    const goat = this.add.sprite(1060, 340, juniperKey(scarf), 0).setOrigin(0.5, 1).setScale(0.95);
    goat.play(juniperAnim(ANIM.idle, scarf));
    L.add(goat);

    // letter keyboard (alphabetical rows for young readers)
    const rows = ['ABCDEFGHIJ', 'KLMNOPQRST', 'UVWXYZ'];
    const kw = 96;
    const gap = 10;
    rows.forEach((row, r) => {
      const y = 400 + r * (kw + gap);
      const x0 = 115 + kw / 2;
      [...row].forEach((ch, i) => {
        const b = makeButton(this, x0 + i * (kw + gap), y, kw, kw, ch, () => typeLetter(ch), 48);
        L.add(b.root);
      });
      if (r === 2) {
        const b = makeButton(this, x0 + 6 * (kw + gap) + kw / 2 + 50, y, 2 * kw + gap + 100, kw, '⌫ Back', backspace, 44, 0xd6fbff);
        L.add(b.root);
      }
    });

    // grade picker
    L.add(addText(this, 150, 730, 'Grade', 44));
    const gradeRing = this.add.graphics();
    L.add(gradeRing);
    const gradeX = (g: number) => 340 + (g - 1) * 180;
    // hidden fifth option: typing the name "Dad" reveals it (and selects it); any other name hides it
    const DAD_X = gradeX(5);
    let dadBtn: Phaser.GameObjects.Container | null = null;
    let dadSel = false;
    const drawGrade = () => {
      const gx = dadSel ? DAD_X : gradeX(grade);
      gradeRing.clear().lineStyle(10, dadSel ? 0x55ff88 : 0xffc93c, 1).strokeRoundedRect(gx - 86, 730 - 62, 172, 124, 30);
    };
    ([1, 2, 3, 4] as Grade[]).forEach((g) => {
      const b = makeButton(this, gradeX(g), 730, 156, 110, GRADE_LABEL[g - 1], () => {
        grade = g;
        dadSel = false;
        drawGrade();
      }, 48);
      L.add(b.root);
    });
    const showDad = (on: boolean) => {
      if (on && !dadBtn) {
        const b = makeButton(this, DAD_X, 730, 156, 110, 'Dad', () => {
          dadSel = true;
          drawGrade();
        }, 48, 0x9dffb0);
        const sparks = [
          [-70, -52],
          [74, -44],
          [62, 52],
        ].map(([sx, sy], i) => {
          const s = this.add.image(sx, sy, TEX.star).setDisplaySize(26, 26).setTint(0xfff1a8);
          this.tweens.add({ targets: s, alpha: 0.15, duration: 520, yoyo: true, repeat: -1, delay: i * 170 });
          return s;
        });
        b.root.add(sparks);
        b.root.setScale(0);
        this.tweens.add({ targets: b.root, scale: 1, duration: 420, ease: 'Back.easeOut' });
        starBurst(this, DAD_X, 730, 0x9dffb0, 150, 18);
        audio.sfx('gem');
        L.add(b.root);
        dadBtn = b.root;
        dadSel = true;
        drawGrade();
      } else if (!on && dadBtn) {
        const r = dadBtn;
        dadBtn = null;
        this.tweens.killTweensOf(r);
        this.tweens.add({ targets: r, scale: 0, duration: 200, ease: 'Back.easeIn', onComplete: () => r.destroy() });
        if (dadSel) {
          dadSel = false;
          drawGrade();
        }
      }
    };
    drawGrade();

    // scarf colours
    L.add(addText(this, 150, 860, 'Scarf', 44));
    const scarfRing = this.add.graphics();
    L.add(scarfRing);
    const scarfX = (i: number) => 320 + i * 110;
    const drawScarf = () => {
      scarfRing.clear().lineStyle(10, 0xffc93c, 1).strokeCircle(scarfX(scarf), 860, 54);
    };
    SCARF_COLOURS.forEach((c, i) => {
      const sw = this.add.circle(scarfX(i), 860, 42, c).setStrokeStyle(6, 0x1d1a3a);
      sw.setInteractive({ useHandCursor: true });
      sw.on('pointerup', () => {
        audio.sfx('click');
        scarf = i;
        goat.setTexture(juniperKey(i), 0).play(juniperAnim(ANIM.idle, i));
        drawScarf();
      });
      L.add(sw);
    });
    drawScarf();

    const submit = () => (name ? this.submitNew(name, grade, scarf, dadSel) : wobble(this, field));
    const go = makeButton(this, 1100, 864, 280, 140, 'Go!', submit, 64, 0x8fd18a);
    L.add(go.root);
    refresh();

    this.setKeys((e: KeyboardEvent) => {
      if (/^[a-z]$/i.test(e.key)) typeLetter(e.key);
      else if (e.key === 'Backspace') backspace();
      else if (e.key === 'Enter') submit();
      else if (e.key === 'Escape') this.showList();
    });
  }

  private submitNew(name: string, grade: Grade, scarf: number, dadMode = false) {
    // a Dad profile keeps a valid Grade internally (4); its mini games all become Dad Lab
    const p = createProfile(name, dadMode ? 4 : grade, scarf, { dadMode });
    if (!p) return this.showList();
    session.select(p.id);
    this.scene.start('Map');
  }
}
