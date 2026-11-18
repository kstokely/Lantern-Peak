// Marlow's Trading Post: big item cards, the gem purse, confirm-then-buy, cocoa and hats.
// Opened over the paused World (from the Trail stall) or from the Map.
import Phaser from 'phaser';
import { ANIM, HeroId, TEX, TEX2, friendKey, hatKey, toolKey } from '../art/keys';
import { MAX_COCOA, NUM_ZONES, miniGameSceneKey } from '../types';
import { ODD_JOB_PAY, ODD_JOB_ROUNDS } from '../core/session';
import { debugRefs } from '../core/debug';
import { addHeroSprite, heroHat, playHero } from '../core/heroArt';
import { session } from '../core/session';
import { audio } from '../core/audio';
import { LINES, LineId } from '../core/lines';
import { HAT_ITEMS, STORE_ITEMS } from '../core/store';
import { addPanel, addText, confetti, makeButton, makeIconButton, makeMuteButton, textStyle, wobble } from '../core/ui';
import { makeBubble } from '../minigames/widgets';

type Tab = 0 | 1 | 2;
const COLS = [250, 640, 1030];
// cards stop at y 716 so the speech bubble band (y 722-846) never covers one
const ROWS = [305, 585];
const CARD_W = 370;
const CARD_H = 262;
const INK = '#1d1a3a';

interface CardSpec {
  key: string;
  icon: string;
  name: string;
  desc: string;
  price: number;
  litCamp: number;
  state: 'buy' | 'owned' | 'locked' | 'full' | 'wear' | 'wearing';
  count?: number;
  onBuy: () => 'ok' | string;
  onTap?: () => void;
}

export class StoreScene extends Phaser.Scene {
  private from: 'world' | 'map' = 'map';
  private onClose: (() => void) | null = null;
  private tab: Tab = 0;
  private cards: Phaser.GameObjects.Container[] = [];
  private tabs: ReturnType<typeof makeButton>[] = [];
  private purseText!: Phaser.GameObjects.Text;
  private dialog: Phaser.GameObjects.Container | null = null;
  private bubble: Phaser.GameObjects.Container | null = null;
  private bubbleTimer: Phaser.Time.TimerEvent | null = null;
  private marlow!: Phaser.GameObjects.Sprite;
  private hatImg: Phaser.GameObjects.Image | null = null;
  private thanksFlip = false;
  private heroId: HeroId = 'juniper';
  private counterHero!: Phaser.GameObjects.Sprite;
  private closing = false;
  private jobRunning = false;

  constructor() {
    super('Store');
  }

  init(data: { from?: 'world' | 'map'; onClose?: () => void; tab?: Tab }) {
    this.from = data.from ?? 'map';
    this.onClose = data.onClose ?? null;
    this.tab = data.tab ?? 0;
    this.cards = [];
    this.tabs = [];
    this.dialog = null;
    this.bubble = null;
    this.closing = false;
    this.jobRunning = false;
  }

