export type Gesture = {
  readonly kind: 'unit' | 'item'; readonly id: string; readonly pointerId: number; readonly epoch: number;
};

/** View-only ownership. Epochs make delayed releases harmless after a command. */
export class InputRouter {
  private epoch = 0;
  private owner: Gesture | null = null;
  get current(): Gesture | null { return this.owner ? { ...this.owner } : null; }
  get gestureEpoch(): number { return this.epoch; }
  begin(kind: Gesture['kind'], id: string, pointerId: number): Gesture | null {
    if (this.owner) return null;
    this.owner = { kind, id, pointerId, epoch: ++this.epoch };
    return { ...this.owner };
  }
  owns(gesture: Gesture): boolean {
    return this.owner?.epoch === gesture.epoch && this.owner.pointerId === gesture.pointerId
      && this.owner.kind === gesture.kind && this.owner.id === gesture.id;
  }
  release(gesture: Gesture): boolean {
    if (!this.owns(gesture)) return false;
    this.owner = null;
    return true;
  }
  cancel(): void { this.owner = null; this.epoch++; }
}
