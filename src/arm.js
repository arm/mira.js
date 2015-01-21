var five = require('johnny-five');
var Leap = require('leapjs');

var Arm = function(board) {
	this.board = board;

	var servoPins = {
		'pinch': 13, 
		'pitch': 12,
		'roll': 11,
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

	var servoBounds = {
		'pinch': {
			closed: 15,
			open: 90
		}
	}

	arm.setServo = function(servoName, value) {
		this.servos[servoName].to(value);
	}

	arm.setPinch = function(value) { // 0.0 (open) - 1.0 (closed)
		var bounds = servoBounds['pinch']; 
		this.setServo('pinch', scale(value, bounds.open, bounds.closed));
	}

	arm.setRoll = function(value) { // 0.0 (palm left) - 1.0 (palm right)

	}

	arm.setPitch = function(value) {

	}

	function scale(value, min, max) { // value from 0.0 - 1.0
		return value * (max - min) + min;
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
