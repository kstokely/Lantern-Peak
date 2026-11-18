// Voiced lines for the v2 expansion: audio file name -> the text shown in the speech bubble.
export const LINES = {
  v_need_chisel: "It's blocked by ice. Marlow sells an Ice Chisel that could break it!",
  v_need_lantern: "It's too dark in there. We need a Glow Lantern from Marlow's shop!",
  v_need_hooves: "That's too high for me. Spring Hooves would help me jump up there!",
  v_flurry_shy: "Aww, a Flurry! They're very shy. A Chime Bell would help us make friends.",
  v_flurry_friend: 'We made a new friend! Welcome to the Flurry Lodge!',
  v_need_gems: "We need a few more gems for that one. Let's go find some!",
  v_area: "Ooh, a secret place! Let's see what's hiding in here.",
  v_camp4: "Four lanterns! That's enough to light the camp. Or we can keep exploring to find them all!",
  v_star: 'A gold star! We found every single lantern in this camp!',
  v_cocoa: 'Mmm, cocoa! That always helps me think.',
  v_bought: 'This will be so useful! Thanks, Marlow!',
  m_welcome: "Welcome to Marlow's Trading Post! Have a look around. Everything a climber could need!",
  m_thanks: 'A fine choice! Happy climbing, Juniper.',
  m_need_gems: 'Not quite enough gems yet. Come back when your purse is a little heavier!',
  m_oddjob: 'Fancy an odd job? I pay in gems!',
  v_oddjob: 'Short on gems? Marlow always has odd jobs for us!',
  v_helper: 'Look, a helper cloud! Hop on!',
} as const;

export type LineId = keyof typeof LINES;
