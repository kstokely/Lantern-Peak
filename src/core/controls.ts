// On-screen button state written by the HUD and read by the World each frame.
export const controls = {
  left: false,
  right: false,
  jump: false,
  /** Set on press, cleared by the World once consumed (so a quick tap still jumps). */
  jumpQueued: false,
  reset() {
    this.left = this.right = this.jump = this.jumpQueued = false;
  },
};
