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
	console.log(this.servos);
	this.lights = new five.Led(ledsPin);
	this.forearmLength = 128.86;
	this.upperArmLength = 140;
}

Arm.prototype = (function() {
	var arm = {};

	// all from behind of arm
	var servoBounds = {
		'pinch': {
			closed: 10,
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
		},
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

	// could probably do away with some of these:

	// arm.setServo = function(servoName, value) {
	// 	this.servos[servoName].to(value);
	// }

	arm.setPinch = function(value) { // 0 - open, 1- closed
		var bounds = servoBounds['pinch'];
		this.servos['pinch'].to(scale(value, bounds.open, bounds.closed));
	}

	arm.setBase = function(value) { // 0.0 (left) - 1.0 (right)
		var bounds = servoBounds['base'];
		this.servos['base'].to(scale(value, bounds.left, bounds.right));
	}

	arm.to = function(x, y, z) { // x, y, z are each -1.0 - 1.0
		// z: 0 (back), 1 (forward)
		// x: -1 (left), 1 (right)
		// y: 0 (down), 1 (up)

		var l1 = this.upperArmLength,
		l2 = this.forearmLength;

		var base = this.calculateRotation(x, z);
		var distance = dist(x, z) * (l1 + l2);

		y = y * (l1 + l2);

		var theta_2 = Math.atan2(-Math.sqrt(1 - (Math.pow(Math.pow(distance, 2) + Math.pow(y, 2) - Math.pow(l1, 2) - Math.pow(l2, 2) / (2 * l1 * l2), 2)), ((Math.pow(distance, 2) + Math.pow(y, 2) - Math.pow(l1, 2) - Math.pow(l2, 2)) / (2 * l1 * l2)), 2));
		var k1 = l1 + l2 * Math.cos(theta_2);
		var k2 = l2 * Math.sin(theta_2);

		var theta_1 = Math.atan2(y, distance) - Math.atan2(k2, k1)  // in radians
		var shoulder = radToDeg(theta_1) / 180;
		var elbow = radToDeg(theta_2) / 180;

		this.setBase(base / 180); // maybe later change these to just get angle and set it
		// this.setShoulder(shoulder);
		// this.setElbow(elbow);

		console.log(shoulder, elbow);



	}

	arm.calculateRotation = function(x, z) {
		var rotation = radToDeg(Math.atan(z / x));
		if (x < 0) {
		 	rotation = 180 + rotation;
		}
		return 180 - rotation;
	}

	function dist(a, b) {
		return Math.sqrt(Math.pow(a, 2), Math.pow(b, 2));
	}

	function radToDeg(radians) {
		return radians * (180 / Math.PI);
	}

	function scale(value, min, max) { // value from 0.0 - 1.0
		return clamp(value, 0, 1) * (max - min) + min;
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
			// arm.to(pos.x, pos.y, pos.z);
			debug(pinch);
			document.getElementById('coords').innerHTML = '('+String(pos.x)+', '+String(pos.y)+', '+String(pos.z)+')';
		}
	});

	function toCoords(position) {
		return {
			x: 2 * position[0] - 1,
			y: position[1],
			z: 1 - position[2]
		}
	}

	function radToDeg(radians) {
		return radians * (180 / Math.PI);
	}

});


function debug(a) {
	document.getElementById('debug').innerHTML = String(a);
}