  create() {
    if (!session.profile) {
      this.scene.start('Profiles');
      return;
    }
    audio.setMusic('shop');
    this.add.rectangle(640, 480, 1280, 960, 0x5a3320);
    this.add.image(640, 480, TEX2.shopBg).setDisplaySize(1280, 960);
    this.add.rectangle(640, 480, 1280, 960, 0x1d1a3a, 0.18);
    makeIconButton(this, 80, 80, TEX.iconBack, () => this.close(), 104);
    const title = addText(this, 560, 78, "Marlow's Trading Post", 50);
    if (title.width > 640) title.setScale(640 / title.width);
    const pill = this.add.graphics();
    pill.fillStyle(0x1d1a3a, 0.6).fillRoundedRect(900, 36, 220, 88, 30);
    this.add.image(950, 80, TEX2.purse).setDisplaySize(72, 72);
    this.purseText = this.add.text(992, 80, '', textStyle(48, { color: '#fff1a8' })).setOrigin(0, 0.5);
    makeMuteButton(this);

    // Juniper (bottom-left) and Marlow (bottom-right) watch the counter
    const p = session.p;
    this.heroId = session.hero;
    this.counterHero = addHeroSprite(this, 105, 958, this.heroId, p.scarf, 0.62);
    playHero(this.counterHero, ANIM.idle, this.heroId, p.scarf);
    this.hatImg = null;
    this.syncHat();
    this.marlow = this.add.sprite(1185, 962, friendKey('marlow'), 0).setOrigin(0.5, 1).setScale(0.62);
    this.marlow.setInteractive({ useHandCursor: true }).on('pointerup', () => this.marlowSays('m_welcome'));

    const labels = ['Tools', 'More tools', 'Hats'];
    labels.forEach((l, i) => {
      const b = makeButton(this, 300 + i * 232, 905, 222, 100, l, () => this.showTab(i as Tab), 36);
      this.tabs.push(b);
    });
    // Odd jobs: always available, unlimited; a child who spent every gem can always earn more
    const job = makeButton(this, 1000, 905, 250, 100, 'Odd job:\nearn gems', () => this.oddJob(), 30, 0x8fd18a);
    this.tweens.add({ targets: job.root, scale: 1.05, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.showTab(this.tab);
    this.time.delayedCall(350, () => this.marlowSays('m_welcome'));
    this.input.keyboard?.on('keydown-ESC', () => (this.dialog ? this.closeDialog() : this.close()));
  }

  /** Juniper's hat in the shop follows the worn hat immediately (bought or toggled). */
  private syncHat() {
    const h = session.p.hat;
    if (h < 0) {
      this.hatImg?.destroy();
      this.hatImg = null;
      return;
    }
    const a = heroHat(this, this.heroId, session.p.scarf, 0);
    if (!this.hatImg) this.hatImg = this.add.image(0, 0, hatKey(h)).setOrigin(0.5, 1).setScale(0.62 * a.scale).setDepth(1);
    else this.hatImg.setTexture(hatKey(h));
    this.hatImg.setScale(0.62 * a.scale).setPosition(105 + a.dx * 0.62, 958 + a.dy * 0.62).setRotation(a.rot);
  }

  private refreshPurse() {
    this.purseText.setText(String(session.purse));
  }

  // ---------- cards ----------

  private specs(): CardSpec[] {
    const p = session.p;
    if (this.tab === 2) {
      return HAT_ITEMS.map((h) => {
        const owned = p.hats.includes(h.index);
        const avail = session.isAvailable(h.litCamp);
        return {
          key: `hat${h.index}`,
          icon: hatKey(h.index),
          name: h.name,
          desc: owned ? (p.hat === h.index ? 'Worn now' : 'Tap to wear it') : 'A hat for you',
          price: h.price,
          litCamp: h.litCamp,
          state: owned ? (p.hat === h.index ? 'wearing' : 'wear') : avail ? 'buy' : 'locked',
          onBuy: () => session.buyHat(h.index),
          onTap: owned ? () => this.toggleHat(h.index) : undefined,
        } as CardSpec;
      });
    }
    const items = this.tab === 0 ? STORE_ITEMS.slice(0, 6) : STORE_ITEMS.slice(6);
    return items.map((it) => {
      const avail = session.isAvailable(it.litCamp);
      const cocoa = it.id === 'cocoa';
      const owned = cocoa ? session.cocoa >= MAX_COCOA : session.has(it.id);
      return {
        key: it.id,
        icon: toolKey(it.id),
        name: it.name,
        desc: it.desc,
        price: it.price,
        litCamp: it.litCamp,
        state: !avail ? 'locked' : owned ? (cocoa ? 'full' : 'owned') : 'buy',
        count: cocoa ? session.cocoa : undefined,
        onBuy: () => session.buy(it.id),
      } as CardSpec;
    });
  }

  private showTab(t: Tab) {
    this.tab = t;
    this.tabs.forEach((b, i) => {
      b.face.setTint(i === t ? 0xffc93c : 0xb8a0d8);
      b.root.setScale(i === t ? 1.04 : 0.96);
    });
    this.cards.forEach((c) => c.destroy());
    this.cards = this.specs().map((s, i) => this.card(s, COLS[i % 3], ROWS[Math.floor(i / 3)]));
    this.refreshPurse();
  }

  private card(s: CardSpec, x: number, y: number) {
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    const locked = s.state === 'locked';
    g.fillStyle(0x1d1a3a, 0.35).fillRoundedRect(-CARD_W / 2 + 6, -CARD_H / 2 + 10, CARD_W, CARD_H, 30);
    g.fillStyle(locked ? 0xc9d6f5 : 0xfff8ea, 1).fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 30);
    g.lineStyle(6, 0x1d1a3a, 1).strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 30);
    if (s.state === 'wearing' || s.state === 'owned') g.lineStyle(6, 0x3fa06a, 1).strokeRoundedRect(-CARD_W / 2 + 8, -CARD_H / 2 + 8, CARD_W - 16, CARD_H - 16, 24);
    c.add(g);
    const icon = this.add.image(0, -78, s.icon).setDisplaySize(98, 98);
    if (locked) icon.setTint(0x6d6690);
    c.add(icon);
    if (s.count !== undefined) {
      const badge = this.add.circle(62, -112, 30, 0x2e2a5c).setStrokeStyle(4, 0x1d1a3a);
      const bt = this.add.text(62, -114, String(s.count), textStyle(36, { color: '#fff1a8', strokeThickness: 4 })).setOrigin(0.5);
      c.add([badge, bt]);
    }
    const name = this.add.text(0, -6, s.name, textStyle(38, { color: INK, stroke: '#fff8ea', strokeThickness: 2 })).setOrigin(0.5);
    if (name.width > CARD_W - 30) name.setScale((CARD_W - 30) / name.width);
    const desc = this.add.text(0, 38, s.desc, textStyle(36, { color: '#4a4368', stroke: '#fff8ea', strokeThickness: 2 })).setOrigin(0.5);
    if (desc.width > CARD_W - 30) desc.setScale((CARD_W - 30) / desc.width);
    c.add([name, desc]);
    // bottom row: price, owned, locked
    const rowY = 98;
    if (s.state === 'buy' || s.state === 'full') {
      const gi = this.add.image(-38, rowY, TEX2.purse).setDisplaySize(54, 54);
      const pt = this.add.text(-6, rowY, String(s.price), textStyle(46, { color: '#ffc93c' })).setOrigin(0, 0.5);
      c.add([gi, pt]);
      if (s.state === 'full') {
        const f = this.add.text(0, rowY, 'Full', textStyle(42, { color: '#3fa06a' })).setOrigin(0.5);
        gi.setVisible(false);
        pt.setVisible(false);
        c.add(f);
      }
    } else if (s.state === 'owned' || s.state === 'wearing') {
      c.add(this.add.text(0, rowY, s.state === 'owned' ? 'Owned' : 'Wearing', textStyle(44, { color: '#8fd18a' })).setOrigin(0.5));
    } else if (s.state === 'wear') {
      c.add(this.add.text(0, rowY, 'Wear', textStyle(44, { color: '#ffc93c' })).setOrigin(0.5));
    } else {
      const lk = this.add.image(-118, rowY, TEX2.lockBadge).setDisplaySize(56, 56);
      const lt = this.add.text(18, rowY, `Light camp ${s.litCamp}`, textStyle(36)).setOrigin(0.5);
      if (lt.width > 270) lt.setScale(270 / lt.width);
      c.add([lk, lt]);
    }
    const hit = this.add.zone(0, 0, CARD_W, CARD_H).setInteractive({ useHandCursor: true });
    c.add(hit);
    let down = false;
    hit.on('pointerdown', () => {
      down = true;
      c.setScale(0.97);
    });
    hit.on('pointerout', () => {
      down = false;
      c.setScale(1);
    });
    hit.on('pointerup', () => {
      if (!down) return;
      down = false;
      c.setScale(1);
      if (this.dialog) return;
      audio.sfx('click');
      this.tapCard(s, c);
    });
    c.setData('spec', s.key);
    return c;
  }

