import type { AudioEngine } from '../audio/AudioEngine';
import { h, svg } from './dom';
import { ICONS } from './icons';

/** DESIGN 3.6: the sound button (a loudspeaker) in a corner. Sound starts after the first tap anywhere; this only mutes. */
export class SoundButton {
  readonly element: HTMLButtonElement;

  constructor(private readonly audio: AudioEngine) {
    this.element = h('button', { class: 'sound-btn', type: 'button', 'aria-label': 'Lyd' });
    this.element.addEventListener('click', () => this.audio.setMuted(!this.audio.muted));
    audio.onMutedChange = () => this.render();
    this.render();
  }

  private render(): void {
    const on = !this.audio.muted;
    this.element.setAttribute('aria-pressed', String(on));
    this.element.replaceChildren(svg(on ? ICONS.soundOn : ICONS.soundOff));
  }
}
