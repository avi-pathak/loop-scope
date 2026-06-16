// Preset programs demonstrating classic event-loop behaviours.

export interface Preset {
  id: string;
  name: string;
  description: string;
  code: string;
}

export const PRESETS: Preset[] = [
  {
    id: 'timeout-vs-promise',
    name: '1 · setTimeout vs Promise',
    description: 'The classic ordering puzzle: sync first, then microtasks, then macrotasks.',
    code: `console.log('script start');

setTimeout(() => {
  console.log('setTimeout');
}, 0);

Promise.resolve()
  .then(() => console.log('promise 1'))
  .then(() => console.log('promise 2'));

console.log('script end');`,
  },
  {
    id: 'microtask-starvation',
    name: '2 · Nested promises',
    description: 'Microtasks queued by microtasks all run before the next macrotask (starvation).',
    code: `setTimeout(() => console.log('timeout'), 0);

Promise.resolve().then(() => {
  console.log('micro 1');
  Promise.resolve().then(() => {
    console.log('micro 2');
    Promise.resolve().then(() => {
      console.log('micro 3');
    });
  });
});

console.log('sync');`,
  },
  {
    id: 'async-await',
    name: '3 · async / await',
    description: 'await desugars to promise chains — see how execution suspends and resumes.',
    code: `async function getData() {
  console.log('before await');
  const value = await Promise.resolve(42);
  console.log('after await:', value);
  return value;
}

console.log('start');
getData().then((v) => console.log('done:', v));
console.log('end');`,
  },
  {
    id: 'settimeout-loop',
    name: '4 · setTimeout(0) in a loop',
    description: 'Each `let` iteration captures its own binding; all callbacks fire after sync code.',
    code: `for (let i = 0; i < 4; i++) {
  setTimeout(() => {
    console.log('timer', i);
  }, 0);
}

console.log('loop finished');`,
  },
  {
    id: 'promise-in-timeout',
    name: '5 · Promise ⊂ setTimeout ⊂ Promise',
    description: 'Interleaving micro and macro tasks across nested layers.',
    code: `Promise.resolve().then(() => {
  console.log('outer promise');
  setTimeout(() => {
    console.log('timeout inside promise');
    Promise.resolve().then(() => {
      console.log('promise inside timeout');
    });
  }, 0);
});

console.log('sync code');`,
  },
];

export const DEFAULT_CODE = PRESETS[0].code;
