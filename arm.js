var five = require('johnny-five');

function Arm(board) {
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
	var arm = Arm(this);
});
