// when animating on canvas, it is best to use requestAnimationFrame instead of setTimeout or setInterval
// not supported in all browsers though and sometimes needs a prefix, so we need a shim
window.requestAnimFrame = (function () {
  return (
    window.requestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    window.mozRequestAnimationFrame ||
    function (callback) {
      window.setTimeout(callback, 1000 / 60);
    }
  );
})();

// now we will setup our basic variables for the demo
var canvas = document.getElementById("canvas"),
  ctx = canvas.getContext("2d"),
  // full screen dimensions
  cw = window.innerWidth,
  ch = window.innerHeight,
  // firework collection
  fireworks = [],
  // particle collection
  particles = [],
  // starting hue
  hue = 120,
  // when launching fireworks with a click, too many get launched at once without a limiter, one launch per 5 loop ticks
  limiterTotal = 20,
  limiterTick = 0,
  // this will time the auto launches of fireworks, one launch per 80 loop ticks
  timerTotal = 500,
  timerTick = 0,
  mousedown = false,
  // mouse x coordinate,
  mx,
  // mouse y coordinate
  my;

// set canvas dimensions
canvas.width = cw;
canvas.height = ch;

// now we are going to setup our function placeholders for the entire demo

// get a random number within a range
function random(min, max) {
  return Math.random() * (max - min) + min;
}

// calculate the distance between two points
function calculateDistance(p1x, p1y, p2x, p2y) {
  var xDistance = p1x - p2x,
    yDistance = p1y - p2y;
  return Math.sqrt(Math.pow(xDistance, 2) + Math.pow(yDistance, 2));
}

// create firework
function Firework(sx, sy, tx, ty) {
  // actual coordinates
  this.x = sx;
  this.y = sy;
  // starting coordinates
  this.sx = sx;
  this.sy = sy;
  // target coordinates
  this.tx = tx;
  this.ty = ty;
  // distance from starting point to target
  this.distanceToTarget = calculateDistance(sx, sy, tx, ty);
  this.distanceTraveled = 0;
  // track the past coordinates of each firework to create a trail effect, increase the coordinate count to create more prominent trails
  this.coordinates = [];
  this.coordinateCount = 3;
  // populate initial coordinate collection with the current coordinates
  while (this.coordinateCount--) {
    this.coordinates.push([this.x, this.y]);
  }
  this.angle = Math.atan2(ty - sy, tx - sx);
  this.speed = 2;
  this.acceleration = 1.05;
  this.brightness = random(50, 70);
  // circle target indicator radius
  this.targetRadius = 1;
}

// update firework
Firework.prototype.update = function (index) {
  // remove last item in coordinates array
  this.coordinates.pop();
  // add current coordinates to the start of the array
  this.coordinates.unshift([this.x, this.y]);

  // cycle the circle target indicator radius
  if (this.targetRadius < 8) {
    this.targetRadius += 0.3;
  } else {
    this.targetRadius = 1;
  }

  // speed up the firework
  this.speed *= this.acceleration;

  // get the current velocities based on angle and speed
  var vx = Math.cos(this.angle) * this.speed,
    vy = Math.sin(this.angle) * this.speed;
  // how far will the firework have traveled with velocities applied?
  this.distanceTraveled = calculateDistance(
    this.sx,
    this.sy,
    this.x + vx,
    this.y + vy
  );

  // if the distance traveled, including velocities, is greater than the initial distance to the target, then the target has been reached
  if (this.distanceTraveled >= this.distanceToTarget) {
    createParticles(this.tx, this.ty);
    // remove the firework, use the index passed into the update function to determine which to remove
    fireworks.splice(index, 1);
  } else {
    // target not reached, keep traveling
    this.x += vx;
    this.y += vy;
  }
};

// draw firework
Firework.prototype.draw = function () {
  ctx.beginPath();
  // move to the last tracked coordinate in the set, then draw a line to the current x and y
  ctx.moveTo(
    this.coordinates[this.coordinates.length - 1][0],
    this.coordinates[this.coordinates.length - 1][1]
  );
  ctx.lineTo(this.x, this.y);
  ctx.strokeStyle = "hsl(" + hue + ", 100%, " + this.brightness + "%)";
  ctx.stroke();

  ctx.beginPath();
  // draw the target for this firework with a pulsing circle
  //ctx.arc( this.tx, this.ty, this.targetRadius, 0, Math.PI * 2 );
  ctx.stroke();
};