  private tapCard(s: CardSpec, c: Phaser.GameObjects.Container) {
    if (s.onTap) return s.onTap();
    if (s.state === 'locked') {
      wobble(this, c);
      this.marlowSays(null, `That comes in once camp ${s.litCamp} is lit!`);
      return;
    }
    if (s.state === 'owned' || s.state === 'wearing') return this.marlowSays(null, 'You have that one already!');
    if (s.state === 'full') return this.marlowSays(null, `You can carry ${MAX_COCOA} flasks. Use one first!`);
    if (!session.canAfford(s.price)) return this.poorDialog(s);
    this.confirmDialog(s);
  }

  private toggleHat(i: number) {
    session.wearHat(session.p.hat === i ? -1 : i);
    this.syncHat();
    this.showTab(2);
  }

  // ---------- dialogs ----------

  private dialogFrame(icon: string) {
    const c = this.add.container(0, 0).setDepth(50);
    const dim = this.add.rectangle(640, 480, 1280, 960, 0x1d1a3a, 0.6).setInteractive();
    const panel = addPanel(this, 640, 470, 800, 600);
    const inner = this.add.graphics();
    inner.fillStyle(0xfff8ea, 1).fillRoundedRect(290, 210, 700, 385, 30);
    inner.lineStyle(5, 0x1d1a3a, 1).strokeRoundedRect(290, 210, 700, 385, 30);
    const ic = this.add.image(640, 290, icon).setDisplaySize(130, 130);
    c.add([dim, panel, inner, ic]);
    this.dialog = c;
    c.setScale(0.9).setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, scale: 1, duration: 180, ease: 'Back.easeOut' });
    return c;
  }

  private confirmDialog(s: CardSpec) {
    const c = this.dialogFrame(s.icon);
    const have = session.purse;
    c.add(this.add.text(640, 400, `Buy ${s.name}?`, textStyle(48, { color: INK, stroke: '#fff8ea', strokeThickness: 2 })).setOrigin(0.5));
    c.add(this.add.text(640, 470, `It costs ${s.price} gems.`, textStyle(40, { color: '#4a4368', stroke: '#fff8ea', strokeThickness: 2 })).setOrigin(0.5));
    c.add(this.add.text(640, 530, `${have} - ${s.price} = ${have - s.price} left`, textStyle(40, { color: '#4a4368', stroke: '#fff8ea', strokeThickness: 2 })).setOrigin(0.5));
    const yes = makeButton(this, 500, 668, 260, 120, 'Yes!', () => this.doBuy(s), 48, 0x8fd18a);
    const no = makeButton(this, 780, 668, 260, 120, 'No', () => this.closeDialog(), 48, 0xb8a0d8);
    c.add([yes.root, no.root]);
  }

  private poorDialog(s: CardSpec) {
    const c = this.dialogFrame(s.icon);
    const have = session.purse;
    const need = s.price - have;
    c.add(this.add.text(640, 400, `You need ${need} more gem${need === 1 ? '' : 's'}.`, textStyle(46, { color: INK, stroke: '#fff8ea', strokeThickness: 2 })).setOrigin(0.5));
    c.add(this.add.text(640, 470, `${s.name} costs ${s.price}. You have ${have}.`, textStyle(38, { color: '#4a4368', stroke: '#fff8ea', strokeThickness: 2 })).setOrigin(0.5));
    c.add(this.add.text(640, 540, `${s.price} - ${have} = ${need}`, textStyle(48, { color: '#e8472b', stroke: '#fff8ea', strokeThickness: 2 })).setOrigin(0.5));
    const ok = makeButton(this, 640, 668, 300, 120, 'OK', () => this.closeDialog(), 48);
    c.add(ok.root);
    audio.sfx('wrong');
    this.thanksFlip = !this.thanksFlip;
    if (this.thanksFlip) this.marlowSays('m_need_gems');
    else this.juniperSays('v_need_gems');
    this.time.delayedCall(3600, () => {
      if (!this.closing && !this.jobRunning) this.juniperSays('v_oddjob');
    });
  }

  /** Marlow's odd job: a 3-round mini game over the shop; pays gems on top of the usual first-try gems. */
  oddJob(): string {
    if (this.dialog || this.closing || this.jobRunning) return 'busy';
    this.jobRunning = true;
    this.marlowSays('m_oddjob');
    const pick = session.nextOddJob();
    const id = this.game.scene.getScene(miniGameSceneKey(pick)) ? pick : 'gemSort';
    const zone = Math.max(0, Math.min(NUM_ZONES - 1, debugRefs.world?.zone ?? session.p.unlockedZone));
    this.time.delayedCall(1500, () => {
      if (this.closing) return;
      const key = miniGameSceneKey(id);
      this.scene.pause();
      this.scene.launch(key, {
        id,
        zone,
        rounds: ODD_JOB_ROUNDS,
        onDone: ({ completed }: { completed: boolean }) => {
          this.scene.resume();
          this.jobRunning = false;
          audio.setMusic('shop');
          if (completed) {
            session.finishOddJob();
            audio.sfx('buy');
            confetti(this, 640, 300, 40, 30);
            this.marlowSays(null, 'Thank you kindly! Here are ' + ODD_JOB_PAY + ' extra gems for the job.');
          } else this.marlowSays(null, 'No trouble at all. Come back for an odd job any time!');
          this.refreshPurse();
          this.showTab(this.tab);
        },
      });
      this.scene.bringToTop(key);
    });
    return id;
  }

  private closeDialog() {
    const d = this.dialog;
    if (!d) return;
    this.dialog = null;
    d.destroy();
  }

  private doBuy(s: CardSpec) {
    const r = s.onBuy();
    this.closeDialog();
    if (r !== 'ok') {
      this.marlowSays(null, r === 'poor' ? LINES.m_need_gems : 'Hmm, that did not work.');
      return;
    }
    audio.sfx('buy');
    this.syncHat();
    confetti(this, 640, 300, 60, 30);
    this.thanksFlip = !this.thanksFlip;
    this.showTab(this.tab);
    if (this.thanksFlip) this.marlowSays('m_thanks');
    else this.juniperSays('v_bought');
  }

  // ---------- talking ----------

  private talk(text: string, voice: string | null, x: number, y: number) {
    this.bubble?.destroy();
    this.bubbleTimer?.remove();
    if (voice) audio.voice(voice);
    const b = makeBubble(this, x, this.dialog ? y + 24 : y, text, 880, 34).setDepth(60);
    this.bubble = b;
    b.setScale(0.6);
    this.tweens.add({ targets: b, scale: 1, duration: 200, ease: 'Back.easeOut' });
    this.bubbleTimer = this.time.delayedCall(Math.max(3000, 1200 + text.length * 50), () => {
      if (this.bubble === b) {
        this.bubble = null;
        b.destroy();
      }
    });
  }

  private marlowSays(id: LineId | null, text?: string) {
    this.marlow.setFrame(1);
    this.time.delayedCall(1600, () => this.marlow.setFrame(0));
    this.talk(text ?? LINES[id!], id, 650, 783);
  }

  private juniperSays(id: LineId) {
    this.talk(LINES[id], id, 650, 783);
  }

  // ---------- leaving ----------

  close() {
    if (this.closing) return;
    this.closing = true;
    audio.stopVoice();
    audio.sfx('door');
    if (this.from === 'world') {
      const cb = this.onClose;
      this.scene.stop();
      cb?.();
    } else this.scene.start('Map');
  }

  // ---------- debug ----------

  /** Cards on the current tab with their screen centres (for tests). */
  debugCards() {
    return this.cards.map((c) => ({ key: c.getData('spec') as string, x: c.x, y: c.y }));
  }
}
