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
	var arm = new Object();

	return arm;
})();

var board = new five.Board({
	repl: false
});

board.on('ready', function() {
	// var arm = Arm(this);
	var options = {};
	var controller = Leap.loop(options, function(frame) {
		if (frame.hands.length > 0) {
			var hand = frame.hands[0];
			var pos = toCoords(hand.palmPosition);
		}
	});


	function toCoords(position) {
		return {
			x: position[0],
			y: position[1],
			z: position[2]
		}
	}
	
});