// create particle
function Particle(x, y) {
  this.x = x;
  this.y = y;
  // track the past coordinates of each particle to create a trail effect, increase the coordinate count to create more prominent trails
  this.coordinates = [];
  this.coordinateCount = 5;

  while (this.coordinateCount--) {
    this.coordinates.push([this.x, this.y]);
  }
  // set a random angle in all possible directions, in radians
  this.angle = random(0, Math.PI * 2);
  this.speed = random(1, 10);
  // friction will slow the particle down
  this.friction = 0.95;
  // gravity will be applied and pull the particle down
  this.gravity = 0.6;
  // set the hue to a random number +-20 of the overall hue variable
  this.hue = random(hue - 20, hue + 20);
  this.brightness = random(50, 80);
  this.alpha = 1;
  // set how fast the particle fades out
  this.decay = random(0.0075, 0.009);
}

// update particle
Particle.prototype.update = function (index) {
  // remove last item in coordinates array
  this.coordinates.pop();
  // add current coordinates to the start of the array
  this.coordinates.unshift([this.x, this.y]);
  // slow down the particle
  this.speed *= this.friction;
  // apply velocity
  this.x += Math.cos(this.angle) * this.speed;
  this.y += Math.sin(this.angle) * this.speed + this.gravity;
  // fade out the particle
  this.alpha -= this.decay;

  // remove the particle once the alpha is low enough, based on the passed in index
  if (this.alpha <= this.decay) {
    particles.splice(index, 1);
  }
};

// draw particle
Particle.prototype.draw = function () {
  ctx.beginPath();
  // move to the last tracked coordinates in the set, then draw a line to the current x and y
  ctx.moveTo(
    this.coordinates[this.coordinates.length - 1][0],
    this.coordinates[this.coordinates.length - 1][1]
  );
  ctx.lineTo(this.x, this.y);
  ctx.strokeStyle =
    "hsla(" +
    this.hue +
    ", 100%, " +
    this.brightness +
    "%, " +
    this.alpha +
    ")";

  ctx.stroke();
};

// create particle group/explosion
function createParticles(x, y) {
  // increase the particle count for a bigger explosion, beware of the canvas performance hit with the increased particles though
  var particleCount = 20;
  while (particleCount--) {
    particles.push(new Particle(x, y));
  }
}

// main demo loop
function loop() {
  // this function will run endlessly with requestAnimationFrame
  requestAnimFrame(loop);

  // increase the hue to get different colored fireworks over time
  hue += 0.5;

  // normally, clearRect() would be used to clear the canvas
  // we want to create a trailing effect though
  // setting the composite operation to destination-out will allow us to clear the canvas at a specific opacity, rather than wiping it entirely
  ctx.globalCompositeOperation = "destination-out";
  // decrease the alpha property to create more prominent trails
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.fillRect(0, 0, cw, ch);
  // change the composite operation back to our main mode
  // lighter creates bright highlight points as the fireworks and particles overlap each other
  ctx.globalCompositeOperation = "lighter";

  // loop over each firework, draw it, update it
  var i = fireworks.length;
  while (i--) {
    fireworks[i].draw();
    fireworks[i].update(i);
  }

  // loop over each particle, draw it, update it
  var i = particles.length;
  while (i--) {
    particles[i].draw();
    particles[i].update(i);
  }

  // launch fireworks automatically to random coordinates, when the mouse isn't down
  if (timerTick >= timerTotal) {
    timerTick = 0;
  } else {
    var temp = timerTick % 400;
    if (temp <= 15) {
      fireworks.push(new Firework(100, ch, random(190, 200), random(90, 100)));
      fireworks.push(
        new Firework(cw - 100, ch, random(cw - 200, cw - 190), random(90, 100))
      );
    }

    var temp3 = temp / 10;

    if (temp > 319) {
      fireworks.push(
        new Firework(
          300 + (temp3 - 31) * 100,
          ch,
          300 + (temp3 - 31) * 100,
          200
        )
      );
    }

    timerTick++;
  }

  // limit the rate at which fireworks get launched when mouse is down
  if (limiterTick >= limiterTotal) {
    if (mousedown) {
      // start the firework at the bottom middle of the screen, then set the current mouse coordinates as the target
      fireworks.push(new Firework(cw / 2, ch, mx, my));
      limiterTick = 0;
    }
  } else {
    limiterTick++;
  }
}

// mouse event bindings
// update the mouse coordinates on mousemove
canvas.addEventListener("mousemove", function (e) {
  mx = e.pageX - canvas.offsetLeft;
  my = e.pageY - canvas.offsetTop;
});

// toggle mousedown state and prevent canvas from being selected
canvas.addEventListener("mousedown", function (e) {
  e.preventDefault();
  mousedown = true;
});

canvas.addEventListener("mouseup", function (e) {
  e.preventDefault();
  mousedown = false;
});

// once the window loads, we are ready for some fireworks!
window.onload = loop;

