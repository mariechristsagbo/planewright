/** Whether the Mod key is Cmd (Apple platforms) or Ctrl (every other platform), REQ-V05. */
export type Platform = 'apple' | 'other';

/** The parts of `navigator` that name the platform; `userAgentData` is newer and preferred. */
export interface NavigatorPlatform {
  readonly platform: string;
  readonly userAgentData?: { readonly platform: string };
}

const APPLE = /^(mac|iphone|ipad|ipod)/iu;

export function platformOf(navigator: NavigatorPlatform): Platform {
  const name = navigator.userAgentData?.platform ?? navigator.platform;
  return APPLE.test(name) ? 'apple' : 'other';
}
