var five = require('johnny-five');
var fs = require('fs');

var Arm = function(board, fps) {
	this.board = board;
	this.fps = fps;

	this.state = {};
	this.lastState = {};
	// this.lastState = this.state;

	var servoPins = {
		'pinch': 10,
		'roll': 9,
		'pitch': 8,
		'elbow': 7,
		'shoulderLeft': 6,
		'shoulderRight': 5,
		'base': 4
	}
	var ledsPin = 11;

	this.servos = new Object();
	for (var name in servoPins) {
		var pin = servoPins[name];
		this.servos[name] = new five.Servo(pin);
	}
	// console.log(this.servos);
	this.lights = new five.Led(ledsPin);
	this.forearmLength = 128.86;
	this.upperArmLength = 140;
	this.blinking = false; // move blink logic to outside arm obj -- keep blink var
}

Arm.prototype = (function() {
	var arm = {};

	// all from behind of arm
	var servoBounds = {
		'pinch': { // maybe change all to lower, upper -- then can set position of all automatically using an obj
			low: 180, // open
			high: 96 // closed
		},
		'roll': { // palm facing (side with servo)
			low: 180, // left
			high: 0 // right
		},
		'pitch': {
			low: 180, // down
			high: 0 // up
		},
		'elbow': { // has to be given values in this range -- otherwise sevo disengages
			low: 0, // down
			high: 180 // up
		},
		'shoulderLeft': {
			low: 0, // back
			high: 180 // forward
		},
		'shoulderRight': { // relative to shoulder
			low: 180, // back
			high: 0 // forward
		},
		'base': {
			low: 180, // left
			high: 0 // right
		}
	}

	arm.init = function() { // initialize state and servos
		var initState = {
			'pinch': 0.5,
			'roll': 0.5,
			'pitch': 0.5,
			'elbow': 0.5,
			'shoulderLeft': 0.5,
			'shoulderRight': 0.5,
			'base': 0.5
		};
		this.toState(initState);
	}

	arm.set = function(name, value, bounds, maxChange) { // maybe store all components in one obj, rather than just servos (e.g. the lights)
		// var maxChange = 0.005;
		if (!maxChange) {
			maxChange = 0.5;
		}
		// var maxStep = 0.003;
		var maxStep = 0.001;
		var last = this.lastState[name];
		var difference = clamp(value, 0, 1) - last;
		if (Math.abs(difference) > maxChange) {
			if (difference >= 0) {
				value = last + maxStep;
			}
			else {
				value = last - maxStep;
			}
		}
		var scaled = scale(value, bounds.low, bounds.high);
		this.state[name] = clamp(value, 0, 1);
		this.servos[name].to(scaled);
	}

	arm.setLight = function(brightness) { // brightness from 0 - 1
		this.lights.brightness(scale(brightness, 0, 255));
	}

	arm.get = function(name) {
		return this.state[name];
	}

	arm.commitState = function() {
		this.lastState = clone(this.state);
	}

	arm.setPinch = function(value) { // 0 - open, 1- closed
		var bounds = servoBounds['pinch'];
		if (value >= 0.6) {
			value = 1;
		}
		this.set('pinch', value, bounds, 1000);
	}

	// consider changing to take angle
	arm.setRoll = function(value) { // 0 - facing left, 1 - right
		var bounds = servoBounds['roll'];
		this.set('roll', value, bounds);
	}

	arm.setPitch = function(value) { // 0 - down, 1 - up
		var bounds = servoBounds['pitch'];
		var compensated = (this.state['shoulderLeft'] / 6) - (this.state['elbow'] / 9) + value; // should keep wrist parallel to ground always, must test + add wrist movement
		this.set('pitch', compensated, bounds);
	}

	arm.setElbow = function(value) { // 0.0 (down)- 1.0 (up)
		var bounds = servoBounds['elbow'];
		this.set('elbow', value, bounds);
	}

	arm.setShoulder = function(value) { // 0.0 (back) - 1.0 (forward)
		var leftBounds = servoBounds['shoulderLeft'];
		var rightBounds = servoBounds['shoulderRight'];
		// console.log(value);
		this.set('shoulderLeft', value, leftBounds);
		this.set('shoulderRight', value, rightBounds);
	}

	arm.setBase = function(value) { // 0.0 (left) - 1.0 (right)
		var bounds = servoBounds['base'];
		this.set('base', value, bounds);
	}

	arm.to = function(x, y, z) { // x, y, z are each -1.0 - 1.0
		// z: 0 (back), 1 (forward)
		// x: -1 (left), 1 (right)
		// y: 0 (down), 1 (up)

		var l1 = this.upperArmLength;
		var l2 = this.forearmLength;

		var base = this.calculateRotation(x, z);

		y = y * (l1 + l2); // offset
		x = x * (l1 + l2);
		z = z * (l1 + l2);

		var distance = dist(x, z);

		// var theta_2 = Math.atan2(-Math.sqrt(1 - (Math.pow(Math.pow(distance, 2) + Math.pow(y, 2) - Math.pow(l1, 2) - Math.pow(l2, 2) / (2 * l1 * l2), 2)), ((Math.pow(distance, 2) + Math.pow(y, 2) - Math.pow(l1, 2) - Math.pow(l2, 2)) / (2 * l1 * l2)), 2));

		var a = Math.pow(distance, 2) + Math.pow(y, 2) - Math.pow(l1, 2) - Math.pow(l2, 2);
		var b = (2 * l1 * l2);
		var theta_2 = Math.atan2(-Math.sqrt(1 - Math.pow(a / b, 2)), (a / b));

		var k1 = l1 + l2 * Math.cos(theta_2);
		var k2 = l2 * Math.sin(theta_2);

		var theta_1 = Math.atan2(y, distance) - Math.atan2(k2, k1);  // in radians
		var shoulder = radToDeg(theta_1);
		var elbow = radToDeg(theta_2);

		if (!isNaN(shoulder)) { // if within range
			this.blinking = false;
			this.lights.stop();
			this.setLight(1);
			this.setBase(base / 180); // maybe later change these to just get angle and set it
			this.setShoulder(shoulder / 180);
			this.setElbow((180 + elbow) / 180);
		}
		else { // change to use new state storing
			if (!this.blinking) {
				this.lights.pulse(1000);
			}
			this.blinking = true;
			this.setElbow( (180 + this.lastState['elbow']) / 180 );
		}

		// console.log(shoulder, elbow);
	}

	arm.toState = function(positions) {
		for (var name in positions) {
			var bounds = servoBounds[name];
			this.set(name, positions[name], bounds);
		}
		this.commitState();
	}

	arm.calculateRotation = function(x, z) {
		var rotation = radToDeg(Math.atan(z / x));
		if (x < 0) {
			rotation = 180 + rotation;
		}
		return 180 - rotation;
	}

	arm.getState = function() {
		return clone(this.state);
	}

	arm.getLastState = function() {
		return clone(this.lastState);
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

module.exports = Arm;

function clamp(n, min, max) {
	return Math.min(Math.max(n, min), max);
}

function clone(obj) {
	return JSON.parse(JSON.stringify(obj));
}
