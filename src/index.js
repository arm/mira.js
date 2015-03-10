global.document = window.document;

var five = require('johnny-five');
var Leap = require('leapjs');

var fs = require('fs'); 

var Arm = require('./arm.js');

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

// var controllerBounds = {
// 	x {

// 	},
// 	y {

// 	},
// 	z {

// 	}
// }

var fps = 30;

var blinking = false;
var recording = false;
var playing = false;

board.on('ready', function() {
	var arm = new Arm(this);
	arm.init();
	initializeUI(arm);
	useKeyboard(arm);
	// useController(arm);
	// useLeapMotion(arm);
});

function useKeyboard(arm) {
	var pos = {x: 0, y: 0.5, z: 0.5};
	var pressed = {};
	initializeKeyboard();
	run();

	function initializeKeyboard(obj) {
		document.addEventListener('keydown', function(e) {
			console.log(e.keyCode);
			pressed[e.keyCode] = true;
		});

		document.addEventListener('keyup', function(e) {
			pressed[e.keyCode] = false;
		});

	}

	function run() {
		setTimeout(function() {
			updateState();
			moveArm(pos);
			window.requestAnimationFrame(run);
		}, 1000 / fps);
	}

	function isPressed(key) {
		var codes = {
			'up': 38,
			'down': 40,
			'left': 37,
			'right': 39
		}
		if (pressed[codes[key]]) return true;
		return false;
	}

	var change = 0.01;
	function updateState() {
		if (isPressed('up')) {
			pos.z += change;
		}
		if (isPressed('down')) {
			pos.z -= change;
		}
		if (isPressed('left')) {
			pos.x -= change;
		}
		if (isPressed('right')) {
			pos.x += change;
		}
		clampPos(pos);
	}

	function clampPos(pos) {
		pos.x = clamp(pos.x, -1, 1);
		pos.y = clamp(pos.y, 0, 1);
		pos.z = clamp(pos.z, 0, 1);
	}

	function moveArm(pos) {
		arm.to(pos.x, pos.y, pos.z);
	}

}







function useController(arm) {
	var express = require('express');
	var app = express();
	var bodyParser = require('body-parser');
	app.use(bodyParser.json());
	var controlling = false;

	var controller = {};

	// normal dirname is broken bc of node webkit i think?
	__dirname = '/Users/Michael/Desktop/Arduino Programs/sci_fair/final-js';

	app.get('/', function(req, resp) {
		resp.sendFile(__dirname + '/src/controller/controller.html');
	});

	app.post('/control', function(req, resp) {
		controlling = req.body.controlling;
		if (controlling) {
			run();
		}
	});

	app.post('/values', function(req, resp) {
		controller = req.body.controller;
	});

	function run() {
		setTimeout(function() {
			moveArm(controller);
			if (controlling) {
				window.requestAnimationFrame(run);
			}
		}, 1000 / fps);
	}

	function moveArm(controller) { // get to work for Leap Motion as well
		if (controller) {
			var pos = toCoords(controller.coordinates, controllerBounds);

			var pinch = controller.pinchStrength;

			// var roll = radToDeg(controller.roll()); // -90: facing left, 90: facing right
			// var pitch = radToDeg(controller.pitch()); // -90: down, 90: up

			arm.setPinch(pinch);
			// arm.setRoll( (roll + 90) / 180 );
			arm.to(pos.x, pos.y, pos.z);
			// arm.setPitch( (pitch + 90) / 180);
			arm.commitState();

			if (recording) {
				arm.addHistory();
			}	
		}
	}

	var server = app.listen(3000, function() {
		var host = server.address().address;
		var port = server.address().port;

		console.log('Listening at http://%s:%s', host, port);
	});
}

function initializeUI(arm) {
	var spinner = document.getElementById('spinner');
	spinner.style.display = 'none';

	controls.style.display = 'box';
	var recordButton = document.getElementById('record');
	var saveButton = document.getElementById('save');
	recordButton.removeAttribute('disabled');
	recordButton.onclick = function() {
		recording = !recording;

		if (recording) {
			this.innerHTML = 'stop';
			arm.history = [];
			timer = 0;
			if (saveButton.hasAttribute('disabled')) {
				saveButton.removeAttribute('disabled');
			}
		}
		else {
			this.innerHTML = 'record';
		}
	}

	var playButton = document.getElementById('play');
	playButton.removeAttribute('disabled');
	playButton.onclick = function() {
		if (!playing) {
			var filepath = 'recordings/recording_0.json';
			arm.playHistoryFromFile(filepath); // update ui to handle this stuff!
			// arm.playHistory();
		}
	}

	var recordingId = 0;
	saveButton.onclick = function() {
		if (!recording && arm.history.length > 0) {
			var filepath = 'recordings/recording_'+recordingId+'.json';
			fs.writeFile(filepath, JSON.stringify(arm.history), function(err) {
				if (err) {
					console.log(err);
				}
				else {
					console.log('saved');
					recordingId++;
				}
			});
		}
	}
}

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
		if (frame.hands.length > 0 && !playing) {

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
		else if (!blinking) {
			arm.lights.pulse(1000);
			blinking = true;
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