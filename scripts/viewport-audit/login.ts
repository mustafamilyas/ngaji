import type { Role } from "./args";
import { type Cdp, sleep } from "./cdp";
import { CREDENTIALS } from "./env";

/** Signs the headless Chrome in as a seeded role (clears cookies first). */
export async function login(cdp: Cdp, baseUrl: string, role: Role) {
  const { username, password } = CREDENTIALS[role];
  await cdp.send("Network.clearBrowserCookies");
  await cdp.navigate(`${baseUrl}/login`);
  await cdp.evaluate(`(() => {
    const set = (name, value) => {
      const el = document.querySelector('input[name=' + name + ']');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    set('username', ${JSON.stringify(username)});
    set('password', ${JSON.stringify(password)});
    document.querySelector('form').requestSubmit();
  })()`);
  for (let attempt = 0; attempt < 40; attempt++) {
    await sleep(250);
    if ((await cdp.evaluate<string>("location.pathname")).startsWith("/dashboard")) return;
  }
  throw new Error(`Could not sign in as ${role} (${username}).`);
}
