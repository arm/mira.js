var five = require('johnny-five');
var Leap = require('leapjs');

// fix for node-webkit
// https://github.com/rwaldron/johnny-five/wiki/Getting-started-with-Johnny-Five-and-Node-Webkit
var Readable = require("stream").Readable;
var util = require("util");
util.inherits(MyStream, Readable);
function MyStream(opt) {
  Readable.call(this, opt);
}
MyStream.prototype._read = function() {};
// hook in our stream
process.__defineGetter__("stdin", function() {
  if (process.__stdin) return process.__stdin;
  process.__stdin = new MyStream();
  return process.__stdin;
});

var Arm = function(board) {
	this.board = board;

	var servoPins = {
		'pinch': 13, 
		'roll': 12,
		'pitch': 11,
		'elbow': 10,
		'shoulderLeft': 9,
		'shoulderRight': 8,
		'base': 7
	}
	var ledsPin = 6;

	this.servos = new Object();
	for (name in servoPins) {
		var pin = servoPins[name];
		this.servos[name] = new five.Servo(pin);
	}
	this.lights = new five.Led(ledsPin);
}

Arm.prototype = (function() {
	var arm = {};

	// all from behind of arm
	var servoBounds = {
		'pinch': {
			closed: 15,
			open: 90
		},
		'roll': { // palm facing (side with servo)
			left: 180,
			right: 0
		},
		'pitch': {
			down: 180,
			up: 0
		},
		'elbow': { // has to be given values in this range -- otherwise sevo disengages
			down: 23,
			up: 157
		}.
		'shoulderLeft': {
			back: 0,
			forward: 175
		},	
		'shoulderRight': {
			back: 175,
			forward: 0
		},
		'base': {
			left: 180,
			right: 0
		}
	}

	arm.setServo = function(servoName, value) {
		this.servos[servoName].to(value);
	}

	arm.setPinch = function(value) { // 0.0 (open) - 1.0 (closed)
		var bounds = servoBounds['pinch']; 
		this.setServo('pinch', this.scale(value, bounds.open, bounds.closed));
	}

	arm.setRoll = function(value) { // 0.0 (palm left) - 1.0 (palm right)

	}

	arm.setPitch = function(value) { // 0.0 (pointing down) - 1.0 (up)

	}

	arm.to = function(x, y, z) { // x, y, z are each 0.0 - 1.0
		var base = calculateRotation(x, z);
	
	}

	arm.calculateRotation = function(x, z) { 

	}

	function scale(value, min, max) { // value from 0.0 - 1.0
		return this.clamp(value) * (max - min) + min;
	}

	function clamp(n, min, max) {
		return Math.min(Math.max(n, min), max);
	}

	return arm;
})();

var board = new five.Board({
	repl: false
});

board.on('ready', function() {
	var arm = new Arm(this);

	var options = {};
	var controller = Leap.loop(options, function(frame) {
		if (frame.hands.length > 0) {
			var hand = frame.hands[0];
			var box = frame.interactionBox;

			var pos = toCoords(box.normalizePoint(hand.palmPosition, true));
			
			var pinch = hand.pinchStrength;

			var roll = radToDeg(hand.roll());
			var pitch = radToDeg(hand.pitch());

			arm.setPinch(pinch);

			document.getElementById('coords').innerHTML = pos;

		}
	});

	function toCoords(position) {
		return {
			x: position[0],
			y: position[1],
			z: position[2]
		}
	}

	function radToDeg(radians) {
		return radians * (180 / Math.PI);
	}
});
