global.document = window.document;

var five = require('johnny-five');
var Leap = require('leapjs');
var fs = require('fs'); 

var THREE = require('three');
// see if can do better later, rewrite into module?
eval(fs.readFileSync('src/leap-plugins-0.1.10.js')+''); // these don't seem to be working
eval(fs.readFileSync('src/leap.rigged-hand-0.1.6.js')+'');

// var controller = Leap.loop({}, function(frame) {
// 		// if (frame.hands.length > 0) {
// 		// var hand = frame.hands[0];
// 	// }
// }).use('riggedHand');

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

	this.state = {};
	this.lastState = {};
	// this.lastState = this.state;

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
	// console.log(this.servos);
	this.lights = new five.Led(ledsPin);
	this.forearmLength = 128.86;
	this.upperArmLength = 140;

	this.init();
}

Arm.prototype = (function() {
	var arm = {};

	// all from behind of arm
	var servoBounds = {
		'pinch': { // maybe change all to lower, upper -- then can set position of all automatically using an obj
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
			down: 25,
			up: 156
		},
		'shoulderLeft': {
			back: 0,
			forward: 175
		},	
		'shoulderRight': {
			back: 175, // relative to shoulder
			forward: 0
		},
		'base': {
			left: 180,
			right: 0
		}
	}

	arm.init = function() { // initialize state and servos
		// this.state = { // to store state of the arm
		// 	'pinch': -1,
		// 	'roll': -1, 
		// 	'elbow': -1,
		// 	'shoulderLeft': -1,
		// 	'shoulderRight': -1,
		// 	'base': -1,
		// 	'light': -1,
		// }
	}

	arm.set = function(name, value, lower, upper) { // maybe store all components in one obj, rather than just servos (e.g. the lights)
		this.state[name] = clamp(value, 0, 1);
		var scaled = scale(value, lower, upper);
		this.servos[name].to(scaled);
	}

	arm.setLight = function(brightness) { // brightness from 0 - 1
		this.lights.brightness(scale(brightness, 0, 255));
	}

	arm.get = function(name) {
		return this.state[name];
	}

	arm.commitState = function() {
		this.lastState = this.state;
	}

	arm.setPinch = function(value) { // 0 - open, 1- closed
		var bounds = servoBounds['pinch'];
		this.set('pinch', value, bounds.open, bounds.closed);
	}

	// consider changing to take angle
	arm.setRoll = function(value) { // 0 - facing left, 1 - right
		var bounds = servoBounds['roll'];
		this.set('roll', value, bounds.left, bounds.right);
	}

	arm.setPitch = function(value) { // 0 - down, 1 - up
		var bounds = servoBounds['pitch'];
		var compensated = this.state['shoulderLeft'] - this.state['elbow'] + 0.5; // should keep wrist parallel to ground always, must test + add wrist movement
		this.set('pitch', compensated, bounds.down, bounds.up);
	}

	arm.setElbow = function(value) { // 0.0 (down)- 1.0 (up)
		var bounds = servoBounds['elbow'];
		this.set('elbow', value, bounds.down, bounds.up);
	} 

	arm.setShoulder = function(value) { // 0.0 (back) - 1.0 (forward) 
		var leftBounds = servoBounds['shoulderLeft'];
		var rightBounds = servoBounds['shoulderRight']; 
		// console.log(value);
		debug(scale(value, leftBounds.back, leftBounds.forward)+' '+scale(value, rightBounds.back, rightBounds.forward));
		this.set('shoulderLeft', value, leftBounds.back, leftBounds.forward);
		this.set('shoulderRight', value, rightBounds.back, rightBounds.forward);
	}

	arm.setBase = function(value) { // 0.0 (left) - 1.0 (right)
		var bounds = servoBounds['base'];
		this.set('base', value, bounds.left, bounds.right);
	}

	arm.to = function(x, y, z) { // x, y, z are each -1.0 - 1.0
		// z: 0 (back), 1 (forward)
		// x: -1 (left), 1 (right)
		// y: 0 (down), 1 (up)

		var l1 = this.upperArmLength;
		var l2 = this.forearmLength;

		var base = this.calculateRotation(x, z);
		
		y = y * (l1 + l2);
		x = x * (l1 + l2);
		z = z * (l1 + l2);

		var distance = dist(x, z);

		var theta_2 = Math.atan2(-Math.sqrt(1 - (Math.pow(Math.pow(distance, 2) + Math.pow(y, 2) - Math.pow(l1, 2) - Math.pow(l2, 2) / (2 * l1 * l2), 2)), ((Math.pow(distance, 2) + Math.pow(y, 2) - Math.pow(l1, 2) - Math.pow(l2, 2)) / (2 * l1 * l2)), 2));

		var a = Math.pow(distance, 2) + Math.pow(y, 2) - Math.pow(l1, 2) - Math.pow(l2, 2); 
		var b = (2 * l1 * l2);
		theta_2 = Math.atan2(-Math.sqrt(1 - Math.pow(a / b, 2)), (a / b));

		var k1 = l1 + l2 * Math.cos(theta_2);
		var k2 = l2 * Math.sin(theta_2);

		var theta_1 = Math.atan2(y, distance) - Math.atan2(k2, k1);  // in radians
		var shoulder = radToDeg(theta_1);
		var elbow = radToDeg(theta_2);

		if (!isNaN(shoulder)) { // if within range
			blinking = false;
			this.lights.stop();
			this.setLight(1);
			this.setBase(base / 180); // maybe later change these to just get angle and set it
			this.setShoulder(shoulder / 180);
			this.setElbow((180 + elbow) / 180);
		}
		else { // change to use new state storing
			if (!blinking) {
				this.lights.pulse(1000);
			}
			blinking = true;
			this.setElbow( (180 + this.lastState['elbow']) / 180 );
		}

		// console.log(shoulder, elbow);
	}

	arm.calculateRotation = function(x, z) {
		var rotation = radToDeg(Math.atan(z / x));
		if (x < 0) {
			rotation = 180 + rotation;
		}
		return 180 - rotation;
	}

	function dist(a, b) {
		return Math.sqrt(Math.pow(a, 2) + Math.pow(b, 2));
	}

	function radToDeg(radians) {
		return radians * (180 / Math.PI);
	}

	function scale(value, min, max) { // value from 0.0 - 1.0
		return clamp(value, 0, 1) * (max - min) + min;
	}

	return arm;
})();

