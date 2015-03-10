global.document = window.document;

var five = require('johnny-five');
var Leap = require('leapjs');
var fs = require('fs'); 
var THREE = require('three');

var Arm = require('./arm.js');

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
var fps = 30;

var blinking = false;
var recording = false;
var playing = false;

// var recordingFramerate = 20; // frames per second
var timer = 0;

board.on('ready', function() {
	var arm = new Arm(this);
	arm.init();

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
			arm.playHistoryFromFile(filepath);
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

	var options = {};
	// var controller = Leap.loop(options, function(frame) {
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
				// timer++; // increments by fps every second
				// if (timer % (fps / recordingFramerate) == 0) {
					arm.addHistory();
				// }
			}	
			// debug(arm.state['shoulderLeft']+' '+arm.state['shoulderRight']);
			// document.getElementById('coords').innerHTML = '('+String(pos.x)+', '+String(pos.y)+', '+String(pos.z)+')';
		}
		else if (!blinking) {
			arm.lights.pulse(1000);
			blinking = true;
		}
	}
	// });

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