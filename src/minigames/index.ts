// Registry of mini-game scenes. To add one: import its class and append it to the list.
import Phaser from 'phaser';
import { FrostLockScene } from './FrostLock';
import { IceBridgeScene } from './IceBridge';
import { TrailFriendScene } from './TrailFriend';
import { ClockTowerScene } from './ClockTower';
import { PieShareScene } from './PieShare';
import { GemSortScene } from './GemSort';
import { CoinShopScene } from './CoinShop';
import { SnowScaleScene } from './SnowScale';
import { DadLabScene } from './DadLab';

export const MINI_GAME_SCENES: Phaser.Types.Scenes.SceneType[] = [
  FrostLockScene,
  IceBridgeScene,
  TrailFriendScene,
  ClockTowerScene,
  PieShareScene,
  GemSortScene,
  CoinShopScene,
  SnowScaleScene,
  DadLabScene, // hidden Dad mode: replaces every mini game for a dadMode profile (WorldScene.launchMiniGame)
  // GemSortScene, PieShareScene, ClockTowerScene, CoinShopScene, TrailFriendScene,
];
