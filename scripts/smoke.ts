import { Runner } from '../src/interpreter/eventLoop';

const cases: Record<string, string> = {
  sync: `
    function add(a, b) { return a + b; }
    console.log('start');
    console.log(add(2, 3));
    console.log('end');
  `,
  ordering: `
    console.log('A');
    setTimeout(() => console.log('timeout'), 0);
    Promise.resolve().then(() => console.log('promise'));
    console.log('B');
  `,
  asyncAwait: `
    async function main() {
      console.log('1');
      await null;
      console.log('3');
    }
    console.log('0');
    main();
    console.log('2');
  `,
  loop: `
    for (let i = 0; i < 3; i++) {
      setTimeout(() => console.log('i=' + i), 0);
    }
    console.log('sync done');
  `,
  nested: `
    Promise.resolve().then(() => {
      console.log('p1');
      Promise.resolve().then(() => console.log('p2'));
    });
    setTimeout(() => console.log('t1'), 0);
  `,
};

for (const [name, code] of Object.entries(cases)) {
  const r = new Runner(code);
  let steps = 0;
  while (!r.done && steps < 5000) {
    r.step();
    steps += 1;
  }
  const snap = r.snapshot();
  console.log(`\n=== ${name} (${steps} steps) ===`);
  if (snap.error) console.log('ERROR:', snap.error);
  console.log(snap.console.map((c) => `${c.level}: ${c.text}`).join('\n'));
}
