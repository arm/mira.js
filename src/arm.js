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
	this.history = [];
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
	for (var name in servoPins) {
		var pin = servoPins[name];
		this.servos[name] = new five.Servo(pin);
	}
	// console.log(this.servos);
	this.lights = new five.Led(ledsPin);
	this.forearmLength = 128.86;
	this.upperArmLength = 140;
}

Arm.prototype = (function() {
	var arm = {};

	// all from behind of arm
	var servoBounds = {
		'pinch': { // maybe change all to lower, upper -- then can set position of all automatically using an obj
			low: 90, // open
			high: 10 // closed
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
			low: 25, // down
			high: 156 // up
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
		var maxStep = 0.005;
		var last = this.lastState[name];
		var difference = clamp(value, 0, 1) - last;
		if (Math.abs(difference) > maxChange && !playing) {
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
		
		y = y * (l1 + l2) + 50; // offset
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

	arm.playHistory = function() {
		playing = true;
		var ref = this;
		for (var i = 0; i < this.history.length; i++) {
			setTimeout(function(val, end) {
				console.log(ref.history[val]);
				ref.toState(ref.history[val]); // if use 'i', then it will use i at the value during call time, which will be history.length
				playing = !end;
				// console.log(end);
			}, i * 1000 / (1.5 * recordingFramerate), i, i >= this.history.length - 1); // playback speed not exact! try to fix this later
		}
		// console.log(ref.history);
	}

	arm.addHistory = function() {
		this.history.push(clone(this.state));
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
var recording = false;
var playing = false;

var recordingFramerate = 10; // frames per second
var timer = 0;

board.on('ready', function() {
	var arm = new Arm(this);
	arm.init();

	var spinner = document.getElementById('spinner');
	spinner.style.display = 'none';

	controls.style.display = 'box';
	var recordButton = document.getElementById('record');
	recordButton.removeAttribute('disabled');
	recordButton.onclick = function() {
		recording = !recording;

		if (recording) {
			this.innerHTML = 'stop recording';
			arm.history = [];
			timer = 0;
		}
		else {
			this.innerHTML = 'record';
		}
	}

	var playButton = document.getElementById('play');
	playButton.removeAttribute('disabled');
	playButton.onclick = function() {
		if (!playing) {
			arm.playHistory();
		}
	}

	var options = {};
	var controller = Leap.loop(options, function(frame) {
		if (frame.hands.length > 0 && !playing) {

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

			if (recording) {
				timer++; // increments by 60 every second
				if (timer % (60 / 10) == 0) {
					arm.addHistory();
				}
			}	
			// debug(arm.state['shoulderLeft']+' '+arm.state['shoulderRight']);
			// document.getElementById('coords').innerHTML = '('+String(pos.x)+', '+String(pos.y)+', '+String(pos.z)+')';
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

function clone(obj) {
	return JSON.parse(JSON.stringify(obj));
}