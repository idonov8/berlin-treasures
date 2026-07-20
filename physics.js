/* ============================================================
   Berlin Treasures — physics playground (Matter.js)
   Falling / draggable / throwable grey trash cans (lids fly off
   separately) that spill tiny tumbling gold coins.
   All tunables live in CONFIG (see design-system.md).
   ============================================================ */
(function () {
  'use strict';

  if (typeof Matter === 'undefined') {
    console.warn('[Berlin Treasures] Matter.js failed to load — showing static hero only.');
    return;
  }

  var Engine = Matter.Engine, Render = Matter.Render, Runner = Matter.Runner,
      Composite = Matter.Composite, Bodies = Matter.Bodies, Body = Matter.Body,
      Events = Matter.Events, Mouse = Matter.Mouse, MouseConstraint = Matter.MouseConstraint;

  var isMobile = window.matchMedia('(max-width: 767px)').matches;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function rand(min, max) { return min + Math.random() * (max - min); }

  var CONFIG = {
    gravityY:        1.0,
    initialCans:     isMobile ? 5 : 9,
    spawnStaggerMs:  isMobile ? 340 : 240,
    maxCoins:        isMobile ? 70 : 130,
    spillBurst:      isMobile ? 4 : 5,

    // coins: tiny + varied (ovals via non-uniform stretch + random orientation)
    coinRadiusMin:   isMobile ? 3.5 : 4,
    coinRadiusMax:   isMobile ? 5.5 : 7,
    coinOvalMin:     0.55,     // squashed axis
    coinOvalMax:     1.5,      // stretched axis

    canScale:        isMobile ? 0.44 : 0.52,   // smaller cans
    lidScale:        isMobile ? 0.46 : 0.54,
    restitution:     0.42,
    friction:        0.05,
    frictionAir:     0.012,

    // "shake" = linear speed + weighted angular speed. Crossing the
    // threshold spills coins — works for impacts AND mid-air swinging.
    shakeAngularWeight: 26,
    shakeThreshold:     5,
    spillCooldownMs:    240
  };

  // native sprite dimensions (must match the SVG files' width/height)
  var CAN_SVG = { w: 120, h: 150 };
  var LID_SVG = { w: 100, h: 46 };
  var COIN_SVG = { w: 100, h: 100 };
  var CAN_W = CAN_SVG.w * CONFIG.canScale;
  var CAN_H = CAN_SVG.h * CONFIG.canScale;
  var LID_W = LID_SVG.w * CONFIG.lidScale;
  var LID_H = LID_SVG.h * CONFIG.lidScale;

  var canvas = document.getElementById('playground');
  var W = window.innerWidth, H = window.innerHeight;
  var pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

  var engine = Engine.create({ enableSleeping: true });
  engine.gravity.y = CONFIG.gravityY;
  var world = engine.world;

  var render = Render.create({
    canvas: canvas,
    engine: engine,
    options: {
      width: W, height: H,
      background: 'transparent',
      wireframes: false,
      pixelRatio: pixelRatio
    }
  });
  Render.run(render);
  Runner.run(Runner.create(), engine);

  /* ---- boundaries (floor + side walls, top left open) ---------------- */
  var WALL = 200;
  var walls = [];
  function buildWalls() {
    if (walls.length) Composite.remove(world, walls);
    var opts = { isStatic: true, restitution: 0.25, friction: 0.4, render: { visible: false } };
    walls = [
      Bodies.rectangle(W / 2, H + WALL / 2, W + WALL * 4, WALL, opts),  // floor
      Bodies.rectangle(-WALL / 2, H / 2, WALL, H * 4, opts),            // left
      Bodies.rectangle(W + WALL / 2, H / 2, WALL, H * 4, opts)          // right
    ];
    Composite.add(world, walls);
  }
  buildWalls();

  /* ---- gold coins: tiny, oval, randomly oriented ---------------------- */
  var coins = [];
  function spawnCoins(x, y, n, vx, vy) {
    for (var i = 0; i < n; i++) {
      if (coins.length >= CONFIG.maxCoins) {
        Composite.remove(world, coins.shift());   // recycle the oldest coin
      }
      var radius = rand(CONFIG.coinRadiusMin, CONFIG.coinRadiusMax);
      var baseScale = (radius * 2) / COIN_SVG.w;
      var c = Bodies.circle(
        x + (Math.random() - 0.5) * 22,
        y + (Math.random() - 0.5) * 8,
        radius,
        {
          restitution: 0.35, friction: 0.02, frictionAir: 0.006, density: 0.0012,
          render: { sprite: { texture: 'assets/coin.svg', xScale: baseScale, yScale: baseScale } }
        }
      );
      // stretch non-uniformly (true oval collision shape + matching sprite) + random spin
      Body.scale(c, rand(CONFIG.coinOvalMin, CONFIG.coinOvalMax), rand(CONFIG.coinOvalMin, CONFIG.coinOvalMax));
      Body.setAngle(c, Math.random() * Math.PI * 2);

      coins.push(c);
      Composite.add(world, c);
      Body.setVelocity(c, {
        x: (vx || 0) * 0.35 + (Math.random() - 0.5) * 4.5,
        y: (vy || 0) * 0.20 - Math.random() * 3.5
      });
      Body.setAngularVelocity(c, (Math.random() - 0.5) * 0.4);
    }
  }

  /* ---- trash cans (lid is a separate, independent tumbling body) ----- */
  var canXScale = CAN_W / CAN_SVG.w;
  var canYScale = CAN_H / CAN_SVG.h;
  var lidXScale = LID_W / LID_SVG.w;
  var lidYScale = LID_H / LID_SVG.h;
  var canBodies = [];

  function makeLid(x, y, vx, vy, av) {
    var lid = Bodies.rectangle(x, y, LID_W * 0.82, LID_H * 0.6, {
      chamfer: { radius: LID_H * 0.3 },
      restitution: 0.5,
      friction: 0.06,
      frictionAir: 0.015,
      density: 0.0025,
      label: 'lid',
      render: { sprite: { texture: 'assets/can-lid.svg', xScale: lidXScale, yScale: lidYScale } }
    });
    Composite.add(world, lid);
    Body.setVelocity(lid, { x: vx, y: vy });
    Body.setAngularVelocity(lid, av);
    return lid;
  }

  function makeCan(x, y) {
    var can = Bodies.rectangle(x, y, CAN_W * 0.62, CAN_H * 0.9, {
      chamfer: { radius: 10 },
      restitution: CONFIG.restitution,
      friction: CONFIG.friction,
      frictionAir: CONFIG.frictionAir,
      density: 0.004,
      label: 'can',
      render: { sprite: { texture: 'assets/trashcan.svg', xScale: canXScale, yScale: canYScale } }
    });
    can.lastSpill = 0;
    Composite.add(world, can);
    canBodies.push(can);

    // the lid pops off independently: spawned right at the mouth, with its
    // own slightly different velocity/spin so it visibly separates as it falls
    makeLid(
      x + rand(-8, 8), y - CAN_H * 0.34,
      rand(-1.5, 1.5), rand(-1.5, 0.5),
      rand(-0.12, 0.12)
    );

    return can;
  }

  // mouth position (top of the can) in world space, accounting for rotation
  function canMouth(can) {
    var off = CAN_H * 0.38;
    return {
      x: can.position.x + off * Math.sin(can.angle),
      y: can.position.y - off * Math.cos(can.angle)
    };
  }

  // A can spills whenever it's moving/spinning hard enough (impact OR mid-air swing).
  // There's no per-can limit: the fun is that swinging always pours gold. Total on-screen
  // coins stay bounded by CONFIG.maxCoins (oldest recycled) and the rate by spillCooldownMs.
  function checkSpill(body, now) {
    if (!body || body.label !== 'can') return;
    if (now - body.lastSpill < CONFIG.spillCooldownMs) return;
    var metric = body.speed + Math.abs(body.angularVelocity) * CONFIG.shakeAngularWeight;
    if (metric < CONFIG.shakeThreshold) return;
    body.lastSpill = now;
    var m = canMouth(body);
    spawnCoins(m.x, m.y, CONFIG.spillBurst, body.velocity.x, body.velocity.y);
  }

  // covers hard impacts...
  Events.on(engine, 'collisionStart', function (evt) {
    var now = performance.now();
    for (var i = 0; i < evt.pairs.length; i++) {
      checkSpill(evt.pairs[i].bodyA, now);
      checkSpill(evt.pairs[i].bodyB, now);
    }
  });
  // ...and mid-air swinging/shaking while being dragged (no collision needed)
  Events.on(engine, 'afterUpdate', function () {
    var now = performance.now();
    for (var i = 0; i < canBodies.length; i++) checkSpill(canBodies[i], now);
  });

  /* ---- populate ------------------------------------------------------ */
  if (reduceMotion) {
    var n = Math.min(4, CONFIG.initialCans);
    for (var k = 0; k < n; k++) {
      var span = n > 1 ? 0.6 / (n - 1) : 0;
      makeCan(W * (0.2 + k * span), H - CAN_H);
    }
  } else {
    var dropped = 0;
    var rainTimer = setInterval(function () {
      if (dropped >= CONFIG.initialCans) { clearInterval(rainTimer); return; }
      var can = makeCan(W * (0.15 + Math.random() * 0.7), -CAN_H);
      Body.setVelocity(can, { x: (Math.random() - 0.5) * 2, y: 4 + Math.random() * 2 });
      Body.setAngularVelocity(can, (Math.random() - 0.5) * 0.15);
      dropped++;
    }, CONFIG.spawnStaggerMs);
  }

  /* ---- drag + throw (mouse & touch) --------------------------------- */
  var mouse = Mouse.create(canvas);
  mouse.pixelRatio = pixelRatio;
  var mouseConstraint = MouseConstraint.create(engine, {
    mouse: mouse,
    constraint: { stiffness: 0.2, render: { visible: false } }
  });
  Composite.add(world, mouseConstraint);
  render.mouse = mouse;

  /* ---- interaction hint --------------------------------------------- */
  var hint = document.getElementById('hint');
  var hinted = false;
  function hideHint() {
    if (hinted || !hint) return;
    hinted = true;
    hint.classList.add('hide');
  }
  Events.on(mouseConstraint, 'startdrag', hideHint);
  setTimeout(hideHint, 6500);

  /* ---- responsive resize -------------------------------------------- */
  var resizeT;
  window.addEventListener('resize', function () {
    clearTimeout(resizeT);
    resizeT = setTimeout(function () {
      W = window.innerWidth; H = window.innerHeight;
      render.options.width = W;
      render.options.height = H;
      render.bounds.max.x = W;
      render.bounds.max.y = H;
      render.canvas.width = W * pixelRatio;
      render.canvas.height = H * pixelRatio;
      render.canvas.style.width = W + 'px';
      render.canvas.style.height = H + 'px';
      buildWalls();
    }, 200);
  });
})();