var board = new five.Board({
	repl: false
});

var boxBounds = {
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

var blinking = false;

board.on('ready', function() {
	var arm = new Arm(this);

	var options = {};
	var controller = Leap.loop(options, function(frame) {
		if (frame.hands.length > 0) {
			var hand = frame.hands[0];
			// var box = frame.interactionBox;
			// var pos = toCoords(box.normalizePoint(hand.palmPosition, true));

			var pos = toCoords(hand.palmPosition);

			var pinch = hand.pinchStrength;

			var roll = radToDeg(hand.roll()); // -90: facing left, 90: facing right
			var pitch = radToDeg(hand.pitch()); // -90: down, 90: up

			arm.setPinch(pinch);
			arm.setRoll( (roll + 90) / 180 );
			arm.to(pos.x, pos.y, pos.z);
			arm.setPitch( (pitch + 90) / 180);
			arm.commitState();
			// debug(arm.state['shoulderLeft']+' '+arm.state['shoulderRight']);
			document.getElementById('coords').innerHTML = '('+String(pos.x)+', '+String(pos.y)+', '+String(pos.z)+')';
		}
		else if (!blinking) {
			arm.lights.pulse(1000);
			blinking = true;
		}
	});

	function toCoords(position) { // normalizes point with custom bounds
		return { // maybe add scaling function here
			x: 2 * (clamp(position[0], boxBounds.x.min, boxBounds.x.max) - boxBounds.x.min) / (boxBounds.x.max - boxBounds.x.min) - 1,
			y: (clamp(position[1], boxBounds.y.min, boxBounds.y.max) - boxBounds.y.min) / (boxBounds.y.max - boxBounds.y.min),
			z: 1 - (clamp(position[2], boxBounds.z.min, boxBounds.z.max) - boxBounds.z.min) / (boxBounds.z.max - boxBounds.z.min),
		}
	}

	function radToDeg(radians) {
		return radians * (180 / Math.PI);
	}

});

function debug(a) {
	document.getElementById('debug').innerHTML = String(a);
}

function clamp(n, min, max) {
	return Math.min(Math.max(n, min), max);
}


