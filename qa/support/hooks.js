import { Before, After, setWorldConstructor } from '@cucumber/cucumber';
import { PosWorld } from './world.js';

setWorldConstructor(PosWorld);

Before(async function () {
  await this.boot();
});

After(async function () {
  await this.shutdown();
});