var canvas1 = document.getElementById("lixi"),
  ctx = canvas1.getContext("2d"),
  things = [],
  thingsCount = 124,
  mouse = {
    x: -100,
    y: -100,
  },
  minDist = 150;

canvas1.width = window.innerWidth;
canvas1.height = window.innerHeight;

// object image
var image = new Image();
image.src = "./lixi.png";
// image.src = 'https://i.pinimg.com/originals/90/2c/2b/902c2bbccb72ca76cf3bbe95741174e9.png';
// image.src = 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/Love_heart_uidaodjsdsew.gif/1200px-Love_heart_uidaodjsdsew.gif';
// image.src = 'https://static.wixstatic.com/media/2cd43b_57438aebde5a4b0fa20c6880a9fafabf~mv2.png/v1/fill/w_320,h_272,fp_0.50_0.50/2cd43b_57438aebde5a4b0fa20c6880a9fafabf~mv2.png';

for (var i = 0; i < thingsCount; i++) {
  let thingWidth = Math.floor(Math.random() * 20) + 20;
  let thingHeight = (image.naturalHeight / image.naturalWidth) * thingWidth;
  let speed = Math.floor(Math.random() * 2) + 0.5;
  things.push({
    width: thingWidth,
    height: thingHeight,
    x: Math.random() * canvas1.width,
    y: Math.random() * canvas1.height - thingHeight,
    speed: speed,
    vY: speed,
    vX: 0,
    d: Math.random() * 1.2 - 0.6,
    stepSize: Math.random() / 20,
    step: 0,
    angle: Math.random() * 180 - 90,
    rad: Math.floor(Math.random()),
    opacity: Math.random() + 0.4,
    _ratate: Math.floor(Math.random()), // ratate 正負
  });
}

function drawThings() {
  things.map((thing) => {
    ctx.beginPath();
    thing.rad = (thing.angle * Math.PI) / 180;
    ctx.save();
    var cx = thing.x + thing.width / 2;
    var cy = thing.y + thing.height / 2;
    ctx.globalAlpha = thing.opacity;
    ctx.setTransform(
      Math.cos(thing.rad),
      Math.sin(thing.rad),
      -Math.sin(thing.rad),
      Math.cos(thing.rad),
      cx - cx * Math.cos(thing.rad) + cy * Math.sin(thing.rad),
      cy - cx * Math.sin(thing.rad) - cy * Math.cos(thing.rad)
    );
    ctx.drawImage(image, thing.x, thing.y, thing.width, thing.height);
    ctx.restore();
  });
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawThings();
}

function update() {
  things.map((thing) => {
    var dist = Math.sqrt((thing.x - mouse.x) ** 2 + (thing.y - mouse.y) ** 2);

    if (dist < minDist) {
      var force = minDist / (dist * dist),
        xcomp = (mouse.x - thing.x) / dist,
        ycomp = (mouse.y - thing.y) / dist,
        deltaV = force * 2; // deplay when hover mouse

      thing.vX -= deltaV * xcomp;
      thing.vY -= deltaV * ycomp;

      if (thing.d * xcomp > 0) {
        thing.d = 0 - thing.d;
      }
    } else {
      thing.vX *= 0.98;

      if (thing.vY < thing.speed) {
        thing.vY = thing.speed;
      }

      thing.vX +=
        Math.cos((thing.step += Math.random() * 0.05)) * thing.stepSize;
    }

    thing.y += thing.vY;
    thing.x += thing.vX + thing.d;

    var _angle = Math.random() + 0.2;
    // stuff.angle += _angle;
    if (thing._ratate == 0) {
      thing.angle += _angle;
    } else {
      thing.angle -= _angle;
    }

    if (thing.y > canvas1.height) {
      reset(thing);
    }

    if (thing.x > canvas1.width || thing.x < 0 - thing.width) {
      reset(thing);
    }
  });
}

canvas1.addEventListener("mousemove", function (e) {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

function reset(thing) {
  thing.width = Math.floor(Math.random() * 20) + 20;
  thing.height = (image.naturalHeight / image.naturalWidth) * thing.width;
  thing.x = Math.floor(Math.random() * canvas1.width);
  thing.y = 0 - thing.height;
  thing.speed = Math.floor(Math.random() * 2) + 0.5;
  thing.vY = thing.speed;
  thing.vX = 0;
  // thing.angle = 0;
  // thing.rad = 0;
  thing._ratate = Math.floor(Math.random());
}

function tick() {
  draw();
  update();
  requestAnimationFrame(tick);
}

tick();

setTimeout(function () {
  document.getElementById("new-year").style.display = "none";
  document.getElementById("showMain").style.display = "block";
}, 8500);
