var five = require('johnny-five');
var Leap = require('leapjs');

var fs = require('fs');

var Arm = require('./arm.js');

var board = new five.Board({
	repl: false
});

var leapBounds = {
	x: {
		min: -200,
		max: 200
	},
	y: {
		min: 150,
		max: 500
	},
	z: {
		min: -200,
		max: 200
	}
}

var stdin = process.stdin;

// without this, we would only get streams once enter is pressed
stdin.setRawMode( true );

// resume stdin in the parent process (node app won't quit all by itself
// unless an error or process.exit() happens)
stdin.resume();

// i don't want binary, do you?
stdin.setEncoding( 'utf8' );

// on any data into stdin
stdin.on( 'data', function( key ){
  // ctrl-c ( end of text )
  if ( key === ' ') {
		if (!recording) {
			arm.history = [];
    	recording = true;
		}
		else {
			recording = false;
		}
  }

	if ( key === '\u0003' ) {
	    process.exit();
	  }


	if (key === 'p') {
		if (!Arm.status.playing) {
			arm.playHistory();
		}
	}

  // write the key to stdout all normal like

});

var fps = 30;

var recording = false;

Arm.status.playing = false;
Arm.status.blinking = false;

var arm;

board.on('ready', function() {
	arm = new Arm(this, fps, Arm.status); // todo: remove status var
	arm.init();
	useLeapMotion(arm);
});

function useLeapMotion(arm) {
	var controller = new Leap.Controller();
	controller.on('connect', function() {
		setInterval(function() {
			var frame = controller.frame();
			handleFrame(frame);
		}, 1000 / fps);
	});
	controller.connect();
	function handleFrame(frame) {
		if (frame.hands.length > 0 && !Arm.status.playing) {


			var hand = frame.hands[0];
			// var box = frame.interactionBox;
			// var pos = toCoords(box.normalizePoint(hand.palmPosition, true));

			var pos = toCoords(hand.palmPosition, leapBounds);

			var pinch = hand.pinchStrength;

			var roll = radToDeg(hand.roll()); // -90: facing left, 90: facing right
			var pitch = radToDeg(hand.pitch()); // -90: down, 90: up

			arm.setPinch(pinch);
			arm.setRoll( (roll + 90) / 180 );
			arm.to(pos.x, pos.y, pos.z);
			arm.setPitch( (pitch + 90) / 180);
			arm.commitState();

			if (recording) {
				arm.addHistory();
			}
			// debug(arm.state['shoulderLeft']+' '+arm.state['shoulderRight']);
			// document.getElementById('coords').innerHTML = '('+String(pos.x)+', '+String(pos.y)+', '+String(pos.z)+')';
		}
		else if (!Arm.status.blinking) {
			arm.lights.pulse(1000);
			Arm.status.blinking = true;
		}
	}

	function radToDeg(radians) {
		return radians * (180 / Math.PI);
	}

}

function toCoords(position, bounds) { // normalizes point with custom bounds
	return { // maybe add scaling function here
		x: 2 * (clamp(position[0], bounds.x.min, bounds.x.max) - bounds.x.min) / (bounds.x.max - bounds.x.min) - 1,
		y: (clamp(position[1], bounds.y.min, bounds.y.max) - bounds.y.min) / (bounds.y.max - bounds.y.min),
		z: 1 - (clamp(position[2], bounds.z.min, bounds.z.max) - bounds.z.min) / (bounds.z.max - bounds.z.min),
	}
}

function debug(a) {
	document.getElementById('debug').innerHTML = String(a);
}

function clamp(n, min, max) {
	return Math.min(Math.max(n, min), max);
}
